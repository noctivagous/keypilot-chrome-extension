/**
 * KeyPilot main application class
 */
import { StateManager } from './modules/state-manager.js';
import { EventManager } from './modules/event-manager.js';
import { CursorManager } from './modules/cursor.js';
import { ElementDetector } from './modules/element-detector.js';
import { ActivationHandler } from './modules/activation-handler.js';
import { FocusDetector } from './modules/focus-detector.js';
import { OverlayManager } from './modules/overlay-manager.js';
import { StyleManager } from './modules/style-manager.js';
import { ShadowDOMManager } from './modules/shadow-dom-manager.js';
import { IntersectionObserverManager } from './modules/intersection-observer-manager.js';
import { OptimizedScrollManager } from './modules/optimized-scroll-manager.js';
import { RectangleIntersectionObserver } from './modules/rectangle-intersection-observer.js';
import { MouseCoordinateManager } from './modules/mouse-coordinate-manager.js';
import { MODES, CURSOR_MODE, CSS_CLASSES, COLORS, Z_INDEX, RECTANGLE_SELECTION, EDGE_ONLY_SELECTION, FEATURE_FLAGS } from './config/constants.js';
import { buildKeybindingsForLayout, DEFAULT_KEYBOARD_LAYOUT_ID, getKeyboardUiLayoutForLayout, normalizeKeyboardLayoutId } from './config/keyboard-layouts.js';
import { FloatingKeyboardHelp } from './ui/floating-keyboard-help.js';
import { OmniboxManager } from './modules/omnibox-manager.js';
import { TabHistoryPopover } from './modules/tab-history-popover.js';
import { DEFAULT_SETTINGS, getSettings, SETTINGS_STORAGE_KEY } from './modules/settings-manager.js';

export class KeyPilot extends EventManager {
  constructor() {
    super();

    // Prevent multiple instances
    if (window.__KeyPilotV22) {
      console.warn('[KeyPilot] Already loaded.');
      return;
    }
    window.__KeyPilotV22 = true;
    window.__KeyPilotInstance = this; // Store instance for popover access

    // Extension enabled state - default to true, will be updated from service worker
    this.enabled = true;
    this.initializationComplete = false;

    this.state = new StateManager();
    this.cursor = new CursorManager();
    this.detector = new ElementDetector();
    this.activator = new ActivationHandler(this.detector);
    this.mouseCoordinateManager = new MouseCoordinateManager();
    this.focusDetector = new FocusDetector(this.state, this.mouseCoordinateManager);
    this.overlayManager = new OverlayManager();
    this.styleManager = new StyleManager();
    this.shadowDOMManager = new ShadowDOMManager(this.styleManager);
    this.floatingKeyboardHelp = null;
    this.keybindings = buildKeybindingsForLayout(DEFAULT_KEYBOARD_LAYOUT_ID);
    this._keyboardLayoutId = DEFAULT_KEYBOARD_LAYOUT_ID;
    this._keyboardUiLayout = getKeyboardUiLayoutForLayout(DEFAULT_KEYBOARD_LAYOUT_ID);
    this.omniboxManager = new OmniboxManager({
      onClose: () => {
        try {
          // Only the top frame should manage omnibox state.
          if (window === window.top) this.state.setMode(MODES.NONE);
        } catch { /* ignore */ }
      }
    });
    this.tabHistoryPopover = new TabHistoryPopover({
      popupManager: this.overlayManager?.popupManager
    });
    this.KEYBOARD_HELP_STORAGE_KEY = 'keypilot_keyboard_help_visible';
    this._keyboardHelpVisible = false;
    this._keyboardHelpStorageListener = null;
    
    // Intersection Observer optimizations
    this.intersectionManager = new IntersectionObserverManager(this.detector);
    this.scrollManager = new OptimizedScrollManager(this.overlayManager, this.state);
    
    // Panel tracking for negative regions
    this._panelTrackingInterval = null;
    this._lastPanelCheck = 0;
    
    // Edge-only rectangle intersection observer for performance optimization
    this.rectangleIntersectionObserver = null;
    this.edgeOnlyProcessingEnabled = FEATURE_FLAGS.ENABLE_EDGE_ONLY_PROCESSING;

    // Mouse movement optimization: only query every 2+ pixels (increased threshold)
    this.lastQueryPosition = { x: -1, y: -1 };
    this.MOUSE_QUERY_THRESHOLD = 1;
    
    // Mousemove hot-path optimization: coalesce hover work to once-per-frame.
    // We still update cursor position immediately, but defer expensive hit-testing / RBush work.
    this._mouseMoveRAF = 0;
    this._pendingMouse = { x: -1, y: -1, underHint: null };

    // Post-click refresh: after UI-mutating clicks, re-query under cursor once the DOM settles.
    this._postClickRefreshToken = 0;
    this._postClickRefreshTimer = null;
    this._postClickRefreshInnerTimer = null;

    // Text focus mode: "mouse-move arms click" countdown (only F clicks; ESC exits only).
    this._textModeClickArmed = false;
    this._textModeClickArmedTarget = null;
    this._textModeClickInterval = null;

    // Settings cache (kp_settings_v1).
    this._settings = null;
    this._settingsStorageListener = null;
    
    
    // Performance monitoring
    this.performanceMetrics = {
      mouseQueries: 0,
      cacheHits: 0,
      lastMetricsLog: Date.now()
    };

    // Bound custom event handlers (so cleanup can remove them)
    this._boundScrollEndHandler = null;

    this.init();
  }
  
  _getUnderElementHintFromMouseEvent(e) {
    try {
      let under = null;
      const path = (e && typeof e.composedPath === 'function') ? e.composedPath() : null;
      if (Array.isArray(path)) {
        for (const n of path) {
          if (n && n.nodeType === 1) { under = n; break; }
        }
      }
      if (!under && e && e.target && e.target.nodeType === 1) under = e.target;
      if (!under || under.nodeType !== 1) return null;
      // HTML/BODY are too coarse to be useful as an occlusion gate.
      try {
        if (under.tagName === 'HTML' || under.tagName === 'BODY') return null;
      } catch { /* ignore */ }
      return under;
    } catch {
      return null;
    }
  }

  /**
   * Emit a semantic KeyPilot action event for consumers like onboarding.
   * Consumers should prefer this over raw keydown because it reflects what KeyPilot actually did.
   */
  emitAction(action, detail = {}) {
    try {
      const payload = {
        action: String(action || ''),
        timestamp: Date.now(),
        ...detail
      };
      if (!payload.action) return;
      document.dispatchEvent(new CustomEvent('keypilot:action', { detail: payload }));
    } catch {
      // ignore
    }
  }

  _buildActivationDetail(target) {
    const detail = {
      isLink: false,
      href: null,
      isKeyboardHelpKey: false
    };

    try {
      // Treat both real anchors and "link-like" UI rows as links for onboarding semantics.
      //
      // Important: many extension surfaces (New Tab, omnibox suggestions, etc) render clickable
      // rows via `renderUrlListing()` which sets `role="link"` + `data-kp-url` instead of `<a>`.
      const el = target instanceof Element ? target : null;

      // 1) Native anchors
      if (el && el.tagName === 'A' && /** @type {any} */ (el).href) {
        detail.isLink = true;
        detail.href = /** @type {any} */ (el).href;
      } else if (el && typeof el.closest === 'function') {
        const a = el.closest('a[href]');
        if (a && a.tagName === 'A' && /** @type {any} */ (a).href) {
          detail.isLink = true;
          detail.href = /** @type {any} */ (a).href;
        }
      }

      // 2) Link-like rows (e.g. `role="link"` + `data-kp-url`)
      if (!detail.isLink && el && typeof el.closest === 'function') {
        const linkish = /** @type {HTMLElement|null} */ (el.closest('[role="link"]'));
        if (linkish) {
          detail.isLink = true;
          const kpUrl = linkish?.dataset?.kpUrl ? String(linkish.dataset.kpUrl) : '';
          if (kpUrl) detail.href = kpUrl;
        }
      }
    } catch {
      // ignore
    }

    try {
      // Keys in the floating keyboard reference have `data-kp-action-id`.
      // If the user F-clicks one, it triggers the tooltip popover (key details).
      const el = target instanceof Element ? target : null;
      const keyEl =
        el && typeof el.closest === 'function'
          ? el.closest('[data-kp-action-id]')
          : null;
      const inKeyboardHelp =
        !!(keyEl && keyEl.closest && keyEl.closest('.kp-floating-keyboard-help'));
      if (keyEl && inKeyboardHelp) detail.isKeyboardHelpKey = true;
    } catch {
      // ignore
    }

    return detail;
  }

  _clearTextModeClickTimers() {
    try {
      if (this._textModeClickInterval) {
        clearInterval(this._textModeClickInterval);
      }
    } catch { /* ignore */ }
    this._textModeClickInterval = null;
  }

  _disarmTextModeClick() {
    this._clearTextModeClickTimers();
    this._textModeClickArmed = false;
    this._textModeClickArmedTarget = null;
    try { this.overlayManager?.setHoverClickLabelText?.('F clicks'); } catch { /* ignore */ }
  }

  _armTextModeClick(target) {
    this._clearTextModeClickTimers();
    this._textModeClickArmed = true;
    this._textModeClickArmedTarget = target;

    let remaining = 3;
    try { this.overlayManager?.setHoverClickLabelText?.(`F clicks ${remaining}`); } catch { /* ignore */ }

    this._textModeClickInterval = setInterval(() => {
      remaining -= 1;

      if (remaining > 0) {
        try { this.overlayManager?.setHoverClickLabelText?.(`F clicks ${remaining}`); } catch { /* ignore */ }
        return;
      }

      // Countdown complete: remove hover focus rect + return cursor to orange until the user moves the mouse again.
      this._disarmTextModeClick();
      try { this.state.setFocusElement(null); } catch { /* ignore */ }
    }, 1000);
  }

  _handleActivateFromTextFocus(currentState) {
    const target = currentState?.focusEl;
    if (!target) return;

    // Try semantic activation first
    if (this.activator.handleSmartActivate(target, currentState.lastMouse.x, currentState.lastMouse.y)) {
      this.showRipple(currentState.lastMouse.x, currentState.lastMouse.y);
      this.overlayManager.flashFocusOverlay();
      this.postClickRefresh(target, currentState.lastMouse.x, currentState.lastMouse.y);
    } else {
      // Fallback to click
      this.activator.smartClick(target, currentState.lastMouse.x, currentState.lastMouse.y);
      this.showRipple(currentState.lastMouse.x, currentState.lastMouse.y);
      this.overlayManager.flashFocusOverlay();
      this.postClickRefresh(target, currentState.lastMouse.x, currentState.lastMouse.y);
    }

    // After clicking, hide hover UI until the user moves the mouse again.
    this._disarmTextModeClick();
    this.state.setFocusElement(null);
  }

  shouldImmediateRefreshAfterClick(target) {
    try {
      if (!target || !(target instanceof Element)) return false;
      const a = target.tagName === 'A' ? target : (typeof target.closest === 'function' ? target.closest('a') : null);
      if (!a || a.tagName !== 'A') return false;
      const rawHref = a.getAttribute('href'); // preserve '#' anchors (a.href becomes absolute)
      if (!rawHref) return true; // <a> with no href is typically UI-only
      return rawHref.trim().startsWith('#');
    } catch {
      return false;
    }
  }

  postClickRefresh(target, x, y) {
    if (!this.enabled) return;
    if (typeof x !== 'number' || typeof y !== 'number') return;
    if (x < 0 || y < 0) return;

    // UI-only anchors should refresh immediately (no 250ms delay).
    if (this.shouldImmediateRefreshAfterClick(target)) {
      const doc = document;
      const token = ++this._postClickRefreshToken;

      // Clear any prior scheduled refresh so rapid clicks don't pile up work.
      try { if (this._postClickRefreshTimer) clearTimeout(this._postClickRefreshTimer); } catch { /* ignore */ }
      try { if (this._postClickRefreshInnerTimer) clearTimeout(this._postClickRefreshInnerTimer); } catch { /* ignore */ }

      // Make the rect disappear immediately (UI interaction likely mutated DOM).
      try { this.overlayManager?.hideFocusOverlay?.(); } catch { /* ignore */ }

      // Then re-query after a short settle period (accordion/menu animation, etc.).
      this._postClickRefreshTimer = window.setTimeout(() => {
        if (!this.enabled) return;
        if (token !== this._postClickRefreshToken) return;
        if (document !== doc) return; // navigated/reloaded
        if (!document?.body) return;

        this.updateElementsUnderCursor(x, y);
        this.state.setState({ _overlayUpdateTrigger: Date.now() });
      }, 250);

      return;
    }

    this.schedulePostClickRefresh(x, y);
  }

  schedulePostClickRefresh(x, y) {
    if (!this.enabled) return;
    if (typeof x !== 'number' || typeof y !== 'number') return;
    if (x < 0 || y < 0) return;

    const doc = document;
    const token = ++this._postClickRefreshToken;

    // Clear any prior scheduled refresh so rapid clicks don't pile up work.
    try { if (this._postClickRefreshTimer) clearTimeout(this._postClickRefreshTimer); } catch { /* ignore */ }
    try { if (this._postClickRefreshInnerTimer) clearTimeout(this._postClickRefreshInnerTimer); } catch { /* ignore */ }

    this._postClickRefreshTimer = window.setTimeout(() => {
      if (!this.enabled) return;
      if (token !== this._postClickRefreshToken) return;
      if (document !== doc) return; // navigated/reloaded
      if (!document?.body) return;

      // Fade out the current rect so we don't leave a stale highlight when the UI mutated.
      this.overlayManager?.fadeOutFocusOverlay?.(120);

      // After the fade starts, force an unthrottled re-query under the cursor and refresh overlays,
      // even if the "focused" element reference didn't change.
      this._postClickRefreshInnerTimer = window.setTimeout(() => {
        if (!this.enabled) return;
        if (token !== this._postClickRefreshToken) return;
        if (document !== doc) return;
        if (!document?.body) return;

        // Bypass threshold logic: the mouse may not have moved, but the DOM might have.
        this.updateElementsUnderCursor(x, y);

        // Force overlay refresh even when focusEl stays the same reference.
        this.state.setState({ _overlayUpdateTrigger: Date.now() });
      }, 130);
    }, 250);
  }

  async init() {
    // Always set up styles and shadow DOM support
    this.setupStyles();
    this.setupShadowDOMSupport();

    // Query service worker for current enabled state
    await this.queryInitialState();

    // Load persisted settings and keep them synced across tabs.
    await this.refreshSettingsFromStorage();
    this.installSettingsSync();

    // Apply cursor-mode behavior as early as we can (after settings are loaded).
    try {
      this.styleManager?.setCursorOverridesEnabled?.(this._isCustomCursorModeEnabled());
    } catch { /* ignore */ }
    
    // Only initialize functionality if enabled
    if (this.enabled) {
      if (this._isCustomCursorModeEnabled()) {
        // Only apply the custom cursor once we know KeyPilot is enabled.
        // This prevents a brief "cursor flash" during page load when the extension is disabled.
        this.cursor.ensure();
        // Apply the cursor immediately using the already-loaded settings, without waiting for the
        // first hover/mousemove-driven state update. This also preserves the early-inject cursor
        // (if present) by avoiding a default overwrite in CursorManager.ensure().
        try {
          const st = this.state?.getState?.() || {};
          const mode = st.mode || MODES.NONE;
          this.cursor.setMode(mode, this._buildCursorOptionsForState({ ...st, mode }));
        } catch { /* ignore */ }
      } else {
        // Ensure we do not leave any cursor overrides behind.
        try { this.cursor.cleanup(); } catch { /* ignore */ }
      }
      await this.initializeEnabledState();
    } else {
      this.initializeDisabledState();
    }

    // Always set up communication and state management
    this.state.subscribe((newState, prevState) => {
      this.handleStateChange(newState, prevState);
    });



    this.setupPopupCommunication();
    this.setupOptimizedEventListeners();
   this.setupContinuousCursorSync();

    // Keep floating keyboard reference visibility synced across tabs.
    await this.setupKeyboardHelpSync();

    // Initialize cursor position using stored coordinates or fallback
    await this.initializeCursorPosition();

    // Note: occlusion is handled automatically via DOM hit-testing (no custom negative regions).

    this.initializationComplete = true;
    this.state.setState({ isInitialized: true });
  }

  async refreshSettingsFromStorage() {
    const prevCursorMode = this._settings?.cursorMode;
    try {
      this._settings = await getSettings();
    } catch {
      this._settings = { ...DEFAULT_SETTINGS };
    }

    // Apply keyboard layout immediately (used by key handling + keyboard reference UI).
    try {
      this._applyKeyboardLayoutFromSettings();
    } catch { /* ignore */ }

    // Apply cursor-mode behavior immediately.
    const cursorEnabled = this._isCustomCursorModeEnabled();
    try {
      this.styleManager?.setCursorOverridesEnabled?.(cursorEnabled);
    } catch { /* ignore */ }

    // Apply to runtime immediately.
    try {
      this.overlayManager?.setModeSettings?.(this._settings);
    } catch { /* ignore */ }

    // Active text input frame stroke thickness (CSS-driven).
    try {
      const px = Number(this._settings?.textMode?.strokeThickness);
      if (Number.isFinite(px)) {
        document.documentElement.style.setProperty('--kpv2-text-stroke-width', `${px}px`);
      } else {
        document.documentElement.style.removeProperty('--kpv2-text-stroke-width');
      }
    } catch { /* ignore */ }

    // Cursor behavior:
    // - CUSTOM_CURSORS: ensure + refresh cursor
    // - NO_CUSTOM_CURSORS: remove cursor overrides and skip cursor updates entirely
    if (cursorEnabled) {
      try {
        this.cursor.ensure();
      } catch { /* ignore */ }
      try {
        this.cursor.currentMode = null;
        this.cursor.currentModeKey = null;
        const st = this.state?.getState?.();
        if (st && st.mode) {
          this.cursor.setMode(st.mode, this._buildCursorOptionsForState(st));
        }
      } catch { /* ignore */ }
    } else {
      try {
        // If we just switched away from CUSTOM_CURSORS, aggressively clean up.
        if (prevCursorMode === CURSOR_MODE.CUSTOM_CURSORS) {
          this.cursor.cleanup();
        } else {
          // Still ensure we aren't leaving any cursor variable set.
          this.cursor.cleanup();
        }
      } catch { /* ignore */ }
    }

    // Force overlay refresh.
    try {
      this.state?.setState?.({ _overlayUpdateTrigger: Date.now() });
    } catch { /* ignore */ }
  }

  _applyKeyboardLayoutFromSettings() {
    const layoutId = normalizeKeyboardLayoutId(this._settings?.keyboardLayoutId);
    this._keyboardLayoutId = layoutId;
    this.keybindings = buildKeybindingsForLayout(layoutId);
    this._keyboardUiLayout = getKeyboardUiLayoutForLayout(layoutId);

    // If the floating keyboard reference is active, keep it in sync (no flicker if layoutId matches).
    try {
      if (this.floatingKeyboardHelp) {
        this.floatingKeyboardHelp.setKeybindings(this.keybindings);
        if (typeof this.floatingKeyboardHelp.setKeyboardLayout === 'function') {
          this.floatingKeyboardHelp.setKeyboardLayout({
            keyboardLayout: this._keyboardUiLayout,
            layoutId: this._keyboardLayoutId
          });
        }
      }
    } catch { /* ignore */ }
  }

  installSettingsSync() {
    if (this._settingsStorageListener) return;
    try {
      this._settingsStorageListener = (changes, area) => {
        if (area !== 'sync') return;
        if (!changes || !changes[SETTINGS_STORAGE_KEY]) return;
        this.refreshSettingsFromStorage();
      };
      chrome.storage.onChanged.addListener(this._settingsStorageListener);
    } catch {
      // ignore
    }
  }

