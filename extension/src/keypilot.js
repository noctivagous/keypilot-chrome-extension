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
import { ColumnLayoutManager } from './modules/column-layout-manager.js';
import {
  InspectorModeController,
  getInspectorCursorMode,
  getInspectorStatusMode,
  getInspectorDef
} from './modules/inspector-mode.js';
import { MODES, INSPECTOR_KIND, CURSOR_MODE, CSS_CLASSES, COLORS, Z_INDEX, RECTANGLE_SELECTION, EDGE_ONLY_SELECTION, FEATURE_FLAGS, SCROLL, CLICKABLE_CATEGORY } from './config/constants.js';
import { MSG } from './messaging/types.js';
import {
  buildKeybindingsForLayout,
  buildSystemKeybindings,
  DEFAULT_KEYBOARD_HANDEDNESS,
  DEFAULT_KEYBOARD_LAYOUT_ID,
  getInstalledKeyboardLayoutFamilyIds,
  getKeyboardUiLayoutForLayout,
  KEYBINDING_ACTION_DEFS,
  normalizeKeyboardHandedness,
  normalizeKeyboardLayoutFamilyId,
  resolveKeyboardLayoutId
} from './config/keyboard-layouts.js';
import { FloatingKeyboardHelp } from './ui/floating-keyboard-help.js';
import { ControlStrip } from './ui/control-strip.js';
import { pinKeyPopover } from './ui/keybindings-ui.js';
import { getActionMode, getActionParameter } from './ui/key-action-settings.js';
import { deliverActionResult, normalizeActionResultDestination } from './modules/action-result-delivery.js';
import { sendTextToAi } from './modules/ai-text-service.js';
import { OmniboxManager } from './modules/omnibox-manager.js';
import { TabHistoryPopover } from './modules/tab-history-popover.js';
import { LauncherPopover } from './modules/launcher-popover.js';
import { DEFAULT_SETTINGS, getSettings, setSettings, SETTINGS_STORAGE_KEY, scrollBehaviorFromSpeed } from './modules/settings-manager.js';
import { getUserKeyboardLayoutById, getUserActionById, listUserActions, listUserMacroKeys, listUserMacros } from './modules/keyboard-layout-store.js';
import { runMacroKeyById, runLegacyMacroKeyFunction } from './modules/macro-key-runtime.js';
import { getFunctionDef } from './config/function-library.js';
import { toggleKeyboardLayoutConfigurator } from './ui/keyboard-layout-configurator.js';
import {
  isExtensionContextValid,
  noteExtensionContextError,
  safeRuntimeSendMessage
} from './utils/extension-context.js';
import { storageGetValue, storageSetValue } from './utils/storage.js';
import { getHoveredImage } from './utils/image-utils.js';
import { scrollAtPoint, scrollToEdgeAtPoint, elementFromPointDeep } from './utils/scroll-at-point.js';

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
    this.columnLayoutManager = new ColumnLayoutManager();
    this.inspector = new InspectorModeController({
      state: this.state,
      deepElementFromPoint: (x, y) => this.detector.deepElementFromPoint(x, y),
      onBeforeEnter: () => {
        // Cancel competing select modes when entering any inspector kind
        try {
          if (this.state.isHighlightMode()) this.cancelHighlightMode();
        } catch { /* ignore */ }
      },
      onPicksChanged: (picks, unionRect) => {
        try {
          const kind = this.inspector.getKind();
          this.overlayManager?.updateInspectorPickedOverlays?.(picks, unionRect, kind);
        } catch { /* ignore */ }
      }
    });
    this.shadowDOMManager = new ShadowDOMManager(this.styleManager);
    this.floatingKeyboardHelp = null;
    this.controlStrip = null;
    this._systemKeybindings = buildSystemKeybindings(DEFAULT_KEYBOARD_HANDEDNESS);
    this._layoutKeybindings = buildKeybindingsForLayout(DEFAULT_KEYBOARD_LAYOUT_ID);
    this.keybindings = {
      ...this._layoutKeybindings,
      ...this._systemKeybindings
    };
    this._keyboardLayoutId = DEFAULT_KEYBOARD_LAYOUT_ID;
    this._keyboardUiLayout = getKeyboardUiLayoutForLayout(DEFAULT_KEYBOARD_LAYOUT_ID);
    this._currentKeyboardLayoutId = 'builtin';
    this._currentUserLayout = null;
    this._currentUserMacros = [];
    this._currentUserMacroKeys = [];
    this._currentUserActions = [];
    this._currentKeySlotMap = null;
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
    // Scroll lifecycle: isScrolling + scroll-end re-query, highlight live-refresh,
    // fixed inspector/labels. Element-styled focus/text chrome is not repainted per frame
    // (see OptimizedScrollManager). Fixed canvas/RBush path can re-enable later.
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

    // Child-frame pointer sync (KP_FRAME_POINTER) + keyboard reclaim from embeds.
    /** @type {((event: MessageEvent) => void)|null} */
    this._boundFrameBridgeMessage = null;
    /** @type {boolean} */
    this._framePointerInside = false;
    /** @type {HTMLIFrameElement|HTMLFrameElement|null} */
    this._framePointerIframe = null;

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
      if (!el || el === document.documentElement || el === document.body) return false;

      let n = el;
      let guard = 0;
      while (n && n.nodeType === 1 && guard++ < 12) {
        // Stop before <html>/<body>: html.kpv2-cursor-hidden is a page-wide
        // cursor-mode flag, not chrome. Matching it would skip hover on nearly
        // every element whenever Crosshair cursor mode is enabled.
        if (n === document.documentElement || n === document.body) break;

        const id = typeof n.id === 'string' ? n.id : '';
        if (id && id.startsWith('kpv2-')) return true;

        const cl = n.classList;
        if (cl && cl.length) {
          for (const c of cl) {
            if (typeof c !== 'string' || !c.startsWith('kpv2-')) continue;
            // Markers painted onto real page nodes — not KeyPilot chrome.
            if (
              c === 'kpv2-cursor-hidden' ||
              c === 'kpv2-focus' ||
              c === 'kpv2-delete' ||
              c === 'kpv2-highlight' ||
              c === 'kpv2-hidden' ||
              c === 'kpv2-cols' ||
              c === 'kpv2-cols-active' ||
              c === 'kpv2-cols-page' ||
              c === 'kpv2-inspector' ||
              c === 'kpv2-inspector-picked' ||
              c.startsWith('kpv2-text-') ||
              (c.startsWith('kpv2-focus-') && !c.includes('overlay'))
            ) {
              continue;
            }
            return true;
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
      /** True when F activated the element that had the blue/green focus outline. */
      hadFocusOutline: false,
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
      // In layout edit mode, F should not pin key-info popovers (keys show delete × instead).
      const editing = !!(this.floatingKeyboardHelp && typeof this.floatingKeyboardHelp.isEditMode === 'function'
        && this.floatingKeyboardHelp.isEditMode());
      if (keyEl && inKeyboardHelp && !editing) detail.isKeyboardHelpKey = true;
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
    // Keyboard reference: gray Click Element again until the next armed hover.
    try { this.floatingKeyboardHelp?.setTextModeActivateArmed?.(false); } catch { /* ignore */ }
  }

  _armTextModeClick(target) {
    this._clearTextModeClickTimers();
    this._textModeClickArmed = true;
    this._textModeClickArmedTarget = target;

    let remaining = 3;
    try { this.overlayManager?.setHoverClickLabelText?.(`F clicks ${remaining}`); } catch { /* ignore */ }
    // Keyboard reference: enable Click Element for the countdown window only.
    try { this.floatingKeyboardHelp?.setTextModeActivateArmed?.(true); } catch { /* ignore */ }

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
          const mode = this._cursorModeForState(st);
          this.cursor.setMode(mode, this._buildCursorOptionsForState({ ...st, mode: st.mode }));
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
    // Perpetual rAF cursor sync removed — cursor tracks via pointermove only.
    // (Legacy setupContinuousCursorSync woke the main thread at ~60Hz on every page.)
    this._signalEarlyInjectHandoff();

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
    try {
      void this._refreshCurrentKeyboardLayoutFromSettings();
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

    // Active text input frame stroke thickness + left-edge bar width (CSS-driven).
    try {
      const px = Number(this._settings?.textMode?.strokeThickness);
      if (Number.isFinite(px)) {
        document.documentElement.style.setProperty('--kpv2-text-stroke-width', `${px}px`);
      } else {
        document.documentElement.style.removeProperty('--kpv2-text-stroke-width');
      }
    } catch { /* ignore */ }

    try {
      const edgePx = Number(this._settings?.textMode?.leftEdgeWidth);
      if (Number.isFinite(edgePx)) {
        document.documentElement.style.setProperty('--kpv2-text-left-edge-width', `${edgePx}px`);
      } else {
        document.documentElement.style.removeProperty('--kpv2-text-left-edge-width');
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
          this.cursor.setMode(this._cursorModeForState(st), this._buildCursorOptionsForState(st));
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

    // Keyboard link-hover glow may have been toggled in Settings → Click Mode.
    try {
      this._linkHoverHintLastApplied = null;
      this._flushKeyboardLinkHoverHints();
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
  _syncControlStripTextModeFromState() {
    if (!this.controlStrip || typeof this.controlStrip.setTextModeActive !== 'function') return;
    try {
      const mode = this.state?.getState?.()?.mode;
      this.controlStrip.setTextModeActive(mode === MODES.TEXT_FOCUS);
    } catch { /* ignore */ }
  }

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
    this._syncControlStripTextModeFromState();
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
    this._syncControlStripTextModeFromState();
    // Avoid re-notifying storage when applying remote settings.
    this.controlStrip.setCollapsed(collapsed, { notify: false });
    this.controlStrip.setVisible(visible);
  }

  /**
   * Toggle the control strip (Alt+J).
   * When showing: persists visible=true and keeps the existing collapsed state.
   * When hiding: persists visible=false (same as the strip close button).
   */
  async toggleControlStripFromHotkey() {
    if (window !== window.top) return;
    this.setupControlStrip();

    // Prefer live DOM visibility; fall back to settings when the strip is not mounted yet.
    let currentlyVisible = false;
    try {
      if (this.controlStrip && typeof this.controlStrip.isVisible === 'function') {
        currentlyVisible = !!this.controlStrip.isVisible();
      } else {
        currentlyVisible = this._settings?.controlStrip?.visible !== false;
      }
    } catch {
      currentlyVisible = this._settings?.controlStrip?.visible !== false;
    }

    // Only flip visibility — preserve collapsed/expanded as last set by the user.
    const patch = { visible: !currentlyVisible };

    try {
      await setSettings({ controlStrip: patch });
    } catch { /* ignore */ }
    try {
      if (this._settings) {
        this._settings.controlStrip = {
          ...(this._settings.controlStrip || DEFAULT_SETTINGS.controlStrip),
          ...patch
        };
      }
    } catch { /* ignore */ }
    this.applyControlStripFromSettings();
  }

  /** @deprecated Use toggleControlStripFromHotkey — kept for older call sites. */
  async showControlStripFromHotkey() {
    return this.toggleControlStripFromHotkey();
  }

  _applyKeyboardLayoutFromSettings() {
    const handedness = normalizeKeyboardHandedness(this._settings?.keyboardHandedness);
    const layoutId = resolveKeyboardLayoutId({
      familyId: this._settings?.keyboardLayoutFamilyId,
      handedness
    });
    this._keyboardLayoutId = layoutId;
    // Layout family assignments only — system keys live in a separate always-on layer.
    this._layoutKeybindings = buildKeybindingsForLayout(layoutId);
    this._systemKeybindings = buildSystemKeybindings(handedness);
    this.keybindings = {
      ...this._layoutKeybindings,
      ...this._systemKeybindings
    };
    const showNumberRow = !!this._settings?.keyboardReferenceShowNumberRow;
    this._keyboardUiLayout = getKeyboardUiLayoutForLayout(layoutId, { includeNumberRow: showNumberRow });

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

  async _refreshCurrentKeyboardLayoutFromSettings() {
    let sel = String(this._settings?.currentKeyboardLayoutId || 'builtin');
    this._currentKeyboardLayoutId = sel;
    this._currentUserLayout = null;
    this._currentUserMacros = [];
    this._currentUserMacroKeys = [];
    this._currentUserActions = [];
    this._currentKeySlotMap = null;

    if (sel && sel.startsWith('user:')) {
      const id = sel.slice('user:'.length);
      const layout = await getUserKeyboardLayoutById(id);
      if (layout) {
        this._currentUserLayout = layout;
        try { this._currentUserMacros = await listUserMacros(); } catch { this._currentUserMacros = []; }
        try { this._currentUserMacroKeys = await listUserMacroKeys(); } catch { this._currentUserMacroKeys = []; }
        try { this._currentUserActions = await listUserActions(); } catch { this._currentUserActions = []; }
        // Slots map: key label -> assigned item
        this._currentKeySlotMap = layout.slots && typeof layout.slots === 'object' ? layout.slots : {};
      } else {
        // Orphaned selection (layout deleted) — fall back to built-in and heal settings.
        sel = 'builtin';
        this._currentKeyboardLayoutId = 'builtin';
        try {
          if (this._settings) this._settings.currentKeyboardLayoutId = 'builtin';
          await setSettings({ currentKeyboardLayoutId: 'builtin' });
        } catch { /* ignore */ }
      }
    }

    // If the floating keyboard reference is active, keep it in sync (including title dropdown).
    try {
      if (this.floatingKeyboardHelp && typeof this.floatingKeyboardHelp.setActiveLayoutSelection === 'function') {
        this.floatingKeyboardHelp.setActiveLayoutSelection({
          currentKeyboardLayoutId: this._currentKeyboardLayoutId,
          userLayout: this._currentUserLayout,
          userMacros: this._currentUserMacros,
          userMacroKeys: this._currentUserMacroKeys
        });
      }
    } catch { /* ignore */ }
  }

  /**
   * Push a just-saved user layout into live dispatch + Keyboard Reference immediately
   * (no page refresh). Used after place / DnD / Config CRUD.
   * @param {any} layout
   * @param {{ setAsCurrent?: boolean, macros?: any[], macroKeys?: any[], actions?: any[] }} [opts]
   */
  async applyLiveUserLayout(layout, opts = {}) {
    if (!layout || !layout.id) return;
    const sel = `user:${layout.id}`;
    const isCurrent =
      !!opts.setAsCurrent || String(this._currentKeyboardLayoutId || '') === sel;

    if (opts.setAsCurrent) {
      this._currentKeyboardLayoutId = sel;
      if (this._settings) this._settings.currentKeyboardLayoutId = sel;
      try {
        await setSettings({ currentKeyboardLayoutId: sel });
      } catch { /* ignore */ }
    }

    // Only replace live key dispatch when this layout is (or just became) current.
    if (isCurrent) {
      this._currentUserLayout = layout;
      this._currentKeySlotMap = layout.slots && typeof layout.slots === 'object' ? layout.slots : {};
      if (Array.isArray(opts.macros)) this._currentUserMacros = opts.macros;
      if (Array.isArray(opts.macroKeys)) this._currentUserMacroKeys = opts.macroKeys;
      if (Array.isArray(opts.actions)) this._currentUserActions = opts.actions;
    }

    try {
      this.floatingKeyboardHelp?.setActiveLayoutSelection?.({
        currentKeyboardLayoutId: this._currentKeyboardLayoutId || (isCurrent ? sel : 'builtin'),
        userLayout: this._currentUserLayout,
        userMacros: this._currentUserMacros,
        userMacroKeys: this._currentUserMacroKeys
      });
    } catch { /* ignore */ }
  }

  _maybeHandleCurrentLayoutBinding(e) {
    try {
      const sel = String(this._currentKeyboardLayoutId || '');
      if (!sel || !sel.startsWith('user:')) return false;
      const slots = this._currentKeySlotMap;
      if (!slots || typeof slots !== 'object') return false;

      const key = (e && typeof e.key === 'string') ? e.key : '';
      if (!key || key === ' ') return false;
      const slot = String(key).trim().toUpperCase();
      if (!slot) return false;
      const assigned = slots[slot];
      if (!assigned || !assigned.type || !assigned.id) return false;

      if (assigned.type === 'macro') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this._runMacroById(String(assigned.id));
        return true;
      }

      if (assigned.type === 'macroKey') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        void this._runMacroKeyById(String(assigned.id));
        return true;
      }

      if (assigned.type === 'action') {
        const def = KEYBINDING_ACTION_DEFS?.[assigned.id];
        const handlerName = def && def.handler ? String(def.handler) : '';
        const fn = handlerName ? this[handlerName] : null;
        if (typeof fn !== 'function') return false;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        try {
          const ret = fn.call(this, e);
          if (ret && typeof ret.then === 'function') {
            void ret.catch((err) => {
              console.warn('[KeyPilot] Action handler failed:', handlerName, err);
            });
          }
        } catch (err) {
          console.warn('[KeyPilot] Action handler threw:', handlerName, err);
        }
        return true;
      }

      // Unified Function Library dispatch (see function-library.js). `assigned.id` is either
      // a bare Function id (parameterless, e.g. "ACTIVATE") or an Action Instance id
      // ("action:<uuid>") whose bound parameters live in `_currentUserActions`.
      if (assigned.type === 'function') {
        return this._dispatchFunctionSlot(String(assigned.id), e);
      }
    } catch {
      // ignore
    }
    return false;
  }

  /**
   * @param {string} id Bare Function id or Action Instance id ("action:<uuid>").
   * @param {KeyboardEvent} e
   * @returns {boolean}
   */
  _dispatchFunctionSlot(id, e) {
    let functionId = id;
    let parameters;
    let instanceId;

    if (id.startsWith('action:')) {
      const instance = (this._currentUserActions || []).find((a) => a && a.id === id);
      if (!instance) {
        // Not cached yet (e.g. instance just created elsewhere) — resolve asynchronously.
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        void this._dispatchFunctionSlotAsync(id, e);
        return true;
      }
      functionId = instance.functionId;
      parameters = instance.parameters;
      instanceId = id;
    }

    const def = getFunctionDef(functionId);
    const handlerName = def && def.handler ? String(def.handler) : '';
    const fn = handlerName ? this[handlerName] : null;
    if (typeof fn !== 'function') return false;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    try {
      const ret = fn.call(this, e, parameters, { functionId, instanceId });
      if (ret && typeof ret.then === 'function') {
        void ret.catch((err) => {
          console.warn('[KeyPilot] Function handler failed:', handlerName, err);
        });
      }
    } catch (err) {
      console.warn('[KeyPilot] Function handler threw:', handlerName, err);
    }
    return true;
  }

  /**
   * @param {string} instanceId
   * @param {KeyboardEvent} e
   */
  async _dispatchFunctionSlotAsync(instanceId, e) {
    try {
      const instance = await getUserActionById(instanceId);
      if (!instance) return;
      const def = getFunctionDef(instance.functionId);
      const handlerName = def && def.handler ? String(def.handler) : '';
      const fn = handlerName ? this[handlerName] : null;
      if (typeof fn !== 'function') return;
      fn.call(this, e, instance.parameters, { functionId: instance.functionId, instanceId });
    } catch { /* ignore */ }
  }

  /**
   * Always-on system keybinding layer (Esc, KB Reference, Settings).
   * Independent of the selected layout family / user layout.
   * Alt+ chrome hotkeys (Alt+K, Alt+C, …) are handled earlier in handleKeyDown.
   * @param {KeyboardEvent} e
   * @returns {boolean}
   */
  _maybeHandleSystemLayerBinding(e) {
    try {
      const systemKb = this._systemKeybindings && typeof this._systemKeybindings === 'object'
        ? this._systemKeybindings
        : buildSystemKeybindings(this._settings?.keyboardHandedness);
      for (const keybinding of Object.values(systemKb || {})) {
        if (!keybinding?.handler || !Array.isArray(keybinding.keys)) continue;
        const matchOn = Array.isArray(keybinding.matchOn) ? keybinding.matchOn : ['key'];
        const isMatch = matchOn.some((field) => keybinding.keys.includes(e[field]));
        if (!isMatch) continue;
        if (this._isUnsafeToRunActionKey(e)) return false;
        const handlerFn = this[keybinding.handler];
        if (typeof handlerFn !== 'function') return false;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handlerFn.call(this, e);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }

  _runMacroById(macroId) {
    // Placeholder: macro execution pipeline will be implemented later.
    try {
      const id = String(macroId || '');
      if (!id) return;
      const label = (this._currentUserMacros || []).find((m) => m && m.id === id)?.label || 'Macro';
      this.overlayManager?.showNotification?.(`Macro: ${label} (execution not implemented yet)`, 'info');
    } catch { /* ignore */ }
  }

  /**
   * Run a configured built-in Macro Key (hotkey / burst / round-robin / …).
   * @param {string} macroKeyId
   */
  async _runMacroKeyById(macroKeyId) {
    try {
      await runMacroKeyById(macroKeyId, {
        notify: (msg, type) => {
          try { this.overlayManager?.showNotification?.(msg, type || 'info'); } catch { /* ignore */ }
        }
      });
    } catch { /* ignore */ }
  }

  /**
   * @param {number} direction -1 for prev, +1 for next
   */
  _cycleKeyboardLayoutFamily(direction) {
    try {
      const families = getInstalledKeyboardLayoutFamilyIds();
      if (!Array.isArray(families) || families.length <= 1) return;

      const currentSettings = this._settings || DEFAULT_SETTINGS;
      const currentFamily = normalizeKeyboardLayoutFamilyId(currentSettings?.keyboardLayoutFamilyId);
      const idx = families.indexOf(currentFamily);
      const start = idx >= 0 ? idx : 0;
      const nextIdx = (start + (direction < 0 ? -1 : 1) + families.length) % families.length;
      const nextFamily = families[nextIdx];

      // Optimistically apply immediately (so key handling + keyboard reference update without waiting on storage).
      this._settings = { ...currentSettings, keyboardLayoutFamilyId: nextFamily };
      this._applyKeyboardLayoutFromSettings();

      // Persist (storage sync will also refresh all tabs).
      setSettings({ keyboardLayoutFamilyId: nextFamily }).catch(() => { /* ignore */ });
    } catch {
      // ignore
    }
  }

  _toggleKeyboardLayoutConfigurator() {
    toggleKeyboardLayoutConfigurator(this);
  }

  /**
   * Paint layout-aware "Press F to select text field" / "press Esc to exit" SVG
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
      hover: `Press ${activate} to select text field`,
      focus: `press ${cancel} to exit`
    });
  }

  installSettingsSync() {
    if (this._settingsStorageListener) return;
    try {
      this._settingsStorageListener = (changes, area) => {
        // Prefer sync; also accept local (storage helper falls back when sync fails).
        if (area !== 'sync' && area !== 'local') return;
        if (!changes || !changes[SETTINGS_STORAGE_KEY]) return;
        this.refreshSettingsFromStorage();
      };
      chrome.storage.onChanged.addListener(this._settingsStorageListener);
    } catch {
      // ignore
    }
    // Immediate in-page updates from Key Action Config (prompt / destination).
    try {
      if (!this._actionSettingsDomListener) {
        this._actionSettingsDomListener = (ev) => {
          try {
            const next = ev?.detail?.settings;
            if (next && typeof next === 'object') this._settings = next;
          } catch { /* ignore */ }
        };
        document.addEventListener('keypilot:action-settings-changed', this._actionSettingsDomListener);
      }
    } catch { /* ignore */ }
  }

  /**
   * Resolve cursor glyph mode from state.
   * Inspector uses kind-specific cursors (delete / cols / …).
   * @param {any} state
   * @returns {string}
   */
  _cursorModeForState(state) {
    const mode = state?.mode;
    if (mode === MODES.INSPECTOR) {
      return getInspectorCursorMode(state?.inspectorKind);
    }
    // Legacy status/mode strings still map to the same glyphs
    if (mode === MODES.DELETE || mode === 'delete') return 'delete';
    if (mode === MODES.COLS || mode === 'cols') return 'cols';
    return mode || MODES.NONE;
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
      // Only seed when settings are loaded. If _settings is null, leave position
      // unhydrated so show() waits for storage instead of painting bottom-left first.
      const settingsReady = !!this._settings;
      const knownPosition = settingsReady
        ? (this._settings.panelPositions?.keyboardReference
          || DEFAULT_SETTINGS.panelPositions?.keyboardReference
          || null)
        : null;

      if (!this.floatingKeyboardHelp) {
        const FloatingKeyboardHelpClass = FloatingKeyboardHelp || window.FloatingKeyboardHelp;
        this.floatingKeyboardHelp = new FloatingKeyboardHelpClass({
          keybindings: kb,
          keyboardLayout: this._keyboardUiLayout,
          layoutId: this._keyboardLayoutId,
          // Seed saved dock/free coords so the first paint is not bottom-left then jump.
          panelPosition: knownPosition || undefined
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
        // Re-seed from settings before show (handles multi-tab move while hidden).
        if (settingsReady && typeof this.floatingKeyboardHelp.setPanelPositionFromSettings === 'function') {
          this.floatingKeyboardHelp.setPanelPositionFromSettings(knownPosition);
        }
      }

      try {
        if (typeof this.floatingKeyboardHelp.setActiveLayoutSelection === 'function') {
          this.floatingKeyboardHelp.setActiveLayoutSelection({
            currentKeyboardLayoutId: this._currentKeyboardLayoutId || 'builtin',
            userLayout: this._currentUserLayout,
            userMacros: this._currentUserMacros,
            userMacroKeys: this._currentUserMacroKeys
          });
        }
      } catch { /* ignore */ }

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
    // Primary path: element-styled focus rings (DOM-hover). Do not allocate a
    // full-viewport canvas/DOM fixed overlay backend — that was for RBush-era
    // fixed rings and is unused while usesElementFocusStyling() is true.
    // Canvas remains available via setRenderingMode('canvas') for experiments.
    this.overlayManager.setRenderingMode('dom');

    // Initialize debug panel if enabled
    this.overlayManager.initDebugPanel();

    // Shadow-root paint debug HUD (FEATURE_FLAGS.DEBUG_SHADOW_ROOT_HUD or
    // keyPilot.setShadowRootDebugHud(true) at runtime).
    try {
      if (FEATURE_FLAGS.DEBUG_SHADOW_ROOT_HUD) {
        this.overlayManager.setShadowRootDebugHud(true);
      }
    } catch { /* ignore */ }

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

    // Element focus chrome (styles the hovered node; scrolls with the page).
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
    this._installFrameBridgeListener();
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
        // Only re-seed discovery when the interactive-discovery stack is active
        // (RBush-era; off by default under DOM-hover).
        if (FEATURE_FLAGS.ENABLE_INTERACTIVE_DISCOVERY) {
          try { this.intersectionManager?.resetDiscoveryAndSchedule?.(); } catch { /* ignore */ }
        }
        // Prefer a cached event-derived "under element" hint to avoid a DOM hit-test on scroll-end.
        this.updateElementsUnderCursor(mouseX, mouseY, false, this._pendingMouse?.underHint || null);
      };
    }
    document.addEventListener('keypilot:scroll-end', this._boundScrollEndHandler);

    // Metrics interval only while debugging (no forever timer in production).
    if (window.KEYPILOT_DEBUG && !this._debugMetricsInterval) {
      this._debugMetricsInterval = setInterval(() => {
        if (window.KEYPILOT_DEBUG) this.logPerformanceMetrics();
      }, 10000);
    }
  }

  /**
   * Always hand off from early-inject (stop its MO/mouse/key handlers), even when
   * custom cursors are off and CursorManager.ensure() never runs.
   */
  _signalEarlyInjectHandoff() {
    try {
      if (window.__KP_EARLY_HANDOFF_DONE) return;
      if (!window.KEYPILOT_EARLY) return;
      window.__KP_EARLY_HANDOFF_DONE = true;
      try {
        window.dispatchEvent(new CustomEvent('keypilot-main-loaded'));
      } catch { /* ignore */ }
    } catch { /* ignore */ }
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

  /**
   * @deprecated Perpetual rAF cursor sync removed (perf audit).
   * Cursor position is updated from pointermove in handleMouseMove.
   * Kept as a no-op so any external callers do not throw.
   */
  setupContinuousCursorSync() {
    // no-op
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
      } else if (msg.type === MSG.LAUNCH_WALKTHROUGH) {
        try {
          // Tab-local: close guide/settings popover, reset + open walkthrough.
          if (window !== window.top) return;
          try {
            const th = window.__KeyPilotToggleHandler;
            if (th && typeof th.enabled === 'boolean' && th.enabled === false) return;
          } catch { /* ignore */ }
          try {
            const st = this.state?.getState?.();
            if (st?.mode === MODES.POPOVER) {
              this.handleClosePopover();
            }
          } catch { /* ignore */ }
          const ob = window.__KeyPilotOnboarding;
          if (ob && typeof ob.resetTutorial === 'function') {
            void ob.resetTutorial();
          } else if (ob && typeof ob.setActive === 'function') {
            ob.setActive(true);
          }
        } catch (e) {
          console.warn('[KeyPilot] Failed to launch walkthrough via message:', e);
        }
      }
    });
  }

  handleStateChange(newState, prevState) {
    // If we leave text focus mode, cancel any pending hover-click countdown.
    if (prevState.mode === MODES.TEXT_FOCUS && newState.mode !== MODES.TEXT_FOCUS) {
      this._disarmTextModeClick();
    }

    // Control strip: green ON → orange while a text field has focus.
    // Keyboard reference: only Click Element stays active; other keys gray out.
    if (newState.mode !== prevState.mode) {
      const inText = newState.mode === MODES.TEXT_FOCUS;
      try {
        this.controlStrip?.setTextModeActive?.(inText);
      } catch { /* ignore */ }
      try {
        this.floatingKeyboardHelp?.setTextModeFilter?.(inText);
      } catch { /* ignore */ }
    }

    // Update cursor mode (inspector kinds switch glyph without leaving INSPECTOR mode)
    if (newState.mode !== prevState.mode ||
        newState.inspectorKind !== prevState.inspectorKind ||
        (newState.mode === MODES.TEXT_FOCUS && newState.focusEl !== prevState.focusEl) ||
        (newState.mode === MODES.NONE && newState.focusEl !== prevState.focusEl)) {
      if (this._isCustomCursorModeEnabled()) {
        const options = this._buildCursorOptionsForState(newState);
        this.cursor.setMode(this._cursorModeForState(newState), options);
      }
      this.updatePopupStatus(newState.mode, newState.inspectorKind);
    }

    // Update overlays when focus/inspector targets change, mode changes (e.g. enter
    // highlight → companion "Press H again…" instruction), or an explicit trigger fires.
    if (newState.focusedTextElement !== prevState.focusedTextElement ||
        newState._overlayUpdateTrigger !== prevState._overlayUpdateTrigger ||
        newState.focusEl !== prevState.focusEl ||
        newState.inspectorEl !== prevState.inspectorEl ||
        newState.inspectorKind !== prevState.inspectorKind ||
        newState.mode !== prevState.mode) {
      this.updateOverlays(newState.focusEl, newState.inspectorEl, newState.inspectorKind);
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

      // Settings → Click Mode → "Glow keys when hovering a link" (default off).
      const hintsEnabled =
        this._settings?.clickMode?.keyboardLinkHoverHints === true ||
        (this._settings == null && DEFAULT_SETTINGS.clickMode.keyboardLinkHoverHints === true);

      let isLink = false;
      if (hintsEnabled && this._keyboardHelpVisible && this.enabled && help.isVisible?.()) {
        const st = this._linkHoverHintPendingState || this.state?.getState?.();
        // Don't suggest page link actions while modal modes own the pointer.
        if (!(st?.mode === MODES.POPOVER || st?.mode === MODES.INSPECTOR ||
              st?.mode === MODES.DELETE || st?.mode === MODES.COLS ||
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

  /**
   * @param {string} mode
   * @param {string|null} [inspectorKind]
   */
  updatePopupStatus(mode, inspectorKind = null) {
    try {
      // Only the top frame should push status updates to the extension popup.
      // If we run KeyPilot inside a popover iframe, sending KP_STATUS from that frame
      // would overwrite the popup UI with the iframe's mode.
      if (window !== window.top) return;
      // Map shared inspector mode → kind-specific status labels (DELETE / COLS).
      const statusMode = mode === MODES.INSPECTOR
        ? getInspectorStatusMode(inspectorKind || this.state.getState()?.inspectorKind)
        : mode;
      this._sendRuntimeMessage({ type: MSG.STATUS, mode: statusMode }, { silent: true });
    } catch (error) {
      // Popup might not be open / extension context may be invalidated
    }
  }

  /**
   * Send a message to the service worker, handling "Extension context invalidated"
   * (content script orphaned after extension reload/update).
   * @param {object} message
   * @param {{ silent?: boolean, onResponse?: (response: unknown) => void }} [opts]
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
      },
      onResponse: typeof opts.onResponse === 'function' ? opts.onResponse : undefined
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

    // Alt+J: toggle control strip (works even when closed; persists visibility).
    // Also handled by KeyPilotToggleHandler's always-on listener when disabled.
    if ((e.altKey || e.code === 'AltRight') && (e.key === 'j' || e.key === 'J' || e.code === 'KeyJ')) {
      if (e.__kpControlStripHandled) return;
      try { e.__kpControlStripHandled = true; } catch { /* ignore */ }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      void this.toggleControlStripFromHotkey();
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

    // Alt+/: toggle shadow-root paint debug HUD (leaf / focus / paint + A|B|C).
    if ((e.altKey || e.code === 'AltRight') && (e.key === '/' || e.key === '?' || e.code === 'Slash')) {
      if (window !== window.top) return;
      if (!this.enabled) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      try {
        const on = !!this.overlayManager?.isShadowRootDebugHudEnabled?.();
        this.setShadowRootDebugHud(!on);
      } catch { /* ignore */ }
      return;
    }

    // Alt+[ / Alt+]: cycle through installed keyboard layout families (handedness is a separate setting).
    if ((e.altKey || e.code === 'AltRight') && (e.code === 'BracketLeft' || e.key === '[')) {
      if (window !== window.top) return;
      if (!this.enabled) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this._cycleKeyboardLayoutFamily(-1);
      return;
    }
    if ((e.altKey || e.code === 'AltRight') && (e.code === 'BracketRight' || e.key === ']')) {
      if (window !== window.top) return;
      if (!this.enabled) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this._cycleKeyboardLayoutFamily(1);
      return;
    }

    // Alt+C: keyboard layout configure mode (foundation).
    if ((e.altKey || e.code === 'AltRight') && (e.key === 'c' || e.key === 'C' || e.code === 'KeyC')) {
      if (window !== window.top) return;
      if (!this.enabled) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this._toggleKeyboardLayoutConfigurator();
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

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot] Key pressed:', e.key, 'Code:', e.code);
    }

    // Don't interfere with modifier key combinations (Cmd+C, Ctrl+V, etc.)
    if (this.hasModifierKeys(e)) {
      return;
    }

    // Inside a KeyPilot popover iframe: parent auto-focuses us so F/hover work, but
    // close keys (Esc / E / P) must still request parent close. In-frame KeyPilot can
    // register after the bridge and win capture order, so we own these here too.
    try {
      if (window !== window.top && window.__KP_POPOVER_IFRAME) {
        const closeKeys = Array.isArray(window.__KP_POPOVER_CLOSE_KEYS) && window.__KP_POPOVER_CLOSE_KEYS.length
          ? window.__KP_POPOVER_CLOSE_KEYS
          : ['Escape', 'e', 'E', 'p', 'P'];
        const k = e.key;
        const isEsc = k === 'Escape' || k === 'Esc';
        if (isEsc || closeKeys.includes(k)) {
          // Never trap letter close keys while typing in the iframe page.
          if (!isEsc && this._isUnsafeToRunActionKey?.(e)) {
            /* fall through to normal typing */
          } else {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            try {
              window.parent.postMessage({ type: 'KP_POPOVER_REQUEST_CLOSE', key: k }, '*');
            } catch { /* ignore */ }
            return;
          }
        }
      }
    } catch { /* ignore */ }

    const currentState = this.state.getState();
    const KB = this.keybindings || {};

    // Global default: Escape closes the frontmost "popover-like" UI.
    // Priority: layout place-mode → omnibox → launcher → PopupManager (topmost modal panel).
    // Match both e.key and e.code so Escape is reliable across layouts.
    const isCancelKey = KB.CANCEL?.keys?.includes?.(e.key)
      || e.key === 'Escape'
      || e.code === 'Escape';
    if (isCancelKey) {
      // Click-to-place arrow (layout edit): Escape cancels placement only, not edit mode.
      try {
        const help = this.floatingKeyboardHelp;
        if (help && typeof help.isPlaceTargetingActive === 'function' && help.isPlaceTargetingActive()) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          try { help.cancelPlaceTargeting?.(); } catch { /* ignore */ }
          return;
        }
      } catch { /* ignore */ }

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

    // Special handling for cumulative inspector pick — Enter finalizes.
    if (this.inspector?.isCumulative?.()) {
      if (e.key === 'Enter' || e.key === 'Return' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        void this._finalizeCumulativeSelection().catch((err) => {
          console.error('[KeyPilot] Cumulative finalize failed:', err);
          try { this.inspector.exit(); } catch { /* ignore */ }
          try { this.overlayManager?.clearInspectorPickedOverlays?.(); } catch { /* ignore */ }
        });
        return;
      }
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

    // Current keyboard layout handling:
    // - system layer first (Esc / KB Reference / Settings) — not part of any family
    // - builtin: layout KEYBINDINGS loop
    // - user:<id>: exclusive custom slots only (no other built-in layout keys)
    // Alt+ chrome hotkeys (Alt+K, Alt+C, …) are handled earlier above.
    if (this._maybeHandleSystemLayerBinding(e)) return;

    const currentSel = String(this._currentKeyboardLayoutId || '');
    const isUserCurrent = currentSel.startsWith('user:');
    if (isUserCurrent) {
      if (this._maybeHandleCurrentLayoutBinding(e)) return;
      // Exclusive: do not fall back to built-in layout KEYBINDINGS.
      return;
    }

    // Handle layout family shortcuts (table-driven via KEYBINDINGS.*.handler).
    // Skip system-layer ids — already handled above.
    const layoutKb = this._layoutKeybindings && typeof this._layoutKeybindings === 'object'
      ? this._layoutKeybindings
      : KB;
    for (const keybinding of Object.values(layoutKb)) {
      if (!keybinding?.handler || !Array.isArray(keybinding.keys)) continue;
      if (keybinding.systemLayer) continue;

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
        try {
          const ret = handlerFn.call(this, e);
          if (ret && typeof ret.then === 'function') {
            void ret.catch((err) => {
              console.warn('[KeyPilot] Action handler failed:', keybinding.handler, err);
            });
          }
        } catch (err) {
          console.warn('[KeyPilot] Action handler threw:', keybinding.handler, err);
        }
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

    // Pointer is on the parent document again — reclaim keys from a focused page iframe.
    this._maybeReclaimFocusAfterParentPointerMove();

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

      // Clear inspector hover target when not in inspector mode
      if (currentState.inspectorEl) this.state.setInspectorElement(null);
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

    // Shared inspector pick mode: track any element under cursor (not just clickables).
    this.inspector.updateHover(under);

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
   * Legacy page-step scroll distance (px). Used by popover parent→iframe
   * PAGE_UP / PAGE_DOWN; Z / X are cursor-aware edge jumps instead.
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
    this._scrollHalfPageAtCursor(-1);
    this.emitAction('scrollUp');
  }

  handleInstantPageDown(e) {
    if (!this._allowActionKey('handleInstantPageDown', e)) return;
    this._scrollHalfPageAtCursor(1);
    this.emitAction('scrollDown');
  }

  /**
   * Last known cursor point, or viewport center when unknown.
   * @returns {{ x: number, y: number }}
   */
  _getScrollCursorPoint() {
    const st = this.state.getState();
    let x = Number(st?.lastMouse?.x);
    let y = Number(st?.lastMouse?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) {
      x = Math.floor(window.innerWidth / 2);
      y = Math.floor(window.innerHeight / 2);
    }
    return { x, y };
  }

  /**
   * C / V: scroll the overflow container under the cursor first (vertical, or
   * horizontal when that container only/can scroll on X). Falls back to the
   * page when nothing nested can move. Forwards into iframes via the light
   * frame-click-agent (FRAME_SCROLL).
   *
   * @param {number} sign  -1 = C (up/left), +1 = V (down/right)
   */
  _scrollHalfPageAtCursor(sign) {
    const delta = this._getHalfPageScrollPx();
    const behavior = this._getScrollBehavior();
    const s = sign < 0 ? -1 : 1;
    const { x, y } = this._getScrollCursorPoint();

    // Iframe under cursor: top hit-testing only sees the shell.
    if (this._tryScrollIframeUnderCursor(x, y, s, behavior, { mode: 'delta', deltaPx: delta })) {
      return;
    }

    scrollAtPoint(x, y, s, delta, behavior);
  }

  /**
   * Z / X: same cursor targeting as C / V, but jump to the start/end edge.
   *
   * @param {number} sign  -1 = Z (top/left), +1 = X (bottom/right)
   */
  _scrollToEdgeAtCursor(sign) {
    const behavior = this._getScrollBehavior();
    const s = sign < 0 ? -1 : 1;
    const { x, y } = this._getScrollCursorPoint();

    if (this._tryScrollIframeUnderCursor(x, y, s, behavior, { mode: 'edge' })) {
      return;
    }

    scrollToEdgeAtPoint(x, y, s, behavior);
  }

  /**
   * When the pointer is over an iframe, scroll inside that frame at local
   * coordinates (same-origin directly; cross-origin via FRAME_SCROLL agent).
   *
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} sign
   * @param {ScrollBehavior} behavior
   * @param {{ mode?: 'delta'|'edge', deltaPx?: number }} [opts]
   * @returns {boolean} true if an iframe under the cursor was targeted
   */
  _tryScrollIframeUnderCursor(clientX, clientY, sign, behavior, opts = {}) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;

    let under = null;
    try {
      under = this.detector?.deepElementFromPoint?.(clientX, clientY)
        || elementFromPointDeep(clientX, clientY);
    } catch {
      under = null;
    }
    if (!under || (under.tagName !== 'IFRAME' && under.tagName !== 'FRAME')) {
      return false;
    }

    try {
      if (this._isKeyPilotUiElement?.(under)) return false;
    } catch { /* ignore */ }

    const iframe = /** @type {HTMLIFrameElement} */ (under);
    let rect;
    try {
      rect = iframe.getBoundingClientRect();
    } catch {
      return false;
    }
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) {
      return false;
    }

    const mode = opts.mode === 'edge' ? 'edge' : 'delta';
    const payload = {
      type: MSG.FRAME_SCROLL,
      clientX: localX,
      clientY: localY,
      sign: sign < 0 ? -1 : 1,
      mode,
      deltaPx: mode === 'edge' ? 0 : (Math.abs(Number(opts.deltaPx)) || 0),
      behavior: behavior === 'auto' || behavior === 'instant' ? 'auto' : 'smooth',
      frameName: typeof iframe.name === 'string' ? iframe.name : ''
    };

    // Same-origin: scroll nested overflow inside the child document directly.
    try {
      const doc = iframe.contentDocument;
      const view = iframe.contentWindow;
      if (doc && view) {
        // Nested iframe: re-forward with coordinates local to the nested frame.
        let el = null;
        try {
          el = elementFromPointDeep(localX, localY, doc);
        } catch { el = null; }
        if (el && (el.tagName === 'IFRAME' || el.tagName === 'FRAME')) {
          try {
            const nested = /** @type {HTMLIFrameElement} */ (el);
            const nr = nested.getBoundingClientRect();
            nested.contentWindow?.postMessage({
              ...payload,
              clientX: localX - nr.left,
              clientY: localY - nr.top,
              frameName: typeof nested.name === 'string' ? nested.name : ''
            }, '*');
            return true;
          } catch { /* fall through to scroll this frame */ }
        }
        if (mode === 'edge') {
          scrollToEdgeAtPoint(localX, localY, payload.sign, payload.behavior, {
            doc,
            win: view
          });
        } else {
          scrollAtPoint(localX, localY, payload.sign, payload.deltaPx, payload.behavior, {
            doc,
            win: view
          });
        }
        return true;
      }
    } catch {
      // Cross-origin — postMessage / runtime relay.
    }

    let posted = false;
    try {
      const win = iframe.contentWindow;
      if (win) {
        win.postMessage(payload, '*');
        posted = true;
      }
    } catch { /* ignore */ }

    try {
      this._sendRuntimeMessage(payload, { silent: true });
      posted = true;
    } catch { /* ignore */ }

    return posted;
  }

  handlePageTop(e) {
    if (!this._allowActionKey('handlePageTop', e)) return;
    this._scrollToEdgeAtCursor(-1);
    this.emitAction('scrollTop');
  }

  handlePageBottom(e) {
    if (!this._allowActionKey('handlePageBottom', e)) return;
    this._scrollToEdgeAtCursor(1);
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
   * - Only the query string changed on the same path (e.g. openrouter.ai/activity
   *   pushes `?from=&to=&date_preset=` after load — first back only strips filters)
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
    const beforeOrigin = location.origin;
    const beforePathname = location.pathname;
    const beforeSearch = location.search || '';
    const beforePath = `${beforePathname}${beforeSearch}`;
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
        const search = location.search || '';

        // Invisible hop patterns:
        // 1) Full URL unchanged after back (same-document pushState with no URL change)
        // 2) Only a hash fragment was cleared (page#section → page)
        // 3) Same origin+pathname, only query string changed (SPA filters / date presets)
        const urlUnchanged = href === beforeHref;
        const onlyClearedHash = !!beforeHash && !hash && path === beforePath;
        const samePath =
          location.origin === beforeOrigin &&
          location.pathname === beforePathname;
        const onlyQueryChanged = samePath && search !== beforeSearch;

        if (urlUnchanged || onlyClearedHash || onlyQueryChanged) {
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
      // SPA query-param hops can settle a bit after popstate; keep watcher briefly.
      timer = window.setTimeout(cleanup, 700);
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
    if (!this._sendRuntimeMessage({ type: MSG.TAB_LEFT }, {
      onResponse: (response) => this._notifyTabSwitchFailure(response)
    })) {
      // Context invalidated — user already notified once via _handleExtensionContextInvalidated
    }
  }

  handleTabRightKey(e) {
    if (!this._allowActionKey('handleTabRightKey', e)) return;
    // Switch to the tab to the right
    // Emit + record transient action BEFORE switching tabs so onboarding can persist/recover reliably.
    this.emitAction('tabRight');
    this._sendRuntimeMessage({ type: MSG.TRANSIENT_ACTION, action: 'tabRight', timestamp: Date.now() }, { silent: true });
    if (!this._sendRuntimeMessage({ type: MSG.TAB_RIGHT }, {
      onResponse: (response) => this._notifyTabSwitchFailure(response)
    })) {
      // Context invalidated — user already notified once via _handleExtensionContextInvalidated
    }
  }

  /**
   * Show the top-center flash alert when left/right tab switch has nowhere to go
   * (or otherwise fails in the background).
   * @param {unknown} response
   */
  _notifyTabSwitchFailure(response) {
    if (!response || typeof response !== 'object') return;
    if (/** @type {{ type?: string }} */ (response).type !== 'KP_ERROR') return;

    const error = String(/** @type {{ error?: unknown }} */ (response).error || '');
    const message = /no valid tabs to switch to/i.test(error)
      ? 'No other tabs to switch to'
      : (error ? error.replace(/^Failed to switch tab:\s*/i, '') : 'Failed to switch tab');

    this.showFlashNotification(message, COLORS.NOTIFICATION_INFO);
  }

  /**
   * Shared path: enter inspector kind, or confirm if already that kind.
   * @param {string} kind INSPECTOR_KIND
   * @param {(el: Element|null) => void} onConfirm
   * @param {{ ignoreTextFocus?: boolean, ignoreModal?: boolean }} [opts]
   * @returns {boolean} true if enter/confirm was handled (false if blocked)
   */
  _toggleInspectorKind(kind, onConfirm, opts = {}) {
    const currentState = this.state.getState();

    if (!opts.ignoreTextFocus && currentState.mode === MODES.TEXT_FOCUS) {
      return false;
    }
    if (!opts.ignoreModal &&
        (currentState.mode === MODES.POPOVER || currentState.mode === MODES.OMNIBOX)) {
      return false;
    }

    if (this.inspector.isKind(kind)) {
      const target = this.inspector.confirmAndExit();
      try {
        onConfirm(target);
      } catch (err) {
        console.warn('[KeyPilot] Inspector confirm failed:', kind, err);
      }
      return true;
    }

    console.log('[KeyPilot] Entering inspector mode:', kind);
    this._prepareInspectorModeIndicator(kind);
    this.inspector.enter(kind);
    return true;
  }

  /**
   * Layout-aware confirm key label for inspector instruction chip.
   * @param {string} kind
   * @returns {string}
   */
  _confirmKeyLabelForInspectorKind(kind) {
    const def = getInspectorDef(kind);
    const actionId = def?.actionId;
    const binding = actionId ? this.keybindings?.[actionId] : null;
    if (binding?.displayKey) return String(binding.displayKey);
    if (Array.isArray(binding?.keys) && binding.keys.length) {
      // Prefer a single printable character over code names when possible.
      const ch = binding.keys.find((k) => typeof k === 'string' && k.length === 1);
      if (ch) return ch === ' ' ? 'Space' : ch;
      const first = String(binding.keys[0] || '');
      if (first === 'Backspace') return 'Backspace';
      if (first === 'Escape') return 'Esc';
      return first || '?';
    }
    if (kind === INSPECTOR_KIND.COLS) return '.';
    if (kind === INSPECTOR_KIND.DELETE) return 'Backspace';
    return '?';
  }

  /**
   * Seed top-right instruction chip (Text Select style) before/while pick is active.
   * @param {string} kind
   */
  _prepareInspectorModeIndicator(kind) {
    try {
      const confirmKey = this._confirmKeyLabelForInspectorKind(kind);
      this.overlayManager?.setInspectorModeIndicatorOpts?.({ kind, confirmKey });
      this.overlayManager?.showInspectorModeIndicator?.({ kind, confirmKey });
    } catch { /* ignore */ }
  }

  handleDeleteKey(e) {
    if (!this._allowActionKey('handleDeleteKey', e)) return;

    this._toggleInspectorKind(INSPECTOR_KIND.DELETE, (victim) => {
      console.log('[KeyPilot] Deleting element:', victim);
      this.deleteElement(victim);
    }, { ignoreTextFocus: true, ignoreModal: true });
  }

  /**
   * Cols Toggle (period): shared inspector pick → apply multicol,
   * or clear sticky columns if already applied. Esc exits pick only.
   */
  handleColsToggleKey(e) {
    if (!this._allowActionKey('handleColsToggleKey', e)) return;
    const currentState = this.state.getState();

    if (currentState.mode === MODES.TEXT_FOCUS) {
      console.log('[KeyPilot] Cols toggle ignored — text focus mode');
      return;
    }
    if (currentState.mode === MODES.POPOVER || currentState.mode === MODES.OMNIBOX) {
      console.log('[KeyPilot] Cols toggle ignored — modal mode');
      return;
    }

    // Sticky columns already on → period toggles them off (any target / any mode).
    if (this.columnLayoutManager?.isActive?.()) {
      console.log('[KeyPilot] Clearing column layout');
      try { this.columnLayoutManager.clear(); } catch (err) {
        console.warn('[KeyPilot] Failed to clear columns:', err);
      }
      if (this.inspector.isKind(INSPECTOR_KIND.COLS)) {
        this.inspector.exit();
      }
      try {
        this.showFlashNotification('Columns off', COLORS.NOTIFICATION_INFO);
      } catch { /* ignore */ }
      return;
    }

    this._toggleInspectorKind(INSPECTOR_KIND.COLS, (target) => {
      if (!target) {
        try {
          this.showFlashNotification('Nothing to columnize', COLORS.NOTIFICATION_INFO);
        } catch { /* ignore */ }
        return;
      }
      console.log('[KeyPilot] Applying columns to:', target?.tagName, target?.id || target?.className);
      const ok = this.columnLayoutManager.apply(target);
      if (ok) {
        try {
          this.showFlashNotification(
            this.columnLayoutManager.isPageMode?.() ? 'Page columns on' : 'Columns on',
            COLORS.NOTIFICATION_SUCCESS
          );
        } catch { /* ignore */ }
      } else {
        try {
          this.showFlashNotification('Could not columnize element', COLORS.NOTIFICATION_ERROR);
        } catch { /* ignore */ }
      }
    });
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
      
      // Cancel shared inspector pick if active
      if (this.state.isInspectorMode()) {
        console.log('[KeyPilot] Canceling inspector mode to enter highlight mode');
        this.inspector.exit();
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

    const yMode = getActionMode(this._settings?.actionSettings, 'RECTANGLE_HIGHLIGHT');

    // Alternate mode: cumulative inspector pick (Y adds, Enter finishes).
    if (yMode === 'cumulative') {
      if (this.inspector.isKind(INSPECTOR_KIND.RECTANGLE_PICK) && this.inspector.isCumulative()) {
        const added = this.inspector.confirmAdd();
        if (!added) {
          try {
            this.showFlashNotification('Hover an element to add', COLORS.NOTIFICATION_INFO);
          } catch { /* ignore */ }
        }
        return;
      }

      if (this.state.isHighlightMode()) {
        this.cancelHighlightMode();
      }
      // Replace any other inspector kind
      if (this.state.isInspectorMode() && !this.inspector.isKind(INSPECTOR_KIND.RECTANGLE_PICK)) {
        this.inspector.exit();
        try { this.overlayManager?.clearInspectorPickedOverlays?.(); } catch { /* ignore */ }
      }

      console.log('[KeyPilot] Entering cumulative element pick mode');
      this._prepareInspectorModeIndicator(INSPECTOR_KIND.RECTANGLE_PICK);
      this.inspector.enter(INSPECTOR_KIND.RECTANGLE_PICK, { selectionMode: 'cumulative' });
      return;
    }

    // Default: element-granularity rectangle highlight
    if (!this.state.isHighlightMode()) {
      console.log('[KeyPilot] Entering element rectangle highlight mode');

      if (this.state.isInspectorMode()) {
        console.log('[KeyPilot] Canceling inspector mode to enter rectangle highlight mode');
        this.inspector.exit();
        try { this.overlayManager?.clearInspectorPickedOverlays?.(); } catch { /* ignore */ }
      }

      if (FEATURE_FLAGS.USE_EDGE_ONLY_SELECTION && FEATURE_FLAGS.ENABLE_EDGE_ONLY_PROCESSING) {
        try { this.ensureEdgeOnlyProcessingForRectangle(); } catch { /* ignore */ }
      }

      this.state.setMode(MODES.HIGHLIGHT);
      this._lastHighlightUpdatePos = { x: -1, y: -1 };
      this.overlayManager.setSelectionMode('element');
      this.startHighlighting();
    } else {
      console.log('[KeyPilot] Completing element rectangle highlight selection');
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
      const binding = (selectionMode === 'rectangle' || selectionMode === 'element')
        ? KB.RECTANGLE_HIGHLIGHT
        : KB.HIGHLIGHT;
      const finishKey = Array.isArray(binding?.keys) && binding.keys.length
        ? binding.keys.find((k) => k && k.length === 1) || binding.keys[0]
        : ((selectionMode === 'rectangle' || selectionMode === 'element') ? 'Y' : 'H');
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

    if (selectionMode === 'element') {
      try {
        const viewportStart = {
          x: currentState.lastMouse.x,
          y: currentState.lastMouse.y
        };
        const matched = this.overlayManager.updateElementRectangleSelection(
          viewportStart,
          viewportStart
        );
        console.log('[KeyPilot] Element rectangle selection seeded;', Array.isArray(matched) ? matched.length : 0, 'hits');
      } catch (error) {
        console.warn('[KeyPilot] Error seeding element rectangle selection:', error);
      }
      return;
    }

    // Legacy caret rectangle selection mode — seed caret at origin if possible.
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

    if (selectionMode === 'element') {
      try {
        this.overlayManager.updateElementRectangleSelection(originVp, currentPos);
      } catch (error) {
        console.warn('[KeyPilot] Error updating element rectangle selection:', error);
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

  /**
   * Build clipboard payload from a list of DOM elements (plain + rich HTML).
   * Used by element-rectangle complete and cumulative pick finalize.
   * @param {Element[]} elements
   * @returns {{ plainText: string, htmlContent: string, hasRichContent: boolean }}
   */
  buildElementsClipboardContent(elements) {
    const list = Array.isArray(elements) ? elements : [];
    const plainParts = [];
    const htmlParts = [];

    for (const el of list) {
      if (!el || el.nodeType !== 1 || !el.isConnected) continue;
      const tag = String(el.tagName || '').toUpperCase();
      try {
        if (tag === 'IMG') {
          const alt = (el.getAttribute?.('alt') || '').trim();
          const src = el.currentSrc || el.src || el.getAttribute?.('src') || '';
          plainParts.push(alt || src || '');
          htmlParts.push(el.outerHTML || '');
        } else if (tag === 'VIDEO' || tag === 'AUDIO' || tag === 'PICTURE' || tag === 'SVG') {
          plainParts.push((el.getAttribute?.('aria-label') || el.getAttribute?.('title') || tag).trim());
          htmlParts.push(el.outerHTML || '');
        } else {
          const text = (el.innerText || el.textContent || '').replace(/\s+\n/g, '\n').trim();
          if (text) plainParts.push(text);
          htmlParts.push(el.outerHTML || '');
        }
      } catch { /* ignore one element */ }
    }

    let htmlContent = htmlParts.filter(Boolean).join('');
    try {
      if (htmlContent) htmlContent = this.sanitizeHtmlContent(htmlContent);
    } catch { /* keep raw */ }

    const plainText = plainParts.filter(Boolean).join('\n\n');
    return {
      plainText,
      htmlContent,
      hasRichContent: !!(FEATURE_FLAGS.ENABLE_RICH_TEXT_CLIPBOARD && htmlContent && htmlContent !== plainText)
    };
  }

  /**
   * Finalize cumulative inspector pick: copy picked elements and exit.
   */
  async _finalizeCumulativeSelection() {
    if (!this.inspector?.isCumulative?.()) return;
    const { elements } = this.inspector.finalizeAndExit();
    try { this.overlayManager?.hideInspectorModeIndicator?.(); } catch { /* ignore */ }
    try { this.overlayManager?.clearInspectorPickedOverlays?.(); } catch { /* ignore */ }

    const content = this.buildElementsClipboardContent(elements);
    if (!content.plainText || !String(content.plainText).trim()) {
      // Allow image-only selections with empty plain text but HTML
      if (!(content.htmlContent && content.hasRichContent)) {
        this.showFlashNotification('No elements selected', COLORS.NOTIFICATION_INFO);
        return;
      }
    }

    const payload = content.plainText?.trim()
      ? content
      : { ...content, plainText: content.plainText || ' ' };

    let copySuccess = false;
    try {
      copySuccess = await this.copyToClipboard(payload);
    } catch (error) {
      console.error('[KeyPilot] Cumulative clipboard failed:', error);
      copySuccess = false;
    }

    if (copySuccess) {
      const notificationCopyType = content.hasRichContent ? 'Rich text' : 'Text';
      this.showFlashNotification(`${notificationCopyType} copied to clipboard`, COLORS.NOTIFICATION_SUCCESS);
      try { this.overlayManager.flashFocusOverlay(); } catch { /* ignore */ }
    } else {
      this.showFlashNotification('Failed to copy selection', COLORS.NOTIFICATION_ERROR);
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
      } else if (selectionMode === 'element') {
        try {
          const matched = this.overlayManager.getMatchedElements?.() || [];
          contentToClipboard = this.buildElementsClipboardContent(matched);
          selectedText = contentToClipboard.plainText || '';
        } catch (extractError) {
          console.warn('[KeyPilot] Error extracting element selection content:', extractError);
          selectedText = '';
        }
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
              : result.kind === 'video' ? 'Video thumbnail'
                : 'Image';
        this.showFlashNotification(
          `${label} copied to clipboard`,
          COLORS.NOTIFICATION_SUCCESS,
          result.blob
        );
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
   * Best-effort plain text from KeyPilot highlight selection or native selection.
   * @returns {string}
   */
  getSelectedPlainText() {
    try {
      const peeked = this.overlayManager?.peekCharacterSelectedText?.();
      if (peeked && String(peeked).trim()) return String(peeked);
    } catch { /* ignore */ }

    try {
      const sel = typeof window.getSelection === 'function' ? window.getSelection() : null;
      const t = sel ? String(sel.toString() || '') : '';
      if (t.trim()) return t;
    } catch { /* ignore */ }

    try {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && typeof el.selectionStart === 'number') {
        const v = String(el.value || '');
        const start = el.selectionStart;
        const end = el.selectionEnd;
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
          return v.slice(start, end);
        }
      }
      if (el && el.isContentEditable) {
        const sel = window.getSelection?.();
        const t = sel ? String(sel.toString() || '') : '';
        if (t.trim()) return t;
      }
    } catch { /* ignore */ }

    try {
      const shadowSel = this.findSelectionInShadowDOM?.();
      const t = shadowSel && typeof shadowSel.toString === 'function' ? String(shadowSel.toString() || '') : '';
      if (t.trim()) return t;
    } catch { /* ignore */ }

    return '';
  }

  /** @returns {boolean} */
  _execDocumentCommand(command) {
    try {
      if (typeof document.execCommand !== 'function') return false;
      return !!document.execCommand(command);
    } catch {
      return false;
    }
  }

  /**
   * Insert plain text into the focused editable (paste helper when execCommand fails).
   * @param {string} text
   * @returns {boolean}
   */
  _insertTextAtFocus(text) {
    const value = String(text ?? '');
    const el = document.activeElement;
    if (!el) return false;

    try {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (el.disabled || el.readOnly) return false;
        const start = Number.isFinite(el.selectionStart) ? el.selectionStart : String(el.value || '').length;
        const end = Number.isFinite(el.selectionEnd) ? el.selectionEnd : start;
        const before = String(el.value || '').slice(0, start);
        const after = String(el.value || '').slice(end);
        el.value = before + value + after;
        const caret = start + value.length;
        try { el.setSelectionRange(caret, caret); } catch { /* ignore */ }
        try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch { /* ignore */ }
        return true;
      }
    } catch { /* ignore */ }

    try {
      if (el.isContentEditable) {
        if (typeof document.execCommand === 'function') {
          const ok = document.execCommand('insertText', false, value);
          if (ok) return true;
        }
      }
    } catch { /* ignore */ }

    return false;
  }

  async handleClipboardCopyKey() {
    // Prefer native cut/copy when a real selection exists (preserves rich content).
    if (this._execDocumentCommand('copy')) {
      this.showFlashNotification('Copied', COLORS.NOTIFICATION_SUCCESS);
      this.emitAction('clipboard_copy', { via: 'execCommand' });
      return;
    }
    const text = this.getSelectedPlainText();
    if (!text.trim()) {
      this.showFlashNotification('Nothing selected to copy', COLORS.NOTIFICATION_INFO);
      return;
    }
    const ok = await this.copyToClipboard(text);
    this.showFlashNotification(
      ok ? 'Copied' : 'Could not copy',
      ok ? COLORS.NOTIFICATION_SUCCESS : COLORS.NOTIFICATION_ERROR
    );
    if (ok) this.emitAction('clipboard_copy', { via: 'clipboardApi', length: text.length });
  }

  async handleClipboardCutKey() {
    if (this._execDocumentCommand('cut')) {
      this.showFlashNotification('Cut', COLORS.NOTIFICATION_SUCCESS);
      this.emitAction('clipboard_cut', { via: 'execCommand' });
      return;
    }
    const text = this.getSelectedPlainText();
    if (!text.trim()) {
      this.showFlashNotification('Nothing selected to cut', COLORS.NOTIFICATION_INFO);
      return;
    }
    const ok = await this.copyToClipboard(text);
    if (ok) {
      // Best-effort delete selection after copy.
      try { this._execDocumentCommand('delete'); } catch { /* ignore */ }
      this.showFlashNotification('Cut', COLORS.NOTIFICATION_SUCCESS);
      this.emitAction('clipboard_cut', { via: 'clipboardApi', length: text.length });
    } else {
      this.showFlashNotification('Could not cut', COLORS.NOTIFICATION_ERROR);
    }
  }

  async handleClipboardPasteKey() {
    if (this._execDocumentCommand('paste')) {
      this.showFlashNotification('Pasted', COLORS.NOTIFICATION_SUCCESS);
      this.emitAction('clipboard_paste', { via: 'execCommand' });
      return;
    }
    let text = '';
    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        text = await navigator.clipboard.readText();
      }
    } catch (e) {
      console.warn('[KeyPilot] clipboard.readText failed:', e);
    }
    if (!String(text || '').length) {
      this.showFlashNotification('Clipboard is empty or paste blocked', COLORS.NOTIFICATION_INFO);
      return;
    }
    const ok = this._insertTextAtFocus(text);
    this.showFlashNotification(
      ok ? 'Pasted' : 'Focus an editable field to paste',
      ok ? COLORS.NOTIFICATION_SUCCESS : COLORS.NOTIFICATION_INFO
    );
    if (ok) this.emitAction('clipboard_paste', { via: 'clipboardApi', length: text.length });
  }

  handleClipboardSelectAllKey() {
    if (this._execDocumentCommand('selectAll')) {
      this.emitAction('clipboard_select_all', { via: 'execCommand' });
      return;
    }
    try {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && typeof el.select === 'function') {
        el.select();
        this.emitAction('clipboard_select_all', { via: 'input.select' });
        return;
      }
    } catch { /* ignore */ }
    this.showFlashNotification('Could not select all', COLORS.NOTIFICATION_INFO);
  }

  /**
   * TYPE_CHARACTERS Function handler — types the Action Instance's configured `text` into
   * the focused editable each time the key is pressed. Multiple keys can each hold their own
   * Action Instance of this same Function with different `text`, since the value lives on the
   * instance (see keyboard-layout-store.js `UserAction`), not on the Function definition.
   * @param {KeyboardEvent} _e
   * @param {{ text?: string }} [parameters]
   */
  handleTypeCharactersKey(_e, parameters) {
    const text = String(parameters?.text ?? '');
    if (!text) {
      this.showFlashNotification('No text configured for this key', COLORS.NOTIFICATION_INFO);
      return;
    }
    const ok = this._insertTextAtFocus(text);
    this.showFlashNotification(
      ok ? 'Typed' : 'Focus an editable field first',
      ok ? COLORS.NOTIFICATION_SUCCESS : COLORS.NOTIFICATION_INFO
    );
    if (ok) this.emitAction('type_characters', { length: text.length });
  }

  /**
   * Dispatch bridge for the keystroke-primitive Functions generalized from the legacy
   * `MacroKeyKind` catalog (SEND_HOTKEY, SEND_BURST, CYCLE_ROUND_ROBIN, HOLD_CONTINUOUS,
   * CLICK_MOUSE_BUTTON, REMAP_KEY — see function-library.js). Delegates to the shared
   * execution switch in macro-key-runtime.js.
   * @param {KeyboardEvent} _e
   * @param {{ config?: any }} [parameters]
   * @param {{ functionId?: string, instanceId?: string }} [meta]
   */
  async handleLegacyMacroKeyFunction(_e, parameters, meta) {
    const functionId = meta?.functionId;
    if (!functionId) return;
    await runLegacyMacroKeyFunction(meta?.instanceId || functionId, functionId, parameters, {
      notify: (msg, type) => {
        try { this.overlayManager?.showNotification?.(msg, type || 'info'); } catch { /* ignore */ }
      }
    });
  }

  /**
   * Send selected text to AI with a configurable instruction (prompt), then route
   * the response through the shared destination helper (clipboard / popover / both).
   */
  async handleSendTextToAiKey() {
    const text = this.getSelectedPlainText();
    if (!String(text || '').trim()) {
      this.showFlashNotification('Select text first', COLORS.NOTIFICATION_INFO);
      return;
    }

    const actionSettings = this._settings?.actionSettings;
    const prompt = String(getActionParameter(actionSettings, 'SEND_TEXT_TO_AI', 'prompt') ?? '').trim();
    const destination = normalizeActionResultDestination(
      getActionParameter(actionSettings, 'SEND_TEXT_TO_AI', 'destination')
    );

    this.showFlashNotification('Sending to AI…', COLORS.NOTIFICATION_INFO);

    let result;
    try {
      result = await sendTextToAi({ prompt, text });
    } catch (e) {
      console.warn('[KeyPilot] sendTextToAi failed:', e);
      this.showFlashNotification('AI request failed', COLORS.NOTIFICATION_ERROR);
      return;
    }

    if (!result?.ok) {
      this.showFlashNotification(result?.error || 'AI request failed', COLORS.NOTIFICATION_ERROR);
      // If the provider is missing, still offer the composed request via destination
      // so the user can paste it into an external AI chat.
      if (result?.request && /No AI provider/i.test(String(result.error || ''))) {
        await deliverActionResult(this, {
          text: result.request,
          title: 'AI request (no provider)',
          destination,
          successMessage: 'AI request copied — paste into your AI chat'
        });
      }
      return;
    }

    await deliverActionResult(this, {
      text: result.text,
      title: prompt ? `AI — ${prompt}` : 'AI result',
      destination,
      successMessage: 'AI result copied'
    });
    this.emitAction('send_text_to_ai', {
      prompt: prompt.slice(0, 80),
      destination,
      provider: result.provider || '',
      length: String(result.text || '').length
    });
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
      this.overlayManager.clearElementSelection?.();
    } catch (error) {
      console.warn('[KeyPilot] Error clearing element selection:', error);
    }

    try {
      this.overlayManager.removeHighlightRectangleOverlay();
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
        '.kpv2-highlight-selection-overlay, .kpv2-highlight-selection, .kpv2-highlight-mode-indicator'
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

  /**
   * Listen for KP_FRAME_POINTER / KP_FRAME_FOCUS_RECLAIM from child frame agents.
   * Top frame only — keeps lastMouse fresh over embeds and reclaims keyboard focus.
   */
  _installFrameBridgeListener() {
    try {
      if (window !== window.top) return;
    } catch {
      return;
    }
    if (this._boundFrameBridgeMessage) return;
    this._boundFrameBridgeMessage = (event) => {
      try {
        this._onFrameBridgeMessage(event);
      } catch { /* ignore */ }
    };
    try {
      window.addEventListener('message', this._boundFrameBridgeMessage, true);
    } catch { /* ignore */ }
  }

  _uninstallFrameBridgeListener() {
    if (!this._boundFrameBridgeMessage) return;
    try {
      window.removeEventListener('message', this._boundFrameBridgeMessage, true);
    } catch { /* ignore */ }
    this._boundFrameBridgeMessage = null;
    this._framePointerInside = false;
    this._framePointerIframe = null;
  }

  /**
   * @param {Window|null|undefined} win
   * @returns {HTMLIFrameElement|HTMLFrameElement|null}
   */
  _findIframeByContentWindow(win) {
    if (!win) return null;
    try {
      const nodes = document.querySelectorAll('iframe, frame');
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        try {
          if (el && el.contentWindow === win) {
            return /** @type {HTMLIFrameElement|HTMLFrameElement} */ (el);
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    return null;
  }

  /**
   * True when this iframe is KeyPilot UI (popover) — hybrid focus owns it.
   * @param {Element|null|undefined} iframe
   * @returns {boolean}
   */
  _isKeyPilotManagedIframe(iframe) {
    if (!iframe || !(iframe instanceof Element)) return false;
    try {
      if (iframe.classList?.contains?.('modal-iframe')) return true;
    } catch { /* ignore */ }
    try {
      if (this._isElementInPopover(iframe)) return true;
    } catch { /* ignore */ }
    try {
      if (this.overlayManager?.popoverIframeElement === iframe) return true;
    } catch { /* ignore */ }
    return false;
  }

  /**
   * True when this iframe is Google's account / profile switcher (or similar).
   * Those menus focus the iframe on open and dismiss on blur — never steal focus
   * from them except via explicit Esc handling inside the frame.
   * @param {Element|null|undefined} iframe
   * @returns {boolean}
   */
  _isGoogleAccountIframe(iframe) {
    if (!iframe || !(iframe instanceof Element)) return false;
    try {
      const name = typeof /** @type {any} */ (iframe).name === 'string'
        ? /** @type {any} */ (iframe).name
        : '';
      if (name === 'account' || name === 'oauth2' || /account/i.test(name)) return true;
    } catch { /* ignore */ }
    try {
      const src = String(/** @type {any} */ (iframe).src || '');
      if (/accounts\.google\.com|ogs\.google\.com|myaccount\.google\.com/i.test(src)) {
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  /**
   * Blur a focused page <iframe> so top-frame KeyPilot receives keydown again.
   * Skips KeyPilot popover iframes. Google account menus are skipped unless
   * `allowGoogleAccount` (explicit Esc) — blur on mouse leave dismisses them.
   * @param {{ allowGoogleAccount?: boolean }} [opts]
   */
  _reclaimKeyboardFocusFromPageIframes(opts = {}) {
    const allowGoogleAccount = opts.allowGoogleAccount === true;
    try {
      if (window !== window.top) return;
    } catch {
      return;
    }
    try {
      const active = document.activeElement;
      if (!active || (active.tagName !== 'IFRAME' && active.tagName !== 'FRAME')) {
        return;
      }
      if (this._isKeyPilotManagedIframe(active)) return;
      if (!allowGoogleAccount && this._isGoogleAccountIframe(active)) return;
      try { active.blur(); } catch { /* ignore */ }
      try { window.focus(); } catch { /* ignore */ }
    } catch { /* ignore */ }
  }

  /**
   * Parent document received a pointer move after we were tracking inside an
   * embed. Clear tracking only — do NOT blur the iframe (Google account menus
   * dismiss on blur; gaps between avatar and menu fire parent mousemove).
   */
  _maybeReclaimFocusAfterParentPointerMove() {
    try {
      if (window !== window.top) return;
      if (!this._framePointerInside) return;
      this._framePointerInside = false;
      this._framePointerIframe = null;
      // Intentionally no _reclaimKeyboardFocusFromPageIframes() here.
    } catch { /* ignore */ }
  }

  /**
   * @param {MessageEvent} event
   */
  _onFrameBridgeMessage(event) {
    if (!this.enabled) return;
    const data = event?.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === MSG.FRAME_FOCUS_RECLAIM) {
      // Explicit Esc / stuck-focus recovery from the frame agent.
      this._framePointerInside = false;
      this._framePointerIframe = null;
      this._reclaimKeyboardFocusFromPageIframes({ allowGoogleAccount: true });
      return;
    }

    if (data.type !== MSG.FRAME_POINTER) return;

    try {
      if (event.source === window) return;
    } catch { /* ignore */ }

    const iframe = this._findIframeByContentWindow(/** @type {Window} */ (event.source));
    if (!iframe) return;

    // Popover hybrid focus owns KP popover iframes.
    if (this._isKeyPilotManagedIframe(iframe)) return;

    // Ignore pointer traffic from Google account iframes for reclaim tracking.
    // Entering them briefly then crossing parent chrome must not arm a blur.
    if (this._isGoogleAccountIframe(iframe)) {
      // Still update lastMouse so F/B/G work inside the menu.
      if (data.inside !== false) {
        let rect;
        try { rect = iframe.getBoundingClientRect(); } catch { return; }
        const x = rect.left + Number(data.clientX);
        const y = rect.top + Number(data.clientY);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        try { this.state.setMousePosition(x, y); } catch { /* ignore */ }
        try { this.cursor.updatePosition(x, y); } catch { /* ignore */ }
        try { this.mouseCoordinateManager.updateCurrentMousePosition(x, y); } catch { /* ignore */ }
      }
      return;
    }

    if (data.inside === false) {
      this._framePointerInside = false;
      this._framePointerIframe = null;
      // Clear tracking only — do not blur (see _maybeReclaimFocusAfterParentPointerMove).
      return;
    }

    let rect;
    try {
      rect = iframe.getBoundingClientRect();
    } catch {
      return;
    }
    const x = rect.left + Number(data.clientX);
    const y = rect.top + Number(data.clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    this._framePointerInside = true;
    this._framePointerIframe = iframe;

    // Keep lastMouse + cursor aligned while parent mousemove is silent over the iframe.
    try { this.state.setMousePosition(x, y); } catch { /* ignore */ }
    try { this.cursor.updatePosition(x, y); } catch { /* ignore */ }
    try { this.mouseCoordinateManager.updateCurrentMousePosition(x, y); } catch { /* ignore */ }
  }

  /**
   * When the pointer is over a cross-origin (or any) iframe, top-frame hit-testing
   * only sees the <iframe> shell. Forward activate to the child frame-click-agent
   * with coordinates local to the iframe viewport.
   *
   * @param {number} clientX
   * @param {number} clientY
   * @param {{ openInNewTab?: boolean, background?: boolean }} [opts]
   * @returns {boolean} true if a message was posted to an iframe under the cursor
   */
  _tryActivateIframeUnderCursor(clientX, clientY, opts = {}) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;

    let under = null;
    try {
      under = this.detector.deepElementFromPoint(clientX, clientY);
    } catch {
      under = null;
    }
    if (!under || under.tagName !== 'IFRAME') return false;

    // Popover mode is modal: only interact with iframes inside the popover UI.
    try {
      const mode = this.state.getState()?.mode;
      if (mode === MODES.POPOVER && !this._isElementInPopover(under)) {
        return false;
      }
    } catch { /* ignore */ }

    // Ignore KeyPilot UI chrome (not page iframes).
    try {
      if (this._isKeyPilotUiElement?.(under)) return false;
    } catch { /* ignore */ }

    const iframe = /** @type {HTMLIFrameElement} */ (under);
    let rect;
    try {
      rect = iframe.getBoundingClientRect();
    } catch {
      return false;
    }
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) {
      return false;
    }

    const payload = {
      type: MSG.FRAME_ACTIVATE,
      clientX: localX,
      clientY: localY,
      openInNewTab: !!opts.openInNewTab,
      background: !!opts.background,
      // Child agent filters on window.name when set (e.g. Google name="account").
      frameName: typeof iframe.name === 'string' ? iframe.name : '',
      // Parent origin for frame-agent link routing (no domain hardcoding in the child).
      topOrigin: (() => { try { return String(location.origin || ''); } catch { return ''; } })()
    };

    // Same-origin fast path: click directly inside the child document (no agent needed).
    try {
      const doc = iframe.contentDocument;
      const view = iframe.contentWindow;
      if (doc && view) {
        let el = doc.elementFromPoint(localX, localY);
        let guard = 0;
        while (el && el.shadowRoot && guard++ < 10) {
          const nested = el.shadowRoot.elementFromPoint(localX, localY);
          if (!nested || nested === el) break;
          el = nested;
        }
        if (el) {
          // Nested iframe inside a same-origin frame: recurse via postMessage to that child.
          if (el.tagName === 'IFRAME') {
            try {
              const nested = /** @type {HTMLIFrameElement} */ (el);
              const nr = nested.getBoundingClientRect();
              nested.contentWindow?.postMessage({
                ...payload,
                clientX: localX - nr.left,
                clientY: localY - nr.top,
                frameName: typeof nested.name === 'string' ? nested.name : ''
              }, '*');
            } catch { /* ignore */ }
          } else {
            // Single activation only. Previously we dispatched a click sequence AND
            // called HTMLElement.click(), which double-fired Issuu toggles (Search /
            // Share open+close) and page-turn controls.
            const clickable = typeof el.closest === 'function'
              ? el.closest(
                'a[href], button, [role="button"], [role="link"], [role="menuitem"], summary, input, select, textarea, label'
              )
              : null;
            const target = clickable || el;
            if (clickable && typeof /** @type {any} */ (clickable).click === 'function') {
              try {
                /** @type {any} */ (clickable).click();
              } catch { /* fall through to event sequence */ }
            } else {
              const common = {
                bubbles: true,
                cancelable: true,
                composed: true,
                view,
                clientX: localX,
                clientY: localY,
                button: 0,
                buttons: 1
              };
              const hasPointer = typeof view.PointerEvent === 'function';
              if (hasPointer) {
                const pCommon = { ...common, pointerId: 1, pointerType: 'mouse', isPrimary: true };
                try { target.dispatchEvent(new view.PointerEvent('pointerdown', pCommon)); } catch { /* ignore */ }
              }
              try { target.dispatchEvent(new view.MouseEvent('mousedown', common)); } catch { /* ignore */ }
              const commonUp = { ...common, buttons: 0 };
              if (hasPointer) {
                const pUp = { ...commonUp, pointerId: 1, pointerType: 'mouse', isPrimary: true };
                try { target.dispatchEvent(new view.PointerEvent('pointerup', pUp)); } catch { /* ignore */ }
              }
              try { target.dispatchEvent(new view.MouseEvent('mouseup', commonUp)); } catch { /* ignore */ }
              try { target.dispatchEvent(new view.MouseEvent('click', commonUp)); } catch { /* ignore */ }
            }
          }
          return true;
        }
      }
    } catch {
      // Cross-origin — fall through to postMessage / runtime relay.
    }

    let posted = false;
    try {
      const win = iframe.contentWindow;
      if (win) {
        win.postMessage(payload, '*');
        posted = true;
      }
    } catch { /* ignore */ }

    // Backup: SW fans out to subframes; agent matches frameName / activates at local coords.
    // Fire-and-forget so we never block the key handler.
    try {
      this._sendRuntimeMessage(payload, { silent: true });
      posted = true;
    } catch { /* ignore */ }

    return posted;
  }

  handleActivateKey() {
    const currentState = this.state.getState();
    const x = currentState.lastMouse.x;
    const y = currentState.lastMouse.y;

    // Cross-origin iframes (Google account switcher, etc.): forward into the frame.
    if (this._tryActivateIframeUnderCursor(x, y, {})) {
      this.showRipple(x, y);
      this.emitAction('activate', { viaIframe: true });
      return;
    }

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
    // Onboarding "click a link" also accepts a successful F on the blue focus-outline
    // target — many clickables look like links but don't navigate (or aren't <a>).
    try {
      const focus = currentState.focusEl;
      if (
        focus instanceof Element &&
        target instanceof Element &&
        (focus === target || focus.contains(target) || target.contains(focus))
      ) {
        activationDetail.hadFocusOutline = true;
      }
    } catch { /* ignore */ }

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
      if (activationDetail.isKeyboardHelpKey) {
        try {
          const actionId = target.closest?.('[data-kp-action-id]')?.dataset?.kpActionId;
          if (actionId) pinKeyPopover(actionId, { keybindings: this.keybindings });
        } catch { /* ignore */ }
      }
      return;
    }

    // Always try to click the element, regardless of whether it's "detected" as interactive
    // This ensures videos, custom elements, and other non-standard interactive elements work
    this.activator.smartClick(target, currentState.lastMouse.x, currentState.lastMouse.y);
    this.showRipple(currentState.lastMouse.x, currentState.lastMouse.y);
    this.overlayManager.flashFocusOverlay(target);
    this.postClickRefresh(target, currentState.lastMouse.x, currentState.lastMouse.y);
    this.emitAction('activate', activationDetail);
    if (activationDetail.isKeyboardHelpKey) {
      try {
        const actionId = target.closest?.('[data-kp-action-id]')?.dataset?.kpActionId;
        if (actionId) pinKeyPopover(actionId, { keybindings: this.keybindings });
      } catch { /* ignore */ }
    }
  }

  handleActivateNewTabKey() {
    const currentState = this.state.getState();
    const x = currentState.lastMouse.x;
    const y = currentState.lastMouse.y;

    if (this._tryActivateIframeUnderCursor(x, y, { openInNewTab: true })) {
      this.showRipple(x, y);
      this.emitAction('activateNewTab', { viaIframe: true });
      return;
    }

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
    const x = currentState.lastMouse.x;
    const y = currentState.lastMouse.y;

    if (this._tryActivateIframeUnderCursor(x, y, { background: true, openInNewTab: true })) {
      this.showRipple(x, y);
      this.emitAction('activateNewTabBackground', { viaIframe: true });
      return;
    }

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
    // Keep the raw under-cursor node so collapsed history groups (not always "clickable")
    // can still resolve a root-domain preview URL.
    let under = null;
    try {
      under = this.detector.deepElementFromPoint(lastMouse.x, lastMouse.y);
    } catch { /* ignore */ }

    let target = currentState.focusEl;
    if (!target) {
      target = this.detector.findClickable(under) || under;
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

    // Collapsed Recent History group boxes (New Tab): no child row is hit-testable,
    // so preview the root domain shown as the group label.
    if (!url) {
      try {
        const start =
          (under instanceof Element ? under : null) ||
          (target instanceof Element ? target : null);
        const outline = start?.closest?.('details.history-outline') || null;
        if (outline && !outline.open) {
          const rootUrl = String(outline.dataset?.kpRootUrl || '').trim();
          if (rootUrl) {
            url = rootUrl;
            link = outline;
          }
        }
      } catch { /* ignore */ }
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

    // Shared inspector pick: Esc exits pick mode only — leave sticky effects
    // (e.g. applied columns + slip bar) intact.
    if (currentState.mode === MODES.INSPECTOR ||
        currentState.mode === MODES.DELETE ||
        currentState.mode === MODES.COLS) {
      this.inspector.exit();
      try { this.overlayManager?.hideInspectorModeIndicator?.(); } catch { /* ignore */ }
      try { this.overlayManager?.clearInspectorPickedOverlays?.(); } catch { /* ignore */ }
      return;
    }
    
    // Don't reset if we're in text focus mode - that should only be cleared by ESC or blur
    if (currentState.mode !== MODES.TEXT_FOCUS) {
      this.state.reset();
    }

    // Esc in normal mode: also return keyboard ownership from page embeds (Issuu, etc.).
    // Only when we were pointer-tracking inside — never blur a freshly focused Google
    // account iframe that the user has not entered with the pointer.
    try {
      if (this._framePointerInside) {
        this._framePointerInside = false;
        this._framePointerIframe = null;
        this._reclaimKeyboardFocusFromPageIframes();
      }
    } catch { /* ignore */ }
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

  /**
   * Top-center flash toast. Optional thumbnailBlob (e.g. after Copy Image)
   * renders a max 150×150 preview to the right of the message.
   *
   * @param {string} message
   * @param {string} [backgroundColor]
   * @param {Blob|null} [thumbnailBlob]
   */
  showFlashNotification(message, backgroundColor = COLORS.NOTIFICATION_SUCCESS, thumbnailBlob = null) {
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

      const hasThumbnail = thumbnailBlob instanceof Blob && thumbnailBlob.size > 0;
      let objectUrl = null;

      const messageEl = document.createElement('span');
      messageEl.textContent = message;
      notification.appendChild(messageEl);

      if (hasThumbnail) {
        try {
          objectUrl = URL.createObjectURL(thumbnailBlob);
          const thumbBox = document.createElement('div');
          Object.assign(thumbBox.style, {
            flex: '0 0 auto',
            maxWidth: '150px',
            maxHeight: '150px',
            borderRadius: '4px',
            overflow: 'hidden',
            backgroundColor: '#fff',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.45)',
            lineHeight: '0'
          });
          const img = document.createElement('img');
          img.src = objectUrl;
          img.alt = '';
          Object.assign(img.style, {
            display: 'block',
            maxWidth: '150px',
            maxHeight: '150px',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain'
          });
          thumbBox.appendChild(img);
          notification.appendChild(thumbBox);
        } catch (thumbError) {
          console.warn('[KeyPilot] Failed to render flash thumbnail:', thumbError);
          if (objectUrl) {
            try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ }
            objectUrl = null;
          }
        }
      }
      
      // Style the notification with error handling
      try {
        Object.assign(notification.style, {
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: backgroundColor,
          color: 'white',
          padding: hasThumbnail ? '10px 14px 10px 20px' : '12px 24px',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '500',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          zIndex: String(Z_INDEX.NOTIFICATION),
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
          opacity: '0',
          transition: 'opacity 0.3s ease-in-out',
          pointerEvents: 'none',
          maxWidth: hasThumbnail ? '560px' : '400px',
          wordWrap: 'break-word',
          textAlign: hasThumbnail ? 'left' : 'center',
          display: 'flex',
          alignItems: 'center',
          gap: hasThumbnail ? '14px' : '0'
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
        notification.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.35)';
      }

      // Add to document with error handling
      try {
        document.body.appendChild(notification);
      } catch (appendError) {
        console.error('[KeyPilot] Error appending notification to document:', appendError);
        if (objectUrl) {
          try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ }
        }
        return;
      }

      // Show notification immediately (animation removed)
      notification.style.opacity = '1';

      // Fade out and remove after appropriate duration based on message type
      const duration = backgroundColor === COLORS.NOTIFICATION_ERROR ? 4000 : 2000; // Show errors longer
      
      setTimeout(() => {
        try {
          if (objectUrl) {
            try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ }
          }
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

  updateOverlays(focusEl, inspectorEl = null, inspectorKind = null) {
    // Don't update overlays if extension is disabled
    if (!this.enabled) {
      return;
    }

    const currentState = this.state.getState();
    const inspEl = inspectorEl !== undefined && inspectorEl !== null
      ? inspectorEl
      : currentState.inspectorEl;
    const kind = inspectorKind != null
      ? inspectorKind
      : currentState.inspectorKind;

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
      inspEl,
      currentState.mode,
      currentState.focusedTextElement,
      focusRectOverride,
      kind
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
    const wasEnabled = !!this.enabled;
    this.enabled = true;

    // Always ensure the iframe pointer bridge is listening (toggle-handler enable
    // sets enabled=true without calling this method when the page loaded disabled).
    this._installFrameBridgeListener();

    // Already running — bridge install above is enough.
    if (wasEnabled) return;
    
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
      this._syncControlStripTextModeFromState();
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
    } catch { /* ignore */ }

    // Onboarding / practice panels: hide only — do NOT setActive(false).
    // Toggle-off during an incomplete walkthrough must keep progress so re-enable
    // can restore the panel. Do not dismiss the re-enable tip here — onboarding
    // shows it right before disable runs (same toggleExtension event).
    try {
      const ob = window.__KeyPilotOnboarding;
      try { ob?.panel?.hide?.(); } catch { /* ignore */ }
      try { ob?.practicePanel?.hide?.(); } catch { /* ignore */ }
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

    // Clear iframe pointer-tracking state without reclaiming focus. Blurring a
    // focused page iframe here would dismiss Google account / similar menus
    // when the user turns KeyPilot off.
    this._framePointerInside = false;
    this._framePointerIframe = null;
    this._uninstallFrameBridgeListener();

    // Always dismiss popovers/launcher/omnibox even if init is incomplete.
    this.dismissActiveUI();

    // Clear sticky column layout + slip bar so the page is not left altered.
    try { this.columnLayoutManager?.clear?.(); } catch { /* ignore */ }

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

  /**
   * Show/hide the shadow-root paint debug HUD (leaf, focusEl, paint target, A/B/C).
   * Console: `keyPilot.setShadowRootDebugHud(true)`
   * @param {boolean} enabled
   */
  setShadowRootDebugHud(enabled) {
    try {
      this.overlayManager?.setShadowRootDebugHud?.(!!enabled);
    } catch (e) {
      console.warn('[KeyPilot] setShadowRootDebugHud failed:', e);
    }
  }

  /**
   * Force hover paint strategy while the shadow debug HUD is open.
   * @param {'A'|'B'|'C'|null|string} strategy - null/'auto' restores automatic choice
   */
  setShadowDebugPaintStrategy(strategy) {
    try {
      this.overlayManager?.setShadowDebugPaintStrategy?.(strategy);
    } catch (e) {
      console.warn('[KeyPilot] setShadowDebugPaintStrategy failed:', e);
    }
  }

  cleanup() {
    try { this.dismissActiveUI(); } catch { /* ignore */ }
    try { this.columnLayoutManager?.clear?.(); } catch { /* ignore */ }
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