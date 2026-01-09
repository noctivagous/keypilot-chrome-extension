/**
 * KeyPilot Extension Toggle Service Worker
 * Manages global extension state and coordinates toggle functionality across all tabs
 */

const KEYBOARD_HELP_STORAGE_KEY = 'keypilot_keyboard_help_visible';
const ONBOARDING_ACTIVE_STORAGE_KEY = 'keypilot_onboarding_active';
const ONBOARDING_PROGRESS_STORAGE_KEY = 'keypilot_onboarding_progress';
const TRANSIENT_ACTION_STORAGE_KEY = 'keypilot_transient_action';

async function ensureDefaultKeyboardHelpVisible() {
  // Only set a default if the user has never set a preference.
  try {
    const syncResult = await chrome.storage.sync.get([KEYBOARD_HELP_STORAGE_KEY]);
    if (typeof syncResult?.[KEYBOARD_HELP_STORAGE_KEY] === 'boolean') return;
  } catch {
    // Ignore and fall back to local read.
  }

  try {
    const localResult = await chrome.storage.local.get([KEYBOARD_HELP_STORAGE_KEY]);
    if (typeof localResult?.[KEYBOARD_HELP_STORAGE_KEY] === 'boolean') return;
  } catch {
    // Ignore.
  }

  const payload = { [KEYBOARD_HELP_STORAGE_KEY]: true, timestamp: Date.now() };

  try {
    await chrome.storage.sync.set(payload);
    console.log('Set default floating keyboard reference visibility: true (sync)');
    return;
  } catch {
    // Fall back to local.
  }

  try {
    await chrome.storage.local.set(payload);
    console.log('Set default floating keyboard reference visibility: true (local)');
  } catch (e) {
    console.warn('Failed to set default floating keyboard reference visibility:', e);
  }
}

async function ensureDefaultOnboardingState() {
  // Only set a default if onboarding has never been initialized.
  try {
    const syncResult = await chrome.storage.sync.get([ONBOARDING_ACTIVE_STORAGE_KEY]);
    if (typeof syncResult?.[ONBOARDING_ACTIVE_STORAGE_KEY] === 'boolean') return;
  } catch {
    // Ignore and fall back to local read.
  }

  try {
    const localResult = await chrome.storage.local.get([ONBOARDING_ACTIVE_STORAGE_KEY]);
    if (typeof localResult?.[ONBOARDING_ACTIVE_STORAGE_KEY] === 'boolean') return;
  } catch {
    // Ignore.
  }

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

  try {
    await chrome.storage.sync.set(payload);
    console.log('Set default onboarding state: active=true (sync)');
    return;
  } catch {
    // Fall back to local.
  }

  try {
    await chrome.storage.local.set(payload);
    console.log('Set default onboarding state: active=true (local)');
  } catch (e) {
    console.warn('Failed to set default onboarding state:', e);
  }
}

class ExtensionToggleManager {
  constructor() {
    this.STORAGE_KEY = 'keypilot_enabled';
    this.DEFAULT_STATE = true;
    this.initialized = false;
    
    // Cursor settings constants
    this.CURSOR_STORAGE_KEYS = {
      SIZE: 'keypilot_cursor_size',
      VISIBLE: 'keypilot_cursor_visible'
    };
    this.CURSOR_DEFAULTS = {
      SIZE: 1.0,
      VISIBLE: true
    };
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
    try {
      // Try chrome.storage.sync first
      const syncResult = await chrome.storage.sync.get([this.STORAGE_KEY]);
      if (syncResult[this.STORAGE_KEY] !== undefined) {
        return syncResult[this.STORAGE_KEY];
      }
    } catch (syncError) {
      console.warn('chrome.storage.sync unavailable, trying local storage:', syncError);
      
      try {
        // Fallback to chrome.storage.local
        const localResult = await chrome.storage.local.get([this.STORAGE_KEY]);
        if (localResult[this.STORAGE_KEY] !== undefined) {
          return localResult[this.STORAGE_KEY];
        }
      } catch (localError) {
        console.error('Both sync and local storage failed:', localError);
      }
    }
    
    // Return default state if all storage methods fail
    return this.DEFAULT_STATE;
  }