  _buildCursorOptionsForState(state) {
    const s = this._settings || DEFAULT_SETTINGS;
    const mode = state?.mode;
    const hasClickableElement = !!state?.focusEl;

    // Text mode cursor selection.
    if (mode === MODES.TEXT_FOCUS) {
      const type = s?.textMode?.cursorType || DEFAULT_SETTINGS.textMode.cursorType;
      if (type === 'crosshair') {
        return { hasClickableElement };
      }
      return { cursorType: 't_square', hasClickableElement };
    }

    // Click mode cursor selection (normal + popover).
    if (mode === MODES.NONE || mode === MODES.POPOVER) {
      const type = s?.clickMode?.cursor?.type || DEFAULT_SETTINGS.clickMode.cursor.type;
      if (type === 'native_arrow') return { cursorType: 'native_arrow' };
      if (type === 'native_pointer') return { cursorType: 'native_pointer' };

      const lineWidth = Number(s?.clickMode?.cursor?.lineWidth);
      const sizePixels = Number(s?.clickMode?.cursor?.sizePixels);
      const gap = Number(s?.clickMode?.cursor?.gap);
      return {
        strokeWidth: Number.isFinite(lineWidth) ? lineWidth : DEFAULT_SETTINGS.clickMode.cursor.lineWidth,
        crossHairQuadrantWidth: Number.isFinite(sizePixels) ? sizePixels : DEFAULT_SETTINGS.clickMode.cursor.sizePixels,
        gap: Number.isFinite(gap) ? gap : DEFAULT_SETTINGS.clickMode.cursor.gap
      };
    }

    // Leave other modes (delete/highlight/etc.) at their defaults.
    return mode === MODES.HIGHLIGHT ? { strokeWidth: 4, hasClickableElement: false } : {};
  }

  async setupKeyboardHelpSync() {
    if (this._keyboardHelpStorageListener) return;
    if (!chrome?.storage) return;

    this._keyboardHelpStorageListener = (changes, areaName) => {
      if (!changes || (areaName !== 'sync' && areaName !== 'local')) return;
      if (!Object.prototype.hasOwnProperty.call(changes, this.KEYBOARD_HELP_STORAGE_KEY)) return;

      const next = Boolean(changes[this.KEYBOARD_HELP_STORAGE_KEY]?.newValue);
      // Apply without persisting again (prevents ping-pong; storage event is already the source of truth).
      this.applyKeyboardHelpVisibility(next, { persist: false });
    };

    try {
      chrome.storage.onChanged.addListener(this._keyboardHelpStorageListener);
    } catch {
      // Ignore if storage events aren't available.
    }

    const initial = await this.getKeyboardHelpVisibleFromStorage();
    this.applyKeyboardHelpVisibility(initial, { persist: false });
  }

  async refreshKeyboardHelpVisibilityFromStorage() {
    const visible = await this.getKeyboardHelpVisibleFromStorage();
    this.applyKeyboardHelpVisibility(visible, { persist: false });
  }

  async getKeyboardHelpVisibleFromStorage() {
    const key = this.KEYBOARD_HELP_STORAGE_KEY;
    try {
      const syncResult = await chrome.storage.sync.get([key]);
      if (typeof syncResult?.[key] === 'boolean') return syncResult[key];
    } catch {
      // Ignore and fall back to local.
    }

    try {
      const localResult = await chrome.storage.local.get([key]);
      if (typeof localResult?.[key] === 'boolean') return localResult[key];
    } catch {
      // Ignore.
    }

    return false;
  }

  async setKeyboardHelpVisibleInStorage(visible) {
    if (!chrome?.storage) return;
    const key = this.KEYBOARD_HELP_STORAGE_KEY;
    const payload = { [key]: Boolean(visible), timestamp: Date.now() };

    try {
      await chrome.storage.sync.set(payload);
      return;
    } catch {
      // Fall back to local.
    }

    try {
      await chrome.storage.local.set(payload);
    } catch {
      // Ignore.
    }
  }

  applyKeyboardHelpVisibility(visible, { persist = false } = {}) {
    const next = Boolean(visible);
    this._keyboardHelpVisible = next;

    // If KeyPilot is disabled, ensure the panel is not visible but remember the desired state.
    if (!this.enabled) {
      if (this.floatingKeyboardHelp) {
        try {
          this.floatingKeyboardHelp.cleanup();
        } catch { /* ignore */ }
        this.floatingKeyboardHelp = null;
      }
      if (persist) this.setKeyboardHelpVisibleInStorage(next);
      return;
    }

    try {
      const kb = this.keybindings || buildKeybindingsForLayout(DEFAULT_KEYBOARD_LAYOUT_ID);
      if (!this.floatingKeyboardHelp) {
        const FloatingKeyboardHelpClass = FloatingKeyboardHelp || window.FloatingKeyboardHelp;
        this.floatingKeyboardHelp = new FloatingKeyboardHelpClass({
          keybindings: kb,
          keyboardLayout: this._keyboardUiLayout,
          layoutId: this._keyboardLayoutId
        });
      } else {
        // Keep bindings current (in case they were updated).
        this.floatingKeyboardHelp.setKeybindings(kb);
        if (typeof this.floatingKeyboardHelp.setKeyboardLayout === 'function') {
          this.floatingKeyboardHelp.setKeyboardLayout({
            keyboardLayout: this._keyboardUiLayout,
            layoutId: this._keyboardLayoutId
          });
        }
      }

      if (next) {
        this.floatingKeyboardHelp.show();
      } else {
        this.floatingKeyboardHelp.hide();
      }

      if (persist) this.setKeyboardHelpVisibleInStorage(next);
    } catch (e) {
      console.warn('[KeyPilot] Failed to apply keyboard reference visibility:', e);
    }
  }

