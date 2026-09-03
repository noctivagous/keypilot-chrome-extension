/**
 * KeyPilot Extension Toggle Service Worker
 * Manages global extension state and coordinates toggle functionality across all tabs
 */

import { isSkippableTab, isSkippableUrl } from './src/config/url-policy.js';
import { FEATURE_FLAGS } from './src/config/constants.js';
import { MSG, TAB_UI_FORWARD_TYPES } from './src/messaging/types.js';
import { errorResponse, validateRuntimeMessage } from './src/messaging/validate.js';
import {
  storageGetValue,
  storageSetValue,
  storageSetObject
} from './src/utils/storage.js';
import { mediaLibraryService } from './src/utils/media-library-service.js';
import { blobToDataUrl } from './src/utils/media-library-transfer.js';
import { resolveVideoThumbnailUrl } from './src/utils/youtube-thumb.js';
import { isServiceWorkerFetchableVideoUrl } from './src/utils/video-url-utils.js';
import {
  fetchDictionaryDefinition,
  normalizeWordForLookup
} from './src/utils/dictionary-lookup.js';
import { startKeyPilotDebugFromSettings } from './src/utils/debug.js';
import {
  BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META,
  builtinFamilySelectValue,
  listLayoutPickerGroups
} from './src/config/keyboard-layouts.js';
import {
  KEYBOARD_LAYOUT_STORE_KEY,
  listUserKeyboardLayouts
} from './src/modules/keyboard-layout-store.js';

void startKeyPilotDebugFromSettings();

/**
 * Fetch file bytes in the service worker (host_permissions bypass CORS).
 * @param {string} url
 * @param {{ minBytes?: number, defaultMime?: string }} [opts]
 * @returns {Promise<{ blob: Blob, mime: string }|null>}
 */
async function fetchFileBytesInServiceWorker(url, opts = {}) {
  const src = String(url || '').trim();
  if (!isServiceWorkerFetchableVideoUrl(src)) return null;
  try {
    const res = await fetch(src, {
      credentials: 'omit',
      redirect: 'follow',
      cache: 'no-cache'
    });
    if (!res.ok) return null;
    const ct = String(res.headers.get('content-type') || '').toLowerCase();
    if (
      ct.includes('application/vnd.apple.mpegurl')
      || ct.includes('application/x-mpegurl')
      || ct.includes('application/dash+xml')
    ) {
      return null;
    }
    const blob = await res.blob();
    if (!(blob instanceof Blob) || blob.size <= 0) return null;
    const minBytes = Number(opts.minBytes) || 0;
    if (minBytes > 0 && blob.size < minBytes
      && !ct.startsWith('video/')
      && !/^application\/(octet-stream|mp4)/i.test(ct)) {
      return null;
    }
    const mime = (ct.split(';')[0].trim() || blob.type || opts.defaultMime || 'application/octet-stream');
    return { blob, mime };
  } catch (e) {
    console.warn('[KeyPilot] SW file fetch failed:', e?.message || e);
    return null;
  }
}

/**
 * Fetch progressive video bytes in the service worker (host_permissions bypass CORS).
 * Rejects HTML error pages and streaming manifests.
 * @param {string} url
 * @returns {Promise<{ blob: Blob, mime: string }|null>}
 */
async function fetchVideoBytesInServiceWorker(url) {
  const fetched = await fetchFileBytesInServiceWorker(url, { minBytes: 2048, defaultMime: 'video/mp4' });
  if (!fetched) return null;
  const ct = String(fetched.mime || '').toLowerCase();
  if (ct.includes('text/html')) return null;
  return fetched;
}

/** @type {Map<string, { url: string, source: string, ts: number }>} */
const videoThumbCache = new Map();
const VIDEO_THUMB_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const KEYBOARD_HELP_STORAGE_KEY = 'keypilot_keyboard_help_visible';
const ONBOARDING_ACTIVE_STORAGE_KEY = 'keypilot_onboarding_active';
const ONBOARDING_PROGRESS_STORAGE_KEY = 'keypilot_onboarding_progress';
const TRANSIENT_ACTION_STORAGE_KEY = 'keypilot_transient_action';

const KEYPILOT_CONTEXT_MENU_ID = 'kp-keypilot';
const keyboardReferenceContextValues = new Map();

function keyboardReferenceContextId(value) {
  const id = `kp-kb-context-${keyboardReferenceContextValues.size}`;
  keyboardReferenceContextValues.set(id, String(value || ''));
  return id;
}

async function refreshKeyboardReferenceContextMenu() {
  if (!chrome.contextMenus?.removeAll) return;
  try {
    keyboardReferenceContextValues.clear();
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: KEYPILOT_CONTEXT_MENU_ID,
      title: 'KeyPilot',
      contexts: ['all']
    });

    const createGroup = (title, parentId = KEYPILOT_CONTEXT_MENU_ID) => chrome.contextMenus.create({
      id: keyboardReferenceContextId(`group:${title}`),
      parentId,
      title,
      contexts: ['all']
    });
    const createAction = (parentId, value, title) => chrome.contextMenus.create({
      id: keyboardReferenceContextId(value),
      parentId,
      title,
      contexts: ['all']
    });

    createAction(KEYPILOT_CONTEXT_MENU_ID, '__toggle_keypilot__', 'Toggle KeyPilot');

    const keyPilotGroup = createGroup('KeyPilot Windows');
    createAction(keyPilotGroup, '__toggle_keyboard_reference__', 'Toggle Keyboard Reference');
    createAction(keyPilotGroup, '__onboarding_tutorial__', 'Onboarding Tutorial (Alt + T)');
    createAction(keyPilotGroup, '__docs_help__', 'KeyPilot Documentation (Alt + H)');
    createAction(keyPilotGroup, '__settings__', "KeyPilot Settings (')");

    const keyboardReferenceGroup = createGroup('Keyboard Reference');
    createAction(keyboardReferenceGroup, '__show_keyboard_reference__', 'Show Keyboard Reference');
    createAction(keyboardReferenceGroup, '__hide_keyboard_reference__', 'Hide Keyboard Reference');

    const builtInGroup = createGroup('Built-In Layouts', keyboardReferenceGroup);
    for (const family of BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META || []) {
      if (family?.id) {
        createAction(
          builtInGroup,
          builtinFamilySelectValue(family.id),
          String(family.label || family.id)
        );
      }
    }

    const customGroup = createGroup('Custom Layouts', keyboardReferenceGroup);
    const groups = listLayoutPickerGroups(await listUserKeyboardLayouts());
    for (const layout of groups.custom) {
      createAction(customGroup, layout.value, layout.label);
    }
    if (!groups.custom.length) {
      chrome.contextMenus.create({
        id: keyboardReferenceContextId('__no_custom_layouts__'),
        parentId: customGroup,
        title: 'None',
        contexts: ['all'],
        enabled: false
      });
    }

    const editorGroup = createGroup('Keyboard Layout Editor', keyboardReferenceGroup);
    createAction(editorGroup, '__edit_layouts__', 'Edit Keyboard Layout…');
    createAction(editorGroup, '__new_layout__', 'New Blank Keyboard Layout');
    createAction(editorGroup, '__duplicate_layout__', 'New Duplicate Keyboard Layout');
  } catch (e) {
    console.warn('[KeyPilot] Failed to refresh Keyboard Reference context menu:', e?.message || e);
  }
}

try {
  chrome.contextMenus?.onClicked?.addListener((info, tab) => {
    const value = keyboardReferenceContextValues.get(String(info?.menuItemId || ''));
    if (!value || value.startsWith('group:') || typeof tab?.id !== 'number') return;
    if (value === '__toggle_keypilot__') {
      void extensionToggleManager.toggleState();
      return;
    }
    void chrome.tabs.sendMessage(tab.id, {
      type: MSG.KEYBOARD_REFERENCE_CONTEXT_ACTION,
      value
    }).catch(() => {});
  });
  chrome.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes?.[KEYBOARD_LAYOUT_STORE_KEY]) {
      void refreshKeyboardReferenceContextMenu();
    }
  });
  void refreshKeyboardReferenceContextMenu();
} catch { /* contextMenus unavailable in tests or restricted contexts */ }

// --- Separate-window popover session map ---
/**
 * @typedef {{
 *   openerTabId: number,
 *   popupTabId: number,
 *   url: string,
 *   kind: 'preview'|'modal',
 *   closeKeys: string[]
 * }} PopoverWindowEntry
 */
/** @type {Map<number, PopoverWindowEntry>} */
const popoverWindowsByWindowId = new Map();
/** @type {Map<number, number>} openerTabId → windowId */
const popoverWindowByOpenerTabId = new Map();
/** @type {Map<number, number>} popupTabId → windowId */
const popoverWindowByPopupTabId = new Map();

/**
 * @param {number} windowId
 * @param {{ notifyOpener?: boolean, reason?: string }} [opts]
 */
async function clearPopoverWindowEntry(windowId, { notifyOpener = true, reason = 'closed' } = {}) {
  const entry = popoverWindowsByWindowId.get(windowId);
  if (!entry) return;
  popoverWindowsByWindowId.delete(windowId);
  if (popoverWindowByOpenerTabId.get(entry.openerTabId) === windowId) {
    popoverWindowByOpenerTabId.delete(entry.openerTabId);
  }
  if (popoverWindowByPopupTabId.get(entry.popupTabId) === windowId) {
    popoverWindowByPopupTabId.delete(entry.popupTabId);
  }

  if (notifyOpener && typeof entry.openerTabId === 'number') {
    try {
      await chrome.tabs.sendMessage(entry.openerTabId, {
        type: MSG.POPOVER_WINDOW_CLOSED,
        windowId,
        tabId: entry.popupTabId,
        url: entry.url,
        kind: entry.kind,
        reason
      });
    } catch { /* opener gone */ }
  }
}

/**
 * @param {number} openerTabId
 * @param {{
 *   url: string,
 *   kind?: 'preview'|'modal',
 *   closeKeys?: string[],
 *   width?: number,
 *   height?: number,
 *   left?: number,
 *   top?: number
 * }} opts
 * @returns {Promise<{ windowId: number, tabId: number }>}
 */
async function openPopoverWindowForOpener(openerTabId, opts) {
  const url = String(opts?.url || '').trim();
  if (!url) throw new Error('Invalid url');
  const kind = opts?.kind === 'modal' ? 'modal' : 'preview';
  const closeKeys = Array.isArray(opts?.closeKeys) && opts.closeKeys.length
    ? opts.closeKeys.map(String)
    : (kind === 'modal' ? ['Escape', 'p', 'P'] : ['Escape', 'e', 'E']);

  // One popover window per opener.
  const existingWindowId = popoverWindowByOpenerTabId.get(openerTabId);
  if (typeof existingWindowId === 'number') {
    // Clear map first so windows.onRemoved does not notify the opener mid-replace.
    await clearPopoverWindowEntry(existingWindowId, { notifyOpener: false, reason: 'replaced' });
    try {
      await chrome.windows.remove(existingWindowId);
    } catch { /* ignore */ }
  }

  /** @type {chrome.windows.CreateData} */
  const createData = {
    url,
    type: 'popup',
    focused: true
  };
  if (typeof opts?.width === 'number' && opts.width > 0) createData.width = Math.round(opts.width);
  if (typeof opts?.height === 'number' && opts.height > 0) createData.height = Math.round(opts.height);
  if (typeof opts?.left === 'number' && Number.isFinite(opts.left)) createData.left = Math.round(opts.left);
  if (typeof opts?.top === 'number' && Number.isFinite(opts.top)) createData.top = Math.round(opts.top);

  const win = await chrome.windows.create(createData);
  const windowId = win?.id;
  if (typeof windowId !== 'number') {
    throw new Error('Failed to create popover window');
  }

  let popupTabId = win.tabs?.[0]?.id;
  if (typeof popupTabId !== 'number') {
    try {
      const tabs = await chrome.tabs.query({ windowId });
      popupTabId = tabs?.[0]?.id;
    } catch { /* ignore */ }
  }
  if (typeof popupTabId !== 'number') {
    try { await chrome.windows.remove(windowId); } catch { /* ignore */ }
    throw new Error('Popover window has no tab');
  }

  /** @type {PopoverWindowEntry} */
  const entry = {
    openerTabId,
    popupTabId,
    url,
    kind,
    closeKeys
  };
  popoverWindowsByWindowId.set(windowId, entry);
  popoverWindowByOpenerTabId.set(openerTabId, windowId);
  popoverWindowByPopupTabId.set(popupTabId, windowId);

  return { windowId, tabId: popupTabId };
}