  /**
   * Set extension state in storage and notify all tabs
   * @param {boolean} enabled - New enabled state
   * @returns {Promise<boolean>} The state that was set
   */
  async setState(enabled) {
    const state = Boolean(enabled);
    const stateData = {
      [this.STORAGE_KEY]: state,
      timestamp: Date.now()
    };

    try {
      // Try to save to chrome.storage.sync first
      await chrome.storage.sync.set(stateData);
      console.log('State saved to sync storage:', state);
    } catch (syncError) {
      console.warn('Failed to save to sync storage, trying local:', syncError);

      try {
        // Fallback to chrome.storage.local
        await chrome.storage.local.set(stateData);
        console.log('State saved to local storage:', state);
      } catch (localError) {
        console.error('Failed to save state to any storage:', localError);
        // Continue execution even if storage fails
      }
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
   * Get cursor settings from storage
   * @returns {Promise<{size: number, visible: boolean}>} Current cursor settings
   */
  async getCursorSettings() {
    const settings = {
      size: this.CURSOR_DEFAULTS.SIZE,
      visible: this.CURSOR_DEFAULTS.VISIBLE
    };

    try {
      // Try chrome.storage.sync first
      const syncResult = await chrome.storage.sync.get([
        this.CURSOR_STORAGE_KEYS.SIZE,
        this.CURSOR_STORAGE_KEYS.VISIBLE
      ]);
      
      if (syncResult[this.CURSOR_STORAGE_KEYS.SIZE] !== undefined) {
        settings.size = syncResult[this.CURSOR_STORAGE_KEYS.SIZE];
      }
      if (syncResult[this.CURSOR_STORAGE_KEYS.VISIBLE] !== undefined) {
        settings.visible = syncResult[this.CURSOR_STORAGE_KEYS.VISIBLE];
      }
      
      return settings;
    } catch (syncError) {
      console.warn('chrome.storage.sync unavailable for cursor settings, trying local storage:', syncError);
      
      try {
        // Fallback to chrome.storage.local
        const localResult = await chrome.storage.local.get([
          this.CURSOR_STORAGE_KEYS.SIZE,
          this.CURSOR_STORAGE_KEYS.VISIBLE
        ]);
        
        if (localResult[this.CURSOR_STORAGE_KEYS.SIZE] !== undefined) {
          settings.size = localResult[this.CURSOR_STORAGE_KEYS.SIZE];
        }
        if (localResult[this.CURSOR_STORAGE_KEYS.VISIBLE] !== undefined) {
          settings.visible = localResult[this.CURSOR_STORAGE_KEYS.VISIBLE];
        }
        
        return settings;
      } catch (localError) {
        console.error('Both sync and local storage failed for cursor settings:', localError);
      }
    }
    
    // Return default settings if all storage methods fail
    return settings;
  }

  /**
   * Set cursor settings in storage and notify all tabs
   * @param {Object} settings - Cursor settings object
   * @param {number} [settings.size] - Cursor size (0.5 - 2.0)
   * @param {boolean} [settings.visible] - Cursor visibility
   * @returns {Promise<{size: number, visible: boolean}>} The settings that were set
   */
  async setCursorSettings(settings) {
    // Get current settings first
    const currentSettings = await this.getCursorSettings();
    
    // Merge with new settings, validating values
    const newSettings = {
      size: settings.size !== undefined ? 
        Math.max(0.5, Math.min(2.0, Number(settings.size))) : currentSettings.size,
      visible: settings.visible !== undefined ? 
        Boolean(settings.visible) : currentSettings.visible
    };

    const settingsData = {
      [this.CURSOR_STORAGE_KEYS.SIZE]: newSettings.size,
      [this.CURSOR_STORAGE_KEYS.VISIBLE]: newSettings.visible,
      timestamp: Date.now()
    };

    try {
      // Try to save to chrome.storage.sync first
      await chrome.storage.sync.set(settingsData);
      console.log('Cursor settings saved to sync storage:', newSettings);
    } catch (syncError) {
      console.warn('Failed to save cursor settings to sync storage, trying local:', syncError);
      
      try {
        // Fallback to chrome.storage.local
        await chrome.storage.local.set(settingsData);
        console.log('Cursor settings saved to local storage:', newSettings);
      } catch (localError) {
        console.error('Failed to save cursor settings to any storage:', localError);
        // Continue execution even if storage fails
      }
    }

    // Notify all tabs about the cursor settings change
    await this.notifyAllTabsCursorSettings(newSettings);
    
    return newSettings;
  }

  /**
   * Notify all tabs about state change
   * @param {boolean} enabled - New enabled state
   */
  async notifyAllTabs(enabled) {
    try {
      const tabs = await chrome.tabs.query({});
      const message = {
        type: 'KP_TOGGLE_STATE',
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

  /**
   * Notify all tabs about cursor settings change
   * @param {Object} settings - New cursor settings
   */
  async notifyAllTabsCursorSettings(settings) {
    try {
      const tabs = await chrome.tabs.query({});
      const message = {
        type: 'KP_CURSOR_SETTINGS_CHANGED',
        settings: settings,
        timestamp: Date.now()
      };

      // Send message to all tabs
      const notifications = tabs.map(async (tab) => {
        try {
          await chrome.tabs.sendMessage(tab.id, message);
        } catch (error) {
          // Ignore errors for tabs that don't have content scripts
          console.debug('Could not notify tab', tab.id, 'about cursor settings:', error.message);
        }
      });

      await Promise.allSettled(notifications);
      console.log('Notified', tabs.length, 'tabs about cursor settings change:', settings);
    } catch (error) {
      console.error('Failed to notify tabs about cursor settings:', error);
    }
  }
}

// Helper function to check if a tab URL is skippable
function isSkippableTab(tab) {
  // Skip tabs with no URL (rare, e.g. special transient tabs).
  // Note: on some Chromium builds the overridden New Tab may still report a chrome:// URL
  // (with the real extension URL showing up in pendingUrl). Handle both.
  const url = typeof tab?.url === 'string' ? tab.url : '';
  const pendingUrl = typeof tab?.pendingUrl === 'string' ? tab.pendingUrl : '';
  if (!url && !pendingUrl) return true;

  // Always allow the KeyPilot custom New Tab page, even though it is an extension URL.
  // We originally skipped chrome:// pages to avoid "utility" pages, but the overridden
  // New Tab should participate in left/right tab cycling (Q/W).
  const isKeyPilotNewTab = (u) => {
    if (!u || typeof u !== 'string') return false;
    const s = u.trim();
    if (!s) return false;

    // Common Chromium/Chrome variants when New Tab is overridden.
    // Some builds still expose the visible URL as chrome://newtab or chrome://new-tab-page.
    if (/^chrome:\/\/newtab\/?/i.test(s) || /^chrome:\/\/new-tab-page\/?/i.test(s)) {
      return true;
    }

    // Extension URL variants: allow exact match + query/hash + any URL that resolves to the same
    // extension origin/path (in case of normalization or unexpected formatting).
    try {
      const kpNewTabUrl = chrome.runtime.getURL('pages/newtab.html');
      if (s === kpNewTabUrl || s.startsWith(`${kpNewTabUrl}#`) || s.startsWith(`${kpNewTabUrl}?`)) {
        return true;
      }
      const kp = new URL(kpNewTabUrl);
      const parsed = new URL(s);
      if (parsed.origin === kp.origin && parsed.pathname.endsWith('/pages/newtab.html')) {
        return true;
      }
    } catch {
      // ignore
    }

    return false;
  };

  if (isKeyPilotNewTab(url) || isKeyPilotNewTab(pendingUrl)) return false;

  const skipPatterns = [
    /^chrome:\/\//i,
    /^edge:\/\//i,
    /^about:/i,
    /^data:/i,
    /^chrome-native:/i,
    /^view-source:/i
  ];
  return skipPatterns.some(pattern => pattern.test(url || pendingUrl));
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

function isSkippableUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const u = url.trim();
  if (!u) return true;
  const skipPatterns = [
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^edge:\/\//i,
    /^about:/i,
    /^data:/i,
    /^chrome-native:/i,
    /^view-source:/i
  ];
  return skipPatterns.some((pattern) => pattern.test(u));
}

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

    let storedMode = null;
    // Try sync first, then local.
    try {
      const res = await chrome.storage.sync.get([NAVGRAPH_MODE_STORAGE_KEY]);
      storedMode = res?.[NAVGRAPH_MODE_STORAGE_KEY] ?? null;
    } catch {
      // ignore
    }
    if (!storedMode) {
      try {
        const res = await chrome.storage.local.get([NAVGRAPH_MODE_STORAGE_KEY]);
        storedMode = res?.[NAVGRAPH_MODE_STORAGE_KEY] ?? null;
      } catch {
        // ignore
      }
    }

    if (storedMode === 'linear' || storedMode === 'branching') {
      this._mode = storedMode;
      return;
    }

    // Persist default if user has never set a preference (best-effort).
    const payload = { [NAVGRAPH_MODE_STORAGE_KEY]: NAVGRAPH_MODE_DEFAULT, timestamp: Date.now() };
    try {
      await chrome.storage.sync.set(payload);
      return;
    } catch {
      // ignore
    }
    try {
      await chrome.storage.local.set(payload);
    } catch {
      // ignore
    }
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
          // Search history for specific domains
          const domains = Array.isArray(message.domains) ? message.domains : [];
          const days = Math.max(1, Math.min(90, Number(message.days) || 30));
          const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

          try {
            if (chrome.history && typeof chrome.history.search === 'function') {
              const allResults = [];
              const seenUrls = new Set();

              // Search history for each domain
              for (const domain of domains) {
                try {
                  const historyItems = await chrome.history.search({
                    text: domain,
                    maxResults: 100,
                    startTime: startTime
                  });

                  // Filter to only include items that actually match the domain
                  for (const item of historyItems) {
                    if (item.url && !seenUrls.has(item.url)) {
                      try {
                        const itemDomain = new URL(item.url).hostname.replace('www.', '');
                        // Check if the item's domain matches or is a subdomain of the target domain
                        if (itemDomain === domain || itemDomain.endsWith('.' + domain)) {
                          allResults.push({
                            title: item.title || itemDomain,
                            url: item.url,
                            visitCount: item.visitCount || 0
                          });
                          seenUrls.add(item.url);
                        }
                      } catch (e) {
                        // Skip invalid URLs
                      }
                    }
                  }
                } catch (error) {
                  console.warn(`KP_GET_HISTORY_FOR_DOMAINS: error searching for domain ${domain}:`, error);
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
          
        case 'KP_GET_CURSOR_SETTINGS':
          // Content script or popup requesting current cursor settings
          const currentCursorSettings = await extensionToggleManager.getCursorSettings();
          sendResponse({
            type: 'KP_CURSOR_SETTINGS_RESPONSE',
            settings: currentCursorSettings,
            timestamp: Date.now()
          });
          console.log('Sent current cursor settings:', currentCursorSettings);
          break;

        case 'KP_SET_CURSOR_SIZE':
          // Popup requesting cursor size change
          if (typeof message.size === 'number' && message.size >= 0.5 && message.size <= 2.0) {
            const newCursorSettings = await extensionToggleManager.setCursorSettings({ size: message.size });
            sendResponse({
              type: 'KP_CURSOR_SETTINGS_CHANGED',
              settings: newCursorSettings,
              timestamp: Date.now()
            });
            console.log('Cursor size changed via message to:', message.size);
          } else {
            console.error('Invalid cursor size value in KP_SET_CURSOR_SIZE:', message.size);
            sendResponse({
              type: 'KP_ERROR',
              error: 'Invalid cursor size value'
            });
          }
          break;

        case 'KP_SET_CURSOR_VISIBILITY':
          // Popup requesting cursor visibility change
          if (typeof message.visible === 'boolean') {
            const newCursorSettings = await extensionToggleManager.setCursorSettings({ visible: message.visible });
            sendResponse({
              type: 'KP_CURSOR_SETTINGS_CHANGED',
              settings: newCursorSettings,
              timestamp: Date.now()
            });
            console.log('Cursor visibility changed via message to:', message.visible);
          } else {
            console.error('Invalid cursor visibility value in KP_SET_CURSOR_VISIBILITY:', message.visible);
            sendResponse({
              type: 'KP_ERROR',
              error: 'Invalid cursor visibility value'
            });
          }
          break;

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