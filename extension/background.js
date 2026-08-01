/**
 * KeyPilot Extension Toggle Service Worker
 * Manages global extension state and coordinates toggle functionality across all tabs
 */

import { isSkippableTab, isSkippableUrl } from './src/config/url-policy.js';
import { MSG, TAB_UI_FORWARD_TYPES } from './src/messaging/types.js';
import {
  storageGetValue,
  storageSetValue,
  storageSetObject
} from './src/utils/storage.js';

const KEYBOARD_HELP_STORAGE_KEY = 'keypilot_keyboard_help_visible';
const ONBOARDING_ACTIVE_STORAGE_KEY = 'keypilot_onboarding_active';
const ONBOARDING_PROGRESS_STORAGE_KEY = 'keypilot_onboarding_progress';
const TRANSIENT_ACTION_STORAGE_KEY = 'keypilot_transient_action';

// Session DNR rule: spoof mobile UA for sub_frame loads while Link Preview is in Mobile mode.
// Static rules.json uses id 1; keep session ids well clear of that range.
const PREVIEW_MOBILE_UA_RULE_ID = 9101;
/** @type {Set<number>} tabs that currently want mobile preview UA */
const previewMobileUaTabIds = new Set();

// Pixel 7 / Chrome Android — close enough for sites that branch on UA + client hints.
const PREVIEW_MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const PREVIEW_MOBILE_SEC_CH_UA =
  '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"';

/**
 * Sync session DNR rules so sub_frame requests on opted-in tabs use a mobile UA.
 * Scoped to sub_frame only (not main_frame) so the host page itself is unaffected.
 */
async function syncPreviewMobileUaRules() {
  const removeRuleIds = [PREVIEW_MOBILE_UA_RULE_ID];
  /** @type {chrome.declarativeNetRequest.Rule[]} */
  const addRules = [];

  if (previewMobileUaTabIds.size > 0) {
    addRules.push({
      id: PREVIEW_MOBILE_UA_RULE_ID,
      priority: 100,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'User-Agent', operation: 'set', value: PREVIEW_MOBILE_USER_AGENT },
          { header: 'Sec-CH-UA', operation: 'set', value: PREVIEW_MOBILE_SEC_CH_UA },
          { header: 'Sec-CH-UA-Mobile', operation: 'set', value: '?1' },
          { header: 'Sec-CH-UA-Platform', operation: 'set', value: '"Android"' },
          { header: 'Sec-CH-UA-Platform-Version', operation: 'set', value: '"14.0.0"' },
          { header: 'Sec-CH-UA-Model', operation: 'set', value: '"Pixel 7"' },
          { header: 'Sec-CH-UA-Full-Version-List', operation: 'set', value: PREVIEW_MOBILE_SEC_CH_UA }
        ]
      },
      condition: {
        tabIds: Array.from(previewMobileUaTabIds),
        // Document navigations inside the preview iframe (and other iframes on the tab).
        resourceTypes: ['sub_frame']
      }
    });
  }

  try {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds, addRules });
  } catch (e) {
    console.warn('[KeyPilot] Failed to sync preview mobile UA rules:', e?.message || e);
    throw e;
  }
}

/**
 * @param {number} tabId
 * @param {boolean} enabled
 */
async function setPreviewMobileUaForTab(tabId, enabled) {
  if (typeof tabId !== 'number') {
    throw new Error('Invalid tab id for preview mobile UA');
  }
  if (enabled) {
    previewMobileUaTabIds.add(tabId);
  } else {
    previewMobileUaTabIds.delete(tabId);
  }
  await syncPreviewMobileUaRules();
}

