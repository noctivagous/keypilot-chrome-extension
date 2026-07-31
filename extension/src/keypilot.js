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
import { MODES, CURSOR_MODE, CSS_CLASSES, COLORS, Z_INDEX, RECTANGLE_SELECTION, EDGE_ONLY_SELECTION, FEATURE_FLAGS, SCROLL, CLICKABLE_CATEGORY } from './config/constants.js';
import { MSG } from './messaging/types.js';
import { buildKeybindingsForLayout, DEFAULT_KEYBOARD_LAYOUT_ID, getKeyboardUiLayoutForLayout, normalizeKeyboardLayoutId } from './config/keyboard-layouts.js';
import { FloatingKeyboardHelp } from './ui/floating-keyboard-help.js';
import { ControlStrip } from './ui/control-strip.js';
import { OmniboxManager } from './modules/omnibox-manager.js';
import { TabHistoryPopover } from './modules/tab-history-popover.js';
import { LauncherPopover } from './modules/launcher-popover.js';
import { DEFAULT_SETTINGS, getSettings, setSettings, SETTINGS_STORAGE_KEY, scrollBehaviorFromSpeed } from './modules/settings-manager.js';
import {
  isExtensionContextValid,
  noteExtensionContextError,
  safeRuntimeSendMessage
} from './utils/extension-context.js';
import { storageGetValue, storageSetValue } from './utils/storage.js';
import { getHoveredImage } from './utils/image-utils.js';

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
    this.controlStrip = null;
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
      popupManager: this.overlayManager?.popupManager,
      onStateChange: (open) => {
        this.state.setPopoverOpen(open, open ? 'tab-history' : null);
      }
    });
    this.launcherPopover = new LauncherPopover(this);
    this.KEYBOARD_HELP_STORAGE_KEY = 'keypilot_keyboard_help_visible';
    this._keyboardHelpVisible = false;
    this._keyboardHelpStorageListener = null;

    // Link-hover → keyboard key glow (debounced; video thumbs thrash focusEl).
    this._LINK_HOVER_HINT_DEBOUNCE_MS = 90;
    this._linkHoverHintTimer = null;
    this._linkHoverHintPendingState = null;
    /** @type {boolean|null} */
    this._linkHoverHintLastApplied = null;
    
    // Intersection Observer optimizations
    this.intersectionManager = new IntersectionObserverManager(this.detector);
    this.scrollManager = new OptimizedScrollManager(this.overlayManager, this.state, {
      // Live-refresh text/rectangle selection overlays every scroll frame (~60fps).
      onScrollFrame: () => this.refreshHighlightDuringScroll()
    });

    // Permanent hover targeting: browser-native DOM hover listeners drive focusEl
    // during normal browsing. RBush spatial indexing is retired (see architecture audit).
    this._domHoverListenersEnabled = true;
    
    // Panel tracking for negative regions
    this._panelTrackingInterval = null;
    this._lastPanelCheck = 0;
    
    // Edge-only rectangle intersection observer for performance optimization
    this.rectangleIntersectionObserver = null;
    this.edgeOnlyProcessingEnabled = FEATURE_FLAGS.ENABLE_EDGE_ONLY_PROCESSING;

    // Mouse movement optimization: only query every 2+ pixels (increased threshold)
    this.lastQueryPosition = { x: -1, y: -1 };
    this.MOUSE_QUERY_THRESHOLD = 1;
    // Highlight selection updates: last cursor pos we applied (avoid thrashing on micro-moves)
    this._lastHighlightUpdatePos = { x: -1, y: -1 };
    this._HIGHLIGHT_UPDATE_THRESHOLD = 2;
    // Prevent re-entrant completeSelection / updates while finishing a session
    this._completingHighlight = false;
    
    // Mousemove hot-path optimization: coalesce hover work to once-per-frame.
    // We still update cursor position immediately, but defer expensive hit-testing work.
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

  _handleDomHoverChange(el) {
    try {
      if (!this.enabled) return;
      const currentState = this.state.getState();
      // Only drive hover selection in normal browsing mode.
      if (currentState.mode !== MODES.NONE) return;

      let next = (el && el.nodeType === 1) ? el : null;
      // HTML/BODY are too coarse — treat as clear so hover chrome does not stick.
      try {
        if (next && (next.tagName === 'HTML' || next.tagName === 'BODY')) next = null;
      } catch { /* ignore */ }

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] DOM hover change:', {
          element: next?.tagName,
          href: next?.href,
          currentFocusEl: currentState.focusEl?.tagName
        });
      }

      if (next !== currentState.focusEl) {
        this.state.setFocusElement(next);
      }
    } catch { /* ignore */ }
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

  _isKeyPilotUiElement(el) {
    try {
      let n = el;
      let guard = 0;
      while (n && n.nodeType === 1 && guard++ < 12) {
        const id = typeof n.id === 'string' ? n.id : '';
        if (id && id.startsWith('kpv2-')) return true;
        const cl = n.classList;
        if (cl && cl.length) {
          for (const c of cl) {
            if (typeof c === 'string' && c.startsWith('kpv2-')) return true;
          }
        }
        n = n.parentElement;
      }
    } catch { /* ignore */ }
    return false;
  }

  /**
   * Check if an element is inside a valid popover container (iframe or popupManager modal)
   * @param {Element} el
   * @returns {boolean}
   */
  _isElementInPopover(el) {
    if (!el || !(el instanceof Element)) return false;

    // Check iframe popover container
    const iframeContainer = this.overlayManager?.popoverContainer;
    if (iframeContainer instanceof Element && iframeContainer.contains(el)) {
      return true;
    }

    // Check popupManager modal
    const modalPanel = this.overlayManager?.popupManager?.top()?.panel;
    if (modalPanel instanceof Element && modalPanel.contains(el)) {
      return true;
    }

    return false;
  }

  /**
   * When DOM-hover listener mode is enabled, `state.focusEl` is driven by delegated hover events.
   * However, if the DOM changes under a stationary pointer (menus, dialogs, overlays), hover events
   * may not fire and `focusEl` can become stale. This helper validates focusEl against the actual
   * element under the cursor at activation time.
   */
  _getValidatedActivationTarget(currentState) {
    const st = currentState || this.state.getState();
    const x = st?.lastMouse?.x;
    const y = st?.lastMouse?.y;
    const focus = st?.focusEl;

    let under = null;
    try {
      if (typeof x === 'number' && typeof y === 'number') {
        under = this.detector.deepElementFromPoint(x, y);
      }
    } catch { /* ignore */ }

    try {
      if (under && this._isKeyPilotUiElement(under)) {
        // Allow activation on KeyPilot UI elements that represent clickable content (e.g. history rows with data-kp-url)
        if (!(under instanceof Element) ||
            !(under.getAttribute('role') === 'link' && under.dataset?.kpUrl)) {
          under = null;
        }
      }
    } catch { /* ignore */ }

    let target = focus || under;

    // In DOM-hover mode, prefer focusEl when it's consistent with what's actually under the pointer.
    // If not, fall back to a fresh under-cursor pick to avoid clicking stale targets.
    try {
      if (this._domHoverListenersEnabled && focus && under && focus instanceof Element && under instanceof Element) {
        const consistent = focus.contains(under) || under.contains(focus);
        if (!consistent) {
          // Map under->clickable ancestor for better semantics (e.g. hovering a child inside a button).
          const clickableUnder = this.detector.findClickable(under) || under;
          target = clickableUnder;
        }
      }
    } catch { /* ignore */ }

    return target;
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
      isKeyboardHelpKey: false,
      category: CLICKABLE_CATEGORY.NONE
    };

    try {
      const el = target instanceof Element ? target : null;

      // Category is the source of truth for "is this a link?" — sliders/media/buttons
      // must not be reported as links even when nested near anchors in a player bar.
      if (el && this.detector?.getClickableCategory) {
        detail.category = this.detector.getClickableCategory(el);
      }

      if (detail.category === CLICKABLE_CATEGORY.LINK) {
        detail.isLink = true;
        // Resolve href from the element or a link-like host.
        if (el && el.tagName === 'A' && /** @type {any} */ (el).href) {
          detail.href = /** @type {any} */ (el).href;
        } else if (el && typeof el.closest === 'function') {
          const a = el.closest('a[href]');
          if (a && /** @type {any} */ (a).href) detail.href = /** @type {any} */ (a).href;
          if (!detail.href) {
            const linkish = /** @type {HTMLElement|null} */ (el.closest('[role="link"]'));
            const kpUrl = linkish?.dataset?.kpUrl ? String(linkish.dataset.kpUrl) : '';
            if (kpUrl) detail.href = kpUrl;
          }
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

    try {
      const el = target instanceof Element ? target : null;
      if (el && typeof el.closest === 'function' && el.closest('.kp-control-strip')) {
        detail.isControlStrip = true;
      }
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
      this.overlayManager.flashFocusOverlay(target);
      this.postClickRefresh(target, currentState.lastMouse.x, currentState.lastMouse.y);
    } else {
      // Fallback to click
      this.activator.smartClick(target, currentState.lastMouse.x, currentState.lastMouse.y);
      this.showRipple(currentState.lastMouse.x, currentState.lastMouse.y);
      this.overlayManager.flashFocusOverlay(target);
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

    // Control strip (upper-left): survives disable so On/Off remains available.
    this.setupControlStrip();
    this.applyControlStripFromSettings();

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

    // Control strip visibility / collapsed state.
    try {
      this.applyControlStripFromSettings();
    } catch { /* ignore */ }
  }

  /**
   * Create the control strip host (top frame only). Safe to call multiple times.
   * Kept alive while KeyPilot is disabled so On/Off can re-enable the extension.
   */
  setupControlStrip() {
    if (window !== window.top) return;
    if (this.controlStrip) {
      this._wireControlStripHandlers();
      this._syncControlStripEnabledFromRuntime();
      return;
    }
    try {
      const ControlStripClass = ControlStrip || window.ControlStrip;
      if (!ControlStripClass) return;
      this.controlStrip = new ControlStripClass();
      this._wireControlStripHandlers();
      this.controlStrip.setKeyboardHelpActive(!!this._keyboardHelpVisible);
      this._syncControlStripEnabledFromRuntime();
    } catch (e) {
      console.warn('[KeyPilot] Failed to create control strip:', e);
      this.controlStrip = null;
    }
  }

  /**
   * Prefer toggle-handler state (global source of truth), then KeyPilot.enabled.
   */
  _syncControlStripEnabledFromRuntime() {
    if (!this.controlStrip) return;
    let on = !!this.enabled;
    try {
      const th = window.__KeyPilotToggleHandler;
      if (th && typeof th.isEnabled === 'function') {
        on = !!th.isEnabled();
      } else if (th && typeof th.enabled === 'boolean') {
        on = !!th.enabled;
      }
    } catch { /* ignore */ }
    try {
      this.controlStrip.setEnabledState(on);
    } catch { /* ignore */ }
  }

  _wireControlStripHandlers() {
    if (!this.controlStrip || typeof this.controlStrip.setHandlers !== 'function') return;
    this.controlStrip.setHandlers({
      onToggleEnabled: () => {
        this._sendRuntimeMessage({ type: MSG.TOGGLE_STATE }, { silent: true });
      },
      onToggleKeyboard: () => {
        if (!this.enabled) return;
        const next = !this._keyboardHelpVisible;
        this.applyKeyboardHelpVisibility(next, { persist: true });
      },
      onOpenSettings: () => {
        if (!this.enabled) return;
        try {
          this.handleOpenSettingsPopover();
        } catch (e) {
          console.warn('[KeyPilot] Control strip open settings failed:', e);
        }
      },
      onCollapseChange: (collapsed) => {
        void setSettings({ controlStrip: { collapsed: !!collapsed } });
      },
      onClose: () => {
        void setSettings({ controlStrip: { visible: false } });
      }
    });
  }

  /**
   * Apply control strip visibility + collapsed from settings (or defaults).
   */
  applyControlStripFromSettings() {
    if (window !== window.top) return;
    this.setupControlStrip();
    if (!this.controlStrip) return;

    const cs = this._settings?.controlStrip || DEFAULT_SETTINGS.controlStrip || {};
    const visible = cs.visible !== false;
    const collapsed = !!cs.collapsed;

    this._syncControlStripEnabledFromRuntime();
    this.controlStrip.setKeyboardHelpActive(!!this._keyboardHelpVisible);
    // Avoid re-notifying storage when applying remote settings.
    this.controlStrip.setCollapsed(collapsed, { notify: false });
    this.controlStrip.setVisible(visible);
  }

  /**
   * Show the control strip (Alt+J). Persists visible=true and expands for discoverability.
   */
  async showControlStripFromHotkey() {
    if (window !== window.top) return;
    this.setupControlStrip();
    try {
      await setSettings({ controlStrip: { visible: true, collapsed: false } });
    } catch { /* ignore */ }
    try {
      if (this._settings) {
        this._settings.controlStrip = {
          ...(this._settings.controlStrip || DEFAULT_SETTINGS.controlStrip),
          visible: true,
          collapsed: false
        };
      }
    } catch { /* ignore */ }
    this.applyControlStripFromSettings();
  }

  _applyKeyboardLayoutFromSettings() {
    const layoutId = normalizeKeyboardLayoutId(this._settings?.keyboardLayoutId);
    this._keyboardLayoutId = layoutId;
    this.keybindings = buildKeybindingsForLayout(layoutId);
    this._keyboardUiLayout = getKeyboardUiLayoutForLayout(layoutId);

    // Keep text-input SVG background hints in sync with layout-bound keys (F vs J, Esc).
    try {
      this._applyTextInputHintLabels();
    } catch { /* ignore */ }

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

  /**
   * Paint layout-aware "click with F to enter" / "press Esc to exit" SVG
   * background-images onto hovered/focused text inputs (via StyleManager CSS vars).
   */
  _applyTextInputHintLabels() {
    const KB = this.keybindings || {};
    const activate =
      KB.ACTIVATE?.keyLabel ||
      KB.ACTIVATE?.displayKey ||
      (Array.isArray(KB.ACTIVATE?.keys) ? KB.ACTIVATE.keys[0] : null) ||
      'F';
    const cancel =
      KB.CANCEL?.keyLabel ||
      KB.CANCEL?.displayKey ||
      'Esc';
    this.styleManager?.setTextInputHintLabels?.({
      hover: `click with ${activate} to enter`,
      focus: `press ${cancel} to exit`
    });
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
    const value = await storageGetValue(this.KEYBOARD_HELP_STORAGE_KEY, false);
    return typeof value === 'boolean' ? value : false;
  }

  async setKeyboardHelpVisibleInStorage(visible) {
    if (!chrome?.storage) return;
    await storageSetValue(this.KEYBOARD_HELP_STORAGE_KEY, Boolean(visible), {
      includeTimestamp: true
    });
  }

  /**
   * Push a keydown/keyup into the floating keyboard reference so pressed keys
   * light up even when KeyPilot stops the event with stopImmediatePropagation.
   * @param {KeyboardEvent} e
   * @param {'down'|'up'} phase
   */
  _reflectKeyOnKeyboardHelp(e, phase = 'down') {
    try {
      const help = this.floatingKeyboardHelp;
      if (!help || !this._keyboardHelpVisible) return;
      if (typeof help.isVisible === 'function' && !help.isVisible()) return;
      if (phase === 'up') {
        if (typeof help.reflectKeyUp === 'function') help.reflectKeyUp(e);
        return;
      }
      if (typeof help.reflectKeyDown === 'function') help.reflectKeyDown(e);
    } catch { /* ignore */ }
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
        // Apply link-hover key hints for the current pointer target immediately.
        this._syncKeyboardLinkHoverHints(undefined, { immediate: true });
      } else {
        this.floatingKeyboardHelp.hide();
        this._syncKeyboardLinkHoverHints(undefined, { immediate: true });
      }

      try {
        this.controlStrip?.setKeyboardHelpActive?.(!!next);
      } catch { /* ignore */ }

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
      if (!isExtensionContextValid()) {
        this.enabled = true;
        console.log('[KeyPilot] Extension context invalid; defaulting to enabled until reload');
        return;
      }
      const response = await chrome.runtime.sendMessage({ type: MSG.GET_STATE });
      if (response && typeof response.enabled === 'boolean') {
        this.enabled = response.enabled;
        console.log('[KeyPilot] Initial state from service worker:', this.enabled ? 'enabled' : 'disabled');
      } else {
        // Default to enabled if no response or invalid response
        this.enabled = true;
        console.log('[KeyPilot] No valid state from service worker, defaulting to enabled');
      }
    } catch (error) {
      if (noteExtensionContextError(error)) {
        this.enabled = true;
        return;
      }
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

    // Enable DOM-hover listeners BEFORE init (permanent targeting path).
    try {
      if (this.intersectionManager &&
          typeof this.intersectionManager.setDomHoverListenersEnabled === 'function') {
        this.intersectionManager.setDomHoverListenersEnabled(
          true,
          (el) => this._handleDomHoverChange(el)
        );
      }
    } catch { /* ignore */ }

    await this.intersectionManager.init();

    // Visual indicator: blue focus rectangles for DOM-hover targeting mode.
    try {
      if (this.overlayManager && typeof this.overlayManager.setDomHoverFocusColorsEnabled === 'function') {
        this.overlayManager.setDomHoverFocusColorsEnabled(true);
      }
    } catch { /* ignore */ }

    this.scrollManager.init();
    // Edge-only rectangle selection is lazy-initialized on first rectangle
    // highlight session — avoid ~startup DOM discovery when only browsing.
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
        // After scrolling, the viewport changes: re-seed incremental interactive discovery
        // so locality-first discovery stays warm without a full-document scan.
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
   * Initialize edge-only processing for rectangle selection optimization.
   * Lazy: call only when entering rectangle highlight mode (not on enable).
   * @param {{ force?: boolean }} [opts]
   */
  initializeEdgeOnlyProcessing(opts = {}) {
    // Already ready
    if (this.rectangleIntersectionObserver) {
      return true;
    }

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
      return false;
    }

    try {
      // Initialize rectangle intersection observer
      if (window.KEYPILOT_DEBUG || opts.force) {
        console.log('[KeyPilot] Initializing RectangleIntersectionObserver (lazy)...');
      }
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
      return true;
    } catch (error) {
      console.warn('[KeyPilot] Failed to initialize edge-only processing:', error);
      this.edgeOnlyProcessingEnabled = false;
      this.rectangleIntersectionObserver = null;
      return false;
    }
  }

  /**
   * Ensure rectangle edge-only stack exists (first rectangle session only).
   */
  ensureEdgeOnlyProcessingForRectangle() {
    if (this.rectangleIntersectionObserver) return true;
    return !!this.initializeEdgeOnlyProcessing();
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
    // Connect shadow DOM manager to intersection observer for shadow element discovery
    if (this.intersectionManager?.setShadowDOMManager) {
      this.intersectionManager.setShadowDOMManager(this.shadowDOMManager);
    }
  }

  setupPopupCommunication() {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.type === MSG.GET_STATUS) {
        sendResponse({ mode: this.state.getState().mode });
      } else if (msg.type === MSG.TOGGLE_STATE || msg.type === MSG.UPDATE_STATE) {
        // Handle state change message from service worker.
        // Prefer the toggle handler (single path for enable/disable + control strip sync).
        if (typeof msg.enabled === 'boolean') {
          try {
            const th = window.__KeyPilotToggleHandler;
            if (th && typeof th.setEnabled === 'function') {
              void th.setEnabled(msg.enabled, false);
              return;
            }
          } catch { /* fall through */ }
          if (msg.enabled) {
            this.enable();
          } else {
            this.disable();
          }
        }
      } else if (msg.type === MSG.OPEN_SETTINGS_POPOVER) {
        try {
          // Tab-local open (top frame only)
          if (window !== window.top) return;
          this.handleOpenSettingsPopover();
        } catch (e) {
          console.warn('[KeyPilot] Failed to open settings popover via message:', e);
        }
      } else if (msg.type === MSG.OPEN_GUIDE_POPOVER) {
        try {
          // Tab-local open (top frame only)
          if (window !== window.top) return;
          this.handleOpenGuidePopover();
        } catch (e) {
          console.warn('[KeyPilot] Failed to open guide popover via message:', e);
        }
      } else if (msg.type === MSG.OPEN_ONBOARDING) {
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

    // Update overlays when focus/delete targets change, mode changes (e.g. enter
    // highlight → companion "Press H again…" instruction), or an explicit trigger fires.
    if (newState.focusedTextElement !== prevState.focusedTextElement ||
        newState._overlayUpdateTrigger !== prevState._overlayUpdateTrigger ||
        newState.focusEl !== prevState.focusEl ||
        newState.deleteEl !== prevState.deleteEl ||
        newState.mode !== prevState.mode) {
      this.updateOverlays(newState.focusEl, newState.deleteEl);
    }

    // Keyboard reference: glow keys that activate the currently hovered link.
    // Debounced — focusEl can thrash on video thumbs / hover carousels.
    if (newState.focusEl !== prevState.focusEl || newState.mode !== prevState.mode) {
      this._syncKeyboardLinkHoverHints(newState);
    }
  }

  /**
   * Schedule (or immediately apply) link-hover keyboard key hints.
   * Debounces rapid focusEl churn (e.g. YouTube preview thumbnails).
   * @param {any} [state]
   * @param {{ immediate?: boolean }} [opts]
   */
  _syncKeyboardLinkHoverHints(state, opts = {}) {
    this._linkHoverHintPendingState = state;
    if (opts.immediate) {
      this._clearKeyboardLinkHoverHintTimer();
      this._flushKeyboardLinkHoverHints();
      return;
    }
    if (this._linkHoverHintTimer != null) {
      try { clearTimeout(this._linkHoverHintTimer); } catch { /* ignore */ }
    }
    const delay = Number.isFinite(this._LINK_HOVER_HINT_DEBOUNCE_MS)
      ? this._LINK_HOVER_HINT_DEBOUNCE_MS
      : 90;
    this._linkHoverHintTimer = setTimeout(() => {
      this._linkHoverHintTimer = null;
      this._flushKeyboardLinkHoverHints();
    }, delay);
  }

  _clearKeyboardLinkHoverHintTimer() {
    if (this._linkHoverHintTimer == null) return;
    try { clearTimeout(this._linkHoverHintTimer); } catch { /* ignore */ }
    this._linkHoverHintTimer = null;
  }

  /**
   * When the keyboard reference is open and the pointer is over a link,
   * highlight ACTIVATE / OPEN_POPOVER (and related) keys with a strong outline/glow.
   */
  _flushKeyboardLinkHoverHints() {
    try {
      const help = this.floatingKeyboardHelp;
      if (!help || typeof help.setLinkHoverHints !== 'function') return;

      let isLink = false;
      if (this._keyboardHelpVisible && this.enabled && help.isVisible?.()) {
        const st = this._linkHoverHintPendingState || this.state?.getState?.();
        // Don't suggest page link actions while modal modes own the pointer.
        if (!(st?.mode === MODES.POPOVER || st?.mode === MODES.DELETE ||
              st?.mode === MODES.HIGHLIGHT || st?.mode === MODES.OMNIBOX)) {
          const focusEl = st?.focusEl;
          // Category-based: only true navigational links (not sliders / media chrome).
          isLink = this.detector?.getClickableCategory?.(focusEl) === CLICKABLE_CATEGORY.LINK;
        }
      }

      // Skip redundant DOM class toggles when the boolean hasn't changed.
      if (this._linkHoverHintLastApplied === isLink) return;
      this._linkHoverHintLastApplied = isLink;
      help.setLinkHoverHints(isLink);
    } catch { /* ignore */ }
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
      this._sendRuntimeMessage({ type: MSG.STATUS, mode }, { silent: true });
    } catch (error) {
      // Popup might not be open / extension context may be invalidated
    }
  }

  /**
   * Send a message to the service worker, handling "Extension context invalidated"
   * (content script orphaned after extension reload/update).
   * @param {object} message
   * @param {{ silent?: boolean }} [opts]
   * @returns {boolean}
   */
  _sendRuntimeMessage(message, opts = {}) {
    return safeRuntimeSendMessage(message, {
      onInvalidated: () => this._handleExtensionContextInvalidated(),
      onError: (error) => {
        if (opts.silent) return;
        if (window.KEYPILOT_DEBUG) {
          console.warn('[KeyPilot] runtime.sendMessage failed:', error);
        }
      }
    });
  }

  /**
   * One-time UX + quiet shutdown after the extension was reloaded/updated.
   */
  _handleExtensionContextInvalidated() {
    if (this._extensionContextInvalidatedHandled) return;
    this._extensionContextInvalidatedHandled = true;

    if (window.KEYPILOT_DEBUG) {
      console.warn('[KeyPilot] Extension context invalidated — reload the page to restore KeyPilot');
    }

    try {
      this.showFlashNotification(
        'KeyPilot updated — reload this page to restore shortcuts',
        COLORS.NOTIFICATION_WARNING
      );
    } catch { /* ignore */ }

    // Stop listening so orphaned content scripts don't keep throwing.
    try {
      if (typeof this.disable === 'function') {
        this.disable();
      }
    } catch { /* ignore */ }
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
      this._sendRuntimeMessage({ type: MSG.TOGGLE_STATE }, { silent: true });
      return;
    }

    // Alt+J: show control strip (works even when closed; persists visible).
    // Also handled by KeyPilotToggleHandler's always-on listener when disabled.
    if ((e.altKey || e.code === 'AltRight') && (e.key === 'j' || e.key === 'J' || e.code === 'KeyJ')) {
      if (e.__kpControlStripHandled) return;
      try { e.__kpControlStripHandled = true; } catch { /* ignore */ }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      void this.showControlStripFromHotkey();
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

    // Alt+;: open launcher with search focused (Alt+A for left-handed)
    if ((e.altKey || e.code === 'AltRight') && (e.key === ';' || e.key === ':' || e.code === 'Semicolon' || e.key === 'a' || e.key === 'A' || e.code === 'KeyA')) {
      // Only operate in the top frame to avoid duplicates.
      if (window !== window.top) return;
      // Respect enabled state (do nothing when disabled).
      if (!this.enabled) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (this.launcherPopover.isOpen()) {
        this.launcherPopover.hide();
      } else {
        this.launcherPopover.showWithSearchFocus();
      }
      return;
    }

    // Don't handle keys if extension is disabled
    if (!this.enabled) {
      return;
    }

    // Live key feedback on the floating keyboard reference.
    // Must run before any stopImmediatePropagation() below — claimed shortcuts
    // would otherwise never reach FloatingKeyboardHelp's document listener
    // (EventManager registers its capture handler first).
    this._reflectKeyOnKeyboardHelp(e, 'down');

    // Debug key presses
    console.log('[KeyPilot] Key pressed:', e.key, 'Code:', e.code);

    // Don't interfere with modifier key combinations (Cmd+C, Ctrl+V, etc.)
    if (this.hasModifierKeys(e)) {
      return;
    }

    const currentState = this.state.getState();
    const KB = this.keybindings || {};

    // Global default: Escape closes the frontmost "popover-like" UI.
    // Priority: omnibox → launcher → PopupManager (topmost modal panel).
    // Match both e.key and e.code so Escape is reliable across layouts.
    const isCancelKey = KB.CANCEL?.keys?.includes?.(e.key)
      || e.key === 'Escape'
      || e.code === 'Escape';
    if (isCancelKey) {
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

      // Launcher (before generic PopupManager so we always clear launcher state,
      // even if the modal stack entry was lost or show() is still in flight).
      try {
        if (this.launcherPopover?.isOpen?.()) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.launcherPopover.hide();
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

    // If launcher is open, delegate keyboard handling to it
    if (this.launcherPopover?.isOpen?.()) {
      const handled = this.launcherPopover.handleKeyDown(e);
      if (handled) {
        return;
      }
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
        this.overlayManager?.scrollPopoverBy?.(-this._getPageScrollPx(), this._getScrollBehavior());
        return;
      }
      if (KB.PAGE_DOWN?.keys?.includes?.(e.key)) {
        e.preventDefault();
        this.overlayManager?.scrollPopoverBy?.(this._getPageScrollPx(), this._getScrollBehavior());
        return;
      }
      if (KB.PAGE_UP_INSTANT?.keys?.includes?.(e.key)) {
        e.preventDefault();
        this.overlayManager?.scrollPopoverBy?.(-this._getHalfPageScrollPx(), this._getScrollBehavior());
        return;
      }
      if (KB.PAGE_DOWN_INSTANT?.keys?.includes?.(e.key)) {
        e.preventDefault();
        this.overlayManager?.scrollPopoverBy?.(this._getHalfPageScrollPx(), this._getScrollBehavior());
        return;
      }
      if (KB.PAGE_TOP?.keys?.includes?.(e.key)) {
        e.preventDefault();
        this.overlayManager?.scrollPopoverToTop?.(this._getScrollBehavior());
        return;
      }
      if (KB.PAGE_BOTTOM?.keys?.includes?.(e.key)) {
        e.preventDefault();
        this.overlayManager?.scrollPopoverToBottom?.(this._getScrollBehavior());
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
      if (KB.ACTIVATE_NEW_TAB_BACKGROUND?.keys?.includes?.(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleActivateNewTabBackgroundKey();
        return;
      }

      // Allow preview link popover toggle (E/W) to work even when popover is open
      if (KB.PREVIEW_LINK_POPOVER?.keys?.includes?.(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handlePreviewLinkPopover();
        return;
      }

      // Toggle popovers must work on a second press while mode is POPOVER.
      // Tab History / Open Popover set MODES.POPOVER, which used to swallow their
      // own keys and made J (and P) feel stuck open.
      if (KB.TAB_HISTORY?.keys?.includes?.(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleToggleTabHistoryPopover();
        return;
      }
      if (KB.OPEN_POPOVER?.keys?.includes?.(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleOpenPopover(e);
        return;
      }
      if (KB.LAUNCHER?.keys?.includes?.(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleLauncherKey(e);
        return;
      }
      if (KB.TOGGLE_KEYBOARD_HELP?.keys?.includes?.(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleToggleKeyboardHelp();
        return;
      }
      if (KB.OPEN_SETTINGS_POPOVER?.keys?.includes?.(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleToggleSettingsPopover();
        return;
      }

      // History navigation must work even while a popover is open (parent focus).
      // Without this, D/S/R are silently swallowed and feel like they need a second press
      // after the popover is closed.
      if (KB.BACK?.keys?.includes?.(e.key) || KB.BACK2?.keys?.includes?.(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleBackKey();
        return;
      }
      if (KB.FORWARD?.keys?.includes?.(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleForwardKey();
        return;
      }

      // For all other keys when popover is open, let them pass through to the iframe
      // Don't prevent default so the iframe can handle navigation keys
      console.log('[KeyPilot] Letting key pass through to popover/iframe');
      return;
    }

    // -------------------------------------------------------------------------
    // FAIL-CLOSED typing gate (after modal UI, before action-key dispatch).
    // Google.com autofocuses <textarea name=q> before our content script loads;
    // we must suppress Close Tab (A), etc. even when text_focus mode lagged.
    // -------------------------------------------------------------------------
    const typingGate = this._evaluateTypingGate(e, currentState, KB);
    if (typingGate.blockActions) {
      if (typingGate.handled) return;
      // Swallow KeyPilot shortcuts; let the character type into the field.
      return;
    }

    // Special handling for highlight mode — complete with H/Y (layout-bound), cancel with Esc
    // or any other key (which then falls through to its normal action).
    if (currentState.mode === MODES.HIGHLIGHT) {
      if (KB.CANCEL?.keys?.includes?.(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.cancelHighlightMode();
        return;
      }
      if (KB.HIGHLIGHT?.keys?.includes?.(e.key) || KB.RECTANGLE_HIGHLIGHT?.keys?.includes?.(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Fire-and-forget; completeSelection always exits highlight mode.
        void this.completeSelection().catch((err) => {
          console.error('[KeyPilot] completeSelection failed:', err);
          try { this.cancelHighlightMode(); } catch { /* ignore */ }
        });
        return;
      }
      // Any other key — cancel highlight mode and let the key run normally
      this.cancelHighlightMode();
    }

    // Handle our keyboard shortcuts (table-driven via KEYBINDINGS.*.handler)
    for (const keybinding of Object.values(KB)) {
      if (!keybinding?.handler || !Array.isArray(keybinding.keys)) continue;

      const matchOn = Array.isArray(keybinding.matchOn) ? keybinding.matchOn : ['key'];
      const isMatch = matchOn.some((field) => keybinding.keys.includes(e[field]));
      if (!isMatch) continue;

      // Final fail-closed guard: never dispatch action keys while typing.
      if (this._isUnsafeToRunActionKey(e)) {
        console.warn(
          '[KeyPilot] Suppressed action while typing:',
          keybinding.handler,
          'key=',
          e.key,
          'active=',
          document.activeElement && document.activeElement.tagName,
          document.activeElement && document.activeElement.id
        );
        return;
      }

      e.preventDefault();
      // Critical: when KeyPilot claims a key, we must fully consume it so page-level
      // shortcuts (e.g. Internet Archive BookReader 'f' fullscreen) don't also fire.
      // We use stopImmediatePropagation() to prevent other listeners on the same target
      // from running (including other capture listeners).
      e.stopPropagation();
      e.stopImmediatePropagation();

      const handlerFn = this[keybinding.handler];
      if (typeof handlerFn === 'function') {
        // Pass the event so handlers can re-check typing with the real event target.
        handlerFn.call(this, e);
      } else {
        console.warn('[KeyPilot] Missing keybinding handler:', keybinding.handler, keybinding);
      }
      return;
    }
  }

  /**
   * Dependency-free: is this element a place where letter keys should type?
   * Intentionally does NOT call isTypingContext/resolveTypingTarget (avoids any
   * bundle name-shadowing or swallowed-throw fail-open paths).
   * @param {any} el
   * @returns {boolean}
   */
  _isTextEntryElement(el) {
    if (!el) return false;
    try {
      // Text node inside contenteditable
      if (el.nodeType === 3) el = el.parentElement;
    } catch { /* ignore */ }
    if (!el || el.nodeType !== 1) return false;

    try {
      // Never treat KeyPilot chrome as page typing (omnibox has its own mode).
      if (el.classList?.contains?.(CSS_CLASSES.OMNIBOX_INPUT)) return false;
      if (el.closest?.(`.${CSS_CLASSES.OMNIBOX_BACKDROP}`) ||
          el.closest?.(`.${CSS_CLASSES.OMNIBOX_PANEL}`)) {
        return false;
      }
    } catch { /* ignore */ }

    try {
      if (el.isContentEditable) return true;
    } catch { /* ignore */ }

    let tag = '';
    try { tag = String(el.tagName || '').toUpperCase(); } catch { tag = ''; }

    if (tag === 'TEXTAREA') {
      try { return !el.disabled; } catch { return true; }
    }

    if (tag === 'INPUT') {
      try {
        if (el.disabled || el.readOnly) return false;
      } catch { /* ignore */ }
      let type = 'text';
      try { type = String(el.type || 'text').toLowerCase(); } catch { /* ignore */ }
      // Everything that accepts keyboard text entry; exclude pure click controls.
      if (
        type === 'button' || type === 'submit' || type === 'reset' ||
        type === 'checkbox' || type === 'radio' || type === 'file' ||
        type === 'image' || type === 'range' || type === 'color' ||
        type === 'hidden'
      ) {
        return false;
      }
      return true;
    }

    // ARIA text fields (custom widgets)
    try {
      const role = el.getAttribute?.('role');
      if (role === 'textbox' || role === 'searchbox') return true;
      // Google uses role=combobox on a real <textarea> (already handled). For
      // custom comboboxes that accept typing, require contentEditable or aria-multiline.
      if (role === 'combobox') {
        if (el.isContentEditable) return true;
        if (el.getAttribute?.('aria-multiline') === 'true') return true;
        // If it has a value property and isn't a native select, treat as typing.
        if ('value' in el && tag !== 'SELECT') return true;
      }
    } catch { /* ignore */ }

    // Walk up for contenteditable hosts (event target may be a child span).
    try {
      let p = el.parentElement;
      let depth = 0;
      while (p && depth++ < 6) {
        if (p.isContentEditable) return true;
        p = p.parentElement;
      }
    } catch { /* ignore */ }

    return false;
  }

  /**
   * Find the live typing element from event + focus, without helper indirection.
   * @param {KeyboardEvent|null|undefined} e
   * @returns {Element|null}
   */
  _findLiveTypingElement(e) {
    const candidates = [];

    // 1) composedPath (shadow-aware real target)
    try {
      const path = e && typeof e.composedPath === 'function' ? e.composedPath() : null;
      if (path) {
        for (const n of path) {
          if (n && n.nodeType === 1) {
            candidates.push(n);
            break;
          }
        }
      }
    } catch { /* ignore */ }

    // 2) event.target
    try {
      if (e?.target) candidates.push(e.target);
    } catch { /* ignore */ }

    // 3) deep activeElement (open shadow)
    try {
      let active = document.activeElement;
      let guard = 0;
      while (active && active.shadowRoot && active.shadowRoot.activeElement && guard++ < 10) {
        active = active.shadowRoot.activeElement;
      }
      if (active) candidates.push(active);
    } catch { /* ignore */ }

    // 4) FocusDetector memory
    try {
      const cur = this.focusDetector?.currentFocusedElement;
      if (cur) candidates.push(cur);
    } catch { /* ignore */ }

    // 5) state.focusedTextElement
    try {
      const st = this.state?.getState?.();
      if (st?.focusedTextElement) candidates.push(st.focusedTextElement);
    } catch { /* ignore */ }

    for (const c of candidates) {
      if (this._isTextEntryElement(c)) {
        // Prefer the actual element (not a text node parent already resolved)
        return /** @type {Element} */ (c.nodeType === 1 ? c : c.parentElement);
      }
    }
    return null;
  }

  /**
   * True when KeyPilot action keys (close tab, new tab, etc.) must not run.
   * Fail-closed for any detected text entry surface.
   * @param {KeyboardEvent|null|undefined} [e]
   * @returns {boolean}
   */
  _isUnsafeToRunActionKey(e) {
    try {
      const st = this.state?.getState?.();
      if (st?.mode === MODES.TEXT_FOCUS) return true;
      if (st?.focusedTextElement) return true;
    } catch { /* ignore */ }

    try {
      if (this.focusDetector?.isInTextFocus?.()) return true;
    } catch { /* ignore */ }

    if (this._findLiveTypingElement(e)) return true;

    // Last resort: call shared helpers (may throw after bundle issues — ignore).
    try {
      if (typeof this.resolveTypingTarget === 'function' && this.resolveTypingTarget(e)) {
        return true;
      }
    } catch { /* ignore */ }
    try {
      if (this.isTypingContext?.(e?.target)) return true;
    } catch { /* ignore */ }

    return false;
  }

  /**
   * Call at the top of every tab/nav action handler.
   * @param {string} actionName
   * @param {KeyboardEvent|null|undefined} [e]
   * @returns {boolean} true if the action is allowed to proceed
   */
  _allowActionKey(actionName, e) {
    if (this._isUnsafeToRunActionKey(e)) {
      console.warn(
        `[KeyPilot] ${actionName} blocked — typing context`,
        'active=',
        document.activeElement && document.activeElement.tagName,
        document.activeElement && document.activeElement.id
      );
      return false;
    }
    return true;
  }

  /**
   * Early typing gate for handleKeyDown.
   * @param {KeyboardEvent} e
   * @param {any} currentState
   * @param {Record<string, any>} KB
   * @returns {{ blockActions: boolean, handled: boolean }}
   */
  _evaluateTypingGate(e, currentState, KB) {
    const inTextFocus =
      currentState?.mode === MODES.TEXT_FOCUS || !!currentState?.focusedTextElement;

    const typingTarget = this._findLiveTypingElement(e);

    if (!inTextFocus && !typingTarget) {
      return { blockActions: false, handled: false };
    }

    // Sync text-focus mode if we only discovered typing via the DOM probe.
    if (typingTarget && !inTextFocus) {
      try {
        if (this.focusDetector?.isTextInput?.(typingTarget)) {
          this.focusDetector.setTextFocus(typingTarget);
        } else if (this.focusDetector?.setTextFocus) {
          // isTextInput may be stricter; still force mode when our probe matched.
          try { this.focusDetector.setTextFocus(typingTarget); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }

    // ESC exits text focus.
    if (KB.CANCEL?.keys?.includes?.(e.key) || e.key === 'Escape' || e.code === 'Escape') {
      console.debug('Escape key detected in text focus / typing context');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      try {
        this.handleEscapeFromTextFocus(currentState || this.state.getState());
      } catch {
        try { this.focusDetector?.clearTextFocus?.(); } catch { /* ignore */ }
      }
      return { blockActions: true, handled: true };
    }

    // Text mode isolation (product rule): keyboard-ref actions do NOT run while typing.
    // Only exceptions:
    //   1) Esc — exit text mode
    //   2) Armed F — optional hover-click after a mouse-move countdown (explicit UX)
    // S/D/R, A, T, and every other binding must type into the field, not navigate.
    if (
      (inTextFocus || !!typingTarget) &&
      KB.ACTIVATE?.keys?.includes?.(e.key) &&
      this._textModeClickArmed &&
      currentState?.focusEl
    ) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this._handleActivateFromTextFocus(currentState);
      return { blockActions: true, handled: true };
    }

    // Swallow all KeyPilot shortcuts; let the character reach the text field.
    return { blockActions: true, handled: false };
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

    // DOM-hover only: avoid explicit hover hit-testing in normal mode.
    // The browser resolves occlusion/clipping; focusEl comes from hover listeners.
    try {
      const st = this.state.getState();
      if (this._domHoverListenersEnabled && st.mode === MODES.NONE) {
        return;
      }
    } catch { /* ignore */ }

    // Skip hit-testing during scrolling - overlay is already hidden at scroll start
    try {
      if (this.scrollManager && this.scrollManager.isScrolling) {
        return;
      }
    } catch { /* ignore */ }

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

    // DOM-hover only for normal browsing; this path is for delete / popover / text-focus
    // and other modes that still need explicit under-cursor resolution via elementFromPoint.
    let under = underHint || null;
    if (!under) under = this.detector.deepElementFromPoint(x, y);

    let clickable = null;
    try {
      clickable = this.detector.findClickable(under);
    } catch {
      clickable = null;
    }

    // Popover mode is modal: only track elements inside the popover UI.
    // This prevents the green rectangle from following the background page.
    if (currentState.mode === MODES.POPOVER) {
      const isInsidePopover = (el) => this._isElementInPopover(el);

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
    // Pass through computed values to avoid redundant deepElementFromPoint() work.
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

  /**
   * C / V scroll distance (px), from Settings with SCROLL fallback.
   * @returns {number}
   */
  _getHalfPageScrollPx() {
    const n = Number(this._settings?.scroll?.halfPagePx);
    if (Number.isFinite(n) && n > 0) return n;
    return SCROLL.HALF_PAGE_PX;
  }

  /**
   * Z / X scroll distance (px). Currently uses the constant; not yet a setting.
   * @returns {number}
   */
  _getPageScrollPx() {
    return SCROLL.PAGE_PX;
  }

  /**
   * CSS scroll-behavior derived from Settings scroll.speed.
   * @returns {'smooth'|'auto'}
   */
  _getScrollBehavior() {
    return scrollBehaviorFromSpeed(this._settings?.scroll?.speed ?? DEFAULT_SETTINGS.scroll.speed);
  }

  handlePageUp(e) {
    if (!this._allowActionKey('handlePageUp', e)) return;
    window.scrollBy({
      top: -this._getPageScrollPx(),
      behavior: this._getScrollBehavior()
    });
    this.emitAction('scrollUp');
  }

  handlePageDown(e) {
    if (!this._allowActionKey('handlePageDown', e)) return;
    window.scrollBy({
      top: this._getPageScrollPx(),
      behavior: this._getScrollBehavior()
    });
    this.emitAction('scrollDown');
  }

  handleInstantPageUp(e) {
    if (!this._allowActionKey('handleInstantPageUp', e)) return;
    window.scrollBy({
      top: -this._getHalfPageScrollPx(),
      behavior: this._getScrollBehavior()
    });
    this.emitAction('scrollUp');
  }

  handleInstantPageDown(e) {
    if (!this._allowActionKey('handleInstantPageDown', e)) return;
    window.scrollBy({
      top: this._getHalfPageScrollPx(),
      behavior: this._getScrollBehavior()
    });
    this.emitAction('scrollDown');
  }

  handlePageTop(e) {
    if (!this._allowActionKey('handlePageTop', e)) return;
    // Scroll to top of page (Home key equivalent)
    window.scrollTo({
      top: 0,
      behavior: this._getScrollBehavior()
    });
    this.emitAction('scrollTop');
  }

  handlePageBottom(e) {
    if (!this._allowActionKey('handlePageBottom', e)) return;
    // Scroll to bottom of page (End key equivalent)
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: this._getScrollBehavior()
    });
    this.emitAction('scrollBottom');
  }

  /**
   * True when the event matches browser history back/forward keybindings.
   * @param {Record<string, any>} KB
   * @param {KeyboardEvent} e
   */
  _isHistoryNavigationKey(KB, e) {
    if (!KB || !e) return false;
    return !!(
      KB.BACK?.keys?.includes?.(e.key) ||
      KB.BACK2?.keys?.includes?.(e.key) ||
      KB.FORWARD?.keys?.includes?.(e.key)
    );
  }

  /**
   * Run the history handler that matches this key (back vs forward).
   * @param {Record<string, any>} KB
   * @param {KeyboardEvent} e
   */
  _runHistoryNavigationKey(KB, e) {
    if (KB.FORWARD?.keys?.includes?.(e.key)) {
      this.handleForwardKey();
      return;
    }
    // BACK and BACK2 share the same handler.
    this.handleBackKey();
  }

  handleBackKey(e) {
    // Never run history shortcuts while typing (D/S are real letters in text mode).
    if (!this._allowActionKey('handleBackKey', e)) return;
    // Emit BEFORE navigating away so onboarding (and other listeners) can observe/persist it.
    // This is synchronous so listeners run before any navigation is requested.
    this.emitAction('back');
    this._navigateHistory(-1, { recordTransientAction: 'back' });
  }

  handleForwardKey(e) {
    if (!this._allowActionKey('handleForwardKey', e)) return;
    this._navigateHistory(1);
  }

  /**
   * Navigate browser session history (back/forward).
   *
   * Uses `history.back/forward` as the primary action (immediate, same stack as the page).
   * Transient onboarding actions are recorded separately via the service worker.
   *
   * Silent hops (common SPA / in-page patterns that feel like "D did nothing"):
   * - Only cleared a `#hash` fragment
   * - URL is unchanged after a same-document `pushState` entry
   * In those cases, take one automatic extra step so one keypress matches user intent.
   *
   * @param {-1|1} direction
   * @param {{ recordTransientAction?: string }} [opts]
   */
  _navigateHistory(direction, opts = {}) {
    const dir = direction < 0 ? -1 : 1;
    const recordAction = typeof opts.recordTransientAction === 'string' ? opts.recordTransientAction : '';

    // Onboarding recovery: record before unload, fire-and-forget (do not gate navigation on it).
    if (recordAction) {
      this._sendRuntimeMessage({
        type: MSG.TRANSIENT_ACTION,
        action: recordAction,
        timestamp: Date.now()
      }, { silent: true });
    }

    const step = () => {
      try {
        if (dir < 0) history.back();
        else history.forward();
      } catch { /* ignore */ }
    };

    // Popover iframe: only this frame's history.
    if (window !== window.top) {
      step();
      return;
    }

    // Only auto-skip "invisible" hops when going back.
    if (dir >= 0) {
      step();
      return;
    }

    const beforeHref = location.href;
    const beforePath = `${location.pathname}${location.search}`;
    const beforeHash = location.hash || '';

    // Cancel any previous skip watcher (rapid D presses).
    try {
      if (this._historySkipCleanup) this._historySkipCleanup();
    } catch { /* ignore */ }
    this._historySkipCleanup = null;

    let extraHopsUsed = 0;
    const maxExtraHops = 1;

    const cleanup = () => {
      if (popListener) {
        try { window.removeEventListener('popstate', popListener); } catch { /* ignore */ }
        popListener = null;
      }
      if (timer) {
        try { clearTimeout(timer); } catch { /* ignore */ }
        timer = 0;
      }
      if (this._historySkipCleanup === cleanup) this._historySkipCleanup = null;
    };

    let popListener = () => {
      try {
        if (extraHopsUsed >= maxExtraHops) {
          cleanup();
          return;
        }
        const path = `${location.pathname}${location.search}`;
        const hash = location.hash || '';
        const href = location.href;

        // Invisible hop patterns:
        // 1) Full URL unchanged after back (same-document pushState with no URL change)
        // 2) Only a hash fragment was cleared (page#section → page)
        const urlUnchanged = href === beforeHref;
        const onlyClearedHash = !!beforeHash && !hash && path === beforePath;

        if (urlUnchanged || onlyClearedHash) {
          extraHopsUsed += 1;
          step();
          // Keep listening briefly for the extra hop's popstate; timeout cleans up.
          return;
        }
      } catch { /* ignore */ }
      cleanup();
    };

    let timer = 0;
    try {
      window.addEventListener('popstate', popListener);
      timer = window.setTimeout(cleanup, 500);
      this._historySkipCleanup = cleanup;
    } catch {
      popListener = null;
    }

    step();
  }

  handleTabLeftKey(e) {
    if (!this._allowActionKey('handleTabLeftKey', e)) return;
    // Switch to the tab to the left
    // Emit + record transient action BEFORE switching tabs so onboarding can persist/recover reliably.
    this.emitAction('tabLeft');
    this._sendRuntimeMessage({ type: MSG.TRANSIENT_ACTION, action: 'tabLeft', timestamp: Date.now() }, { silent: true });
    if (!this._sendRuntimeMessage({ type: MSG.TAB_LEFT })) {
      // Context invalidated — user already notified once via _handleExtensionContextInvalidated
    }
  }

  handleTabRightKey(e) {
    if (!this._allowActionKey('handleTabRightKey', e)) return;
    // Switch to the tab to the right
    // Emit + record transient action BEFORE switching tabs so onboarding can persist/recover reliably.
    this.emitAction('tabRight');
    this._sendRuntimeMessage({ type: MSG.TRANSIENT_ACTION, action: 'tabRight', timestamp: Date.now() }, { silent: true });
    if (!this._sendRuntimeMessage({ type: MSG.TAB_RIGHT })) {
      // Context invalidated — user already notified once via _handleExtensionContextInvalidated
    }
  }

  handleDeleteKey(e) {
    if (!this._allowActionKey('handleDeleteKey', e)) return;
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

  handleHighlightKey(e) {
    if (!this._allowActionKey('handleHighlightKey', e)) return;
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
      this._lastHighlightUpdatePos = { x: -1, y: -1 };
      
      // Set default selection mode to character-level
      this.overlayManager.setSelectionMode('character');
      
      this.startHighlighting();
    } else {
      console.log('[KeyPilot] Completing highlight selection');
      void this.completeSelection().catch((err) => {
        console.error('[KeyPilot] completeSelection failed:', err);
        try { this.cancelHighlightMode(); } catch { /* ignore */ }
      });
    }
  }

  handleRectangleHighlightKey(e) {
    if (!this._allowActionKey('handleRectangleHighlightKey', e)) return;
    const currentState = this.state.getState();

    // Prevent highlight mode activation in text focus mode
    if (currentState.mode === MODES.TEXT_FOCUS) {
      console.log('[KeyPilot] Rectangle highlight ignored - currently in text focus mode');
      return;
    }

    if (!this.state.isHighlightMode()) {
      console.log('[KeyPilot] Entering rectangle highlight mode');
      
      // Cancel delete mode if active
      if (this.state.isDeleteMode()) {
        console.log('[KeyPilot] Canceling delete mode to enter rectangle highlight mode');
      }

      // Lazy-init edge-only stack only when explicitly enabled (off by default).
      if (FEATURE_FLAGS.USE_EDGE_ONLY_SELECTION && FEATURE_FLAGS.ENABLE_EDGE_ONLY_PROCESSING) {
        try { this.ensureEdgeOnlyProcessingForRectangle(); } catch { /* ignore */ }
      }
      
      // Enter highlight mode and start rectangle highlighting at current cursor position
      this.state.setMode(MODES.HIGHLIGHT);
      this._lastHighlightUpdatePos = { x: -1, y: -1 };
      
      // Set selection mode to rectangle
      this.overlayManager.setSelectionMode('rectangle');
      
      this.startHighlighting();
    } else {
      // Second press completes (and always exits) current highlight session.
      console.log('[KeyPilot] Completing rectangle highlight selection');
      void this.completeSelection().catch((err) => {
        console.error('[KeyPilot] completeSelection failed:', err);
        try { this.cancelHighlightMode(); } catch { /* ignore */ }
      });
    }
  }

  startHighlighting() {
    const currentState = this.state.getState();
    const selectionMode = this.overlayManager.getSelectionMode();

    // Companion instruction: "Press H again to finish selection" (layout-aware key).
    try {
      const KB = this.keybindings || {};
      const binding = selectionMode === 'rectangle' ? KB.RECTANGLE_HIGHLIGHT : KB.HIGHLIGHT;
      const finishKey = Array.isArray(binding?.keys) && binding.keys.length
        ? binding.keys.find((k) => k && k.length === 1) || binding.keys[0]
        : (selectionMode === 'rectangle' ? 'Y' : 'H');
      this.overlayManager.highlightManager?.showHighlightModeIndicator?.({ finishKey });
    } catch {
      try {
        this.overlayManager.highlightManager?.showHighlightModeIndicator?.();
      } catch { /* ignore */ }
    }
    
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

    // Selection geometry lives entirely in HighlightManager (caret APIs).
    if (selectionMode === 'character') {
      // Character mode stays character mode — never silently switch to rectangle.
      const success = this.overlayManager.startCharacterSelection(
        { x: currentState.lastMouse.x, y: currentState.lastMouse.y }
      );

      if (success) {
        console.log('[KeyPilot] Character selection started successfully');
      } else {
        console.log('[KeyPilot] No text at start point; character selection will seed when cursor hits text');
      }
      return;
    }

    // Rectangle selection mode — seed caret at origin if possible (updates use dual-caret).
    try {
      const viewportStart = {
        x: currentState.lastMouse.x,
        y: currentState.lastMouse.y
      };
      const seeded = this.overlayManager.updateRectangleSelectionFromCarets(
        viewportStart,
        viewportStart
      );
      if (seeded) {
        this.state.setCurrentSelection(seeded);
        console.log('[KeyPilot] Rectangle selection seeded at cursor');
      } else {
        console.log('[KeyPilot] No text at rectangle origin; selection will start when drag hits text');
      }
    } catch (error) {
      console.warn('[KeyPilot] Error seeding rectangle selection:', error);
    }
  }

  /**
   * Update live text/rectangle selection.
   * @param {{ force?: boolean }} [opts] - force=true bypasses mouse-move threshold (use on scroll)
   */
  updateSelection(opts = {}) {
    if (this._completingHighlight) return;
    const force = !!opts.force;
    const currentState = this.state.getState();
    const startPos = currentState.highlightStartPosition;
    const selectionMode = this.overlayManager.getSelectionMode();
    
    if (!startPos) {
      return;
    }

    const currentPos = {
      x: currentState.lastMouse.x,
      y: currentState.lastMouse.y
    };

    // Skip micro-moves relative to last applied highlight update (not origin).
    // Scroll-driven refresh must always run even if the mouse viewport point is unchanged.
    if (!force) {
      const last = this._lastHighlightUpdatePos || { x: -1, y: -1 };
      const thr = this._HIGHLIGHT_UPDATE_THRESHOLD ?? 2;
      if (Math.abs(currentPos.x - last.x) < thr && Math.abs(currentPos.y - last.y) < thr) {
        return;
      }
    }
    this._lastHighlightUpdatePos = { x: currentPos.x, y: currentPos.y };

    // Origin in document space (set at highlight start) → current viewport each frame.
    // Never reuse frozen startPos.viewportX/Y after the page has scrolled.
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const startPosForOverlay = {
      x: (typeof startPos.x === 'number' ? startPos.x : (startPos.viewportX ?? 0) + scrollX) - scrollX,
      y: (typeof startPos.y === 'number' ? startPos.y : (startPos.viewportY ?? 0) + scrollY) - scrollY
    };
    // Prefer highlight-manager's document anchor when already seeded
    const hmOrigin = this.overlayManager?.highlightManager?.getOriginViewportPoint?.();
    const originVp = hmOrigin || startPosForOverlay;

    // All caret resolution + selection geometry is HighlightManager-owned.
    if (selectionMode === 'character') {
      try {
        this.overlayManager.updateCharacterSelection(currentPos, originVp);
      } catch (error) {
        console.warn('[KeyPilot] Error updating character selection:', error);
      }
      return;
    }

    // Rectangle: caret-based only on the mousemove/scroll path (no TreeWalker).
    try {
      const caretSelection = this.overlayManager.updateRectangleSelectionFromCarets(
        originVp,
        currentPos
      );
      if (caretSelection) {
        this.state.setCurrentSelection(caretSelection);
      } else {
        try {
          this.overlayManager.updateHighlightRectangleOverlay(originVp, currentPos);
        } catch (overlayError) {
          console.warn('[KeyPilot] Error updating highlight rectangle overlay:', overlayError);
        }
      }
    } catch (error) {
      console.error('[KeyPilot] Unexpected error updating selection:', error);
      // Stay in highlight mode; user can move cursor or press the key again to exit.
    }
  }

  /**
   * Called every scroll frame while in highlight mode so the dashed rectangle
   * stays glued to page content (not only on scroll-end).
   */
  refreshHighlightDuringScroll() {
    if (!this.enabled || this._completingHighlight || !this.state?.isHighlightMode?.()) return;
    try {
      this.updateSelection({ force: true });
    } catch (e) {
      console.warn('[KeyPilot] refreshHighlightDuringScroll failed:', e);
    }
  }

  async completeSelection() {
    // Ignore re-entrant completes (double H / concurrent awaits) — those left mode
    // stuck mid-copy and thrashing updateSelection, which froze pages on later uses.
    if (this._completingHighlight) {
      return;
    }
    this._completingHighlight = true;

    const currentState = this.state.getState();
    const selectionMode = this.overlayManager.getSelectionMode();
    
    console.log('[KeyPilot] Completing text selection, mode:', selectionMode);

    const exitHighlight = () => {
      try {
        this.cancelHighlightMode();
      } catch (e) {
        console.warn('[KeyPilot] Error exiting highlight mode:', e);
        try { this.state.setMode(MODES.NONE); } catch { /* ignore */ }
      }
    };
    
    try {
      let selectedText = '';
      let contentToClipboard = null;

      // Capture text FIRST while the browser Selection is still intact.
      // Do not reset session state until after we have the string.
      if (selectionMode === 'character') {
        selectedText = this.overlayManager.peekCharacterSelectedText() || '';
      } else {
        try {
          const selection = this.getCurrentSelectionWithShadowSupport();
          if (selection && typeof selection.toString === 'function' && selection.rangeCount > 0) {
            if (FEATURE_FLAGS.ENABLE_RICH_TEXT_CLIPBOARD) {
              try {
                contentToClipboard = this.extractSelectionContent(selection);
                selectedText = contentToClipboard.plainText || '';
              } catch (extractError) {
                console.warn('[KeyPilot] Error extracting rich text content:', extractError);
                selectedText = selection.toString() || '';
              }
            } else {
              selectedText = selection.toString() || '';
            }
          }
        } catch (selectionError) {
          console.warn('[KeyPilot] Error getting current selection:', selectionError);
        }

        if (!selectedText || !selectedText.trim()) {
          try {
            const stateSelection = currentState.currentSelection;
            if (stateSelection && typeof stateSelection.toString === 'function') {
              selectedText = stateSelection.toString() || '';
            }
          } catch { /* ignore */ }
        }
      }

      // Exit highlight mode immediately so mousemove/scroll stop updating selection
      // before any async clipboard work. This was a major freeze source.
      exitHighlight();
      
      if (!selectedText || !String(selectedText).trim()) {
        console.log('[KeyPilot] Empty selection — exited highlight mode');
        this.showFlashNotification('No text selected', COLORS.NOTIFICATION_INFO);
        return;
      }

      selectedText = String(selectedText);
      if (!contentToClipboard) {
        contentToClipboard = selectedText;
      }

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
        const textPreview = (typeof contentToClipboard === 'string')
          ? contentToClipboard.substring(0, 50)
          : (contentToClipboard.plainText || '').substring(0, 50);
        console.log(`[KeyPilot] Content copied (${copyType}):`, textPreview);

        const notificationCopyType = (contentToClipboard && contentToClipboard.hasRichContent) ? 'Rich text' : 'Text';
        this.showFlashNotification(`${notificationCopyType} copied to clipboard`, COLORS.NOTIFICATION_SUCCESS);
        
        try {
          this.overlayManager.flashFocusOverlay();
        } catch (flashError) {
          console.warn('[KeyPilot] Error flashing focus overlay:', flashError);
        }
      } else {
        console.warn('[KeyPilot] Failed to copy text to clipboard');
        let errorMessage = 'Failed to copy text';
        if (clipboardError) {
          if (clipboardError.name === 'NotAllowedError' || clipboardError.message?.includes('permission')) {
            errorMessage = 'Clipboard access denied - check browser permissions';
          } else if (clipboardError.message?.includes('not supported')) {
            errorMessage = 'Clipboard not supported in this context';
          } else if (clipboardError.message?.includes('secure context')) {
            errorMessage = 'Clipboard requires secure connection (HTTPS)';
          }
        }
        this.showFlashNotification(errorMessage, COLORS.NOTIFICATION_ERROR);
      }
    } catch (error) {
      console.error('[KeyPilot] Unexpected error completing selection:', error);
      try { exitHighlight(); } catch { /* ignore */ }
      let errorMessage = 'Error copying text';
      if (error?.message?.includes('Selection API')) {
        errorMessage = 'Text selection not supported on this page';
      } else if (error?.message?.includes('shadow')) {
        errorMessage = 'Cannot copy text from this element';
      }
      this.showFlashNotification(errorMessage, COLORS.NOTIFICATION_ERROR);
    } finally {
      this._completingHighlight = false;
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
   * Copy image under the cursor to the clipboard (I on right-handed layout; E on left).
   * Uses getHoveredImage utility — discovery is not clipboard-tied.
   */
  async handleCopyHoveredImageKey() {
    const currentState = this.state.getState();
    const x = Number(currentState?.lastMouse?.x);
    const y = Number(currentState?.lastMouse?.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      this.showFlashNotification('No image under cursor', COLORS.NOTIFICATION_INFO);
      return;
    }

    let result = null;
    try {
      result = await getHoveredImage(x, y);
    } catch (error) {
      console.warn('[KeyPilot] getHoveredImage failed:', error);
      this.showFlashNotification('Could not copy image', COLORS.NOTIFICATION_ERROR);
      return;
    }

    if (!result?.blob) {
      this.showFlashNotification('No image under cursor', COLORS.NOTIFICATION_INFO);
      return;
    }

    try {
      const ok = await this.copyImageToClipboard(result.blob, result.mimeType);
      if (ok) {
        // Distinct scale animation (shutter → pop → shrink), not the green F-click pulse.
        try {
          this.overlayManager?.flashImageCopyPulse?.(result.element);
        } catch { /* ignore visual feedback failures */ }

        const label =
          result.kind === 'background' ? 'Background image'
            : result.kind === 'svg' ? 'SVG'
              : 'Image';
        this.showFlashNotification(`${label} copied to clipboard`, COLORS.NOTIFICATION_SUCCESS);
        this.emitAction('copy_hovered_image', {
          kind: result.kind,
          url: result.url ? String(result.url).slice(0, 200) : ''
        });
      } else {
        this.showFlashNotification('Could not copy image', COLORS.NOTIFICATION_ERROR);
      }
    } catch (error) {
      console.warn('[KeyPilot] copyImageToClipboard failed:', error);
      let message = 'Could not copy image';
      if (error?.name === 'NotAllowedError' || /permission/i.test(error?.message || '')) {
        message = 'Clipboard permission denied';
      } else if (/secure context/i.test(error?.message || '')) {
        message = 'Clipboard requires HTTPS';
      }
      this.showFlashNotification(message, COLORS.NOTIFICATION_ERROR);
    }
  }

  /**
   * Write an image Blob to the system clipboard (PNG preferred).
   * Separate from text copyToClipboard to keep that API type-safe.
   *
   * @param {Blob} blob
   * @param {string} [mimeType='image/png']
   * @returns {Promise<boolean>}
   */
  async copyImageToClipboard(blob, mimeType = 'image/png') {
    if (!blob || !(blob instanceof Blob) || blob.size === 0) {
      console.warn('[KeyPilot] Invalid blob provided to copyImageToClipboard');
      return false;
    }

    const type = (mimeType && String(mimeType).startsWith('image/'))
      ? String(mimeType)
      : (blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png');

    if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function') {
      console.warn('[KeyPilot] Clipboard image write not available');
      return false;
    }

    try {
      // ClipboardItem often wants a Promise<Blob> for image types.
      const item = new ClipboardItem({
        [type]: Promise.resolve(blob)
      });
      const writePromise = navigator.clipboard.write([item]);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Clipboard operation timed out')), 5000);
      });
      await Promise.race([writePromise, timeoutPromise]);
      console.log('[KeyPilot] Image copied to clipboard:', type, blob.size);
      return true;
    } catch (error) {
      // Some browsers require the exact type image/png only — retry as png wrapper.
      if (type !== 'image/png') {
        try {
          const item = new ClipboardItem({
            'image/png': Promise.resolve(blob)
          });
          await navigator.clipboard.write([item]);
          console.log('[KeyPilot] Image copied to clipboard as image/png fallback');
          return true;
        } catch (retryErr) {
          console.warn('[KeyPilot] Image clipboard write failed:', retryErr);
          throw retryErr;
        }
      }
      console.warn('[KeyPilot] Image clipboard write failed:', error);
      throw error;
    }
  }

  /**
   * Cancel highlight mode and return to normal mode
   * Clears selection, visual indicators, and state with shadow DOM support
   */
  cancelHighlightMode() {
    console.log('[KeyPilot] Canceling highlight mode');

    // Always fully clear both character + rectangle session state (previous path
    // only cleared one branch and could leave characterSelectionActive stuck true).
    try {
      this.overlayManager.clearCharacterSelection();
    } catch (error) {
      console.warn('[KeyPilot] Error clearing character selection:', error);
    }

    try {
      this.overlayManager.hideHighlightRectangleOverlay();
    } catch (error) {
      console.warn('[KeyPilot] Error clearing highlight rectangle overlay:', error);
    }

    try {
      this.overlayManager.clearHighlightSelectionOverlays();
    } catch (error) {
      console.warn('[KeyPilot] Error clearing highlight overlays:', error);
    }

    // Hide companion instruction modal
    try {
      this.overlayManager.highlightManager?.hideHighlightModeIndicator?.();
    } catch { /* ignore */ }

    // Sweep any orphaned selection / instruction overlays left in the DOM
    try {
      document.querySelectorAll(
        '.kpv2-highlight-selection-overlay, .kpv2-highlight-selection, .kpv2-highlight-rectangle-overlay, .kpv2-highlight-mode-indicator'
      ).forEach((el) => {
        try { el.remove(); } catch { /* ignore */ }
      });
      try {
        if (this.overlayManager?.highlightManager) {
          this.overlayManager.highlightManager.highlightModeIndicator = null;
        }
      } catch { /* ignore */ }
    } catch { /* ignore */ }

    // Optional edge-only stack cleanup
    if (this.edgeOnlyProcessingEnabled &&
        this.rectangleIntersectionObserver &&
        FEATURE_FLAGS.ENABLE_EDGE_ONLY_PROCESSING) {
      try {
        this.rectangleIntersectionObserver.updateRectangle({
          left: 0, top: 0, width: 0, height: 0
        });
      } catch (error) {
        console.warn('[KeyPilot] Error cleaning up edge-only processing:', error);
      }
    }
    
    // Clear any active text selection immediately with shadow DOM support
    this.clearAllSelectionsWithShadowSupport();
    
    // Clear all highlight-related state
    this.state.setHighlightStartPosition(null);
    this.state.setCurrentSelection(null);
    this.state.setHighlightElement(null);
    this._lastHighlightUpdatePos = { x: -1, y: -1 };
    
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

  handleRootKey(e) {
    if (!this._allowActionKey('handleRootKey', e)) return;
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

  handleLauncherKey(e) {
    if (!this._allowActionKey('handleLauncherKey', e)) return;
    console.log('[KeyPilot] Launcher key pressed!');

    if (this.launcherPopover.isOpen()) {
      this.launcherPopover.hide();
    } else {
      this.launcherPopover.show();
    }
  }

  handleCloseTabKey(e) {
    if (!this._allowActionKey('handleCloseTabKey', e)) return;
    console.log('[KeyPilot] Close tab key pressed!');
    
    try {
      // Send message to background script to close the current tab
      if (!this._sendRuntimeMessage({ type: MSG.CLOSE_TAB })) {
        if (!this._extensionContextInvalidatedHandled) {
          this.showFlashNotification('Failed to Close Tab', COLORS.NOTIFICATION_ERROR);
        }
        return;
      }
      this.showFlashNotification('Closing Tab...', COLORS.NOTIFICATION_INFO);
    } catch (error) {
      if (noteExtensionContextError(error)) {
        this._handleExtensionContextInvalidated();
        return;
      }
      console.error('[KeyPilot] Failed to close tab:', error);
      this.showFlashNotification('Failed to Close Tab', COLORS.NOTIFICATION_ERROR);
    }
  }

  handleNewTabKey(e) {
    if (!this._allowActionKey('handleNewTabKey', e)) return;
    console.log('[KeyPilot] New tab key pressed!');
    
    try {
      // Emit + record transient action BEFORE opening the new tab so onboarding can persist/recover reliably.
      this.emitAction('newTab');
      this._sendRuntimeMessage({ type: MSG.TRANSIENT_ACTION, action: 'newTab', timestamp: Date.now() }, { silent: true });

      // Send message to background script to open a new tab
      if (!this._sendRuntimeMessage({ type: MSG.NEW_TAB })) {
        // Invalidated context already shows a reload hint once.
        if (!this._extensionContextInvalidatedHandled) {
          this.showFlashNotification('Failed to Open New Tab', COLORS.NOTIFICATION_ERROR);
        }
        return;
      }
      this.showFlashNotification('Opening New Tab...', COLORS.NOTIFICATION_INFO);
    } catch (error) {
      if (noteExtensionContextError(error)) {
        this._handleExtensionContextInvalidated();
        return;
      }
      console.error('[KeyPilot] Failed to open new tab:', error);
      this.showFlashNotification('Failed to Open New Tab', COLORS.NOTIFICATION_ERROR);
    }
  }

  handleActivateKey() {
    const currentState = this.state.getState();
    const target = this._getValidatedActivationTarget(currentState);

    if (!target || target === document.documentElement || target === document.body) {
      return;
    }

    // Popover mode is modal: don't allow activation on background page elements.
    if (currentState.mode === MODES.POPOVER) {
      if (!this._isElementInPopover(target)) {
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
      this.overlayManager.flashFocusOverlay(target);
      this.postClickRefresh(target, currentState.lastMouse.x, currentState.lastMouse.y);
      this.emitAction('activate', activationDetail);
      return;
    }

    // Always try to click the element, regardless of whether it's "detected" as interactive
    // This ensures videos, custom elements, and other non-standard interactive elements work
    this.activator.smartClick(target, currentState.lastMouse.x, currentState.lastMouse.y);
    this.showRipple(currentState.lastMouse.x, currentState.lastMouse.y);
    this.overlayManager.flashFocusOverlay(target);
    this.postClickRefresh(target, currentState.lastMouse.x, currentState.lastMouse.y);
    this.emitAction('activate', activationDetail);
  }

  handleActivateNewTabKey() {
    const currentState = this.state.getState();
    const target = this._getValidatedActivationTarget(currentState);

    if (!target || target === document.documentElement || target === document.body) {
      return;
    }

    // Popover mode is modal: don't allow activation on background page elements.
    if (currentState.mode === MODES.POPOVER) {
      if (!this._isElementInPopover(target)) {
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
    // Support both:
    // - traditional <a href="...">
    // - KeyPilot URL listing rows rendered as `[role="link"][data-kp-url="..."]` (e.g. extension New Tab page)
    let link = target;
    let url = null;
    try {
      if (link && link.tagName !== 'A' && typeof link.closest === 'function') {
        link = link.closest('a[href]');
      }
    } catch { }

    if (link && link.tagName === 'A' && link.href) {
      url = link.href;
    } else {
      // `renderUrlListing()` uses role="link" rows with `data-kp-url` instead of <a>.
      try {
        let roleLink = target;
        if (roleLink instanceof Element) {
          if (roleLink.getAttribute('role') !== 'link') {
            roleLink = roleLink.closest?.('[role="link"][data-kp-url]') || null;
          }
          if (roleLink && roleLink.getAttribute('role') === 'link' && roleLink.dataset?.kpUrl) {
            url = String(roleLink.dataset.kpUrl || '').trim() || null;
            link = roleLink;
          }
        }
      } catch { /* ignore */ }
    }

    if (url) {
      this.mouseCoordinateManager.handleLinkClick(currentState.lastMouse.x, currentState.lastMouse.y, link);

      try {
        if (this._sendRuntimeMessage({ type: MSG.OPEN_URL_FOREGROUND, url })) {
          this.showRipple(currentState.lastMouse.x, currentState.lastMouse.y);
          this.overlayManager.flashFocusOverlay(link);
          this.postClickRefresh(link, currentState.lastMouse.x, currentState.lastMouse.y);
          this.emitAction('activateNewTab', { isLink: true, href: url });
          return;
        }
        // Context invalidated — fall through to legacy window.open path below.
      } catch (error) {
        if (noteExtensionContextError(error)) {
          this._handleExtensionContextInvalidated();
        } else {
          console.error('[KeyPilot] Failed to open link in foreground tab:', error);
        }
        // Fall through to legacy behavior below.
      }
    }

    // Try semantic activation first (but force new tab for links)
    if (this.activator.handleSmartActivate(target, currentState.lastMouse.x, currentState.lastMouse.y, true)) {
      this.showRipple(currentState.lastMouse.x, currentState.lastMouse.y);
      this.overlayManager.flashFocusOverlay(target);
      this.postClickRefresh(target, currentState.lastMouse.x, currentState.lastMouse.y);
      this.emitAction('activateNewTab', this._buildActivationDetail(target));
      return;
    }

    // Always try to click the element in new tab mode
    this.activator.smartClick(target, currentState.lastMouse.x, currentState.lastMouse.y, true);
    this.showRipple(currentState.lastMouse.x, currentState.lastMouse.y);
    this.overlayManager.flashFocusOverlay(target);
    this.postClickRefresh(target, currentState.lastMouse.x, currentState.lastMouse.y);
    this.emitAction('activateNewTab', this._buildActivationDetail(target));
  }

  handleActivateNewTabBackgroundKey() {
    const currentState = this.state.getState();
    const target = this._getValidatedActivationTarget(currentState);

    if (!target || target === document.documentElement || target === document.body) {
      return;
    }

    // Popover mode is modal: don't allow activation on background page elements.
    if (currentState.mode === MODES.POPOVER) {
      if (!this._isElementInPopover(target)) {
        return;
      }
    }

    // Find a URL to open:
    // - traditional <a href="...">
    // - KeyPilot URL listing rows rendered as `[role="link"][data-kp-url="..."]`
    let link = target;
    let url = null;
    try {
      if (link && link.tagName !== 'A') {
        link = link.closest?.('a[href]') || link;
      }
    } catch { /* ignore */ }

    if (link && link.tagName === 'A' && link.href) {
      url = link.href;
    } else {
      try {
        let roleLink = target;
        if (roleLink instanceof Element) {
          if (roleLink.getAttribute('role') !== 'link') {
            roleLink = roleLink.closest?.('[role="link"][data-kp-url]') || null;
          }
          if (roleLink && roleLink.getAttribute('role') === 'link' && roleLink.dataset?.kpUrl) {
            url = String(roleLink.dataset.kpUrl || '').trim() || null;
            link = roleLink;
          }
        }
      } catch { /* ignore */ }
    }

    // Only work if we have a URL
    if (!url) {
      console.log('[KeyPilot] Activate New Tab Background: not hovering over a hyperlink');
      return;
    }

    console.log('[KeyPilot] Opening link in new tab (background):', url);

    // Store coordinates for link click
    this.mouseCoordinateManager.handleLinkClick(currentState.lastMouse.x, currentState.lastMouse.y, link);

    // Open link in a background tab (middle-click style: do NOT switch/focus the new tab).
    try {
      if (this._sendRuntimeMessage({ type: MSG.OPEN_URL_BACKGROUND, url })) {
        this.showRipple(currentState.lastMouse.x, currentState.lastMouse.y);
        this.overlayManager.flashFocusOverlay(link);
        this.postClickRefresh(link, currentState.lastMouse.x, currentState.lastMouse.y);
        this.emitAction('activateNewTabBackground', { isLink: true, href: url });
        return;
      }
      // Context invalidated — fall through to window.open fallback.
      try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { /* ignore */ }
    } catch (error) {
      if (noteExtensionContextError(error)) {
        this._handleExtensionContextInvalidated();
      } else {
        console.error('[KeyPilot] Failed to open link in background tab:', error);
      }
      // Fallback (may focus the new tab depending on browser/user settings).
      try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { /* ignore */ }
    }
  }

  handleOpenPopover(e) {
    if (!this._allowActionKey('handleOpenPopover', e)) return;
    // Check if popover is already open - if so, close it (toggle behavior)
    if (this.overlayManager.isPopoverOpen()) {
      this.handleClosePopover();
      return;
    }

    const currentState = this.state.getState();
    const { lastMouse } = currentState;

    // Prefer DOM-hover focusEl; fall back to elementFromPoint when nothing is hovered.
    let target = currentState.focusEl;
    if (!target) {
      const under = this.detector.deepElementFromPoint(lastMouse.x, lastMouse.y);
      target = this.detector.findClickable(under);
    }

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

    // First try to find a traditional <a> element
    if (link.tagName !== 'A') {
      link = link.closest('a[href]');
    }

    // If no <a> element found, look for role="link" elements with data-kp-url
    let url = null;
    if (link && link.tagName === 'A' && link.href) {
      url = link.href;
    } else {
      // Look for role="link" elements (used by renderUrlListing)
      let roleLink = probe;
      if (roleLink.getAttribute('role') !== 'link') {
        roleLink = roleLink.closest('[role="link"]');
      }

      if (roleLink && roleLink.getAttribute('role') === 'link' && roleLink.dataset.kpUrl) {
        url = roleLink.dataset.kpUrl;
        link = roleLink; // Use the role="link" element as the link
      }
    }

    // If we're inside a shadow root and closest() didn't find it, walk up to the host and retry.
    // This allows resolving links that span across shadow boundaries (common with web-components).
    let guard = 0;
    while ((!url) && guard++ < 10) {
      const root = probe.getRootNode?.();
      if (!(root instanceof ShadowRoot) || !(root.host instanceof Element)) break;
      probe = root.host;

      // Retry finding links in the host element
      let hostLink = probe;
      if (hostLink.tagName !== 'A') {
        hostLink = hostLink.closest('a[href]');
      }
      if (hostLink && hostLink.tagName === 'A' && hostLink.href) {
        url = hostLink.href;
        link = hostLink;
        break;
      }

      // Also check for role="link" in host
      let hostRoleLink = probe;
      if (hostRoleLink.getAttribute('role') !== 'link') {
        hostRoleLink = hostRoleLink.closest('[role="link"]');
      }
      if (hostRoleLink && hostRoleLink.getAttribute('role') === 'link' && hostRoleLink.dataset.kpUrl) {
        url = hostRoleLink.dataset.kpUrl;
        link = hostRoleLink;
        break;
      }
    }

    if (!url) {
      console.log('[KeyPilot] Open popover: not hovering over a link');
      return;
    }
    console.log('[KeyPilot] Opening popover for link:', url);

    // Show popover
    this.overlayManager.showPopover(url);
    this.state.setPopoverOpen(true, url);
  }

  handlePreviewLinkPopover(e) {
    if (!this._allowActionKey('handlePreviewLinkPopover', e)) return;
    // Check if popover is already open - if so, close it (toggle behavior)
    if (this.overlayManager.isPopoverOpen()) {
      this.handleClosePopover();
      return;
    }

    const currentState = this.state.getState();
    const { lastMouse } = currentState;

    // Prefer DOM-hover focusEl; fall back to elementFromPoint when nothing is hovered.
    let target = currentState.focusEl;
    if (!target) {
      const under = this.detector.deepElementFromPoint(lastMouse.x, lastMouse.y);
      target = this.detector.findClickable(under);
    }

    // Resolve to the closest anchor (including within shadow DOM)
    if (!target || !(target instanceof Element)) {
      console.log('[KeyPilot] Preview popover: not hovering over a link');
      return;
    }

    let probe = target;
    let link = probe;

    // First try to find a traditional <a> element
    if (link.tagName !== 'A') {
      link = link.closest('a[href]');
    }

    // If no <a> element found, look for role="link" elements with data-kp-url
    let url = null;
    if (link && link.tagName === 'A' && link.href) {
      url = link.href;
    } else {
      // Look for role="link" elements (used by renderUrlListing)
      let roleLink = probe;
      if (roleLink.getAttribute('role') !== 'link') {
        roleLink = roleLink.closest('[role="link"]');
      }

      if (roleLink && roleLink.getAttribute('role') === 'link' && roleLink.dataset.kpUrl) {
        url = roleLink.dataset.kpUrl;
        link = roleLink;
      }
    }

    // If we're inside a shadow root and closest() didn't find it, walk up to the host and retry
    let guard = 0;
    while ((!url) && guard++ < 10) {
      const root = probe.getRootNode?.();
      if (!(root instanceof ShadowRoot) || !(root.host instanceof Element)) break;
      probe = root.host;

      // Retry finding links in the host element
      let hostLink = probe;
      if (hostLink.tagName !== 'A') {
        hostLink = hostLink.closest('a[href]');
      }
      if (hostLink && hostLink.tagName === 'A' && hostLink.href) {
        url = hostLink.href;
        link = hostLink;
        break;
      }

      // Also check for role="link" in host
      let hostRoleLink = probe;
      if (hostRoleLink.getAttribute('role') !== 'link') {
        hostRoleLink = hostRoleLink.closest('[role="link"]');
      }
      if (hostRoleLink && hostRoleLink.getAttribute('role') === 'link' && hostRoleLink.dataset.kpUrl) {
        url = hostRoleLink.dataset.kpUrl;
        link = hostRoleLink;
        break;
      }
    }

    if (!url) {
      console.log('[KeyPilot] Preview popover: not hovering over a link');
      return;
    }
    console.log('[KeyPilot] Opening preview popover for link:', url);

    // Show preview popover near cursor
    this.overlayManager.showPreviewPopover(url, {
      title: 'Link Preview',
      mouseX: lastMouse.x,
      mouseY: lastMouse.y
    });
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

    // Master–detail settings layout: left nav (~168px) + detail pane.
    // Prefer a wider frame than the old single-column cards so tabs stay readable.
    const settingsContainerWidth = Math.min(980, window.innerWidth - 36) + 20;
    const settingsContainerHeight = Math.min(window.innerHeight * 0.82, window.innerHeight - 80) + 20;

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
      closeKeys: ['Escape', "'", '"', 'p', 'P'],
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

    // Launcher is not a state.mode but must still close on Escape/cancel.
    try {
      if (this.launcherPopover?.isOpen?.()) {
        this.launcherPopover.hide();
        return;
      }
    } catch { /* ignore */ }
    
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
        // Re-apply permanent DOM-hover targeting BEFORE re-init.
        try {
          if (typeof this.intersectionManager.setDomHoverListenersEnabled === 'function') {
            this.intersectionManager.setDomHoverListenersEnabled(
              true,
              (el) => this._handleDomHoverChange(el)
            );
          }
        } catch { /* ignore */ }
        await this.intersectionManager.init();
      }

      // Re-apply visual indicator on enable.
      try {
        if (this.overlayManager && typeof this.overlayManager.setDomHoverFocusColorsEnabled === 'function') {
          this.overlayManager.setDomHoverFocusColorsEnabled(true);
        }
      } catch { /* ignore */ }
      
      // Restart scroll manager
      if (this.scrollManager) {
        this.scrollManager.init();
      }
      
      // Reset state to normal mode
      this.state.reset();

      // Force a hover/overlay refresh immediately on re-enable.
      // Without this, focus overlays can remain hidden until the mouse moves past the
      // threshold gate in `updateElementsUnderCursorWithThreshold()`, even though
      // keyboard actions still work.
      try {
        const { lastMouse } = this.state.getState();
        const x = Number(lastMouse?.x);
        const y = Number(lastMouse?.y);
        if (Number.isFinite(x) && Number.isFinite(y) && (x !== 0 || y !== 0)) {
          // Bypass threshold gating: the DOM may have changed while disabled.
          this.updateElementsUnderCursor(x, y, false, null);
        } else {
          // If we don't have a valid mouse position yet, attempt to seed it.
          await this.initializeCursorPosition();
          const s2 = this.state.getState();
          const x2 = Number(s2.lastMouse?.x);
          const y2 = Number(s2.lastMouse?.y);
          if (Number.isFinite(x2) && Number.isFinite(y2) && (x2 !== 0 || y2 !== 0)) {
            this.updateElementsUnderCursor(x2, y2, false, null);
          }
        }
      } catch { /* ignore */ }
    }

    // Restore keyboard reference UI based on persisted state.
    // Fire-and-forget: we don't want to block enable() on storage.
    try {
      this.refreshKeyboardHelpVisibilityFromStorage();
    } catch { /* ignore */ }

    try {
      this.controlStrip?.setEnabledState?.(true);
      this.controlStrip?.setKeyboardHelpActive?.(!!this._keyboardHelpVisible);
    } catch { /* ignore */ }
    
    console.log('[KeyPilot] Extension enabled');
  }

  /**
   * Tear down every transient KeyPilot UI surface (popovers, launcher, omnibox,
   * keyboard help, highlight mode, onboarding panels, flash toasts, etc.).
   * Safe to call while already disabled / partially initialized.
   */
  dismissActiveUI() {
    // Modes / highlight selection first so follow-up closes don't fight mode state.
    try {
      if (this.state?.getState?.()?.mode === MODES.HIGHLIGHT) {
        this.cancelHighlightMode?.();
      }
    } catch { /* ignore */ }

    // Launcher (;)
    try { this.launcherPopover?.hide?.(); } catch { /* ignore */ }

    // Omnibox (Alt+L)
    try { this.handleCloseOmnibox?.(); } catch { /* ignore */ }
    try { this.omniboxManager?.hide?.(); } catch { /* ignore */ }

    // Tab history popover
    try { this.tabHistoryPopover?.hide?.(); } catch { /* ignore */ }

    // P-key / settings / guide iframe popovers + preview popovers
    try { this.handleClosePopover?.(); } catch { /* ignore */ }
    try { this.overlayManager?.hidePopover?.(); } catch { /* ignore */ }

    // Any remaining PopupManager modals (backdrop + panels)
    try { this.overlayManager?.popupManager?.closeAll?.(); } catch { /* ignore */ }

    // Floating keyboard reference panel
    if (this.floatingKeyboardHelp) {
      try { this.floatingKeyboardHelp.cleanup(); } catch { /* ignore */ }
      this.floatingKeyboardHelp = null;
    }

    // Note: Control strip is intentionally NOT torn down here so users can
    // re-enable KeyPilot from the On/Off segment while the extension is off.

    // Focus / hover chrome
    try {
      this.overlayManager?.hideFocusOverlay?.();
      this.overlayManager?.hideDeleteOverlay?.();
      this.overlayManager?.hideEscExitLabel?.();
      this.overlayManager?.hideActiveTextInputFrame?.();
      this.overlayManager?.hideFocusedTextOverlay?.();
    } catch { /* ignore */ }

    // Onboarding / practice panels
    try {
      const ob = window.__KeyPilotOnboarding;
      if (ob && typeof ob.setActive === 'function') {
        void ob.setActive(false);
      } else {
        try { ob?.panel?.hide?.(); } catch { /* ignore */ }
        try { ob?.practicePanel?.hide?.(); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    // Ephemeral toasts left on the page
    try {
      document.querySelectorAll(
        '.kpv2-flash-notification, .kpv2-toggle-notification'
      ).forEach((el) => {
        try { el.remove(); } catch { /* ignore */ }
      });
    } catch { /* ignore */ }

    // Reset mode/state so a re-enable starts clean
    try { this.state?.reset?.(); } catch { /* ignore */ }
  }

  /**
   * Disable KeyPilot functionality
   */
  disable() {
    if (!this.enabled) return;
    
    this.enabled = false;

    // Always dismiss popovers/launcher/omnibox even if init is incomplete.
    this.dismissActiveUI();

    try {
      this.controlStrip?.setEnabledState?.(false);
      this.controlStrip?.setKeyboardHelpActive?.(false);
    } catch { /* ignore */ }
    
    // Only cleanup if initialization is complete
    if (this.initializationComplete) {
      // Stop event listeners
      this.stop();
      
      // Hide cursor
      if (this.cursor) {
        this.cursor.hide();
      }
      
      // Stop focus detector
      if (this.focusDetector) {
        this.focusDetector.stop();
      }
      
      // Clean up intersection manager
      if (this.intersectionManager) {
        // Ensure delegated DOM-hover listeners are detached promptly on disable.
        try { this.intersectionManager.setDomHoverListenersEnabled(false, null); } catch { /* ignore */ }
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
      
      // Clear any active state (again after manager cleanup)
      this.state.reset();
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
    try { this.dismissActiveUI(); } catch { /* ignore */ }
    try {
      if (this.controlStrip) {
        this.controlStrip.cleanup();
        this.controlStrip = null;
      }
    } catch { /* ignore */ }
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