/**
 * @param {{ windowId?: number, openerTabId?: number, popupTabId?: number }} query
 * @param {{ notifyOpener?: boolean, reason?: string }} [opts]
 */
async function closePopoverWindow(query, opts = {}) {
  let windowId = typeof query?.windowId === 'number' ? query.windowId : null;
  if (windowId == null && typeof query?.openerTabId === 'number') {
    windowId = popoverWindowByOpenerTabId.get(query.openerTabId) ?? null;
  }
  if (windowId == null && typeof query?.popupTabId === 'number') {
    windowId = popoverWindowByPopupTabId.get(query.popupTabId) ?? null;
  }
  if (typeof windowId !== 'number') return false;

  // Clear map first so windows.onRemoved does not double-notify the opener.
  await clearPopoverWindowEntry(windowId, {
    notifyOpener: opts.notifyOpener !== false,
    reason: opts.reason || 'closed'
  });
  try {
    await chrome.windows.remove(windowId);
  } catch { /* already closed */ }
  return true;
}

try {
  chrome.windows.onRemoved.addListener((windowId) => {
    if (!popoverWindowsByWindowId.has(windowId)) return;
    void clearPopoverWindowEntry(windowId, { notifyOpener: true, reason: 'window_removed' });
  });
} catch { /* ignore */ }

try {
  chrome.tabs.onRemoved.addListener((tabId) => {
    // Opener closed → close its popover window.
    const openerWindowId = popoverWindowByOpenerTabId.get(tabId);
    if (typeof openerWindowId === 'number') {
      void closePopoverWindow(
        { windowId: openerWindowId },
        { notifyOpener: false, reason: 'opener_closed' }
      );
      return;
    }

    // Popup tab closed without windows.onRemoved (rare) → clear map.
    const popupWindowId = popoverWindowByPopupTabId.get(tabId);
    if (typeof popupWindowId === 'number') {
      void clearPopoverWindowEntry(popupWindowId, { notifyOpener: true, reason: 'tab_removed' });
    }
  });
} catch {
  // ignore
}

async function ensureDefaultKeyboardHelpVisible() {
  // Only set a default if the user has never set a preference.
  const existing = await storageGetValue(KEYBOARD_HELP_STORAGE_KEY, undefined);
  if (typeof existing === 'boolean') return;

  const ok = await storageSetValue(KEYBOARD_HELP_STORAGE_KEY, true, { includeTimestamp: true });
  if (ok) {
    console.log('Set default floating keyboard reference visibility: true');
  } else {
    console.warn('Failed to set default floating keyboard reference visibility');
  }
}

async function ensureDefaultOnboardingState() {
  // Only set a default if onboarding has never been initialized.
  const existing = await storageGetValue(ONBOARDING_ACTIVE_STORAGE_KEY, undefined);
  if (typeof existing === 'boolean') return;

  const progress = {
    slideId: 'basic_navigation',
    completedTaskIds: [],
    onEnterDoneSlideIds: [],
    completed: false,
    timestamp: Date.now()
  };

  const payload = {
    [ONBOARDING_ACTIVE_STORAGE_KEY]: true,
    [ONBOARDING_PROGRESS_STORAGE_KEY]: progress
  };

  const ok = await storageSetObject(payload);
  if (ok) {
    console.log('Set default onboarding state: active=true');
  } else {
    console.warn('Failed to set default onboarding state');
  }
}

class ExtensionToggleManager {
  constructor() {
    this.STORAGE_KEY = 'keypilot_enabled';
    this.DEFAULT_STATE = true;
    this.initialized = false;
  }

  /**
   * Initialize the toggle manager
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Ensure we have a valid initial state
      const currentState = await this.getState();
      console.log('ExtensionToggleManager initialized with state:', currentState);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize ExtensionToggleManager:', error);
      // Continue with default state
      this.initialized = true;
    }
  }

  /**
   * Get current extension state from storage
   * @returns {Promise<boolean>} Current enabled state
   */
  async getState() {
    const value = await storageGetValue(this.STORAGE_KEY, this.DEFAULT_STATE);
    return typeof value === 'boolean' ? value : this.DEFAULT_STATE;
  }

  /**
   * Set extension state in storage and notify all tabs
   * @param {boolean} enabled - New enabled state
   * @returns {Promise<boolean>} The state that was set
   */
  async setState(enabled) {
    const state = Boolean(enabled);
    const ok = await storageSetValue(this.STORAGE_KEY, state, { includeTimestamp: true });
    if (ok) {
      console.log('State saved to storage:', state);
    } else {
      console.error('Failed to save state to any storage');
    }

    // Update content script execution state based on new state
    await contentScriptManager.updateContentScriptState(state);

    // Notify all tabs about the state change
    await this.notifyAllTabs(state);

    return state;
  }

  /**
   * Toggle current extension state
   * @returns {Promise<boolean>} New state after toggle
   */
  async toggleState() {
    try {
      const currentState = await this.getState();
      const newState = !currentState;
      await this.setState(newState);
      console.log('Extension state toggled:', currentState, '->', newState);
      return newState;
    } catch (error) {
      console.error('Failed to toggle state:', error);
      // Return current state or default if toggle fails
      return await this.getState();
    }
  }

  /**
   * Notify all frames in all tabs about state change.
   * chrome.tabs.sendMessage without frameId only reaches the top frame — the
   * light frame-click-agent in embeds must get the same toggle.
   * @param {boolean} enabled - New enabled state
   */
  async notifyAllTabs(enabled) {
    try {
      const tabs = await chrome.tabs.query({});
      const message = {
        type: MSG.TOGGLE_STATE,
        enabled: enabled,
        timestamp: Date.now()
      };

      const notifications = tabs.map(async (tab) => {
        if (typeof tab?.id !== 'number') return;
        try {
          await sendMessageToAllFramesInTab(tab.id, message);
        } catch (error) {
          console.debug('Could not notify tab', tab.id, ':', error.message);
        }
      });

      await Promise.allSettled(notifications);
      console.log('Notified', tabs.length, 'tabs about state change:', enabled);
    } catch (error) {
      console.error('Failed to notify tabs:', error);
    }
  }

}

/**
 * Send a runtime message to every frame in a tab (top + iframes).
 * Plain tabs.sendMessage(tabId, msg) only reaches frameId 0.
 * @param {number} tabId
 * @param {object} message
 * @returns {Promise<void>}
 */
async function sendMessageToAllFramesInTab(tabId, message) {
  if (typeof tabId !== 'number') return;
  let frames = [];
  try {
    frames = await chrome.webNavigation.getAllFrames({ tabId }) || [];
  } catch {
    frames = [];
  }
  if (!frames.length) {
    try {
      await chrome.tabs.sendMessage(tabId, message);
    } catch {
      // no receiver
    }
    return;
  }
  await Promise.allSettled(
    frames.map(async (frame) => {
      if (!frame || typeof frame.frameId !== 'number') return;
      try {
        await chrome.tabs.sendMessage(tabId, message, { frameId: frame.frameId });
      } catch {
        // Frame may lack a content script (chrome://, sandboxed, etc.)
      }
    })
  );
}

/**
 * Ping every tab so an open Media Library overlay can reload.
 * Top-frame only — the overlay is never injected into iframes.
 * @param {{ reason?: string }} [detail]
 */
async function notifyMediaLibraryChanged(detail = {}) {
  const message = {
    type: MSG.MEDIA_LIBRARY_CHANGED,
    reason: detail.reason || 'change',
    timestamp: Date.now()
  };
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(
      tabs.map(async (tab) => {
        if (typeof tab?.id !== 'number') return;
        try {
          await chrome.tabs.sendMessage(tab.id, message);
        } catch {
          // Tab has no content script (chrome://, discarded, etc.)
        }
      })
    );
  } catch (error) {
    console.debug('[KeyPilot] Media Library change notify failed:', error?.message || error);
  }
}

// -----------------------------
// Per-tab navigation graph (tab history)
// -----------------------------

const NAVGRAPH_STORAGE_PREFIX = 'kp_navgraph_v1_tab_';
const NAVGRAPH_MAX_NODES = 300;
const NAVGRAPH_SAVE_DEBOUNCE_MS = 200;
// History behavior:
// - 'linear': on new navigation from a past entry, discard the forward subtree (default)
// - 'branching': retain multiple forward branches (tree)
const NAVGRAPH_MODE_STORAGE_KEY = 'keypilot_tab_history_mode';
const NAVGRAPH_MODE_DEFAULT = 'linear'; // 'linear' | 'branching'

function getPreferredNavGraphStorageArea() {
  // Prefer session (clears with browser session), but fall back to local.
  try {
    if (chrome?.storage?.session?.get && chrome?.storage?.session?.set) return chrome.storage.session;
  } catch {
    // ignore
  }
  return chrome.storage.local;
}

class TabNavGraphManager {
  constructor() {
    /** @type {Map<number, any>} */
    this._graphs = new Map();
    /** @type {Set<number>} */
    this._loadedTabs = new Set();
    /** @type {Map<number, number>} */
    this._saveTimers = new Map();
    this._storageArea = getPreferredNavGraphStorageArea();

    /** @type {'linear'|'branching'} */
    this._mode = NAVGRAPH_MODE_DEFAULT;
    this._modeLoadStarted = false;

    this._onWebNavCommitted = this._onWebNavCommitted.bind(this);
    this._onWebNavHistoryStateUpdated = this._onWebNavHistoryStateUpdated.bind(this);
    this._onWebNavReferenceFragmentUpdated = this._onWebNavReferenceFragmentUpdated.bind(this);
    this._onTabRemoved = this._onTabRemoved.bind(this);

    this._installListeners();
    // Best-effort: load persisted preference, but default to linear if missing.
    this._loadMode();
  }

  async _loadMode() {
    if (this._modeLoadStarted) return;
    this._modeLoadStarted = true;

    const storedMode = await storageGetValue(NAVGRAPH_MODE_STORAGE_KEY, null);

    if (storedMode === 'linear' || storedMode === 'branching') {
      this._mode = storedMode;
      return;
    }

    // Persist default if user has never set a preference (best-effort).
    await storageSetValue(NAVGRAPH_MODE_STORAGE_KEY, NAVGRAPH_MODE_DEFAULT, {
      includeTimestamp: true
    });
  }

  _installListeners() {
    // WebNavigation listeners need the permission. Guard so we don't crash if unavailable.
    try {
      if (chrome?.webNavigation?.onCommitted?.addListener) {
        chrome.webNavigation.onCommitted.addListener(this._onWebNavCommitted);
      }
      if (chrome?.webNavigation?.onHistoryStateUpdated?.addListener) {
        chrome.webNavigation.onHistoryStateUpdated.addListener(this._onWebNavHistoryStateUpdated);
      }
      if (chrome?.webNavigation?.onReferenceFragmentUpdated?.addListener) {
        chrome.webNavigation.onReferenceFragmentUpdated.addListener(this._onWebNavReferenceFragmentUpdated);
      }
    } catch (e) {
      console.warn('[NavGraph] Failed to install webNavigation listeners:', e?.message || e);
    }

    try {
      if (chrome?.tabs?.onRemoved?.addListener) {
        chrome.tabs.onRemoved.addListener(this._onTabRemoved);
      }
    } catch (e) {
      console.warn('[NavGraph] Failed to install tabs.onRemoved listener:', e?.message || e);
    }
  }