  /**
   * Query service worker for initial enabled state
   */
  async queryInitialState() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'KP_GET_STATE' });
      if (response && typeof response.enabled === 'boolean') {
        this.enabled = response.enabled;
        console.log('[KeyPilot] Initial state from service worker:', this.enabled ? 'enabled' : 'disabled');
      } else {
        // Default to enabled if no response or invalid response
        this.enabled = true;
        console.log('[KeyPilot] No valid state from service worker, defaulting to enabled');
      }
    } catch (error) {
      // Service worker might not be available, default to enabled
      this.enabled = true;
      console.log('[KeyPilot] Service worker not available, defaulting to enabled:', error.message);
    }
  }

  /**
   * Initialize KeyPilot in enabled state
   */
  async initializeEnabledState() {
    // Set rendering mode for focus overlays (can be 'dom', 'canvas', 'css-custom-props')
    this.overlayManager.setRenderingMode('canvas');

    // Initialize debug panel if enabled
    this.overlayManager.initDebugPanel();

    // Sync with early injection cursor state
    if (window.KEYPILOT_EARLY) {
      window.KEYPILOT_EARLY.setEnabled(true);
    }

    this.focusDetector.start();
    await this.intersectionManager.init();
    this.scrollManager.init();
    this.initializeEdgeOnlyProcessing();
    this.start();
    this.cursor.show();
  }

  /**
   * Initialize KeyPilot in disabled state
   */
  initializeDisabledState() {
    // Sync with early injection cursor state
    if (window.KEYPILOT_EARLY) {
      window.KEYPILOT_EARLY.setEnabled(false);
    }
    
    // Don't start event listeners or focus detector
    // Hide cursor
    this.cursor.hide();
    
    // Ensure overlays are hidden
    this.overlayManager.hideFocusOverlay();
    this.overlayManager.hideDeleteOverlay();
  }

  setupOptimizedEventListeners() {
    // Listen for scroll end events from optimized scroll manager
    if (!this._boundScrollEndHandler) {
      this._boundScrollEndHandler = (event) => {
        const { mouseX, mouseY } = event.detail || {};
        if (typeof mouseX !== 'number' || typeof mouseY !== 'number') return;
        // After scrolling, the viewport changes: re-seed incremental interactive discovery so RBush
        // stays locality-first without any full-document scan.
        try { this.intersectionManager?.resetDiscoveryAndSchedule?.(); } catch { /* ignore */ }
        // Prefer a cached event-derived "under element" hint to avoid a DOM hit-test on scroll-end.
        this.updateElementsUnderCursor(mouseX, mouseY, false, this._pendingMouse?.underHint || null);
      };
    }
    document.addEventListener('keypilot:scroll-end', this._boundScrollEndHandler);
    
    // Periodic performance metrics logging
    // Enable by setting window.KEYPILOT_DEBUG = true in console
    setInterval(() => {
      if (window.KEYPILOT_DEBUG) {
        this.logPerformanceMetrics();
      }
    }, 10000); // Log every 10 seconds when debug enabled

    // Performance monitoring removed
  }

  /**
   * Initialize edge-only processing for rectangle selection optimization
   */
  initializeEdgeOnlyProcessing() {
    // Check all feature flags for edge-only processing
    const edgeOnlyEnabled = FEATURE_FLAGS.USE_EDGE_ONLY_SELECTION && 
                           FEATURE_FLAGS.ENABLE_EDGE_ONLY_PROCESSING &&
                           this.edgeOnlyProcessingEnabled;

    if (!edgeOnlyEnabled) {
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Edge-only processing disabled:', {
          USE_EDGE_ONLY_SELECTION: FEATURE_FLAGS.USE_EDGE_ONLY_SELECTION,
          ENABLE_EDGE_ONLY_PROCESSING: FEATURE_FLAGS.ENABLE_EDGE_ONLY_PROCESSING,
          edgeOnlyProcessingEnabled: this.edgeOnlyProcessingEnabled
        });
      }
      return;
    }

    try {
      // Initialize rectangle intersection observer
      console.log('[KeyPilot] Initializing RectangleIntersectionObserver...');
      this.rectangleIntersectionObserver = new RectangleIntersectionObserver();
      
      if (this.rectangleIntersectionObserver) {
        console.log('[KeyPilot] RectangleIntersectionObserver initialized successfully');
      }
      
      // Initialize with callback for intersection changes
      this.rectangleIntersectionObserver.initialize((intersectionData) => {
        this.handleEdgeOnlyIntersectionChange(intersectionData);
      });
      
      // Performance monitoring is now integrated into RectangleIntersectionObserver
      // No separate initialization needed

      // Initialize highlight manager with edge-only observer and notification callback
      if (this.overlayManager && this.overlayManager.highlightManager) {
        const notificationCallback = (message, type) => {
          // Map notification types to colors
          const colorMap = {
            'success': COLORS.NOTIFICATION_SUCCESS,
            'warning': COLORS.NOTIFICATION_WARNING || COLORS.NOTIFICATION_INFO,
            'error': COLORS.NOTIFICATION_ERROR,
            'info': COLORS.NOTIFICATION_INFO
          };
          
          const backgroundColor = colorMap[type] || COLORS.NOTIFICATION_INFO;
          this.showFlashNotification(message, backgroundColor);
        };
        
        this.overlayManager.highlightManager.initializeEdgeOnlyProcessing(
          this.rectangleIntersectionObserver, 
          notificationCallback
        );
      }

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Edge-only rectangle intersection observer initialized:', {
          caching: FEATURE_FLAGS.ENABLE_SELECTION_CACHING,
          batchProcessing: FEATURE_FLAGS.ENABLE_EDGE_BATCH_PROCESSING,
          predictiveCaching: FEATURE_FLAGS.ENABLE_PREDICTIVE_CACHING
        });
      }
    } catch (error) {
      console.warn('[KeyPilot] Failed to initialize edge-only processing:', error);
      this.edgeOnlyProcessingEnabled = false;
    }
  }

  /**
   * Handle intersection changes from edge-only processing
   * @param {Object} intersectionData - Data from edge-only intersection observer
   */
  handleEdgeOnlyIntersectionChange(intersectionData) {
    if (!intersectionData || !this.state.isHighlightMode()) {
      return;
    }

    try {
      // Update selection based on edge-only intersection results
      const selection = this.rectangleIntersectionObserver.createSelectionFromIntersection();
      
      if (selection) {
        this.state.setCurrentSelection(selection);
        
        // Update visual overlays
        if (this.overlayManager && this.overlayManager.highlightManager) {
          this.overlayManager.highlightManager.updateHighlightSelectionOverlays(selection);
        }
      }

      // Log performance metrics if debugging enabled
      if (window.KEYPILOT_DEBUG && FEATURE_FLAGS.DEBUG_EDGE_ONLY_PROCESSING) {
        console.log('[KeyPilot Debug] Edge-only intersection update:', {
          intersectingElements: intersectionData.intersectingElements?.length || 0,
          intersectingTextNodes: intersectionData.intersectingTextNodes?.length || 0,
          edgeProcessing: intersectionData.edgeProcessing,
          metrics: intersectionData.metrics
        });
      }
    } catch (error) {
      console.warn('[KeyPilot] Error handling edge-only intersection change:', error);
    }
  }



  /**
   * Trigger fallback from edge-only processing to spatial method
   * @param {string} reason - Reason for fallback
   */
  triggerEdgeOnlyFallback(reason) {
    if (!this.edgeOnlyProcessingEnabled) {
      return; // Already using fallback
    }

    console.warn('[KeyPilot] Triggering edge-only processing fallback:', reason);

    // Disable edge-only processing for this session
    this.edgeOnlyProcessingEnabled = false;

    // Show user notification if enabled
    if (FEATURE_FLAGS.SHOW_SELECTION_METHOD_IN_UI) {
      this.showFlashNotification(
        'Selection method switched to spatial for better performance',
        COLORS.NOTIFICATION_INFO
      );
    }

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Edge-only processing disabled, using spatial fallback');
    }
  }

  setupContinuousCursorSync() {
    // Fallback cursor sync for problematic sites
    let lastSyncTime = 0;
    const syncCursor = () => {
      const now = Date.now();
      
      // Only sync every 16ms (60fps) to avoid performance issues
      if (now - lastSyncTime > 16) {
        const currentState = this.state.getState();
        if (currentState.lastMouse.x !== -1 && currentState.lastMouse.y !== -1) {
          // Force cursor position update
          this.cursor.updatePosition(currentState.lastMouse.x, currentState.lastMouse.y);
        }
        lastSyncTime = now;
      }
      
      // Continue syncing
      requestAnimationFrame(syncCursor);
    };
    
    // Start the sync loop
    requestAnimationFrame(syncCursor);
  }

  setupStyles() {
    this.styleManager.injectSharedStyles();
  }

  setupShadowDOMSupport() {
    this.shadowDOMManager.setup();
  }

  setupPopupCommunication() {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.type === 'KP_GET_STATUS') {
        sendResponse({ mode: this.state.getState().mode });
      } else if (msg.type === 'KP_TOGGLE_STATE' || msg.type === 'KP_UPDATE_STATE') {
        // Handle state change message from service worker
        if (typeof msg.enabled === 'boolean') {
          if (msg.enabled) {
            this.enable();
          } else {
            this.disable();
          }
        }
      } else if (msg.type === 'KP_OPEN_SETTINGS_POPOVER') {
        try {
          // Tab-local open (top frame only)
          if (window !== window.top) return;
          this.handleOpenSettingsPopover();
        } catch (e) {
          console.warn('[KeyPilot] Failed to open settings popover via message:', e);
        }
      } else if (msg.type === 'KP_OPEN_GUIDE_POPOVER') {
        try {
          // Tab-local open (top frame only)
          if (window !== window.top) return;
          this.handleOpenGuidePopover();
        } catch (e) {
          console.warn('[KeyPilot] Failed to open guide popover via message:', e);
        }
      } else if (msg.type === 'KP_OPEN_ONBOARDING') {
        try {
          // Tab-local open (top frame only)
          if (window !== window.top) return;
          // Respect disabled state: when KeyPilot is off, only Alt+K should do anything.
          try {
            const th = window.__KeyPilotToggleHandler;
            if (th && typeof th.enabled === 'boolean' && th.enabled === false) return;
          } catch { /* ignore */ }
          const ob = window.__KeyPilotOnboarding;
          if (ob && typeof ob.setActive === 'function') {
            ob.setActive(true);
          }
        } catch (e) {
          console.warn('[KeyPilot] Failed to open onboarding via message:', e);
        }
      }
    });
  }

  handleStateChange(newState, prevState) {
    // If we leave text focus mode, cancel any pending hover-click countdown.
    if (prevState.mode === MODES.TEXT_FOCUS && newState.mode !== MODES.TEXT_FOCUS) {
      this._disarmTextModeClick();
    }

    // Update cursor mode
    if (newState.mode !== prevState.mode ||
        (newState.mode === MODES.TEXT_FOCUS && newState.focusEl !== prevState.focusEl) ||
        (newState.mode === MODES.NONE && newState.focusEl !== prevState.focusEl)) {
      if (this._isCustomCursorModeEnabled()) {
        const options = this._buildCursorOptionsForState(newState);
        this.cursor.setMode(newState.mode, options);
      }
      this.updatePopupStatus(newState.mode);
    }

    // Update overlays when focused text element changes or when overlay update is triggered
    if (newState.focusedTextElement !== prevState.focusedTextElement ||
        newState._overlayUpdateTrigger !== prevState._overlayUpdateTrigger) {
      // Update overlays to show the focused text overlay
      this.updateOverlays(newState.focusEl, newState.deleteEl);
    }

    // Update visual overlays
    if (newState.focusEl !== prevState.focusEl ||
      newState.deleteEl !== prevState.deleteEl) {
      this.updateOverlays(newState.focusEl, newState.deleteEl);
    }
  }

  _isCustomCursorModeEnabled() {
    const mode = this._settings?.cursorMode || DEFAULT_SETTINGS.cursorMode;
    return mode === CURSOR_MODE.CUSTOM_CURSORS;
  }

  updatePopupStatus(mode) {
    try {
      // Only the top frame should push status updates to the extension popup.
      // If we run KeyPilot inside a popover iframe, sending KP_STATUS from that frame
      // would overwrite the popup UI with the iframe's mode.
      if (window !== window.top) return;
      chrome.runtime.sendMessage({ type: 'KP_STATUS', mode });
    } catch (error) {
      // Popup might not be open
    }
  }

  handleKeyDown(e) {
    // Handle Alt+K toggle FIRST, regardless of extension state
    // Check for Alt key (covers both left and right Alt) and K key (case insensitive)
    if ((e.altKey || e.code === 'AltRight') && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) {
      // Mark the event so any other KeyPilot-installed listeners don't double-toggle.
      try { e.__kpToggleHandled = true; } catch { /* ignore */ }
      e.preventDefault();
      e.stopPropagation();
      // Important: stop other document-level keydown capture listeners from also firing,
      // which could otherwise trigger a second toggle and effectively do nothing.
      e.stopImmediatePropagation();
      // Send toggle message to background script
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'KP_TOGGLE_STATE' }).catch(() => {
          // Ignore errors if background script is not available
        });
      }
      return;
    }

    // Alt+L: open omnibox (top frame only)
    if ((e.altKey || e.code === 'AltRight') && (e.key === 'l' || e.key === 'L' || e.code === 'KeyL')) {
      // Only operate in the top frame to avoid duplicates.
      if (window !== window.top) return;
      // Respect enabled state (do nothing when disabled).
      if (!this.enabled) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const currentState = this.state.getState();
      if (currentState.mode === MODES.OMNIBOX) {
        this.handleCloseOmnibox();
      } else {
        this.handleOpenOmnibox();
      }
      return;
    }

    // Don't handle keys if extension is disabled
    if (!this.enabled) {
      return;
    }

    // Debug key presses
    console.log('[KeyPilot] Key pressed:', e.key, 'Code:', e.code);

    // Don't interfere with modifier key combinations (Cmd+C, Ctrl+V, etc.)
    if (this.hasModifierKeys(e)) {
      return;
    }

    const currentState = this.state.getState();
    const KB = this.keybindings || {};

    // Global default: Escape closes the frontmost "popover-like" UI.
    // Priority: omnibox (always visually on top) → PopupManager (topmost modal panel).
    if (KB.CANCEL?.keys?.includes?.(e.key)) {
      // Omnibox
      try {
        if (currentState.mode === MODES.OMNIBOX || this.omniboxManager?.isOpen?.()) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.handleCloseOmnibox();
          return;
        }
      } catch { /* ignore */ }

      // Popup stack (iframe popovers, settings/guide, etc.)
      try {
        const pm = this.overlayManager?.popupManager;
        if (pm?.isOpen?.()) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          pm.requestCloseTop?.();
          return;
        }
      } catch { /* ignore */ }
    }

    // If omnibox is open, let its input handler do the work.
    if (currentState.mode === MODES.OMNIBOX) {
      // Escape should always close omnibox.
      if (KB.CANCEL?.keys?.includes?.(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleCloseOmnibox();
      }
      return;
    }

    // Check if popover is open
    if (currentState.mode === MODES.POPOVER) {
      console.log('[KeyPilot] Popover mode active, key pressed:', e.key);
      
      // Escape should close the popover (always, regardless of where it's pressed)
      if (KB.CANCEL?.keys?.includes?.(e.key)) {
        console.log('[KeyPilot] Escape key pressed while popover open');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleClosePopover();
        return;
      }

      // Scroll shortcuts should scroll the popover iframe (not the parent page)
      // This path covers cases where focus is still in the parent document.
      if (KB.PAGE_UP?.keys?.includes?.(e.key)) {
        e.preventDefault();
        this.overlayManager?.scrollPopoverBy?.(-800, 'smooth');
        return;
      }
      if (KB.PAGE_DOWN?.keys?.includes?.(e.key)) {
        e.preventDefault();
        this.overlayManager?.scrollPopoverBy?.(800, 'smooth');
        return;
      }
      if (KB.PAGE_UP_INSTANT?.keys?.includes?.(e.key)) {
        e.preventDefault();
        this.overlayManager?.scrollPopoverBy?.(-400, 'smooth');
        return;
      }
      if (KB.PAGE_DOWN_INSTANT?.keys?.includes?.(e.key)) {
        e.preventDefault();
        this.overlayManager?.scrollPopoverBy?.(400, 'smooth');
        return;
      }
      if (KB.PAGE_TOP?.keys?.includes?.(e.key)) {
        e.preventDefault();
        this.overlayManager?.scrollPopoverToTop?.('smooth');
        return;
      }
      if (KB.PAGE_BOTTOM?.keys?.includes?.(e.key)) {
        e.preventDefault();
        this.overlayManager?.scrollPopoverToBottom?.('smooth');
        return;
      }

      // Allow click keys to interact with popover UI (e.g. the × close button).
      // Popovers are normal z-index layers (not the browser top-layer), so the
      // green rectangle + F-to-click should work again.
      if (KB.ACTIVATE?.keys?.includes?.(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleActivateKey();
        return;
      }
      if (KB.ACTIVATE_NEW_TAB?.keys?.includes?.(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleActivateNewTabKey();
        return;
      }
      if (KB.ACTIVATE_NEW_TAB_OVER?.keys?.includes?.(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleActivateNewTabOverKey();
        return;
      }

      // For all other keys when popover is open, let them pass through to the iframe
      // Don't prevent default so the iframe can handle navigation keys
      console.log('[KeyPilot] Letting key pass through to popover/iframe');
      return;
    }

    // In text focus mode:
    // - ESC exits text focus (never clicks)
    // - Only F can click, and only when armed by mouse movement
    if (currentState.mode === MODES.TEXT_FOCUS) {
      if (KB.CANCEL?.keys?.includes?.(e.key)) {
        console.debug('Escape key detected in text focus mode');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleEscapeFromTextFocus(currentState);
        return;
      }

      if (KB.ACTIVATE?.keys?.includes?.(e.key) && this._textModeClickArmed && currentState.focusEl) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this._handleActivateFromTextFocus(currentState);
        return;
      }
      return;
    }

    // Don't handle keys if we're in a typing context but not in our text focus mode
    // (This handles edge cases where focus detection might miss something)
    if (this.isTypingContext(e.target)) {
      if (KB.CANCEL?.keys?.includes?.(e.key)) {
        this.cancelModes();
      }
      return;
    }

    // Special handling for highlight mode - cancel on any key except H and ESC
    if (currentState.mode === MODES.HIGHLIGHT) {
      if (KB.CANCEL?.keys?.includes?.(e.key)) {
        // ESC key cancellation in highlight mode
        e.preventDefault();
        this.cancelHighlightMode();
        return;
      } else if (KB.HIGHLIGHT?.keys?.includes?.(e.key)) {
        // H key - complete the selection
        e.preventDefault();
        this.handleHighlightKey();
        return;
      } else if (KB.RECTANGLE_HIGHLIGHT?.keys?.includes?.(e.key)) {
        // R key - complete the selection (same as H key in highlight mode)
        e.preventDefault();
        this.completeSelection();
        return;
      } else {
        // Any other key - cancel highlight mode and let the key execute its normal function
        this.cancelHighlightMode();
        // Don't prevent default - allow the functional key to execute after canceling
        // Fall through to handle the key normally
      }
    }

    // Handle our keyboard shortcuts (table-driven via KEYBINDINGS.*.handler)
    for (const keybinding of Object.values(KB)) {
      if (!keybinding?.handler || !Array.isArray(keybinding.keys)) continue;

      const matchOn = Array.isArray(keybinding.matchOn) ? keybinding.matchOn : ['key'];
      const isMatch = matchOn.some((field) => keybinding.keys.includes(e[field]));
      if (!isMatch) continue;

      e.preventDefault();
      // Critical: when KeyPilot claims a key, we must fully consume it so page-level
      // shortcuts (e.g. Internet Archive BookReader 'f' fullscreen) don't also fire.
      // We use stopImmediatePropagation() to prevent other listeners on the same target
      // from running (including other capture listeners).
      e.stopPropagation();
      e.stopImmediatePropagation();

      const handlerFn = this[keybinding.handler];
      if (typeof handlerFn === 'function') {
        handlerFn.call(this);
      } else {
        console.warn('[KeyPilot] Missing keybinding handler:', keybinding.handler, keybinding);
      }
      return;
    }
  }

  handleMouseMove(e) {
    // Don't handle mouse events if extension is disabled
    if (!this.enabled) {
      return;
    }

    // Store mouse position immediately to prevent sync issues
    const x = e.clientX;
    const y = e.clientY;
    
    this.state.setMousePosition(x, y);
    this.cursor.updatePosition(x, y);

    // Update current mouse position in coordinate manager for beforeunload storage
    this.mouseCoordinateManager.updateCurrentMousePosition(x, y);

    // Coalesce hover detection to once-per-frame to avoid doing hit-testing at high mouse Hz.
    // Also extract an "under element" hint from the event path so we can skip elementFromPoint.
    this._pendingMouse.x = x;
    this._pendingMouse.y = y;
    this._pendingMouse.underHint = this._getUnderElementHintFromMouseEvent(e);

    if (this._mouseMoveRAF) return;
    this._mouseMoveRAF = window.requestAnimationFrame(() => {
      this._mouseMoveRAF = 0;
      if (!this.enabled) return;
      // Use optimized element detection with threshold (tagged as real mouse-move)
      this.updateElementsUnderCursorWithThreshold(
        this._pendingMouse.x,
        this._pendingMouse.y,
        true,
        this._pendingMouse.underHint
      );
    });
  }

  handleScroll(e) {
    // Don't handle scroll events if extension is disabled
    if (!this.enabled) {
      return;
    }

    // Delegate scroll handling to optimized scroll manager
    // The scroll manager handles all the optimization logic
    return; // OptimizedScrollManager handles scroll events directly
  }

  updateElementsUnderCursorWithThreshold(x, y, fromMouseMove = false, underHint = null) {
    // Check if mouse has moved enough to warrant a new query
    const deltaX = Math.abs(x - this.lastQueryPosition.x);
    const deltaY = Math.abs(y - this.lastQueryPosition.y);

    if (deltaX < this.MOUSE_QUERY_THRESHOLD && deltaY < this.MOUSE_QUERY_THRESHOLD) {
      // Mouse hasn't moved enough, skip the query entirely
      // No need to check cursor consistency when mouse is idle - cursor should remain stable
      return;
    }

    // Update last query position
    this.lastQueryPosition.x = x;
    this.lastQueryPosition.y = y;

    // Perform the actual element query
    this.updateElementsUnderCursor(x, y, fromMouseMove, underHint);
  }


  updateElementsUnderCursor(x, y, fromMouseMove = false, underHint = null) {
    const currentState = this.state.getState();

    this.performanceMetrics.mouseQueries++;

    // ---- Mousemove hot-path optimization ----
    // We used to always do `deepElementFromPoint()` (DOM hit-test) then map to a clickable element.
    // When the RBush spatial index is ready, we can often pick the best candidate without any DOM
    // hit-testing at all, which is a large perf win on pages with heavy layout / shadow DOM.
    //
    // Correctness note:
    // - RBush is a bbox pre-filter. In rare cases (overlaps, complex shapes), `elementFromPoint`
    //   can be more accurate. We still fall back to the DOM hit-test when needed.
    const inPopoverMode = currentState.mode === MODES.POPOVER;
    const inDeleteMode = this.state.isDeleteMode();

    let under = null;
    let clickable = null;

    // Generalized occlusion strategy:
    // - Use RBush only as a fast bbox pre-filter.
    // - Use a single DOM hit-test (`deepElementFromPoint`) to respect third-party overlays
    //   (menus, dialogs, lightboxes, etc.). We only accept RBush candidates that are on the
    //   ancestor chain of the hit-tested topmost element.
    //
    // This prevents “clicking through” overlays even when RBush still contains elements behind them.
    const canUseOcclusionGatedRBush = fromMouseMove && !inDeleteMode && !inPopoverMode;
    if (canUseOcclusionGatedRBush) {
      try {
        // Prefer event-derived target (composedPath) to avoid a DOM hit-test on the hot path.
        under = underHint || null;
        if (!under) under = this.detector.deepElementFromPoint(x, y);
        if (this.intersectionManager &&
            typeof this.intersectionManager.queryInteractiveAtPoint === 'function' &&
            typeof this.intersectionManager.pickBestInteractiveFromCandidates === 'function') {
          const candidates = this.intersectionManager.queryInteractiveAtPoint(x, y, 0);
          // If we couldn't determine an "under" element, we can still do a best-effort pick.
          clickable = this.intersectionManager.pickBestInteractiveFromCandidates(candidates, under);
        }
      } catch { /* ignore */ }
    }

    // If RBush didn't yield a candidate (or we require exactness), use traditional hit-testing.
    if (!clickable || inDeleteMode || inPopoverMode) {
      // Use traditional element detection for accuracy
      if (!under) under = underHint || null;
      if (!under) under = this.detector.deepElementFromPoint(x, y);

      // Prefer RBush selection gated by `under` to avoid “click through”.
      try {
        if (!clickable &&
            this.intersectionManager &&
            typeof this.intersectionManager.queryInteractiveAtPoint === 'function' &&
            typeof this.intersectionManager.pickBestInteractiveFromCandidates === 'function') {
          const candidates = this.intersectionManager.queryInteractiveAtPoint(x, y, 0);
          clickable = this.intersectionManager.pickBestInteractiveFromCandidates(candidates, under);
        }
      } catch { /* ignore */ }

      if (!clickable) {
        try {
          if (this.intersectionManager?.metrics) this.intersectionManager.metrics.rtreeFallbacks++;
        } catch { /* ignore */ }
        clickable = this.detector.findClickable(under);
      }
    }

    // Popover mode is modal: only track elements inside the popover UI.
    // This prevents the green rectangle from following the background page.
    if (currentState.mode === MODES.POPOVER) {
      const popoverContainer = this.overlayManager?.popoverContainer;
      const isInsidePopover = (el) => {
        try {
          if (!popoverContainer || !(popoverContainer instanceof Element)) return false;
          if (!el || !(el instanceof Element)) return false;
          return popoverContainer.contains(el);
        } catch {
          return false;
        }
      };

      if (!isInsidePopover(under)) clickable = null;
      else if (clickable && !isInsidePopover(clickable)) clickable = null;

      // When the pointer is over the popover iframe, the top document can only "see" the <iframe>,
      // not the elements inside it. Highlighting the iframe border is distracting and misleading
      // (actual interaction happens inside the iframe document), so suppress hover focus on iframes.
      try {
        if (under && under.tagName === 'IFRAME') clickable = null;
        if (clickable && clickable.tagName === 'IFRAME') clickable = null;
      } catch { /* ignore */ }
    }
    
    // In text focus mode, exclude the currently focused text element from being considered clickable
    if (currentState.mode === MODES.TEXT_FOCUS && currentState.focusedTextElement && clickable === currentState.focusedTextElement) {
      clickable = null;
    }

    // In text focus mode, only arm hover-click UI on real mouse movement.
    // Any other refresh paths (scroll-end, post-click refresh, etc.) should not arm clicks.
    if (currentState.mode === MODES.TEXT_FOCUS && !fromMouseMove) {
      // Ensure we don't stay armed without user intention.
      if (this._textModeClickArmed || currentState.focusEl) {
        this._disarmTextModeClick();
        if (currentState.focusEl) this.state.setFocusElement(null);
      } else {
        try { this.overlayManager?.setHoverClickLabelText?.('F clicks'); } catch { /* ignore */ }
      }

      // Clear delete element when not in delete mode
      if (currentState.deleteEl) this.state.setDeleteElement(null);
      return;
    }
    
    // Track with intersection manager for performance metrics and caching.
    // Pass through computed values to avoid redundant deepElementFromPoint() work on the hot mousemove path.
    // Note: `under` may be null when we used the RBush fast-path.
    this.intersectionManager.trackElementAtPoint(x, y, under, clickable);

    // Debug logging when debug mode is enabled
    if (window.KEYPILOT_DEBUG && clickable) {
      console.log('[KeyPilot Debug] Found clickable element:', {
        tagName: clickable.tagName,
        href: clickable.href,
        className: clickable.className,
        text: clickable.textContent?.substring(0, 50),
        mode: currentState.mode
      });
    }

    // Reduce overlay churn: only update state if focus element actually changed.
    if (clickable !== currentState.focusEl) {
      this.state.setFocusElement(clickable);
    }

    // In text focus mode, (re)arm countdown on mouse-move hover changes.
    if (currentState.mode === MODES.TEXT_FOCUS) {
      if (clickable) {
        if (!this._textModeClickArmed || this._textModeClickArmedTarget !== clickable) {
          this._armTextModeClick(clickable);
        }
      } else {
        this._disarmTextModeClick();
      }
    }

    if (this.state.isDeleteMode()) {
      // For delete mode, we need the exact element under cursor, not just clickable
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Delete mode - setting delete element:', {
          tagName: under?.tagName,
          className: under?.className,
          id: under?.id
        });
      }
      if (under !== currentState.deleteEl) {
        this.state.setDeleteElement(under);
      }
    } else {
      // Clear delete element when not in delete mode
      if (currentState.deleteEl) {
        this.state.setDeleteElement(null);
      }
    }

    // Update text selection in highlight mode
    if (this.state.isHighlightMode()) {
      this.updateSelection();
    }
  }

  handlePageUp() {
    // Scroll up one page smoothly
    window.scrollBy({
      top: -800,
      behavior: 'smooth'
    });
  }

  handlePageDown() {
    // Scroll down one page smoothly
    window.scrollBy({
      top: 800,
      behavior: 'smooth'
    });
  }

  handleInstantPageUp() {
    // Scroll down half of what V is (400px) smoothly
    window.scrollBy({
      top: -400,
      behavior: 'smooth'
    });
    this.emitAction('scrollUp');
  }

  handleInstantPageDown() {
    // Scroll up half of what C is smoothly
    window.scrollBy({
      top: 400,
      behavior: 'smooth'
    });
    this.emitAction('scrollDown');
  }

  handlePageTop() {
    // Scroll to top of page (Home key equivalent)
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    this.emitAction('scrollTop');
  }

  handlePageBottom() {
    // Scroll to bottom of page (End key equivalent)
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    });
    this.emitAction('scrollBottom');
  }

  handleBackKey() {
    // Emit BEFORE navigating away so onboarding (and other listeners) can observe/persist it.
    this.emitAction('back');

    // Also record a transient action via the service worker so onboarding can recover
    // even if the content-script unloads before async storage writes complete.
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'KP_TRANSIENT_ACTION', action: 'back', timestamp: Date.now() }).catch(() => {});
      }
    } catch {
      // ignore
    }

    // Defer the actual navigation slightly so async persistence has a chance to start.
    // (This prevents "checkbox flashes then unchecks" when the content-script tears down mid-write.)
    try {
      setTimeout(() => {
        try {
          history.back();
        } catch {
          // ignore
        }
      }, 30);
    } catch {
      try {
        history.back();
      } catch {
        // ignore
      }
    }
  }

  handleForwardKey() {
    history.forward();
  }

  handleTabLeftKey() {
    // Switch to the tab to the left
    chrome.runtime.sendMessage({ type: 'KP_TAB_LEFT' });
    this.emitAction('tabLeft');
  }

  handleTabRightKey() {
    // Switch to the tab to the right
    chrome.runtime.sendMessage({ type: 'KP_TAB_RIGHT' });
    this.emitAction('tabRight');
  }

  handleDeleteKey() {
    const currentState = this.state.getState();

    if (!this.state.isDeleteMode()) {
      console.log('[KeyPilot] Entering delete mode');
      this.state.setMode(MODES.DELETE);
    } else {
      const victim = currentState.deleteEl ||
        this.detector.deepElementFromPoint(currentState.lastMouse.x, currentState.lastMouse.y);

      console.log('[KeyPilot] Deleting element:', victim);
      this.cancelModes();
      this.deleteElement(victim);
    }
  }

  handleHighlightKey() {
    const currentState = this.state.getState();

    // Prevent highlight mode activation in text focus mode
    if (currentState.mode === MODES.TEXT_FOCUS) {
      console.log('[KeyPilot] H key ignored - currently in text focus mode');
      return;
    }

    if (!this.state.isHighlightMode()) {
      console.log('[KeyPilot] Entering highlight mode');
      
      // Cancel delete mode if active
      if (this.state.isDeleteMode()) {
        console.log('[KeyPilot] Canceling delete mode to enter highlight mode');
      }
      
      // Enter highlight mode and start highlighting at current cursor position
      this.state.setMode(MODES.HIGHLIGHT);
      
      // Set default selection mode to character-level
      this.overlayManager.setSelectionMode('character');
      
      this.startHighlighting();
    } else {
      console.log('[KeyPilot] Completing highlight selection');
      this.completeSelection();
    }
  }

  handleRectangleHighlightKey() {
    const currentState = this.state.getState();

    // Prevent highlight mode activation in text focus mode
    if (currentState.mode === MODES.TEXT_FOCUS) {
      console.log('[KeyPilot] R key ignored - currently in text focus mode');
      return;
    }

    if (!this.state.isHighlightMode()) {
      console.log('[KeyPilot] Entering rectangle highlight mode');
      
      // Cancel delete mode if active
      if (this.state.isDeleteMode()) {
        console.log('[KeyPilot] Canceling delete mode to enter rectangle highlight mode');
      }
      
      // Enter highlight mode and start rectangle highlighting at current cursor position
      this.state.setMode(MODES.HIGHLIGHT);
      
      // Set selection mode to rectangle
      this.overlayManager.setSelectionMode('rectangle');
      
      this.startHighlighting();
    } else {
      console.log('[KeyPilot] Completing rectangle highlight selection');
      this.completeSelection();
    }
  }

  startHighlighting() {
    const currentState = this.state.getState();
    const selectionMode = this.overlayManager.getSelectionMode();
    
    // Convert viewport coordinates to document coordinates for scroll-independent selection
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    const startPosition = {
      x: currentState.lastMouse.x + scrollX, // Document coordinate
      y: currentState.lastMouse.y + scrollY, // Document coordinate
      viewportX: currentState.lastMouse.x,   // Keep viewport coordinate for reference
      viewportY: currentState.lastMouse.y,   // Keep viewport coordinate for reference
      element: this.detector.deepElementFromPoint(currentState.lastMouse.x, currentState.lastMouse.y)
    };

    console.log('[KeyPilot] Starting text selection at:', startPosition, 'Mode:', selectionMode);
    this.state.setHighlightStartPosition(startPosition);

    if (selectionMode === 'character') {
      // Start character-level selection
      const success = this.overlayManager.startCharacterSelection(
        { x: currentState.lastMouse.x, y: currentState.lastMouse.y },
        this.findTextNodeAtPosition.bind(this),
        this.getTextOffsetAtPosition.bind(this)
      );

      if (success) {
        console.log('[KeyPilot] Character selection started successfully');
        return;
      } else {
        console.log('[KeyPilot] Character selection failed, falling back to rectangle mode');
        this.overlayManager.setSelectionMode('rectangle');
      }
    }

    // Rectangle selection mode (default fallback)

    // Initialize edge-only processing for highlight mode if enabled
    if (this.edgeOnlyProcessingEnabled && 
        this.rectangleIntersectionObserver && 
        FEATURE_FLAGS.USE_EDGE_ONLY_SELECTION &&
        FEATURE_FLAGS.ENABLE_EDGE_ONLY_PROCESSING) {
      
      try {
        // Initialize rectangle at starting position (zero size initially)
        const initialRect = {
          left: startPosition.x,
          top: startPosition.y,
          width: 0,
          height: 0
        };
        
        this.rectangleIntersectionObserver.updateRectangle(initialRect);
        
        if (window.KEYPILOT_DEBUG && FEATURE_FLAGS.DEBUG_EDGE_ONLY_PROCESSING) {
          console.log('[KeyPilot Debug] Edge-only processing initialized for highlight mode:', {
            startPosition: startPosition,
            initialRect: initialRect,
            caching: FEATURE_FLAGS.ENABLE_SELECTION_CACHING,
            batchProcessing: FEATURE_FLAGS.ENABLE_EDGE_BATCH_PROCESSING
          });
        }
      } catch (error) {
        console.warn('[KeyPilot] Error initializing edge-only processing for highlight mode:', error);
        
        // Fall back to spatial method if edge-only initialization fails
        if (FEATURE_FLAGS.ENABLE_AUTOMATIC_FALLBACK) {
          console.log('[KeyPilot] Falling back to spatial selection method');
          this.edgeOnlyProcessingEnabled = false;
        }
      }
    }

    // Initialize text selection at cursor position with comprehensive error handling
    try {
      const textNode = this.findTextNodeAtPosition(startPosition.x, startPosition.y);
      if (textNode) {
        // Create range using appropriate document context with error handling
        const ownerDocument = textNode.ownerDocument || document;
        
        // Validate document context
        if (!ownerDocument || typeof ownerDocument.createRange !== 'function') {
          throw new Error('Invalid document context for range creation');
        }
        
        const range = ownerDocument.createRange();
        const offset = this.getTextOffsetAtPosition(textNode, startPosition.x, startPosition.y);
        
        // Validate offset with bounds checking
        const textLength = textNode.textContent ? textNode.textContent.length : 0;
        if (textLength === 0) {
          throw new Error('Text node has no content');
        }
        
        const validOffset = Math.max(0, Math.min(offset, textLength));
        
        // Set range start position with error handling
        try {
          range.setStart(textNode, validOffset);
          range.setEnd(textNode, validOffset);
        } catch (rangeError) {
          throw new Error(`Failed to set range position: ${rangeError.message}`);
        }
        
        // Get appropriate selection object with validation
        const selection = this.getSelectionForDocument(ownerDocument);
        if (!selection) {
          throw new Error('Could not get selection object for document context');
        }
        
        // Validate selection API availability
        if (typeof selection.removeAllRanges !== 'function' || typeof selection.addRange !== 'function') {
          throw new Error('Selection API methods not available');
        }
        
        // Clear any existing selection and set new range with error handling
        try {
          selection.removeAllRanges();
          selection.addRange(range);
        } catch (selectionError) {
          throw new Error(`Failed to set selection range: ${selectionError.message}`);
        }
        
        // Store the selection for updates
        this.state.setCurrentSelection(selection);
        
        // Initialize visual selection overlays with error handling
        try {
          this.overlayManager.updateHighlightSelectionOverlays(selection);
        } catch (overlayError) {
          console.warn('[KeyPilot] Error updating selection overlays:', overlayError);
          // Continue without visual overlays - selection still works
        }
        
        console.log('[KeyPilot] Text selection initialized successfully at offset:', validOffset);
      } else {
        console.log('[KeyPilot] No text node found at position, selection will start when cursor moves to text');
        // This is not an error - just no selectable content at current position
      }
    } catch (error) {
      console.error('[KeyPilot] Error initializing text selection:', error);
      
      // Show user-friendly error message
      this.showFlashNotification(
        'Unable to start text selection at this position', 
        COLORS.NOTIFICATION_ERROR
      );
      
      // Don't exit highlight mode - user can try moving cursor to different position
      // Continue without selection - will try again when cursor moves
    }
  }

  updateSelection() {
    const currentState = this.state.getState();
    const startPos = currentState.highlightStartPosition;
    const selectionMode = this.overlayManager.getSelectionMode();
    
    if (!startPos) {
      console.warn('[KeyPilot] No start position for selection update');
      return;
    }

    const currentPos = {
      x: currentState.lastMouse.x,
      y: currentState.lastMouse.y
    };

    // Performance optimization: skip update if cursor hasn't moved much
    // Use viewport coordinates for consistent comparison (both currentPos and startPos.viewportX/Y are viewport coords)
    const startViewportX = startPos.viewportX || startPos.x;
    const startViewportY = startPos.viewportY || startPos.y;
    const deltaX = Math.abs(currentPos.x - startViewportX);
    const deltaY = Math.abs(currentPos.y - startViewportY);
    
    // Use smaller threshold to ensure selection appears immediately
    if (deltaX < 1 && deltaY < 1) {
      return; // Cursor hasn't moved enough to warrant an update
    }

    if (selectionMode === 'character') {
      // Update character-level selection with rectangle overlay
      const startPosForOverlay = {
        x: startViewportX,
        y: startViewportY
      };
      
      try {
        this.overlayManager.updateCharacterSelection(
          currentPos,
          startPosForOverlay,
          this.findTextNodeAtPosition.bind(this),
          this.getTextOffsetAtPosition.bind(this)
        );
      } catch (error) {
        console.warn('[KeyPilot] Error updating character selection:', error);
      }
      return;
    }

    // Rectangle selection mode
    // Update the highlight rectangle overlay to show selection area
    // Use viewport coordinates for overlay positioning (overlays use fixed positioning)
    const startPosForOverlay = {
      x: startViewportX,
      y: startViewportY
    };
    
    try {
      this.overlayManager.updateHighlightRectangleOverlay(startPosForOverlay, currentPos);
    } catch (overlayError) {
      console.warn('[KeyPilot] Error updating highlight rectangle overlay:', overlayError);
    }

    try {
      // Use edge-only processing if available and enabled
      if (this.edgeOnlyProcessingEnabled && 
          this.rectangleIntersectionObserver && 
          FEATURE_FLAGS.USE_EDGE_ONLY_SELECTION &&
          FEATURE_FLAGS.ENABLE_EDGE_ONLY_PROCESSING) {
        
        // Edge-only processing is handled by the highlight manager's updateHighlightRectangleOverlay
        // which calls updateEdgeOnlyProcessingRectangle automatically
        
        // Get selection from edge-only processing
        const selection = this.overlayManager.highlightManager.getEdgeOnlySelection();
        
        if (selection) {
          this.state.setCurrentSelection(selection);
          
          // Update visual selection overlays
          try {
            this.overlayManager.updateHighlightSelectionOverlays(selection);
          } catch (overlayError) {
            console.warn('[KeyPilot] Error updating selection overlays:', overlayError);
          }

          if (window.KEYPILOT_DEBUG && FEATURE_FLAGS.DETAILED_EDGE_LOGGING) {
            console.log('[KeyPilot Debug] Edge-only selection updated:', {
              selectedText: selection.toString().substring(0, 100),
              rangeCount: selection.rangeCount
            });
          }
        } else {
          // Clear selection if no valid selection from edge-only processing
          this.clearSelectionSafely();
          try {
            this.overlayManager.clearHighlightSelectionOverlays();
          } catch (overlayError) {
            console.warn('[KeyPilot] Error clearing selection overlays:', overlayError);
          }
        }
      } else {
        // Fall back to rectangle-based selection (spatial method)
        if (window.KEYPILOT_DEBUG && FEATURE_FLAGS.ENABLE_AUTOMATIC_FALLBACK) {
          console.log('[KeyPilot Debug] Using spatial fallback method for rectangle selection');
        }

        const selectionResult = this.createRectangleBasedSelection(startPos, currentPos);
        
        if (selectionResult && selectionResult.success && selectionResult.selection) {
          // Validate selection before storing
          try {
            const selectedText = selectionResult.selection.toString();
            if (selectedText !== null && selectedText !== undefined) {
              // Store updated selection
              this.state.setCurrentSelection(selectionResult.selection);
              
              // Update visual selection overlays for real-time feedback with error handling
              try {
                this.overlayManager.updateHighlightSelectionOverlays(selectionResult.selection);
              } catch (overlayError) {
                console.warn('[KeyPilot] Error updating selection overlays:', overlayError);
              }
            }
          } catch (validationError) {
            console.warn('[KeyPilot] Error validating selection:', validationError);
          }
        } else {
          // Clear selection if no valid selection could be created
          this.clearSelectionSafely();
          try {
            this.overlayManager.clearHighlightSelectionOverlays();
          } catch (overlayError) {
            console.warn('[KeyPilot] Error clearing selection overlays:', overlayError);
          }
        }
      }
    } catch (error) {
      console.error('[KeyPilot] Unexpected error updating selection:', error);
      
      // Show user-friendly error message for unexpected errors
      this.showFlashNotification(
        'Selection update failed - try moving cursor', 
        COLORS.NOTIFICATION_ERROR
      );
      
      // Clear selection on error but stay in highlight mode
      this.clearSelectionSafely();
      try {
        this.overlayManager.clearHighlightSelectionOverlays();
      } catch (overlayError) {
        console.warn('[KeyPilot] Error clearing overlays after unexpected error:', overlayError);
      }
    }
  }

  /**
   * Create a selection across potentially different document boundaries
   * @param {Text} startNode - Starting text node
   * @param {Object} startPos - Starting position with x, y coordinates
   * @param {Text} currentNode - Current text node
   * @param {Object} currentPos - Current position with x, y coordinates
   * @returns {Object} - Result object with success flag, selection, and metadata
   */
  createCrossBoundarySelection(startNode, startPos, currentNode, currentPos) {
    try {
      // Check if nodes are in the same document context
      const startDocument = startNode.ownerDocument || document;
      const currentDocument = currentNode.ownerDocument || document;
      const sameDocument = startDocument === currentDocument;
      
      // For cross-frame content, we can only select within the same document
      if (!sameDocument) {
        console.warn('[KeyPilot] Cross-frame selection not supported, limiting to current document');
        // Try to select within the current document only
        return this.createSingleDocumentSelection(currentNode, currentPos, currentNode, currentPos);
      }
      
      // Check if nodes are in different shadow DOM contexts
      const startRoot = this.getShadowRoot(startNode);
      const currentRoot = this.getShadowRoot(currentNode);
      const crossBoundary = startRoot !== currentRoot;
      
      if (crossBoundary) {
        // Handle cross-shadow-boundary selection
        return this.createCrossShadowSelection(startNode, startPos, currentNode, currentPos);
      } else {
        // Same document and shadow context - use standard selection
        return this.createSingleDocumentSelection(startNode, startPos, currentNode, currentPos);
      }
      
    } catch (error) {
      console.warn('[KeyPilot] Error creating cross-boundary selection:', error);
      return { success: false, selection: null, crossBoundary: false };
    }
  }

  /**
   * Create rectangle-based selection that includes all text nodes within the rectangle
   * @param {Object} startPos - Starting position with x, y coordinates
   * @param {Object} currentPos - Current position with x, y coordinates
   * @returns {Object} - Result object with success flag and selection
   */
  createRectangleBasedSelection(startPos, currentPos) {
    try {
      // Convert current viewport position to document coordinates for scroll-independent selection
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      
      const currentDocX = currentPos.x + scrollX;
      const currentDocY = currentPos.y + scrollY;
      
      // Calculate rectangle bounds in document coordinates
      // This ensures the selection stays fixed to document content even if page scrolls
      const rect = {
        left: Math.min(startPos.x, currentDocX),
        top: Math.min(startPos.y, currentDocY),
        right: Math.max(startPos.x, currentDocX),
        bottom: Math.max(startPos.y, currentDocY)
      };

      // Check if rectangle is too large (optional performance safeguard)
      const rectWidth = rect.right - rect.left;
      const rectHeight = rect.bottom - rect.top;
      const rectArea = rectWidth * rectHeight;
      
      if (RECTANGLE_SELECTION.ENABLE_AREA_LIMIT && rectArea > RECTANGLE_SELECTION.MAX_AREA_PIXELS) {
        console.warn('[KeyPilot] Selection rectangle too large, limiting for performance:', {
          area: rectArea,
          maxArea: RECTANGLE_SELECTION.MAX_AREA_PIXELS,
          dimensions: `${rectWidth}x${rectHeight}`
        });
        this.showFlashNotification('Selection too large - try smaller area', COLORS.NOTIFICATION_WARNING);
        return { success: false, selection: null, crossBoundary: false };
      }

      // Find all text nodes within the rectangle
      const textNodesInRect = this.findTextNodesForSelection(rect);
      
      if (textNodesInRect.length === 0) {
        return { success: false, selection: null, crossBoundary: false };
      }
      
      // Additional safety check after finding nodes (DOM traversal performance)
      if (RECTANGLE_SELECTION.ENABLE_NODE_LIMIT && textNodesInRect.length > RECTANGLE_SELECTION.MAX_TEXT_NODES) {
        console.warn('[KeyPilot] Too many text nodes found, limiting selection for DOM performance:', {
          nodeCount: textNodesInRect.length,
          maxNodes: RECTANGLE_SELECTION.MAX_TEXT_NODES
        });
        this.showFlashNotification(`Selection contains too many elements (${textNodesInRect.length})`, COLORS.NOTIFICATION_WARNING);
        return { success: false, selection: null, crossBoundary: false };
      }

      // Sort text nodes by document order
      textNodesInRect.sort((a, b) => {
        const comparison = a.compareDocumentPosition(b);
        if (comparison & Node.DOCUMENT_POSITION_FOLLOWING) {
          return -1; // a comes before b
        } else if (comparison & Node.DOCUMENT_POSITION_PRECEDING) {
          return 1; // a comes after b
        }
        return 0; // same node or no clear order
      });

      // Final filter using DOM API - should be minimal since TreeWalker already filtered
      const filteredNodes = textNodesInRect.filter(node => {
        const parent = node.parentElement;
        if (!parent) return false;
        
        // Use DOM API for final safety check - this should be very fast
        if (parent instanceof HTMLScriptElement ||
            parent instanceof HTMLStyleElement ||
            parent instanceof HTMLMetaElement) {
          return false;
        }
        
        // Check for elements with script-like attributes using DOM methods
        if (parent.hasAttribute('onclick') || 
            parent.hasAttribute('onload') || 
            parent.hasAttribute('onerror')) {
          return false;
        }
        
        // Use DOM classList API for class checking
        if (parent.classList.contains('script') || 
            parent.classList.contains('code') ||
            parent.classList.contains('highlight')) {
          return false;
        }
        
        return true;
      });
      
      if (filteredNodes.length === 0) {
        console.warn('[KeyPilot] All nodes filtered out (likely script content)');
        this.showFlashNotification('Cannot select script content', COLORS.NOTIFICATION_WARNING);
        return { success: false, selection: null, crossBoundary: false };
      }

      // Create selection from first to last filtered text node
      const firstNode = filteredNodes[0];
      const lastNode = filteredNodes[filteredNodes.length - 1];
      
      const ownerDocument = firstNode.ownerDocument || document;
      const range = ownerDocument.createRange();
      
      // Set range to encompass all filtered text nodes
      range.setStart(firstNode, 0);
      range.setEnd(lastNode, lastNode.textContent.length);
      
      // Get appropriate selection object
      const selection = this.getSelectionForDocument(ownerDocument);
      if (!selection) {
        return { success: false, selection: null, crossBoundary: false };
      }
      
      // Update selection
      selection.removeAllRanges();
      selection.addRange(range);
      
      return { success: true, selection: selection, crossBoundary: false };
      
    } catch (error) {
      console.warn('[KeyPilot] Error creating rectangle-based selection:', error);
      return { success: false, selection: null, crossBoundary: false };
    }
  }

  /**
   * Detect if current page is complex (like Wiktionary) and needs stricter limits
   * @returns {boolean} True if page is complex
   */
  detectComplexPage() {
    // Quick heuristics to detect complex pages
    const scriptTags = document.querySelectorAll('script').length;
    const styleTags = document.querySelectorAll('style').length;
    const totalElements = document.querySelectorAll('*').length;
    const langLinks = document.querySelectorAll('.interlanguage-link, [class*="lang"]').length;
    
    // Wiktionary and similar complex pages typically have:
    // - Many script tags (>10)
    // - Many style tags (>5) 
    // - Thousands of elements (>2000)
    // - Many language links (>50)
    return scriptTags > 10 || styleTags > 5 || totalElements > 2000 || langLinks > 50;
  }

  // =============================================================================
  // RECTANGLE SELECTION TOOL - Text node finding functions
  // These functions are specifically for the rectangle selection tool that creates
  // actual browser text selections from user-drawn rectangles
  // =============================================================================

  /**
   * RECTANGLE SELECTION TOOL: Finds text nodes for creating browser text selections
   * Used by createRectangleBasedSelection() to create actual text selections from user-drawn rectangles
   * @param {Object} rect - Rectangle with left, top, right, bottom properties
   * @returns {Array} - Array of text nodes within the rectangle
   */
  findTextNodesForSelection(rect) {
    // Use edge-only processing if available and enabled
    if (this.edgeOnlyProcessingEnabled && 
        this.rectangleIntersectionObserver && 
        FEATURE_FLAGS.ENABLE_EDGE_ONLY_PROCESSING) {
      
      try {
        // Update rectangle bounds for intersection observer
        this.rectangleIntersectionObserver.updateRectangle(rect);
        
        // Get text nodes from edge-only processing
        const edgeOnlyNodes = Array.from(this.rectangleIntersectionObserver.intersectingTextNodes);
        
        if (window.KEYPILOT_DEBUG && FEATURE_FLAGS.DEBUG_EDGE_ONLY_PROCESSING) {
          const metrics = this.rectangleIntersectionObserver.getMetrics();
          console.log('[KeyPilot Debug] Using edge-only processing for rectangle selection:', {
            textNodesFound: edgeOnlyNodes.length,
            intersectingElements: this.rectangleIntersectionObserver.intersectingTextElements.size,
            performanceGain: metrics.performanceGain,
            cacheHitRatio: metrics.cacheHitRatio
          });
        }
        
        return edgeOnlyNodes;
      } catch (error) {
        console.warn('[KeyPilot] Edge-only processing failed, falling back to spatial method:', error);
        
        // Fall back to spatial method if edge-only processing fails
        if (FEATURE_FLAGS.EDGE_ONLY_FALLBACK_ENABLED) {
          return this.findTextNodesForSelectionSpatial(rect);
        }
        
        return [];
      }
    }
    
    // Fall back to spatial method if edge-only processing is disabled
    return this.findTextNodesForSelectionSpatial(rect);
  }

  /**
   * RECTANGLE SELECTION TOOL - SPATIAL METHOD: Performance-optimized text node finding
   * Uses complex page detection and viewport culling for better performance on heavy sites
   * @param {Object} rect - Rectangle with left, top, right, bottom properties
   * @returns {Array} - Array of text nodes within the rectangle
   */
  findTextNodesForSelectionSpatial(rect) {
    const textNodes = [];
    const startTime = performance.now();
    
    // Detect complex pages and use stricter limits
    const isComplexPage = this.detectComplexPage();
    const MAX_NODES = isComplexPage ? 50 : 100; // Stricter limit for complex pages
    const MAX_TIME_MS = isComplexPage ? 25 : 50; // Faster timeout for complex pages
    const MAX_CHARS = isComplexPage ? 25000 : 50000; // Smaller text limit for complex pages
    
    if (isComplexPage) {
      console.log('[KeyPilot] Complex page detected, using stricter performance limits');
    }
    
    try {
      // Optimize: Limit TreeWalker to viewport + margin instead of entire document
      const VIEWPORT_MARGIN = 200; // Extra pixels around viewport for safety

      // Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const currentScrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;

      // Calculate expanded viewport bounds
      const expandedViewport = {
        left: currentScrollX - VIEWPORT_MARGIN,
        top: currentScrollY - VIEWPORT_MARGIN,
        right: currentScrollX + viewportWidth + VIEWPORT_MARGIN,
        bottom: currentScrollY + viewportHeight + VIEWPORT_MARGIN
      };

      // Find elements within expanded viewport to limit TreeWalker scope
      const elementsInViewport = [];
      const allElements = document.querySelectorAll('*');

      for (const element of allElements) {
        try {
          const elementRect = element.getBoundingClientRect();
          if (elementRect.width > 0 && elementRect.height > 0) {
            // Convert to document coordinates
            const docRect = {
              left: elementRect.left + currentScrollX,
              top: elementRect.top + currentScrollY,
              right: elementRect.right + currentScrollX,
              bottom: elementRect.bottom + currentScrollY
            };

            // Check if element intersects with expanded viewport
            const intersects = !(
              docRect.right < expandedViewport.left ||
              docRect.left > expandedViewport.right ||
              docRect.bottom < expandedViewport.top ||
              docRect.top > expandedViewport.bottom
            );

            if (intersects) {
              elementsInViewport.push(element);
            }
          }
        } catch (error) {
          // Skip elements that cause errors (e.g., in Shadow DOM)
          continue;
        }

        // Performance safeguard - limit viewport element collection
        if (elementsInViewport.length >= 1000) {
          break;
        }
      }

      // Create TreeWalker for each element in viewport (more targeted than document.body)
      const textNodes = [];
      const processedNodes = new Set(); // Prevent duplicate processing
      let totalChars = 0; // Track total characters processed

      // Define the acceptNode function outside the loop for reuse
      const acceptNodeFunction = (node) => {
        // Performance safeguards - check limits before processing
        if (textNodes.length >= MAX_NODES) {
          console.warn('[KeyPilot] Reached maximum node limit, stopping selection');
          return NodeFilter.FILTER_REJECT;
        }

        if (performance.now() - startTime > MAX_TIME_MS) {
          console.warn('[KeyPilot] Selection taking too long, stopping for performance');
          return NodeFilter.FILTER_REJECT;
        }

        // Skip empty or whitespace-only text nodes
        if (!node.textContent || !node.textContent.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        // Use DOM API to efficiently check if node should be excluded
        let currentElement = node.parentElement;
        while (currentElement) {
          // Use instanceof for precise type checking - much faster than string comparison
          if (currentElement instanceof HTMLScriptElement ||
              currentElement instanceof HTMLStyleElement ||
              currentElement instanceof HTMLMetaElement ||
              currentElement instanceof HTMLLinkElement ||
              currentElement instanceof HTMLTitleElement) {
            return NodeFilter.FILTER_REJECT;
          }

          // Check for other non-content elements using DOM properties
          const tagName = currentElement.tagName;
          if (tagName === 'NOSCRIPT' || tagName === 'TEMPLATE' || tagName === 'HEAD') {
            return NodeFilter.FILTER_REJECT;
          }

          // On complex pages, use DOM methods to check for excluded content
          if (isComplexPage) {
            // Use classList.contains() - faster than string includes
            if (currentElement.classList.contains('interlanguage-link') ||
                currentElement.classList.contains('footer') ||
                currentElement.classList.contains('mw-portlet') ||
                currentElement.id.startsWith('footer')) {
              return NodeFilter.FILTER_REJECT;
            }
          }

          // Use DOM API to check visibility efficiently
          const computedStyle = window.getComputedStyle(currentElement);
          if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }

          // Only check immediate parent for most cases, traverse up for script/style
          if (!(currentElement instanceof HTMLScriptElement) &&
              !(currentElement instanceof HTMLStyleElement)) {
            break;
          }
          currentElement = currentElement.parentElement;
        }

        // Check if text node intersects with rectangle
        try {
          const range = document.createRange();
          range.selectNodeContents(node);
          const nodeRect = range.getBoundingClientRect();

          // Skip nodes with invalid rectangles
          if (nodeRect.width === 0 || nodeRect.height === 0) {
            return NodeFilter.FILTER_REJECT;
          }

          // Convert document rectangle to viewport coordinates for comparison
          const currentScrollX = window.pageXOffset || document.documentElement.scrollLeft;
          const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;

          const viewportRect = {
            left: rect.left - currentScrollX,
            top: rect.top - currentScrollY,
            right: rect.right - currentScrollX,
            bottom: rect.bottom - currentScrollY
          };

          // Check if node rectangle intersects with selection rectangle
          const intersects = !(
            nodeRect.right < viewportRect.left ||
            nodeRect.left > viewportRect.right ||
            nodeRect.bottom < viewportRect.top ||
            nodeRect.top > viewportRect.bottom
          );

          return intersects ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        } catch (error) {
          console.warn('[KeyPilot] Error checking text node intersection:', error);
          return NodeFilter.FILTER_REJECT;
        }
      };

      for (const element of elementsInViewport) {
        // Skip if we've already processed too many nodes
        if (textNodes.length >= MAX_NODES) break;

        const elementWalker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT,
          acceptNodeFunction,
          false
        );

        let node;
        while (node = elementWalker.nextNode()) {
          // Skip if already processed (prevent duplicates across elements)
          if (processedNodes.has(node)) continue;
          processedNodes.add(node);

          // Additional character limit check
          totalChars += node.textContent.length;
          if (totalChars > MAX_CHARS) {
            console.warn('[KeyPilot] Selection too large, stopping to prevent performance issues');
            break;
          }

          textNodes.push(node);

          // Double-check performance limits during iteration
          if (textNodes.length >= MAX_NODES || performance.now() - startTime > MAX_TIME_MS) {
            break;
          }
        }
      } // Close the element loop

      // Only check shadow DOM if we haven't hit limits
      if (textNodes.length < MAX_NODES && performance.now() - startTime < MAX_TIME_MS) {
        this.findTextNodesInShadowDOMRectangle(document.body, rect, textNodes);
      }
      
      const duration = performance.now() - startTime;
      if (duration > 25 || textNodes.length > 50) {
        console.log(`[KeyPilot] Large selection: ${textNodes.length} nodes, ${totalChars} chars, ${duration.toFixed(1)}ms`);
      }
      
    } catch (error) {
      console.warn('[KeyPilot] Error finding text nodes in rectangle:', error);
    }
    
    return textNodes;
  }

  /**
   * Find text nodes within shadow DOM elements that intersect with the rectangle
   * @param {Element} element - Root element to search
   * @param {Object} rect - Rectangle bounds
   * @param {Array} textNodes - Array to add found text nodes to
   */
  findTextNodesInShadowDOMRectangle(element, rect, textNodes) {
    try {
      // Check if element has shadow root
      if (element.shadowRoot) {
        const walker = document.createTreeWalker(
          element.shadowRoot,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              if (!node.textContent || !node.textContent.trim()) {
                return NodeFilter.FILTER_REJECT;
              }
              
              try {
                const range = element.shadowRoot.ownerDocument.createRange();
                range.selectNodeContents(node);
                const nodeRect = range.getBoundingClientRect();
                
                const intersects = !(
                  nodeRect.right < rect.left ||
                  nodeRect.left > rect.right ||
                  nodeRect.bottom < rect.top ||
                  nodeRect.top > rect.bottom
                );
                
                return intersects ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
              } catch (error) {
                return NodeFilter.FILTER_REJECT;
              }
            }
          },
          false
        );
        
        let node;
        while (node = walker.nextNode()) {
          textNodes.push(node);
        }
      }
      
      // Recursively check child elements for shadow roots
      for (const child of element.children) {
        this.findTextNodesInShadowDOMRectangle(child, rect, textNodes);
      }
      
    } catch (error) {
      console.warn('[KeyPilot] Error finding shadow DOM text nodes:', error);
    }
  }

  /**
   * Create selection within a single document context
   * @param {Text} startNode - Starting text node
   * @param {Object} startPos - Starting position with x, y coordinates
   * @param {Text} currentNode - Current text node
   * @param {Object} currentPos - Current position with x, y coordinates
   * @returns {Object} - Result object with success flag and selection
   */
  createSingleDocumentSelection(startNode, startPos, currentNode, currentPos) {
    try {
      const ownerDocument = startNode.ownerDocument || document;
      const range = ownerDocument.createRange();
      
      // Calculate text offsets
      const startOffset = this.getTextOffsetAtPosition(startNode, startPos.x, startPos.y);
      const currentOffset = this.getTextOffsetAtPosition(currentNode, currentPos.x, currentPos.y);
      
      // Validate offsets
      const startTextLength = startNode.textContent.length;
      const currentTextLength = currentNode.textContent.length;
      const validStartOffset = Math.max(0, Math.min(startOffset, startTextLength));
      const validCurrentOffset = Math.max(0, Math.min(currentOffset, currentTextLength));
      
      // Set range based on direction of selection
      if (startNode === currentNode) {
        // Same text node - set range based on offset order
        if (validStartOffset <= validCurrentOffset) {
          range.setStart(startNode, validStartOffset);
          range.setEnd(currentNode, validCurrentOffset);
        } else {
          range.setStart(currentNode, validCurrentOffset);
          range.setEnd(startNode, validStartOffset);
        }
      } else {
        // Different text nodes - use document position to determine order
        const comparison = startNode.compareDocumentPosition(currentNode);
        if (comparison & Node.DOCUMENT_POSITION_FOLLOWING) {
          // Current node comes after start node
          range.setStart(startNode, validStartOffset);
          range.setEnd(currentNode, validCurrentOffset);
        } else {
          // Current node comes before start node
          range.setStart(currentNode, validCurrentOffset);
          range.setEnd(startNode, validStartOffset);
        }
      }
      
      // Validate range before applying
      if (range.collapsed && validStartOffset === validCurrentOffset && startNode === currentNode) {
        // Don't create empty selections unless we're at the exact start position
        return { success: false, selection: null, crossBoundary: false };
      }
      
      // Get appropriate selection object
      const selection = this.getSelectionForDocument(ownerDocument);
      if (!selection) {
        return { success: false, selection: null, crossBoundary: false };
      }
      
      // Update selection
      selection.removeAllRanges();
      selection.addRange(range);
      
      return { success: true, selection: selection, crossBoundary: false };
      
    } catch (error) {
      console.warn('[KeyPilot] Error creating single document selection:', error);
      return { success: false, selection: null, crossBoundary: false };
    }
  }

  /**
   * Create selection across shadow DOM boundaries
   * @param {Text} startNode - Starting text node
   * @param {Object} startPos - Starting position with x, y coordinates
   * @param {Text} currentNode - Current text node
   * @param {Object} currentPos - Current position with x, y coordinates
   * @returns {Object} - Result object with success flag and selection
   */
  createCrossShadowSelection(startNode, startPos, currentNode, currentPos) {
    try {
      // For cross-shadow selections, we need to be more careful
      // Try to create selection in the main document context
      const mainSelection = window.getSelection();
      
      // Create ranges for both nodes in their respective contexts
      const startRange = this.createRangeForTextNode(startNode);
      const currentRange = this.createRangeForTextNode(currentNode);
      
      if (!startRange || !currentRange) {
        return { success: false, selection: null, crossBoundary: true };
      }
      
      // For cross-shadow selections, we'll select the entire range from start to current
      // This is a limitation of the Selection API across shadow boundaries
      try {
        const combinedRange = document.createRange();
        
        // Try to set the range to span from start to current
        // This may fail for some cross-shadow scenarios
        combinedRange.setStart(startNode, this.getTextOffsetAtPosition(startNode, startPos.x, startPos.y));
        combinedRange.setEnd(currentNode, this.getTextOffsetAtPosition(currentNode, currentPos.x, currentPos.y));
        
        mainSelection.removeAllRanges();
        mainSelection.addRange(combinedRange);
        
        return { success: true, selection: mainSelection, crossBoundary: true };
        
      } catch (crossError) {
        // Cross-shadow selection failed, fall back to selecting in the current node's context
        console.warn('[KeyPilot] Cross-shadow selection failed, falling back to current node context:', crossError);
        return this.createSingleDocumentSelection(currentNode, currentPos, currentNode, currentPos);
      }
      
    } catch (error) {
      console.warn('[KeyPilot] Error creating cross-shadow selection:', error);
      return { success: false, selection: null, crossBoundary: true };
    }
  }

  /**
   * Get the shadow root for a given node
   * @param {Node} node - Node to find shadow root for
   * @returns {ShadowRoot|Document} - Shadow root or document
   */
  getShadowRoot(node) {
    let current = node;
    while (current) {
      if (current.nodeType === Node.DOCUMENT_NODE) {
        return current;
      }
      const root = current.getRootNode();
      if (root instanceof ShadowRoot) {
        return root;
      }
      if (root === document) {
        return document;
      }
      current = current.parentNode;
    }
    return document;
  }

  /**
   * Get the appropriate selection object for a document
   * @param {Document} doc - Document to get selection for
   * @returns {Selection|null} - Selection object or null
   */
  getSelectionForDocument(doc) {
    try {
      if (doc === document) {
        return window.getSelection();
      }
      // For shadow DOM contexts, we typically use the main document selection
      // as shadow roots don't have their own selection objects in most browsers
      return window.getSelection();
    } catch (error) {
      console.warn('[KeyPilot] Error getting selection for document:', error);
      return null;
    }
  }

  /**
   * Safely clear selection with comprehensive error handling
   */
  clearSelectionSafely() {
    // Clear main document selection
    try {
      if (window && typeof window.getSelection === 'function') {
        const selection = window.getSelection();
        if (selection) {
          // Validate selection object before using
          if (typeof selection.rangeCount === 'number' && 
              typeof selection.removeAllRanges === 'function') {
            
            if (selection.rangeCount > 0) {
              selection.removeAllRanges();
              console.log('[KeyPilot] Cleared main document selection');
            }
          } else {
            console.warn('[KeyPilot] Main selection object missing required methods');
          }
        }
      }
    } catch (error) {
      console.warn('[KeyPilot] Error clearing main document selection:', error);
    }
    
    // Clear stored selection from state
    try {
      const currentState = this.state.getState();
      if (currentState && currentState.currentSelection) {
        this.state.setCurrentSelection(null);
        console.log('[KeyPilot] Cleared stored selection from state');
      }
    } catch (error) {
      console.warn('[KeyPilot] Error clearing stored selection from state:', error);
    }
    
    // Clear shadow DOM selections
    try {
      this.clearAllSelectionsWithShadowSupport();
    } catch (error) {
      console.warn('[KeyPilot] Error clearing shadow DOM selections:', error);
    }
  }

  async completeSelection() {
    const currentState = this.state.getState();
    const selectionMode = this.overlayManager.getSelectionMode();
    
    console.log('[KeyPilot] Completing text selection with comprehensive error handling, mode:', selectionMode);
    
    try {
      let selectedText = '';
      let selection = null;
      let extractedContent = null;

      if (selectionMode === 'character') {
        // Complete character-level selection
        selectedText = this.overlayManager.completeCharacterSelection();
        
        if (!selectedText || selectedText.trim() === '') {
          throw new Error('Character selection returned no text');
        }
      } else {
        // Rectangle selection mode - use existing logic
        try {
          selection = this.getCurrentSelectionWithShadowSupport();
          if (!selection) {
            throw new Error('No selection object available');
          }
          
          // Validate selection has content
          if (typeof selection.toString !== 'function') {
            throw new Error('Selection object missing toString method');
          }
          
          // Check if selection has ranges
          if (typeof selection.rangeCount === 'number' && selection.rangeCount === 0) {
            throw new Error('Selection has no ranges');
          }
          
          // Extract content before doing anything that might clear the selection
          if (FEATURE_FLAGS.ENABLE_RICH_TEXT_CLIPBOARD) {
            try {
              extractedContent = this.extractSelectionContent(selection);
            } catch (extractError) {
              console.warn('[KeyPilot] Error extracting rich text content, falling back to plain text:', extractError);
              extractedContent = { 
                plainText: selection.toString(), 
                htmlContent: '', 
                hasRichContent: false 
              };
            }
          } else {
            extractedContent = { 
              plainText: selection.toString(), 
              htmlContent: '', 
              hasRichContent: false 
            };
          }
          
          selectedText = extractedContent.plainText;
          if (!selectedText || selectedText.trim() === '') {
            throw new Error('Selection returned empty or whitespace-only text content');
          }
        } catch (selectionError) {
          console.warn('[KeyPilot] Error getting current selection:', selectionError);
          
          // Try fallback: get selection from state
          try {
            const stateSelection = currentState.currentSelection;
            if (stateSelection && typeof stateSelection.toString === 'function') {
              selectedText = stateSelection.toString();
              selection = stateSelection;
              console.log('[KeyPilot] Using fallback selection from state');
            } else {
              throw new Error('No valid fallback selection available');
            }
          } catch (fallbackError) {
            console.warn('[KeyPilot] Fallback selection also failed:', fallbackError);
            
            // Final fallback: try to recreate selection from highlight rectangle
          try {
            const startPos = currentState.highlightStartPosition;
            const currentPos = { x: currentState.lastMouse.x, y: currentState.lastMouse.y };
            
            if (startPos && currentPos) {
              console.log('[KeyPilot] Attempting to recreate selection from highlight rectangle');
              const recreatedSelection = this.createRectangleBasedSelection(startPos, currentPos);
              
              if (recreatedSelection && recreatedSelection.success && recreatedSelection.selection) {
                selectedText = recreatedSelection.selection.toString();
                selection = recreatedSelection.selection;
                console.log('[KeyPilot] Successfully recreated selection from rectangle');
              } else {
                throw new Error('Could not recreate selection from highlight rectangle');
              }
            } else {
              throw new Error('No highlight position data available for recreation');
            }
          } catch (recreationError) {
            console.error('[KeyPilot] All selection methods failed:', recreationError);
            this.showFlashNotification('Unable to access selected text', COLORS.NOTIFICATION_ERROR);
            return;
          }
        }
      }
      } // End of rectangle selection mode
      
      // Handle empty or whitespace-only selections
      if (!selectedText || !selectedText.trim()) {
        console.log('[KeyPilot] Empty or whitespace-only selection, canceling highlight mode');
        this.cancelHighlightMode();
        this.showFlashNotification('No text selected', COLORS.NOTIFICATION_INFO);
        return;
      }
      
      // Validate text content before copying
      if (typeof selectedText !== 'string') {
        console.error('[KeyPilot] Selected text is not a string:', typeof selectedText);
        this.showFlashNotification('Invalid text selection', COLORS.NOTIFICATION_ERROR);
        return;
      }
      
      // Use the already extracted content if available
      let contentToClipboard = extractedContent || selectedText;
      
      // If we don't have extracted content but have a selection, try to extract it
      if (!extractedContent && selection && FEATURE_FLAGS.ENABLE_RICH_TEXT_CLIPBOARD) {
        try {
          contentToClipboard = this.extractSelectionContent(selection);
          console.log('[KeyPilot] Extracted selection content:', {
            plainTextLength: contentToClipboard.plainText?.length || 0,
            hasRichContent: contentToClipboard.hasRichContent || false,
            htmlContentLength: contentToClipboard.htmlContent?.length || 0
          });
        } catch (extractError) {
          console.warn('[KeyPilot] Failed to extract rich content, using plain text:', extractError);
          contentToClipboard = selectedText; // Fall back to plain text
        }
      }

      // Copy content to clipboard with comprehensive error handling
      let copySuccess = false;
      let clipboardError = null;
      
      try {
        copySuccess = await this.copyToClipboard(contentToClipboard);
      } catch (error) {
        clipboardError = error;
        console.error('[KeyPilot] Clipboard operation threw error:', error);
        copySuccess = false;
      }
      
      if (copySuccess) {
        const copyType = (contentToClipboard && contentToClipboard.hasRichContent) ? 'rich text' : 'plain text';
        const textPreview = (typeof contentToClipboard === 'string') ? 
          contentToClipboard.substring(0, 50) : 
          contentToClipboard.plainText.substring(0, 50);
        console.log(`[KeyPilot] Content successfully copied to clipboard (${copyType}):`, textPreview);
        
        // Clear selection and exit highlight mode with error handling
        try {
          this.cancelModes();
        } catch (cancelError) {
          console.warn('[KeyPilot] Error canceling modes after successful copy:', cancelError);
          // Force exit highlight mode
          this.state.setMode(MODES.NONE);
        }
        
        // Show success confirmation with copy type
        const notificationCopyType = (contentToClipboard && contentToClipboard.hasRichContent) ? 'Rich text' : 'Text';
        this.showFlashNotification(`${notificationCopyType} copied to clipboard`, COLORS.NOTIFICATION_SUCCESS);
        
        // Flash the focus overlay for additional visual feedback with error handling
        try {
          this.overlayManager.flashFocusOverlay();
        } catch (flashError) {
          console.warn('[KeyPilot] Error flashing focus overlay:', flashError);
          // Continue without visual feedback
        }
      } else {
        console.warn('[KeyPilot] Failed to copy text to clipboard');
        
        // Provide specific error message based on clipboard error
        let errorMessage = 'Failed to copy text';
        if (clipboardError) {
          if (clipboardError.name === 'NotAllowedError' || clipboardError.message.includes('permission')) {
            errorMessage = 'Clipboard access denied - check browser permissions';
          } else if (clipboardError.message.includes('not supported')) {
            errorMessage = 'Clipboard not supported in this context';
          } else if (clipboardError.message.includes('secure context')) {
            errorMessage = 'Clipboard requires secure connection (HTTPS)';
          }
        }
        
        // Don't exit highlight mode on clipboard failure - let user try again
        this.showFlashNotification(errorMessage, COLORS.NOTIFICATION_ERROR);
      }
    } catch (error) {
      console.error('[KeyPilot] Unexpected error completing selection:', error);
      
      // Provide user-friendly error message for unexpected errors
      let errorMessage = 'Error copying text';
      if (error.message.includes('Selection API')) {
        errorMessage = 'Text selection not supported on this page';
      } else if (error.message.includes('shadow')) {
        errorMessage = 'Cannot copy text from this element';
      }
      
      // Don't exit highlight mode on error - let user try again
      this.showFlashNotification(errorMessage, COLORS.NOTIFICATION_ERROR);
    }
  }

  /**
   * Get current selection with comprehensive shadow DOM support and error handling
   * @returns {Selection|null} - Current selection or null
   */
  getCurrentSelectionWithShadowSupport() {
    try {
      // First try the main document selection with validation
      let mainSelection = null;
      try {
        if (window && typeof window.getSelection === 'function') {
          mainSelection = window.getSelection();
          
          // Validate selection object
          if (mainSelection && 
              typeof mainSelection.rangeCount === 'number' && 
              typeof mainSelection.toString === 'function') {
            
            if (mainSelection.rangeCount > 0) {
              const selectionText = mainSelection.toString();
              if (selectionText && selectionText.trim()) {
                console.log('[KeyPilot] Found valid main document selection');
                return mainSelection;
              }
            }
          }
        }
      } catch (mainSelectionError) {
        console.warn('[KeyPilot] Error accessing main document selection:', mainSelectionError);
      }
      
      // If no main selection, check stored selection from state with validation
      try {
        const currentState = this.state.getState();
        if (currentState && currentState.currentSelection) {
          const stateSelection = currentState.currentSelection;
          
          // Validate stored selection
          if (stateSelection && 
              typeof stateSelection.toString === 'function' &&
              typeof stateSelection.rangeCount === 'number') {
            
            const stateSelectionText = stateSelection.toString();
            if (stateSelectionText && stateSelectionText.trim()) {
              console.log('[KeyPilot] Found valid stored selection from state');
              return stateSelection;
            }
          }
        }
      } catch (stateSelectionError) {
        console.warn('[KeyPilot] Error accessing stored selection from state:', stateSelectionError);
      }
      
      // Try to find selection in shadow DOM contexts with comprehensive error handling
      try {
        const shadowSelection = this.findSelectionInShadowDOM();
        if (shadowSelection) {
          console.log('[KeyPilot] Found valid shadow DOM selection');
          return shadowSelection;
        }
      } catch (shadowSelectionError) {
        console.warn('[KeyPilot] Error finding selection in shadow DOM:', shadowSelectionError);
      }
      
      console.log('[KeyPilot] No valid selection found in any context');
      return null;
    } catch (error) {
      console.error('[KeyPilot] Unexpected error getting current selection:', error);
      return null;
    }
  }

  /**
   * Find selection in shadow DOM contexts with comprehensive error handling
   * @returns {Selection|null} - Selection found in shadow DOM or null
   */
  findSelectionInShadowDOM() {
    try {
      // Validate shadow DOM manager availability
      if (!this.shadowDOMManager) {
        console.log('[KeyPilot] Shadow DOM manager not available');
        return null;
      }
      
      // Validate shadow roots collection
      const shadowRoots = this.shadowDOMManager.shadowRoots;
      if (!shadowRoots ||
          !(shadowRoots instanceof Set) ||
          shadowRoots.size === 0) {
        console.log('[KeyPilot] No shadow roots available for selection search');
        return null;
      }
      
      // Iterate through shadow roots with comprehensive error handling
      let i = 0;
      for (const shadowRoot of shadowRoots) {
        
        try {
          // Validate shadow root
          if (!shadowRoot) {
            console.warn(`[KeyPilot] Shadow root at index ${i} is null or undefined`);
            i++;
            continue;
          }
          
          // Check if shadow root has selection capability
          if (typeof shadowRoot.getSelection !== 'function') {
            // Most shadow roots don't have their own getSelection method
            // This is normal and not an error
            i++;
            continue;
          }
          
          // Try to get selection from shadow root
          let shadowSelection = null;
          try {
            shadowSelection = shadowRoot.getSelection();
          } catch (getSelectionError) {
            console.warn(`[KeyPilot] Error calling getSelection on shadow root ${i}:`, getSelectionError);
            i++;
            continue;
          }
          
          // Validate shadow selection
          if (!shadowSelection) {
            i++;
            continue;
          }
          
          // Check if selection has required methods and properties
          if (typeof shadowSelection.rangeCount !== 'number' ||
              typeof shadowSelection.toString !== 'function') {
            console.warn(`[KeyPilot] Shadow selection at index ${i} missing required methods`);
            i++;
            continue;
          }
          
          // Check if selection has content
          if (shadowSelection.rangeCount > 0) {
            let selectionText = '';
            try {
              selectionText = shadowSelection.toString();
            } catch (toStringError) {
              console.warn(`[KeyPilot] Error getting text from shadow selection ${i}:`, toStringError);
              i++;
              continue;
            }
            
            if (selectionText && selectionText.trim()) {
              console.log(`[KeyPilot] Found valid selection in shadow root ${i}`);
              return shadowSelection;
            }
          }
        } catch (shadowRootError) {
          console.warn(`[KeyPilot] Error processing shadow root ${i}:`, shadowRootError);
          // Continue to next shadow root
          i++;
          continue;
        }

        i++;
      }
      
      console.log('[KeyPilot] No valid selection found in any shadow DOM context');
      return null;
    } catch (error) {
      console.error('[KeyPilot] Unexpected error finding selection in shadow DOM:', error);
      return null;
    }
  }

  /**
   * Extract both plain text and HTML content from a selection
   * @param {Selection} selection - The selection object to extract content from
   * @returns {Object} - Object containing both plainText and htmlContent
   */
  extractSelectionContent(selection) {
    try {
      if (!selection || typeof selection.rangeCount !== 'number' || selection.rangeCount === 0) {
        throw new Error('Invalid or empty selection');
      }

      // Get plain text
      const plainText = selection.toString();
      
      // Get HTML content
      let htmlContent = '';
      
      if (FEATURE_FLAGS.ENABLE_RICH_TEXT_CLIPBOARD) {
        try {
          // Create a temporary container to hold the selection content
          const container = document.createElement('div');
          
          // Clone all ranges from the selection
          for (let i = 0; i < selection.rangeCount; i++) {
            const range = selection.getRangeAt(i);
            const clonedContent = range.cloneContents();
            container.appendChild(clonedContent);
          }
          
          // Get the HTML content
          htmlContent = container.innerHTML;
          
          // Clean up the HTML - remove script tags and other potentially harmful content
          htmlContent = this.sanitizeHtmlContent(htmlContent);
          
        } catch (htmlError) {
          console.warn('[KeyPilot] Failed to extract HTML content:', htmlError);
          htmlContent = ''; // Fall back to plain text only
        }
      }

      return {
        plainText: plainText,
        htmlContent: htmlContent,
        hasRichContent: htmlContent.length > 0 && htmlContent !== plainText
      };
      
    } catch (error) {
      console.error('[KeyPilot] Error extracting selection content:', error);
      return {
        plainText: '',
        htmlContent: '',
        hasRichContent: false
      };
    }
  }

  /**
   * Sanitize HTML content to remove potentially harmful elements
   * @param {string} html - Raw HTML content
   * @returns {string} - Sanitized HTML content
   */
  sanitizeHtmlContent(html) {
    if (!html || typeof html !== 'string') {
      return '';
    }

    try {
      // Create a temporary element to parse and clean the HTML
      const temp = document.createElement('div');
      temp.innerHTML = html;

      // Remove script tags and other potentially harmful elements
      const dangerousElements = temp.querySelectorAll('script, object, embed, iframe, form, input, button');
      dangerousElements.forEach(el => el.remove());

      // Remove event handlers and javascript: links
      const allElements = temp.querySelectorAll('*');
      allElements.forEach(el => {
        // Remove event handler attributes
        const attributes = Array.from(el.attributes);
        attributes.forEach(attr => {
          if (attr.name.startsWith('on') || attr.value.includes('javascript:')) {
            el.removeAttribute(attr.name);
          }
        });
      });

      return temp.innerHTML;
    } catch (error) {
      console.warn('[KeyPilot] Error sanitizing HTML content:', error);
      return html; // Return original if sanitization fails
    }
  }

  /**
   * Copy text to clipboard using modern Clipboard API with comprehensive fallback methods and error handling
   * @param {string|Object} content - Text to copy, or object with plainText and htmlContent
   * @returns {Promise<boolean>} - True if copy was successful, false otherwise
   */
  async copyToClipboard(content) {
    // Handle both string (legacy) and object (rich text) input
    let plainText, htmlContent, hasRichContent;
    
    if (typeof content === 'string') {
      // Legacy string input - plain text only
      plainText = content;
      htmlContent = '';
      hasRichContent = false;
    } else if (content && typeof content === 'object') {
      // Rich text object input
      plainText = content.plainText || '';
      htmlContent = content.htmlContent || '';
      hasRichContent = content.hasRichContent || false;
    } else {
      console.warn('[KeyPilot] Invalid content provided to copyToClipboard:', typeof content);
      return false;
    }

    // Comprehensive input validation
    if (!plainText) {
      console.warn('[KeyPilot] No plain text content provided to copyToClipboard');
      return false;
    }
    
    if (plainText.length === 0) {
      console.warn('[KeyPilot] Empty plain text content provided to copyToClipboard');
      return false;
    }
    
    // Validate text content (check for null characters or other issues)
    try {
      // Test if text can be properly encoded
      const encoded = encodeURIComponent(plainText);
      if (!encoded) {
        throw new Error('Text contains invalid characters');
      }
    } catch (encodingError) {
      console.warn('[KeyPilot] Text encoding validation failed:', encodingError);
      return false;
    }

    // Try modern Clipboard API first with comprehensive error handling
    if (navigator.clipboard) {
      try {
        // Check if we're in a secure context
        if (!window.isSecureContext) {
          console.warn('[KeyPilot] Not in secure context, modern Clipboard API may fail');
        }
        
        let clipboardPromise;
        
        // Use rich text API if we have HTML content and the browser supports it
        if (hasRichContent && htmlContent && navigator.clipboard.write) {
          try {
            const clipboardItems = [];
            const clipboardItem = new ClipboardItem({
              'text/plain': new Blob([plainText], { type: 'text/plain' }),
              'text/html': new Blob([htmlContent], { type: 'text/html' })
            });
            clipboardItems.push(clipboardItem);
            
            clipboardPromise = navigator.clipboard.write(clipboardItems);
            console.log('[KeyPilot] Attempting to copy rich text (HTML + plain text)');
          } catch (richTextError) {
            console.warn('[KeyPilot] Rich text clipboard failed, falling back to plain text:', richTextError);
            // Fall back to plain text
            if (typeof navigator.clipboard.writeText === 'function') {
              clipboardPromise = navigator.clipboard.writeText(plainText);
            } else {
              throw new Error('Neither rich text nor plain text clipboard API available');
            }
          }
        } else {
          // Use plain text API
          if (typeof navigator.clipboard.writeText === 'function') {
            clipboardPromise = navigator.clipboard.writeText(plainText);
            console.log('[KeyPilot] Attempting to copy plain text');
          } else {
            throw new Error('Plain text clipboard API not available');
          }
        }
        
        // Attempt to write to clipboard with timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Clipboard operation timed out')), 5000);
        });
        
        await Promise.race([clipboardPromise, timeoutPromise]);
        
        const copyType = hasRichContent && htmlContent ? 'rich text (HTML + plain text)' : 'plain text';
        console.log(`[KeyPilot] Content copied using modern Clipboard API (${copyType})`);
        return true;
      } catch (error) {
        console.warn('[KeyPilot] Modern Clipboard API failed:', error.message);
        
        // Categorize the error for better user feedback
        if (error.name === 'NotAllowedError') {
          console.warn('[KeyPilot] Clipboard permission denied');
        } else if (error.name === 'NotSupportedError') {
          console.warn('[KeyPilot] Clipboard API not supported');
        } else if (error.message.includes('secure context')) {
          console.warn('[KeyPilot] Clipboard requires secure context (HTTPS)');
        } else if (error.message.includes('timed out')) {
          console.warn('[KeyPilot] Clipboard operation timed out');
        } else if (error.message.includes('permission')) {
          console.warn('[KeyPilot] Clipboard permission issue');
        }
        
        // Fall through to fallback method
      }
    } else {
      console.log('[KeyPilot] Modern Clipboard API not available, using fallback method');
    }

    // Fallback method using execCommand with comprehensive error handling
    let textarea = null;
    try {
      // Validate document state
      if (!document || !document.body) {
        throw new Error('Document or document.body not available');
      }
      
      // Check if execCommand is available
      if (typeof document.execCommand !== 'function') {
        throw new Error('execCommand not available');
      }
      
      // Create appropriate element for rich text or plain text
      let tempElement;
      
      if (hasRichContent && htmlContent && FEATURE_FLAGS.ENABLE_RICH_TEXT_CLIPBOARD) {
        // Use a div for rich text content
        tempElement = document.createElement('div');
        if (!tempElement) {
          throw new Error('Failed to create div element for rich text');
        }
        
        // Set div properties for rich text
        try {
          tempElement.innerHTML = htmlContent;
          tempElement.style.position = 'fixed';
          tempElement.style.left = '-9999px';
          tempElement.style.top = '-9999px';
          tempElement.style.width = '1px';
          tempElement.style.height = '1px';
          tempElement.style.opacity = '0';
          tempElement.style.pointerEvents = 'none';
          tempElement.style.zIndex = '-1';
          tempElement.setAttribute('tabindex', '-1');
          tempElement.setAttribute('aria-hidden', 'true');
          console.log('[KeyPilot] Using div element for rich text fallback');
        } catch (styleError) {
          throw new Error(`Failed to set div properties: ${styleError.message}`);
        }
      } else {
        // Use textarea for plain text (traditional method)
        tempElement = document.createElement('textarea');
        if (!tempElement) {
          throw new Error('Failed to create textarea element');
        }
        
        // Set textarea properties with error handling
        try {
          tempElement.value = plainText;
          tempElement.style.position = 'fixed';
          tempElement.style.left = '-9999px';
          tempElement.style.top = '-9999px';
          tempElement.style.width = '1px';
          tempElement.style.height = '1px';
          tempElement.style.opacity = '0';
          tempElement.style.pointerEvents = 'none';
          tempElement.style.zIndex = '-1';
          tempElement.setAttribute('readonly', '');
          tempElement.setAttribute('tabindex', '-1');
          tempElement.setAttribute('aria-hidden', 'true');
          console.log('[KeyPilot] Using textarea element for plain text fallback');
        } catch (styleError) {
          throw new Error(`Failed to set textarea properties: ${styleError.message}`);
        }
      }
      
      // Store reference for cleanup
      textarea = tempElement;
      
      // Add to DOM with error handling
      try {
        document.body.appendChild(tempElement);
      } catch (appendError) {
        throw new Error(`Failed to append element to DOM: ${appendError.message}`);
      }
      
      // Focus and select content with error handling
      try {
        tempElement.focus();
        
        if (hasRichContent && htmlContent && tempElement.tagName === 'DIV') {
          // For div elements with rich content, select all content
          const range = document.createRange();
          range.selectNodeContents(tempElement);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          console.log('[KeyPilot] Selected rich content in div element');
        } else {
          // For textarea elements, use traditional selection
          tempElement.select();
          
          // Ensure selection is set properly
          if (typeof tempElement.setSelectionRange === 'function') {
            tempElement.setSelectionRange(0, plainText.length);
          }
          
          // Verify selection was successful
          if (tempElement.selectionStart !== 0 || tempElement.selectionEnd !== plainText.length) {
            console.warn('[KeyPilot] Text selection in textarea may be incomplete');
          }
        }
      } catch (selectionError) {
        throw new Error(`Failed to select content: ${selectionError.message}`);
      }
      
      // Execute copy command with error handling
      let success = false;
      try {
        success = document.execCommand('copy');
      } catch (execError) {
        throw new Error(`execCommand failed: ${execError.message}`);
      }
      
      // Clean up temporary element
      try {
        if (tempElement && tempElement.parentNode) {
          document.body.removeChild(tempElement);
        }
      } catch (cleanupError) {
        console.warn('[KeyPilot] Error cleaning up temporary element:', cleanupError);
        // Don't fail the operation due to cleanup issues
      }
      
      if (success) {
        const copyType = hasRichContent && htmlContent ? 'rich text' : 'plain text';
        console.log(`[KeyPilot] Content copied using fallback execCommand method (${copyType})`);
        return true;
      } else {
        throw new Error('execCommand returned false');
      }
    } catch (error) {
      console.error('[KeyPilot] Fallback clipboard method failed:', error);
      
      // Ensure cleanup even on error
      try {
        if (tempElement && tempElement.parentNode) {
          document.body.removeChild(tempElement);
        }
      } catch (cleanupError) {
        console.warn('[KeyPilot] Error cleaning up temporary element after failure:', cleanupError);
      }
      
      return false;
    }
  }

  /**
   * Cancel highlight mode and return to normal mode
   * Clears selection, visual indicators, and state with shadow DOM support
   */
  cancelHighlightMode() {
    console.log('[KeyPilot] Canceling highlight mode with shadow DOM support');
    
    const selectionMode = this.overlayManager.getSelectionMode();
    
    if (selectionMode === 'character') {
      // Clear character selection
      try {
        this.overlayManager.clearCharacterSelection();
        console.log('[KeyPilot] Cleared character selection');
      } catch (error) {
        console.warn('[KeyPilot] Error clearing character selection:', error);
      }
    } else {
      // Rectangle selection mode cleanup
      // Clean up edge-only processing if active
      if (this.edgeOnlyProcessingEnabled && 
          this.rectangleIntersectionObserver && 
          FEATURE_FLAGS.ENABLE_EDGE_ONLY_PROCESSING) {
        
        try {
          // Reset rectangle to zero size to stop intersection processing
          this.rectangleIntersectionObserver.updateRectangle({
            left: 0,
            top: 0,
            width: 0,
            height: 0
          });
          
          if (window.KEYPILOT_DEBUG && FEATURE_FLAGS.DEBUG_EDGE_ONLY_PROCESSING) {
            console.log('[KeyPilot Debug] Edge-only processing cleaned up for highlight mode cancellation');
          }
        } catch (error) {
          console.warn('[KeyPilot] Error cleaning up edge-only processing:', error);
        }
      }
      
      // Clear rectangle overlay
      try {
        this.overlayManager.hideHighlightRectangleOverlay();
        console.log('[KeyPilot] Cleared highlight rectangle overlay');
      } catch (error) {
        console.warn('[KeyPilot] Error clearing highlight rectangle overlay:', error);
      }
    }
    
    // Clear any active text selection immediately with shadow DOM support
    this.clearAllSelectionsWithShadowSupport();
    
    // Clear visual selection overlays immediately
    try {
      this.overlayManager.clearHighlightSelectionOverlays();
      console.log('[KeyPilot] Cleared highlight selection overlays');
    } catch (error) {
      console.warn('[KeyPilot] Error clearing highlight overlays:', error);
    }
    
    // Clear all highlight-related state
    this.state.setHighlightStartPosition(null);
    this.state.setCurrentSelection(null);
    this.state.setHighlightElement(null);
    
    // Return to normal mode
    this.state.setMode(MODES.NONE);
    
    console.log('[KeyPilot] Highlight mode canceled, returned to normal mode');
  }

  /**
   * Clear all selections including shadow DOM contexts with comprehensive error handling
   */
  clearAllSelectionsWithShadowSupport() {
    // Clear main document selection with validation
    try {
      if (window && typeof window.getSelection === 'function') {
        const mainSelection = window.getSelection();
        if (mainSelection && 
            typeof mainSelection.rangeCount === 'number' &&
            typeof mainSelection.removeAllRanges === 'function') {
          
          if (mainSelection.rangeCount > 0) {
            mainSelection.removeAllRanges();
            console.log('[KeyPilot] Cleared main document selection');
          }
        }
      }
    } catch (error) {
      console.warn('[KeyPilot] Error clearing main document selection:', error);
    }
    
    // Clear selections in shadow DOM contexts with comprehensive validation
    try {
      if (!this.shadowDOMManager) {
        console.log('[KeyPilot] Shadow DOM manager not available for selection clearing');
        return;
      }
      
      const shadowRoots = this.shadowDOMManager.shadowRoots;
      if (!shadowRoots ||
          !(shadowRoots instanceof Set) ||
          shadowRoots.size === 0) {
        console.log('[KeyPilot] No shadow roots available for selection clearing');
        return;
      }
      
      let i = 0;
      for (const shadowRoot of shadowRoots) {
        
        try {
          if (!shadowRoot) {
            console.warn(`[KeyPilot] Shadow root at index ${i} is null`);
            i++;
            continue;
          }
          
          // Check if shadow root has selection capability
          if (typeof shadowRoot.getSelection !== 'function') {
            // Most shadow roots don't have getSelection - this is normal
            i++;
            continue;
          }
          
          // Try to get and clear shadow selection
          let shadowSelection = null;
          try {
            shadowSelection = shadowRoot.getSelection();
          } catch (getSelectionError) {
            console.warn(`[KeyPilot] Error getting shadow selection ${i}:`, getSelectionError);
            i++;
            continue;
          }
          
          if (shadowSelection &&
              typeof shadowSelection.rangeCount === 'number' &&
              typeof shadowSelection.removeAllRanges === 'function') {
            
            if (shadowSelection.rangeCount > 0) {
              try {
                shadowSelection.removeAllRanges();
                console.log(`[KeyPilot] Cleared shadow DOM selection ${i}`);
              } catch (removeRangesError) {
                console.warn(`[KeyPilot] Error removing ranges from shadow selection ${i}:`, removeRangesError);
              }
            }
          }
        } catch (shadowRootError) {
          console.warn(`[KeyPilot] Error processing shadow root ${i} for selection clearing:`, shadowRootError);
          i++;
          continue;
        }

        i++;
      }
    } catch (error) {
      console.error('[KeyPilot] Unexpected error clearing shadow DOM selections:', error);
    }
  }

  /**
   * Find the text node at the given screen coordinates with comprehensive shadow DOM support and error handling
   * @param {number} x - Screen X coordinate
   * @param {number} y - Screen Y coordinate
   * @returns {Text|null} - Text node at position or null if none found
   */
  findTextNodeAtPosition(x, y) {
    try {
      // Validate input coordinates
      if (typeof x !== 'number' || typeof y !== 'number' || 
          !isFinite(x) || !isFinite(y) || x < 0 || y < 0) {
        console.warn('[KeyPilot] Invalid coordinates provided to findTextNodeAtPosition:', { x, y });
        return null;
      }
      
      // Get element at position using deep shadow DOM traversal with error handling
      let element = null;
      try {
        if (!this.detector || typeof this.detector.deepElementFromPoint !== 'function') {
          throw new Error('Element detector not available or missing deepElementFromPoint method');
        }
        
        element = this.detector.deepElementFromPoint(x, y);
      } catch (detectorError) {
        console.warn('[KeyPilot] Error using element detector:', detectorError);
        
        // Fallback to standard elementFromPoint
        try {
          element = document.elementFromPoint(x, y);
        } catch (fallbackError) {
          console.warn('[KeyPilot] Fallback elementFromPoint also failed:', fallbackError);
          return null;
        }
      }
      
      if (!element) {
        console.log('[KeyPilot] No element found at position:', { x, y });
        return null;
      }

      // Check if element itself is a text node
      if (element.nodeType === Node.TEXT_NODE) {
        // Validate text node has content
        if (element.textContent && element.textContent.trim()) {
          return element;
        } else {
          console.log('[KeyPilot] Text node at position has no content');
          return null;
        }
      }

      // Skip non-selectable elements gracefully with error handling
      try {
        if (this.isNonSelectableElement(element)) {
          console.log('[KeyPilot] Element at position is non-selectable:', element.tagName);
          return null;
        }
      } catch (selectableError) {
        console.warn('[KeyPilot] Error checking if element is selectable:', selectableError);
        // Continue anyway - assume it might be selectable
      }

      // Find text nodes within the element with comprehensive error handling
      let textNodes = [];
      try {
        textNodes = this.findTextNodesInElementWithShadowDOM(element);
      } catch (textNodesError) {
        console.warn('[KeyPilot] Error finding text nodes in element:', textNodesError);
        
        // Fallback: try simple text node search without shadow DOM
        try {
          textNodes = this.findTextNodesInElementSimple(element);
        } catch (fallbackError) {
          console.warn('[KeyPilot] Fallback text node search also failed:', fallbackError);
          return null;
        }
      }
      
      if (!textNodes || textNodes.length === 0) {
        console.log('[KeyPilot] No text nodes found in element at position');
        return null;
      }
      
      // Find the text node closest to the cursor position with comprehensive error handling
      let bestNode = null;
      let bestDistance = Infinity;
      
      for (let i = 0; i < textNodes.length; i++) {
        const node = textNodes[i];
        
        try {
          // Validate text node
          if (!node || node.nodeType !== Node.TEXT_NODE) {
            console.warn(`[KeyPilot] Invalid text node at index ${i}`);
            continue;
          }
          
          // Skip empty text nodes
          if (!node.textContent || !node.textContent.trim()) {
            continue;
          }
          
          // Create a range for this text node to get its position
          let range = null;
          try {
            range = this.createRangeForTextNode(node);
          } catch (rangeError) {
            console.warn(`[KeyPilot] Error creating range for text node ${i}:`, rangeError);
            continue;
          }
          
          if (!range) {
            continue;
          }
          
          // Get bounding rectangle with error handling
          let rect = null;
          try {
            rect = range.getBoundingClientRect();
          } catch (rectError) {
            console.warn(`[KeyPilot] Error getting bounding rect for text node ${i}:`, rectError);
            continue;
          }
          
          // Validate rectangle
          if (!rect || typeof rect.width !== 'number' || typeof rect.height !== 'number' ||
              typeof rect.left !== 'number' || typeof rect.top !== 'number') {
            console.warn(`[KeyPilot] Invalid bounding rect for text node ${i}`);
            continue;
          }
          
          // Skip nodes with no visible area
          if (rect.width <= 0 || rect.height <= 0) {
            continue;
          }
          
          // Calculate distance from cursor to text node with error handling
          try {
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            // Validate calculated center
            if (!isFinite(centerX) || !isFinite(centerY)) {
              console.warn(`[KeyPilot] Invalid center coordinates for text node ${i}`);
              continue;
            }
            
            const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
            
            if (!isFinite(distance)) {
              console.warn(`[KeyPilot] Invalid distance calculation for text node ${i}`);
              continue;
            }
            
            if (distance < bestDistance) {
              bestDistance = distance;
              bestNode = node;
            }
          } catch (distanceError) {
            console.warn(`[KeyPilot] Error calculating distance for text node ${i}:`, distanceError);
            continue;
          }
        } catch (nodeError) {
          console.warn(`[KeyPilot] Error processing text node ${i}:`, nodeError);
          continue;
        }
      }
      
      if (bestNode) {
        console.log('[KeyPilot] Found best text node at distance:', bestDistance);
      } else {
        console.log('[KeyPilot] No suitable text node found at position');
      }
      
      return bestNode;
    } catch (error) {
      console.error('[KeyPilot] Unexpected error finding text node at position:', error);
      return null;
    }
  }

  /**
   * Simple fallback method to find text nodes without shadow DOM support
   * @param {Element} element - Root element to search within
   * @returns {Text[]} - Array of text nodes found
   */
  findTextNodesInElementSimple(element) {
    const textNodes = [];
    
    try {
      if (!element) {
        return textNodes;
      }
      
      // Create tree walker for simple text node traversal
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            try {
              // Skip empty or whitespace-only text nodes
              if (!node.textContent || !node.textContent.trim()) {
                return NodeFilter.FILTER_REJECT;
              }
              
              // Check if text node is visible
              const parent = node.parentElement;
              if (!parent) {
                return NodeFilter.FILTER_REJECT;
              }
              
              return NodeFilter.FILTER_ACCEPT;
            } catch (error) {
              return NodeFilter.FILTER_REJECT;
            }
          }
        }
      );

      // Collect text nodes
      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }
    } catch (error) {
      console.warn('[KeyPilot] Error in simple text node search:', error);
    }
    
    return textNodes;
  }

  /**
   * Find all text nodes within an element, including shadow DOM boundaries
   * @param {Element} element - Root element to search within
   * @returns {Text[]} - Array of text nodes found
   */
  findTextNodesInElementWithShadowDOM(element) {
    const textNodes = [];
    
    try {
      // Helper function to traverse nodes recursively
      const traverseNodes = (root) => {
        if (!root) return;
        
        // Create tree walker for this root
        const walker = document.createTreeWalker(
          root,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              // Skip empty or whitespace-only text nodes
              if (!node.textContent.trim()) {
                return NodeFilter.FILTER_REJECT;
              }
              
              // Check if text node is visible and selectable
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              
              // Skip non-selectable parent elements
              if (this.isNonSelectableElement(parent)) {
                return NodeFilter.FILTER_REJECT;
              }
              
              try {
                const style = window.getComputedStyle(parent);
                if (style.display === 'none' || 
                    style.visibility === 'hidden' || 
                    style.userSelect === 'none') {
                  return NodeFilter.FILTER_REJECT;
                }
              } catch (error) {
                // If we can't get computed style, skip this node
                return NodeFilter.FILTER_REJECT;
              }
              
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );

        // Collect text nodes from this root
        let node;
        while (node = walker.nextNode()) {
          textNodes.push(node);
        }
        
        // Also traverse shadow DOM boundaries
        if (root.nodeType === Node.ELEMENT_NODE) {
          this.traverseShadowDOMForTextNodes(root, textNodes);
        }
      };
      
      // Start traversal from the given element
      traverseNodes(element);
      
    } catch (error) {
      console.warn('[KeyPilot] Error finding text nodes with shadow DOM support:', error);
    }
    
    return textNodes;
  }

  /**
   * Traverse shadow DOM boundaries to find text nodes
   * @param {Element} element - Element to check for shadow DOM
   * @param {Text[]} textNodes - Array to collect text nodes into
   */
  traverseShadowDOMForTextNodes(element, textNodes) {
    try {
      // Check if element has shadow root
      if (element.shadowRoot) {
        // Traverse the shadow root
        const shadowWalker = document.createTreeWalker(
          element.shadowRoot,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              // Skip empty or whitespace-only text nodes
              if (!node.textContent.trim()) {
                return NodeFilter.FILTER_REJECT;
              }
              
              // Check if text node is visible and selectable
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              
              // Skip non-selectable parent elements
              if (this.isNonSelectableElement(parent)) {
                return NodeFilter.FILTER_REJECT;
              }
              
              try {
                const style = window.getComputedStyle(parent);
                if (style.display === 'none' || 
                    style.visibility === 'hidden' || 
                    style.userSelect === 'none') {
                  return NodeFilter.FILTER_REJECT;
                }
              } catch (error) {
                // If we can't get computed style, skip this node
                return NodeFilter.FILTER_REJECT;
              }
              
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );

        // Collect text nodes from shadow root
        let shadowNode;
        while (shadowNode = shadowWalker.nextNode()) {
          textNodes.push(shadowNode);
        }
        
        // Recursively check shadow DOM elements for nested shadow roots
        const shadowElements = element.shadowRoot.querySelectorAll('*');
        for (const shadowElement of shadowElements) {
          this.traverseShadowDOMForTextNodes(shadowElement, textNodes);
        }
      }
      
      // Also check child elements for shadow roots
      const childElements = element.querySelectorAll('*');
      for (const childElement of childElements) {
        this.traverseShadowDOMForTextNodes(childElement, textNodes);
      }
      
    } catch (error) {
      console.warn('[KeyPilot] Error traversing shadow DOM for text nodes:', error);
    }
  }

  /**
   * Create a range for a text node, handling cross-boundary scenarios
   * @param {Text} textNode - Text node to create range for
   * @returns {Range|null} - Range object or null if creation fails
   */
  createRangeForTextNode(textNode) {
    try {
      // Determine which document to use for range creation
      const ownerDocument = textNode.ownerDocument || document;
      const range = ownerDocument.createRange();
      range.selectNodeContents(textNode);
      return range;
    } catch (error) {
      console.warn('[KeyPilot] Error creating range for text node:', error);
      return null;
    }
  }

  /**
   * Check if an element is non-selectable (images, buttons, inputs, etc.)
   * @param {Element} element - Element to check
   * @returns {boolean} - True if element should be skipped for text selection
   */
  isNonSelectableElement(element) {
    if (!element || !element.tagName) return true;
    
    const tagName = element.tagName.toLowerCase();
    
    // Skip form controls, media, and interactive elements
    const nonSelectableTags = [
      'img', 'video', 'audio', 'canvas', 'svg',
      'input', 'button', 'select', 'textarea',
      'iframe', 'embed', 'object'
    ];
    
    if (nonSelectableTags.includes(tagName)) {
      return true;
    }
    
    // Skip elements with specific roles
    const role = element.getAttribute('role');
    if (role && ['button', 'link', 'menuitem', 'tab'].includes(role)) {
      return true;
    }
    
    // Skip contenteditable elements (they handle their own selection)
    if (element.contentEditable === 'true') {
      return true;
    }
    
    return false;
  }

  /**
   * Calculate the text offset within a text node at the given screen coordinates
   * @param {Text} textNode - The text node
   * @param {number} x - Screen X coordinate  
   * @param {number} y - Screen Y coordinate
   * @returns {number} - Character offset within the text node
   */
  getTextOffsetAtPosition(textNode, x, y) {
    try {
      const text = textNode.textContent;
      if (!text) return 0;

      // Binary search to find the closest character position
      let left = 0;
      let right = text.length;
      let bestOffset = 0;
      let bestDistance = Infinity;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        
        try {
          // Create range at this offset
          const range = document.createRange();
          range.setStart(textNode, mid);
          range.setEnd(textNode, Math.min(mid + 1, text.length));
          
          const rect = range.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) {
            // Empty rect, try next position
            left = mid + 1;
            continue;
          }
          
          // Calculate distance from cursor to character position
          const charX = rect.left + rect.width / 2;
          const charY = rect.top + rect.height / 2;
          const distance = Math.sqrt(Math.pow(x - charX, 2) + Math.pow(y - charY, 2));
          
          if (distance < bestDistance) {
            bestDistance = distance;
            bestOffset = mid;
          }
          
          // Adjust search range based on position
          if (x < charX) {
            right = mid - 1;
          } else {
            left = mid + 1;
          }
        } catch (error) {
          // Skip problematic positions
          left = mid + 1;
        }
      }
      
      return bestOffset;
    } catch (error) {
      console.warn('[KeyPilot] Error calculating text offset:', error);
      return 0;
    }
  }

  handleRootKey() {
    console.log('[KeyPilot] Root key pressed!');
    console.log('[KeyPilot] Current URL:', window.location.href);
    console.log('[KeyPilot] Origin:', window.location.origin);

    // Navigate to the site root (origin)
    const rootUrl = window.location.origin;
    if (rootUrl && rootUrl !== window.location.href) {
      console.log('[KeyPilot] Navigating to root:', rootUrl);
      this.showFlashNotification('Navigating to Site Root...', COLORS.NOTIFICATION_INFO);
      window.location.href = rootUrl;
    } else {
      console.log('[KeyPilot] Already at root, no navigation needed');
    }
  }

  handleCloseTabKey() {
    console.log('[KeyPilot] Close tab key pressed!');
    
    try {
      // Send message to background script to close the current tab
      chrome.runtime.sendMessage({ type: 'KP_CLOSE_TAB' });
      this.showFlashNotification('Closing Tab...', COLORS.NOTIFICATION_INFO);
    } catch (error) {
      console.error('[KeyPilot] Failed to close tab:', error);
      this.showFlashNotification('Failed to Close Tab', COLORS.NOTIFICATION_ERROR);
    }
  }

  handleNewTabKey() {
    console.log('[KeyPilot] New tab key pressed!');
    
    try {
      // Send message to background script to open a new tab
      chrome.runtime.sendMessage({ type: 'KP_NEW_TAB' });
      this.showFlashNotification('Opening New Tab...', COLORS.NOTIFICATION_INFO);
      this.emitAction('newTab');
    } catch (error) {
      console.error('[KeyPilot] Failed to open new tab:', error);
      this.showFlashNotification('Failed to Open New Tab', COLORS.NOTIFICATION_ERROR);
    }
  }

  handleActivateKey() {
    const currentState = this.state.getState();
    const target = currentState.focusEl ||
      this.detector.deepElementFromPoint(currentState.lastMouse.x, currentState.lastMouse.y);

    if (!target || target === document.documentElement || target === document.body) {
      return;
    }

    // Popover mode is modal: don't allow activation on background page elements.
    if (currentState.mode === MODES.POPOVER) {
      const popoverContainer = this.overlayManager?.popoverContainer;
      if (popoverContainer instanceof Element && target instanceof Element && !popoverContainer.contains(target)) {
        return;
      }
    }

    console.log('[KeyPilot] Activating element:', {
      tagName: target.tagName,
      className: target.className,
      id: target.id,
      hasClickHandler: !!(target.onclick || target.getAttribute('onclick'))
    });

    const activationDetail = this._buildActivationDetail(target);

    // Store coordinates if this is a link click
    if (target.tagName === 'A' && target.href) {
      this.mouseCoordinateManager.handleLinkClick(currentState.lastMouse.x, currentState.lastMouse.y, target);
    }

    // Try semantic activation first
    if (this.activator.handleSmartActivate(target, currentState.lastMouse.x, currentState.lastMouse.y)) {
      this.showRipple(currentState.lastMouse.x, currentState.lastMouse.y);
      this.overlayManager.flashFocusOverlay();
      this.postClickRefresh(target, currentState.lastMouse.x, currentState.lastMouse.y);
      this.emitAction('activate', activationDetail);
      return;
    }

    // Always try to click the element, regardless of whether it's "detected" as interactive
    // This ensures videos, custom elements, and other non-standard interactive elements work
    this.activator.smartClick(target, currentState.lastMouse.x, currentState.lastMouse.y);
    this.showRipple(currentState.lastMouse.x, currentState.lastMouse.y);
    this.overlayManager.flashFocusOverlay();
    this.postClickRefresh(target, currentState.lastMouse.x, currentState.lastMouse.y);
    this.emitAction('activate', activationDetail);
  }

  handleActivateNewTabKey() {
    const currentState = this.state.getState();
    const target = currentState.focusEl ||
      this.detector.deepElementFromPoint(currentState.lastMouse.x, currentState.lastMouse.y);

    if (!target || target === document.documentElement || target === document.body) {
      return;
    }

    // Popover mode is modal: don't allow activation on background page elements.
    if (currentState.mode === MODES.POPOVER) {
      const popoverContainer = this.overlayManager?.popoverContainer;
      if (popoverContainer instanceof Element && target instanceof Element && !popoverContainer.contains(target)) {
        return;
      }
    }

    console.log('[KeyPilot] Activating element in new tab:', {
      tagName: target.tagName,
      className: target.className,
      id: target.id,
      hasClickHandler: !!(target.onclick || target.getAttribute('onclick'))
    });

    // If we're on/inside a link, open via background script so we can reliably focus the new tab.
    let link = target;
    try {
      if (link && link.tagName !== 'A' && typeof link.closest === 'function') {
        link = link.closest('a[href]');
      }
    } catch { }

    if (link && link.tagName === 'A' && link.href) {
      this.mouseCoordinateManager.handleLinkClick(currentState.lastMouse.x, currentState.lastMouse.y, link);

      try {
        chrome.runtime.sendMessage({ type: 'KP_OPEN_URL_FOREGROUND', url: link.href });
        this.showRipple(currentState.lastMouse.x, currentState.lastMouse.y);
        this.overlayManager.flashFocusOverlay();
        this.postClickRefresh(link, currentState.lastMouse.x, currentState.lastMouse.y);
        this.emitAction('activateNewTab', { isLink: true, href: link.href });
        return;
      } catch (error) {
        console.error('[KeyPilot] Failed to open link in foreground tab:', error);
        // Fall through to legacy behavior below.
      }
    }

    // Try semantic activation first (but force new tab for links)
    if (this.activator.handleSmartActivate(target, currentState.lastMouse.x, currentState.lastMouse.y, true)) {
      this.showRipple(currentState.lastMouse.x, currentState.lastMouse.y);
      this.overlayManager.flashFocusOverlay();
      this.postClickRefresh(target, currentState.lastMouse.x, currentState.lastMouse.y);
      this.emitAction('activateNewTab', this._buildActivationDetail(target));
      return;
    }

    // Always try to click the element in new tab mode
    this.activator.smartClick(target, currentState.lastMouse.x, currentState.lastMouse.y, true);
    this.showRipple(currentState.lastMouse.x, currentState.lastMouse.y);
    this.overlayManager.flashFocusOverlay();
    this.postClickRefresh(target, currentState.lastMouse.x, currentState.lastMouse.y);
    this.emitAction('activateNewTab', this._buildActivationDetail(target));
  }

  handleActivateNewTabOverKey() {
    const currentState = this.state.getState();
    const target = currentState.focusEl ||
      this.detector.deepElementFromPoint(currentState.lastMouse.x, currentState.lastMouse.y);

    if (!target || target === document.documentElement || target === document.body) {
      return;
    }

    // Popover mode is modal: don't allow activation on background page elements.
    if (currentState.mode === MODES.POPOVER) {
      const popoverContainer = this.overlayManager?.popoverContainer;
      if (popoverContainer instanceof Element && target instanceof Element && !popoverContainer.contains(target)) {
        return;
      }
    }

    // Find the closest anchor element if the target is inside a link
    let link = target;
    if (link.tagName !== 'A') {
      link = link.closest('a[href]');
    }

    // Only work if we have a hyperlink
    if (!link || link.tagName !== 'A' || !link.href) {
      console.log('[KeyPilot] Activate New Tab Over: not hovering over a hyperlink');
      return;
    }

    console.log('[KeyPilot] Opening link in new tab (background):', link.href);

    // Store coordinates for link click
    this.mouseCoordinateManager.handleLinkClick(currentState.lastMouse.x, currentState.lastMouse.y, link);

    // Open link in a background tab (middle-click style: do NOT switch/focus the new tab).
    try {
      chrome.runtime.sendMessage({ type: 'KP_OPEN_URL_BACKGROUND', url: link.href });
      this.showRipple(currentState.lastMouse.x, currentState.lastMouse.y);
      this.overlayManager.flashFocusOverlay();
      this.postClickRefresh(link, currentState.lastMouse.x, currentState.lastMouse.y);
      this.emitAction('activateNewTabBackground', { isLink: true, href: link.href });
    } catch (error) {
      console.error('[KeyPilot] Failed to open link in background tab:', error);
      // Fallback (may focus the new tab depending on browser/user settings).
      try { window.open(link.href, '_blank', 'noopener,noreferrer'); } catch { }
    }
  }

  handleOpenPopover() {
    const currentState = this.state.getState();
    const target = currentState.focusEl ||
      this.detector.deepElementFromPoint(currentState.lastMouse.x, currentState.lastMouse.y);

    // Resolve to the closest anchor (including within shadow DOM).
    // deepElementFromPoint() often returns a child <div> inside a link (e.g. archive.org
    // `div#collection-image-title` inside a shadow-root <a href=...>), so requiring
    // target.tagName === 'A' is too strict.
    if (!target || !(target instanceof Element)) {
      console.log('[KeyPilot] Open popover: not hovering over a link');
      return;
    }

    let probe = target;
    let link = probe;
    if (link.tagName !== 'A') {
      link = link.closest('a[href]');
    }

    // If we're inside a shadow root and closest() didn't find it, walk up to the host and retry.
    // This allows resolving links that span across shadow boundaries (common with web-components).
    let guard = 0;
    while ((!link || link.tagName !== 'A' || !link.href) && guard++ < 10) {
      const root = probe.getRootNode?.();
      if (!(root instanceof ShadowRoot) || !(root.host instanceof Element)) break;
      probe = root.host;
      link = probe.closest?.('a[href]') || probe;
      if (link && link.tagName === 'A' && link.href) break;
    }

    if (!link || link.tagName !== 'A' || !link.href) {
      console.log('[KeyPilot] Open popover: not hovering over a link');
      return;
    }

    const url = link.href;
    console.log('[KeyPilot] Opening popover for link:', url);

    // Show popover
    this.overlayManager.showPopover(url);
    this.state.setPopoverOpen(true, url);
  }

  getSettingsPopoverUrl() {
    try {
      return chrome.runtime.getURL('pages/settings.html');
    } catch {
      return null;
    }
  }

  getGuidePopoverUrl() {
    try {
      return chrome.runtime.getURL('pages/guide.html');
    } catch {
      return null;
    }
  }

  handleOpenSettingsPopover() {
    const url = this.getSettingsPopoverUrl();
    if (!url) return;

    // Close any existing popover first (e.g., if opened from Guide)
    const currentState = this.state.getState();
    if (currentState.mode === MODES.POPOVER) {
      this.handleClosePopover();
    }

    // Calculate settings container dimensions + 10pt padding
    // The settings container has max-width: 920px and padding: 18px on each side
    const settingsContainerWidth = Math.min(920, window.innerWidth - 36) + 20; // 920px max + 10pt padding each side
    const settingsContainerHeight = Math.min(window.innerHeight * 0.8, window.innerHeight - 100) + 20; // Use 80vh max + 10pt padding each side

    this.overlayManager.showPopover(url, {
      title: 'KeyPilot Settings',
      hintKeyLabel: "'",
      closeKeys: ['Escape', "'", '"'],
      width: `${settingsContainerWidth}px`,
      height: `${settingsContainerHeight}px`
    });
    this.state.setPopoverOpen(true, url);
  }

  handleToggleSettingsPopover() {
    // Only operate in the top frame to avoid duplicates.
    if (window !== window.top) return;
    const currentState = this.state.getState();
    const settingsUrl = this.getSettingsPopoverUrl();
    if (!settingsUrl) return;

    if (currentState.mode === MODES.POPOVER && currentState.popoverUrl === settingsUrl) {
      this.handleClosePopover();
      return;
    }

    this.handleOpenSettingsPopover();
  }

  handleOpenGuidePopover() {
    const url = this.getGuidePopoverUrl();
    if (!url) return;

    // Close any existing popover first (e.g., if opened from Settings)
    const currentState = this.state.getState();
    if (currentState.mode === MODES.POPOVER) {
      this.handleClosePopover();
    }

    // Calculate guide container dimensions + 10pt padding
    // The guide container has max-width: 920px and padding: 18px on each side (same as settings)
    const guideContainerWidth = Math.min(920, window.innerWidth - 36) + 20; // 920px max + 10pt padding each side
    const guideContainerHeight = Math.min(window.innerHeight * 0.8, window.innerHeight - 100) + 20; // Use 80vh max + 10pt padding each side

    this.overlayManager.showPopover(url, {
      title: 'KeyPilot Guide',
      hintKeyLabel: 'Esc',
      closeKeys: ['Escape', "'", '"', 'e', 'E'],
      width: `${guideContainerWidth}px`,
      height: `${guideContainerHeight}px`
    });
    this.state.setPopoverOpen(true, url);
  }

  handleClosePopover() {
    console.log('[KeyPilot] Closing popover');
    this.overlayManager.hidePopover();
    this.state.setPopoverOpen(false, null);
  }

  handleToggleTabHistoryPopover() {
    // Only operate in the top frame to avoid duplicates.
    if (window !== window.top) return;
    try {
      this.tabHistoryPopover?.toggle?.();
    } catch (e) {
      console.warn('[KeyPilot] Failed to toggle tab history popover:', e);
    }
  }

  handleToggleKeyboardHelp() {
    try {
      const next = !this._keyboardHelpVisible;
      this.applyKeyboardHelpVisibility(next, { persist: true });
      this.emitAction('toggleKeyboardHelp', { visible: next });
    } catch (e) {
      console.warn('[KeyPilot] Failed to toggle keyboard reference:', e);
    }
  }

  deleteElement(element) {
    if (!element || element === document.documentElement || element === document.body) {
      return;
    }

    try {
      element.remove();
    } catch (error) {
      // Fallback: hide element
      try {
        element.classList.add('kpv2-hidden');
        element.setAttribute('aria-hidden', 'true');
      } catch { }
    }
  }

  handleEscapeFromTextFocus(currentState) {
    console.debug('Escape pressed in text focus mode (exit only)');

    // Cancel any hover-click countdown/armed UI.
    this._disarmTextModeClick();
    try { this.state.setFocusElement(null); } catch { /* ignore */ }

    // Use the simple, proven approach that works in DevTools
    // Blur the active element and set focus to the body
    if (document.activeElement) {
      document.activeElement.blur();
    }
    document.body.focus();

    // Clear the text focus state
    this.focusDetector.clearTextFocus();

    console.debug('Text focus escape completed');
  }

  /**
   * Cancel all active modes and return to normal mode
   * Handles mode-specific cleanup logic
   */
  cancelModes() {
    const currentState = this.state.getState();
    
    console.log('[KeyPilot] Canceling modes, current mode:', currentState.mode);
    
    // Handle highlight mode cancellation specifically
    if (currentState.mode === MODES.HIGHLIGHT) {
      this.cancelHighlightMode();
      return;
    }
    
    // Handle popover mode cancellation
    if (currentState.mode === MODES.POPOVER) {
      this.handleClosePopover();
      return;
    }

    // Handle omnibox mode cancellation
    if (currentState.mode === MODES.OMNIBOX) {
      this.handleCloseOmnibox();
      return;
    }
    
    // Don't reset if we're in text focus mode - that should only be cleared by ESC or blur
    if (currentState.mode !== MODES.TEXT_FOCUS) {
      this.state.reset();
    }
  }

  handleOpenOmnibox() {
    try {
      if (window !== window.top) return;
      // Omnibox should not be affected by text focus mode.
      // If the user was in text mode, clear it before opening omnibox.
      try { this._disarmTextModeClick?.(); } catch { /* ignore */ }
      try { this.focusDetector?.clearTextFocus?.(); } catch { /* ignore */ }
      this.state.setMode(MODES.OMNIBOX);
      this.omniboxManager?.show?.('');
    } catch (e) {
      console.warn('[KeyPilot] Failed to open omnibox:', e);
    }
  }

  handleCloseOmnibox() {
    try {
      if (window !== window.top) return;
      this.omniboxManager?.hide?.();
      this.state.setMode(MODES.NONE);
    } catch (e) {
      console.warn('[KeyPilot] Failed to close omnibox:', e);
    }
  }

  showRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.className = CSS_CLASSES.RIPPLE;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.appendChild(ripple);

    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }

  showFlashNotification(message, backgroundColor = COLORS.NOTIFICATION_SUCCESS) {
    try {
      // Validate input parameters
      if (!message || typeof message !== 'string') {
        console.warn('[KeyPilot] Invalid message provided to showFlashNotification:', message);
        return;
      }
      
      if (!backgroundColor || typeof backgroundColor !== 'string') {
        console.warn('[KeyPilot] Invalid backgroundColor provided, using default');
        backgroundColor = COLORS.NOTIFICATION_SUCCESS;
      }
      
      // Validate document availability
      if (!document || !document.body) {
        console.warn('[KeyPilot] Document or document.body not available for notification');
        return;
      }
      
      // Create notification overlay with error handling
      let notification = null;
      try {
        notification = document.createElement('div');
        if (!notification) {
          throw new Error('Failed to create notification element');
        }
      } catch (createError) {
        console.error('[KeyPilot] Error creating notification element:', createError);
        return;
      }
      
      notification.className = 'kpv2-flash-notification';
      notification.textContent = message;
      
      // Style the notification with error handling
      try {
        Object.assign(notification.style, {
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: backgroundColor,
          color: 'white',
          padding: '12px 24px',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '500',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          zIndex: String(Z_INDEX.NOTIFICATION),
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          opacity: '0',
          transition: 'opacity 0.3s ease-in-out',
          pointerEvents: 'none',
          maxWidth: '400px',
          wordWrap: 'break-word',
          textAlign: 'center'
        });
      } catch (styleError) {
        console.error('[KeyPilot] Error styling notification:', styleError);
        // Continue with basic styling
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.left = '50%';
        notification.style.backgroundColor = backgroundColor;
        notification.style.color = 'white';
        notification.style.padding = '12px 24px';
        notification.style.zIndex = String(Z_INDEX.NOTIFICATION);
      }

      // Add to document with error handling
      try {
        document.body.appendChild(notification);
      } catch (appendError) {
        console.error('[KeyPilot] Error appending notification to document:', appendError);
        return;
      }

      // Show notification immediately (animation removed)
      notification.style.opacity = '1';

      // Fade out and remove after appropriate duration based on message type
      const duration = backgroundColor === COLORS.NOTIFICATION_ERROR ? 4000 : 2000; // Show errors longer
      
      setTimeout(() => {
        try {
          if (notification && notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        } catch (removeError) {
          console.warn('[KeyPilot] Error removing notification:', removeError);
        }
      }, duration);
      
    } catch (error) {
      console.error('[KeyPilot] Unexpected error showing flash notification:', error);
      
      // Fallback: try to show a basic alert if available
      try {
        if (window.alert && typeof window.alert === 'function') {
          window.alert(`KeyPilot: ${message}`);
        }
      } catch (alertError) {
        console.error('[KeyPilot] Even alert fallback failed:', alertError);
      }
    }
  }

  updateOverlays(focusEl, deleteEl) {
    // Don't update overlays if extension is disabled
    if (!this.enabled) {
      return;
    }

    const currentState = this.state.getState();

    // Display-only coalescing: for same-destination link clusters, draw a single unioned rect
    // to reduce flicker while preserving correct element selection for clicks.
    let focusRectOverride = null;
    try {
      if (focusEl &&
          this.intersectionManager &&
          typeof this.intersectionManager.getDisplayRectForElement === 'function') {
        focusRectOverride = this.intersectionManager.getDisplayRectForElement(focusEl, { tolerancePx: 6 });
      }
    } catch { /* ignore */ }

    this.overlayManager.updateOverlays(
      focusEl,
      deleteEl,
      currentState.mode,
      currentState.focusedTextElement,
      focusRectOverride
    );
  }

  logPerformanceMetrics() {
    const now = Date.now();
    const timeSinceLastLog = now - this.performanceMetrics.lastMetricsLog;
    
    if (timeSinceLastLog < 10000) return; // Only log every 10 seconds
    
    const intersectionMetrics = this.intersectionManager.getMetrics();
    const scrollMetrics = this.scrollManager.getScrollMetrics();
    
    console.group('[KeyPilot] Performance Metrics');
    console.log('Mouse Queries:', this.performanceMetrics.mouseQueries);
    console.log('Intersection Observer Cache Hit Rate:', intersectionMetrics.cacheHitRate);
    console.log('Visible Interactive Elements:', intersectionMetrics.visibleElements);
    console.log('Scroll Throttle Ratio:', scrollMetrics.throttleRatio);
    console.log('Average Scroll Duration:', `${scrollMetrics.averageScrollDuration.toFixed(1)}ms`);
    console.groupEnd();
    
    this.performanceMetrics.lastMetricsLog = now;
  }

  /**
   * Enable KeyPilot functionality
   */
  async enable() {
    if (this.enabled) return;
    
    this.enabled = true;
    
    // Only initialize if initialization is complete
    if (this.initializationComplete) {
      // Restart event listeners
      this.start();
      
      // Show cursor
      if (this.cursor) {
        this.cursor.show();
      }
      
      // Restart focus detector
      if (this.focusDetector) {
        this.focusDetector.start();
      }
      
      // Restart intersection manager
      if (this.intersectionManager) {
        await this.intersectionManager.init();
      }
      
      // Restart scroll manager
      if (this.scrollManager) {
        this.scrollManager.init();
      }
      
      // Reset state to normal mode
      this.state.reset();
    }

    // Restore keyboard reference UI based on persisted state.
    // Fire-and-forget: we don't want to block enable() on storage.
    try {
      this.refreshKeyboardHelpVisibilityFromStorage();
    } catch { /* ignore */ }
    
    console.log('[KeyPilot] Extension enabled');
  }

  /**
   * Disable KeyPilot functionality
   */
  disable() {
    if (!this.enabled) return;
    
    this.enabled = false;
    
    // Only cleanup if initialization is complete
    if (this.initializationComplete) {
      // Stop event listeners
      this.stop();
      
      // Hide cursor
      if (this.cursor) {
        this.cursor.hide();
      }
      
      // Hide all overlays
      if (this.overlayManager) {
        this.overlayManager.hideFocusOverlay();
        this.overlayManager.hideDeleteOverlay();
        this.overlayManager.hideEscExitLabel();
        this.overlayManager.hideActiveTextInputFrame();
        this.overlayManager.hideFocusedTextOverlay();
      }
      
      // Stop focus detector
      if (this.focusDetector) {
        this.focusDetector.stop();
      }
      
      // Clean up intersection manager
      if (this.intersectionManager) {
        this.intersectionManager.cleanup();
      }
      
      // Clean up scroll manager
      if (this.scrollManager) {
        this.scrollManager.cleanup();
      }
      
      // Clean up edge-only processing
      if (this.rectangleIntersectionObserver) {
        this.rectangleIntersectionObserver.cleanup();
        this.rectangleIntersectionObserver = null;
      }
      
      // Clear any active state
      this.state.reset();
    }

    // Always remove the floating help panel when disabled (state is persisted separately).
    if (this.floatingKeyboardHelp) {
      try {
        this.floatingKeyboardHelp.cleanup();
      } catch { /* ignore */ }
      this.floatingKeyboardHelp = null;
    }
    
    console.log('[KeyPilot] Extension disabled');
  }

  /**
   * Initialize cursor position using stored coordinates or fallback
   */
  async initializeCursorPosition() {
    const currentState = this.state.getState();
    
    // If mouse position hasn't been set yet (still at 0,0), initialize with stored coordinates or fallback
    if (currentState.lastMouse.x === 0 && currentState.lastMouse.y === 0) {
      // Get initial position from mouse coordinate manager
      const initialPosition = this.mouseCoordinateManager.getInitialCursorPosition();
      
      console.log('[KeyPilot] Initializing cursor position:', initialPosition);
      
      this.state.setMousePosition(initialPosition.x, initialPosition.y);
      this.cursor.updatePosition(initialPosition.x, initialPosition.y);
      
      // Start inactive mouse monitoring if enabled
      this.mouseCoordinateManager.startInactiveMouseMonitoring();
    }
  }

  /**
   * Check if KeyPilot is currently enabled
   */
  isEnabled() {
    return this.enabled;
  }

  cleanup() {
    this.stop();
    // Clean up intersection observer optimizations
    if (this.intersectionManager) {
      this.intersectionManager.cleanup();
    }
    
    if (this.scrollManager) {
      this.scrollManager.cleanup();
    }

    if (this.focusDetector) {
      this.focusDetector.stop();
    }

    if (this.mouseCoordinateManager) {
      this.mouseCoordinateManager.cleanup();
    }

    if (this.cursor) {
      this.cursor.cleanup();
    }

    if (this.overlayManager) {
      this.overlayManager.cleanup();
    }

    if (this.styleManager) {
      this.styleManager.cleanup();
    }

    if (this.shadowDOMManager) {
      this.shadowDOMManager.cleanup();
    }
    
    // Remove custom event listeners
    if (this._boundScrollEndHandler) {
      document.removeEventListener('keypilot:scroll-end', this._boundScrollEndHandler);
      this._boundScrollEndHandler = null;
    }
  }
}