try {
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (!previewMobileUaTabIds.has(tabId)) return;
    previewMobileUaTabIds.delete(tabId);
    void syncPreviewMobileUaRules().catch(() => { /* ignore */ });
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
   * Notify all tabs about state change
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

      // Send message to all tabs
      const notifications = tabs.map(async (tab) => {
        try {
          await chrome.tabs.sendMessage(tab.id, message);
        } catch (error) {
          // Ignore errors for tabs that don't have content scripts
          // (chrome:// pages, extension pages, etc.)
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

    // Notify all tabs about the state change
    // The content scripts will handle enabling/disabling based on this state
    try {
      const tabs = await chrome.tabs.query({});
      const message = {
        type: 'KP_UPDATE_STATE',
        enabled: enabled,
        timestamp: Date.now()
      };

      // Send message to all tabs
      const notifications = tabs.map(async (tab) => {
        try {
          await chrome.tabs.sendMessage(tab.id, message);
        } catch (error) {
          // Ignore errors for tabs that don't have content scripts
          // (chrome:// pages, extension pages, etc.)
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
      await extensionToggleManager.initialize();
      
      switch (message.type) {
        case 'KP_TRANSIENT_ACTION': {
          // Persist transient actions (like "back") in extension storage so they survive
          // content-script unload / navigation timing.
          //
          // IMPORTANT: Content scripts can always read `chrome.storage.local`, but may not have access
          // to `chrome.storage.session` across Chrome versions. Use local for reliability.
          const action = typeof message.action === 'string' ? message.action : '';
          const timestamp = typeof message.timestamp === 'number' ? message.timestamp : Date.now();
          if (!action) {
            sendResponse({ type: 'KP_ERROR', message: 'Missing action' });
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
            sendResponse({ type: 'KP_SUCCESS' });
          } catch (e) {
            console.warn('Failed to persist transient action:', e?.message || e);
            sendResponse({ type: 'KP_ERROR', message: 'Failed to persist transient action' });
          }
          break;
        }

        case 'KP_GET_BOOKMARKS': {
          // Return bookmark tree for launcher popover
          try {
            if (chrome.bookmarks && typeof chrome.bookmarks.getTree === 'function') {
              const bookmarkTree = await chrome.bookmarks.getTree();

              // Flatten bookmark tree into array of bookmark objects
              const bookmarks = [];
              const extractBookmarks = (nodes) => {
                for (const node of nodes) {
                  if (node.url) {
                    bookmarks.push({
                      title: node.title || 'Untitled',
                      url: node.url,
                      dateAdded: node.dateAdded,
                      id: node.id,
                      parentId: node.parentId
                    });
                  }
                  if (node.children) {
                    extractBookmarks(node.children);
                  }
                }
              };
              extractBookmarks(bookmarkTree);

              sendResponse({
                type: 'KP_BOOKMARKS_RESPONSE',
                bookmarks: bookmarks,
                success: true
              });
            } else {
              sendResponse({
                type: 'KP_BOOKMARKS_RESPONSE',
                bookmarks: [],
                success: false,
                error: 'Bookmarks API not available'
              });
            }
          } catch (error) {
            console.error('KP_GET_BOOKMARKS failed:', error);
            sendResponse({
              type: 'KP_BOOKMARKS_RESPONSE',
              bookmarks: [],
              success: false,
              error: error.message
            });
          }
          break;
        }

        case 'KP_OMNIBOX_SUGGEST': {
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

            // Within-tier heuristics.
            score += Math.min(800, Math.max(0, Number(historyVisitCount) || 0) * 8);
            score += Math.min(400, Math.max(0, Number(historyTypedCount) || 0) * 20);
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

          const addCandidate = ({ title, url, source, isToolbar = false, historyVisitCount = 0, historyTypedCount = 0, historyLastVisitTime = 0 }) => {
            const normalizedUrl = normalizeUrl(url);
            if (!normalizedUrl) return;

            const entry = {
              title: typeof title === 'string' ? title : '',
              url: normalizedUrl,
              source,
              isToolbar: Boolean(isToolbar),
              host: safeUrlHost(normalizedUrl),
              score: computeBaseScore({
                source,
                isToolbar,
                url: normalizedUrl,
                title,
                historyVisitCount,
                historyTypedCount,
                historyLastVisitTime
              })
            };

            const prev = bestByUrl.get(normalizedUrl);
            if (!prev || entry.score > prev.score) {
              bestByUrl.set(normalizedUrl, entry);
            }
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

          // 2) History
          try {
            if (chrome.history && typeof chrome.history.search === 'function') {
              const historyItems = await chrome.history.search({
                text: query,
                maxResults: Math.max(maxResults, 12),
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

          // Sort by score descending.
          candidates.sort((a, b) => (Number(b?.score) || 0) - (Number(a?.score) || 0));

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
            type: 'KP_OMNIBOX_SUGGESTIONS',
            query,
            suggestions,
            timestamp: Date.now()
          });
          break;
        }

        case 'KP_BROWSER_HISTORY_GET': {
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
            type: 'KP_BROWSER_HISTORY_RESULT',
            query,
            items,
            timestamp: Date.now()
          });
          break;
        }

        case 'KP_GET_TOP_SITES': {
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
                    const existing = domainCounts.get(domain) || { count: 0, title: item.title, url: item.url };
                    existing.count += item.visitCount;
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
                .map(item => ({ title: item.title, url: item.url }));

              sendResponse({
                type: 'KP_TOP_SITES_RESPONSE',
                topSites: topSites,
                success: true
              });
            } else {
              sendResponse({
                type: 'KP_TOP_SITES_RESPONSE',
                topSites: [],
                success: false,
                error: 'History API not available'
              });
            }
          } catch (error) {
            console.error('KP_GET_TOP_SITES failed:', error);
            sendResponse({
              type: 'KP_TOP_SITES_RESPONSE',
              topSites: [],
              success: false,
              error: error.message
            });
          }
          break;
        }

        case 'KP_GET_HISTORY_FOR_DOMAINS': {
          // Search history for specific domains (parallel per-domain searches).
          const domains = Array.isArray(message.domains) ? message.domains : [];
          const days = Math.max(1, Math.min(90, Number(message.days) || 30));
          const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

          try {
            if (chrome.history && typeof chrome.history.search === 'function') {
              const seenUrls = new Set();
              const allResults = [];

              // Parallel domain searches — sequential awaits were a major launcher lag source.
              const perDomain = await Promise.all(domains.map(async (domain) => {
                try {
                  return await chrome.history.search({
                    text: domain,
                    maxResults: 50,
                    startTime: startTime
                  });
                } catch (error) {
                  console.warn(`KP_GET_HISTORY_FOR_DOMAINS: error searching for domain ${domain}:`, error);
                  return [];
                }
              }));

              for (let i = 0; i < domains.length; i++) {
                const domain = domains[i];
                const historyItems = perDomain[i] || [];
                for (const item of historyItems) {
                  if (!item.url || seenUrls.has(item.url)) continue;
                  try {
                    const itemDomain = new URL(item.url).hostname.replace('www.', '');
                    if (itemDomain === domain || itemDomain.endsWith('.' + domain)) {
                      allResults.push({
                        title: item.title || itemDomain,
                        url: item.url,
                        visitCount: item.visitCount || 0
                      });
                      seenUrls.add(item.url);
                    }
                  } catch {
                    // Skip invalid URLs
                  }
                }
              }

              // Sort by visit count (most visited first)
              const sortedResults = allResults.sort((a, b) => b.visitCount - a.visitCount);

              sendResponse({
                type: 'KP_HISTORY_FOR_DOMAINS_RESPONSE',
                history: sortedResults,
                success: true
              });
            } else {
              sendResponse({
                type: 'KP_HISTORY_FOR_DOMAINS_RESPONSE',
                history: [],
                success: false,
                error: 'History API not available'
              });
            }
          } catch (error) {
            console.error('KP_GET_HISTORY_FOR_DOMAINS failed:', error);
            sendResponse({
              type: 'KP_HISTORY_FOR_DOMAINS_RESPONSE',
              history: [],
              success: false,
              error: error.message
            });
          }
          break;
        }

        case 'KP_GET_FAVICON': {
          // Fetch favicon for a website URL, with caching
          const pageUrl = typeof message.pageUrl === 'string' ? message.pageUrl.trim() : '';
          const size = Math.max(16, Math.min(256, Number(message.size) || 32));

          if (!pageUrl) {
            sendResponse({
              type: 'KP_FAVICON_RESPONSE',
              success: false,
              error: 'Missing pageUrl'
            });
            break;
          }

          try {
            // Parse URL to get domain
            let urlObj;
            try {
              urlObj = new URL(pageUrl);
            } catch (e) {
              sendResponse({
                type: 'KP_FAVICON_RESPONSE',
                success: false,
                error: 'Invalid URL'
              });
              break;
            }

            const domain = urlObj.hostname.replace(/^www\./, '');
            const cacheKey = `kp_favicon_${domain}_${size}`;
            const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

            // Check cache first
            try {
              const cached = await chrome.storage.local.get([cacheKey]);
              if (cached[cacheKey]) {
                const cachedData = cached[cacheKey];
                const age = Date.now() - (cachedData.timestamp || 0);
                if (age < CACHE_DURATION_MS && cachedData.dataUrl) {
                  sendResponse({
                    type: 'KP_FAVICON_RESPONSE',
                    success: true,
                    dataUrl: cachedData.dataUrl,
                    cached: true
                  });
                  break;
                }
              }
            } catch (e) {
              // Cache read failed, continue to fetch
            }

            // Try Chrome's built-in favicon API first (for visited sites)
            try {
              const chromeFaviconUrl = `chrome://favicon2/?size=${size}&pageUrl=${encodeURIComponent(pageUrl)}`;
              // We can't directly test if this works, so we'll try fetching it
              // But actually, we can't fetch chrome:// URLs. Let's try the extension favicon API instead.
            } catch (e) {
              // Ignore
            }

            // Try common favicon locations
            // Order: Google's favicon service (most reliable), then DuckDuckGo, then direct site paths
            const faviconUrls = [
              `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`,
              `https://icons.duckduckgo.com/ip3/${domain}.ico`,
              `${urlObj.origin}/favicon.ico`,
              `${urlObj.origin}/favicon.png`,
              `${urlObj.origin}/apple-touch-icon.png`
            ];

            let faviconDataUrl = null;

            for (const faviconUrl of faviconUrls) {
              try {
                const response = await fetch(faviconUrl, {
                  method: 'GET',
                  mode: 'cors',
                  credentials: 'omit',
                  referrerPolicy: 'no-referrer',
                  cache: 'default'
                });

                if (response.ok) {
                  const blob = await response.blob();
                  if (blob.size > 0 && blob.type.startsWith('image/')) {
                    // Convert blob to data URL
                    const reader = new FileReader();
                    faviconDataUrl = await new Promise((resolve, reject) => {
                      reader.onload = () => resolve(reader.result);
                      reader.onerror = reject;
                      reader.readAsDataURL(blob);
                    });

                    if (faviconDataUrl) {
                      // Cache the result
                      try {
                        await chrome.storage.local.set({
                          [cacheKey]: {
                            dataUrl: faviconDataUrl,
                            timestamp: Date.now()
                          }
                        });
                      } catch (e) {
                        // Cache write failed, but we still have the favicon
                      }
                      break;
                    }
                  }
                }
              } catch (e) {
                // Try next URL
                continue;
              }
            }

            if (faviconDataUrl) {
              sendResponse({
                type: 'KP_FAVICON_RESPONSE',
                success: true,
                dataUrl: faviconDataUrl,
                cached: false
              });
            } else {
              sendResponse({
                type: 'KP_FAVICON_RESPONSE',
                success: false,
                error: 'Favicon not found'
              });
            }
          } catch (error) {
            console.error('KP_GET_FAVICON failed:', error);
            sendResponse({
              type: 'KP_FAVICON_RESPONSE',
              success: false,
              error: error.message || 'Unknown error'
            });
          }
          break;
        }

        case 'KP_NAVGRAPH_GET': {
          const tabId = sender?.tab?.id;
          if (typeof tabId !== 'number') {
            sendResponse({ type: 'KP_ERROR', error: 'No sender tab id' });
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
            type: 'KP_NAVGRAPH_GRAPH',
            tabId,
            graph,
            timestamp: Date.now()
          });
          break;
        }

        case 'KP_NAVGRAPH_JUMP': {
          const tabId = sender?.tab?.id;
          const url = typeof message.url === 'string' ? message.url.trim() : '';
          if (typeof tabId !== 'number') {
            sendResponse({ type: 'KP_ERROR', error: 'No sender tab id' });
            break;
          }
          if (!url) {
            sendResponse({ type: 'KP_ERROR', error: 'Invalid url' });
            break;
          }

          try {
            await chrome.tabs.update(tabId, { url });
            sendResponse({ type: 'KP_SUCCESS', tabId });
          } catch (e) {
            sendResponse({ type: 'KP_ERROR', error: `Failed to navigate: ${e?.message || e}` });
          }
          break;
        }

        case 'KP_NAVGRAPH_CLEAR': {
          const tabId = sender?.tab?.id;
          if (typeof tabId !== 'number') {
            sendResponse({ type: 'KP_ERROR', error: 'No sender tab id' });
            break;
          }
          try {
            await tabNavGraphManager.clear(tabId);
            sendResponse({ type: 'KP_SUCCESS', tabId });
          } catch (e) {
            sendResponse({ type: 'KP_ERROR', error: `Failed to clear: ${e?.message || e}` });
          }
          break;
        }

        case MSG.OPEN_SETTINGS_POPOVER:
        case MSG.OPEN_GUIDE_POPOVER:
        case MSG.OPEN_ONBOARDING: {
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
            await chrome.tabs.sendMessage(tabId, { type: message.type });
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

        case MSG.SET_PREVIEW_MOBILE_UA: {
          // Content script: enable/disable mobile User-Agent for iframe previews on this tab.
          const tabId = sender?.tab?.id;
          if (typeof tabId !== 'number') {
            sendResponse({ type: MSG.ERROR, error: 'No sender tab id' });
            break;
          }
          const enabled = message.enabled === true;
          try {
            await setPreviewMobileUaForTab(tabId, enabled);
            sendResponse({ type: MSG.SUCCESS, enabled, tabId });
          } catch (e) {
            console.warn('[KeyPilot] SET_PREVIEW_MOBILE_UA failed:', e?.message || e);
            sendResponse({
              type: MSG.ERROR,
              error: e?.message || 'Failed to update preview mobile UA'
            });
          }
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
            frameName: typeof message.frameName === 'string' ? message.frameName : ''
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

        case 'KP_GET_STATE':
          // Content script or popup requesting current state
          const currentState = await extensionToggleManager.getState();
          sendResponse({
            type: 'KP_STATE_RESPONSE',
            enabled: currentState,
            timestamp: Date.now()
          });
          console.log('Sent current state:', currentState);
          break;
          
        case 'KP_SET_STATE':
          // Popup requesting state change
          if (typeof message.enabled === 'boolean') {
            const newState = await extensionToggleManager.setState(message.enabled);
            sendResponse({
              type: 'KP_STATE_CHANGED',
              enabled: newState,
              timestamp: Date.now()
            });
            console.log('State changed via message to:', newState);
          } else {
            console.error('Invalid enabled value in KP_SET_STATE:', message.enabled);
            sendResponse({
              type: 'KP_ERROR',
              error: 'Invalid enabled value'
            });
          }
          break;
          
        case 'KP_TOGGLE_STATE':
          // Request to toggle current state
          const toggledState = await extensionToggleManager.toggleState();
          sendResponse({
            type: 'KP_STATE_CHANGED',
            enabled: toggledState,
            timestamp: Date.now()
          });
          console.log('State toggled via message to:', toggledState);
          break;
          
        // Legacy KP_GET_CURSOR_SETTINGS / KP_SET_CURSOR_* removed.
        // Cursor appearance is stored in kp_settings_v1 (settings-manager).

        case 'KP_CLOSE_TAB':
          // Request to close current tab
          if (sender.tab && sender.tab.id) {
            try {
              await chrome.tabs.remove(sender.tab.id);
              console.log('Closed tab:', sender.tab.id);
              // No need to send response as tab will be closed
            } catch (error) {
              console.error('Failed to close tab:', error);
              sendResponse({
                type: 'KP_ERROR',
                error: 'Failed to close tab: ' + error.message
              });
            }
          } else {
            console.error('No valid tab ID in close tab request');
            sendResponse({
              type: 'KP_ERROR',
              error: 'No valid tab ID'
            });
          }
          break;

        case 'KP_GO_BACK':
        case 'KP_GO_FORWARD': {
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
            sendResponse({ type: 'KP_ERROR', error: 'No valid tab ID' });
            break;
          }

          try {
            if (message.type === 'KP_GO_BACK') {
              await chrome.tabs.goBack(tabId);
            } else {
              await chrome.tabs.goForward(tabId);
            }
            sendResponse({ type: 'KP_SUCCESS' });
          } catch (error) {
            // No history entry / already at edge — treat as soft success.
            console.warn('[KeyPilot] History navigation failed:', error?.message || error);
            sendResponse({
              type: 'KP_ERROR',
              error: error?.message || 'History navigation failed'
            });
          }
          break;
        }

        case 'KP_TAB_LEFT':
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
                throw new Error('No valid tabs to switch to');
              }
              
              await chrome.tabs.update(tabs[targetIndex].id, { active: true });
              console.log('Switched to left tab:', tabs[targetIndex].id);
              sendResponse({ type: 'KP_SUCCESS' });
            } catch (error) {
              console.error('Failed to switch to left tab:', error);
              sendResponse({
                type: 'KP_ERROR',
                error: 'Failed to switch tab: ' + error.message
              });
            }
          }
          break;

        case 'KP_TAB_RIGHT':
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
                throw new Error('No valid tabs to switch to');
              }
              
              await chrome.tabs.update(tabs[targetIndex].id, { active: true });
              console.log('Switched to right tab:', tabs[targetIndex].id);
              sendResponse({ type: 'KP_SUCCESS' });
            } catch (error) {
              console.error('Failed to switch to right tab:', error);
              sendResponse({
                type: 'KP_ERROR',
                error: 'Failed to switch tab: ' + error.message
              });
            }
          }
          break;

        case 'KP_NEW_TAB':
          // Open a new tab
          try {
            const url = chrome.runtime.getURL('pages/newtab.html');
            /** @type {chrome.tabs.CreateProperties} */
            const createProps = {
              url,
              active: true
            };

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
            sendResponse({ type: 'KP_SUCCESS', tabId: newTab.id });
          } catch (error) {
            console.error('Failed to open new tab:', error);
            sendResponse({
              type: 'KP_ERROR',
              error: 'Failed to open new tab: ' + error.message
            });
          }
          break;

        case 'KP_OPEN_URL_BACKGROUND':
          // Open a URL in a new tab without focusing it (middle-click style).
          if (!message.url || typeof message.url !== 'string') {
            sendResponse({
              type: 'KP_ERROR',
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
            sendResponse({ type: 'KP_SUCCESS', tabId: tab.id });
          } catch (error) {
            console.error('Failed to open background tab:', error);
            sendResponse({
              type: 'KP_ERROR',
              error: 'Failed to open background tab: ' + error.message
            });
          }
          break;

        case 'KP_OPEN_URL_FOREGROUND':
          // Open a URL in a new tab AND focus it.
          if (!message.url || typeof message.url !== 'string') {
            sendResponse({
              type: 'KP_ERROR',
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
            sendResponse({ type: 'KP_SUCCESS', tabId: tab.id });
          } catch (error) {
            console.error('Failed to open foreground tab:', error);
            sendResponse({
              type: 'KP_ERROR',
              error: 'Failed to open foreground tab: ' + error.message
            });
          }
          break;

        case 'KP_STATUS':
          // Status updates are broadcast to update the popup UI.
          // Background script doesn't need to handle them, just acknowledge.
          sendResponse({ type: 'KP_ACK' });
          break;
          
        default:
          console.warn('Unknown message type:', message.type);
          sendResponse({
            type: 'KP_ERROR',
            error: 'Unknown message type'
          });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({
        type: 'KP_ERROR',
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