  _storageKey(tabId) {
    return `${NAVGRAPH_STORAGE_PREFIX}${tabId}`;
  }

  _emptyGraph() {
    return {
      version: 1,
      nextNodeId: 1,
      nodes: [],
      edges: [],
      cursorId: null,
      updatedAt: Date.now()
    };
  }

  async _ensureLoaded(tabId) {
    const tid = Number(tabId);
    if (!Number.isFinite(tid)) return;
    if (this._loadedTabs.has(tid)) return;
    this._loadedTabs.add(tid);

    const key = this._storageKey(tid);

    // Prefer session, but allow local fallback even if session is preferred.
    let stored = null;
    try {
      const session = chrome?.storage?.session;
      if (session?.get) {
        const res = await session.get([key]);
        stored = res?.[key] ?? null;
      }
    } catch {
      // ignore
    }

    if (!stored) {
      try {
        const res = await chrome.storage.local.get([key]);
        stored = res?.[key] ?? null;
      } catch {
        // ignore
      }
    }

    if (stored && typeof stored === 'object' && Array.isArray(stored.nodes) && Array.isArray(stored.edges)) {
      this._graphs.set(tid, stored);
    } else {
      this._graphs.set(tid, this._emptyGraph());
    }
  }

  async getGraph(tabId, { currentUrl, currentTitle } = {}) {
    const tid = Number(tabId);
    if (!Number.isFinite(tid)) return { tabId: tid, graph: this._emptyGraph() };
    await this._ensureLoaded(tid);

    const g = this._graphs.get(tid) || this._emptyGraph();

    // Best-effort: update current node title/url from the live tab metadata.
    try {
      const url = typeof currentUrl === 'string' ? currentUrl.trim() : '';
      const title = typeof currentTitle === 'string' ? currentTitle : '';
      if (g.cursorId != null && url) {
        const node = g.nodes.find((n) => n && n.id === g.cursorId);
        if (node) {
          if (url && node.url !== url) node.url = url;
          if (title && node.title !== title) node.title = title;
          node.tsLastSeen = Date.now();
          g.updatedAt = Date.now();
          this._scheduleSave(tid);
        }
      }
    } catch {
      // ignore
    }

    return { tabId: tid, graph: g };
  }

  async clear(tabId) {
    const tid = Number(tabId);
    if (!Number.isFinite(tid)) return;
    const g = this._emptyGraph();
    this._graphs.set(tid, g);
    this._loadedTabs.add(tid);
    await this._saveNow(tid);
  }

  async _saveNow(tabId) {
    const tid = Number(tabId);
    if (!Number.isFinite(tid)) return;
    const key = this._storageKey(tid);
    const g = this._graphs.get(tid);
    if (!g) return;

    try {
      await this._storageArea.set({ [key]: g });
      return;
    } catch {
      // ignore
    }

    // Fallback to local if session write failed.
    try {
      await chrome.storage.local.set({ [key]: g });
    } catch (e) {
      console.warn('[NavGraph] Failed to persist graph:', e?.message || e);
    }
  }

  _scheduleSave(tabId) {
    const tid = Number(tabId);
    if (!Number.isFinite(tid)) return;
    const existing = this._saveTimers.get(tid);
    if (existing) {
      try { clearTimeout(existing); } catch { /* ignore */ }
    }
    const timer = setTimeout(() => {
      this._saveTimers.delete(tid);
      this._saveNow(tid);
    }, NAVGRAPH_SAVE_DEBOUNCE_MS);
    this._saveTimers.set(tid, timer);
  }

  _addEdge(g, fromId, toId, kind) {
    if (fromId == null || toId == null) return;
    g.edges.push({
      fromId,
      toId,
      kind: String(kind || 'navigate'),
      ts: Date.now()
    });
  }

  _addNode(g, url, title = '') {
    const id = g.nextNodeId++;
    const now = Date.now();
    g.nodes.push({
      id,
      url,
      title: typeof title === 'string' ? title : '',
      tsCreated: now,
      tsLastSeen: now
    });
    return id;
  }

  _findNodeByUrl(g, url) {
    const target = String(url || '').trim();
    if (!target) return null;
    // Prefer most-recent node with the same URL.
    for (let i = g.nodes.length - 1; i >= 0; i--) {
      const n = g.nodes[i];
      if (n && n.url === target) return n.id;
    }
    return null;
  }

  _trimForwardFromCursor(g, cursorId) {
    if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) return;
    if (cursorId == null) return;

    const structuralKinds = new Set(['navigate', 'programmatic', 'reload']);
    /** @type {Map<number, number[]>} */
    const children = new Map();

    for (const e of g.edges) {
      if (!e || !structuralKinds.has(e.kind)) continue;
      const fromId = e.fromId;
      const toId = e.toId;
      if (typeof fromId !== 'number' || typeof toId !== 'number') continue;
      if (!children.has(fromId)) children.set(fromId, []);
      children.get(fromId).push(toId);
    }

    const toRemove = new Set();
    const stack = (children.get(cursorId) || []).slice();

    while (stack.length) {
      const id = stack.pop();
      if (typeof id !== 'number') continue;
      if (toRemove.has(id)) continue;
      toRemove.add(id);
      const kids = children.get(id) || [];
      for (const k of kids) stack.push(k);
    }

    if (!toRemove.size) return;

    g.nodes = g.nodes.filter((n) => n && typeof n.id === 'number' && !toRemove.has(n.id));
    g.edges = g.edges.filter((e) => e && !toRemove.has(e.fromId) && !toRemove.has(e.toId));

    // Cursor should never be removed, but keep it safe.
    if (g.cursorId != null && toRemove.has(g.cursorId)) {
      g.cursorId = cursorId;
    }
  }

  _pruneGraph(g) {
    if (!g || !Array.isArray(g.nodes) || g.nodes.length <= NAVGRAPH_MAX_NODES) return;
    const cursorId = g.cursorId;

    // Remove oldest nodes first, but never remove the cursor node.
    while (g.nodes.length > NAVGRAPH_MAX_NODES) {
      let oldestIdx = -1;
      let oldestTs = Infinity;
      for (let i = 0; i < g.nodes.length; i++) {
        const n = g.nodes[i];
        if (!n) continue;
        if (cursorId != null && n.id === cursorId) continue;
        const ts = Number(n.tsCreated) || 0;
        if (ts < oldestTs) {
          oldestTs = ts;
          oldestIdx = i;
        }
      }
      if (oldestIdx < 0) break;
      const removed = g.nodes.splice(oldestIdx, 1)[0];
      if (!removed) break;
      const rid = removed.id;
      g.edges = g.edges.filter((e) => e && e.fromId !== rid && e.toId !== rid);
    }

    // If cursor somehow points to a missing node, reset to most recent.
    if (g.cursorId != null && !g.nodes.some((n) => n && n.id === g.cursorId)) {
      g.cursorId = g.nodes.length ? g.nodes[g.nodes.length - 1].id : null;
    }
  }

  async _recordNavigation({ tabId, url, title, kind }) {
    const tid = Number(tabId);
    if (!Number.isFinite(tid)) return;
    const u = String(url || '').trim();
    if (!u || isSkippableUrl(u)) return;

    await this._ensureLoaded(tid);
    const g = this._graphs.get(tid) || this._emptyGraph();

    const prevCursor = g.cursorId;
    const now = Date.now();

    // Same URL as current node → just update timestamps/title.
    try {
      if (prevCursor != null) {
        const cur = g.nodes.find((n) => n && n.id === prevCursor);
        if (cur && cur.url === u) {
          cur.tsLastSeen = now;
          if (title && !cur.title) cur.title = title;
          g.updatedAt = now;
          this._graphs.set(tid, g);
          this._scheduleSave(tid);
          return;
        }
      }
    } catch {
      // ignore
    }

    if (kind === 'back_forward') {
      const existingId = this._findNodeByUrl(g, u);
      if (existingId != null) {
        g.cursorId = existingId;
        this._addEdge(g, prevCursor, existingId, 'back_forward');
        const node = g.nodes.find((n) => n && n.id === existingId);
        if (node) node.tsLastSeen = now;
        g.updatedAt = now;
        this._graphs.set(tid, g);
        this._scheduleSave(tid);
        return;
      }
      // Fall back: if we can't find it, treat as a normal navigation.
      kind = 'navigate';
    }

    // Default behavior: keep history linear unless explicitly set to branching.
    // If the user navigates from a past entry (i.e., not via back/forward), discard
    // the forward subtree so we behave like a normal browser history stack.
    if (this._mode !== 'branching' && prevCursor != null) {
      this._trimForwardFromCursor(g, prevCursor);
    }

    const newId = this._addNode(g, u, title || '');
    if (prevCursor != null) this._addEdge(g, prevCursor, newId, kind || 'navigate');
    g.cursorId = newId;
    g.updatedAt = now;

    this._pruneGraph(g);
    this._graphs.set(tid, g);
    this._scheduleSave(tid);
  }

  async _onWebNavCommitted(details) {
    try {
      if (!details || details.frameId !== 0) return;
      const url = details.url;
      const tabId = details.tabId;
      const qualifiers = Array.isArray(details.transitionQualifiers) ? details.transitionQualifiers : [];

      let kind = 'navigate';
      if (qualifiers.includes('forward_back')) kind = 'back_forward';
      else if (details.transitionType === 'reload') kind = 'reload';

      await this._recordNavigation({ tabId, url, kind });
    } catch (e) {
      console.warn('[NavGraph] onCommitted failed:', e?.message || e);
    }
  }

  async _onWebNavHistoryStateUpdated(details) {
    try {
      if (!details || details.frameId !== 0) return;
      const url = details.url;
      const tabId = details.tabId;
      // SPA pushState/replaceState: treat as programmatic navigation edge.
      await this._recordNavigation({ tabId, url, kind: 'programmatic' });
    } catch (e) {
      console.warn('[NavGraph] onHistoryStateUpdated failed:', e?.message || e);
    }
  }

  async _onWebNavReferenceFragmentUpdated(details) {
    try {
      if (!details || details.frameId !== 0) return;
      const url = details.url;
      const tabId = details.tabId;
      // Hash updates are usually user-visible navigation; treat as programmatic.
      await this._recordNavigation({ tabId, url, kind: 'programmatic' });
    } catch (e) {
      console.warn('[NavGraph] onReferenceFragmentUpdated failed:', e?.message || e);
    }
  }

  async _onTabRemoved(tabId) {
    const tid = Number(tabId);
    if (!Number.isFinite(tid)) return;
    try {
      const key = this._storageKey(tid);
      this._graphs.delete(tid);
      this._loadedTabs.delete(tid);
      const timer = this._saveTimers.get(tid);
      if (timer) {
        try { clearTimeout(timer); } catch { /* ignore */ }
        this._saveTimers.delete(tid);
      }
      try {
        if (chrome?.storage?.session?.remove) await chrome.storage.session.remove([key]);
      } catch {
        // ignore
      }
      try {
        await chrome.storage.local.remove([key]);
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  }
}

// Create global instance
const extensionToggleManager = new ExtensionToggleManager();
const tabNavGraphManager = new TabNavGraphManager();

/**
 * Content Script Manager for Conditional Execution
 * Handles conditional execution of content scripts based on extension state
 */
class ContentScriptManager {
  constructor() {
    this.extensionEnabled = true; // Default to enabled
  }

  /**
   * Update content script execution state
   */
  async updateContentScriptState(enabled) {
    this.extensionEnabled = enabled;

    // Notify all frames in all tabs about the state change
    // The content scripts will handle enabling/disabling based on this state
    try {
      const tabs = await chrome.tabs.query({});
      const message = {
        type: MSG.UPDATE_STATE,
        enabled: enabled,
        timestamp: Date.now()
      };

      const notifications = tabs.map(async (tab) => {
        if (typeof tab?.id !== 'number') return;
        try {
          await sendMessageToAllFramesInTab(tab.id, message);
        } catch {
          // Ignore errors for tabs that don't have content scripts
        }
      });

      await Promise.allSettled(notifications);
      console.log('Notified', tabs.length, 'tabs about content script state change:', enabled);
    } catch (error) {
      console.error('Failed to notify tabs about content script state change:', error);
    }
  }

  /**
   * Check if content scripts should be active
   */
  shouldExecute() {
    return this.extensionEnabled;
  }
}

// Create content script manager instance
const contentScriptManager = new ContentScriptManager();
// Log when service worker starts up
console.log('KeyPilot service worker started');/**

 * Message Handler for Cross-Tab Communication
 * Handles messages from popup and content scripts
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message, 'from:', sender);

  // Handle async operations properly
  (async () => {
    try {
      const validationError = validateRuntimeMessage(message, { requireSwRequest: true });
      if (validationError) {
        sendResponse(errorResponse(validationError));
        return;
      }

      await extensionToggleManager.initialize();

      switch (message.type) {
        case MSG.TRANSIENT_ACTION: {
          // Persist transient actions (like "back") in extension storage so they survive
          // content-script unload / navigation timing.
          //
          // IMPORTANT: Content scripts can always read `chrome.storage.local`, but may not have access
          // to `chrome.storage.session` across Chrome versions. Use local for reliability.
          const action = typeof message.action === 'string' ? message.action : '';
          const timestamp = typeof message.timestamp === 'number' ? message.timestamp : Date.now();
          if (!action) {
            sendResponse({ type: MSG.ERROR, message: 'Missing action' });
            break;
          }

          const payload = {
            action,
            timestamp,
            // Helpful for debugging; not relied upon.
            tabId: sender?.tab?.id ?? null,
            url: sender?.tab?.url ?? null
          };

          try {
            await chrome.storage.local.set({ [TRANSIENT_ACTION_STORAGE_KEY]: payload });
            // Best-effort: also write to session if available (useful for extension pages).
            try {
              if (chrome.storage?.session?.set) {
                await chrome.storage.session.set({ [TRANSIENT_ACTION_STORAGE_KEY]: payload });
              }
            } catch {
              // ignore
            }
            sendResponse({ type: MSG.SUCCESS });
          } catch (e) {
            console.warn('Failed to persist transient action:', e?.message || e);
            sendResponse({ type: MSG.ERROR, message: 'Failed to persist transient action' });
          }
          break;
        }

        case MSG.GET_RECENT_BOOKMARKS: {
          const maxResults = Math.max(1, Math.min(100, Number(message.maxResults) || 24));
          try {
            if (chrome.bookmarks && typeof chrome.bookmarks.getRecent === 'function') {
              const nodes = await chrome.bookmarks.getRecent(maxResults);
              const bookmarks = (nodes || [])
                .filter((n) => n && n.url)
                .map((n) => ({
                  title: n.title || 'Untitled',
                  url: n.url,
                  dateAdded: n.dateAdded,
                  id: n.id,
                  parentId: n.parentId
                }));
              sendResponse({
                type: MSG.RECENT_BOOKMARKS_RESPONSE,
                bookmarks,
                success: true
              });
            } else {
              sendResponse({
                type: MSG.RECENT_BOOKMARKS_RESPONSE,
                bookmarks: [],
                success: false,
                error: 'Bookmarks API not available'
              });
            }
          } catch (error) {
            console.error('KP_GET_RECENT_BOOKMARKS failed:', error);
            sendResponse({
              type: MSG.RECENT_BOOKMARKS_RESPONSE,
              bookmarks: [],
              success: false,
              error: error.message
            });
          }
          break;
        }

        case MSG.GET_MOST_VISITED: {
          try {
            if (chrome.topSites && typeof chrome.topSites.get === 'function') {
              const sites = await chrome.topSites.get();
              const list = (sites || [])
                .filter((s) => s && s.url)
                .slice(0, 24)
                .map((s) => ({
                  title: s.title || '',
                  url: s.url
                }));
              sendResponse({
                type: MSG.MOST_VISITED_RESPONSE,
                sites: list,
                success: true
              });
            } else {
              sendResponse({
                type: MSG.MOST_VISITED_RESPONSE,
                sites: [],
                success: false,
                error: 'Top Sites API not available'
              });
            }
          } catch (error) {
            console.error('KP_GET_MOST_VISITED failed:', error);
            sendResponse({
              type: MSG.MOST_VISITED_RESPONSE,
              sites: [],
              success: false,
              error: error.message
            });
          }
          break;
        }

        case MSG.GET_BOOKMARKS: {
          // Return bookmark tree for launcher popover
          try {
            if (chrome.bookmarks && typeof chrome.bookmarks.getTree === 'function') {
              const bookmarkTree = await chrome.bookmarks.getTree();

              // Flatten bookmark tree into array of bookmark objects.
              // Chrome's Bookmarks bar is folder id "1"; mark its descendants as toolbar.
              const bookmarks = [];
              const isToolbarFolder = (node) =>
                node?.id === '1' ||
                String(node?.title || '').toLowerCase() === 'bookmarks bar';

              const extractBookmarks = (nodes, isToolbar) => {
                for (const node of nodes) {
                  if (node.url) {
                    bookmarks.push({
                      title: node.title || 'Untitled',
                      url: node.url,
                      dateAdded: node.dateAdded,
                      id: node.id,
                      parentId: node.parentId,
                      isToolbar: !!isToolbar
                    });
                  }
                  if (node.children) {
                    extractBookmarks(node.children, isToolbar);
                  }
                }
              };

              const topFolders = bookmarkTree[0]?.children || [];
              if (topFolders.length) {
                for (const folder of topFolders) {
                  extractBookmarks(folder.children || [], isToolbarFolder(folder));
                }
              } else {
                extractBookmarks(bookmarkTree, false);
              }

              sendResponse({
                type: MSG.BOOKMARKS_RESPONSE,
                bookmarks: bookmarks,
                success: true
              });
            } else {
              sendResponse({
                type: MSG.BOOKMARKS_RESPONSE,
                bookmarks: [],
                success: false,
                error: 'Bookmarks API not available'
              });
            }
          } catch (error) {
            console.error('KP_GET_BOOKMARKS failed:', error);
            sendResponse({
              type: MSG.BOOKMARKS_RESPONSE,
              bookmarks: [],
              success: false,
              error: error.message
            });
          }
          break;
        }

        case MSG.OMNIBOX_SUGGEST: {
          // Return omnibox suggestions from:
          // - topSites (most visited)
          // - bookmarks (bookmark bar first, then others)
          // - history
          //
          // Also inject a "closest domain" convenience row (source: 'domain') when the
          // query looks like a domain prefix (no spaces) and we can find a strong match.
          const query = typeof message.query === 'string' ? message.query.trim() : '';
          const maxResults = Math.max(1, Math.min(25, Number(message.maxResults) || 12));

          const queryLower = query.toLowerCase();

          /** @type {Array<any>} */
          const candidates = [];
          /** @type {Map<string, any>} */
          const bestByUrl = new Map();

          const safeUrlHost = (url) => {
            try {
              const u = new URL(String(url || '').trim());
              const h = (u.hostname || '').toLowerCase();
              return h.replace(/^www\./, '');
            } catch {
              return '';
            }
          };

          const normalizeUrl = (url) => {
            if (!url || typeof url !== 'string') return '';
            return url.trim();
          };

          const computeBaseScore = ({ source, isToolbar, url, title, historyVisitCount, historyTypedCount, historyLastVisitTime }) => {
            // Primary priority tiers:
            // - topSites / most visited
            // - bookmark bar ("toolbar")
            // - other bookmarks
            // - history
            let score = 0;
            if (source === 'topSites') score += 4000;
            else if (source === 'bookmark') score += isToolbar ? 3200 : 2800;
            else if (source === 'history') score += 2000;

            // Strongly prioritize frequently visited URLs (across all sources).
            // e.g. 25 visits => 500, 50 => 1000, 100+ => 2000 (cap).
            const visits = Math.max(0, Number(historyVisitCount) || 0);
            score += Math.min(2000, visits * 20);
            score += Math.min(600, Math.max(0, Number(historyTypedCount) || 0) * 30);
            score += Math.min(500, Math.max(0, Math.floor(((Number(historyLastVisitTime) || 0) - (Date.now() - 30 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000))) * 5);

            const host = safeUrlHost(url);
            // Query fit boosts (favor prefix host matches like "gma" -> gmail.com)
            if (queryLower && host) {
              if (host === queryLower) score += 1500;
              else if (host.startsWith(queryLower)) score += 1200 - Math.min(300, host.length - queryLower.length);
              else if (host.includes(queryLower)) score += 600 - Math.min(300, host.indexOf(queryLower));
            }
            const t = String(title || '').toLowerCase();
            if (queryLower && t) {
              if (t.startsWith(queryLower)) score += 250;
              else if (t.includes(queryLower)) score += 120;
            }
            return score;
          };

          const sourceTier = (source, isToolbar) => {
            if (source === 'topSites') return 4;
            if (source === 'bookmark') return isToolbar ? 3 : 2;
            if (source === 'history') return 1;
            return 0;
          };

          const addCandidate = ({ title, url, source, isToolbar = false, historyVisitCount = 0, historyTypedCount = 0, historyLastVisitTime = 0 }) => {
            const normalizedUrl = normalizeUrl(url);
            if (!normalizedUrl) return;

            const prev = bestByUrl.get(normalizedUrl);

            // Merge history visit stats across sources so bookmarks/topSites
            // still benefit from frequency when the same URL appears in history.
            const mergedVisitCount = Math.max(
              Number(prev?.historyVisitCount) || 0,
              Number(historyVisitCount) || 0
            );
            const mergedTypedCount = Math.max(
              Number(prev?.historyTypedCount) || 0,
              Number(historyTypedCount) || 0
            );
            const mergedLastVisitTime = Math.max(
              Number(prev?.historyLastVisitTime) || 0,
              Number(historyLastVisitTime) || 0
            );

            // Keep the highest-tier source; prefer a non-empty title.
            const preferIncomingSource =
              !prev || sourceTier(source, isToolbar) > sourceTier(prev.source, prev.isToolbar);
            const nextSource = preferIncomingSource ? source : prev.source;
            const nextIsToolbar = preferIncomingSource ? Boolean(isToolbar) : Boolean(prev.isToolbar);
            const incomingTitle = typeof title === 'string' ? title : '';
            const nextTitle = incomingTitle || (typeof prev?.title === 'string' ? prev.title : '');

            const entry = {
              title: nextTitle,
              url: normalizedUrl,
              source: nextSource,
              isToolbar: nextIsToolbar,
              host: safeUrlHost(normalizedUrl),
              historyVisitCount: mergedVisitCount,
              historyTypedCount: mergedTypedCount,
              historyLastVisitTime: mergedLastVisitTime,
              score: computeBaseScore({
                source: nextSource,
                isToolbar: nextIsToolbar,
                url: normalizedUrl,
                title: nextTitle,
                historyVisitCount: mergedVisitCount,
                historyTypedCount: mergedTypedCount,
                historyLastVisitTime: mergedLastVisitTime
              })
            };

            bestByUrl.set(normalizedUrl, entry);
          };

          // 0) Most visited / top sites
          try {
            if (chrome.topSites && typeof chrome.topSites.get === 'function') {
              const topSites = await chrome.topSites.get();
              for (const site of topSites || []) {
                const url = site?.url || '';
                const title = site?.title || '';
                // If user typed something, only include topSites that match reasonably.
                if (queryLower) {
                  const host = safeUrlHost(url);
                  const t = String(title || '').toLowerCase();
                  if (!host.startsWith(queryLower) && !host.includes(queryLower) && !t.includes(queryLower)) continue;
                }
                addCandidate({ title, url, source: 'topSites' });
              }
            }
          } catch {
            // ignore
          }

          // 1) Bookmarks (only nodes with urls)
          try {
            if (chrome.bookmarks && typeof chrome.bookmarks.search === 'function') {
              const bookmarkNodes = await chrome.bookmarks.search(query || '');
              for (const node of bookmarkNodes || []) {
                if (!node || !node.url) continue;
                // Chrome bookmark bar is usually id "1" (Bookmarks Bar). Use parentId as a heuristic.
                const isToolbar = String(node.parentId || '') === '1';
                addCandidate({ title: node?.title || '', url: node?.url || '', source: 'bookmark', isToolbar });
              }
            }
          } catch (e) {
            console.warn('KP_OMNIBOX_SUGGEST: bookmark search failed:', e?.message || e);
          }

          // 2) History (fetch extra so visit counts can enrich bookmarks/topSites)
          try {
            if (chrome.history && typeof chrome.history.search === 'function') {
              const historyItems = await chrome.history.search({
                text: query,
                maxResults: Math.max(maxResults * 4, 50),
                startTime: 0
              });
              for (const item of historyItems || []) {
                addCandidate({
                  title: item?.title || '',
                  url: item?.url || '',
                  source: 'history',
                  historyVisitCount: Number(item?.visitCount) || 0,
                  historyTypedCount: Number(item?.typedCount) || 0,
                  historyLastVisitTime: Number(item?.lastVisitTime) || 0
                });
              }
            }
          } catch (e) {
            console.warn('KP_OMNIBOX_SUGGEST: history search failed:', e?.message || e);
          }

          candidates.push(...bestByUrl.values());

          // Sort by score, then by visit frequency (most visited first).
          candidates.sort((a, b) => {
            const scoreDiff = (Number(b?.score) || 0) - (Number(a?.score) || 0);
            if (scoreDiff !== 0) return scoreDiff;
            return (Number(b?.historyVisitCount) || 0) - (Number(a?.historyVisitCount) || 0);
          });

          // Compute "closest domain" row.
          // Only when query is domain-ish: no spaces, at least 2 chars.
          let closestDomain = '';
          if (queryLower && queryLower.length >= 2 && !/\s/.test(queryLower)) {
            /** @type {Map<string, any>} */
            const bestByHost = new Map();
            for (const c of candidates) {
              const host = String(c?.host || '').toLowerCase().replace(/^www\./, '');
              if (!host) continue;
              // Require at least partial host match so we don't suggest random domains.
              if (!host.startsWith(queryLower) && !host.includes(queryLower)) continue;

              // Prefer bookmarks (and toolbar) over history by bumping hostScore.
              let hostScore = Number(c?.score) || 0;
              if (c?.source === 'bookmark') hostScore += c?.isToolbar ? 1200 : 900;
              if (c?.source === 'topSites') hostScore += 700;
              if (host === queryLower) hostScore += 1000;
              if (host.startsWith(queryLower)) hostScore += 700;

              const prev = bestByHost.get(host);
              if (!prev || hostScore > (Number(prev?.hostScore) || 0)) {
                bestByHost.set(host, { host, hostScore });
              }
            }
            let best = null;
            for (const v of bestByHost.values()) {
              if (!best || (Number(v.hostScore) || 0) > (Number(best.hostScore) || 0)) best = v;
            }
            closestDomain = best?.host || '';
          }

          /** @type {Array<any>} */
          const finalSuggestions = [];

          // Insert domain row at the top if we found one.
          if (closestDomain) {
            finalSuggestions.push({
              title: closestDomain,
              url: `https://${closestDomain}`,
              source: 'domain'
            });
          }

          // If we have a closest domain, bring URLs from that domain to the top (below the domain row),
          // then keep the rest in their score order.
          if (closestDomain) {
            for (const c of candidates) {
              if (c?.host === closestDomain) finalSuggestions.push(c);
            }
            for (const c of candidates) {
              if (c?.host !== closestDomain) finalSuggestions.push(c);
            }
          } else {
            finalSuggestions.push(...candidates);
          }

          // De-dupe by URL one more time (in case the domain URL matches a real entry), then cap.
          /** @type {Set<string>} */
          const seenUrls = new Set();
          const suggestions = [];
          for (const s of finalSuggestions) {
            const u = normalizeUrl(s?.url || '');
            if (!u) continue;
            if (seenUrls.has(u)) continue;
            seenUrls.add(u);
            suggestions.push(s);
            if (suggestions.length >= maxResults) break;
          }

          sendResponse({
            type: MSG.OMNIBOX_SUGGESTIONS,
            query,
            suggestions,
            timestamp: Date.now()
          });
          break;
        }

        case MSG.BROWSER_HISTORY_GET: {
          // Return recent browser history entries (for the J history popover).
          const query = typeof message.query === 'string' ? message.query.trim() : '';
          const maxResults = Math.max(1, Math.min(100, Number(message.maxResults) || 40));
          const days = Math.max(1, Math.min(365, Number(message.days) || 14));
          const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

          /** @type {Array<{title: string, url: string, lastVisitTime: number}>} */
          const items = [];
          /** @type {Set<string>} */
          const seen = new Set();

          try {
            if (chrome.history && typeof chrome.history.search === 'function') {
              const historyItems = await chrome.history.search({
                text: query,
                maxResults: Math.max(maxResults, 10),
                startTime
              });
              for (const item of historyItems || []) {
                const url = typeof item?.url === 'string' ? item.url.trim() : '';
                if (!url) continue;
                if (seen.has(url)) continue;
                seen.add(url);
                items.push({
                  title: typeof item?.title === 'string' ? item.title : '',
                  url,
                  lastVisitTime: Number(item?.lastVisitTime) || 0
                });
                if (items.length >= maxResults) break;
              }
            }
          } catch (e) {
            console.warn('KP_BROWSER_HISTORY_GET: history search failed:', e?.message || e);
          }

          sendResponse({
            type: MSG.BROWSER_HISTORY_RESULT,
            query,
            items,
            timestamp: Date.now()
          });
          break;
        }

        case MSG.GET_TOP_SITES: {
          // Return top visited sites from history
          const maxResults = Math.max(1, Math.min(1000, Number(message.maxResults) || 1000));
          const days = Math.max(1, Math.min(90, Number(message.days) || 30));
          const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

          try {
            if (chrome.history && typeof chrome.history.search === 'function') {
              const historyItems = await chrome.history.search({
                text: '',
                maxResults: maxResults,
                startTime: startTime
              });

              // Count visits by domain
              const domainCounts = new Map();
              for (const item of historyItems) {
                if (item.url && item.visitCount) {
                  try {
                    const domain = new URL(item.url).hostname;
                    const lastVisitTime = Number(item.lastVisitTime) || 0;
                    const existing = domainCounts.get(domain) || {
                      count: 0,
                      title: item.title,
                      url: item.url,
                      lastVisitTime: 0
                    };
                    existing.count += item.visitCount;
                    if (lastVisitTime > (existing.lastVisitTime || 0)) {
                      existing.lastVisitTime = lastVisitTime;
                      existing.title = item.title || existing.title;
                      existing.url = item.url || existing.url;
                    }
                    domainCounts.set(domain, existing);
                  } catch (e) {
                    // Skip invalid URLs
                  }
                }
              }

              // Sort by visit count and return top 100
              const topSites = Array.from(domainCounts.values())
                .sort((a, b) => b.count - a.count)
                .slice(0, 100)
                .map(item => ({
                  title: item.title,
                  url: item.url,
                  lastVisitTime: item.lastVisitTime || 0,
                  visitCount: item.count || 0
                }));

              sendResponse({
                type: MSG.TOP_SITES_RESPONSE,
                topSites: topSites,
                success: true
              });
            } else {
              sendResponse({
                type: MSG.TOP_SITES_RESPONSE,
                topSites: [],
                success: false,
                error: 'History API not available'
              });
            }
          } catch (error) {
            console.error('KP_GET_TOP_SITES failed:', error);
            sendResponse({
              type: MSG.TOP_SITES_RESPONSE,
              topSites: [],
              success: false,
              error: error.message
            });
          }
          break;
        }

        case MSG.GET_HISTORY_FOR_DOMAINS: {
          // Search history for specific domains (parallel queries).
          // Prefer https://domain text queries so URL hits aren't crowded out by
          // off-site pages that merely mention the domain in their title.
          const rawDomains = Array.isArray(message.domains) ? message.domains : [];
          const domains = [...new Set(
            rawDomains
              .map((d) => String(d || '').trim().replace(/^www\./i, ''))
              .filter(Boolean)
          )];
          const extraQueries = Array.isArray(message.queries)
            ? message.queries.map((q) => String(q || '').trim()).filter(Boolean)
            : [];
          const days = Math.max(1, Math.min(90, Number(message.days) || 30));
          const startTime = Date.now() - days * 24 * 60 * 60 * 1000;
          const maxResults = Math.max(50, Math.min(1000, Number(message.maxResults) || 300));

          try {
            if (chrome.history && typeof chrome.history.search === 'function') {
              const seenUrls = new Set();
              const allResults = [];

              const queries = [...new Set([
                ...domains.map((d) => `https://${d}`),
                ...domains,
                ...extraQueries
              ])];

              const perQuery = await Promise.all(queries.map(async (text) => {
                try {
                  return await chrome.history.search({
                    text,
                    maxResults,
                    startTime
                  });
                } catch (error) {
                  console.warn(`KP_GET_HISTORY_FOR_DOMAINS: error searching for "${text}":`, error);
                  return [];
                }
              }));

              const domainMatches = (hostname, domain) => {
                const host = String(hostname || '').replace(/^www\./i, '');
                return host === domain || host.endsWith('.' + domain);
              };

              for (const historyItems of perQuery) {
                for (const item of historyItems || []) {
                  if (!item.url || seenUrls.has(item.url)) continue;
                  try {
                    const itemDomain = new URL(item.url).hostname.replace(/^www\./i, '');
                    if (!domains.some((domain) => domainMatches(itemDomain, domain))) continue;
                    allResults.push({
                      title: item.title || itemDomain,
                      url: item.url,
                      visitCount: item.visitCount || 0,
                      lastVisitTime: Number(item.lastVisitTime) || 0
                    });
                    seenUrls.add(item.url);
                  } catch {
                    // Skip invalid URLs
                  }
                }
              }

              // Prefer most recently visited, then visit count.
              const sortedResults = allResults.sort((a, b) => {
                const t = (Number(b.lastVisitTime) || 0) - (Number(a.lastVisitTime) || 0);
                if (t !== 0) return t;
                return (Number(b.visitCount) || 0) - (Number(a.visitCount) || 0);
              });

              sendResponse({
                type: MSG.HISTORY_FOR_DOMAINS_RESPONSE,
                history: sortedResults,
                success: true
              });
            } else {
              sendResponse({
                type: MSG.HISTORY_FOR_DOMAINS_RESPONSE,
                history: [],
                success: false,
                error: 'History API not available'
              });
            }
          } catch (error) {
            console.error('KP_GET_HISTORY_FOR_DOMAINS failed:', error);
            sendResponse({
              type: MSG.HISTORY_FOR_DOMAINS_RESPONSE,
              history: [],
              success: false,
              error: error.message
            });
          }
          break;
        }

        case MSG.GET_RECENT_HISTORY:
        case MSG.GET_RECENT_HISTORY: {
          const maxResults = Math.max(1, Math.min(2000, Number(message.maxResults) || 500));
          const days = Math.max(1, Math.min(90, Number(message.days) || 30));
          const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

          try {
            if (chrome.history && typeof chrome.history.search === 'function') {
              const historyItems = await chrome.history.search({
                text: '',
                maxResults,
                startTime
              });
              const items = (historyItems || [])
                .filter((item) => item?.url)
                .map((item) => ({
                  title: item.title || '',
                  url: item.url,
                  visitCount: Number(item.visitCount) || 0,
                  lastVisitTime: Number(item.lastVisitTime) || 0
                }))
                .sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0));

              sendResponse({
                type: MSG.RECENT_HISTORY_RESPONSE,
                items,
                success: true
              });
            } else {
              sendResponse({
                type: MSG.RECENT_HISTORY_RESPONSE,
                items: [],
                success: false,
                error: 'History API not available'
              });
            }
          } catch (error) {
            console.error('KP_GET_RECENT_HISTORY failed:', error);
            sendResponse({
              type: MSG.RECENT_HISTORY_RESPONSE,
              items: [],
              success: false,
              error: error.message
            });
          }
          break;
        }

        case MSG.GET_VIDEO_THUMB:
        case MSG.GET_VIDEO_THUMB: {
          const pageUrl = typeof message.pageUrl === 'string' ? message.pageUrl.trim() : '';
          try {
            if (!pageUrl) {
              sendResponse({
                type: MSG.VIDEO_THUMB_RESPONSE,
                success: false,
                thumbUrl: null,
                source: null,
                error: 'Missing pageUrl'
              });
              break;
            }

            const cached = videoThumbCache.get(pageUrl);
            if (cached && Date.now() - cached.ts < VIDEO_THUMB_CACHE_TTL_MS) {
              sendResponse({
                type: MSG.VIDEO_THUMB_RESPONSE,
                success: true,
                thumbUrl: cached.url,
                source: cached.source,
                cached: true
              });
              break;
            }

            const resolved = await resolveVideoThumbnailUrl(pageUrl, {
              fetchJson: async (oembedUrl) => {
                const res = await fetch(oembedUrl, { credentials: 'omit' });
                if (!res.ok) throw new Error(`oEmbed HTTP ${res.status}`);
                return res.json();
              }
            });

            if (resolved?.url) {
              videoThumbCache.set(pageUrl, {
                url: resolved.url,
                source: resolved.source,
                ts: Date.now()
              });
              sendResponse({
                type: MSG.VIDEO_THUMB_RESPONSE,
                success: true,
                thumbUrl: resolved.url,
                source: resolved.source,
                cached: false
              });
            } else {
              sendResponse({
                type: MSG.VIDEO_THUMB_RESPONSE,
                success: false,
                thumbUrl: null,
                source: null,
                error: 'No video thumbnail'
              });
            }
          } catch (error) {
            console.error('KP_GET_VIDEO_THUMB failed:', error);
            sendResponse({
              type: MSG.VIDEO_THUMB_RESPONSE,
              success: false,
              thumbUrl: null,
              source: null,
              error: error?.message || 'Video thumb failed'
            });
          }
          break;
        }

        case MSG.DICTIONARY_LOOKUP: {
          try {
            const word = normalizeWordForLookup(message.word);
            if (!word) {
              sendResponse({
                type: MSG.DICTIONARY_LOOKUP,
                ok: false,
                word: '',
                error: 'No word under cursor'
              });
              break;
            }
            const result = await fetchDictionaryDefinition(word);
            sendResponse({ type: MSG.DICTIONARY_LOOKUP, ...result });
          } catch (error) {
            console.error('KP_DICTIONARY_LOOKUP failed:', error);
            sendResponse({
              type: MSG.DICTIONARY_LOOKUP,
              ok: false,
              word: normalizeWordForLookup(message.word),
              error: error?.message || 'Dictionary lookup failed'
            });
          }
          break;
        }

        case MSG.MEDIA_LIBRARY_ADD: {
          try {
            const kind = message.kind === 'url'
              ? 'url'
              : message.kind === 'video'
                ? 'video'
                : message.kind === 'document'
                  ? 'document'
                  : message.kind === 'file'
                    ? 'file'
                    : 'image';
            const sourceUrl = typeof message.sourceUrl === 'string' ? message.sourceUrl : '';
            const pageUrl = typeof message.pageUrl === 'string' ? message.pageUrl : '';
            const dataUrl = typeof message.dataUrl === 'string' ? message.dataUrl : '';
            let mime = typeof message.mime === 'string' ? message.mime : '';
            const shouldFetch = message.fetchSource !== false
              && !dataUrl
              && isServiceWorkerFetchableVideoUrl(sourceUrl);

            const result = kind === 'url'
              ? await mediaLibraryService.addUrl({ sourceUrl, pageUrl })
              : kind === 'video'
                ? await (async () => {
                    /** @type {Blob|null} */
                    let blob = null;
                    if (shouldFetch) {
                      const fetched = await fetchVideoBytesInServiceWorker(sourceUrl);
                      if (fetched?.blob) {
                        blob = fetched.blob;
                        if (!mime) mime = fetched.mime || '';
                      }
                    }
                    return mediaLibraryService.addVideo({
                      blob: blob || undefined,
                      dataUrl,
                      mime,
                      sourceUrl,
                      pageUrl,
                      thumbDataUrl: typeof message.thumbDataUrl === 'string' ? message.thumbDataUrl : '',
                      width: Number(message.width) || 0,
                      height: Number(message.height) || 0
                    });
                  })()
              : kind === 'document'
                ? await (async () => {
                    /** @type {Blob|null} */
                    let blob = null;
                    if (shouldFetch) {
                      const fetched = await fetchFileBytesInServiceWorker(sourceUrl);
                      if (fetched?.blob) {
                        blob = fetched.blob;
                        if (!mime) mime = fetched.mime || '';
                      }
                    }
                    return mediaLibraryService.addDocument({
                      blob: blob || undefined,
                      dataUrl,
                      mime,
                      sourceUrl,
                      pageUrl
                    });
                  })()
              : kind === 'file'
                ? await (async () => {
                    /** @type {Blob|null} */
                    let blob = null;
                    let fileMime = mime;
                    if (shouldFetch) {
                      const fetched = await fetchFileBytesInServiceWorker(sourceUrl);
                      if (fetched?.blob) {
                        blob = fetched.blob;
                        if (!fileMime) fileMime = fetched.mime || '';
                      }
                    }
                    return mediaLibraryService.addFetchedFile({
                      blob: blob || undefined,
                      dataUrl,
                      mime: fileMime,
                      sourceUrl,
                      pageUrl
                    });
                  })()
              : await mediaLibraryService.addImage({
                  dataUrl,
                  mime,
                  sourceUrl,
                  pageUrl,
                  kind: 'image'
                });
            sendResponse({ type: MSG.MEDIA_LIBRARY_ADD, ...result });
            if (result?.success && !result?.duplicate) {
              void notifyMediaLibraryChanged({ reason: 'add' });
            }
          } catch (error) {
            console.error('KP_MEDIA_LIBRARY_ADD failed:', error);
            sendResponse({
              type: MSG.MEDIA_LIBRARY_ADD,
              success: false,
              duplicate: false,
              error: error?.message || 'Could not save to Media Library'
            });
          }
          break;
        }

        case MSG.MEDIA_LIBRARY_LIST: {
          try {
            const result = await mediaLibraryService.list({
              kind: typeof message.kind === 'string' ? message.kind : 'image',
              domain: typeof message.domain === 'string' ? message.domain : '',
              includeThumbs: message.includeThumbs !== false
            });
            sendResponse({ type: MSG.MEDIA_LIBRARY_LIST, ...result });
          } catch (error) {
            console.error('KP_MEDIA_LIBRARY_LIST failed:', error);
            sendResponse({
              type: MSG.MEDIA_LIBRARY_LIST,
              success: false,
              items: [],
              counts: { image: 0, video: 0, document: 0, url: 0 },
              domains: [],
              error: error?.message || 'Could not list Media Library'
            });
          }
          break;
        }

        case MSG.MEDIA_LIBRARY_GET: {
          try {
            const result = await mediaLibraryService.getOriginal(
              typeof message.id === 'string' ? message.id : ''
            );
            let dataUrl = null;
            if (result?.blob instanceof Blob && result.blob.size > 0) {
              dataUrl = await blobToDataUrl(result.blob);
            }
            sendResponse({
              type: MSG.MEDIA_LIBRARY_GET,
              success: Boolean(result?.success),
              item: result?.item || null,
              dataUrl,
              mime: result?.item?.mime || result?.blob?.type || '',
              error: result?.error || null
            });
          } catch (error) {
            console.error('KP_MEDIA_LIBRARY_GET failed:', error);
            sendResponse({
              type: MSG.MEDIA_LIBRARY_GET,
              success: false,
              error: error?.message || 'Could not load item'
            });
          }
          break;
        }

        case MSG.MEDIA_LIBRARY_DELETE: {
          try {
            const result = await mediaLibraryService.deleteIds(
              Array.isArray(message.ids) ? message.ids : []
            );
            sendResponse({ type: MSG.MEDIA_LIBRARY_DELETE, ...result });
            if (result?.success && Number(result.deleted) > 0) {
              void notifyMediaLibraryChanged({ reason: 'delete' });
            }
          } catch (error) {
            console.error('KP_MEDIA_LIBRARY_DELETE failed:', error);
            sendResponse({
              type: MSG.MEDIA_LIBRARY_DELETE,
              success: false,
              deleted: 0,
              error: error?.message || 'Could not delete'
            });
          }
          break;
        }

        case MSG.MEDIA_LIBRARY_ZIP: {
          try {
            const result = await mediaLibraryService.zip({
              ids: Array.isArray(message.ids) ? message.ids : null,
              kind: typeof message.kind === 'string' ? message.kind : 'image',
              domain: typeof message.domain === 'string' ? message.domain : ''
            });
            let dataUrl = null;
            if (result?.blob instanceof Blob && result.blob.size > 0) {
              dataUrl = await blobToDataUrl(result.blob);
            }
            sendResponse({
              type: MSG.MEDIA_LIBRARY_ZIP,
              success: Boolean(result?.success),
              dataUrl,
              filename: result?.filename || null,
              empty: Boolean(result?.empty),
              error: result?.error || null
            });
          } catch (error) {
            console.error('KP_MEDIA_LIBRARY_ZIP failed:', error);
            sendResponse({
              type: MSG.MEDIA_LIBRARY_ZIP,
              success: false,
              error: error?.message || 'Could not build zip'
            });
          }
          break;
        }

        case MSG.NAVGRAPH_GET: {
          const tabId = sender?.tab?.id;
          if (typeof tabId !== 'number') {
            sendResponse({ type: MSG.ERROR, error: 'No sender tab id' });
            break;
          }

          let tabUrl = sender?.tab?.url || '';
          let tabTitle = sender?.tab?.title || '';
          try {
            // Some senders do not include full tab metadata; fetch best-effort.
            if ((!tabUrl || !tabTitle) && chrome?.tabs?.get) {
              const tab = await chrome.tabs.get(tabId);
              tabUrl = tab?.url || tabUrl;
              tabTitle = tab?.title || tabTitle;
            }
          } catch {
            // ignore
          }

          const { graph } = await tabNavGraphManager.getGraph(tabId, { currentUrl: tabUrl, currentTitle: tabTitle });
          sendResponse({
            type: MSG.NAVGRAPH_GRAPH,
            tabId,
            graph,
            timestamp: Date.now()
          });
          break;
        }

        case MSG.NAVGRAPH_JUMP: {
          const tabId = sender?.tab?.id;
          const url = typeof message.url === 'string' ? message.url.trim() : '';
          if (typeof tabId !== 'number') {
            sendResponse({ type: MSG.ERROR, error: 'No sender tab id' });
            break;
          }
          if (!url) {
            sendResponse({ type: MSG.ERROR, error: 'Invalid url' });
            break;
          }

          try {
            await chrome.tabs.update(tabId, { url });
            sendResponse({ type: MSG.SUCCESS, tabId });
          } catch (e) {
            sendResponse({ type: MSG.ERROR, error: `Failed to navigate: ${e?.message || e}` });
          }
          break;
        }

        case MSG.NAVGRAPH_CLEAR: {
          const tabId = sender?.tab?.id;
          if (typeof tabId !== 'number') {
            sendResponse({ type: MSG.ERROR, error: 'No sender tab id' });
            break;
          }
          try {
            await tabNavGraphManager.clear(tabId);
            sendResponse({ type: MSG.SUCCESS, tabId });
          } catch (e) {
            sendResponse({ type: MSG.ERROR, error: `Failed to clear: ${e?.message || e}` });
          }
          break;
        }

        case MSG.OPEN_SETTINGS_POPOVER:
        case MSG.OPEN_GUIDE_POPOVER:
        case MSG.OPEN_DOCS_POPOVER:
        case MSG.OPEN_ONBOARDING:
        case MSG.LAUNCH_WALKTHROUGH: {
          // Extension pages (guide/settings iframes) call chrome.runtime.sendMessage.
          // Content scripts own these handlers, so the service worker must forward
          // to the originating tab (or the active tab as fallback).
          if (!TAB_UI_FORWARD_TYPES.includes(message.type)) {
            sendResponse({ type: MSG.ERROR, error: 'Unknown UI open type' });
            break;
          }
          let tabId = sender?.tab?.id;
          if (!tabId) {
            try {
              const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
              tabId = active?.id;
            } catch {
              tabId = null;
            }
          }
          if (!tabId) {
            sendResponse({ type: MSG.ERROR, error: 'No tab available to open UI' });
            break;
          }
          try {
            const forward = { type: message.type };
            if (message.panelId != null) forward.panelId = message.panelId;
            if (message.topicId != null) forward.topicId = message.topicId;
            if (message.hash != null) forward.hash = message.hash;
            await chrome.tabs.sendMessage(tabId, forward);
            sendResponse({ type: MSG.SUCCESS });
          } catch (error) {
            console.warn('[KeyPilot] Failed to forward UI open message:', error?.message || error);
            sendResponse({
              type: MSG.ERROR,
              error: error?.message || 'Failed to open UI in tab'
            });
          }
          break;
        }

        case MSG.OPEN_POPOVER_WINDOW: {
          const openerTabId = sender?.tab?.id;
          if (typeof openerTabId !== 'number') {
            sendResponse({ type: MSG.ERROR, error: 'No sender tab id' });
            break;
          }
          if (!message.url || typeof message.url !== 'string') {
            sendResponse({ type: MSG.ERROR, error: 'Invalid url' });
            break;
          }
          try {
            const result = await openPopoverWindowForOpener(openerTabId, {
              url: message.url,
              kind: message.kind,
              closeKeys: message.closeKeys,
              width: message.width,
              height: message.height,
              left: message.left,
              top: message.top
            });
            sendResponse({
              type: MSG.SUCCESS,
              windowId: result.windowId,
              tabId: result.tabId
            });
          } catch (e) {
            console.warn('[KeyPilot] OPEN_POPOVER_WINDOW failed:', e?.message || e);
            sendResponse({
              type: MSG.ERROR,
              error: e?.message || 'Failed to open popover window'
            });
          }
          break;
        }

        case MSG.CLOSE_POPOVER_WINDOW: {
          const senderTabId = sender?.tab?.id;
          try {
            const closed = await closePopoverWindow(
              {
                windowId: typeof message.windowId === 'number' ? message.windowId : undefined,
                openerTabId: typeof message.openerTabId === 'number'
                  ? message.openerTabId
                  : (typeof senderTabId === 'number' && !popoverWindowByPopupTabId.has(senderTabId)
                    ? senderTabId
                    : undefined),
                popupTabId: typeof message.popupTabId === 'number'
                  ? message.popupTabId
                  : (typeof senderTabId === 'number' && popoverWindowByPopupTabId.has(senderTabId)
                    ? senderTabId
                    : undefined)
              },
              {
                // When the popup itself asks to close, still notify opener.
                notifyOpener: message.notifyOpener !== false,
                reason: message.reason || 'closed'
              }
            );
            sendResponse({ type: MSG.SUCCESS, closed: !!closed });
          } catch (e) {
            console.warn('[KeyPilot] CLOSE_POPOVER_WINDOW failed:', e?.message || e);
            sendResponse({
              type: MSG.ERROR,
              error: e?.message || 'Failed to close popover window'
            });
          }
          break;
        }

        case MSG.AM_I_POPOVER_WINDOW: {
          const tabId = sender?.tab?.id;
          if (typeof tabId !== 'number') {
            sendResponse({ type: MSG.SUCCESS, isPopoverWindow: false });
            break;
          }
          const windowId = popoverWindowByPopupTabId.get(tabId);
          const entry = typeof windowId === 'number'
            ? popoverWindowsByWindowId.get(windowId)
            : null;
          if (!entry) {
            sendResponse({ type: MSG.SUCCESS, isPopoverWindow: false });
            break;
          }
          sendResponse({
            type: MSG.SUCCESS,
            isPopoverWindow: true,
            windowId,
            kind: entry.kind,
            closeKeys: entry.closeKeys,
            originalUrl: entry.url,
            openerTabId: entry.openerTabId
          });
          break;
        }

        case MSG.FRAME_ACTIVATE: {
          // Top-frame KeyPilot: fan-out activate to subframe content scripts.
          // Fire-and-forget per frame — never await sendMessage (missing agents hang).
          const tabId = sender?.tab?.id;
          if (typeof tabId !== 'number') {
            sendResponse({ type: MSG.ERROR, error: 'No sender tab id' });
            break;
          }
          const payload = {
            type: MSG.FRAME_ACTIVATE,
            clientX: message.clientX,
            clientY: message.clientY,
            openInNewTab: !!message.openInNewTab,
            background: !!message.background,
            frameName: typeof message.frameName === 'string' ? message.frameName : '',
            topOrigin: typeof message.topOrigin === 'string' ? message.topOrigin : ''
          };
          try {
            let frames = [];
            try {
              frames = await chrome.webNavigation.getAllFrames({ tabId }) || [];
            } catch (e) {
              console.warn('[KeyPilot] getAllFrames failed:', e?.message || e);
              frames = [];
            }
            for (const frame of frames) {
              if (!frame || frame.frameId === 0) continue;
              try {
                chrome.tabs.sendMessage(tabId, payload, { frameId: frame.frameId }).catch(() => {});
              } catch {
                // ignore
              }
            }
            sendResponse({ type: MSG.SUCCESS });
          } catch (e) {
            sendResponse({
              type: MSG.ERROR,
              error: e?.message || 'Failed to relay frame activate'
            });
          }
          break;
        }

        case MSG.FRAME_SCROLL: {
          // Top-frame KeyPilot: fan-out C/V scroll to subframe content scripts.
          const tabId = sender?.tab?.id;
          if (typeof tabId !== 'number') {
            sendResponse({ type: MSG.ERROR, error: 'No sender tab id' });
            break;
          }
          const scrollPayload = {
            type: MSG.FRAME_SCROLL,
            clientX: message.clientX,
            clientY: message.clientY,
            sign: Number(message.sign) < 0 ? -1 : 1,
            deltaPx: Number(message.deltaPx),
            behavior: message.behavior === 'auto' || message.behavior === 'instant' ? 'auto' : 'smooth',
            frameName: typeof message.frameName === 'string' ? message.frameName : ''
          };
          try {
            let frames = [];
            try {
              frames = await chrome.webNavigation.getAllFrames({ tabId }) || [];
            } catch (e) {
              console.warn('[KeyPilot] getAllFrames failed (scroll):', e?.message || e);
              frames = [];
            }
            for (const frame of frames) {
              if (!frame || frame.frameId === 0) continue;
              try {
                chrome.tabs.sendMessage(tabId, scrollPayload, { frameId: frame.frameId }).catch(() => {});
              } catch {
                // ignore
              }
            }
            sendResponse({ type: MSG.SUCCESS });
          } catch (e) {
            sendResponse({
              type: MSG.ERROR,
              error: e?.message || 'Failed to relay frame scroll'
            });
          }
          break;
        }

        case MSG.INJECT_FULL_KEYPILOT_IN_FRAME: {
          // Thin frame-agent requests full KeyPilot (popover iframe after BRIDGE_INIT).
          const tabId = sender?.tab?.id;
          const frameId = sender?.frameId;
          if (typeof tabId !== 'number' || typeof frameId !== 'number') {
            sendResponse({ type: MSG.ERROR, error: 'Missing tab/frame id for inject' });
            break;
          }
          // Top frame already has content-bundled via manifest.
          if (frameId === 0) {
            sendResponse({ type: MSG.SUCCESS, skipped: true, reason: 'top_frame' });
            break;
          }
          try {
            if (!chrome.scripting?.executeScript) {
              sendResponse({ type: MSG.ERROR, error: 'chrome.scripting unavailable' });
              break;
            }
            await chrome.scripting.executeScript({
              target: { tabId, frameIds: [frameId] },
              files: ['content-bundled.js']
            });
            sendResponse({ type: MSG.SUCCESS });
          } catch (e) {
            console.warn('[KeyPilot] Inject full KeyPilot into frame failed:', e?.message || e);
            sendResponse({
              type: MSG.ERROR,
              error: e?.message || 'Failed to inject full KeyPilot into frame'
            });
          }
          break;
        }

        case MSG.ENSURE_MAP_PAN_BRIDGE: {
          // Install page-world map.panBy listener (bypasses page CSP via world: MAIN).
          const tabId = sender?.tab?.id;
          const frameId = typeof sender?.frameId === 'number' ? sender.frameId : 0;
          if (typeof tabId !== 'number') {
            sendResponse({ type: MSG.ERROR, ok: false, error: 'Missing tab id for map pan bridge' });
            break;
          }
          try {
            if (!chrome.scripting?.executeScript) {
              sendResponse({ type: MSG.ERROR, ok: false, error: 'chrome.scripting unavailable' });
              break;
            }
            await chrome.scripting.executeScript({
              target: { tabId, frameIds: [frameId] },
              world: 'MAIN',
              files: ['map-pan-bridge.js']
            });
            sendResponse({ type: MSG.SUCCESS, ok: true });
          } catch (e) {
            console.warn('[KeyPilot] Map pan bridge inject failed:', e?.message || e);
            sendResponse({
              type: MSG.ERROR,
              ok: false,
              error: e?.message || 'Failed to inject map pan bridge'
            });
          }
          break;
        }

        case MSG.GET_STATE:
          // Content script or popup requesting current state
          const currentState = await extensionToggleManager.getState();
          sendResponse({
            type: MSG.STATE_RESPONSE,
            enabled: currentState,
            timestamp: Date.now()
          });
          console.log('Sent current state:', currentState);
          break;
          
        case MSG.SET_STATE:
          // Popup requesting state change
          if (typeof message.enabled === 'boolean') {
            const newState = await extensionToggleManager.setState(message.enabled);
            sendResponse({
              type: MSG.STATE_CHANGED,
              enabled: newState,
              timestamp: Date.now()
            });
            console.log('State changed via message to:', newState);
          } else {
            console.error('Invalid enabled value in KP_SET_STATE:', message.enabled);
            sendResponse({
              type: MSG.ERROR,
              error: 'Invalid enabled value'
            });
          }
          break;
          
        case MSG.TOGGLE_STATE:
          // Request to toggle current state
          const toggledState = await extensionToggleManager.toggleState();
          sendResponse({
            type: MSG.STATE_CHANGED,
            enabled: toggledState,
            timestamp: Date.now()
          });
          console.log('State toggled via message to:', toggledState);
          break;
          
        // Legacy KP_GET_CURSOR_SETTINGS / KP_SET_CURSOR_* removed.
        // Cursor appearance is stored in kp_settings_v1 (settings-manager).

        case MSG.CLOSE_TAB:
          // Request to close current tab
          if (sender.tab && sender.tab.id) {
            try {
              await chrome.tabs.remove(sender.tab.id);
              console.log('Closed tab:', sender.tab.id);
              // No need to send response as tab will be closed
            } catch (error) {
              console.error('Failed to close tab:', error);
              sendResponse({
                type: MSG.ERROR,
                error: 'Failed to close tab: ' + error.message
              });
            }
          } else {
            console.error('No valid tab ID in close tab request');
            sendResponse({
              type: MSG.ERROR,
              error: 'No valid tab ID'
            });
          }
          break;

        case MSG.GO_BACK:
        case MSG.GO_FORWARD: {
          // Browser history navigation for the sender tab.
          // Optionally record a transient action first so onboarding can recover after unload.
          const tabId = sender?.tab?.id;
          const recordAction = typeof message.recordAction === 'string' ? message.recordAction : '';
          const timestamp = typeof message.timestamp === 'number' ? message.timestamp : Date.now();

          if (recordAction) {
            const payload = {
              action: recordAction,
              timestamp,
              tabId: tabId ?? null,
              url: sender?.tab?.url ?? null
            };
            try {
              await chrome.storage.local.set({ [TRANSIENT_ACTION_STORAGE_KEY]: payload });
              try {
                if (chrome.storage?.session?.set) {
                  await chrome.storage.session.set({ [TRANSIENT_ACTION_STORAGE_KEY]: payload });
                }
              } catch {
                // ignore session write failures
              }
            } catch (e) {
              console.warn('[KeyPilot] Failed to record transient action before history nav:', e?.message || e);
            }
          }

          if (!tabId) {
            sendResponse({ type: MSG.ERROR, error: 'No valid tab ID' });
            break;
          }

          try {
            if (message.type === MSG.GO_BACK) {
              await chrome.tabs.goBack(tabId);
            } else {
              await chrome.tabs.goForward(tabId);
            }
            sendResponse({ type: MSG.SUCCESS });
          } catch (error) {
            // No history entry / already at edge — treat as soft success.
            console.warn('[KeyPilot] History navigation failed:', error?.message || error);
            sendResponse({
              type: MSG.ERROR,
              error: error?.message || 'History navigation failed'
            });
          }
          break;
        }

        case MSG.TAB_LEFT:
          // Switch to the tab to the left
          if (sender.tab && sender.tab.id) {
            try {
              const allTabs = await chrome.tabs.query({ currentWindow: true });
              const tabs = allTabs.filter(tab => !isSkippableTab(tab));
              
              const currentIndex = tabs.findIndex(tab => tab.id === sender.tab.id);
              let targetIndex;
              
              if (currentIndex > 0) {
                targetIndex = currentIndex - 1;
              } else if (tabs.length > 1) {
                targetIndex = tabs.length - 1; // Wrap around to last tab
              } else {
                // Soft failure: only one usable tab — content script shows flash UI, no console noise.
                sendResponse({
                  type: MSG.ERROR,
                  error: 'No valid tabs to switch to'
                });
                break;
              }
              
              await chrome.tabs.update(tabs[targetIndex].id, { active: true });
              console.log('Switched to left tab:', tabs[targetIndex].id);
              sendResponse({ type: MSG.SUCCESS });
            } catch (error) {
              console.error('Failed to switch to left tab:', error);
              sendResponse({
                type: MSG.ERROR,
                error: 'Failed to switch tab: ' + error.message
              });
            }
          }
          break;

        case MSG.TAB_RIGHT:
          // Switch to the tab to the right
          if (sender.tab && sender.tab.id) {
            try {
              const allTabs = await chrome.tabs.query({ currentWindow: true });
              const tabs = allTabs.filter(tab => !isSkippableTab(tab));
              
              const currentIndex = tabs.findIndex(tab => tab.id === sender.tab.id);
              let targetIndex;
              
              if (currentIndex < tabs.length - 1) {
                targetIndex = currentIndex + 1;
              } else if (tabs.length > 1) {
                targetIndex = 0; // Wrap around to first tab
              } else {
                // Soft failure: only one usable tab — content script shows flash UI, no console noise.
                sendResponse({
                  type: MSG.ERROR,
                  error: 'No valid tabs to switch to'
                });
                break;
              }
              
              await chrome.tabs.update(tabs[targetIndex].id, { active: true });
              console.log('Switched to right tab:', tabs[targetIndex].id);
              sendResponse({ type: MSG.SUCCESS });
            } catch (error) {
              console.error('Failed to switch to right tab:', error);
              sendResponse({
                type: MSG.ERROR,
                error: 'Failed to switch tab: ' + error.message
              });
            }
          }
          break;

        case MSG.NEW_TAB:
          // Open a new tab (Chrome default NTP, or KeyPilot page when flagged on).
          try {
            /** @type {chrome.tabs.CreateProperties} */
            const createProps = {
              active: true
            };
            if (FEATURE_FLAGS.USE_CUSTOM_NEWTAB_PAGE) {
              createProps.url = chrome.runtime.getURL('pages/newtab.html');
            }

            // Keep tab ordering consistent with other "open in new tab" actions:
            // open right after the current tab, in the same window, preserving opener relationship.
            if (sender.tab && typeof sender.tab.index === 'number') {
              createProps.index = sender.tab.index + 1;
            }
            if (sender.tab && typeof sender.tab.windowId === 'number') {
              createProps.windowId = sender.tab.windowId;
            }
            if (sender.tab && typeof sender.tab.id === 'number') {
              createProps.openerTabId = sender.tab.id;
            }

            const newTab = await chrome.tabs.create(createProps);
            console.log('Opened new tab:', newTab.id);
            sendResponse({ type: MSG.SUCCESS, tabId: newTab.id });
          } catch (error) {
            console.error('Failed to open new tab:', error);
            sendResponse({
              type: MSG.ERROR,
              error: 'Failed to open new tab: ' + error.message
            });
          }
          break;

        case MSG.OPEN_URL_BACKGROUND:
          // Open a URL in a new tab without focusing it (middle-click style).
          if (!message.url || typeof message.url !== 'string') {
            sendResponse({
              type: MSG.ERROR,
              error: 'Invalid url'
            });
            break;
          }

          try {
            /** @type {chrome.tabs.CreateProperties} */
            const createProps = {
              url: message.url,
              active: false
            };

            // Keep tab ordering similar to a real middle click: open right after the current tab.
            if (sender.tab && typeof sender.tab.index === 'number') {
              createProps.index = sender.tab.index + 1;
            }
            // Ensure the tab opens in the same window as the sender.
            if (sender.tab && typeof sender.tab.windowId === 'number') {
              createProps.windowId = sender.tab.windowId;
            }
            // Preserve opener relationship when available (helps browser group navigation history).
            if (sender.tab && typeof sender.tab.id === 'number') {
              createProps.openerTabId = sender.tab.id;
            }

            const tab = await chrome.tabs.create(createProps);
            console.log('Opened background tab:', tab.id, 'url:', message.url);
            sendResponse({ type: MSG.SUCCESS, tabId: tab.id });
          } catch (error) {
            console.error('Failed to open background tab:', error);
            sendResponse({
              type: MSG.ERROR,
              error: 'Failed to open background tab: ' + error.message
            });
          }
          break;

        case MSG.OPEN_URL_FOREGROUND:
          // Open a URL in a new tab AND focus it.
          if (!message.url || typeof message.url !== 'string') {
            sendResponse({
              type: MSG.ERROR,
              error: 'Invalid url'
            });
            break;
          }

          try {
            /** @type {chrome.tabs.CreateProperties} */
            const createProps = {
              url: message.url,
              active: true
            };

            // Keep tab ordering similar to a real middle click: open right after the current tab.
            if (sender.tab && typeof sender.tab.index === 'number') {
              createProps.index = sender.tab.index + 1;
            }
            // Ensure the tab opens in the same window as the sender.
            if (sender.tab && typeof sender.tab.windowId === 'number') {
              createProps.windowId = sender.tab.windowId;
            }
            // Preserve opener relationship when available (helps browser group navigation history).
            if (sender.tab && typeof sender.tab.id === 'number') {
              createProps.openerTabId = sender.tab.id;
            }

            const tab = await chrome.tabs.create(createProps);
            console.log('Opened foreground tab:', tab.id, 'url:', message.url);
            sendResponse({ type: MSG.SUCCESS, tabId: tab.id });
          } catch (error) {
            console.error('Failed to open foreground tab:', error);
            sendResponse({
              type: MSG.ERROR,
              error: 'Failed to open foreground tab: ' + error.message
            });
          }
          break;

        case MSG.NAVIGATE_SAME_TAB: {
          // Same-tab navigate — used by frame-click-agent when a sandboxed iframe
          // cannot top-navigate without a real user gesture (e.g. Observable gallery).
          const tabId = sender?.tab?.id;
          const url = typeof message.url === 'string' ? message.url.trim() : '';
          if (typeof tabId !== 'number') {
            sendResponse({ type: MSG.ERROR, error: 'No sender tab id' });
            break;
          }
          if (!url) {
            sendResponse({ type: MSG.ERROR, error: 'Invalid url' });
            break;
          }
          try {
            await chrome.tabs.update(tabId, { url });
            sendResponse({ type: MSG.SUCCESS, tabId });
          } catch (error) {
            console.error('Failed to navigate same tab:', error);
            sendResponse({
              type: MSG.ERROR,
              error: 'Failed to navigate: ' + (error?.message || error)
            });
          }
          break;
        }

        case MSG.STATUS:
          // Status updates are broadcast to update the popup UI.
          // Background script doesn't need to handle them, just acknowledge.
          sendResponse({ type: MSG.ACK });
          break;
          
        default:
          console.warn('Unknown message type:', message.type);
          sendResponse({
            type: MSG.ERROR,
            error: 'Unknown message type'
          });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({
        type: MSG.ERROR,
        error: error.message
      });
    }
  })();
  
  // Return true to indicate we'll send a response asynchronously
  return true;
});

/**
 * Service Worker Lifecycle Events
 */

// Initialize when service worker starts
chrome.runtime.onStartup.addListener(async () => {
  console.log('Chrome startup detected, initializing ExtensionToggleManager...');
  await extensionToggleManager.initialize();

  // Initialize content script state
  const currentState = await extensionToggleManager.getState();
  await contentScriptManager.updateContentScriptState(currentState);
});

// Initialize when extension is installed or updated
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);
  await extensionToggleManager.initialize();

  // Initialize content script state
  const currentState = await extensionToggleManager.getState();
  await contentScriptManager.updateContentScriptState(currentState);

  // Set default state on fresh install
  if (details.reason === 'install') {
    await extensionToggleManager.setState(extensionToggleManager.DEFAULT_STATE);
    console.log('Set default state on fresh install:', extensionToggleManager.DEFAULT_STATE);

    // Also default the floating keyboard panel to enabled (first-run only).
    try {
      await ensureDefaultKeyboardHelpVisible();
    } catch {
      // Ignore.
    }

    // Default onboarding to active on first run.
    try {
      await ensureDefaultOnboardingState();
    } catch {
      // Ignore.
    }
  }
});

console.log('KeyPilot service worker fully initialized with message handlers');