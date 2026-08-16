/**
 * Visual overlay management for focus and delete indicators
 */
import { CSS_CLASSES, Z_INDEX, SELECTORS, MODES, COLORS, FEATURE_FLAGS, CLICKABLE_CATEGORY, KP_UI_FONT, SCROLL, TEXT_FOCUS_HINT_MIN_HEIGHT_PX } from '../config/constants.js';
import {
  getAllInspectorHostClasses,
  getInspectorDef,
  getInspectorInstructionText
} from './inspector-mode.js';
import { MSG } from '../messaging/types.js';
import { HighlightManager } from './highlight-manager.js';
import { PopupManager } from './popup-manager.js';
import { DEFAULT_SETTINGS } from './settings-manager.js';
import { storageGetValue, storageSetValue } from '../utils/storage.js';
import { makePopoverResizable } from '../utils/popover-resize.js';
import {
  createPopoverTitlebar,
  createTitlebarCloseHint,
  createUrlPopoverTitlebar
} from '../ui/popover-titlebar.js';
import { ensureOpenChromeShadow } from '../ui/kp-chrome-shadow.js';
import { createSegmentedControl } from '../ui/segmented-control.js';
import {
  NCT_DARK_UI_PANEL_BACKGROUND,
  NCT_DARK_UI_PANEL_BORDER,
  NCT_DARK_UI_PANEL_RADIUS,
  NCT_DARK_UI_PANEL_BOX_SHADOW
} from '../ui/nct-dark-ui.js';
import {
  assignPopoverIframeSrc,
  createPopoverIframe,
  isHttpPopoverUrl,
  isKnownIframeDenierHost,
  preparePopoverIframeUrl
} from '../utils/preview-url.js';
import { resolveActivationIdentity } from '../utils/resolve-hovered-link.js';

/** Per-host Link Preview viewport mode: { [hostname]: 'mobile' }. Missing/default = desktop. */
const PREVIEW_VIEWPORT_BY_HOST_KEY = 'kp_link_preview_viewport_by_host';

/**
 * @param {string} url
 * @returns {string} normalized hostname (lowercase, no leading www.)
 */
/** Font Awesome 6 solid paths (viewBox 0 0 512 512) for PAGE_TOP / PAGE_BOTTOM.
 * Bar sits at the arrow tip (top for ↑, bottom for ↓), not the shaft tail.
 */
const EDGE_JUMP_ICON_PATHS = Object.freeze({
  // Up arrow + horizontal bar at tip (top)
  top: 'M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l96 96c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 205.3V384c0 17.7-14.3 32-32 32s-32-14.3-32-32V205.3l-41.4 41.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l96-96zM64 64c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H96C78.3 96 64 81.7 64 64z',
  // Down arrow + horizontal bar at tip (bottom)
  bottom: 'M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l96-96c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 306.7V128c0-17.7-14.3-32-32-32s-32 14.3-32 32V306.7l-41.4-41.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l96 96zM64 448c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H96c-17.7 0-32-14.3-32-32z'
});

function previewHostFromUrl(url) {
  try {
    let host = new URL(String(url || '')).hostname.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    return host;
  } catch {
    return '';
  }
}




export class OverlayManager {
  constructor() {
    // Rendering mode configuration: 'dom' | 'canvas' | 'css-custom-props'
    // Default: no full-viewport canvas. DOM-hover uses element styling; fixed
    // backends are opt-in via setRenderingMode('canvas'|'css-custom-props').
    this.renderingMode = 'dom';

    // Canvas rendering backend
    this.canvasOverlay = null;
    this.canvasContext = null;

    // CSS Custom Properties rendering backend
    this.cssCustomPropsOverlay = null;

    this.focusOverlay = null;
    /** Shared inspector pick outline (Delete, Cols, future kinds) */
    this.inspectorOverlay = null;
    /** @type {string|null} last applied inspector kind for restyle */
    this._inspectorOverlayKind = null;
    /** Top-right companion instruction (like Text Select mode indicator) */
    this.inspectorModeIndicator = null;
    /** @type {{ kind?: string|null, confirmKey?: string }|null} */
    this._inspectorIndicatorOpts = null;
    // Legacy aliases — kept so any lingering callers don't throw during transition
    this.deleteOverlay = null;
    this.colsOverlay = null;
    this.viewportModalFrame = null; // Viewport modal frame for text focus mode
    this.escExitLabelText = null; // ESC label for text fields
    this.escExitLabelHover = null; // ESC label for hovered elements
    this.hoverClickLabelText = 'F clicks'; // Hover label for click arming in text focus mode
    this.popoverContainer = null; // Container for popover iframe
    this.popoverIframeElement = null; // iframe element (for focus management)
    this.popoverIframeWindow = null; // contentWindow of the current popover iframe (for message validation)
    this.popoverMessageHandler = null; // message listener for iframe bridge
    this.popoverInitTimer = null; // timer for bridge init retries
    this.popoverBridgeReady = false; // whether iframe bridge has acked readiness
    this.popoverCloseButton = null; // close button element for keyboard activation (F)
    this._popoverLastMouse = { x: null, y: null }; // last known mouse position in top document
    this._popoverMouseTrackerInstalled = false;
    this._isPreviewPopover = false; // track if current popover is preview style (no backdrop)
    this._popoverArrowStyle = null; // style element for preview popover triangle
    this._popoverClickOutsideHandler = null; // click outside handler for preview popover
    this._previewPopoverDragCleanup = null; // teardown titlebar drag listeners
    this._popoverResizeDispose = null; // teardown generic resize handles
    this._popoverHybridFocusCleanup = null; // teardown chrome↔iframe focus routing
    this._previewMobileUaActive = false; // SW session rule: mobile UA for preview iframe
    /** @type {number|null} OS popup window id when using separate-window fallback */
    this._popoverWindowId = null;
    /** @type {number|null} tab id inside the OS popup window */
    this._popoverWindowTabId = null;
    /** @type {string|null} */
    this._popoverWindowUrl = null;
    /** @type {'preview'|'modal'|null} */
    this._popoverWindowKind = null;
    /** Pending iframe denial watch payload (for promote-on-deny). */
    this._pendingIframePromote = null;
    /** @type {((message: any, sender: any, sendResponse: any) => boolean|void)|null} */
    this._popoverWindowMsgHandler = null;
    /** @type {HTMLElement|null} */
    this._edgeJumpFadeEl = null;
    this._edgeJumpFadeToken = 0;

    // Central popup stack + blurred backdrop (kept below click overlays).
    // Note: Panel change callback will be set by KeyPilot after initialization
    this.popupManager = new PopupManager();
    this._popoverPopupId = 'kpv2-iframe-popover';

    // Initialize highlight manager
    this.highlightManager = new HighlightManager();
    
    // Intersection observer for overlay visibility optimization
    this.overlayObserver = null;
    this.resizeObserver = null; // ResizeObserver for viewport modal frame
    
    // Track overlay visibility state
    this.overlayVisibility = {
      focus: true,
      delete: true,
      escExitLabel: true
    };

    // Settings-driven UI customization (populated by KeyPilot from chrome.storage.sync).
    this._modeSettings = {
      clickMode: null,
      textMode: null
    };

    // Debug panel for performance metrics
    this.debugPanel = null;
    this.debugPanelUpdateInterval = null;

    /**
     * Shadow-root debug HUD (msn.com / archive.org paint experiments).
     * @type {HTMLElement|null}
     */
    this._shadowDebugHud = null;
    /** @type {boolean} */
    this._shadowDebugHudEnabled = !!(FEATURE_FLAGS && FEATURE_FLAGS.DEBUG_SHADOW_ROOT_HUD);
    /**
     * Forced paint strategy while HUD is open: 'A' | 'B' | 'C' | null (auto).
     * @type {'A'|'B'|'C'|null}
     */
    this._shadowDebugPaintOverride = null;
    /** @type {{ leaf: Element|null, focus: Element|null, paint: Element|null, auto: string, applied: string, inShadow: boolean }|null} */
    this._shadowDebugLastInfo = null;

    // When DOM-hover listener mode is enabled, render non-text focus rectangles in blue so it's
    // visually obvious we're using browser-native hover targeting (vs RBush-driven hit-testing).
    this._useDomHoverFocusColors = false;

    /**
     * When true, hover focus uses strategy C: body-level fixed DOM overlay.
     * Scroll must reposition it; `usesElementFocusStyling()` reports false.
     * Preference: A DOM outline → B in-target ring → C this path.
     * @type {boolean}
     */
    this._focusPaintUsesFixedOverlay = false;

    /**
     * When true, hover focus uses strategy B: absolute ring inside the host
     * (local max z-index + 1). Co-located with the element → scrolls free.
     * @type {boolean}
     */
    this._focusPaintUsesInTargetRing = false;

    /** @type {HTMLElement|null} singleton in-target ring node */
    this._inTargetRing = null;
    /** @type {Element|null} host currently holding the in-target ring */
    this._inTargetHost = null;
    /**
     * If we set position:relative on a static host, restore on detach.
     * @type {{ host: Element, prev: string }|null}
     */
    this._inTargetHostPosRestore = null;

    // Text focus styling (we style the focused input + nearby wrapper parents directly).
    this._textFocusCurrentElement = null;
    this._textFocusStyledElements = new Set();
    /** @type {Element|null} visual box we paint (may be a taller wrapper) */
    this._textFocusPaintHost = null;
    /** @type {'left_edge'|'background_tint'|null} */
    this._textFocusAppliedStyle = null;

    // Text input hover styling (SVG "Press F…" hint on hovered fields; outline is separate).
    this._textHoverCurrentElement = null;
    this._textHoverStyledElements = new Set();

    // Last known focus target (used for F-click scale-up pulse across all render modes).
    this._lastFocusElement = null;
    this._lastFocusRect = null;

    /**
     * Cache for `_findFocusClipContext` — avoids repeated getComputedStyle ancestor
     * walks on hover thrash. Keyed by element; invalidated on resize / scroll-end TTL.
     * @type {WeakMap<Element, { clippers: Element[], tightWrapper: Element|null, ts: number, left: number, top: number, width: number, height: number }>}
     */
    this._focusClipContextCache = new WeakMap();
    /** @type {number} ms */
    this._focusClipContextTtlMs = 500;
    /** @type {(() => void)|null} */
    this._focusClipInvalidateBound = null;
    this._installFocusClipCacheInvalidation();

    /**
     * Active temporary click/image effect overlays.
     * Fixed-position ghosts must be torn down when the source leaves view or the
     * page navigates — otherwise they animate alone over the next screen.
     * @type {Set<{ pulse: Element, sourceEl: Element|null, originRect: DOMRect|null, rafId: number, timeoutId: number, io: IntersectionObserver|null, teardown: () => void }>}
     */
    this._activeEphemeralEffects = new Set();
    this._ephemeralEffectLifecycleInstalled = false;
    /** @type {(() => void)|null} */
    this._ephemeralEffectLifecycleDispose = null;
    
    this.setupOverlayObserver();
    
    // Initialize highlight manager with observer
    this.highlightManager.initialize(this.overlayObserver);
  }

  /**
   * Toggle alternate focus overlay colors (blue) for DOM-hover listener targeting mode.
   * @param {boolean} enabled
   */
  setDomHoverFocusColorsEnabled(enabled) {
    this._useDomHoverFocusColors = !!enabled;
    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] DOM hover focus colors enabled:', this._useDomHoverFocusColors);
    }
  }

  /**
   * True when focus chrome is painted on/with the target element (strategies
   * A or B) and therefore scrolls with the page. False when strategy C
   * (body-level fixed overlay) must be repositioned on scroll.
   * @returns {boolean}
   */
  usesElementFocusStyling() {
    // A (DOM outline) and B (in-target ring) co-locate with the element.
    // C (body fixed) needs scroll reposition — only that reports false.
    return !!this._useDomHoverFocusColors && !this._focusPaintUsesFixedOverlay;
  }

  /**
   * Focus ring palette from click-mode settings (blue | green).
   * Falls back to blue when DOM-hover element styling is active and no setting is loaded.
   * @param {'blue'|'green'|string|null|undefined} [focusColor]
   */
  _getNonTextFocusPalette(focusColor) {
    const color = focusColor === 'green' || focusColor === 'blue'
      ? focusColor
      : (this._getClickModeSettings().focusColor || 'blue');
    if (color === 'green') {
      return {
        borderColor: COLORS.FOCUS_GREEN,
        shadowColor: COLORS.GREEN_SHADOW,
        shadowBrightColor: COLORS.GREEN_SHADOW_BRIGHT,
        backgroundColor: COLORS.FOCUS_GREEN_BG_T2
      };
    }
    return {
      borderColor: COLORS.FOCUS_BLUE,
      shadowColor: COLORS.BLUE_SHADOW,
      shadowBrightColor: COLORS.BLUE_SHADOW_BRIGHT,
      backgroundColor: COLORS.FOCUS_BLUE_BG_T2
    };
  }

  /**
   * Resolve clickable category for focus chrome decisions.
   * @param {Element|null} element
   * @returns {string}
   */
  getFocusCategory(element) {
    try {
      const detector = window.keyPilot?.detector || window.keyPilot?.elementDetector;
      if (detector && typeof detector.getClickableCategory === 'function') {
        return detector.getClickableCategory(element);
      }
    } catch { /* ignore */ }
    return CLICKABLE_CATEGORY.NONE;
  }

  /**
   * Suppress the semi-transparent blue focus fill by category:
   * - slider: never (progress bars are not link-like)
   * - media with seek chrome in the player shell: no fill (players, not thumbnails)
   * - text: no blue wash
   *
   * Links / generic / media thumbnails keep the fill.
   *
   * @param {Element|null} element
   * @returns {boolean}
   */
  shouldSuppressFocusFill(element) {
    try {
      if (!element || !(element instanceof Element)) return false;
      const detector = window.keyPilot?.detector || window.keyPilot?.elementDetector;
      if (detector && typeof detector.shouldSuppressFocusFillForElement === 'function') {
        return detector.shouldSuppressFocusFillForElement(element);
      }
      const cat = this.getFocusCategory(element);
      return cat === CLICKABLE_CATEGORY.SLIDER || cat === CLICKABLE_CATEGORY.TEXT;
    } catch {
      return false;
    }
  }

  /**
   * Media / slider surfaces for F-key scale-pulse skip (not link-style).
   * @param {Element|null} element
   * @returns {boolean}
   */
  isVideoLikeElement(element) {
    try {
      if (!element || !(element instanceof Element)) return false;
      const cat = this.getFocusCategory(element);
      if (cat === CLICKABLE_CATEGORY.SLIDER || cat === CLICKABLE_CATEGORY.MEDIA) return true;
      // Fallback: raw video node if category unavailable
      if (element.tagName === 'VIDEO' || element.tagName === 'AUDIO') return true;
      return !!(element.querySelector && element.querySelector('video'));
    } catch {
      return false;
    }
  }

  // Canvas-based rendering backend
  initCanvasRenderer() {
    if (this.canvasOverlay) return;

    this.canvasOverlay = document.createElement('canvas');
    this.canvasOverlay.className = CSS_CLASSES.CANVAS_OVERLAY || 'kpv2-canvas-overlay';
    this.canvasOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: ${Z_INDEX.OVERLAYS};
      will-change: transform;
    `;

    // Set canvas size to viewport
    this.canvasOverlay.width = window.innerWidth;
    this.canvasOverlay.height = window.innerHeight;

    this.canvasContext = this.canvasOverlay.getContext('2d');
    document.body.appendChild(this.canvasOverlay);

    // Handle viewport resize
    this._canvasResizeHandler = () => {
      this.canvasOverlay.width = window.innerWidth;
      this.canvasOverlay.height = window.innerHeight;
    };
    window.addEventListener('resize', this._canvasResizeHandler);

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Canvas renderer initialized');
    }
  }

  cleanupCanvasRenderer() {
    if (this.canvasOverlay) {
      if (this._canvasResizeHandler) {
        window.removeEventListener('resize', this._canvasResizeHandler);
        this._canvasResizeHandler = null;
      }
      this.canvasOverlay.remove();
      this.canvasOverlay = null;
      this.canvasContext = null;
    }
  }

  updateFocusOverlayCanvas(element, mode = MODES.NONE, rectOverride = null) {
    if (!this.canvasContext || !element) {
      this.hideFocusOverlayCanvas();
      return;
    }

    // Don't outline modal/popover iframes
    try {
      if (element.tagName === 'IFRAME') {
        const isPopoverIframe = this.popoverIframeElement && element === this.popoverIframeElement;
        const isModalIframe = !!(element.classList && element.classList.contains('modal-iframe'));
        if (isPopoverIframe || isModalIframe) {
          this.hideFocusOverlayCanvas();
          return;
        }
      }
    } catch { /* ignore */ }

    const rawRect = (rectOverride && typeof rectOverride === 'object')
      ? rectOverride
      : this.getBestRect(element);
    const rect = this._clipViewportRectToVisible(element, rawRect);
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      this.hideFocusOverlayCanvas();
      return;
    }

    // Determine element type and colors
    const isTextInput = element.matches && element.matches(SELECTORS.FOCUSABLE_TEXT);
    const suppressFill = this.shouldSuppressFocusFill(element);
    const isVeryLarge = rect.width > 512 && rect.height > 512;

    const clickSettings = this._getClickModeSettings();
    let borderColor, shadowColor, backgroundColor;
    if (isTextInput) {
      borderColor = COLORS.ORANGE;
      shadowColor = COLORS.ORANGE_SHADOW;
      backgroundColor = 'transparent';
    } else {
      const p = this._getNonTextFocusPalette(clickSettings.focusColor);
      borderColor = p.borderColor;
      shadowColor = p.shadowColor;
      // Fill for thumbnails/links; suppress for scrubbers and players that have a seek bar.
      backgroundColor = (suppressFill || isVeryLarge) ? 'transparent' : p.backgroundColor;
    }

    // Settings-driven behavior
    const { rectangleThickness, overlayFillEnabled, overlayShadowEnabled } = clickSettings;
    if (!isTextInput && !suppressFill && !isVeryLarge && overlayFillEnabled === false) {
      backgroundColor = 'transparent';
    }

    // Clear canvas and draw rectangle
    this.canvasContext.clearRect(0, 0, this.canvasOverlay.width, this.canvasOverlay.height);

    // Draw background fill if enabled
    if (backgroundColor !== 'transparent') {
      this.canvasContext.fillStyle = backgroundColor;
      this.canvasContext.fillRect(rect.left, rect.top, rect.width, rect.height);
    }

    // Draw border
    this.canvasContext.strokeStyle = borderColor;
    this.canvasContext.lineWidth = rectangleThickness;
    this.canvasContext.strokeRect(rect.left, rect.top, rect.width, rect.height);

    // Optional soft outer glow
    if (overlayShadowEnabled !== false) {
      this.canvasContext.shadowColor = shadowColor;
      this.canvasContext.shadowBlur = 4;
      this.canvasContext.strokeRect(rect.left, rect.top, rect.width, rect.height);
      this.canvasContext.shadowBlur = 0;
    }

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Canvas focus overlay updated:', {
        rect: rect,
        borderColor: borderColor,
        backgroundColor: backgroundColor
      });
    }
  }

  hideFocusOverlayCanvas() {
    if (this.canvasContext) {
      this.canvasContext.clearRect(0, 0, this.canvasOverlay.width, this.canvasOverlay.height);
    }
  }

  // CSS Custom Properties rendering backend
  initCSSCustomPropsRenderer() {
    if (this.cssCustomPropsOverlay) return;

    this.cssCustomPropsOverlay = document.createElement('div');
    this.cssCustomPropsOverlay.className = CSS_CLASSES.CSS_PROPS_OVERLAY || 'kpv2-css-props-overlay';
    const p = this._getNonTextFocusPalette();
    this.cssCustomPropsOverlay.style.cssText = `
      --rect-x: 0px;
      --rect-y: 0px;
      --rect-width: 0px;
      --rect-height: 0px;
      --rect-border-color: ${p.borderColor};
      --rect-background: transparent;
      --rect-shadow-color: ${p.shadowColor};
      --rect-shadow-bright-color: ${p.shadowBrightColor};
      --rect-border-thickness: 2px;

      position: fixed;
      left: var(--rect-x);
      top: var(--rect-y);
      width: var(--rect-width);
      height: var(--rect-height);
      border: var(--rect-border-thickness) solid var(--rect-border-color);
      background: var(--rect-background);
      box-shadow: 0 0 0 2px var(--rect-shadow-color), 0 0 10px 2px var(--rect-shadow-bright-color);
      pointer-events: none;
      z-index: ${Z_INDEX.OVERLAYS};
      will-change: transform;
    `;

    document.body.appendChild(this.cssCustomPropsOverlay);

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] CSS Custom Properties renderer initialized');
    }
  }

  cleanupCSSCustomPropsRenderer() {
    if (this.cssCustomPropsOverlay) {
      this.cssCustomPropsOverlay.remove();
      this.cssCustomPropsOverlay = null;
    }
  }

  updateFocusOverlayCSSCustomProps(element, mode = MODES.NONE, rectOverride = null) {
    if (!this.cssCustomPropsOverlay || !element) {
      this.hideFocusOverlayCSSCustomProps();
      return;
    }

    // Don't outline modal/popover iframes
    try {
      if (element.tagName === 'IFRAME') {
        const isPopoverIframe = this.popoverIframeElement && element === this.popoverIframeElement;
        const isModalIframe = !!(element.classList && element.classList.contains('modal-iframe'));
        if (isPopoverIframe || isModalIframe) {
          this.hideFocusOverlayCSSCustomProps();
          return;
        }
      }
    } catch { /* ignore */ }

    const rawRect = (rectOverride && typeof rectOverride === 'object')
      ? rectOverride
      : this.getBestRect(element);
    const rect = this._clipViewportRectToVisible(element, rawRect);
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      this.hideFocusOverlayCSSCustomProps();
      return;
    }

    // Determine element type and colors
    const isTextInput = element.matches && element.matches(SELECTORS.FOCUSABLE_TEXT);
    const suppressFill = this.shouldSuppressFocusFill(element);
    const isVeryLarge = rect.width > 512 && rect.height > 512;

    const clickSettings = this._getClickModeSettings();
    let borderColor, shadowColor, backgroundColor, shadowBrightColor;
    if (isTextInput) {
      borderColor = COLORS.ORANGE;
      shadowColor = COLORS.ORANGE_SHADOW;
      shadowBrightColor = COLORS.ORANGE_SHADOW;
      backgroundColor = 'transparent';
    } else {
      const p = this._getNonTextFocusPalette(clickSettings.focusColor);
      borderColor = p.borderColor;
      shadowColor = p.shadowColor;
      shadowBrightColor = p.shadowBrightColor;
      // Fill for thumbnails/links; suppress for scrubbers and players that have a seek bar.
      backgroundColor = (suppressFill || isVeryLarge) ? 'transparent' : p.backgroundColor;
    }

    // Settings-driven behavior
    const { rectangleThickness, overlayFillEnabled, overlayShadowEnabled } = clickSettings;
    if (!isTextInput && !suppressFill && !isVeryLarge && overlayFillEnabled === false) {
      backgroundColor = 'transparent';
    }

    // Update CSS custom properties
    const overlay = this.cssCustomPropsOverlay;
    overlay.style.setProperty('--rect-x', rect.left + 'px');
    overlay.style.setProperty('--rect-y', rect.top + 'px');
    overlay.style.setProperty('--rect-width', rect.width + 'px');
    overlay.style.setProperty('--rect-height', rect.height + 'px');
    overlay.style.setProperty('--rect-border-color', borderColor);
    overlay.style.setProperty('--rect-background', backgroundColor);
    overlay.style.setProperty('--rect-shadow-color', shadowColor);
    overlay.style.setProperty('--rect-shadow-bright-color', shadowBrightColor);
    overlay.style.setProperty('--rect-border-thickness', rectangleThickness + 'px');
    if (overlayShadowEnabled === false) {
      overlay.style.boxShadow = 'none';
    } else {
      overlay.style.boxShadow =
        '0 0 0 2px var(--rect-shadow-color), 0 0 10px 2px var(--rect-shadow-bright-color)';
    }

    try {
      const radius = this._resolveElementBorderRadius(element);
      overlay.style.borderRadius = radius || '0';
      overlay.style.boxSizing = 'border-box';
    } catch {
      overlay.style.borderRadius = '0';
    }

    overlay.style.display = 'block';
    overlay.style.visibility = 'visible';
    overlay.style.opacity = '1';

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] CSS Custom Props focus overlay updated:', {
        rect: rect,
        borderColor: borderColor,
        backgroundColor: backgroundColor
      });
    }
  }

  hideFocusOverlayCSSCustomProps() {
    if (this.cssCustomPropsOverlay) {
      this.cssCustomPropsOverlay.style.setProperty('--rect-width', '0px');
      this.cssCustomPropsOverlay.style.setProperty('--rect-height', '0px');
      this.cssCustomPropsOverlay.style.display = 'none';
    }
  }

  /**
   * Apply click/text mode settings from chrome.storage (via KeyPilot).
   * @param {object|null|undefined} settings
   */
  setModeSettings(settings) {
    const s = settings && typeof settings === 'object' ? settings : {};
    this._modeSettings = {
      clickMode: s.clickMode && typeof s.clickMode === 'object' ? s.clickMode : null,
      textMode: s.textMode && typeof s.textMode === 'object' ? s.textMode : null
    };

    // If a text field is currently styled, re-apply so focusStyle changes take effect live.
    try {
      const focused = this._textFocusCurrentElement;
      if (focused && focused.isConnected) {
        this._textFocusCurrentElement = null;
        this._applyTextFocusElementStyling(focused);
      }
    } catch { /* ignore */ }
  }

  _getClickModeSettings() {
    const cm = this._modeSettings?.clickMode && typeof this._modeSettings.clickMode === 'object'
      ? this._modeSettings.clickMode
      : {};
    const def = DEFAULT_SETTINGS.clickMode || {};
    const rectangleThickness = Number(cm.rectangleThickness);
    const thickness = Number.isFinite(rectangleThickness)
      ? Math.min(Math.max(rectangleThickness, 1), 16)
      : (Number(def.rectangleThickness) || 3);
    // Defaults: outline only (no fill / no glow) unless explicitly enabled.
    const overlayFillEnabled = cm.overlayFillEnabled === true;
    const overlayShadowEnabled = cm.overlayShadowEnabled === true;
    const focusColor = cm.focusColor === 'green' ? 'green' : 'blue';
    const rawEffect = cm.clickEffect;
    const clickEffect =
      rawEffect === 'flash' ||
      rawEffect === 'dash' ||
      rawEffect === 'marquee' ||
      rawEffect === 'scale' ||
      rawEffect === 'none'
        ? rawEffect
        : (def.clickEffect || 'flash');
    return {
      rectangleThickness: thickness,
      overlayFillEnabled,
      overlayShadowEnabled,
      focusColor,
      clickEffect
    };
  }

  _getTextModeSettings() {
    const tm = this._modeSettings?.textMode && typeof this._modeSettings.textMode === 'object'
      ? { ...DEFAULT_SETTINGS.textMode, ...this._modeSettings.textMode }
      : DEFAULT_SETTINGS.textMode;
    const strokeThickness = Number(tm.strokeThickness);
    const thickness = Number.isFinite(strokeThickness) ? Math.min(Math.max(strokeThickness, 1), 16) : 3;
    const leftEdgeRaw = Number(tm.leftEdgeWidth);
    const leftEdgeWidth = Number.isFinite(leftEdgeRaw)
      ? Math.min(Math.max(leftEdgeRaw, 1), 24)
      : (Number(DEFAULT_SETTINGS.textMode.leftEdgeWidth) || 5);
    const focusStyle = tm.focusStyle === 'background_tint' ? 'background_tint' : 'left_edge';
    return {
      strokeThickness: thickness,
      labelsEnabled: tm.labelsEnabled,
      focusStyle,
      leftEdgeWidth
    };
  }

  setHoverClickLabelText(text) {
    this.hoverClickLabelText = String(text || 'F clicks');
    // In the new UI, the hover-click text is shown as a suffix on the "Active text field" label.
    if (this.escExitLabelHover) this.escExitLabelHover.innerHTML = this.formatActiveTextFieldLabel();
  }

  formatHoverLabelText(text) {
    // Handle countdown format: "5 F clicks" -> "<span class='countdown'>5</span> <kbd>F</kbd> clicks"
    // Handle regular format: "F clicks" -> "<kbd>F</kbd> clicks"
    const countdownMatch = text.match(/^(\d+)\s+(F clicks?)$/);
    if (countdownMatch) {
      const [_, number, rest] = countdownMatch;
      return `<span class="countdown-number">${number}</span> <kbd>F</kbd> clicks`;
    } else {
      return text.replace(/^F/, '<kbd>F</kbd>');
    }
  }

  formatActiveTextFieldLabel() {
    const suffix = this.hoverClickLabelText ? this.formatHoverLabelText(this.hoverClickLabelText) : '';
    return suffix ? `Active text field &nbsp;•&nbsp; ${suffix}` : 'Active text field';
  }

  ensureTextModeLabels() {
    if (!this.escExitLabelHover) {
      // Reuse the existing "hover" label slot for the Active Text label (so cleanup + observer stays simple).
      this.escExitLabelHover = this.createElement('div', {
        className: CSS_CLASSES.ESC_EXIT_LABEL,
        style: `
          position: fixed;
          pointer-events: none;
          z-index: ${Z_INDEX.OVERLAYS_ABOVE};
          will-change: transform, opacity;
        `
      });
      this.escExitLabelHover.innerHTML = this.formatActiveTextFieldLabel();
      document.body.appendChild(this.escExitLabelHover);
      if (this.overlayObserver) this.overlayObserver.observe(this.escExitLabelHover);
    } else {
      this.escExitLabelHover.innerHTML = this.formatActiveTextFieldLabel();
    }

    if (!this.escExitLabelText) {
      this.escExitLabelText = this.createElement('div', {
        className: CSS_CLASSES.ESC_EXIT_LABEL,
        style: `
          position: fixed;
          pointer-events: none;
          z-index: ${Z_INDEX.OVERLAYS_ABOVE};
          will-change: transform, opacity;
        `
      });
      this.escExitLabelText.innerHTML = 'Press <kbd>ESC</kbd> to close';
      document.body.appendChild(this.escExitLabelText);
      if (this.overlayObserver) this.overlayObserver.observe(this.escExitLabelText);
    } else {
      this.escExitLabelText.innerHTML = 'Press <kbd>ESC</kbd> to close';
    }
  }

  updateTextModeLabels(element) {
    if (!element) {
      this.hideTextModeLabels();
      return;
    }

    const { labelsEnabled } = this._getTextModeSettings();
    if (!labelsEnabled) {
      this.hideTextModeLabels();
      return;
    }

    this.ensureTextModeLabels();

    const rect = this.getBestRect(element);
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      this.hideTextModeLabels();
      return;
    }

    // Measure labels after setting innerHTML.
    const active = this.escExitLabelHover;
    const esc = this.escExitLabelText;
    const activeH = active?.offsetHeight || 24;
    const escH = esc?.offsetHeight || 24;
    const activeW = active?.offsetWidth || 180;
    const escW = esc?.offsetWidth || 180;
    const pad = 8;

    // Preferred placement: active above, ESC below.
    let activeTop = rect.top - activeH - pad;
    let escTop = rect.top + rect.height + pad;

    // If offscreen, flip.
    if (activeTop < pad) activeTop = rect.top + rect.height + pad;
    if (escTop + escH > window.innerHeight - pad) escTop = rect.top - escH - pad;

    // If they collide, stack them.
    if (Math.abs(activeTop - escTop) < Math.min(activeH, escH) + 4) {
      // Keep active closer to the element; push ESC away.
      if (escTop >= rect.top + rect.height) {
        escTop = escTop + activeH + 6;
      } else {
        escTop = escTop - activeH - 6;
      }
    }

    const clampLeft = (w) => Math.min(Math.max(rect.left, pad), window.innerWidth - w - pad);
    const activeLeft = clampLeft(activeW);
    const escLeft = clampLeft(escW);

    if (active) {
      active.style.left = `${activeLeft}px`;
      active.style.top = `${Math.min(Math.max(activeTop, pad), window.innerHeight - activeH - pad)}px`;
      active.style.display = 'block';
      active.style.visibility = 'visible';
    }
    if (esc) {
      esc.style.left = `${escLeft}px`;
      esc.style.top = `${Math.min(Math.max(escTop, pad), window.innerHeight - escH - pad)}px`;
      esc.style.display = 'block';
      esc.style.visibility = 'visible';
    }
  }

  hideTextModeLabels() {
    if (this.escExitLabelText) this.escExitLabelText.style.display = 'none';
    if (this.escExitLabelHover) this.escExitLabelHover.style.display = 'none';
  }

  _clearTextFocusElementStyling() {
    if (!this._textFocusStyledElements || this._textFocusStyledElements.size === 0) {
      this._textFocusCurrentElement = null;
      this._textFocusPaintHost = null;
      this._textFocusAppliedStyle = null;
      return;
    }
    try {
      for (const el of this._textFocusStyledElements) {
        if (!el || el.nodeType !== 1) continue;
        try {
          el.classList.remove(CSS_CLASSES.TEXT_FOCUS_INPUT);
          el.classList.remove(CSS_CLASSES.TEXT_FOCUS_INPUT_PARENT);
          el.classList.remove(CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE);
          try { el.classList.remove(CSS_CLASSES.TEXT_FOCUS_DELEGATED); } catch { /* ignore */ }
          try { el.classList.remove(CSS_CLASSES.TEXT_FOCUS_HINT_HIDDEN); } catch { /* ignore */ }
        } catch { /* ignore */ }
      }
    } finally {
      this._textFocusStyledElements.clear();
      this._textFocusCurrentElement = null;
      this._textFocusPaintHost = null;
      this._textFocusAppliedStyle = null;
    }
  }

  _getNearbyInputWrappers(inputEl) {
    const parents = [];
    if (!inputEl || inputEl.nodeType !== 1) return parents;

    // Only attempt wrapper styling when we have a meaningful rect.
    const inputRect = this.getBestRect(inputEl);
    if (!inputRect || inputRect.width <= 0 || inputRect.height <= 0) return parents;

    const maxDepth = 4;
    const maxPad = 28; // px of allowed expansion around the input (rounded containers, icons, padding)
    const maxAreaMultiple = 4.0; // avoid tinting large layout containers

    let p = inputEl.parentElement;
    let depth = 0;
    while (p && depth++ < maxDepth) {
      // Never tint the whole page.
      if (p === document.body || p === document.documentElement) break;

      let r;
      try {
        r = p.getBoundingClientRect();
      } catch {
        break;
      }

      if (!r || r.width <= 0 || r.height <= 0) {
        p = p.parentElement;
        continue;
      }

      const dx = Math.max(Math.abs(r.left - inputRect.left), Math.abs(r.right - inputRect.right));
      const dy = Math.max(Math.abs(r.top - inputRect.top), Math.abs(r.bottom - inputRect.bottom));

      const inputArea = inputRect.width * inputRect.height;
      const area = r.width * r.height;

      const closeEnough = dx <= maxPad && dy <= maxPad;
      const notTooBig =
        area <= inputArea * maxAreaMultiple &&
        r.width <= inputRect.width + maxPad * 2 &&
        r.height <= inputRect.height + maxPad * 2;

      if (!closeEnough || !notTooBig) break;

      parents.push(p);
      p = p.parentElement;
    }

    return parents;
  }

  /**
   * Visual box for text-mode chrome. Google/Gmail search (and similar) wrap a
   * short `position:absolute` <input> in a taller pill; the left-edge bar must
   * span that pill, not the single-line control.
   *
   * Do **not** promote to a parent that only stacks a caption/label above the
   * field (onboarding practice popover: `div > label + input|textarea`) — that
   * makes the hover ring taller than the control and can paint as a non-text
   * (blue) box when the paint target is no longer the field.
   *
   * @param {Element} inputEl
   * @returns {Element}
   */
  _resolveTextFocusPaintHost(inputEl) {
    if (!inputEl || inputEl.nodeType !== 1) return inputEl;
    let ir;
    try { ir = inputEl.getBoundingClientRect(); } catch { ir = null; }
    if (!ir || ir.width < 4 || ir.height < 2) return inputEl;

    let best = inputEl;
    let bestH = ir.height;
    let p = inputEl.parentElement;
    let depth = 0;
    while (p && depth++ < 14) {
      if (p === document.body || p === document.documentElement) break;
      let r;
      try { r = p.getBoundingClientRect(); } catch { r = null; }
      if (!r || r.width <= 0 || r.height <= 0) {
        p = p.parentElement;
        continue;
      }

      // Header / page chrome — stop. Allow a modest extra width for leading icons.
      if (r.width > ir.width + 180) break;
      if (r.height > 84 && r.height > ir.height * 3.5) break;

      // Label/caption stacked above the field (not a same-box pill shell).
      try {
        const kids = p.children;
        if (kids && kids.length) {
          let labelAbove = false;
          for (let i = 0; i < kids.length; i++) {
            const child = kids[i];
            if (!child || child === inputEl || child.nodeType !== 1) continue;
            if (inputEl.contains(child)) continue;
            const tag = String(child.tagName || '').toUpperCase();
            const isLabelish = tag === 'LABEL' || tag === 'SPAN' || tag === 'DIV' || tag === 'P';
            if (!isLabelish) continue;
            // Skip wrappers that themselves contain the field.
            try {
              if (typeof child.contains === 'function' && child.contains(inputEl)) continue;
            } catch { /* ignore */ }
            let cr = null;
            try { cr = child.getBoundingClientRect(); } catch { cr = null; }
            if (!cr || !(cr.height > 4) || !(cr.width > 4)) continue;
            // Distinct block above the field (practice popover labels).
            if (cr.bottom <= ir.top + 4 && cr.top < ir.top - 2) {
              labelAbove = true;
              break;
            }
          }
          if (labelAbove) break;
        }
      } catch { /* ignore */ }

      let display = '';
      try { display = String(getComputedStyle(p).display || ''); } catch { display = ''; }
      const skipDisplay = display === 'table-row' || display === 'table-row-group';

      const leftDelta = Math.abs(r.left - ir.left);
      const similarColumn = leftDelta <= 72 && r.width >= ir.width * 0.85;
      if (similarColumn && !skipDisplay && r.height >= bestH - 0.5 && r.height <= 84) {
        best = p;
        bestH = r.height;
      }
      p = p.parentElement;
    }
    return best;
  }

  /**
   * Whether `wrapper` is the same visual box as `field` (padded chrome, not a
   * card/section). Used so hover-outline suppression still applies when
   * findClickable promotes a tight input shell.
   * @param {Element} wrapper
   * @param {Element} field
   * @returns {boolean}
   */
  _isTightTextFieldWrapper(wrapper, field) {
    if (!wrapper || !field || wrapper === field) return false;
    let wr;
    let fr;
    try {
      wr = wrapper.getBoundingClientRect();
      fr = this.getBestRect(field);
    } catch {
      return false;
    }
    if (!wr || !fr || wr.width <= 0 || wr.height <= 0 || fr.width <= 0 || fr.height <= 0) {
      return false;
    }
    const maxPad = 40;
    const dx = Math.max(Math.abs(wr.left - fr.left), Math.abs(wr.right - fr.right));
    const dy = Math.max(Math.abs(wr.top - fr.top), Math.abs(wr.bottom - fr.bottom));
    return dx <= Math.max(maxPad, 72) &&
      dy <= Math.max(maxPad, 40) &&
      wr.width <= fr.width + 180 &&
      wr.height <= Math.max(fr.height + maxPad * 2, 84);
  }

  /**
   * Hover/paint target is the text-mode focused field, a child inside it
   * (contenteditable), or a tight same-box wrapper. Those already show the
   * left-edge bar (or wash); a full hover outline on the same box flickers.
   * @param {Element|null|undefined} hoverEl
   * @param {Element|null|undefined} [activeEl]
   * @returns {boolean}
   */
  _isHoverOnActiveTextField(hoverEl, activeEl = this._textFocusCurrentElement) {
    if (!hoverEl || hoverEl.nodeType !== 1) return false;
    const active = (activeEl && activeEl.nodeType === 1) ? activeEl : this._textFocusCurrentElement;
    if (!active || active.nodeType !== 1) return false;
    try {
      if (!active.isConnected) return false;
    } catch { /* ignore */ }

    if (hoverEl === active) return true;
    try {
      if (this._textFocusStyledElements && this._textFocusStyledElements.has(hoverEl)) return true;
    } catch { /* ignore */ }
    try {
      if (typeof active.contains === 'function' && active.contains(hoverEl)) return true;
    } catch { /* ignore */ }
    try {
      if (typeof hoverEl.contains === 'function' && hoverEl.contains(active)) {
        return this._isTightTextFieldWrapper(hoverEl, active);
      }
    } catch { /* ignore */ }
    return false;
  }

  /**
   * Lazy-inject KeyPilot CSS into the open ShadowRoot that owns `el` (if any).
   * No-op for light DOM. See StyleManager.ensureStylesForNode.
   * @param {Element|null|undefined} el
   */
  _ensureStylesForElement(el) {
    try {
      const sm = window.keyPilot?.styleManager;
      if (sm && typeof sm.ensureStylesForNode === 'function') {
        sm.ensureStylesForNode(el);
      }
    } catch { /* ignore */ }
  }

  _applyTextFocusElementStyling(inputEl) {
    if (!inputEl || inputEl.nodeType !== 1) {
      this._clearTextFocusElementStyling();
      return;
    }

    const { focusStyle } = this._getTextModeSettings();
    const useLeftEdge = focusStyle !== 'background_tint';
    const paintHost = useLeftEdge
      ? (this._resolveTextFocusPaintHost(inputEl) || inputEl)
      : inputEl;
    const delegated = useLeftEdge && paintHost !== inputEl;
    const hideHint = this._shouldHideTextFocusHint(inputEl);

    // Avoid thrashing the DOM on RAF-driven overlay refreshes when style is unchanged.
    if (
      this._textFocusCurrentElement === inputEl &&
      this._textFocusPaintHost === paintHost &&
      this._textFocusStyledElements.size > 0 &&
      this._textFocusAppliedStyle === focusStyle
    ) {
      try {
        inputEl.classList.add(CSS_CLASSES.TEXT_FOCUS_INPUT);
        if (useLeftEdge && !delegated) inputEl.classList.add(CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE);
        else inputEl.classList.remove(CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE);
        if (delegated) inputEl.classList.add(CSS_CLASSES.TEXT_FOCUS_DELEGATED);
        else inputEl.classList.remove(CSS_CLASSES.TEXT_FOCUS_DELEGATED);
        this._syncTextFocusHintHidden(inputEl, hideHint);
        if (delegated) {
          paintHost.classList.add(CSS_CLASSES.TEXT_FOCUS_INPUT_PARENT);
          paintHost.classList.add(CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE);
        }
      } catch { /* ignore */ }
      return;
    }

    this._clearTextFocusElementStyling();
    this._textFocusCurrentElement = inputEl;
    this._textFocusPaintHost = paintHost;
    this._textFocusAppliedStyle = focusStyle;

    try {
      this._ensureStylesForElement(inputEl);
      inputEl.classList.add(CSS_CLASSES.TEXT_FOCUS_INPUT);
      if (useLeftEdge && !delegated) inputEl.classList.add(CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE);
      if (delegated) inputEl.classList.add(CSS_CLASSES.TEXT_FOCUS_DELEGATED);
      this._syncTextFocusHintHidden(inputEl, hideHint);
      this._textFocusStyledElements.add(inputEl);
    } catch { /* ignore */ }

    if (delegated) {
      try {
        this._ensureStylesForElement(paintHost);
        paintHost.classList.add(CSS_CLASSES.TEXT_FOCUS_INPUT_PARENT);
        paintHost.classList.add(CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE);
        this._textFocusStyledElements.add(paintHost);
      } catch { /* ignore */ }
    }

    // Background-tint style can wash nearby rounded wrappers.
    if (!useLeftEdge) {
      const parents = this._getNearbyInputWrappers(inputEl);
      for (const p of parents) {
        try {
          this._ensureStylesForElement(p);
          p.classList.add(CSS_CLASSES.TEXT_FOCUS_INPUT_PARENT);
          this._textFocusStyledElements.add(p);
        } catch { /* ignore */ }
      }
    }
  }

  /**
   * SVG "press Esc to exit" needs vertical room; compact chrome fields (e.g.
   * Keyboard Layout Config) keep focus chrome without the label.
   * @param {Element} inputEl
   * @returns {boolean}
   */
  _shouldHideTextFocusHint(inputEl) {
    try {
      const rect = typeof inputEl.getBoundingClientRect === 'function'
        ? inputEl.getBoundingClientRect()
        : null;
      const h = Number(rect?.height) || 0;
      return h > 0 && h < TEXT_FOCUS_HINT_MIN_HEIGHT_PX;
    } catch {
      return false;
    }
  }

  /**
   * @param {Element} inputEl
   * @param {boolean} hide
   */
  _syncTextFocusHintHidden(inputEl, hide) {
    try {
      if (hide) inputEl.classList.add(CSS_CLASSES.TEXT_FOCUS_HINT_HIDDEN);
      else inputEl.classList.remove(CSS_CLASSES.TEXT_FOCUS_HINT_HIDDEN);
    } catch { /* ignore */ }
  }

  _clearTextHoverElementStyling() {
    if (!this._textHoverStyledElements || this._textHoverStyledElements.size === 0) {
      this._textHoverCurrentElement = null;
      return;
    }
    try {
      for (const el of this._textHoverStyledElements) {
        if (!el || el.nodeType !== 1) continue;
        try {
          el.classList.remove(CSS_CLASSES.TEXT_HOVER_INPUT);
          el.classList.remove(CSS_CLASSES.TEXT_HOVER_INPUT_PARENT);
        } catch { /* ignore */ }
      }
    } finally {
      this._textHoverStyledElements.clear();
      this._textHoverCurrentElement = null;
    }
  }

  _applyTextHoverElementStyling(inputEl) {
    if (!inputEl || inputEl.nodeType !== 1) {
      this._clearTextHoverElementStyling();
      return;
    }

    // Avoid thrashing while mouse is steady.
    if (this._textHoverCurrentElement === inputEl && this._textHoverStyledElements.size > 0) {
      try { inputEl.classList.add(CSS_CLASSES.TEXT_HOVER_INPUT); } catch { /* ignore */ }
      return;
    }

    this._clearTextHoverElementStyling();
    this._textHoverCurrentElement = inputEl;

    try {
      this._ensureStylesForElement(inputEl);
      inputEl.classList.add(CSS_CLASSES.TEXT_HOVER_INPUT);
      this._textHoverStyledElements.add(inputEl);
    } catch { /* ignore */ }

    // Hover is outline + SVG hint only — do not tint wrapper parents.
  }

  setupOverlayObserver() {
    // Observer to optimize overlay rendering when out of view
    this.overlayObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const overlay = entry.target;
          const isVisible = entry.intersectionRatio > 0;
          
          // Optimize rendering by hiding completely out-of-view overlays
          if (overlay === this.focusOverlay) {
            this.overlayVisibility.focus = isVisible;
            // Don't hide focus overlay when DOM hover colors are enabled (it should always be visible when shown)
            if (!this._useDomHoverFocusColors) {
              overlay.style.visibility = isVisible ? 'visible' : 'hidden';
            } else {
              overlay.style.visibility = 'visible';
            }
          } else if (overlay === this.inspectorOverlay || overlay === this.deleteOverlay) {
            this.overlayVisibility.delete = isVisible;
            overlay.style.visibility = isVisible ? 'visible' : 'hidden';
          } else if (overlay === this.escExitLabelText) {
            this.overlayVisibility.escExitLabel = isVisible;
            overlay.style.visibility = isVisible ? 'visible' : 'hidden';
          } else if (overlay === this.escExitLabelHover) {
            this.overlayVisibility.escExitLabel = isVisible;
            overlay.style.visibility = isVisible ? 'visible' : 'hidden';
          }
        });
      },
      {
        rootMargin: '10px',
        threshold: [0, 1.0]
      }
    );
  }

  /**
   * @param {Element|null} focusEl
   * @param {Element|null} inspectorEl shared pick target (Delete/Cols/…)
   * @param {string} mode
   * @param {Element|null} [focusedTextElement]
   * @param {DOMRect|object|null} [focusRectOverride]
   * @param {string|null} [inspectorKind] INSPECTOR_KIND when mode is inspector
   */
  updateOverlays(focusEl, inspectorEl, mode, focusedTextElement = null, focusRectOverride = null, inspectorKind = null) {
    // Debug logging when debug mode is enabled
    if (window.KEYPILOT_DEBUG && focusEl) {
      console.log('[KeyPilot Debug] Updating overlays:', {
        focusElement: focusEl.tagName,
        mode: mode,
        willShowFocus: mode === 'none' || mode === 'text_focus' || mode === 'highlight' || mode === 'popover',
        focusedTextElement: focusedTextElement?.tagName
      });
    }
    
    // Apply text-mode field chrome before hover paint so outline suppression
    // can see `_textFocusCurrentElement` (including refresh paths that call
    // updateFocusOverlay without a mode).
    if (mode === 'text_focus' && focusedTextElement) {
      this._applyTextFocusElementStyling(focusedTextElement);
    } else {
      this._clearTextFocusElementStyling();
    }

    // Show focus overlay in normal mode, text focus mode, highlight mode, AND popover mode.
    // Popovers are modal but still need the green rectangle so the user can F-click UI
    // affordances like the close (×) button.
    // Hide green focus rect while in shared inspector pick mode.
    if (mode === 'none' || mode === 'text_focus' || mode === 'highlight' || mode === 'popover') {
      this.updateFocusOverlay(focusEl, mode, focusRectOverride);
      
      if (mode === 'text_focus') {
        // Labels are attached to the focused text field, not the hovered element.
        if (focusedTextElement) this.updateTextModeLabels(focusedTextElement);
        else this.hideTextModeLabels();
      } else {
        this.hideTextModeLabels();
      }
    } else {
      this.hideFocusOverlay();
    }

    // If there's no focus target at all, ensure we remove any hover tint.
    if (!focusEl) {
      this._clearTextHoverElementStyling();
    }

    // Show viewport modal frame when in text focus mode (controlled by flag)
    this.updateViewportModalFrame(mode === 'text_focus' && FEATURE_FLAGS.SHOW_WINDOW_OUTLINE);
    
    // Shared inspector pick overlay (Delete, Cols, future kinds)
    const inInspector = mode === MODES.INSPECTOR || mode === 'delete' || mode === 'cols';
    if (inInspector) {
      const kind = inspectorKind
        || (mode === 'delete' ? 'delete' : mode === 'cols' ? 'cols' : null);
      this.updateInspectorOverlay(inspectorEl, kind);
      // Keep top-right instruction visible while pick is active
      this.showInspectorModeIndicator({ kind });
    } else {
      this.hideInspectorOverlay();
      this.hideInspectorModeIndicator();
      this.clearInspectorPickedOverlays();
    }
    
    // Show highlight chrome in highlight mode (instruction + optional focus ring)
    if (mode === 'highlight') {
      this.highlightManager.updateHighlightOverlay(focusEl);
      // finishKey is set explicitly in startHighlighting; keep indicator visible here
      this.highlightManager.showHighlightModeIndicator();
    } else {
      this.highlightManager.hideHighlightOverlay();
      this.highlightManager.hideHighlightModeIndicator();
      // Leaving highlight: drop any leftover dashed guide (cancel also clears this)
      this.highlightManager.hideHighlightRectangleOverlay();
    }
  }

  // Unified interface that switches between rendering modes
  updateFocusOverlay(element, mode = MODES.NONE, rectOverride = null) {
    // Remember target for activation pulse (F-click), independent of render backend.
    try {
      this._lastFocusElement = element || null;
      if (element) {
        const r = (rectOverride && typeof rectOverride === 'object')
          ? rectOverride
          : this.getBestRect(element);
        this._lastFocusRect = r && r.width > 0 && r.height > 0
          ? { left: r.left, top: r.top, width: r.width, height: r.height }
          : null;
      } else {
        this._lastFocusRect = null;
      }
    } catch {
      this._lastFocusElement = element || null;
      this._lastFocusRect = null;
    }

    // Text mode: the focused field already has a left-edge bar (or wash).
    // Skip the full hover outline / hover hint on that same box (flicker).
    if (this._isHoverOnActiveTextField(element)) {
      try { this._clearTextHoverElementStyling(); } catch { /* ignore */ }
      this.hideFocusOverlay();
      return;
    }

    // Text inputs: show orange outline AND paint the SVG "Press F to select…" hint.
    // (Do not return early — fall through so the focus rectangle still draws.)
    try {
      const isTextInput = element && element.matches && element.matches(SELECTORS.FOCUSABLE_TEXT);
      if (isTextInput) {
        this._applyTextHoverElementStyling(element);
      } else {
        // Non-text elements: ensure we remove any lingering hover hint styling.
        this._clearTextHoverElementStyling();
      }
    } catch {
      try { this._clearTextHoverElementStyling(); } catch { /* ignore */ }
    }

    // DOM-hover paint preference (see focus-ring-paint.md):
    //   A = DOM outline; B = in-target ring (maxZ+1); C = body fixed overlay.
    if (this._useDomHoverFocusColors) {
      try { this.hideFocusOverlayCanvas(); } catch { /* ignore */ }
      try { this.hideFocusOverlayCSSCustomProps(); } catch { /* ignore */ }

      if (!element) {
        this._focusPaintUsesFixedOverlay = false;
        this._focusPaintUsesInTargetRing = false;
        try { this.clearElementFocusStyling(); } catch { /* ignore */ }
        try { this.hideInTargetFocusRing(); } catch { /* ignore */ }
        try { this.hideFocusOverlayDOM(); } catch { /* ignore */ }
        try {
          this._updateShadowRootDebugHud(null, null, {
            inShadow: false,
            autoStrategy: '—',
            appliedStrategy: '—',
            override: this._shadowDebugPaintOverride
          });
        } catch { /* ignore */ }
        return;
      }

      // Resolve paint node once (pierces open shadow for collapsed hosts).
      // Text fields / image+text cards / focus-styling — shared with F-click flash.
      let paintEl = this._resolveFocusPaintElement(element) || element;
      let cardShell = null;
      try { cardShell = this._resolveMediaTextCardShell(element); } catch { cardShell = null; }

      // Auto strategy (see focus-ring-paint.md):
      //   Light DOM: A → B → C (escape hatch only when A cannot show).
      //   Shadow targets (in a ShadowRoot, or open-shadow host): skip A,
      //   default B (in-target), else C — except open-shadow text fields, which
      //   prefer A once styles are injected (inputs cannot host B; parents often
      //   include labels → taller blue ring). Debug HUD can still force A/B/C.
      let inShadow = false;
      try { inShadow = this._isInShadowTree(element); } catch { inShadow = false; }
      let isShadowHost = false;
      try { isShadowHost = !!this._getOpenShadowRoot(element); } catch { isShadowHost = false; }
      const shadowPaint = inShadow || isShadowHost;

      let isTextInputFocus = false;
      try {
        isTextInputFocus = !!(element.matches && element.matches(SELECTORS.FOCUSABLE_TEXT));
      } catch { isTextInputFocus = false; }

      let needsEscapeHatch = false;
      try {
        needsEscapeHatch = !!cardShell || this._shouldUseFixedFocusOverlay(element);
      } catch {
        needsEscapeHatch = !!cardShell;
      }

      let autoStrategy = 'A';
      if (shadowPaint || needsEscapeHatch) {
        let preferShadowTextA = false;
        if (isTextInputFocus && inShadow && !isShadowHost) {
          try {
            // Lazy-inject KP CSS into this open root so outline vars apply.
            preferShadowTextA = this._ensureStylesForElement(element) !== false;
          } catch { preferShadowTextA = false; }
        }
        if (preferShadowTextA) {
          autoStrategy = 'A';
        } else {
          let canB = false;
          try {
            canB = !!(FEATURE_FLAGS && FEATURE_FLAGS.ENABLE_IN_TARGET_FOCUS_RING) &&
              !!this._resolveInTargetHost(element);
          } catch { canB = false; }
          autoStrategy = canB ? 'B' : 'C';
        }
      }

      // Debug HUD can force A / B / C regardless of auto (for shadow experiments).
      const override = this._shadowDebugHudEnabled
        ? this._shadowDebugPaintOverride
        : null;
      const strategy = (override === 'A' || override === 'B' || override === 'C')
        ? override
        : autoStrategy;

      try {
        this._updateShadowRootDebugHud(element, paintEl, {
          inShadow,
          autoStrategy,
          appliedStrategy: strategy,
          override
        });
      } catch { /* ignore */ }

      if (strategy === 'A') {
        this._focusPaintUsesFixedOverlay = false;
        this._focusPaintUsesInTargetRing = false;
        try { this.hideInTargetFocusRing(); } catch { /* ignore */ }
        try { this.hideFocusOverlayDOM(); } catch { /* ignore */ }
        return this.updateFocusOverlayElementStyling(element, mode);
      }

      try { this.clearElementFocusStyling(); } catch { /* ignore */ }

      if (strategy === 'B') {
        let usedInTarget = false;
        try {
          usedInTarget = this.updateFocusOverlayInTarget(element, mode);
        } catch {
          usedInTarget = false;
        }
        if (usedInTarget) {
          this._focusPaintUsesInTargetRing = true;
          this._focusPaintUsesFixedOverlay = false;
          try { this.hideFocusOverlayDOM(); } catch { /* ignore */ }
          try {
            this._updateShadowRootDebugHud(element, paintEl, {
              inShadow,
              autoStrategy,
              appliedStrategy: 'B',
              override
            });
          } catch { /* ignore */ }
          return;
        }
        // B failed to mount — fall through to C.
      }

      // Strategy C: body fixed overlay.
      this._focusPaintUsesInTargetRing = false;
      try { this.hideInTargetFocusRing(); } catch { /* ignore */ }
      this._focusPaintUsesFixedOverlay = true;
      // Geometry from paintEl; keep semantic focusEl for orange text-field color
      // when paint was lifted to a wrapper.
      const paintForC = rectOverride ? element : paintEl;
      const cResult = this.updateFocusOverlayDOM(paintForC, mode, rectOverride, {
        colorFrom: element
      });
      try {
        this._updateShadowRootDebugHud(element, paintEl, {
          inShadow,
          autoStrategy,
          appliedStrategy: 'C',
          override
        });
      } catch { /* ignore */ }
      return cResult;
    }

    switch (this.renderingMode) {
      case 'canvas':
        return this.updateFocusOverlayCanvas(element, mode, rectOverride);
      case 'css-custom-props':
        return this.updateFocusOverlayCSSCustomProps(element, mode, rectOverride);
      case 'dom':
      default:
        return this.updateFocusOverlayDOM(element, mode, rectOverride);
    }
  }

  _installFocusClipCacheInvalidation() {
    if (this._focusClipInvalidateBound) return;
    this._focusClipInvalidateBound = () => {
      try {
        // WeakMap cannot be cleared; replace instance so entries are GC'd with elements.
        this._focusClipContextCache = new WeakMap();
      } catch { /* ignore */ }
    };
    try {
      window.addEventListener('resize', this._focusClipInvalidateBound, { passive: true });
    } catch { /* ignore */ }
    try {
      document.addEventListener('keypilot:scroll-end', this._focusClipInvalidateBound, { passive: true });
    } catch { /* ignore */ }
  }

  /**
   * Intersect two viewport boxes. Returns null when the result is empty.
   * @param {{ left: number, top: number, width: number, height: number }} a
   * @param {{ left: number, top: number, width: number, height: number }} b
   * @returns {{ left: number, top: number, width: number, height: number }|null}
   */
  _intersectViewportRects(a, b) {
    if (!a || !b) return null;
    const left = Math.max(a.left, b.left);
    const top = Math.max(a.top, b.top);
    const right = Math.min(a.left + a.width, b.left + b.width);
    const bottom = Math.min(a.top + a.height, b.top + b.height);
    const width = right - left;
    const height = bottom - top;
    if (!(width > 0.5) || !(height > 0.5)) return null;
    return { left, top, width, height };
  }

  /**
   * Shrink a strategy-C / flash viewport box to the portion still visible after
   * ancestor overflow / paint-containment clipping (and the viewport itself).
   *
   * `getBoundingClientRect()` ignores overflow clips, so a body-fixed overlay
   * sized to the raw box paints into scrolled-away / overflow:hidden regions.
   * Intersecting with every clipping ancestor matches what the user can see.
   *
   * @param {Element|null|undefined} element - paint target (for ancestor walk)
   * @param {{ left?: number, top?: number, width?: number, height?: number }|null|undefined} rect
   * @returns {{ left: number, top: number, width: number, height: number }|null}
   */
  _clipViewportRectToVisible(element, rect) {
    let out = this._asPositiveViewportRect(rect);
    if (!out) return null;

    // Viewport edges (off-screen parts of a tall card, etc.).
    try {
      const vw = Number(window.innerWidth) || 0;
      const vh = Number(window.innerHeight) || 0;
      if (vw > 0 && vh > 0) {
        out = this._intersectViewportRects(out, { left: 0, top: 0, width: vw, height: vh });
        if (!out) return null;
      }
    } catch { /* ignore */ }

    if (!element || element.nodeType !== 1) return out;

    const intersectNode = (n) => {
      if (!n || n.nodeType !== 1) return true;
      let ar = null;
      try { ar = n.getBoundingClientRect(); } catch { ar = null; }
      const cr = this._asPositiveViewportRect(ar);
      if (!cr) return true;
      out = this._intersectViewportRects(out, cr);
      return !!out;
    };

    try {
      let n = this._composedParent(element);
      let depth = 0;
      while (n && n.nodeType === 1 && depth++ < 24) {
        if (n === document.documentElement || n === document.body) {
          n = this._composedParent(n);
          continue;
        }

        let cs = null;
        try { cs = window.getComputedStyle(n); } catch { cs = null; }

        let cvClip = false;
        try {
          const cv = cs?.contentVisibility || cs?.getPropertyValue?.('content-visibility');
          cvClip = cv === 'auto' || cv === 'hidden';
        } catch { /* ignore */ }

        if (this._styleClipsSelf(cs) || cvClip) {
          if (!intersectNode(n)) return null;
        }

        // Slotted content is clipped by shadow-internal wrappers the host style
        // does not reveal (msn.com div.root { overflow/contain }).
        try {
          const sr = this._getOpenShadowRoot(n);
          const kids = sr && sr.children;
          if (kids) {
            for (let i = 0; i < kids.length && i < 6; i++) {
              const w = kids[i];
              if (!w || w.nodeType !== 1) continue;
              if ((w.tagName || '').toUpperCase() === 'STYLE') continue;
              let wcs = null;
              try { wcs = window.getComputedStyle(w); } catch { wcs = null; }
              if (!this._styleClipsSelf(wcs)) continue;
              if (!intersectNode(w)) return null;
            }
          }
        } catch { /* ignore */ }

        n = this._composedParent(n);
      }
    } catch { /* keep current out */ }

    return out;
  }

  /**
   * Find ancestors that would clip an outer focus ring around `element`.
   *
   * Used only when FEATURE_FLAGS.ENABLE_FOCUS_CLIP_INSET and/or
   * ENABLE_FOCUS_TIGHT_WRAPPER_PROMOTION are on (see constants.js for tentative
   * purpose). Never opens page overflow — that broke carousels (IMDb).
   *
   * Results are cached briefly (WeakMap + TTL + geometry fingerprint) so hover
   * thrash does not re-walk getComputedStyle ancestors every paint.
   *
   * @param {Element} element
   * @returns {{
   *   clippers: Element[],
   *   tightWrapper: Element|null
   * }}
   *   clippers — ancestors that would clip a positive outline-offset ring
   *   tightWrapper — nearest clipper nearly the same size as the target
   */
  _findFocusClipContext(element) {
    /** @type {Element[]} */
    const emptyClippers = [];
    /** @type {Element|null} */
    const emptyTight = null;

    if (!element || element.nodeType !== 1) {
      return { clippers: emptyClippers, tightWrapper: emptyTight };
    }

    let er;
    try {
      er = element.getBoundingClientRect();
    } catch {
      return { clippers: emptyClippers, tightWrapper: emptyTight };
    }
    if (!er || !(er.width > 0) || !(er.height > 0)) {
      return { clippers: emptyClippers, tightWrapper: emptyTight };
    }

    // Cache hit: same element, recent, geometry nearly unchanged.
    try {
      const cached = this._focusClipContextCache?.get?.(element);
      if (cached) {
        const age = Date.now() - (cached.ts || 0);
        const geoClose =
          Math.abs(cached.left - er.left) < 1 &&
          Math.abs(cached.top - er.top) < 1 &&
          Math.abs(cached.width - er.width) < 1 &&
          Math.abs(cached.height - er.height) < 1;
        if (age < (this._focusClipContextTtlMs || 500) && geoClose) {
          return { clippers: cached.clippers, tightWrapper: cached.tightWrapper };
        }
      }
    } catch { /* ignore */ }

    /** @type {Element[]} */
    const clippers = [];
    /** @type {Element|null} */
    let tightWrapper = null;

    // Outer ring needs a little space outside the border box.
    const pad = 8;
    const needLeft = er.left - pad;
    const needTop = er.top - pad;
    const needRight = er.right + pad;
    const needBottom = er.bottom + pad;

    // Walk composed ancestors (parentElement + open shadow host hops).
    // archive.org nests clickables inside media-button → … → NAV[overflow:hidden];
    // a parentElement-only walk stops at the shadow root and misses clippers.
    try {
      let n = this._composedParent(element);
      let depth = 0;
      // Nested open shadows (archive.org tiles/nav) often need more than 12 hops.
      while (n && n.nodeType === 1 && depth++ < 24) {
        if (n === document.documentElement || n === document.body) {
          n = this._composedParent(n);
          continue;
        }

        const cs = window.getComputedStyle(n);
        if (!cs) {
          n = this._composedParent(n);
          continue;
        }

        const ox = cs.overflowX;
        const oy = cs.overflowY;
        const clipsOverflow =
          (ox && ox !== 'visible') || (oy && oy !== 'visible');

        let cvClip = false;
        try {
          const cv = cs.contentVisibility || cs.getPropertyValue('content-visibility');
          cvClip = cv === 'auto' || cv === 'hidden';
        } catch { /* ignore */ }

        let containClip = false;
        try {
          const contain = String(cs.contain || '');
          containClip =
            contain.includes('paint') ||
            contain.includes('strict') ||
            contain === 'content' ||
            contain.split(/\s+/).includes('content');
        } catch { /* ignore */ }

        if (clipsOverflow || cvClip || containClip) {
          let ar;
          try {
            ar = n.getBoundingClientRect();
          } catch {
            clippers.push(n);
            n = this._composedParent(n);
            continue;
          }

          const clipsRing =
            ar.left > needLeft + 0.5 ||
            ar.top > needTop + 0.5 ||
            ar.right < needRight - 0.5 ||
            ar.bottom < needBottom - 0.5;

          const similarSize =
            Math.abs(ar.width - er.width) < 20 &&
            Math.abs(ar.height - er.height) < 20;

          if (clipsRing || (cvClip && similarSize)) {
            clippers.push(n);
            if (!tightWrapper && similarSize) {
              tightWrapper = n;
            }
          }
        }

        // Slotted shadow hosts (msn.com `cs-responsive-card`: shadow is just
        // `div.root > slot`) clip via an *internal* wrapper, not the host's own
        // light-DOM-facing style — getComputedStyle(n) above never sees it.
        // Check the shadow root's own top-level children too.
        try {
          const extra = this._shadowInternalClipWrappers(n, er, needLeft, needTop, needRight, needBottom);
          for (let wi = 0; wi < extra.clippers.length; wi++) {
            clippers.push(extra.clippers[wi]);
          }
          if (!tightWrapper && extra.tightWrapper) {
            tightWrapper = extra.tightWrapper;
          }
        } catch { /* ignore */ }

        n = this._composedParent(n);
      }
    } catch { /* ignore */ }

    try {
      this._focusClipContextCache?.set?.(element, {
        clippers,
        tightWrapper,
        ts: Date.now(),
        left: er.left,
        top: er.top,
        width: er.width,
        height: er.height
      });
    } catch { /* ignore */ }

    return { clippers, tightWrapper };
  }

  /**
   * True when an ancestor is likely to clip *outer* focus chrome.
   * @param {Element} element
   * @returns {boolean}
   */
  _isProbablyClippedByAncestorOverflow(element) {
    try {
      const ctx = this._findFocusClipContext(element);
      return !!(ctx.clippers && ctx.clippers.length);
    } catch {
      return false;
    }
  }

  /**
   * Rect-based check: would a positive outline-offset ring around the hover
   * target be clipped (or sit flush with zero room) inside a clipping parent?
   *
   * Compares `getBoundingClientRect()` of the paint target to each overflow/
   * contain clip ancestor. If the target box is inset-or-flush with a clipper
   * such that outline-offset > 0 has nowhere to paint, return true.
   *
   * This alone does **not** mean we should use a fixed overlay — inset element
   * outlines often still work (control strip segments, toolbar buttons).
   * See `_shouldUseFixedFocusOverlay`.
   *
   * @param {Element} element - hover focus target (clickable)
   * @returns {boolean}
   */
  _outerFocusRingWouldBeClipped(element) {
    if (!element || element.nodeType !== 1) return false;

    let paintEl = element;
    try {
      paintEl = this._resolveElementForFocusStyling(element) || element;
    } catch {
      paintEl = element;
    }

    let er = null;
    try {
      er = paintEl.getBoundingClientRect();
    } catch {
      return false;
    }
    if (!er || !(er.width > 0) || !(er.height > 0)) return false;

    // How much room we need outside the border box for a visible outer ring.
    // Matches _findFocusClipContext pad; outline-offset is typically 2px plus
    // a few px of border thickness from settings.
    const pad = 8;

    let ctx = { clippers: [], tightWrapper: null };
    try {
      ctx = this._findFocusClipContext(paintEl);
    } catch {
      ctx = { clippers: [], tightWrapper: null };
    }

    const clippers = (ctx && ctx.clippers) || [];
    if (!clippers.length) return false;

    // Ancestor rect check: any clipper whose box does not fully contain
    // (target ± pad) means the outer ring would be cut off.
    for (let i = 0; i < clippers.length; i++) {
      const c = clippers[i];
      if (!c || c.nodeType !== 1) continue;
      let ar = null;
      try { ar = c.getBoundingClientRect(); } catch { ar = null; }
      if (!ar) continue;

      const roomLeft = er.left - ar.left;
      const roomTop = er.top - ar.top;
      const roomRight = ar.right - er.right;
      const roomBottom = ar.bottom - er.bottom;

      // Flush or inset (room < pad on any side) → outer outline clipped.
      if (
        roomLeft < pad - 0.5 ||
        roomTop < pad - 0.5 ||
        roomRight < pad - 0.5 ||
        roomBottom < pad - 0.5
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * True when computed overflow would clip descendants / outer decorations.
   * @param {CSSStyleDeclaration|null|undefined} cs
   * @returns {boolean}
   */
  _styleClipsOverflow(cs) {
    return !!(cs && (
      (cs.overflow && cs.overflow !== 'visible') ||
      (cs.overflowX && cs.overflowX !== 'visible') ||
      (cs.overflowY && cs.overflowY !== 'visible')
    ));
  }

  /**
   * True when CSS containment clips paint/ink (including outer outlines) to the
   * padding edge. `contain: content` implies paint containment — common on
   * msn.com card shells (`div.root { contain: content }`).
   * @param {CSSStyleDeclaration|null|undefined} cs
   * @returns {boolean}
   */
  _styleClipsPaintContain(cs) {
    if (!cs) return false;
    try {
      const contain = String(cs.contain || '');
      if (!contain || contain === 'none') return false;
      return (
        contain.includes('paint') ||
        contain.includes('strict') ||
        contain === 'content' ||
        contain.split(/\s+/).includes('content')
      );
    } catch {
      return false;
    }
  }

  /**
   * Overflow or paint-containment clip (self / wrapper).
   * @param {CSSStyleDeclaration|null|undefined} cs
   * @returns {boolean}
   */
  _styleClipsSelf(cs) {
    return this._styleClipsOverflow(cs) || this._styleClipsPaintContain(cs);
  }

  /**
   * Parent across open shadow boundaries (parentElement, else ShadowRoot.host).
   * @param {Node|null|undefined} node
   * @returns {Element|null}
   */
  _composedParent(node) {
    if (!node || node.nodeType !== 1) return null;
    if (node.parentElement) return node.parentElement;
    try {
      const root = typeof node.getRootNode === 'function' ? node.getRootNode() : null;
      if (root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
        return root.host || null;
      }
    } catch { /* ignore */ }
    return null;
  }

  /**
   * Detect clip ancestors hiding *inside* an open shadow host's own root —
   * e.g. msn.com `cs-responsive-card` shadow is `div.root{overflow:hidden} > slot`.
   * The slotted (light-DOM) content is a child of the *host* in the light tree,
   * so `getComputedStyle(host)` never sees the wrapper's `overflow`/`contain`,
   * even though it visually clips the slotted content in the composed tree.
   *
   * Only checks the shadow root's direct children (the common single-wrapper
   * pattern) — not a full recursive walk — to stay cheap on hover.
   *
   * @param {Element} host - composed ancestor being visited by _findFocusClipContext
   * @param {DOMRect} er - target element's rect
   * @param {number} needLeft
   * @param {number} needTop
   * @param {number} needRight
   * @param {number} needBottom
   * @returns {{ clippers: Element[], tightWrapper: Element|null }}
   */
  _shadowInternalClipWrappers(host, er, needLeft, needTop, needRight, needBottom) {
    const clippers = [];
    let tightWrapper = null;
    const sr = this._getOpenShadowRoot(host);
    if (!sr) return { clippers, tightWrapper };

    let kids;
    try {
      kids = sr.children;
    } catch {
      return { clippers, tightWrapper };
    }
    if (!kids) return { clippers, tightWrapper };

    for (let i = 0; i < kids.length && i < 6; i++) {
      const w = kids[i];
      if (!w || w.nodeType !== 1) continue;
      if ((w.tagName || '').toUpperCase() === 'STYLE') continue;

      let wcs = null;
      try { wcs = window.getComputedStyle(w); } catch { wcs = null; }
      // Overflow *or* paint containment (msn.com `div.root { contain: content }`).
      if (!this._styleClipsSelf(wcs)) continue;

      let war = null;
      try { war = w.getBoundingClientRect(); } catch { war = null; }
      if (!war) continue;

      const clipsRing =
        war.left > needLeft + 0.5 ||
        war.top > needTop + 0.5 ||
        war.right < needRight - 0.5 ||
        war.bottom < needBottom - 0.5;
      const similarSize =
        Math.abs(war.width - er.width) < 20 &&
        Math.abs(war.height - er.height) < 20;

      if (clipsRing) {
        clippers.push(w);
        if (!tightWrapper && similarSize) tightWrapper = w;
      }
    }

    return { clippers, tightWrapper };
  }

  /**
   * True when `el` is itself an open-shadow host whose top-level shadow
   * wrapper clips (`overflow`/`contain`), even though `el`'s own light-DOM-
   * facing computed style does not. Boolean sibling of
   * `_shadowInternalClipWrappers` for callers that only need presence, not
   * outline-room rect math (e.g. `_shouldUseFixedFocusOverlay`'s selfClips).
   * @param {Element} el
   * @returns {boolean}
   */
  _hostClipsViaInternalShadowWrapper(el) {
    const sr = this._getOpenShadowRoot(el);
    if (!sr) return false;
    let kids;
    try {
      kids = sr.children;
    } catch {
      return false;
    }
    if (!kids) return false;
    for (let i = 0; i < kids.length && i < 6; i++) {
      const w = kids[i];
      if (!w || w.nodeType !== 1) continue;
      if ((w.tagName || '').toUpperCase() === 'STYLE') continue;
      let wcs = null;
      try { wcs = window.getComputedStyle(w); } catch { wcs = null; }
      if (this._styleClipsSelf(wcs)) return true;
    }
    return false;
  }

  /**
   * True when `el` lives under a ShadowRoot (open or closed).
   * @param {Node|null|undefined} el
   * @returns {boolean}
   */
  _isInShadowTree(el) {
    if (!el || typeof el.getRootNode !== 'function') return false;
    try {
      const root = el.getRootNode();
      return !!(typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot);
    } catch {
      return false;
    }
  }

  /**
   * Open shadow root on `el`, if any.
   * @param {Element|null|undefined} el
   * @returns {ShadowRoot|null}
   */
  _getOpenShadowRoot(el) {
    if (!el || el.nodeType !== 1) return null;
    try {
      return el.shadowRoot || null;
    } catch {
      return null;
    }
  }

  /**
   * True when an open shadow has a default (unnamed) slot that can project
   * light-DOM children. Slotless Lit hosts (archive.org media-button /
   * collection-tile) render light children with 0×0 — strategy B must not
   * mount there.
   * @param {ShadowRoot|null|undefined} shadowRoot
   * @returns {boolean}
   */
  _shadowHasDefaultSlot(shadowRoot) {
    if (!shadowRoot || typeof shadowRoot.querySelectorAll !== 'function') return false;
    try {
      const slots = shadowRoot.querySelectorAll('slot');
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (!slot) continue;
        const name = (slot.getAttribute && slot.getAttribute('name')) || '';
        if (!name) return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  /**
   * True when appending a child to `host` will participate in layout/paint.
   * Light DOM elements: yes. Open shadow hosts: only with a default slot.
   * @param {Element|null|undefined} host
   * @returns {boolean}
   */
  _canMountVisibleChildOnHost(host) {
    if (!host || host.nodeType !== 1) return false;
    if (this._isReplacedOrVoidElement(host)) return false;
    if (typeof host.appendChild !== 'function') return false;
    const sr = this._getOpenShadowRoot(host);
    if (!sr) return true;
    return this._shadowHasDefaultSlot(sr);
  }

  /**
   * Push light children and (for open shadow hosts) top-level shadow children
   * onto `queue`, skipping KeyPilot injected style nodes.
   * @param {Element} el
   * @param {Element[]} queue
   */
  _enqueueShadowPiercingChildren(el, queue) {
    if (!el || el.nodeType !== 1 || !queue) return;
    try {
      const kids = el.children;
      if (kids) {
        for (let i = 0; i < kids.length; i++) {
          if (kids[i]?.nodeType === 1) queue.push(kids[i]);
        }
      }
    } catch { /* ignore */ }

    const sr = this._getOpenShadowRoot(el);
    if (!sr) return;
    try {
      const skids = sr.children;
      if (!skids) return;
      for (let i = 0; i < skids.length; i++) {
        const k = skids[i];
        if (!k || k.nodeType !== 1) continue;
        try {
          if (k.id === 'keypilot-shadow-styles' || k.id === 'kp-probe-style') continue;
          if ((k.tagName || '').toUpperCase() === 'STYLE' &&
              typeof k.id === 'string' && k.id.startsWith('keypilot')) {
            continue;
          }
        } catch { /* ignore */ }
        queue.push(k);
      }
    } catch { /* ignore */ }
  }

  /**
   * Inside an open-shadow host, find a non-replaced element that can hold the
   * in-target ring (strategy B). Prefers the largest visible box.
   * @param {Element} host
   * @returns {Element|null}
   */
  _findInShadowInTargetMount(host) {
    const sr = this._getOpenShadowRoot(host);
    if (!sr) return null;

    let best = null;
    let bestArea = 0;
    let visited = 0;
    const maxNodes = 48;
    /** @type {Element[]} */
    const queue = [];
    this._enqueueShadowPiercingChildren(host, queue);

    while (queue.length && visited < maxNodes) {
      const cur = queue.shift();
      if (!cur || cur.nodeType !== 1) continue;
      visited++;

      if (!this._isReplacedOrVoidElement(cur) && this._canMountVisibleChildOnHost(cur)) {
        let r = null;
        try { r = cur.getBoundingClientRect(); } catch { r = null; }
        if (r && r.width >= 8 && r.height >= 8) {
          const area = r.width * r.height;
          if (area > bestArea) {
            bestArea = area;
            best = cur;
          }
        }
      }

      this._enqueueShadowPiercingChildren(cur, queue);
    }

    return best;
  }

  /**
   * Preferred outer outline-offset (px) when clip ancestors leave enough room.
   * Matches the historical path-A default.
   */
  _preferredFocusOutlineOffsetPx() {
    return 2;
  }

  /**
   * Absolute/fixed hit-link flush inside an overflow-hidden thumb frame
   * (Rumble `a.videostream__link` in `.thumbnail__thumb--live`). Graded inset
   * on the link sits under the frame's border (e.g. live red 2px). Paint the
   * frame instead so path A can use a normal outer outline around it.
   * @param {Element|null|undefined} el
   * @returns {Element|null}
   */
  _resolveAbsoluteClipFramePaintHost(el) {
    if (!el || el.nodeType !== 1) return null;

    let pos = '';
    try {
      pos = String(window.getComputedStyle(el).position || '');
    } catch {
      return null;
    }
    if (pos !== 'absolute' && pos !== 'fixed') return null;

    let ir = null;
    try { ir = el.getBoundingClientRect(); } catch { ir = null; }
    if (!ir || ir.width < 16 || ir.height < 16) return null;

    let p = null;
    try { p = this._composedParent(el); } catch { p = el.parentElement; }
    let depth = 0;
    while (p && p.nodeType === 1 && depth++ < 3) {
      if (p === document.body || p === document.documentElement) break;

      let cs = null;
      try { cs = window.getComputedStyle(p); } catch { cs = null; }
      if (!cs || !this._styleClipsSelf(cs)) {
        try { p = this._composedParent(p); } catch { p = p.parentElement; }
        continue;
      }

      let pr = null;
      try { pr = p.getBoundingClientRect(); } catch { pr = null; }
      if (!pr || pr.width < 16 || pr.height < 16) {
        try { p = this._composedParent(p); } catch { p = p.parentElement; }
        continue;
      }

      // Frame only modestly larger than the fill-link (border / padding).
      if (pr.width > ir.width + 24 || pr.height > ir.height + 24) break;
      if (pr.width + 2 < ir.width || pr.height + 2 < ir.height) {
        try { p = this._composedParent(p); } catch { p = p.parentElement; }
        continue;
      }

      return p;
    }
    return null;
  }

  /**
   * Minimum free space outside the border box across clipping ancestors.
   * Infinity when there are no clippers (outer ring unconstrained).
   *
   * @param {Element} paintEl
   * @returns {number}
   */
  _minFocusOutlineRoomPx(paintEl) {
    if (!paintEl || paintEl.nodeType !== 1) return Infinity;

    let er = null;
    try {
      er = paintEl.getBoundingClientRect();
    } catch {
      return Infinity;
    }
    if (!er || !(er.width > 0) || !(er.height > 0)) return Infinity;

    let clippers = [];
    try {
      const ctx = this._findFocusClipContext(paintEl);
      clippers = (ctx && ctx.clippers) || [];
    } catch {
      clippers = [];
    }
    let minRoom = Infinity;
    // Viewport is a clip edge (flush top nav chips sit at y≈0).
    try {
      const vw = window.innerWidth || 0;
      const vh = window.innerHeight || 0;
      if (vw > 0 && vh > 0) {
        minRoom = Math.min(er.left, er.top, vw - er.right, vh - er.bottom);
      }
    } catch { /* ignore */ }

    if (!clippers.length) {
      return Number.isFinite(minRoom) ? minRoom : Infinity;
    }
    for (let i = 0; i < clippers.length; i++) {
      const c = clippers[i];
      if (!c || c.nodeType !== 1) continue;
      let ar = null;
      try { ar = c.getBoundingClientRect(); } catch { ar = null; }
      if (!ar) continue;
      const roomLeft = er.left - ar.left;
      const roomTop = er.top - ar.top;
      const roomRight = ar.right - er.right;
      const roomBottom = ar.bottom - er.bottom;
      minRoom = Math.min(minRoom, roomLeft, roomTop, roomRight, roomBottom);
    }
    return Number.isFinite(minRoom) ? minRoom : Infinity;
  }

  /**
   * Graded outline-offset (px) for path A.
   *
   * Outer ring needs roughly (offset + stroke) outside the border box.
   * Given free room R outside the box to the nearest clip edge:
   *   offset = clamp(R - stroke, -stroke, preferredOuter)
   *
   * Examples (stroke 3, preferred outer 2):
   *   R ≥ 5  → +2 (full outer)
   *   R = 4  → +1
   *   R = 1  → -2 (mild inset; 1px bleed does not force full -3)
   *   R ≤ 0  → -3 (full inset)
   *
   * @param {Element} paintEl
   * @param {number} [ringWidthPx]
   * @returns {number}
   */
  _computeGradedFocusOutlineOffset(paintEl, ringWidthPx = 3) {
    const preferred = this._preferredFocusOutlineOffsetPx();
    const stroke = Math.min(Math.max(Number(ringWidthPx) || 3, 1), 16);

    if (!(FEATURE_FLAGS && FEATURE_FLAGS.ENABLE_FOCUS_CLIP_INSET)) {
      return preferred;
    }
    if (!paintEl || paintEl.nodeType !== 1) return preferred;

    const room = this._minFocusOutlineRoomPx(paintEl);
    if (!Number.isFinite(room) || room === Infinity) {
      return preferred;
    }

    // Subpixel slack so 0.4px room does not look like free outer space.
    const available = room - 0.5;
    let offset = available - stroke;
    if (offset > preferred) offset = preferred;
    if (offset < -stroke) offset = -stroke;

    // Snap near-integers for stable CSS (avoid 1.999999px thrash).
    const rounded = Math.round(offset * 100) / 100;
    return rounded;
  }

  /**
   * True when graded path-A offset paints **inside** the border box (negative
   * offset). Outer/zero offset is not covered by full-bleed children; negative
   * inset can be. Used to gate escape hatch B/C.
   *
   * @param {Element} paintEl
   * @param {number} [ringWidthPx]
   * @returns {boolean}
   */
  _wouldUseInsetFocusOutline(paintEl, ringWidthPx) {
    if (!paintEl || paintEl.nodeType !== 1) return false;
    if (!(FEATURE_FLAGS && FEATURE_FLAGS.ENABLE_FOCUS_CLIP_INSET)) {
      return false;
    }
    let stroke = ringWidthPx;
    if (stroke == null || !Number.isFinite(Number(stroke))) {
      try {
        stroke = this._getClickModeSettings().rectangleThickness;
      } catch {
        stroke = 3;
      }
    }
    const offset = this._computeGradedFocusOutlineOffset(paintEl, stroke);
    return offset < -0.25;
  }

  /**
   * True when **element-level** focus paint (strategy A) cannot show a visible
   * ring, so we must use an escape hatch (strategy B in-target, else C body fixed).
   *
   * Policy (outline-first = A preferred):
   * - Outer outline clipped by a parent alone, target still fully inside the
   *   clipper (room ≥ 0) → **graded element inset** on A (ENABLE_FOCUS_CLIP_INSET).
   *   Example: control-strip buttons inside `overflow:hidden` shells. Body fixed
   *   (C) would also sit under high z-index KP chrome and stay invisible.
   * - Target **overflows** a clipping ancestor (negative free room, e.g. Ars
   *   headline with `-mt-1` above `overflow-hidden` card shell) → graded inset
   *   cannot expose that edge; use B/C.
   * - Target clips itself **and** is covered by full-bleed media/pseudos →
   *   inset outline is under the cover; use B/C (TNW cards, etc.).
   * - Same when cover is only an **edge media strip** (msn.com card image on the
   *   top half): inset outline shows on the text half and vanishes under media.
   * - Target does not clip, but a full-size child stacking surface would cover
   *   an **inset** outline (e.g. newtab top-site tiles inside a scroller that
   *   forces inset). If outer outline still has room, stay on A — do not
   *   treat "has media child" alone as failure (ganjingworld thumbnails).
   *
   * @param {Element} element
   * @returns {boolean}
   */
  _shouldUseFixedFocusOverlay(element) {
    if (!element || element.nodeType !== 1) return false;

    let paintEl = element;
    try {
      paintEl = this._resolveElementForFocusStyling(element) || element;
    } catch {
      paintEl = element;
    }
    // Same clip-frame promotion as path A (abspos <img> inside overflow:hidden).
    // Decision must see the frame, or full-bleed cover is invisible on the <img>.
    try {
      const frame = this._resolveAbsoluteClipFramePaintHost(paintEl);
      if (frame) paintEl = frame;
    } catch { /* ignore */ }

    let er = null;
    try {
      er = paintEl.getBoundingClientRect();
    } catch {
      return false;
    }
    if (!er || !(er.width > 0) || !(er.height > 0)) return false;

    // Wrapping image+text clickable (Tom's Hardware): outer outline (A) looks
    // disconnected from the stacked pair. Prefer B on the visual shell.
    // Nested headline / thumb links do not qualify (see fill check).
    try {
      if (this._resolveMediaTextCardShell(paintEl) || this._resolveMediaTextCardShell(element)) {
        return true;
      }
    } catch { /* ignore */ }

    // Paint target sticks out past a clipping ancestor (negative free room).
    // Graded inset only paints *inside* the border box — that edge of the box
    // is already cut off (arstechnica.com list headlines above overflow-hidden).
    // Flush room (0) still uses A inset (control-strip buttons).
    try {
      const room = this._minFocusOutlineRoomPx(paintEl);
      if (Number.isFinite(room) && room < -0.5) {
        return true;
      }
    } catch { /* ignore */ }

    // Replaced media as the paint target (0×0 <a> → <img>): no child cover to
    // detect, and inset A is clipped by the overflow:hidden aspect box.
    try {
      if (
        this._isReplacedOrVoidElement(paintEl) &&
        this._isMediaLikeCoverElement(paintEl) &&
        this._wouldUseInsetFocusOutline(paintEl)
      ) {
        return true;
      }
    } catch { /* ignore */ }

    let selfClips = false;
    try {
      selfClips = this._styleClipsSelf(window.getComputedStyle(paintEl));
    } catch { /* ignore */ }
    // Shadow host whose *own* light-DOM style is non-clipping but whose
    // internal shadow wrapper clips (msn.com cs-responsive-card pattern:
    // overflow:hidden and/or contain:content on div.root).
    if (!selfClips) {
      try {
        selfClips = this._hostClipsViaInternalShadowWrapper(paintEl);
      } catch { /* ignore */ }
    }

    // Inset outline on the element is invisible when the element itself clips
    // and is painted over by full-bleed *or* edge-flush media (top-image cards).
    if (
      selfClips &&
      (this._hasFullBleedCoveringContent(paintEl, er) ||
        this._hasEdgeFlushMediaCover(paintEl, er))
    ) {
      return true;
    }

    // Full-bleed / edge-strip stacking child only defeats **inset** outline.
    // Outer outline paints outside the border box and remains visible
    // (ganjingworld, many video grids). Only escape when path A would inset.
    if (
      this._hasObscuringFullBleedChild(paintEl, er) ||
      this._hasEdgeFlushMediaCover(paintEl, er)
    ) {
      if (this._wouldUseInsetFocusOutline(paintEl)) {
        return true;
      }
    }

    // Shadow skip-A → B is decided in updateFocusOverlay (not here). This
    // helper only answers whether light-DOM geometry needs an escape hatch.

    return false;
  }

  /**
   * Card-sized box with a flush media strip (image on top / side rail) and a
   * complementary text/headline region.
   *
   * Used only when the hover target itself is (roughly) that card-sized
   * clickable — e.g. Tom's Hardware `a.article-link` wrapping image+title.
   * Separate image / headline `<a>`s that share a URL (arstechnica.com cards)
   * must keep their own paint boxes; see `_focusFillsMediaTextCardShell`.
   * @param {Element} el
   * @returns {boolean}
   */
  _isMediaTextSplitCard(el) {
    if (!el || el.nodeType !== 1) return false;
    let box = null;
    try { box = el.getBoundingClientRect(); } catch { box = null; }
    if (!box || box.width < 160 || box.height < 140) return false;
    if (box.width > 920 || box.height > 780) return false;
    try {
      const vw = window.innerWidth || 0;
      if (vw > 0 && box.width > vw * 0.72 && box.height > 420) return false;
    } catch { /* ignore */ }

    let hasStrip = false;
    try { hasStrip = this._hasEdgeFlushMediaCover(el, box); } catch { hasStrip = false; }
    if (!hasStrip) {
      // Backup: measure descendant <img>/<video> even when <picture> is 0×0.
      try { hasStrip = this._hasDescendantMediaStrip(el, box); } catch { hasStrip = false; }
    }
    if (!hasStrip) return false;

    let text = '';
    try { text = String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(); } catch { text = ''; }
    return text.length >= 8;
  }

  /**
   * True when `shell` contains a navigable/action dest different from `fromEl`.
   * Rumble video cards: thumbnail+title share the watch URL, but the channel
   * link is a separate F-target — do not paint the whole card for that hover.
   * @param {Element} shell
   * @param {Element} fromEl
   * @returns {boolean}
   */
  _mediaTextShellHasCompetingDest(shell, fromEl) {
    if (!shell || !fromEl || shell === fromEl) return false;
    let fromId = '';
    try { fromId = resolveActivationIdentity(fromEl); } catch { fromId = ''; }
    if (!fromId) return false;

    /** @type {Element[]} */
    let links = [];
    try {
      links = Array.from(shell.querySelectorAll('a[href], [role="link"]'));
    } catch {
      return false;
    }
    for (let i = 0; i < links.length && i < 24; i++) {
      const a = links[i];
      if (!a || a === fromEl) continue;
      let id = '';
      try { id = resolveActivationIdentity(a); } catch { id = ''; }
      if (id && id !== fromId) return true;
    }
    return false;
  }

  /**
   * True when `focusEl` already paints most of `shell` — i.e. a single
   * card-sized clickable wrapping image+text, not a nested headline/thumb link.
   * @param {Element} focusEl
   * @param {Element} shell
   * @returns {boolean}
   */
  _focusFillsMediaTextCardShell(focusEl, shell) {
    if (!focusEl || !shell || focusEl.nodeType !== 1 || shell.nodeType !== 1) return false;
    if (focusEl === shell) return true;
    let fr = null;
    let sr = null;
    try { fr = focusEl.getBoundingClientRect(); } catch { fr = null; }
    try { sr = shell.getBoundingClientRect(); } catch { sr = null; }
    if (!fr || !sr || !(fr.width > 0) || !(fr.height > 0) || !(sr.width > 0) || !(sr.height > 0)) {
      return false;
    }
    const fArea = fr.width * fr.height;
    const sArea = sr.width * sr.height;
    // Require the focus target to cover most of the card shell. Headline-only
    // and media-strip-only links are typically well under half the card area.
    if (fArea < sArea * 0.78) return false;
    if (fr.width < sr.width * 0.82) return false;
    if (fr.height < sr.height * 0.78) return false;
    return true;
  }

  /**
   * Smallest ancestor (incl. `el`) that is an image+text split card **and** is
   * essentially the same box as the hover target (wrapping card link).
   * Stops when the box balloons into a carousel / multi-card row.
   * Does not promote nested headline/image links up to the outer card.
   * @param {Element|null|undefined} el
   * @returns {Element|null}
   */
  _resolveMediaTextCardShell(el) {
    if (!el || el.nodeType !== 1) return null;
    let found = null;
    try {
      if (this._isMediaTextSplitCard(el) && !this._mediaTextShellHasCompetingDest(el, el)) {
        found = el;
      }
    } catch { /* ignore */ }

    if (!found) {
      let ir = null;
      try { ir = el.getBoundingClientRect(); } catch { ir = null; }
      if (!ir || ir.width < 4 || ir.height < 4) return null;

      let p = null;
      try { p = this._composedParent(el); } catch { p = el.parentElement; }
      let depth = 0;
      while (p && p.nodeType === 1 && depth++ < 10) {
        if (p === document.body || p === document.documentElement) break;
        let r = null;
        try { r = p.getBoundingClientRect(); } catch { r = null; }
        if (!r || r.width < 8 || r.height < 8) {
          try { p = this._composedParent(p); } catch { p = p.parentElement; }
          continue;
        }
        // Ancestor much wider than the focus target is not a wrapping card link.
        if (r.width > ir.width * 1.4 + 48) break;
        // Ancestor much taller (image+title stack) while focus is headline-only.
        if (r.height > ir.height * 1.55 + 32) break;
        if (r.height > 780) break;
        try {
          if (
            this._isMediaTextSplitCard(p) &&
            !this._mediaTextShellHasCompetingDest(p, el)
          ) {
            found = p;
            break;
          }
        } catch { /* ignore */ }
        try { p = this._composedParent(p); } catch { p = p.parentElement; }
      }
    }

    if (!found) return null;
    const shell = this._liftMediaTextCardPaintHost(found);
    if (!shell) return null;
    try {
      if (!this._focusFillsMediaTextCardShell(el, shell)) return null;
    } catch {
      return null;
    }
    return shell;
  }

  /**
   * Block/flex/grid (or inline-block) host that can take an absolute ring.
   * @param {Element} el
   * @returns {boolean}
   */
  _isBlockishPaintHost(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      const d = String(window.getComputedStyle(el).display || '');
      if (!d || d === 'none' || d === 'contents' || d === 'inline') return false;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Inline stacked cards (Tom's Hardware `a.article-link`) fragment into
   * image + headline boxes. Strategy B needs a same-column block wrapper
   * (`div.feature-block-item-wrapper`) as the containing block.
   * @param {Element} shell
   * @returns {Element}
   */
  _liftMediaTextCardPaintHost(shell) {
    if (!shell || shell.nodeType !== 1) return shell;
    try {
      if (
        this._isBlockishPaintHost(shell) &&
        !this._isFragmentedInlineFocusTarget(shell) &&
        this._canMountVisibleChildOnHost(shell)
      ) {
        return shell;
      }
    } catch { /* lift */ }

    let ir = null;
    try { ir = shell.getBoundingClientRect(); } catch { ir = null; }
    if (!ir || ir.width < 8 || ir.height < 8) return shell;

    let p = null;
    try { p = this._composedParent(shell); } catch { p = shell.parentElement; }
    let depth = 0;
    while (p && p.nodeType === 1 && depth++ < 6) {
      if (p === document.body || p === document.documentElement) break;
      let r = null;
      try { r = p.getBoundingClientRect(); } catch { r = null; }
      if (!r || r.width < 8 || r.height < 8) {
        try { p = this._composedParent(p); } catch { p = p.parentElement; }
        continue;
      }
      if (r.width > ir.width * 1.12 + 12) break;
      if (r.height > ir.height * 1.25 + 24) break;
      try {
        if (
          this._isBlockishPaintHost(p) &&
          !this._isFragmentedInlineFocusTarget(p) &&
          this._canMountVisibleChildOnHost(p)
        ) {
          return p;
        }
      } catch { /* ignore */ }
      try { p = this._composedParent(p); } catch { p = p.parentElement; }
    }
    return shell;
  }

  /**
   * Media-like node that can paint over an inset focus outline.
   * @param {Element} el
   * @returns {boolean}
   */
  _isMediaLikeCoverElement(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = (el.tagName || '').toUpperCase();
    if (
      tag === 'IMG' ||
      tag === 'VIDEO' ||
      tag === 'PICTURE' ||
      tag === 'CANVAS' ||
      tag === 'SVG'
    ) {
      return true;
    }
    try {
      const cs = window.getComputedStyle(el);
      const bg = cs && cs.backgroundImage;
      if (bg && bg !== 'none') return true;
    } catch { /* ignore */ }
    return false;
  }

  /**
   * True when a media surface covers a substantial edge strip of `el` (e.g.
   * card hero image on the top ~half). Full-bleed (85%×85%) is handled by
   * `_hasFullBleedCoveringContent`; this catches the common "media header"
   * layout where strategy A inset outlines only survive on the text half.
   *
   * Walks direct shadow-piercing children plus one level into near-full
   * wrappers (card → `.root` → `img.media`). Does **not** alone force B/C —
   * callers still require self-clip or graded inset.
   *
   * @param {Element} el
   * @param {DOMRect|ClientRect} [er]
   * @returns {boolean}
   */
  _hasEdgeFlushMediaCover(el, er) {
    if (!el || el.nodeType !== 1) return false;
    let box = er;
    try {
      if (!box) box = el.getBoundingClientRect();
    } catch {
      return false;
    }
    if (!box || !(box.width > 0) || !(box.height > 0)) return false;

    /** @type {Element[]} */
    const candidates = [];
    try {
      this._enqueueShadowPiercingChildren(el, candidates);
      const nDirect = candidates.length;
      for (let i = 0; i < nDirect && i < 12; i++) {
        const wrap = candidates[i];
        if (!wrap || wrap.nodeType !== 1) continue;
        let wr = null;
        try { wr = wrap.getBoundingClientRect(); } catch { wr = null; }
        if (!wr || !(wr.width > 0) || !(wr.height > 0)) {
          // <picture> often reports 0×0; the <img> inside is the real strip.
          const wrapTag = String(wrap.tagName || '').toUpperCase();
          if (wrapTag === 'PICTURE' || wrapTag === 'FIGURE') {
            this._enqueueShadowPiercingChildren(wrap, candidates);
          }
          continue;
        }
        // Near-full card shell, or the image-segment wrapper (~half the card).
        if (
          wr.width >= box.width * 0.85 &&
          wr.height >= box.height * 0.28
        ) {
          this._enqueueShadowPiercingChildren(wrap, candidates);
        }
        const wrapTag = String(wrap.tagName || '').toUpperCase();
        if (wrapTag === 'PICTURE' || wrapTag === 'FIGURE' || wrapTag === 'A') {
          this._enqueueShadowPiercingChildren(wrap, candidates);
        }
      }
    } catch { /* ignore */ }

    const edgeTol = 3;
    for (let i = 0; i < candidates.length && i < 36; i++) {
      const child = candidates[i];
      if (!child || child.nodeType !== 1) continue;
      if (!this._isMediaLikeCoverElement(child)) continue;

      let cr = null;
      try { cr = child.getBoundingClientRect(); } catch { cr = null; }
      if (!cr || !(cr.width > 8) || !(cr.height > 8)) continue;

      const fracW = cr.width / box.width;
      const fracH = cr.height / box.height;
      // Major axis nearly spans the host; minor axis is a real strip (≥28%),
      // not a tiny icon — and not already handled as full-bleed (both ≥85%).
      const majorSpan = fracW >= 0.85 || fracH >= 0.85;
      const stripDepth = fracW >= 0.28 && fracH >= 0.28;
      if (!majorSpan || !stripDepth) continue;
      if (fracW >= 0.85 && fracH >= 0.85) continue; // full-bleed path owns this

      const flushTop = Math.abs(cr.top - box.top) <= edgeTol;
      const flushBottom = Math.abs(cr.bottom - box.bottom) <= edgeTol;
      const flushLeft = Math.abs(cr.left - box.left) <= edgeTol;
      const flushRight = Math.abs(cr.right - box.right) <= edgeTol;
      // Require a flush "cap": one end edge + both sides (top/bottom media bar)
      // or one side edge + both ends (left/right media rail).
      const topCap = flushTop && flushLeft && flushRight;
      const bottomCap = flushBottom && flushLeft && flushRight;
      const leftRail = flushLeft && flushTop && flushBottom;
      const rightRail = flushRight && flushTop && flushBottom;
      if (topCap || bottomCap || leftRail || rightRail) return true;
    }

    return false;
  }

  /**
   * Deeper strip detector for stacked cards whose media sits more than one
   * wrapper below the visual shell (0x0 picture, NVIDIA teaser image
   * link). Cheap query of replaced media; same flush-cap geometry as
   * `_hasEdgeFlushMediaCover`.
   * @param {Element} el
   * @param {DOMRect|ClientRect} [er]
   * @returns {boolean}
   */
  _hasDescendantMediaStrip(el, er) {
    if (!el || el.nodeType !== 1) return false;
    let box = er;
    try {
      if (!box) box = el.getBoundingClientRect();
    } catch {
      return false;
    }
    if (!box || !(box.width > 0) || !(box.height > 0)) return false;

    /** @type {Element[]} */
    const media = [];
    try {
      const nodes = el.querySelectorAll('img, video, canvas, picture');
      for (let i = 0; i < nodes.length && media.length < 20; i++) {
        const n = nodes[i];
        if (!n || n.nodeType !== 1) continue;
        const tag = String(n.tagName || '').toUpperCase();
        if (tag === 'PICTURE') {
          try {
            const img = n.querySelector('img');
            if (img) media.push(img);
          } catch { /* ignore */ }
          continue;
        }
        media.push(n);
      }
    } catch { /* ignore */ }

    const edgeTol = 8;
    for (let i = 0; i < media.length; i++) {
      const child = media[i];
      let cr = null;
      try { cr = child.getBoundingClientRect(); } catch { cr = null; }
      if (!cr || !(cr.width > 8) || !(cr.height > 8)) continue;

      const fracW = cr.width / box.width;
      const fracH = cr.height / box.height;
      const majorSpan = fracW >= 0.82 || fracH >= 0.82;
      const stripDepth = fracW >= 0.28 && fracH >= 0.28;
      if (!majorSpan || !stripDepth) continue;
      if (fracW >= 0.85 && fracH >= 0.85) continue;

      const flushTop = Math.abs(cr.top - box.top) <= edgeTol;
      const flushBottom = Math.abs(cr.bottom - box.bottom) <= edgeTol;
      const flushLeft = Math.abs(cr.left - box.left) <= edgeTol;
      const flushRight = Math.abs(cr.right - box.right) <= edgeTol;
      const topCap = flushTop && flushLeft && flushRight;
      const bottomCap = flushBottom && flushLeft && flushRight;
      const leftRail = flushLeft && flushTop && flushBottom;
      const rightRail = flushRight && flushTop && flushBottom;
      if (topCap || bottomCap || leftRail || rightRail) return true;
    }

    return false;
  }

  /**
   * True when absolute/fixed children or full-size pseudos cover most of `el`,
   * so an inset outline paints under (or is obscured by) that content.
   * @param {Element} el
   * @param {DOMRect|ClientRect} [er]
   * @returns {boolean}
   */
  _hasFullBleedCoveringContent(el, er) {
    if (!el || el.nodeType !== 1) return false;
    let box = er;
    try {
      if (!box) box = el.getBoundingClientRect();
    } catch {
      return false;
    }
    if (!box || !(box.width > 0) || !(box.height > 0)) return false;

    const nearlyFills = (w, h) =>
      w >= box.width * 0.85 && h >= box.height * 0.85;

    try {
      for (const pseudo of [':before', ':after']) {
        const pcs = window.getComputedStyle(el, pseudo);
        if (!pcs || !pcs.content || pcs.content === 'none') continue;
        if (pcs.position !== 'absolute' && pcs.position !== 'fixed') continue;
        const w = parseFloat(pcs.width);
        const h = parseFloat(pcs.height);
        // inset:-1px bleed (common on page thumbs) may not set usable width/height;
        // treat any absolute pseudo with non-none content as covering when the
        // host itself is the clipped media surface (caller checks overflow).
        if (Number.isFinite(w) && Number.isFinite(h) && nearlyFills(w, h)) {
          return true;
        }
        // Fallback: absolute pseudo with empty-string content and inset fill.
        if (pcs.content === '""' || pcs.content === "''") {
          const top = parseFloat(pcs.top);
          const left = parseFloat(pcs.left);
          const right = parseFloat(pcs.right);
          const bottom = parseFloat(pcs.bottom);
          const hasInset =
            (Number.isFinite(top) || Number.isFinite(bottom)) &&
            (Number.isFinite(left) || Number.isFinite(right));
          if (hasInset) return true;
        }
      }
    } catch { /* ignore */ }

    try {
      /** @type {Element[]} */
      const kids = [];
      this._enqueueShadowPiercingChildren(el, kids);
      // Also one level into near-full wrappers (card host → .root → img)
      // and collapsed abspos wrappers (0×0 <a> around an absolute <img>).
      const nDirect = kids.length;
      for (let i = 0; i < nDirect && i < 12; i++) {
        const wrap = kids[i];
        if (!wrap || wrap.nodeType !== 1) continue;
        let wr = null;
        try { wr = wrap.getBoundingClientRect(); } catch { wr = null; }
        if (wr && nearlyFills(wr.width, wr.height)) {
          this._enqueueShadowPiercingChildren(wrap, kids);
          continue;
        }
        const wrapTag = String(wrap.tagName || '').toUpperCase();
        if (
          wrapTag === 'A' ||
          wrapTag === 'PICTURE' ||
          wrapTag === 'FIGURE' ||
          !wr ||
          !(wr.width > 2) ||
          !(wr.height > 2)
        ) {
          this._enqueueShadowPiercingChildren(wrap, kids);
        }
      }
      for (let i = 0; i < kids.length && i < 36; i++) {
        const child = kids[i];
        if (!child || child.nodeType !== 1) continue;
        let cr = null;
        try { cr = child.getBoundingClientRect(); } catch { cr = null; }
        if (!cr || !nearlyFills(cr.width, cr.height)) continue;

        let cs = null;
        try { cs = window.getComputedStyle(child); } catch { cs = null; }
        if (!cs) continue;

        // Absolute/fixed full-bleed layer.
        if (cs.position === 'absolute' || cs.position === 'fixed') return true;
        // Static/relative media (msn.com hero img sized to the card).
        if (this._isMediaLikeCoverElement(child)) return true;
      }
    } catch { /* ignore */ }

    return false;
  }

  /**
   * True when a direct child fills most of `el` and would paint over an inset
   * outline applied to `el` (stacking-context / clipped media surface).
   *
   * Pattern: clickable wrapper (overflow:visible) > visual tile
   * (overflow:hidden, isolation:isolate, full-bleed ::before / img).
   *
   * Also considers top-level open-shadow children (archive.org / MSN hosts
   * often have empty light DOM with the visual tree only in shadow).
   *
   * @param {Element} el
   * @param {DOMRect|ClientRect} [er]
   * @returns {boolean}
   */
  _hasObscuringFullBleedChild(el, er) {
    if (!el || el.nodeType !== 1) return false;
    let box = er;
    try {
      if (!box) box = el.getBoundingClientRect();
    } catch {
      return false;
    }
    if (!box || !(box.width > 0) || !(box.height > 0)) return false;

    const nearlyFills = (w, h) =>
      w >= box.width * 0.85 && h >= box.height * 0.85;

    try {
      /** @type {Element[]} */
      const kids = [];
      this._enqueueShadowPiercingChildren(el, kids);
      const nDirect = kids.length;
      for (let i = 0; i < nDirect && i < 12; i++) {
        const wrap = kids[i];
        if (!wrap || wrap.nodeType !== 1) continue;
        const wrapTag = String(wrap.tagName || '').toUpperCase();
        let wr = null;
        try { wr = wrap.getBoundingClientRect(); } catch { wr = null; }
        if (
          wrapTag === 'A' ||
          wrapTag === 'PICTURE' ||
          wrapTag === 'FIGURE' ||
          !wr ||
          !(wr.width > 2) ||
          !(wr.height > 2)
        ) {
          this._enqueueShadowPiercingChildren(wrap, kids);
        }
      }
      if (!kids.length) return false;
      for (let i = 0; i < kids.length; i++) {
        const child = kids[i];
        if (!child || child.nodeType !== 1) continue;

        let cr = null;
        try { cr = child.getBoundingClientRect(); } catch { cr = null; }
        if (!cr || !nearlyFills(cr.width, cr.height)) continue;

        let cs = null;
        try { cs = window.getComputedStyle(child); } catch { cs = null; }
        if (!cs) continue;

        const childClips = this._styleClipsSelf(cs);
        const stacks =
          cs.isolation === 'isolate' ||
          (cs.transform && cs.transform !== 'none') ||
          (cs.filter && cs.filter !== 'none') ||
          (cs.opacity !== '' && Number(cs.opacity) < 1) ||
          (cs.position !== 'static' && cs.zIndex !== 'auto') ||
          (typeof cs.willChange === 'string' &&
            /(?:^|,\s*)(transform|opacity|filter|isolation)(?:\s*,|$)/i.test(cs.willChange));

        // Absolute/fixed full-bleed child always covers inset parent outline.
        if (cs.position === 'absolute' || cs.position === 'fixed') {
          return true;
        }

        // Clipped / paint-contained media tile hides inset rings.
        if (childClips && this._hasFullBleedCoveringContent(child, cr)) {
          return true;
        }

        // Near-full media child (static img sized to the tile).
        if (this._isMediaLikeCoverElement(child)) {
          return true;
        }

        // Stacking-context child that fills the host paints above parent outline
        // even without its own overflow clip (isolation + painted descendants).
        if (stacks && (childClips || this._hasFullBleedCoveringContent(child, cr))) {
          return true;
        }
      }
    } catch { /* ignore */ }

    return false;
  }

  /**
   * Tags that cannot accept element children (replaced / void). Strategy B
   * (in-target ring) cannot mount inside these — fall back to strategy C.
   * @param {Element|null|undefined} el
   * @returns {boolean}
   */
  _isReplacedOrVoidElement(el) {
    if (!el || el.nodeType !== 1) return true;
    const tag = (el.tagName || '').toUpperCase();
    return (
      tag === 'IMG' ||
      tag === 'VIDEO' ||
      tag === 'AUDIO' ||
      tag === 'CANVAS' ||
      tag === 'IFRAME' ||
      tag === 'EMBED' ||
      tag === 'OBJECT' ||
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      tag === 'OPTION' ||
      tag === 'BR' ||
      tag === 'HR' ||
      tag === 'SOURCE' ||
      tag === 'TRACK' ||
      tag === 'AREA' ||
      tag === 'COL' ||
      tag === 'SVG' || // prefer not to inject under SVG unless needed
      tag === 'MATH'
    );
  }

  /**
   * Dedicated full-bleed mount layer as last child of an open ShadowRoot.
   * Sized to the shadow host; ring paints above all shadow content.
   * @param {ShadowRoot} shadowRoot
   * @returns {Element|null}
   */
  _ensureShadowRootRingHost(shadowRoot) {
    if (!shadowRoot || typeof shadowRoot.appendChild !== 'function') return null;
    const ceHost = shadowRoot.host;
    if (!ceHost || ceHost.nodeType !== 1) return null;

    // Shadow host must be a containing block for absolute inset:0 layer.
    try {
      const cs = window.getComputedStyle(ceHost);
      if (cs && cs.position === 'static') {
        if (!this._inTargetHostPosRestore || this._inTargetHostPosRestore.host !== ceHost) {
          this._inTargetHostPosRestore = {
            host: ceHost,
            prev: ceHost.style.position || ''
          };
          ceHost.style.position = 'relative';
        }
      }
    } catch { /* ignore */ }

    let mount = null;
    try {
      const kids = shadowRoot.children;
      if (kids) {
        for (let i = 0; i < kids.length; i++) {
          const k = kids[i];
          if (k && k.nodeType === 1 && k.getAttribute?.('data-kp-shadow-b-host') === '1') {
            mount = k;
            break;
          }
        }
      }
    } catch { /* ignore */ }

    if (!mount) {
      try {
        mount = document.createElement('div');
        mount.setAttribute('data-kp-shadow-b-host', '1');
        mount.setAttribute('aria-hidden', 'true');
        mount.style.setProperty('position', 'absolute', 'important');
        mount.style.setProperty('inset', '0', 'important');
        mount.style.setProperty('box-sizing', 'border-box', 'important');
        mount.style.setProperty('pointer-events', 'none', 'important');
        mount.style.setProperty('margin', '0', 'important');
        mount.style.setProperty('padding', '0', 'important');
        mount.style.setProperty('border', '0', 'important');
        mount.style.setProperty('background', 'transparent', 'important');
        mount.style.setProperty('overflow', 'visible', 'important');
        mount.style.setProperty('z-index', '2147483000', 'important');
      } catch {
        return null;
      }
    }

    try {
      if (mount.parentNode !== shadowRoot || shadowRoot.lastElementChild !== mount) {
        shadowRoot.appendChild(mount);
      }
    } catch {
      return null;
    }

    return mount;
  }

  /**
   * True when candidate rect is not much larger than the focus target rect.
   * Prevents strategy B from mounting on a whole list/panel shadow host when
   * focusEl is a small row link (archive.org "Archive News").
   * @param {DOMRect|ClientRect|null|undefined} candidate
   * @param {DOMRect|ClientRect|null|undefined} focusRect
   * @returns {boolean}
   */
  _inTargetHostSizeOk(candidate, focusRect) {
    if (!candidate || !(candidate.width > 0) || !(candidate.height > 0)) return false;
    if (!focusRect || !(focusRect.width > 0) || !(focusRect.height > 0)) return true;
    const fArea = focusRect.width * focusRect.height;
    const cArea = candidate.width * candidate.height;
    if (fArea < 1) return true;
    // Allow modest padding around the focus box; reject container >> link.
    return (
      cArea <= fArea * 1.4 &&
      candidate.width <= focusRect.width * 1.3 + 8 &&
      candidate.height <= focusRect.height * 1.3 + 8
    );
  }

  /**
   * Host for an in-target absolute ring: paint-resolved clickable that can
   * accept a last-child ring (sibling above full-bleed media tiles).
   *
   * Ring box must track focusEl geometry. For open-shadow targets, mount on the
   * sized clickable when possible; only use a full ShadowRoot layer when the
   * shadow host itself is roughly the focus box (card tiles). Never fall back
   * to "largest node in the shadow" — that selects list containers.
   *
   * @param {Element} element - hover focusEl
   * @returns {Element|null}
   */
  _resolveInTargetHost(element) {
    if (!element || element.nodeType !== 1) return null;

    // Image+text card shell (may be larger than the hovered headline/image <a>).
    try {
      const shell = this._resolveMediaTextCardShell(element);
      if (shell && this._canMountVisibleChildOnHost(shell)) {
        let sr = null;
        try { sr = shell.getBoundingClientRect(); } catch { sr = null; }
        if (sr && sr.width >= 8 && sr.height >= 8) return shell;
      }
    } catch { /* fall through */ }

    let paintEl = element;
    try {
      paintEl = this._resolveElementForFocusStyling(element) || element;
    } catch {
      paintEl = element;
    }
    try {
      const frame = this._resolveAbsoluteClipFramePaintHost(paintEl);
      if (frame) paintEl = frame;
    } catch { /* ignore */ }
    if (!paintEl || paintEl.nodeType !== 1) return null;
    try {
      if (!paintEl.isConnected) return null;
    } catch {
      return null;
    }

    /** @type {DOMRect|ClientRect|null} */
    let focusRect = null;
    try { focusRect = element.getBoundingClientRect(); } catch { focusRect = null; }
    if (!focusRect || !(focusRect.width > 1) || !(focusRect.height > 1)) {
      try { focusRect = paintEl.getBoundingClientRect(); } catch { focusRect = null; }
    }

    // Open-shadow: size the ring to the clickable, not the owning custom element
    // (news lists share one large shadow host for many small links).
    try {
      const root = typeof paintEl.getRootNode === 'function' ? paintEl.getRootNode() : null;
      if (root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
        if (this._canMountVisibleChildOnHost(paintEl)) {
          let pr = null;
          try { pr = paintEl.getBoundingClientRect(); } catch { pr = null; }
          if (pr && pr.width >= 8 && pr.height >= 8) {
            return paintEl;
          }
        }

        // Climb within this shadow only for a mountable ancestor ≈ focus size.
        let n = this._composedParent(paintEl);
        let depth = 0;
        while (n && n.nodeType === 1 && n !== root.host && depth++ < 8) {
          try {
            if (typeof n.getRootNode === 'function' && n.getRootNode() !== root) break;
          } catch { break; }
          if (this._canMountVisibleChildOnHost(n)) {
            let nr = null;
            try { nr = n.getBoundingClientRect(); } catch { nr = null; }
            if (nr && nr.width >= 8 && nr.height >= 8 && this._inTargetHostSizeOk(nr, focusRect)) {
              return n;
            }
          }
          n = this._composedParent(n);
        }

        // Full shadow-root layer only when the host box ≈ the focus target
        // (archive.org collection tiles: host/link same card rect). Collapsed
        // hosts (media-button ~0 height) also qualify — layer sizes to host.
        let hr = null;
        try { hr = root.host?.getBoundingClientRect?.(); } catch { hr = null; }
        const hostCollapsed = !!(hr && hr.width > 0 && hr.height < 2);
        if (hostCollapsed || this._inTargetHostSizeOk(hr, focusRect)) {
          const layer = this._ensureShadowRootRingHost(root);
          if (layer) return layer;
        }

        // Do not call _findInShadowInTargetMount(root.host) here — largest
        // visible box in a list shadow is the list container.
      }
    } catch { /* fall through */ }

    if (this._canMountVisibleChildOnHost(paintEl)) {
      let pr = null;
      try { pr = paintEl.getBoundingClientRect(); } catch { pr = null; }
      if (pr && pr.width >= 8 && pr.height >= 8) return paintEl;
    }

    // Slotless open-shadow host: mount inside, preferring a box ≈ focus size.
    if (this._getOpenShadowRoot(paintEl)) {
      const inner = this._findInShadowInTargetMountNear(paintEl, focusRect);
      if (inner) return inner;
    }

    // Replaced paint target (img/video): climb composed ancestors for a mount
    // that still matches focus geometry (never promote to a huge list shell).
    let n = this._composedParent(paintEl);
    let depth = 0;
    while (n && n.nodeType === 1 && depth++ < 8) {
      if (n === document.body || n === document.documentElement) break;
      if (this._canMountVisibleChildOnHost(n)) {
        let nr = null;
        try { nr = n.getBoundingClientRect(); } catch { nr = null; }
        if (nr && nr.width >= 8 && nr.height >= 8 && this._inTargetHostSizeOk(nr, focusRect)) {
          return n;
        }
      }
      if (this._getOpenShadowRoot(n)) {
        const inner = this._findInShadowInTargetMountNear(n, focusRect);
        if (inner) return inner;
      }
      n = this._composedParent(n);
    }

    return null;
  }

  /**
   * Like `_findInShadowInTargetMount`, but rejects nodes much larger than
   * `focusRect` so list/panel wrappers lose to the row link box.
   * @param {Element} host
   * @param {DOMRect|ClientRect|null|undefined} focusRect
   * @returns {Element|null}
   */
  _findInShadowInTargetMountNear(host, focusRect) {
    const sr = this._getOpenShadowRoot(host);
    if (!sr) return null;

    let best = null;
    let bestScore = -1;
    let visited = 0;
    const maxNodes = 48;
    /** @type {Element[]} */
    const queue = [];
    this._enqueueShadowPiercingChildren(host, queue);

    const focusArea = (focusRect && focusRect.width > 0 && focusRect.height > 0)
      ? (focusRect.width * focusRect.height)
      : 0;

    while (queue.length && visited < maxNodes) {
      const cur = queue.shift();
      if (!cur || cur.nodeType !== 1) continue;
      visited++;

      if (!this._isReplacedOrVoidElement(cur) && this._canMountVisibleChildOnHost(cur)) {
        let r = null;
        try { r = cur.getBoundingClientRect(); } catch { r = null; }
        if (r && r.width >= 8 && r.height >= 8 && this._inTargetHostSizeOk(r, focusRect)) {
          const area = r.width * r.height;
          // Prefer the box closest in area to the focus target (not merely largest).
          const score = focusArea > 0
            ? -Math.abs(area - focusArea)
            : area;
          if (score > bestScore) {
            bestScore = score;
            best = cur;
          }
        }
      }

      this._enqueueShadowPiercingChildren(cur, queue);
    }

    return best;
  }

  /**
   * Max numeric z-index among host pseudos and element children (excluding ring).
   * @param {Element} host
   * @returns {number}
   */
  _maxLocalZIndex(host) {
    let max = 0;
    const consider = (z) => {
      if (z == null || z === '' || z === 'auto') return;
      const n = parseInt(String(z), 10);
      if (Number.isFinite(n)) max = Math.max(max, n);
    };

    try {
      for (const pseudo of [':before', ':after']) {
        const ps = window.getComputedStyle(host, pseudo);
        if (ps) consider(ps.zIndex);
      }
    } catch { /* ignore */ }

    try {
      const kids = host.children;
      if (!kids) return max;
      const ringClass = CSS_CLASSES.FOCUS_RING_INTARGET || 'kpv2-focus-ring-intarget';
      for (let i = 0; i < kids.length; i++) {
        const child = kids[i];
        if (!child || child.nodeType !== 1) continue;
        if (child === this._inTargetRing) continue;
        try {
          if (child.classList && child.classList.contains(ringClass)) continue;
        } catch { /* ignore */ }
        let cs = null;
        try { cs = window.getComputedStyle(child); } catch { cs = null; }
        if (!cs) continue;
        // Only positioned / z-indexed children participate as explicit layers.
        if (cs.zIndex !== 'auto') consider(cs.zIndex);
      }
    } catch { /* ignore */ }

    return max;
  }

  /**
   * Ensure singleton in-target ring element exists.
   * @returns {HTMLElement}
   */
  _ensureInTargetRingEl() {
    if (this._inTargetRing && this._inTargetRing.nodeType === 1) {
      return this._inTargetRing;
    }
    const ringClass = CSS_CLASSES.FOCUS_RING_INTARGET || 'kpv2-focus-ring-intarget';
    this._inTargetRing = this.createElement('div', {
      className: ringClass,
      style: `
        position: absolute !important;
        inset: 0 !important;
        box-sizing: border-box !important;
        pointer-events: none !important;
        margin: 0 !important;
        padding: 0 !important;
        border-style: solid !important;
        background: transparent !important;
        transform: none !important;
        filter: none !important;
        display: none;
      `
    });
    try {
      this._inTargetRing.setAttribute('data-kp-focus-ring', '1');
      this._inTargetRing.setAttribute('aria-hidden', 'true');
    } catch { /* ignore */ }
    return this._inTargetRing;
  }

  /**
   * Restore position mutation on a previous in-target host, if any.
   */
  _restoreInTargetHostPosition() {
    const restore = this._inTargetHostPosRestore;
    this._inTargetHostPosRestore = null;
    if (!restore || !restore.host) return;
    try {
      if (restore.prev == null || restore.prev === '') {
        restore.host.style.removeProperty('position');
      } else {
        restore.host.style.position = restore.prev;
      }
    } catch { /* ignore */ }
  }

  /**
   * Detach / hide the in-target absolute focus ring and restore host position.
   */
  hideInTargetFocusRing() {
    this._focusPaintUsesInTargetRing = false;
    const ring = this._inTargetRing;
    if (ring) {
      try { ring.style.display = 'none'; } catch { /* ignore */ }
      try {
        if (ring.parentNode) ring.parentNode.removeChild(ring);
      } catch { /* ignore */ }
    }
    this._restoreInTargetHostPosition();
    this._inTargetHost = null;
  }

  /**
   * Multi-line / wrapped inline clickables fragment into several line boxes.
   * Absolute `inset:0` on an inline host sizes to one fragment (often first line
   * width only) — fall through to strategy C for the union rect instead.
   * @param {Element|null|undefined} el
   * @returns {boolean}
   */
  _isFragmentedInlineFocusTarget(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      const rects = el.getClientRects();
      if (rects && rects.length >= 2) return true;
    } catch { /* ignore */ }
    try {
      const display = String(window.getComputedStyle(el)?.display || '');
      // Bare `inline` abspos containing blocks are fragment-sized in Blink.
      if (display === 'inline') return true;
    } catch { /* ignore */ }
    return false;
  }

  /**
   * Strategy B: mount an absolute focus ring as last child of the host with
   * z-index = max(local siblings)+1 and border-radius from the visual host.
   *
   * @param {Element} element
   * @param {string} [mode]
   * @returns {boolean} true if ring was mounted
   */
  updateFocusOverlayInTarget(element, mode = MODES.NONE) {
    if (!(FEATURE_FLAGS && FEATURE_FLAGS.ENABLE_IN_TARGET_FOCUS_RING)) {
      return false;
    }
    if (!element || element.nodeType !== 1) return false;

    // Wrapped text links: B's inset:0 ring only covers one line fragment.
    // Let Auto fall through to C (body fixed union box) for full width —
    // except image+text cards, where we lift to a block shell first.
    let cardHost = null;
    try { cardHost = this._resolveMediaTextCardShell(element); } catch { cardHost = null; }
    if (!cardHost && this._isFragmentedInlineFocusTarget(element)) {
      return false;
    }

    const host = cardHost || this._resolveInTargetHost(element);
    if (!host) return false;
    if (this._isFragmentedInlineFocusTarget(host)) {
      return false;
    }

    // Modal/popover iframes: never decorate.
    try {
      if (host.tagName === 'IFRAME') {
        const isPopoverIframe = this.popoverIframeElement && host === this.popoverIframeElement;
        const isModalIframe = !!(host.classList && host.classList.contains('modal-iframe'));
        if (isPopoverIframe || isModalIframe) return false;
      }
    } catch { /* ignore */ }

    const ring = this._ensureInTargetRingEl();

    // Radius from the visual host/clip wrapper — resolve *before* the ring
    // is a child so a leftover `50%` on the ring cannot feed back.
    let radius = '0';
    try {
      radius = this._resolveElementBorderRadius(host) ||
        this._resolveElementBorderRadius(element) ||
        '0';
    } catch {
      radius = '0';
    }

    // Leaving a previous host — restore its position if we mutated it.
    if (this._inTargetHost && this._inTargetHost !== host) {
      this._restoreInTargetHostPosition();
    }

    // Containing block: static hosts need position:relative.
    try {
      const cs = window.getComputedStyle(host);
      if (cs && cs.position === 'static') {
        if (!this._inTargetHostPosRestore || this._inTargetHostPosRestore.host !== host) {
          this._inTargetHostPosRestore = {
            host,
            prev: host.style.position || ''
          };
          host.style.position = 'relative';
        }
      } else if (this._inTargetHostPosRestore && this._inTargetHostPosRestore.host === host) {
        // Host is no longer static (site style changed) — drop restore record carefully.
        // Keep relative we set only if we set it; if site now positions it, clear restore.
        if (cs && cs.position !== 'static' && host.style.position === 'relative') {
          // still our relative is fine
        }
      }
    } catch { /* ignore */ }

    // Ensure last child so we paint above earlier stacking siblings.
    try {
      if (ring.parentNode !== host || host.lastElementChild !== ring) {
        host.appendChild(ring);
      }
    } catch {
      this.hideInTargetFocusRing();
      return false;
    }

    this._inTargetHost = host;

    // Colors / thickness from click-mode settings (same as other backends).
    const isTextInput = element.matches && element.matches(SELECTORS.FOCUSABLE_TEXT);
    const suppressFill = this.shouldSuppressFocusFill(element);
    const {
      rectangleThickness,
      overlayFillEnabled,
      overlayShadowEnabled,
      focusColor
    } = this._getClickModeSettings();
    const ringWidthPx = Math.min(Math.max(Number(rectangleThickness) || 3, 1), 16);

    let borderColor;
    let shadowColor;
    let shadowBright;
    let backgroundColor = 'transparent';
    if (isTextInput) {
      borderColor = COLORS.ORANGE;
      shadowColor = COLORS.ORANGE_SHADOW;
      shadowBright = COLORS.ORANGE_SHADOW;
    } else {
      const p = this._getNonTextFocusPalette(focusColor);
      borderColor = p.borderColor;
      shadowColor = p.shadowColor;
      shadowBright = p.shadowBrightColor;
      // Fill is opt-in (same default as other backends).
      if (!suppressFill && overlayFillEnabled === true) {
        backgroundColor = p.backgroundColor || 'transparent';
      }
    }

    const zLocal = this._maxLocalZIndex(host) + 1;
    // Shadow trees often nest stacking contexts (collection-tile inside tile-link).
    // Use a high floor so the ring stays above Lit/Fluent content.
    const z = this._isInShadowTree(host) ? Math.max(zLocal, 2147483000) : zLocal;

    try {
      ring.style.setProperty('position', 'absolute', 'important');
      ring.style.setProperty('inset', '0', 'important');
      ring.style.setProperty('box-sizing', 'border-box', 'important');
      ring.style.setProperty('pointer-events', 'none', 'important');
      ring.style.setProperty('margin', '0', 'important');
      ring.style.setProperty('padding', '0', 'important');
      ring.style.setProperty('width', 'auto', 'important');
      ring.style.setProperty('height', 'auto', 'important');
      ring.style.setProperty('z-index', String(z), 'important');
      ring.style.setProperty('border-width', `${ringWidthPx}px`, 'important');
      ring.style.setProperty('border-style', 'solid', 'important');
      ring.style.setProperty('border-color', borderColor, 'important');
      ring.style.setProperty('border-radius', radius, 'important');
      ring.style.setProperty('background', backgroundColor, 'important');
      // Squarespace social icons (and similar) scale *all* children of the
      // overflow:hidden wrapper (e.g. `.sqs-svg-icon--wrapper > * { transform:
      // scale(2) }`). That pushes our border outside the clip and the ring
      // vanishes while F-flash (body fixed) still works. Lock identity transform.
      ring.style.setProperty('transform', 'none', 'important');
      ring.style.setProperty('transform-origin', 'center', 'important');
      ring.style.setProperty('scale', 'none', 'important');
      ring.style.setProperty('translate', 'none', 'important');
      ring.style.setProperty('rotate', 'none', 'important');
      ring.style.setProperty('filter', 'none', 'important');
      ring.style.setProperty('mix-blend-mode', 'normal', 'important');
      if (overlayShadowEnabled === false) {
        ring.style.setProperty('box-shadow', 'none', 'important');
      } else {
        ring.style.setProperty(
          'box-shadow',
          `0 0 0 2px ${shadowColor}, 0 0 10px 2px ${shadowBright}`,
          'important'
        );
      }
      ring.style.setProperty('display', 'block', 'important');
      ring.style.setProperty('visibility', 'visible', 'important');
      ring.style.setProperty('opacity', '1', 'important');
    } catch {
      this.hideInTargetFocusRing();
      return false;
    }

    // Slotless shadow hosts accept appendChild but never layout the ring.
    // Require a positive box before claiming success — else fall through to C.
    // Also reject rings much narrower than the focus union (inline fragment CB).
    // Also reject when host overflow-clips the ring border (self-clip + scaled
    // children already handled via transform:none; still bail if host box and
    // ring box diverge badly so C can paint).
    try {
      const rr = ring.getBoundingClientRect();
      if (!rr || !(rr.width > 1) || !(rr.height > 1)) {
        this.hideInTargetFocusRing();
        return false;
      }
      let fr = null;
      try { fr = element.getBoundingClientRect(); } catch { fr = null; }
      if (fr && fr.width > 16 && rr.width < fr.width * 0.85) {
        this.hideInTargetFocusRing();
        return false;
      }
      // Host clips itself and ring is still much larger than host (site transform
      // or layout won) → border sits outside the clip; use body fixed instead.
      let hostBox = null;
      try { hostBox = host.getBoundingClientRect(); } catch { hostBox = null; }
      if (
        hostBox &&
        hostBox.width > 1 &&
        hostBox.height > 1 &&
        (rr.width > hostBox.width * 1.35 + 4 || rr.height > hostBox.height * 1.35 + 4)
      ) {
        let hostClips = false;
        try {
          hostClips = this._styleClipsSelf(window.getComputedStyle(host));
        } catch { hostClips = false; }
        if (hostClips) {
          this.hideInTargetFocusRing();
          return false;
        }
      }
    } catch {
      this.hideInTargetFocusRing();
      return false;
    }

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] In-target focus ring mounted:', {
        host: host.tagName,
        hostClass: (host.className || '').toString().slice(0, 60),
        zIndex: z,
        borderRadius: radius,
        borderColor,
        mode
      });
    }

    return true;
  }

  /**
   * Update focus overlay using element styling (for DOM hover mode)
   * Styles the element directly instead of creating overlay elements
   */
  updateFocusOverlayElementStyling(element, mode = MODES.NONE) {
    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] updateFocusOverlayElementStyling called with:', {
        element: element?.tagName,
        mode: mode,
        _useDomHoverFocusColors: this._useDomHoverFocusColors
      });
    }

    // Clear any existing element styling first
    this.clearElementFocusStyling();

    if (!element) {
      return;
    }

    // In the wild (e.g. Engadget), an inline <a> sometimes wraps a block/flex child (<div>),
    // which causes the anchor to be split into multiple inline fragments. Outline/box-shadow
    // then renders as disjoint pieces (often thin strips). When we detect this, we style a
    // better single-rect descendant (usually the anchor's wrapper) instead of the anchor.
    let stylingTarget = this._resolveElementForFocusStyling(element) || element;

    // Absolute fill-link inside a clipping thumb frame: paint the frame so outer
    // outline wraps site border chrome (Rumble live red thumbs) instead of an
    // inset ring under that border. Activation focusEl stays the <a>.
    try {
      const frame = this._resolveAbsoluteClipFramePaintHost(stylingTarget);
      if (frame) stylingTarget = frame;
    } catch { /* ignore */ }

    // Optional clip-aware paint (flags in FEATURE_FLAGS — see constants.js).
    // Never mutate page overflow (broke IMDb carousels). Prefer painting on the
    // real hover target so data-kp-focus lands on the clickable <a>, not a parent.
    let clipCtx = { clippers: [], tightWrapper: null };
    const clipInsetOn = !!(FEATURE_FLAGS && FEATURE_FLAGS.ENABLE_FOCUS_CLIP_INSET);
    const tightPromoteOn = !!(FEATURE_FLAGS && FEATURE_FLAGS.ENABLE_FOCUS_TIGHT_WRAPPER_PROMOTION);
    if (clipInsetOn || tightPromoteOn) {
      try {
        clipCtx = this._findFocusClipContext(stylingTarget);
      } catch {
        clipCtx = { clippers: [], tightWrapper: null };
      }
      if (
        tightPromoteOn &&
        clipCtx.tightWrapper &&
        clipCtx.tightWrapper.nodeType === 1
      ) {
        stylingTarget = clipCtx.tightWrapper;
      }
    }

    // Don't style modal/popover iframes
    try {
      if (stylingTarget.tagName === 'IFRAME') {
        const isPopoverIframe = this.popoverIframeElement && stylingTarget === this.popoverIframeElement;
        const isModalIframe = !!(stylingTarget.classList && stylingTarget.classList.contains('modal-iframe'));
        if (isPopoverIframe || isModalIframe) {
          return;
        }
      }
    } catch { /* ignore */ }

    // Determine styling based on element type and mode
    // Category/fill decisions stay on the original hover target when we promoted
    // the ring to a tight wrapper.
    const categorySource = element;
    const isTextInput = categorySource.matches && categorySource.matches(SELECTORS.FOCUSABLE_TEXT);
    const suppressFill = this.shouldSuppressFocusFill(categorySource);

    // Settings-driven focus chrome (color / thickness / fill / shadow).
    const {
      rectangleThickness,
      overlayFillEnabled,
      overlayShadowEnabled,
      focusColor
    } = this._getClickModeSettings();
    const palette = this._getNonTextFocusPalette(focusColor);
    const ringColor = isTextInput ? COLORS.ORANGE : palette.borderColor;
    const ringWidthPx = Math.min(Math.max(Number(rectangleThickness) || 3, 1), 16);
    const ringWidth = `${ringWidthPx}px`;
    const shadowColor = isTextInput ? COLORS.ORANGE_SHADOW : palette.shadowColor;
    const shadowBright = isTextInput ? COLORS.ORANGE_SHADOW : palette.shadowBrightColor;
    // Translucent wash for thumbnails/links; none for scrubbers / when fill disabled.
    let ringBgColor = 'transparent';
    if (!suppressFill && overlayFillEnabled !== false) {
      ringBgColor = isTextInput
        ? 'rgba(255,140,0,0.2)'
        : (palette.backgroundColor || 'rgba(33,150,243,0.25)');
    }
    const boxShadow = overlayShadowEnabled === false
      ? 'none'
      : `0 0 0 2px ${shadowColor}, 0 0 10px 2px ${shadowBright}`;

    // Graded outline-offset from clip-ancestor room (not binary outer vs full inset).
    const outlineOffsetPx = clipInsetOn
      ? this._computeGradedFocusOutlineOffset(stylingTarget, ringWidthPx)
      : this._preferredFocusOutlineOffsetPx();
    const useInset = outlineOffsetPx < -0.25;

    // Shadow DOM: document CSS does not pierce; inject into this root on first use.
    this._ensureStylesForElement(stylingTarget);

    // Apply styling using CSS custom properties
    stylingTarget.style.setProperty('--keypilot-focus-ring-color', ringColor);
    stylingTarget.style.setProperty('--keypilot-focus-ring-width', ringWidth);
    stylingTarget.style.setProperty('--keypilot-focus-outline-offset', `${outlineOffsetPx}px`);
    stylingTarget.style.setProperty('--keypilot-focus-shadow-color', shadowColor);
    stylingTarget.style.setProperty('--keypilot-focus-ring-bg-color', ringBgColor);
    stylingTarget.style.setProperty('--keypilot-focus-box-shadow', boxShadow);

    // Outline follows the element's own border-radius. Many video thumbs put
    // radius on img / wrapper (12px) while the clickable <a> is square (0) —
    // without this the ring looks like a hard outer box around rounded media.
    // Only inject radius when the paint target itself has none.
    try {
      const ownRadius = this._readNonZeroBorderRadius(stylingTarget);
      if (!ownRadius) {
        const visualRadius = this._resolveElementBorderRadius(stylingTarget);
        if (visualRadius) {
          stylingTarget.style.setProperty('border-radius', visualRadius, 'important');
          stylingTarget.setAttribute('data-kp-focus-radius-set', '1');
        }
      }
    } catch { /* ignore */ }

    // Class + data attributes. Prefer data-kp-focus for paint (CSS): SPAs often
    // strip unknown classes on re-render but leave data-* alone.
    stylingTarget.classList.add('keypilot-focus-element');
    // Only wash the background when a fill color is actually set — never wipe the
    // element's own background with transparent on hover.
    if (ringBgColor !== 'transparent') {
      stylingTarget.classList.add('keypilot-focus-element--fill');
    } else {
      stylingTarget.classList.remove('keypilot-focus-element--fill');
    }
    try {
      stylingTarget.setAttribute('data-kp-focus', '1');
      if (useInset) stylingTarget.setAttribute('data-kp-focus-inset', '1');
      else stylingTarget.removeAttribute('data-kp-focus-inset');
    } catch { /* ignore */ }
    if (useInset) stylingTarget.classList.add('keypilot-focus-element--inset');
    else stylingTarget.classList.remove('keypilot-focus-element--inset');

    // Shadow trees: also paint outline inline. Injected <style> can be wiped by
    // Lit re-renders, and closed-shadow nodes from composedPath cannot receive
    // stylesheet injection — inline outline is the reliable source of truth.
    if (this._isInShadowTree(stylingTarget)) {
      try {
        stylingTarget.setAttribute('data-kp-focus-inline', '1');
        stylingTarget.style.setProperty(
          'outline',
          `${ringWidth} solid ${ringColor}`,
          'important'
        );
        stylingTarget.style.setProperty(
          'outline-offset',
          `${outlineOffsetPx}px`,
          'important'
        );
        stylingTarget.style.setProperty('box-shadow', boxShadow, 'important');
      } catch { /* ignore */ }
    }

    // Store reference for cleanup
    this._currentStyledElement = stylingTarget;

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Applied element styling:', {
        tagName: stylingTarget.tagName,
        originalTagName: element?.tagName,
        styledDifferentElement: stylingTarget !== element,
        outlineOffsetPx,
        useInset: useInset,
        clipInsetFlag: clipInsetOn,
        tightPromoteFlag: tightPromoteOn,
        tightWrapper: !!(clipCtx && clipCtx.tightWrapper),
        minRoom: this._minFocusOutlineRoomPx(stylingTarget),
        ringColor: ringColor,
        isTextInput: isTextInput
      });
    }
  }

  /**
   * Largest in-tree descendant with a positive box (for collapsed anchors that
   * only wrap position:absolute media — e.g. Breitbart video carousel thumbs).
   * Pierces open shadow roots (archive.org media-button / collection-tile hosts
   * often have empty light DOM with the visual tree only in shadow).
   * @param {HTMLElement} element
   * @returns {HTMLElement|null}
   */
  _findLargestVisibleDescendant(element) {
    if (!element || element.nodeType !== 1) return null;
    let best = null;
    let bestArea = 0;
    let visited = 0;
    const maxNodes = 48;
    /** @type {Element[]} */
    const queue = [];
    this._enqueueShadowPiercingChildren(element, queue);
    while (queue.length && visited < maxNodes) {
      const cur = queue.shift();
      if (!cur || cur.nodeType !== 1) continue;
      visited++;
      let r = null;
      try { r = cur.getBoundingClientRect(); } catch { r = null; }
      if (r && r.width >= 8 && r.height >= 8) {
        const area = r.width * r.height;
        if (area > bestArea) {
          bestArea = area;
          best = /** @type {HTMLElement} */ (cur);
        }
      }
      this._enqueueShadowPiercingChildren(cur, queue);
    }
    return best;
  }

  /**
   * Inline host whose border/line box is much smaller than a replaced child
   * (phoronix.com logo: `a { display:inline }` → line-box ~1em tall, child
   * `<img>` is the real visual). Outline/flash on the host uses the line box
   * and misses the image; prefer the replaced child for paint.
   *
   * @param {Element} el
   * @returns {Element|null}
   */
  _findDominantReplacedPaintChild(el) {
    if (!el || el.nodeType !== 1) return null;

    let display = '';
    try { display = String(window.getComputedStyle(el)?.display || ''); } catch { display = ''; }
    // Line-box under-measurement is an inline / inline-level issue.
    if (display && !display.startsWith('inline') && display !== 'contents') {
      return null;
    }

    let hostBox = null;
    try { hostBox = el.getBoundingClientRect(); } catch { hostBox = null; }
    const hostArea = (hostBox && hostBox.width > 0 && hostBox.height > 0)
      ? (hostBox.width * hostBox.height)
      : 0;

    /** @type {Element|null} */
    let best = null;
    let bestArea = 0;

    const consider = (node) => {
      if (!node || node.nodeType !== 1 || node === el) return;
      if (!this._isMediaLikeCoverElement(node) && !this._isReplacedOrVoidElement(node)) {
        // Also accept bare IMG/VIDEO even if media-like helper is strict.
        const tag = String(node.tagName || '').toUpperCase();
        if (tag !== 'IMG' && tag !== 'VIDEO' && tag !== 'CANVAS' && tag !== 'SVG') return;
      }
      let r = null;
      try { r = node.getBoundingClientRect(); } catch { r = null; }
      if (!r || !(r.width >= 8) || !(r.height >= 8)) return;
      const area = r.width * r.height;
      if (area <= bestArea) return;
      // Child must be meaningfully larger than the host line box.
      if (hostArea > 0) {
        const taller = r.height > hostBox.height * 1.2 + 2;
        const wider = r.width > hostBox.width * 1.05 + 2;
        const biggerArea = area > hostArea * 1.35;
        if (!taller && !wider && !biggerArea) return;
      }
      bestArea = area;
      best = node;
    };

    try {
      // Prefer direct structure: a > img (phoronix logo).
      const kids = el.children;
      if (kids) {
        for (let i = 0; i < kids.length; i++) {
          const k = kids[i];
          if (!k || k.nodeType !== 1) continue;
          const tag = String(k.tagName || '').toUpperCase();
          if (tag === 'PICTURE') {
            try {
              const img = k.querySelector('img');
              if (img) consider(img);
            } catch { /* ignore */ }
          } else {
            consider(k);
          }
        }
      }
    } catch { /* ignore */ }

    if (!best) {
      try {
        const media = el.querySelectorAll('img, video, canvas, svg');
        for (let i = 0; i < media.length && i < 12; i++) consider(media[i]);
      } catch { /* ignore */ }
    }

    return best;
  }

  /**
   * Choose the best element to apply the focus ring styling to.
   *
   * Problems:
   * 1) Inline anchors that wrap only position:absolute media collapse to 0×0
   *    (Breitbart video thumbs) — outline on the <a> is invisible.
   * 2) Inline anchors that wrap a larger replaced child (phoronix logo img):
   *    host getBoundingClientRect is only the line box (~1em); outline on the
   *    <a> protrudes / mismatches the image. Paint the <img> instead.
   * 3) Inline elements that contain block children can be split into multiple
   *    inline fragments, causing outline/box-shadow to render as disjoint pieces.
   * 4) Open-shadow custom-element hosts can be collapsed (archive.org
   *    media-button ~79×0) while the real clickable lives inside the shadow.
   *
   * Strategy:
   * - If the element has no usable box, style the largest visible descendant
   *   (piercing open shadows) or a sized composed parent that wraps abspos content.
   * - If inline host is dominated by a larger replaced child, style that child.
   * - If `element.getClientRects()` indicates fragmentation (2+ rects) and
   *   element is inline-ish, find the largest single-rect descendant.
   * - Otherwise, return `element`.
   *
   * @param {HTMLElement} element
   * @returns {HTMLElement}
   */
  _resolveElementForFocusStyling(element) {
    if (!element || element.nodeType !== 1) return element;

    // Collapsed clickable (0×0) with visible abspos / shadow children — paint on media.
    let br = null;
    try { br = element.getBoundingClientRect(); } catch { br = null; }
    if (!br || br.width < 2 || br.height < 2) {
      const descendant = this._findLargestVisibleDescendant(element);
      if (descendant) return descendant;

      // No sized descendant: try composed parent that actually boxes the abspos content
      // (e.g. .video-image { position: relative } wrapping the collapsed <a>).
      try {
        let p = this._composedParent(element);
        let hops = 0;
        while (p && p.nodeType === 1 && hops++ < 4) {
          if (p === document.body || p === document.documentElement) break;
          let pr = null;
          try { pr = p.getBoundingClientRect(); } catch { pr = null; }
          if (pr && pr.width >= 8 && pr.height >= 8) {
            return /** @type {HTMLElement} */ (p);
          }
          p = this._composedParent(p);
        }
      } catch { /* ignore */ }
      return element;
    }

    // Inline line-box host with a larger logo/media child (single client rect).
    try {
      const replaced = this._findDominantReplacedPaintChild(element);
      if (replaced) return /** @type {HTMLElement} */ (replaced);
    } catch { /* ignore */ }

    let rects = null;
    try { rects = element.getClientRects(); } catch { rects = null; }
    if (!rects || rects.length < 2) return element;

    // Only apply fragmentation heuristic for inline-ish elements.
    let display = '';
    try { display = String(window.getComputedStyle(element)?.display || ''); } catch { display = ''; }
    const inlineish = display.startsWith('inline');
    if (!inlineish) return element;

    // Compute union rect (viewport coords) of the fragmented element.
    let uLeft = Infinity, uTop = Infinity, uRight = -Infinity, uBottom = -Infinity;
    try {
      for (const r of rects) {
        uLeft = Math.min(uLeft, r.left);
        uTop = Math.min(uTop, r.top);
        uRight = Math.max(uRight, r.right);
        uBottom = Math.max(uBottom, r.bottom);
      }
    } catch {
      return element;
    }
    if (!Number.isFinite(uLeft) || !Number.isFinite(uTop) || !Number.isFinite(uRight) || !Number.isFinite(uBottom)) return element;

    // Search a small subtree for a single-rect box that best matches the visible area.
    // Prefer the largest-area candidate to get the wrapper (e.g. a flex div) rather than an <img>.
    let best = null;
    let bestArea = 0;
    let nodesVisited = 0;
    const maxNodes = 40;
    const maxDepth = 4;

    const queue = [{ el: element, depth: 0 }];
    while (queue.length && nodesVisited < maxNodes) {
      const cur = queue.shift();
      const curEl = cur?.el;
      const d = cur?.depth ?? 0;
      if (!curEl || curEl.nodeType !== 1) continue;
      nodesVisited++;

      if (curEl !== element) {
        let cr = null;
        try { cr = curEl.getClientRects(); } catch { cr = null; }
        if (cr && cr.length === 1) {
          const r0 = cr[0];
          const w = Number(r0.width);
          const h = Number(r0.height);
          const area = (Number.isFinite(w) ? w : 0) * (Number.isFinite(h) ? h : 0);
          if (area > bestArea) {
            // Ensure candidate overlaps union rect and is plausibly the visual wrapper.
            const overlaps = !(r0.right <= uLeft || r0.left >= uRight || r0.bottom <= uTop || r0.top >= uBottom);
            if (overlaps) {
              bestArea = area;
              best = curEl;
            }
          }
        }
      }

      if (d >= maxDepth) continue;
      try {
        /** @type {Element[]} */
        const childList = [];
        this._enqueueShadowPiercingChildren(curEl, childList);
        for (let i = 0; i < childList.length; i++) {
          const k = childList[i];
          if (k && k.nodeType === 1) queue.push({ el: /** @type {HTMLElement} */ (k), depth: d + 1 });
          if (queue.length > maxNodes) break;
        }
      } catch { /* ignore */ }
    }

    return best || element;
  }

  /**
   * Strip KeyPilot focus ring classes/vars from a single element.
   * @param {Element|null|undefined} el
   */
  _stripFocusStylingFromElement(el) {
    if (!el || el.nodeType !== 1) return;
    try {
      el.classList.remove('keypilot-focus-element');
      el.classList.remove('keypilot-focus-element--inset');
      el.classList.remove('keypilot-focus-element--fill');
      try {
        el.removeAttribute('data-kp-focus');
        el.removeAttribute('data-kp-focus-inset');
        el.style.removeProperty('--keypilot-focus-outline-offset');
        el.style.removeProperty('--keypilot-focus-ring-color');
        el.style.removeProperty('--keypilot-focus-ring-width');
        el.style.removeProperty('--keypilot-focus-shadow-color');
        el.style.removeProperty('--keypilot-focus-ring-bg-color');
        el.style.removeProperty('--keypilot-focus-box-shadow');
        // Undo radius we injected so outline could match visual media corners.
        if (el.getAttribute('data-kp-focus-radius-set') === '1') {
          el.style.removeProperty('border-radius');
          el.removeAttribute('data-kp-focus-radius-set');
        }
        // Undo inline outline used for shadow-tree paint reliability.
        if (el.getAttribute('data-kp-focus-inline') === '1') {
          el.style.removeProperty('outline');
          el.style.removeProperty('outline-offset');
          el.style.removeProperty('box-shadow');
          el.removeAttribute('data-kp-focus-inline');
        }
      } catch { /* ignore */ }
      el.style.removeProperty('--keypilot-focus-ring-color');
      el.style.removeProperty('--keypilot-focus-ring-width');
      el.style.removeProperty('--keypilot-focus-shadow-color');
      el.style.removeProperty('--keypilot-focus-ring-bg-color');
      el.style.removeProperty('--keypilot-focus-box-shadow');
      el.style.removeProperty('filter');
    } catch { /* ignore */ }
  }

  /**
   * Clear focus styling from the currently styled element.
   * Also sweeps the owning open ShadowRoot (and document) for leftovers —
   * Lit re-renders / resolve-target swaps can strand the class on a node we
   * no longer hold in `_currentStyledElement`, which looks like "stuck" hover.
   *
   * @param {{ deep?: boolean }} [opts] - deep: walk all open shadow roots
   *   (used on full hide / mode switch to kill ghost rings on archive.org).
   */
  clearElementFocusStyling(opts = {}) {
    const deep = !!(opts && opts.deep);
    const primary = this._currentStyledElement;
    this._currentStyledElement = null;

    this._stripFocusStylingFromElement(primary);

    // Sweep the last styled tree scope for any stranded focus rings.
    let root = null;
    try {
      root = primary && typeof primary.getRootNode === 'function'
        ? primary.getRootNode()
        : null;
    } catch { root = null; }

    const roots = [];
    if (root && typeof root.querySelectorAll === 'function') roots.push(root);
    // Always also check the document — light-DOM leftovers.
    try { roots.push(document); } catch { /* ignore */ }

    for (const r of roots) {
      try {
        const stranded = r.querySelectorAll(
          '.keypilot-focus-element, .keypilot-focus-element--inset, [data-kp-focus], [data-kp-focus-inline]'
        );
        for (const el of stranded) {
          this._stripFocusStylingFromElement(el);
        }
      } catch { /* ignore */ }
    }

    if (deep) {
      try { this._deepStripFocusMarkers(document); } catch { /* ignore */ }
    }
  }

  /**
   * Walk open shadow trees and strip any leftover hover-ring markers.
   * @param {Document|ShadowRoot|Element} root
   * @param {number} [depth]
   */
  _deepStripFocusMarkers(root, depth = 0) {
    if (!root || depth > 24) return;

    try {
      if (typeof root.querySelectorAll === 'function') {
        const stranded = root.querySelectorAll(
          '.keypilot-focus-element, .keypilot-focus-element--inset, [data-kp-focus], [data-kp-focus-inline]'
        );
        for (const el of stranded) {
          this._stripFocusStylingFromElement(el);
        }
      }
    } catch { /* ignore */ }

    try {
      const base = (root.nodeType === 9) ? root.documentElement : root;
      if (!base) return;

      if (base.nodeType === 1 && base.shadowRoot) {
        this._deepStripFocusMarkers(base.shadowRoot, depth + 1);
      }

      const w = document.createTreeWalker(base, NodeFilter.SHOW_ELEMENT, null);
      let n;
      while ((n = w.nextNode())) {
        if (n.shadowRoot) {
          this._deepStripFocusMarkers(n.shadowRoot, depth + 1);
        }
      }
    } catch { /* ignore */ }
  }

  /**
   * @param {Element|null} element - paint / geometry target
   * @param {string} [mode]
   * @param {object|null} [rectOverride]
   * @param {{ colorFrom?: Element|null }} [opts] - semantic source for text→orange
   *   when geometry was lifted to a wrapper
   */
  updateFocusOverlayDOM(element, mode = MODES.NONE, rectOverride = null, opts = null) {
    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] updateFocusOverlayDOM called with:', {
        element: element?.tagName,
        mode: mode,
        rectOverride: rectOverride,
        _useDomHoverFocusColors: this._useDomHoverFocusColors
      });
    }

    if (!element) {
      this.hideFocusOverlay();
      return;
    }

    // Don't outline modal/popover iframes. The top document cannot see inside an iframe,
    // so outlining the iframe itself is usually distracting (especially for extension-page
    // iframes like Settings/Guide).
    try {
      if (element.tagName === 'IFRAME') {
        const isPopoverIframe = this.popoverIframeElement && element === this.popoverIframeElement;
        const isModalIframe = !!(element.classList && element.classList.contains('modal-iframe'));
        if (isPopoverIframe || isModalIframe) {
          this.hideFocusOverlay();
          return;
        }
      }
    } catch { /* ignore */ }

    // Determine if this is a text input element (prefer semantic focusEl when paint ≠ focus)
    const colorEl = (opts && opts.colorFrom && opts.colorFrom.nodeType === 1)
      ? opts.colorFrom
      : element;
    const isTextInput = colorEl.matches && colorEl.matches(SELECTORS.FOCUSABLE_TEXT);
    const suppressFill = this.shouldSuppressFocusFill(colorEl);

    // We'll use this rect both for sizing/positioning and for deciding whether to render a fill.
    // Clip to ancestor overflow / viewport — raw GBR ignores overflow:hidden.
    let rect = (rectOverride && typeof rectOverride === 'object')
      ? rectOverride
      : this.getBestRect(element);
    rect = this._clipViewportRectToVisible(element, rect);
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) {
      this.hideFocusOverlay();
      return;
    }
    // If the hover target is extremely large, a filled overlay becomes distracting; keep just the frame.
    const isVeryLarge = rect && rect.width > 512 && rect.height > 512;
    
    // Determine overlay color based on element type
    let borderColor, shadowColor, backgroundColor;
    if (isTextInput) {
      // Orange color for text inputs in both normal mode and text focus mode
      borderColor = COLORS.ORANGE;
      shadowColor = COLORS.ORANGE_SHADOW;
      backgroundColor = 'transparent';
    } else {
      const p = this._getNonTextFocusPalette();
      borderColor = p.borderColor;
      shadowColor = p.shadowColor;
      // Fill for thumbnails/links; suppress for scrubbers and players that have a seek bar.
      backgroundColor = (suppressFill || isVeryLarge) ? 'transparent' : p.backgroundColor;
    }

    // Settings-driven behavior for Click Mode focus rectangle.
    const {
      rectangleThickness,
      overlayFillEnabled,
      overlayShadowEnabled,
      focusColor
    } = this._getClickModeSettings();
    if (!isTextInput && !suppressFill && !isVeryLarge && overlayFillEnabled === false) {
      backgroundColor = 'transparent';
    }
    // Re-resolve palette colors when settings focusColor is available (non-text).
    if (!isTextInput) {
      const p = this._getNonTextFocusPalette(focusColor);
      borderColor = p.borderColor;
      shadowColor = p.shadowColor;
      if (overlayFillEnabled !== false && !suppressFill && !isVeryLarge) {
        backgroundColor = p.backgroundColor;
      }
    }

    // Debug logging
    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] updateFocusOverlay called for:', {
        tagName: element.tagName,
        className: element.className,
        text: element.textContent?.substring(0, 30),
        mode: mode,
        isTextInput: isTextInput,
        suppressFill: suppressFill,
        isVeryLarge: isVeryLarge,
        borderColor: borderColor
      });
    }

    if (!this.focusOverlay) {
      this.focusOverlay = this.createElement('div', {
        className: CSS_CLASSES.FOCUS_OVERLAY,
        style: `
          position: fixed;
          left: 0;
          top: 0;
          pointer-events: none;
          z-index: ${Z_INDEX.OVERLAYS};
          background: ${backgroundColor};
          will-change: transform, width, height;
        `
      });
      document.body.appendChild(this.focusOverlay);
      
      // Debug logging for overlay creation
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Focus overlay created and added to DOM:', {
          element: this.focusOverlay,
          className: this.focusOverlay.className,
          style: this.focusOverlay.style.cssText,
          parent: this.focusOverlay.parentElement?.tagName
        });
      }
      
      // Start observing the overlay for visibility optimization
      if (this.overlayObserver) {
        this.overlayObserver.observe(this.focusOverlay);
      }
    }

    // Update overlay colors based on current context
    // Ensure any previous fade-out is cancelled when we re-show/update the overlay.
    this.focusOverlay.style.opacity = '1';
    this.focusOverlay.style.border = `${rectangleThickness}px solid ${borderColor}`;
    this.focusOverlay.style.background = backgroundColor;
    this.focusOverlay.style.boxSizing = 'border-box';
    // Strategy C: match target corner radius (A inherits it; fixed layer does not).
    // Prefer the element itself, else a large rounded descendant (card tile / media).
    try {
      const radius = this._resolveElementBorderRadius(element);
      this.focusOverlay.style.borderRadius = radius || '0';
    } catch {
      this.focusOverlay.style.borderRadius = '0';
    }
    if (overlayShadowEnabled === false) {
      this.focusOverlay.style.boxShadow = 'none';
    } else {
      const brightShadowColor = isTextInput
        ? COLORS.ORANGE_SHADOW
        : this._getNonTextFocusPalette(focusColor).shadowBrightColor;
      this.focusOverlay.style.boxShadow = `0 0 0 2px ${shadowColor}, 0 0 10px 2px ${brightShadowColor}`;
    }
    
    // Debug logging for positioning
    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Focus overlay positioning:', {
        rect: rect,
        overlayExists: !!this.focusOverlay,
        overlayVisibility: this.overlayVisibility.focus
      });
    }
    
    if (rect.width > 0 && rect.height > 0) {
      // Position via transform to reduce layout work (fixed + translate3d).
      this.focusOverlay.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
      this.focusOverlay.style.width = `${rect.width}px`;
      this.focusOverlay.style.height = `${rect.height}px`;
      this.focusOverlay.style.display = 'block';
      this.focusOverlay.style.visibility = 'visible';
      
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Focus overlay positioned at:', {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        });
      }
    } else {
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Focus overlay hidden - invalid rect:', rect);
      }
      this.hideFocusOverlay();
    }
  }

  // Unified hide interface that switches between rendering modes
  hideFocusOverlay() {
    // DOM-hover: clear A markers, B in-target ring, and C fixed overlay so
    // hybrid paint never leaves a ghost ring.
    if (this._useDomHoverFocusColors) {
      this._focusPaintUsesFixedOverlay = false;
      this._focusPaintUsesInTargetRing = false;
      this.clearElementFocusStyling({ deep: false });
      this.hideInTargetFocusRing();
      this.hideFocusOverlayDOM();
      return;
    }

    switch (this.renderingMode) {
      case 'canvas':
        return this.hideFocusOverlayCanvas();
      case 'css-custom-props':
        return this.hideFocusOverlayCSSCustomProps();
      case 'dom':
      default:
        return this.hideFocusOverlayDOM();
    }
  }

  hideFocusOverlayDOM() {
    if (this.focusOverlay) {
      this.focusOverlay.style.display = 'none';
    }
  }

  /**
   * Set the rendering mode for overlays
   * @param {string} mode - 'dom', 'canvas', or 'css-custom-props'
   */
  setRenderingMode(mode) {
    if (!['dom', 'canvas', 'css-custom-props'].includes(mode)) {
      console.warn('[KeyPilot] Invalid rendering mode:', mode);
      return;
    }

    // Cleanup current renderer
    this.cleanupRenderingMode();

    // Set new mode and initialize
    this.renderingMode = mode;
    this.initRenderingMode();

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Rendering mode changed to:', mode);
    }
  }

  initRenderingMode() {
    switch (this.renderingMode) {
      case 'canvas':
        this.initCanvasRenderer();
        break;
      case 'css-custom-props':
        this.initCSSCustomPropsRenderer();
        break;
      case 'dom':
      default:
        // DOM renderer doesn't need explicit initialization
        break;
    }
  }

  cleanupRenderingMode() {
    switch (this.renderingMode) {
      case 'canvas':
        this.cleanupCanvasRenderer();
        break;
      case 'css-custom-props':
        this.cleanupCSSCustomPropsRenderer();
        break;
      case 'dom':
      default:
        // DOM renderer cleanup happens in cleanup() method
        break;
    }
  }

  /**
   * Fade out the focus overlay rect, then hide it.
   * Useful after clicks that mutate the DOM (accordions, menus, etc.) so we don't leave a stale rect.
   */
  fadeOutFocusOverlay(durationMs = 120) {
    if (this.renderingMode === 'dom' && this.focusOverlay) {
      if (this.focusOverlay.style.display === 'none') return;

      // Avoid stacking transitions; we'll reset after the fade completes.
      this.focusOverlay.style.transition = `opacity ${durationMs}ms ease-out`;
      this.focusOverlay.style.opacity = '0';

      window.setTimeout(() => {
        if (!this.focusOverlay) return;
        // Only hide if we're still faded out (another update may have brought it back).
        if (this.focusOverlay.style.opacity === '0') {
          this.hideFocusOverlay();
        }
        // Clear transition so other overlay updates don't inherit this timing.
        if (this.focusOverlay) {
          this.focusOverlay.style.transition = '';
        }
      }, durationMs);
    } else {
      // For canvas and CSS custom props, just hide immediately
      this.hideFocusOverlay();
    }
  }

  /**
   * Shared inspector outline for any pick tool kind.
   * @param {Element|null|undefined} element
   * @param {string|null|undefined} kind
   */
  updateInspectorOverlay(element, kind = null) {
    if (!element) {
      this.hideInspectorOverlay();
      return;
    }

    const def = getInspectorDef(kind);
    const border = def?.borderColor || COLORS.DELETE_RED;
    const shadow = def?.shadowColor || COLORS.DELETE_SHADOW;
    const shadowBright = def?.shadowBrightColor || COLORS.DELETE_SHADOW_BRIGHT;

    if (!this.inspectorOverlay) {
      this.inspectorOverlay = this.createElement('div', {
        className: CSS_CLASSES.INSPECTOR_OVERLAY || CSS_CLASSES.DELETE_OVERLAY,
        style: `
          position: fixed;
          pointer-events: none;
          z-index: ${Z_INDEX.OVERLAYS};
          border: 3px solid ${border};
          box-shadow: 0 0 0 2px ${shadow}, 0 0 12px 2px ${shadowBright};
          background: transparent;
          will-change: transform;
        `
      });
      document.body.appendChild(this.inspectorOverlay);
      // Back-compat alias
      this.deleteOverlay = this.inspectorOverlay;
      if (this.overlayObserver) {
        this.overlayObserver.observe(this.inspectorOverlay);
      }
    }

    // Restyle when kind changes
    if (kind && kind !== this._inspectorOverlayKind) {
      this._inspectorOverlayKind = kind;
      this.inspectorOverlay.style.border = `3px solid ${border}`;
      this.inspectorOverlay.style.boxShadow =
        `0 0 0 2px ${shadow}, 0 0 12px 2px ${shadowBright}`;
      try {
        this.inspectorOverlay.setAttribute('data-kp-inspector-kind', kind);
      } catch { /* ignore */ }
    }

    const rect = this.getBestRect(element);
    if (rect.width > 0 && rect.height > 0) {
      this.inspectorOverlay.style.left = `${rect.left}px`;
      this.inspectorOverlay.style.top = `${rect.top}px`;
      this.inspectorOverlay.style.width = `${rect.width}px`;
      this.inspectorOverlay.style.height = `${rect.height}px`;
      this.inspectorOverlay.style.display = 'block';
      this.inspectorOverlay.style.visibility = 'visible';
    } else {
      this.hideInspectorOverlay();
    }
  }

  hideInspectorOverlay() {
    if (this.inspectorOverlay) {
      this.inspectorOverlay.style.display = 'none';
    }
  }

  /**
   * Paint persistent outlines for cumulatively picked elements + union rect.
   * @param {Element[]} elements
   * @param {{ left: number, top: number, width: number, height: number }|null} unionRect
   * @param {string|null|undefined} kind
   */
  updateInspectorPickedOverlays(elements, unionRect, kind = null) {
    const def = getInspectorDef(kind);
    const border = def?.borderColor || COLORS.HIGHLIGHT_BLUE;
    const fill = COLORS.HIGHLIGHT_SELECTION_BG || 'rgba(0,120,255,0.3)';

    if (!this._inspectorPickedOverlays) this._inspectorPickedOverlays = [];

    // Clear previous per-element overlays
    for (const ov of this._inspectorPickedOverlays) {
      try { ov.remove(); } catch { /* ignore */ }
    }
    this._inspectorPickedOverlays = [];

    const list = Array.isArray(elements) ? elements : [];
    for (const el of list) {
      if (!el || !el.isConnected) continue;
      const rect = this.getBestRect(el);
      if (rect.width <= 0 || rect.height <= 0) continue;
      const ov = this.createElement('div', {
        className: CSS_CLASSES.INSPECTOR_PICKED_OVERLAY || 'kpv2-inspector-picked-overlay',
        style: `
          position: fixed;
          pointer-events: none;
          z-index: ${Z_INDEX.OVERLAYS_BELOW};
          left: ${rect.left}px;
          top: ${rect.top}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          border: 2px solid ${border};
          background: ${fill};
          box-sizing: border-box;
        `
      });
      try { document.body.appendChild(ov); } catch { /* ignore */ }
      this._inspectorPickedOverlays.push(ov);
    }

    // Union rect overlay
    if (!this._inspectorUnionOverlay) {
      this._inspectorUnionOverlay = this.createElement('div', {
        className: CSS_CLASSES.INSPECTOR_UNION_OVERLAY || 'kpv2-inspector-union-overlay',
        style: `
          position: fixed;
          pointer-events: none;
          z-index: ${Z_INDEX.OVERLAYS_BELOW_2};
          border: 2px dashed ${border};
          background: transparent;
          box-sizing: border-box;
          display: none;
        `
      });
      try { document.body.appendChild(this._inspectorUnionOverlay); } catch { /* ignore */ }
    }

    if (unionRect && unionRect.width > 0 && unionRect.height > 0) {
      this._inspectorUnionOverlay.style.left = `${unionRect.left}px`;
      this._inspectorUnionOverlay.style.top = `${unionRect.top}px`;
      this._inspectorUnionOverlay.style.width = `${unionRect.width}px`;
      this._inspectorUnionOverlay.style.height = `${unionRect.height}px`;
      this._inspectorUnionOverlay.style.border = `2px dashed ${border}`;
      this._inspectorUnionOverlay.style.display = 'block';
    } else {
      this._inspectorUnionOverlay.style.display = 'none';
    }
  }

  clearInspectorPickedOverlays() {
    if (this._inspectorPickedOverlays) {
      for (const ov of this._inspectorPickedOverlays) {
        try { ov.remove(); } catch { /* ignore */ }
      }
      this._inspectorPickedOverlays = [];
    }
    if (this._inspectorUnionOverlay) {
      this._inspectorUnionOverlay.style.display = 'none';
    }
  }

  /**
   * Remember confirm-key / kind for the top-right instruction chip.
   * Call when entering inspector so updateOverlays can keep the chip visible.
   * @param {{ kind?: string|null, confirmKey?: string }} opts
   */
  setInspectorModeIndicatorOpts(opts = {}) {
    this._inspectorIndicatorOpts = {
      kind: opts.kind || null,
      confirmKey: opts.confirmKey || ''
    };
  }

  /**
   * Top-right companion instruction while inspector pick is active
   * (same pattern as Text Select "Press H again to finish selection").
   * @param {{ kind?: string|null, confirmKey?: string, message?: string }} [opts]
   */
  showInspectorModeIndicator(opts = {}) {
    const prev = this._inspectorIndicatorOpts || {};
    const kind = opts.kind || prev.kind || null;
    const confirmKey = opts.confirmKey || prev.confirmKey || '';
    if (opts.kind || opts.confirmKey) {
      this._inspectorIndicatorOpts = { kind, confirmKey };
    }

    const def = getInspectorDef(kind);
    const modeText = (opts.message && String(opts.message).trim())
      || getInspectorInstructionText(kind, confirmKey);

    const bg = def?.borderColor || COLORS.COLS_PURPLE;
    const shadow = def?.shadowColor || COLORS.COLS_SHADOW;

    if (this.inspectorModeIndicator) {
      this.inspectorModeIndicator.textContent = modeText;
      this.inspectorModeIndicator.style.display = 'block';
      this.inspectorModeIndicator.style.background = bg;
      this.inspectorModeIndicator.style.boxShadow = `0 2px 10px ${shadow}`;
      try {
        if (kind) this.inspectorModeIndicator.setAttribute('data-kp-inspector-kind', kind);
      } catch { /* ignore */ }
      return;
    }

    this.inspectorModeIndicator = this.createElement('div', {
      className: CSS_CLASSES.INSPECTOR_MODE_INDICATOR || 'kpv2-inspector-mode-indicator',
      style: `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bg};
        color: white;
        padding: 10px 14px;
        font-size: 14px;
        font-weight: bold;
        font-family: ${KP_UI_FONT};
        border-radius: 6px;
        box-shadow: 0 2px 10px ${shadow};
        z-index: ${Z_INDEX.MESSAGE_BOX};
        pointer-events: none;
        max-width: min(360px, calc(100vw - 40px));
        line-height: 1.35;
        will-change: transform, opacity;
        animation: kpv2-pulse 1.5s ease-in-out infinite;
        letter-spacing: 0.01em;
      `
    });
    try {
      if (kind) this.inspectorModeIndicator.setAttribute('data-kp-inspector-kind', kind);
    } catch { /* ignore */ }
    this.inspectorModeIndicator.textContent = modeText;
    try {
      document.body.appendChild(this.inspectorModeIndicator);
    } catch {
      try { document.documentElement.appendChild(this.inspectorModeIndicator); } catch { /* ignore */ }
    }
  }

  hideInspectorModeIndicator() {
    if (this.inspectorModeIndicator) {
      try { this.inspectorModeIndicator.remove(); } catch { /* ignore */ }
      this.inspectorModeIndicator = null;
    }
    this._inspectorIndicatorOpts = null;
  }

  /** @deprecated use updateInspectorOverlay(el, kind) */
  updateDeleteOverlay(element) {
    this.updateInspectorOverlay(element, 'delete');
  }

  /** @deprecated use hideInspectorOverlay() */
  hideDeleteOverlay() {
    this.hideInspectorOverlay();
  }

  /** @deprecated use updateInspectorOverlay(el, 'cols') */
  updateColsOverlay(element) {
    this.updateInspectorOverlay(element, 'cols');
  }

  /** @deprecated use hideInspectorOverlay() */
  hideColsOverlay() {
    this.hideInspectorOverlay();
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  updateHighlightRectangleOverlay(startPosition, currentPosition) {
    return this.highlightManager.updateHighlightRectangleOverlay(startPosition, currentPosition);
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  hideHighlightRectangleOverlay() {
    return this.highlightManager.hideHighlightRectangleOverlay();
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  removeHighlightRectangleOverlay() {
    return this.highlightManager.removeHighlightRectangleOverlay();
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  updateHighlightSelectionOverlays(selection) {
    return this.highlightManager.updateHighlightSelectionOverlays(selection);
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  clearHighlightSelectionOverlays() {
    return this.highlightManager.clearHighlightSelectionOverlays();
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  setSelectionMode(mode) {
    return this.highlightManager.setSelectionMode(mode);
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  getSelectionMode() {
    return this.highlightManager.getSelectionMode();
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  startCharacterSelection(position, findTextNodeAtPosition, getTextOffsetAtPosition) {
    return this.highlightManager.startCharacterSelection(position, findTextNodeAtPosition, getTextOffsetAtPosition);
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  updateCharacterSelection(currentPosition, startPosition, findTextNodeAtPosition, getTextOffsetAtPosition) {
    return this.highlightManager.updateCharacterSelection(currentPosition, startPosition, findTextNodeAtPosition, getTextOffsetAtPosition);
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  updateRectangleSelectionFromCarets(startPosition, currentPosition, findTextNodeAtPosition, getTextOffsetAtPosition) {
    return this.highlightManager.updateRectangleSelectionFromCarets(
      startPosition,
      currentPosition,
      findTextNodeAtPosition,
      getTextOffsetAtPosition
    );
  }

  updateElementRectangleSelection(startPosition, currentPosition) {
    return this.highlightManager.updateElementRectangleSelection(startPosition, currentPosition);
  }

  getMatchedElements() {
    return this.highlightManager.getMatchedElements?.() || [];
  }

  clearElementSelection() {
    return this.highlightManager.clearElementSelection?.();
  }

  /**
   * Live-refresh highlight rectangle + selection during scroll (document-anchored origin).
   */
  syncHighlightSelectionToScroll(currentViewportMouse, findTextNodeAtPosition, getTextOffsetAtPosition) {
    return this.highlightManager.syncSelectionToScroll(
      currentViewportMouse,
      findTextNodeAtPosition,
      getTextOffsetAtPosition
    );
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  peekCharacterSelectedText() {
    return this.highlightManager.peekCharacterSelectedText();
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  completeCharacterSelection() {
    return this.highlightManager.completeCharacterSelection();
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  clearCharacterSelection() {
    return this.highlightManager.clearCharacterSelection();
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  /**
   * Create selection overlays for a specific range with shadow DOM support
   * @param {Range} range - DOM Range object
   */
  createSelectionOverlaysForRangeWithShadowSupport(range) {
    if (!range || range.collapsed) {
      return;
    }

    try {
      // Get all rectangles for the range (handles multi-line selections)
      const rects = this.getClientRectsWithShadowSupport(range);
      
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        
        // Skip zero-width or zero-height rectangles
        if (rect.width <= 0 || rect.height <= 0) {
          continue;
        }

        // Create overlay element for this rectangle
        const overlay = this.createElement('div', {
          className: CSS_CLASSES.HIGHLIGHT_SELECTION,
          style: `
            position: fixed;
            left: ${rect.left}px;
            top: ${rect.top}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            background: ${COLORS.HIGHLIGHT_SELECTION_BG};
            border: 1px solid ${COLORS.HIGHLIGHT_SELECTION_BORDER};
            pointer-events: none;
            z-index: ${Z_INDEX.OVERLAYS_BELOW};
            will-change: transform;
          `
        });

        // Append to main document body (overlays should always be in main document)
        document.body.appendChild(overlay);
        this.highlightSelectionOverlays.push(overlay);

        // Start observing the overlay for visibility optimization
        if (this.overlayObserver) {
          this.overlayObserver.observe(overlay);
        }
      }

      if (window.KEYPILOT_DEBUG && rects.length > 0) {
        console.log('[KeyPilot Debug] Created selection overlays for range with shadow DOM support:', {
          rectCount: rects.length,
          firstRect: {
            left: rects[0].left,
            top: rects[0].top,
            width: rects[0].width,
            height: rects[0].height
          }
        });
      }
    } catch (error) {
      console.warn('[KeyPilot] Error creating selection overlays for range with shadow DOM support:', error);
    }
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  /**
   * Get client rectangles for a range with shadow DOM support
   * @param {Range} range - DOM Range object
   * @returns {DOMRectList|Array} - Client rectangles
   */
  getClientRectsWithShadowSupport(range) {
    try {
      // First try the standard method
      const rects = range.getClientRects();
      if (rects && rects.length > 0) {
        return rects;
      }

      // If no rectangles found, try alternative methods for shadow DOM
      return this.getAlternativeClientRects(range);
    } catch (error) {
      console.warn('[KeyPilot] Error getting client rects with shadow DOM support:', error);
      return [];
    }
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  /**
   * Get alternative client rectangles for shadow DOM ranges
   * @param {Range} range - DOM Range object
   * @returns {Array} - Array of rectangle objects
   */
  getAlternativeClientRects(range) {
    try {
      const rects = [];
      
      // Try to get bounding rect as fallback
      const boundingRect = range.getBoundingClientRect();
      if (boundingRect && boundingRect.width > 0 && boundingRect.height > 0) {
        rects.push(boundingRect);
      }
      
      // For shadow DOM, we might need to manually calculate rectangles
      // by walking through the range contents
      if (rects.length === 0) {
        const shadowRects = this.calculateShadowDOMRects(range);
        rects.push(...shadowRects);
      }
      
      return rects;
    } catch (error) {
      console.warn('[KeyPilot] Error getting alternative client rects:', error);
      return [];
    }
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  /**
   * Calculate rectangles for shadow DOM ranges manually
   * @param {Range} range - DOM Range object
   * @returns {Array} - Array of rectangle objects
   */
  calculateShadowDOMRects(range) {
    try {
      const rects = [];
      
      // Get start and end containers
      const startContainer = range.startContainer;
      const endContainer = range.endContainer;
      
      if (startContainer === endContainer && startContainer.nodeType === Node.TEXT_NODE) {
        // Single text node selection
        const textRect = this.getTextNodeRect(startContainer, range.startOffset, range.endOffset);
        if (textRect) {
          rects.push(textRect);
        }
      } else {
        // Multi-node selection - this is more complex for shadow DOM
        // For now, use bounding rect as approximation
        try {
          const boundingRect = range.getBoundingClientRect();
          if (boundingRect && boundingRect.width > 0 && boundingRect.height > 0) {
            rects.push(boundingRect);
          }
        } catch (error) {
          // Ignore errors in complex shadow DOM scenarios
        }
      }
      
      return rects;
    } catch (error) {
      console.warn('[KeyPilot] Error calculating shadow DOM rects:', error);
      return [];
    }
  }

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  /**
   * Get rectangle for a portion of a text node
   * @param {Text} textNode - Text node
   * @param {number} startOffset - Start character offset
   * @param {number} endOffset - End character offset
   * @returns {DOMRect|null} - Rectangle or null
   */
  getTextNodeRect(textNode, startOffset, endOffset) {
    try {
      const ownerDocument = textNode.ownerDocument || document;
      const tempRange = ownerDocument.createRange();
      tempRange.setStart(textNode, startOffset);
      tempRange.setEnd(textNode, endOffset);
      
      const rect = tempRange.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 ? rect : null;
    } catch (error) {
      console.warn('[KeyPilot] Error getting text node rect:', error);
      return null;
    }
  }

  /**
   * Create selection overlays for a specific range (legacy method for compatibility)
   * @param {Range} range - DOM Range object
   */
  createSelectionOverlaysForRange(range) {
    // Delegate to the shadow DOM-aware method
    this.createSelectionOverlaysForRangeWithShadowSupport(range);
  }

  calculateLabelPosition(elementRect, labelHeight) {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Try placing below the element first
    const belowPosition = {
      left: elementRect.left,
      top: elementRect.top + elementRect.height + 8,
      position: 'below'
    };
    
    // Check if below position is off-screen
    if (belowPosition.top + labelHeight > viewportHeight) {
      // Try above the element
      const abovePosition = {
        left: elementRect.left,
        top: elementRect.top - labelHeight - 8,
        position: 'above'
      };
      
      if (abovePosition.top < 0) {
        // Try right side if both above/below don't work
        return {
          left: elementRect.left + elementRect.width + 8,
          top: elementRect.top,
          position: 'right'
        };
      }
      return abovePosition;
    }
    return belowPosition;
  }

  updateEscExitLabelText(element) {
    if (!element) {
      this.hideEscExitLabelText();
      return;
    }

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] updateEscExitLabelText called for:', {
        tagName: element.tagName,
        className: element.className,
        id: element.id
      });
    }

    if (!this.escExitLabelText) {
      this.escExitLabelText = this.createElement('div', {
        className: CSS_CLASSES.ESC_EXIT_LABEL,
        style: `
          position: fixed;
          pointer-events: none;
          z-index: ${Z_INDEX.OVERLAYS_ABOVE};
          will-change: transform, opacity;
          font-family: Arial, sans-serif;
          font-size: 14px;
          padding: 4px 8px;
          border-radius: 4px;
          white-space: nowrap;
          background-color: ${COLORS.ORANGE_BG};
          color: ${COLORS.ORANGE_TEXT};
          border: 1px solid ${COLORS.ORANGE_BORDER_SOLID};
        `
      });
      this.escExitLabelText.innerHTML = 'Press <kbd>ESC</kbd> to exit';
      document.body.appendChild(this.escExitLabelText);
      this.labelHeight = this.escExitLabelText.offsetHeight;
      if (this.overlayObserver) this.overlayObserver.observe(this.escExitLabelText);
    }

    const rect = this.getBestRect(element);
    if (rect.width > 0 && rect.height > 0) {
      const position = this.calculateLabelPosition(rect, this.labelHeight);
      this.escExitLabelText.style.left = `${position.left}px`;
      this.escExitLabelText.style.top = `${position.top}px`;
      this.escExitLabelText.style.display = 'block';
      this.escExitLabelText.style.visibility = 'visible';
    } else {
      this.hideEscExitLabelText();
    }
  }

  updateEscExitLabelHover(element) {
    if (!element) {
      this.hideEscExitLabelHover();
      return;
    }

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] updateEscExitLabelHover called for:', {
        tagName: element.tagName,
        className: element.className,
        id: element.id
      });
    }

    if (!this.escExitLabelHover) {
      this.escExitLabelHover = this.createElement('div', {
        className: CSS_CLASSES.ESC_EXIT_LABEL,
        style: `
          position: fixed;
          pointer-events: none;
          z-index: ${Z_INDEX.OVERLAYS_ABOVE};
          will-change: transform, opacity;
          font-family: Arial, sans-serif;
          font-size: 14px;
          padding: 4px 8px;
          border-radius: 4px;
          white-space: nowrap;
          background-color: ${COLORS.FOCUS_GREEN_BG};
          color: ${COLORS.FOCUS_GREEN_TEXT};
          border: 1px solid ${COLORS.FOCUS_GREEN_SOLID};
        `
      });
      this.escExitLabelHover.innerHTML = this.formatHoverLabelText(this.hoverClickLabelText || 'F clicks');
      document.body.appendChild(this.escExitLabelHover);
      this.labelHeight = this.escExitLabelHover.offsetHeight;
      if (this.overlayObserver) this.overlayObserver.observe(this.escExitLabelHover);
    } else {
      // Keep label text fresh (e.g. countdown updates) even if element is reused.
      this.escExitLabelHover.innerHTML = this.formatHoverLabelText(this.hoverClickLabelText || 'F clicks');
    }

    const rect = this.getBestRect(element);
    if (rect.width > 0 && rect.height > 0) {
      const position = this.calculateLabelPosition(rect, this.labelHeight);
      this.escExitLabelHover.style.left = `${position.left}px`;
      this.escExitLabelHover.style.top = `${position.top}px`;
      this.escExitLabelHover.style.display = 'block';
      this.escExitLabelHover.style.visibility = 'visible';
    } else {
      this.hideEscExitLabelHover();
    }
  }

  hideEscExitLabelText() {
    if (this.escExitLabelText) this.escExitLabelText.style.display = 'none';
  }

  hideEscExitLabelHover() {
    if (this.escExitLabelHover) this.escExitLabelHover.style.display = 'none';
  }

  hideEscExitLabel() {
    this.hideEscExitLabelText();
    this.hideEscExitLabelHover();
  }

  /**
   * Host-element class paint for focus + inspector hover.
   * @param {Element|null} focusEl
   * @param {Element|null} inspectorEl
   * @param {Element|null} prevFocusEl
   * @param {Element|null} prevInspectorEl
   * @param {string|null} [inspectorKind]
   */
  updateElementClasses(focusEl, inspectorEl, prevFocusEl, prevInspectorEl, inspectorKind = null) {
    const hostClasses = getAllInspectorHostClasses();

    // Remove previous classes
    if (prevFocusEl && prevFocusEl !== focusEl) {
      prevFocusEl.classList.remove(CSS_CLASSES.FOCUS);
    }
    if (prevInspectorEl && prevInspectorEl !== inspectorEl) {
      for (const c of hostClasses) {
        try { prevInspectorEl.classList.remove(c); } catch { /* ignore */ }
      }
    }

    // Add new classes (ensure shadow styles first so brightness filter applies in open roots)
    if (focusEl) {
      this._ensureStylesForElement(focusEl);
      focusEl.classList.add(CSS_CLASSES.FOCUS);
    }
    if (inspectorEl) {
      this._ensureStylesForElement(inspectorEl);
      const def = getInspectorDef(inspectorKind);
      try { inspectorEl.classList.add(CSS_CLASSES.INSPECTOR); } catch { /* ignore */ }
      if (def?.hostClass) {
        try { inspectorEl.classList.add(def.hostClass); } catch { /* ignore */ }
      }
    }
  }

  /**
   * Translate a rect from `element`'s viewport into the top-frame viewport.
   * Same-origin iframe fields report coordinates local to the canvas.
   * @param {Element} element
   * @param {{ left: number, top: number, width: number, height: number }} rect
   * @returns {{ left: number, top: number, width: number, height: number }}
   */
  _rectInTopViewport(element, rect) {
    if (!rect) return { left: 0, top: 0, width: 0, height: 0 };
    const out = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };
    let win = null;
    try { win = element.ownerDocument?.defaultView || null; } catch { win = null; }
    let guard = 0;
    while (win && win !== window && guard++ < 8) {
      let frameEl = null;
      try { frameEl = win.frameElement; } catch { frameEl = null; }
      if (!frameEl) break;
      let fr = null;
      try { fr = frameEl.getBoundingClientRect(); } catch { fr = null; }
      if (!fr) break;
      out.left += fr.left;
      out.top += fr.top;
      try { win = win.parent; } catch { break; }
    }
    return out;
  }

  getBestRect(element) {
    if (!element) return { left: 0, top: 0, width: 0, height: 0 };
    
    let rect = this._rectInTopViewport(element, element.getBoundingClientRect());
    
    // Debug logging
    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] getBestRect for element:', {
        tagName: element.tagName,
        originalRect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        }
      });
    }
    
    // If the element has no height (common with links containing other elements),
    // try to find a child element with height
    if (rect.height === 0 && element.children.length > 0) {
      for (const child of element.children) {
        const childRect = this._rectInTopViewport(child, child.getBoundingClientRect());
        if (childRect.height > 0) {
          // Use the child's rect but keep the parent's left position if it's a link
          if (element.tagName.toLowerCase() === 'a') {
            const finalRect = {
              left: Math.min(rect.left, childRect.left),
              top: childRect.top,
              width: Math.max(rect.width, childRect.width),
              height: childRect.height
            };
            if (window.KEYPILOT_DEBUG) {
              console.log('[KeyPilot Debug] Using child rect for link:', finalRect);
            }
            return finalRect;
          }
          if (window.KEYPILOT_DEBUG) {
            console.log('[KeyPilot Debug] Using child rect:', childRect);
          }
          return childRect;
        }
      }
    }
    
    // If still no height, try to get text content dimensions
    if (rect.height === 0 && element.textContent && element.textContent.trim()) {
      // For text-only elements, use a minimum height
      const finalRect = {
        left: rect.left,
        top: rect.top,
        width: Math.max(rect.width, 20), // Minimum width
        height: Math.max(rect.height, 20) // Minimum height
      };
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Using minimum dimensions:', finalRect);
      }
      return finalRect;
    }
    
    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Using original rect:', rect);
    }
    return rect;
  }

  /**
   * KeyPilot-injected paint nodes. Must not contribute visual metrics
   * (a leftover in-target ring with `border-radius: 50%` is full-size).
   * @param {Element|null|undefined} el
   * @returns {boolean}
   */
  _isKeyPilotPaintNode(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      if (el === this._inTargetRing) return true;
      if (el.getAttribute?.('data-kp-focus-ring') === '1') return true;
      if (el.getAttribute?.('data-kp-shadow-b-host') === '1') return true;
      const cls = el.classList;
      if (cls && (
        cls.contains(CSS_CLASSES.FOCUS_RING_INTARGET || 'kpv2-focus-ring-intarget') ||
        cls.contains('keypilot-focus-element')
      )) {
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  /**
   * Read a non-zero computed border-radius from an element.
   * @param {Element|null|undefined} el
   * @returns {string|null}
   */
  _readNonZeroBorderRadius(el) {
    try {
      if (!el || el.nodeType !== 1) return null;
      if (this._isKeyPilotPaintNode(el)) return null;
      const cs = window.getComputedStyle(el);
      if (!cs) return null;

      let radius = String(cs.borderRadius || '').trim();
      if (!radius) {
        const tl = cs.borderTopLeftRadius || '0';
        const tr = cs.borderTopRightRadius || '0';
        const br = cs.borderBottomRightRadius || '0';
        const bl = cs.borderBottomLeftRadius || '0';
        radius = `${tl} ${tr} ${br} ${bl}`.trim();
      }
      if (!radius) return null;

      // Collapse "0px 0px 0px 0px" / "0" / "0%" to null so callers can try children.
      const tokens = radius.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
      if (
        tokens.length > 0 &&
        tokens.every((t) => /^(0|0px|0%)$/i.test(t))
      ) {
        return null;
      }
      return radius;
    } catch {
      return null;
    }
  }

  /**
   * Turn percentage corner radii into px using `el`'s box. Raw `50%` on a
   * circular play button must not be copied onto a tall video (ellipse).
   * @param {string} radius
   * @param {Element} el
   * @returns {string}
   */
  _percentRadiusToPx(radius, el) {
    const raw = String(radius || '').trim();
    if (!raw || !/%/.test(raw) || !el || el.nodeType !== 1) return raw;
    let w = 0;
    let h = 0;
    try {
      const r = el.getBoundingClientRect();
      w = r && r.width ? r.width : 0;
      h = r && r.height ? r.height : 0;
    } catch {
      return raw;
    }
    if (!(w > 0) || !(h > 0)) return raw;

    const pctTo = (token, axis) => {
      const m = String(token).trim().match(/^(-?[\d.]+)%$/);
      if (!m) return token;
      const px = (parseFloat(m[1]) / 100) * axis;
      if (!Number.isFinite(px)) return token;
      const rounded = Math.round(px * 100) / 100;
      return `${rounded}px`;
    };
    const convertList = (list, axis) =>
      list.trim().split(/\s+/).filter(Boolean).map((t) => pctTo(t, axis)).join(' ');

    if (raw.includes('/')) {
      const [xs, ys] = raw.split('/');
      return `${convertList(xs, w)} / ${convertList(ys, h)}`;
    }
    const tokens = raw.split(/\s+/).filter(Boolean);
    const xStr = tokens.map((t) => pctTo(t, w)).join(' ');
    const yStr = tokens.map((t) => pctTo(t, h)).join(' ');
    return xStr === yStr ? xStr : `${xStr} / ${yStr}`;
  }

  /**
   * Non-zero radius from `el`, with % resolved against `el`'s own box.
   * @param {Element|null|undefined} el
   * @returns {string|null}
   */
  _radiusCssFromElement(el) {
    const raw = this._readNonZeroBorderRadius(el);
    if (!raw) return null;
    return this._percentRadiusToPx(raw, el);
  }

  /**
   * Resolve a CSS border-radius that matches the visual shape of the activation target.
   * Prefer the element itself; if it is not rounded (common for <a> wrapping a card/image),
   * use a large rounded descendant that fills most of the host box.
   *
   * @param {Element|null|undefined} element
   * @returns {string|null} CSS border-radius value, or null to keep stylesheet default
   */
  _resolveElementBorderRadius(element) {
    if (!element || element.nodeType !== 1) return null;
    if (this._isKeyPilotPaintNode(element)) return null;

    const own = this._radiusCssFromElement(element);
    if (own) return own;

    try {
      let parentRect = null;
      let parentArea = 0;
      try {
        parentRect = element.getBoundingClientRect();
        parentArea = Math.max(0, (parentRect.width || 0) * (parentRect.height || 0));
      } catch {
        parentArea = 0;
      }

      const candidates = [];
      try {
        if (element.children && element.children.length) {
          for (const child of element.children) {
            if (!this._isKeyPilotPaintNode(child)) candidates.push(child);
          }
        }
      } catch { /* ignore */ }

      // Media often carries the visible corner radius on image links / cards.
      try {
        const media = element.querySelectorAll?.('img, svg, video, picture');
        if (media && media.length) {
          for (const m of media) {
            if (!this._isKeyPilotPaintNode(m)) candidates.push(m);
          }
        }
      } catch { /* ignore */ }

      let best = null;
      let bestArea = 0;
      for (const c of candidates) {
        const radius = this._radiusCssFromElement(c);
        if (!radius) continue;
        let area = 0;
        try {
          const cr = c.getBoundingClientRect();
          area = Math.max(0, (cr.width || 0) * (cr.height || 0));
        } catch {
          area = 0;
        }
        if (area >= bestArea) {
          bestArea = area;
          best = radius;
        }
      }

      // Avoid picking a tiny decorative rounded icon inside a larger link.
      if (best && (parentArea <= 0 || bestArea >= parentArea * 0.35)) {
        return best;
      }

      // Same-size ancestor clip wrapper (Firework Quick Takes: 10px on the
      // overflow:hidden thumb, while the inner video/play stack is square).
      if (parentRect && parentRect.width >= 8 && parentRect.height >= 8) {
        let p = null;
        try { p = this._composedParent(element); } catch { p = element.parentElement; }
        let depth = 0;
        while (p && p.nodeType === 1 && depth++ < 6) {
          if (p === document.body || p === document.documentElement) break;
          if (this._isKeyPilotPaintNode(p)) {
            try { p = this._composedParent(p); } catch { p = p.parentElement; }
            continue;
          }
          let r = null;
          try { r = p.getBoundingClientRect(); } catch { r = null; }
          if (!r || r.width < 8 || r.height < 8) {
            try { p = this._composedParent(p); } catch { p = p.parentElement; }
            continue;
          }
          if (r.width > parentRect.width * 1.12 + 12) break;
          if (r.height > parentRect.height * 1.2 + 16) break;
          const ar = this._radiusCssFromElement(p);
          if (ar) return ar;
          try { p = this._composedParent(p); } catch { p = p.parentElement; }
        }
      }
    } catch { /* ignore */ }

    return null;
  }

  /**
   * Paint node for hover ring / F-click flash — same pipeline as updateFocusOverlay.
   * Image+text cards → stacked shell; else focus-styling resolve.
   *
   * Text fields stay on the control itself for hover outline size/color. The
   * taller Gmail-style pill host is only used by `_applyTextFocusElementStyling`
   * for the focused left-edge bar — not for hover (avoids label+field wrappers
   * in onboarding practice popover).
   * @param {Element|null|undefined} element
   * @returns {Element|null}
   */
  _resolveFocusPaintElement(element) {
    if (!element || element.nodeType !== 1) return null;

    let cardShell = null;
    try { cardShell = this._resolveMediaTextCardShell(element); } catch { cardShell = null; }

    try {
      if (cardShell) return cardShell;
      const styled = this._resolveElementForFocusStyling(element) || element;
      try {
        const frame = this._resolveAbsoluteClipFramePaintHost(styled);
        if (frame) return frame;
      } catch { /* ignore */ }
      return styled;
    } catch {
      return element;
    }
  }

  /**
   * Normalize a DOMRect-like into a plain viewport box, or null if degenerate.
   * @param {{ left?: number, top?: number, width?: number, height?: number }|null|undefined} r
   * @returns {{ left: number, top: number, width: number, height: number }|null}
   */
  _asPositiveViewportRect(r) {
    if (!r) return null;
    const left = Number(r.left);
    const top = Number(r.top);
    const width = Number(r.width);
    const height = Number(r.height);
    if (!(width > 0) || !(height > 0)) return null;
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    return { left, top, width, height };
  }

  /**
   * True when hover focus is strategy A (CSS outline on the styled element).
   * Inline outlines follow line-box fragments — fixed union ghosts do not.
   * @returns {boolean}
   */
  _isDomOutlineFocusPaint() {
    return !!(
      this._useDomHoverFocusColors &&
      !this._focusPaintUsesFixedOverlay &&
      !this._focusPaintUsesInTargetRing &&
      this._currentStyledElement &&
      this._currentStyledElement.nodeType === 1
    );
  }

  /**
   * Flash strategy A's live outline in place (correct for inline / multi-line fragments).
   * @param {Element} styledEl
   * @param {number} cleanupMs
   */
  _flashDomOutlineColors(styledEl, cleanupMs) {
    if (!styledEl || styledEl.nodeType !== 1 || !styledEl.isConnected) return false;

    // Cancel a prior in-place outline flash on this node.
    try {
      const prevTimer = styledEl._kpOutlineFlashTimer;
      if (prevTimer) {
        clearTimeout(prevTimer);
        styledEl._kpOutlineFlashTimer = 0;
      }
    } catch { /* ignore */ }

    const prevColor = styledEl.style.getPropertyValue('--keypilot-focus-ring-color');
    const prevShadow = styledEl.style.getPropertyValue('--keypilot-focus-box-shadow');
    let prevInlineOutline = '';
    let prevInlineOffset = '';
    let prevInlineShadow = '';
    const hadInline = styledEl.getAttribute?.('data-kp-focus-inline') === '1';
    if (hadInline) {
      try {
        prevInlineOutline = styledEl.style.getPropertyValue('outline');
        prevInlineOffset = styledEl.style.getPropertyValue('outline-offset');
        prevInlineShadow = styledEl.style.getPropertyValue('box-shadow');
      } catch { /* ignore */ }
    }

    const ringWidth =
      styledEl.style.getPropertyValue('--keypilot-focus-ring-width') || '3px';
    const ringOffset =
      styledEl.style.getPropertyValue('--keypilot-focus-outline-offset') || '2px';
    const flashShadow =
      `0 0 0 2px ${COLORS.FLASH_GREEN_SHADOW}, 0 0 16px 3px ${COLORS.FLASH_GREEN_GLOW}`;

    try {
      styledEl.style.setProperty('--keypilot-focus-ring-color', COLORS.FLASH_GREEN);
      styledEl.style.setProperty('--keypilot-focus-box-shadow', flashShadow);
      if (hadInline) {
        styledEl.style.setProperty(
          'outline',
          `${ringWidth} solid ${COLORS.FLASH_GREEN}`,
          'important'
        );
        styledEl.style.setProperty('outline-offset', ringOffset, 'important');
        styledEl.style.setProperty('box-shadow', flashShadow, 'important');
      }
    } catch {
      return false;
    }

    const ms = Math.max(200, Number(cleanupMs) || 500);
    try {
      styledEl._kpOutlineFlashTimer = setTimeout(() => {
        styledEl._kpOutlineFlashTimer = 0;
        try {
          // Only restore if this element is still the styled focus target.
          if (this._currentStyledElement !== styledEl) return;
          if (prevColor) {
            styledEl.style.setProperty('--keypilot-focus-ring-color', prevColor);
          } else {
            styledEl.style.removeProperty('--keypilot-focus-ring-color');
          }
          if (prevShadow) {
            styledEl.style.setProperty('--keypilot-focus-box-shadow', prevShadow);
          } else {
            styledEl.style.removeProperty('--keypilot-focus-box-shadow');
          }
          if (hadInline) {
            if (prevInlineOutline) {
              styledEl.style.setProperty('outline', prevInlineOutline, 'important');
            }
            if (prevInlineOffset) {
              styledEl.style.setProperty('outline-offset', prevInlineOffset, 'important');
            }
            if (prevInlineShadow) {
              styledEl.style.setProperty('box-shadow', prevInlineShadow, 'important');
            }
          }
        } catch { /* ignore */ }
      }, ms);
    } catch { /* ignore */ }

    return true;
  }

  /**
   * Live viewport box of the painted blue hover ring (strategy B ring or C
   * body-fixed overlay). Null when hover is strategy A (DOM outline only).
   * @returns {{ left: number, top: number, width: number, height: number }|null}
   */
  _resolveLiveBlueHoverPaintRect() {
    try {
      if (
        this._focusPaintUsesFixedOverlay &&
        this.focusOverlay &&
        this.focusOverlay.style.display !== 'none'
      ) {
        const r = this._asPositiveViewportRect(this.focusOverlay.getBoundingClientRect());
        if (r) return r;
      }
    } catch { /* ignore */ }

    try {
      if (
        this._focusPaintUsesInTargetRing &&
        this._inTargetRing &&
        this._inTargetRing.isConnected
      ) {
        let shown = true;
        try {
          const cs = window.getComputedStyle(this._inTargetRing);
          shown = !!(cs && cs.display !== 'none' && cs.visibility !== 'hidden');
        } catch { /* ignore */ }
        if (shown) {
          const r = this._asPositiveViewportRect(this._inTargetRing.getBoundingClientRect());
          if (r) return r;
        }
      }
    } catch { /* ignore */ }

    return null;
  }

  /**
   * Expand a content box by strategy-A outline-offset so a fixed green flash
   * sits where the blue CSS outline sits (outside the border box).
   * @param {{ left: number, top: number, width: number, height: number }} rect
   * @param {Element|null|undefined} paintEl
   * @returns {{ left: number, top: number, width: number, height: number }}
   */
  _expandRectForStrategyAOutline(rect, paintEl) {
    if (!rect) return rect;
    let offsetPx = 0;
    try {
      if (paintEl && paintEl.nodeType === 1) {
        const fromVar = paintEl.style?.getPropertyValue?.('--keypilot-focus-outline-offset');
        const raw = (fromVar && String(fromVar).trim()) ||
          (window.getComputedStyle(paintEl).outlineOffset || '');
        const n = parseFloat(raw);
        if (Number.isFinite(n)) offsetPx = n;
      }
    } catch { /* ignore */ }
    // Only expand for positive (outer) offset; inset outlines stay on the box.
    if (!(offsetPx > 0.25)) return rect;
    return {
      left: rect.left - offsetPx,
      top: rect.top - offsetPx,
      width: rect.width + 2 * offsetPx,
      height: rect.height + 2 * offsetPx
    };
  }

  /**
   * Viewport boxes for F-click ghosts. Prefer the live blue paint box (B ring /
   * C overlay). For strategy A, one clipped rect per getClientRects() line box
   * (matches outline fragments), expanded by outline-offset.
   *
   * @param {Element|null|undefined} activationTarget
   * @returns {{ paintEl: Element|null, rects: Array<{ left: number, top: number, width: number, height: number }> }}
   */
  _resolveClickEffectRects(activationTarget = null) {
    const source = (activationTarget && activationTarget.nodeType === 1)
      ? activationTarget
      : (this._currentStyledElement || this._lastFocusElement);

    // Prefer the live strategy-A paint node (may be the logo <img> after
    // _resolveElementForFocusStyling) so green flash matches the blue outline.
    let paintEl = null;
    try {
      if (
        this._useDomHoverFocusColors &&
        !this._focusPaintUsesFixedOverlay &&
        !this._focusPaintUsesInTargetRing &&
        this._currentStyledElement &&
        this._currentStyledElement.nodeType === 1 &&
        this._currentStyledElement.isConnected
      ) {
        paintEl = this._currentStyledElement;
      }
    } catch { /* ignore */ }
    if (!paintEl) {
      paintEl = this._resolveFocusPaintElement(source) || source || null;
    }

    try {
      if (
        this._focusPaintUsesInTargetRing &&
        this._inTargetHost &&
        this._inTargetHost.nodeType === 1 &&
        this._inTargetHost.isConnected &&
        source &&
        (
          this._lastFocusElement === source ||
          this._inTargetHost === source ||
          this._inTargetHost === paintEl ||
          (typeof this._inTargetHost.contains === 'function' && this._inTargetHost.contains(source)) ||
          (typeof source.contains === 'function' && source.contains(this._inTargetHost))
        )
      ) {
        paintEl = this._inTargetHost;
      }
    } catch { /* keep paintEl */ }

    // Prefer the live blue ring geometry (B host ring or C fixed overlay).
    try {
      const live = this._resolveLiveBlueHoverPaintRect();
      if (live) {
        return { paintEl, rects: [live] };
      }
    } catch { /* fall through */ }

    // Inline host still under-measured: promote to dominant replaced child
    // (same rule as strategy-A paint) before using line-box client rects.
    try {
      if (paintEl && paintEl.nodeType === 1) {
        const replaced = this._findDominantReplacedPaintChild(paintEl);
        if (replaced) paintEl = replaced;
      }
    } catch { /* ignore */ }

    // Strategy A: multi-line text fragments — one ghost per line box.
    // Skip for replaced media (img/video): a single tight box, not line boxes.
    try {
      if (paintEl && paintEl.nodeType === 1 && paintEl.isConnected) {
        const isReplaced = this._isReplacedOrVoidElement(paintEl) ||
          this._isMediaLikeCoverElement(paintEl);
        let clientRects = null;
        try { clientRects = paintEl.getClientRects(); } catch { clientRects = null; }
        const fragmented = !isReplaced && this._isFragmentedInlineFocusTarget(paintEl);
        if (
          !isReplaced &&
          clientRects &&
          clientRects.length >= 1 &&
          (fragmented || clientRects.length >= 2)
        ) {
          /** @type {Array<{ left: number, top: number, width: number, height: number }>} */
          const out = [];
          for (let i = 0; i < clientRects.length; i++) {
            const expanded = this._expandRectForStrategyAOutline(
              this._asPositiveViewportRect(clientRects[i]),
              paintEl
            );
            const clipped = this._clipViewportRectToVisible(paintEl, expanded);
            if (clipped) out.push(clipped);
          }
          if (out.length) return { paintEl, rects: out };
        }
      }
    } catch { /* fall through to single box */ }

    const box = this._resolveClickEffectBox(activationTarget);
    if (box && box.rect) {
      const expanded = this._expandRectForStrategyAOutline(box.rect, box.paintEl || paintEl);
      const clipped = this._clipViewportRectToVisible(box.paintEl || paintEl, expanded) || expanded;
      return { paintEl: box.paintEl || paintEl, rects: [clipped] };
    }
    return { paintEl, rects: [] };
  }

  /**
   * Viewport box for F-click flash / pulse: body-fixed imitation of the blue
   * hover paint box (including fragmented / bare-inline union via getBestRect).
   *
   * @param {Element|null|undefined} activationTarget
   * @returns {{ paintEl: Element|null, rect: { left: number, top: number, width: number, height: number } }|null}
   */
  _resolveClickEffectBox(activationTarget = null) {
    const source = (activationTarget && activationTarget.nodeType === 1)
      ? activationTarget
      : (this._currentStyledElement || this._lastFocusElement);

    let paintEl = this._resolveFocusPaintElement(source) || source || null;

    // Strategy B: the absolute ring covers the in-target host — match that box
    // only when it belongs to this activation (not a stale host from a prior hover).
    try {
      if (
        this._focusPaintUsesInTargetRing &&
        this._inTargetHost &&
        this._inTargetHost.nodeType === 1 &&
        this._inTargetHost.isConnected &&
        source &&
        (
          this._lastFocusElement === source ||
          this._inTargetHost === source ||
          this._inTargetHost === paintEl ||
          (typeof this._inTargetHost.contains === 'function' && this._inTargetHost.contains(source)) ||
          (typeof source.contains === 'function' && source.contains(this._inTargetHost))
        )
      ) {
        paintEl = this._inTargetHost;
      }
    } catch { /* keep paintEl */ }

    // Live blue paint (B ring or C fixed overlay) — exact duplicate of what hover shows.
    try {
      const live = this._resolveLiveBlueHoverPaintRect();
      if (live) return { paintEl, rect: live };
    } catch { /* fall through */ }

    // Live paint-box geometry (getBoundingClientRect union for fragmented inline),
    // then shrink to the visible portion inside overflow / contain clippers.
    try {
      if (paintEl && paintEl.nodeType === 1 && paintEl.isConnected) {
        const raw = this._expandRectForStrategyAOutline(
          this._asPositiveViewportRect(this.getBestRect(paintEl)),
          paintEl
        );
        const r = this._clipViewportRectToVisible(paintEl, raw);
        if (r) return { paintEl, rect: r };
      }
    } catch { /* fall through */ }

    // Visible strategy-C / CSS-props overlay — already a fixed imitation of the paint box.
    try {
      if (this.focusOverlay && this.focusOverlay.style.display !== 'none') {
        const r = this._asPositiveViewportRect(this.focusOverlay.getBoundingClientRect());
        if (r) return { paintEl, rect: r };
      }
    } catch { /* ignore */ }

    try {
      if (this.cssCustomPropsOverlay && this.cssCustomPropsOverlay.style.display !== 'none') {
        const r = this._asPositiveViewportRect(this.cssCustomPropsOverlay.getBoundingClientRect());
        if (r) return { paintEl, rect: r };
      }
    } catch { /* ignore */ }

    // Last hover rect (may be slightly stale after scroll) — still clip if we have a paint node.
    const lastRaw = this._asPositiveViewportRect(this._lastFocusRect);
    const last = paintEl
      ? this._clipViewportRectToVisible(paintEl, lastRaw)
      : lastRaw;
    if (last) return { paintEl, rect: last };

    return null;
  }

  /**
   * Resolve the viewport rect of the current focus outline for activation feedback.
   * @returns {{ left: number, top: number, width: number, height: number }|null}
   */
  _getFocusPulseRect() {
    const box = this._resolveClickEffectBox(null);
    return box ? box.rect : null;
  }

  /**
   * Install one-shot page lifecycle hooks that wipe fixed-position click effects
   * during navigation / hide (SPA soft-nav, full load, bfcache, tab background).
   */
  _installEphemeralEffectLifecycle() {
    if (this._ephemeralEffectLifecycleInstalled) return;
    this._ephemeralEffectLifecycleInstalled = true;

    const clear = () => {
      try { this.clearEphemeralEffects(); } catch { /* ignore */ }
    };

    /** @type {Array<[EventTarget, string, EventListenerOrEventListenerObject, boolean|AddEventListenerOptions|undefined]>} */
    const bindings = [];
    const bind = (target, type, handler, options) => {
      try {
        target.addEventListener(type, handler, options);
        bindings.push([target, type, handler, options]);
      } catch { /* ignore */ }
    };

    bind(window, 'pagehide', clear, true);
    bind(window, 'beforeunload', clear, true);
    bind(window, 'popstate', clear, true);
    bind(window, 'hashchange', clear, true);
    bind(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') clear();
    }, true);
    bind(window, 'pageshow', (e) => {
      // bfcache restore can leave stale fixed ghosts from the prior visit.
      if (e && e.persisted) clear();
    }, true);

    // Same-document SPA navigations: clear only after the history entry changes.
    // (Avoid Navigation API "navigate" — it fires at click time and would kill
    // the intentional flash before the user sees it.)
    // popstate/hashchange already bound; also poll while effects are live via rAF.
    try {
      this._ephemeralLastHref = String(location.href || '');
      this._ephemeralOnUrlMaybeChanged = () => {
        const next = String(location.href || '');
        if (next !== this._ephemeralLastHref) {
          this._ephemeralLastHref = next;
          clear();
        }
      };
    } catch { /* ignore */ }

    this._ephemeralEffectLifecycleDispose = () => {
      try {
        this._ephemeralLastHref = null;
        this._ephemeralOnUrlMaybeChanged = null;
      } catch { /* ignore */ }
      for (const [target, type, handler, options] of bindings) {
        try { target.removeEventListener(type, handler, options); } catch { /* ignore */ }
      }
      bindings.length = 0;
      this._ephemeralEffectLifecycleInstalled = false;
      this._ephemeralEffectLifecycleDispose = null;
    };
  }

  /**
   * Remove every temporary click / image-copy effect overlay immediately.
   */
  clearEphemeralEffects() {
    const entries = Array.from(this._activeEphemeralEffects || []);
    for (const entry of entries) {
      try { entry.teardown?.(); } catch { /* ignore */ }
    }
    this._activeEphemeralEffects?.clear?.();
  }

  /**
   * Track a temporary fixed overlay so it is removed when the source target is
   * gone/hidden or the page navigates — not only when the CSS animation ends.
   *
   * @param {Element} pulse
   * @param {Element|null|undefined} sourceEl
   * @param {{ left: number, top: number, width: number, height: number }|null|undefined} originRect
   * @param {number} cleanupMs
   */
  _trackEphemeralEffect(pulse, sourceEl, originRect, cleanupMs) {
    if (!pulse) return;
    this._installEphemeralEffectLifecycle();

    const entry = {
      pulse,
      sourceEl: sourceEl && sourceEl.nodeType === 1 ? sourceEl : null,
      originRect: originRect
        ? {
            left: originRect.left,
            top: originRect.top,
            width: originRect.width,
            height: originRect.height
          }
        : null,
      rafId: 0,
      timeoutId: 0,
      io: /** @type {IntersectionObserver|null} */ (null),
      teardown: () => {}
    };

    let tornDown = false;
    const teardown = () => {
      if (tornDown) return;
      tornDown = true;
      this._activeEphemeralEffects.delete(entry);
      if (entry.rafId) {
        try { cancelAnimationFrame(entry.rafId); } catch { /* ignore */ }
        entry.rafId = 0;
      }
      if (entry.timeoutId) {
        try { clearTimeout(entry.timeoutId); } catch { /* ignore */ }
        entry.timeoutId = 0;
      }
      if (entry.io) {
        try { entry.io.disconnect(); } catch { /* ignore */ }
        entry.io = null;
      }
      try {
        if (pulse.isConnected) pulse.remove();
      } catch { /* ignore */ }
    };
    entry.teardown = teardown;
    this._activeEphemeralEffects.add(entry);

    // Source left the viewport / was covered away → drop the ghost immediately.
    if (entry.sourceEl) {
      try {
        entry.io = new IntersectionObserver(
          (records) => {
            for (const r of records) {
              if (!r.isIntersecting || r.intersectionRatio <= 0) {
                teardown();
                return;
              }
            }
          },
          { root: null, threshold: 0 }
        );
        entry.io.observe(entry.sourceEl);
      } catch {
        entry.io = null;
      }
    }

    // Poll for disconnect / zero-size / large layout jump (SPA transition, scroll-away).
    const origin = entry.originRect;
    const tick = () => {
      if (tornDown) return;

      // SPA soft-nav often keeps the document alive but changes the URL.
      try {
        const onUrl = this._ephemeralOnUrlMaybeChanged;
        if (typeof onUrl === 'function') onUrl();
        if (tornDown) return;
      } catch { /* ignore */ }

      const src = entry.sourceEl;
      if (src) {
        if (!src.isConnected) {
          teardown();
          return;
        }
        try {
          const r = src.getBoundingClientRect();
          if (!(r.width > 0) || !(r.height > 0)) {
            teardown();
            return;
          }
          // Source moved far from the frozen ghost rect → page is transitioning.
          if (origin) {
            const dx = Math.abs(r.left - origin.left);
            const dy = Math.abs(r.top - origin.top);
            const dw = Math.abs(r.width - origin.width);
            const dh = Math.abs(r.height - origin.height);
            if (dx > 48 || dy > 48 || dw > 64 || dh > 64) {
              teardown();
              return;
            }
          }
          // Covered / opacity-0 during view transitions.
          try {
            const cs = window.getComputedStyle(src);
            if (cs) {
              const op = parseFloat(cs.opacity);
              if (cs.display === 'none' || cs.visibility === 'hidden' || (Number.isFinite(op) && op < 0.05)) {
                teardown();
                return;
              }
            }
          } catch { /* ignore */ }
        } catch {
          teardown();
          return;
        }
      }
      // Host document gone / pulse orphaned.
      if (!pulse.isConnected) {
        teardown();
        return;
      }
      entry.rafId = requestAnimationFrame(tick);
    };
    entry.rafId = requestAnimationFrame(tick);

    try {
      pulse.addEventListener('animationend', teardown, { once: true });
    } catch { /* ignore */ }

    const ms = Number.isFinite(cleanupMs) ? Math.max(200, cleanupMs) : 1000;
    entry.timeoutId = setTimeout(teardown, ms);
  }

  /**
   * Approximate border-radius in CSS px for SVG rx/ry from a CSS border-radius string.
   * @param {string|null|undefined} borderRadius
   * @param {number} width
   * @param {number} height
   * @returns {number}
   */
  _borderRadiusToSvgRx(borderRadius, width, height) {
    if (!borderRadius) return 3;
    const first = String(borderRadius).trim().split(/\s+/)[0] || '';
    if (!first) return 3;
    if (first.endsWith('%')) {
      const p = parseFloat(first);
      if (!Number.isFinite(p)) return 3;
      return Math.max(0, Math.min(width, height) * (p / 100));
    }
    const n = parseFloat(first);
    return Number.isFinite(n) ? Math.max(0, n) : 3;
  }

  /**
   * Map clickEffect id → CSS class + safety cleanup ms.
   * @param {string} clickEffect
   * @returns {{ className: string, cleanupMs: number } | null}
   */
  _clickEffectPresentation(clickEffect) {
    switch (clickEffect) {
      case 'flash':
        return { className: CSS_CLASSES.FOCUS_FLASH, cleanupMs: 500 };
      case 'scale':
        return { className: CSS_CLASSES.FOCUS_PULSE, cleanupMs: 800 };
      case 'marquee':
        return { className: CSS_CLASSES.FOCUS_MARQUEE, cleanupMs: 1200 };
      case 'dash':
        return { className: CSS_CLASSES.FOCUS_DASH, cleanupMs: 1100 };
      default:
        return null;
    }
  }

  /**
   * Build the dash-chase SVG overlay (dashed stroke travels the perimeter).
   * @param {{ left: number, top: number, width: number, height: number }} rect
   * @param {string|null|undefined} borderRadius
   * @returns {SVGSVGElement}
   */
  _createDashChasePulse(rect, borderRadius) {
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const stroke = 3;
    const inset = stroke / 2;
    const rw = Math.max(1, w - stroke);
    const rh = Math.max(1, h - stroke);
    const rx = Math.min(this._borderRadiusToSvgRx(borderRadius, w, h), rw / 2, rh / 2);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', CSS_CLASSES.FOCUS_DASH);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('data-kp-ephemeral-effect', 'dash');
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.style.left = `${rect.left}px`;
    svg.style.top = `${rect.top}px`;
    svg.style.width = `${w}px`;
    svg.style.height = `${h}px`;

    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    shape.setAttribute('x', String(inset));
    shape.setAttribute('y', String(inset));
    shape.setAttribute('width', String(rw));
    shape.setAttribute('height', String(rh));
    shape.setAttribute('rx', String(rx));
    shape.setAttribute('ry', String(rx));
    shape.setAttribute('fill', 'none');
    shape.setAttribute('stroke', COLORS.FLASH_GREEN);
    shape.setAttribute('stroke-width', String(stroke));
    shape.setAttribute('stroke-linecap', 'round');
    shape.setAttribute('vector-effect', 'non-scaling-stroke');

    // Perimeter of rounded rect (good enough for dash patterning).
    const straight = 2 * (Math.max(0, rw - 2 * rx) + Math.max(0, rh - 2 * rx));
    const corners = 2 * Math.PI * rx;
    const peri = Math.max(24, straight + corners);
    const dash = Math.max(10, Math.min(36, peri * 0.09));
    const gap = Math.max(6, Math.min(22, peri * 0.055));
    shape.setAttribute('stroke-dasharray', `${dash} ${gap}`);
    shape.style.setProperty('--kp-dash-peri', String(peri));
    shape.classList.add(`${CSS_CLASSES.FOCUS_DASH}-stroke`);

    svg.appendChild(shape);
    return svg;
  }

  /**
   * F-key activation feedback for link-style targets.
   *
   * Green flash is always a body-fixed overlay ghost that duplicates the blue
   * hover paint box. When hover is strategy A or B, that means a fixed green
   * rectangle (or per-line boxes for multi-line A) matching the blue ring —
   * never recoloring the live A outline in place. Strategy C already paints
   * blue as a fixed overlay; the green ghost copies that same box.
   *
   * Effect style comes from settings (clickMode.clickEffect):
   *   - flash (default): hard strobe border + glow
   *   - dash: dashed border chases around the perimeter
   *   - marquee: solid chaser light travels around the perimeter
   *   - scale: outline expands and fades out
   *   - none: no animation
   *
   * Whether any effect runs is decided solely by CLICKABLE_CATEGORY via
   * ElementDetector.isLinkStyleCategory (LINK + GENERIC only). Sliders, media,
   * buttons, text, and controls never get the pulse.
   *
   * @param {Element|null} [activationTarget] - Element that was F-activated.
   *   Prefer this over last-hover focus so category matches the real target.
   */
  flashFocusOverlay(activationTarget = null) {
    const el = (activationTarget && activationTarget.nodeType === 1)
      ? activationTarget
      : (this._currentStyledElement || this._lastFocusElement);

    try {
      const detector = window.keyPilot?.detector || window.keyPilot?.elementDetector;
      const cat = (detector && typeof detector.getClickableCategory === 'function')
        ? detector.getClickableCategory(el)
        : this.getFocusCategory(el);

      const showEffect = (detector && typeof detector.isLinkStyleCategory === 'function')
        ? detector.isLinkStyleCategory(cat)
        : (cat === CLICKABLE_CATEGORY.LINK || cat === CLICKABLE_CATEGORY.GENERIC);

      if (!showEffect) return;
    } catch { /* ignore */ }

    const { clickEffect } = this._getClickModeSettings();
    if (clickEffect === 'none') return;

    const presentation = this._clickEffectPresentation(clickEffect);
    if (!presentation) return;

    // Don't start an effect if the activation target is already gone / not painted.
    if (el && el.nodeType === 1) {
      if (!el.isConnected) return;
      try {
        const cs = window.getComputedStyle(el);
        if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return;
      } catch { /* ignore */ }
    }

    // Always body-fixed green ghosts that copy the blue hover box (A, B, or C).
    // Strategy A used to recolor the live CSS outline in place; that diverged
    // from the fixed flash path and could not match clipped / multi-box cases.

    const { paintEl, rects } = this._resolveClickEffectRects(el);
    if (!rects || !rects.length) return;

    const radiusSource = (paintEl && paintEl.nodeType === 1) ? paintEl : el;
    let borderRadius = null;
    try { borderRadius = this._resolveElementBorderRadius(radiusSource); } catch { borderRadius = null; }

    const trackEl = (paintEl && paintEl.nodeType === 1) ? paintEl : el;

    for (let i = 0; i < rects.length; i++) {
      const liveRect = rects[i];
      if (!liveRect) continue;
      try {
        /** @type {HTMLElement|SVGSVGElement} */
        let pulse;
        if (clickEffect === 'dash') {
          pulse = this._createDashChasePulse(liveRect, borderRadius);
        } else {
          pulse = document.createElement('div');
          pulse.className = presentation.className;
          pulse.setAttribute('aria-hidden', 'true');
          pulse.setAttribute('data-kp-ephemeral-effect', clickEffect);
          pulse.style.left = `${liveRect.left}px`;
          pulse.style.top = `${liveRect.top}px`;
          pulse.style.width = `${liveRect.width}px`;
          pulse.style.height = `${liveRect.height}px`;
          if (borderRadius) {
            pulse.style.borderRadius = borderRadius;
          }
        }
        document.body.appendChild(pulse);
        this._trackEphemeralEffect(
          pulse,
          trackEl,
          liveRect,
          presentation.cleanupMs
        );
      } catch (e) {
        if (window.KEYPILOT_DEBUG) {
          console.warn('[KeyPilot] focus pulse failed:', e);
        }
      }
    }
  }

  /**
   * Image-copy feedback: blue photo-frame over the source element that flashes,
   * pops slightly, then shrinks away (distinct from the green F-click expand pulse).
   *
   * @param {Element|null|undefined} element - Image or background-image host element
   */
  flashImageCopyPulse(element) {
    if (!element || element.nodeType !== 1) return;

    let rect = null;
    try {
      rect = element.getBoundingClientRect();
    } catch {
      return;
    }
    if (!rect) return;

    // Ignore degenerate / off-screen-ish rects.
    const w = Number(rect.width) || 0;
    const h = Number(rect.height) || 0;
    if (w < 2 || h < 2) return;

    // Cap extreme full-page backgrounds so the pulse stays readable.
    const maxW = Math.max(48, (typeof window !== 'undefined' ? window.innerWidth : 1200) * 0.92);
    const maxH = Math.max(48, (typeof window !== 'undefined' ? window.innerHeight : 800) * 0.92);
    let left = rect.left;
    let top = rect.top;
    let width = w;
    let height = h;
    if (width > maxW) {
      left += (width - maxW) / 2;
      width = maxW;
    }
    if (height > maxH) {
      top += (height - maxH) / 2;
      height = maxH;
    }

    try {
      if (!element.isConnected) return;
      const pulse = document.createElement('div');
      pulse.className = CSS_CLASSES.IMAGE_COPY_PULSE;
      pulse.setAttribute('aria-hidden', 'true');
      pulse.setAttribute('data-kp-ephemeral-effect', 'image-copy');
      pulse.style.left = `${left}px`;
      pulse.style.top = `${top}px`;
      pulse.style.width = `${width}px`;
      pulse.style.height = `${height}px`;
      // Match corners to the source image/host when it has a non-default radius.
      const borderRadius = this._resolveElementBorderRadius(element);
      if (borderRadius) {
        pulse.style.borderRadius = borderRadius;
      }
      document.body.appendChild(pulse);
      this._trackEphemeralEffect(
        pulse,
        element,
        { left, top, width, height },
        900
      );
    } catch (e) {
      if (window.KEYPILOT_DEBUG) {
        console.warn('[KeyPilot] image-copy pulse failed:', e);
      }
    }
  }

  createViewportModalFrame() {
    if (this.viewportModalFrame) {
      return this.viewportModalFrame;
    }

    this.viewportModalFrame = this.createElement('div', {
      className: CSS_CLASSES.VIEWPORT_MODAL_FRAME,
      style: `
        display: none;
      `
    });

    document.body.appendChild(this.viewportModalFrame);

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Viewport modal frame created and added to DOM:', {
        element: this.viewportModalFrame,
        className: this.viewportModalFrame.className,
        parent: this.viewportModalFrame.parentElement?.tagName
      });
    }

    return this.viewportModalFrame;
  }

  showViewportModalFrame() {
    if (!this.viewportModalFrame) {
      this.createViewportModalFrame();
    }

    this.viewportModalFrame.style.display = 'block';

    // Set up ResizeObserver to handle viewport changes with enhanced monitoring
    if (!this.resizeObserver && window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver((entries) => {
        // Debounce resize updates to avoid excessive calls during continuous resizing
        if (this.resizeTimeout) {
          clearTimeout(this.resizeTimeout);
        }
        this.resizeTimeout = setTimeout(() => {
          this.updateViewportModalFrameSize();
          this.resizeTimeout = null;
        }, 16); // ~60fps for smooth updates
      });
      
      // Observe both document element and body for comprehensive viewport tracking
      this.resizeObserver.observe(document.documentElement);
      if (document.body) {
        this.resizeObserver.observe(document.body);
      }
    }

    // Enhanced fallback to window resize events if ResizeObserver is not available
    if (!window.ResizeObserver) {
      this.windowResizeHandler = this.debounce(() => {
        this.updateViewportModalFrameSize();
      }, 16);
      window.addEventListener('resize', this.windowResizeHandler);
      window.addEventListener('orientationchange', this.windowResizeHandler);
    }

    // Listen for fullscreen changes
    this.fullscreenHandler = () => {
      // Small delay to allow fullscreen transition to complete
      setTimeout(() => {
        this.updateViewportModalFrameSize();
      }, 100);
    };
    document.addEventListener('fullscreenchange', this.fullscreenHandler);
    document.addEventListener('webkitfullscreenchange', this.fullscreenHandler);
    document.addEventListener('mozfullscreenchange', this.fullscreenHandler);
    document.addEventListener('MSFullscreenChange', this.fullscreenHandler);

    // Listen for zoom changes (via visual viewport API if available)
    if (window.visualViewport) {
      this.visualViewportHandler = () => {
        this.updateViewportModalFrameSize();
      };
      window.visualViewport.addEventListener('resize', this.visualViewportHandler);
    }

    // Initial size update
    this.updateViewportModalFrameSize();

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Viewport modal frame shown with enhanced resize handling');
    }
  }

  hideViewportModalFrame() {
    if (this.viewportModalFrame) {
      this.viewportModalFrame.style.display = 'none';
    }

    // Clean up ResizeObserver
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Clean up resize timeout
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }

    // Remove window resize listener fallback
    if (this.windowResizeHandler) {
      window.removeEventListener('resize', this.windowResizeHandler);
      window.removeEventListener('orientationchange', this.windowResizeHandler);
      this.windowResizeHandler = null;
    }

    // Remove fullscreen change listeners
    if (this.fullscreenHandler) {
      document.removeEventListener('fullscreenchange', this.fullscreenHandler);
      document.removeEventListener('webkitfullscreenchange', this.fullscreenHandler);
      document.removeEventListener('mozfullscreenchange', this.fullscreenHandler);
      document.removeEventListener('MSFullscreenChange', this.fullscreenHandler);
      this.fullscreenHandler = null;
    }

    // Remove visual viewport listener
    if (this.visualViewportHandler && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.visualViewportHandler);
      this.visualViewportHandler = null;
    }

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Viewport modal frame hidden and all listeners cleaned up');
    }
  }

  updateViewportModalFrame(show) {
    if (show) {
      this.showViewportModalFrame();
    } else {
      this.hideViewportModalFrame();
    }
  }

  updateViewportModalFrameSize() {
    if (!this.viewportModalFrame || this.viewportModalFrame.style.display === 'none') {
      return;
    }

    // Get current viewport dimensions with fallbacks
    let viewportWidth, viewportHeight;

    // Use visual viewport API if available (handles zoom and mobile keyboards)
    if (window.visualViewport) {
      viewportWidth = window.visualViewport.width;
      viewportHeight = window.visualViewport.height;
    } else {
      // Fallback to standard viewport dimensions
      viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    }

    // Handle fullscreen mode detection
    const isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    // Adjust for developer tools if not in fullscreen
    if (!isFullscreen) {
      // Check if developer tools might be open by comparing window dimensions
      const windowWidth = window.outerWidth;
      const windowHeight = window.outerHeight;
      
      // If there's a significant difference, dev tools might be open
      const widthDiff = Math.abs(windowWidth - viewportWidth);
      const heightDiff = Math.abs(windowHeight - viewportHeight);
      
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Viewport size analysis:', {
          viewportWidth,
          viewportHeight,
          windowWidth,
          windowHeight,
          widthDiff,
          heightDiff,
          isFullscreen,
          visualViewportAvailable: !!window.visualViewport
        });
      }
    }

    // Update frame dimensions using calculated viewport size
    this.viewportModalFrame.style.width = `${viewportWidth}px`;
    this.viewportModalFrame.style.height = `${viewportHeight}px`;

    // Ensure frame stays positioned at viewport origin
    this.viewportModalFrame.style.left = '0px';
    this.viewportModalFrame.style.top = '0px';

    // Handle zoom level changes by ensuring the frame covers the visible area
    if (window.visualViewport) {
      // Adjust position for visual viewport offset (mobile keyboards, etc.)
      this.viewportModalFrame.style.left = `${window.visualViewport.offsetLeft}px`;
      this.viewportModalFrame.style.top = `${window.visualViewport.offsetTop}px`;
    }

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Viewport modal frame size updated:', {
        width: `${viewportWidth}px`,
        height: `${viewportHeight}px`,
        left: this.viewportModalFrame.style.left,
        top: this.viewportModalFrame.style.top,
        isFullscreen,
        zoomLevel: window.devicePixelRatio || 1
      });
    }
  }

  cleanup() {
    // Close any open iframe/settings/guide/preview popovers and shared modal stack.
    try { this.hidePopover(); } catch { /* ignore */ }
    try { this.popupManager?.closeAll?.(); } catch { /* ignore */ }

    // Drop fixed click/image effect ghosts + their page lifecycle listeners.
    try { this.clearEphemeralEffects(); } catch { /* ignore */ }
    try { this._ephemeralEffectLifecycleDispose?.(); } catch { /* ignore */ }

    if (this.overlayObserver) {
      this.overlayObserver.disconnect();
      this.overlayObserver = null;
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Clean up resize timeout
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }

    // Clean up window resize handlers
    if (this.windowResizeHandler) {
      window.removeEventListener('resize', this.windowResizeHandler);
      window.removeEventListener('orientationchange', this.windowResizeHandler);
      this.windowResizeHandler = null;
    }

    // Clean up fullscreen handlers
    if (this.fullscreenHandler) {
      document.removeEventListener('fullscreenchange', this.fullscreenHandler);
      document.removeEventListener('webkitfullscreenchange', this.fullscreenHandler);
      document.removeEventListener('mozfullscreenchange', this.fullscreenHandler);
      document.removeEventListener('MSFullscreenChange', this.fullscreenHandler);
      this.fullscreenHandler = null;
    }

    // Clean up visual viewport handler
    if (this.visualViewportHandler && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.visualViewportHandler);
      this.visualViewportHandler = null;
    }
    
    // Clean up all rendering backends
    this.cleanupRenderingMode();

    if (this.focusOverlay) {
      this.focusOverlay.remove();
      this.focusOverlay = null;
    }
    if (this.inspectorOverlay) {
      this.inspectorOverlay.remove();
      this.inspectorOverlay = null;
    }
    this.deleteOverlay = null;
    this.colsOverlay = null;
    this._inspectorOverlayKind = null;
    this.hideInspectorModeIndicator();
    // Clean up highlight manager
    if (this.highlightManager) {
      this.highlightManager.cleanup();
    }
    this._removeEdgeJumpFadeEl();

    if (this.viewportModalFrame) {
      this.viewportModalFrame.remove();
      this.viewportModalFrame = null;
    }
    if (this.escExitLabelText) {
      this.escExitLabelText.remove();
      this.escExitLabelText = null;
    }
    if (this.escExitLabelHover) {
      this.escExitLabelHover.remove();
      this.escExitLabelHover = null;
    }

    // Clean up debug panel / shadow HUD
    this.cleanupDebugPanel();
    this.cleanupShadowRootDebugHud();
  }

  createElement(tag, props = {}) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'style') {
        element.style.cssText = value;
      } else {
        element.setAttribute(key, value);
      }
    }
    return element;
  }

  // Utility method for debouncing function calls
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Focus the popover iframe so in-frame KeyPilot receives keys without a user click.
   * @param {HTMLIFrameElement|null|undefined} iframe
   */
  _focusPopoverIframe(iframe) {
    if (!iframe) return;
    try { iframe.focus(); } catch { /* ignore */ }
    try { iframe.contentWindow?.focus?.(); } catch { /* ignore */ }
  }

  /**
   * Hybrid focus: keys drive the iframe page when the pointer is over content;
   * when the pointer is over chrome (titlebar / actions / close), focus returns
   * to the parent so Esc/E/P and chrome controls stay reliable.
   *
   * @param {{
   *   iframe: HTMLIFrameElement,
   *   chromeEls?: Array<HTMLElement|null|undefined>,
   *   focusChromeEl?: HTMLElement|null
   * }} opts
   */
  _installPopoverHybridFocus({ iframe, chromeEls, focusChromeEl } = {}) {
    try { this._popoverHybridFocusCleanup?.(); } catch { /* ignore */ }
    this._popoverHybridFocusCleanup = null;

    if (!iframe) return;

    const chrome = (Array.isArray(chromeEls) ? chromeEls : []).filter(Boolean);
    /** @type {'iframe'|'chrome'|null} */
    let zone = null;

    const focusChrome = () => {
      const el = focusChromeEl || chrome[0] || this.popoverContainer;
      try { el?.focus?.(); } catch { /* ignore */ }
    };

    const focusIframe = () => this._focusPopoverIframe(iframe);

    const setZone = (next) => {
      if (next === zone) return;
      zone = next;
      if (next === 'iframe') focusIframe();
      else if (next === 'chrome') focusChrome();
    };

    const onChromeEnter = () => setZone('chrome');
    const onIframeEnter = () => setZone('iframe');

    for (const el of chrome) {
      try { el.addEventListener('pointerenter', onChromeEnter, true); } catch { /* ignore */ }
    }
    try { iframe.addEventListener('pointerenter', onIframeEnter, true); } catch { /* ignore */ }

    this._popoverHybridFocusCleanup = () => {
      for (const el of chrome) {
        try { el.removeEventListener('pointerenter', onChromeEnter, true); } catch { /* ignore */ }
      }
      try { iframe.removeEventListener('pointerenter', onIframeEnter, true); } catch { /* ignore */ }
    };
  }

  /**
   * Ensure we listen for SW popover-window / iframe-denial messages once.
   */
  _ensurePopoverWindowMessageListener() {
    if (this._popoverWindowMsgHandler) return;
    this._popoverWindowMsgHandler = (message) => {
      try {
        if (!message || typeof message.type !== 'string') return;
        if (message.type === MSG.PREVIEW_IFRAME_DENIED) {
          void this._promoteDeniedIframeToWindow(message);
          return;
        }
        if (message.type === MSG.POPOVER_WINDOW_CLOSED) {
          // Clear local window tracking; KeyPilot also clears mode state.
          if (
            typeof message.windowId === 'number' &&
            this._popoverWindowId === message.windowId
          ) {
            this._popoverWindowId = null;
            this._popoverWindowTabId = null;
            this._popoverWindowUrl = null;
            this._popoverWindowKind = null;
          }
        }
      } catch (e) {
        console.warn('[KeyPilot] Popover window message handler failed:', e?.message || e);
      }
    };
    try {
      chrome.runtime.onMessage.addListener(this._popoverWindowMsgHandler);
    } catch { /* ignore */ }
  }

  /**
   * @param {'preview'|'modal'} kind
   * @param {string} url
   * @param {{ mouseX?: number }} [opts]
   * @returns {{ width: number, height: number, left: number, top: number }}
   */
  _computePopoverWindowBounds(kind, url, opts = {}) {
    const availW = Math.max(320, Number(window.screen?.availWidth) || window.innerWidth || 1200);
    const availH = Math.max(240, Number(window.screen?.availHeight) || window.innerHeight || 800);
    const screenLeft = Number(window.screen?.availLeft) || 0;
    const screenTop = Number(window.screen?.availTop) || 0;
    const margin = 20;

    let width;
    let height;
    if (kind === 'modal') {
      // Match overlay: viewport minus ~40pt margins.
      const pt = 40 * (96 / 72); // CSS pt → px approximation
      width = Math.max(480, Math.min(availW - margin * 2, (window.innerWidth || availW) - pt));
      height = Math.max(360, Math.min(availH - margin * 2, (window.innerHeight || availH) - pt));
    } else {
      width = 600;
      height = Math.max(200, availH - margin * 2);
    }

    const mouseX = Number.isFinite(opts.mouseX) ? opts.mouseX : (window.innerWidth || availW) / 2;
    let left = screenLeft + Math.round((window.screenX || 0) + mouseX - width / 2);
    left = Math.max(screenLeft + margin, Math.min(left, screenLeft + availW - width - margin));
    const top = screenTop + margin;

    return { width: Math.round(width), height: Math.round(height), left, top };
  }

  /**
   * Open a sized OS popup window for Link Preview / Open Popover.
   * @param {object} opts
   * @param {string} opts.url
   * @param {'preview'|'modal'} [opts.kind='preview']
   * @param {string[]} [opts.closeKeys]
   * @param {'mobile'|'desktop'} [opts.viewportMode]
   * @param {number} [opts.mouseX]
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   * @param {number} [opts.left]
   * @param {number} [opts.top]
   * @returns {Promise<boolean>}
   */
  async _openPopoverWindow(opts = {}) {
    this._ensurePopoverWindowMessageListener();
    const url = String(opts.url || '').trim();
    if (!url) return false;
    const kind = opts.kind === 'modal' ? 'modal' : 'preview';
    const closeKeys = Array.isArray(opts.closeKeys) && opts.closeKeys.length
      ? opts.closeKeys.map(String)
      : (kind === 'modal' ? ['Escape', 'p', 'P'] : ['Escape', 'e', 'E']);

    let viewportMode = opts.viewportMode === 'mobile' ? 'mobile' : 'desktop';
    if (opts.viewportMode == null) {
      try {
        viewportMode = await this._getPreviewViewportModeForHost(previewHostFromUrl(url));
      } catch {
        viewportMode = 'desktop';
      }
    }

    const bounds = this._computePopoverWindowBounds(kind, url, { mouseX: opts.mouseX });
    const width = typeof opts.width === 'number' ? opts.width : bounds.width;
    const height = typeof opts.height === 'number' ? opts.height : bounds.height;
    const left = typeof opts.left === 'number' ? opts.left : bounds.left;
    const top = typeof opts.top === 'number' ? opts.top : bounds.top;

    try {
      // Clear local tracking; SW replaces any existing window for this opener.
      this._popoverWindowId = null;
      this._popoverWindowTabId = null;
      this._popoverWindowUrl = null;
      this._popoverWindowKind = null;

      const res = await chrome.runtime.sendMessage({
        type: MSG.OPEN_POPOVER_WINDOW,
        url,
        kind,
        closeKeys,
        width,
        height,
        left,
        top,
        viewportMode
      });
      if (res?.type === MSG.ERROR || typeof res?.windowId !== 'number') {
        console.warn('[KeyPilot] Failed to open popover window:', res?.error || res);
        try {
          window.__KeyPilotInstance?.state?.setPopoverOpen?.(false, null);
        } catch { /* ignore */ }
        return false;
      }
      this._popoverWindowId = res.windowId;
      this._popoverWindowTabId = typeof res.tabId === 'number' ? res.tabId : null;
      this._popoverWindowUrl = url;
      this._popoverWindowKind = kind;
      this._pendingIframePromote = null;
      return true;
    } catch (e) {
      console.warn('[KeyPilot] OPEN_POPOVER_WINDOW failed:', e?.message || e);
      try {
        window.__KeyPilotInstance?.state?.setPopoverOpen?.(false, null);
      } catch { /* ignore */ }
      return false;
    }
  }

  /**
   * Register a pending iframe load so the SW can detect framing denial.
   * @param {object} payload
   */
  async _registerPreviewIframeWatch(payload) {
    this._ensurePopoverWindowMessageListener();
    this._pendingIframePromote = payload;
    try {
      await chrome.runtime.sendMessage({
        type: MSG.REGISTER_PREVIEW_IFRAME,
        ...payload
      });
    } catch (e) {
      console.warn('[KeyPilot] REGISTER_PREVIEW_IFRAME failed:', e?.message || e);
    }
  }

  async _unregisterPreviewIframeWatch() {
    this._pendingIframePromote = null;
    try {
      await chrome.runtime.sendMessage({ type: MSG.UNREGISTER_PREVIEW_IFRAME });
    } catch { /* ignore */ }
  }

  /**
   * After ERR_BLOCKED_BY_RESPONSE on the preview iframe, promote to OS window.
   * @param {object} message
   */
  async _promoteDeniedIframeToWindow(message) {
    const url = String(message?.url || this._pendingIframePromote?.url || '').trim();
    if (!url) return;
    // Ignore stale denials if we already have a window or a different overlay URL.
    if (this._popoverWindowId != null) return;

    const kind = message?.kind === 'modal' ? 'modal' : 'preview';
    const closeKeys = Array.isArray(message?.closeKeys) && message.closeKeys.length
      ? message.closeKeys.map(String)
      : (this._pendingIframePromote?.closeKeys || undefined);

    // Tear down overlay DOM only — do not flicker popover mode off.
    this.hidePopover({ closeWindow: false });
    await this._unregisterPreviewIframeWatch();

    const ok = await this._openPopoverWindow({
      url,
      kind,
      closeKeys,
      viewportMode: message?.viewportMode,
      width: message?.width,
      height: message?.height,
      left: message?.left,
      top: message?.top
    });
    if (!ok) {
      console.warn('[KeyPilot] Promote to popover window failed for', url);
    }
  }

  async _closeTrackedPopoverWindow() {
    const windowId = this._popoverWindowId;
    this._popoverWindowId = null;
    this._popoverWindowTabId = null;
    this._popoverWindowUrl = null;
    this._popoverWindowKind = null;
    if (typeof windowId !== 'number') return;
    try {
      await chrome.runtime.sendMessage({
        type: MSG.CLOSE_POPOVER_WINDOW,
        windowId,
        // Opener-initiated close: SW still notifies, but we already cleared local ids.
        notifyOpener: false,
        reason: 'opener_hide'
      });
    } catch { /* ignore */ }
  }

  /**
   * Show popover with iframe containing the linked page.
   * http(s) Open Popover uses {@link createUrlPopoverTitlebar} (Open / Open in New Tab)
   * and deferred iframe src after HTTPS prep. Settings/Guide keep {@link createPopoverTitlebar}.
   * Known iframe deniers (X/FB/IG) open a sized OS popup instead.
   *
   * @param {string} url - The URL to load in the popover
   * @param {object} [opts]
   * @param {string} [opts.title] - Optional title for the titlebar (defaults to url)
   * @param {string} [opts.hintKeyLabel] - Optional key label in the titlebar hint (defaults to 'P')
   * @param {boolean} [opts.showClose=true] - Whether to show the titlebar close button
   * @param {string|Node|null} [opts.titlebarHint] - Override titlebar hint (string or Node)
   * @param {string[]} [opts.closeKeys] - Keys forwarded from iframe that should request close (defaults to ['Escape','p','P'])
   * @param {string} [opts.width] - Optional fixed width (e.g., '920px', overrides viewport-minus-20pt)
   * @param {string} [opts.height] - Optional fixed height (e.g., '600px', overrides viewport-minus-20pt)
   */
  showPopover(url, opts = {}) {
    // Remove existing popover if any
    this.hidePopover();

    const isUrlPopover = isHttpPopoverUrl(url);
    let originalUrl = String(url || '');
    let iframeSrc = originalUrl;
    if (isUrlPopover) {
      const prepared = preparePopoverIframeUrl(url, { rewriteForEmbed: false });
      originalUrl = prepared.originalUrl;
      iframeSrc = prepared.iframeSrc;
    }

    const closeKeys = Array.isArray(opts?.closeKeys) && opts.closeKeys.length
      ? opts.closeKeys.map(String)
      : ['Escape', 'p', 'P'];

    // Eager separate-window path for hosts that refuse iframes.
    if (isUrlPopover && isKnownIframeDenierHost(originalUrl)) {
      void this._openPopoverWindow({
        url: originalUrl,
        kind: 'modal',
        closeKeys
      });
      return;
    }

    const titleText = (opts && typeof opts.title === 'string' && opts.title.trim())
      ? opts.title.trim()
      : originalUrl;
    const hintKeyLabel = (opts && typeof opts.hintKeyLabel === 'string' && opts.hintKeyLabel.trim()) ? opts.hintKeyLabel.trim() : 'P';

    // Centralized close request:
    // Always prefer going through KeyPilot so state (mode/popoverOpen) is updated.
    // Fall back to direct DOM cleanup if KeyPilot isn't available for some reason.
    const requestClosePopover = () => {
      try {
        if (window.__KeyPilotInstance && typeof window.__KeyPilotInstance.handleClosePopover === 'function') {
          window.__KeyPilotInstance.handleClosePopover();
          return;
        }
      } catch (_e) {
        // Ignore and fall back to direct hide
      }
      this.hidePopover();
    };

    const ensureTopMouseTracking = () => {
      if (this._popoverMouseTrackerInstalled) return;
      this._popoverMouseTrackerInstalled = true;
      const update = (e) => {
        try {
          if (!e) return;
          if (typeof e.clientX === 'number') this._popoverLastMouse.x = e.clientX;
          if (typeof e.clientY === 'number') this._popoverLastMouse.y = e.clientY;
        } catch {
          // ignore
        }
      };
      try { document.addEventListener('mousemove', update, true); } catch { /* ignore */ }
      try { document.addEventListener('pointermove', update, true); } catch { /* ignore */ }
    };

    const clickCloseIfHovered = () => {
      try {
        const btn = this.popoverCloseButton;
        if (!btn) return false;
        const x = this._popoverLastMouse.x;
        const y = this._popoverLastMouse.y;
        if (typeof x !== 'number' || typeof y !== 'number') return false;
        const el = previewChromeHost?.shadowRoot?.elementFromPoint?.(x, y)
          || document.elementFromPoint(x, y);
        const shadowEl = btn.getRootNode?.()?.elementFromPoint?.(x, y);
        if (el === btn || btn.contains(el) || shadowEl === btn || btn.contains(shadowEl)) {
          try { btn.click(); } catch { /* ignore */ }
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };

    // Create popover container (NOT using the native Popover API).
    // The Popover API uses the browser "top layer", which can sit above our cursor /
    // green click rectangle regardless of z-index, breaking F-to-click on popover UI.
    this.popoverContainer = this.createElement('div', {
      className: 'kpv2-popover-container',
      tabindex: '-1',
      role: 'dialog',
      'aria-modal': 'true',
      style: `
        position: fixed;
        inset: 0;                  /* top: 0; left: 0; bottom: 0; right: 0; */
        width: ${opts.width || 'calc(100vw - 40pt)'};
        height: ${opts.height || 'calc(100vh - 40pt)'};
        max-width: calc(100vw - 40pt);
        max-height: calc(100vh - 40pt);
        margin: auto;              /* this is what centers it perfectly */
        background: ${NCT_DARK_UI_PANEL_BACKGROUND};
        border-radius: ${NCT_DARK_UI_PANEL_RADIUS};
        border: ${NCT_DARK_UI_PANEL_BORDER};
        box-shadow: ${NCT_DARK_UI_PANEL_BOX_SHADOW};
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: ${KP_UI_FONT};
        font-size: 14px;
        line-height: 1.3;
        letter-spacing: normal;
      `
    });

    // Keep the PopupManager panel and iframe in the light DOM: its focus and
    // resize paths operate on these host-owned nodes. Only KeyPilot-owned
    // titlebar/error chrome is isolated from page CSS in an open shadow root.
    const chromeHost = this.createElement('div', {
      className: 'kpv2-popover-chrome-host',
      style: `
        display: flex;
        flex: 0 0 auto;
        flex-direction: column;
        min-height: 0;
      `
    });
    const chromeShadow = ensureOpenChromeShadow(chromeHost, { id: 'iframe-popover' });
    const chromeMount = chromeShadow || chromeHost;


    // Store iframe reference for focus management
    let iframeRef = null;
    this.popoverBridgeReady = false;

    // Single standard titlebar: title + close hint + uniform × close (no second header bar).
    const showClose = opts?.showClose !== false;
    const titlebarHint = opts?.titlebarHint !== undefined
      ? opts.titlebarHint
      : createTitlebarCloseHint({
        keys: [hintKeyLabel, 'Esc'],
        suffix: 'Use the same keyboard navigation controls.'
      });
    const titlebarApi = isUrlPopover
      ? createUrlPopoverTitlebar({
        title: titleText,
        variant: 'modal',
        showClose,
        onClose: requestClosePopover,
        closeTitle: 'Close (Esc)',
        hint: titlebarHint,
        className: 'kpv2-popover-titlebar',
        getUrl: () => originalUrl,
        afterOpen: requestClosePopover,
        afterOpenNewTab: requestClosePopover
      })
      : createPopoverTitlebar({
        title: titleText,
        variant: 'modal',
        showClose,
        onClose: requestClosePopover,
        closeTitle: 'Close (Esc)',
        hint: titlebarHint,
        className: 'kpv2-popover-titlebar'
      });
    const header = titlebarApi.titlebar;
    const closeButton = titlebarApi.closeButton;
    this.popoverCloseButton = closeButton;
    ensureTopMouseTracking();

    // Create error message container (initially hidden)
    const errorContainer = this.createElement('div', {
      className: 'kpv2-popover-error',
      style: `
        flex: 1;
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
        text-align: center;
        background: #f9f9f9;
      `
    });

    const errorIcon = this.createElement('div', {
      style: `
        font-size: 48px;
        margin-bottom: 16px;
        color: #999;
      `
    });
    errorIcon.textContent = '🚫';
    errorContainer.appendChild(errorIcon);

    const errorTitle = this.createElement('div', {
      style: `
        font-size: 18px;
        font-weight: 600;
        color: #333;
        margin-bottom: 8px;
      `
    });
    errorTitle.textContent = 'Cannot Display Page';
    errorContainer.appendChild(errorTitle);

    const errorMessage = this.createElement('div', {
      style: `
        font-size: 14px;
        color: #666;
        margin-bottom: 24px;
        max-width: 400px;
      `
    });
    errorMessage.textContent = 'This website prevents embedding in iframes for security reasons.';
    errorContainer.appendChild(errorMessage);

    const openInTabButton = this.createElement('button', {
      style: `
        background: #4CAF50;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      `
    });
    openInTabButton.textContent = 'Open in New Tab';
    openInTabButton.onclick = () => {
      window.open(originalUrl, '_blank');
      requestClosePopover();
    };
    errorContainer.appendChild(openInTabButton);

    const iframeStyle = `
        flex: 1;
        border: none;
        width: 100%;
        height: 100%;
      `;
    // http(s): create without src, then assign after mount. Extension pages load immediately.
    const iframe = isUrlPopover
      ? createPopoverIframe({ style: iframeStyle })
      : this.createElement('iframe', {
        src: url,
        tabindex: '0',
        style: iframeStyle
      });
    iframeRef = iframe;
    this.popoverIframeElement = iframe;
    this.popoverIframeWindow = iframe.contentWindow || null;

    // Initialize the iframe bridge (content script running inside the iframe).
    // We retry a few times because content scripts in the frame may not be ready immediately,
    // and some pages navigate/redirect after initial load.
    // Pass closeKeys so Esc/P work inside the focused iframe without a host click.
    const sendBridgeInit = () => {
      try {
        iframe.contentWindow?.postMessage({
          type: 'KP_POPOVER_BRIDGE_INIT',
          closeKeys
        }, '*');
      } catch {
        // Ignore
      }
    };

    // Detect iframe load errors
    // Note: We can't reliably detect X-Frame-Options blocking for cross-origin iframes
    // due to same-origin policy. The declarativeNetRequest rules should handle most cases.
    // Only show error on actual load failure (onerror event).
    const showLoadError = () => {
      iframe.style.display = 'none';
      chromeHost.style.flex = '1 1 auto';
      errorContainer.style.display = 'flex';
    };

    iframe.onerror = () => {
      console.log('[KeyPilot] Iframe load error detected');
      showLoadError();
    };

    /** @type {ReturnType<typeof setTimeout>|null} */
    let loadTimeout = null;
    const armLoadTimeout = () => {
      if (loadTimeout) {
        try { clearTimeout(loadTimeout); } catch { /* ignore */ }
      }
      loadTimeout = setTimeout(() => {
        console.log('[KeyPilot] Iframe load timeout - showing error as fallback');
        showLoadError();
      }, 30000);
    };

    iframe.onload = () => {
      try {
        const srcAttr = iframe.getAttribute('src') || '';
        if (srcAttr === 'about:blank' || iframe.src === 'about:blank') {
          return;
        }
      } catch { /* ignore */ }
      try { clearTimeout(loadTimeout); } catch { /* ignore */ }
      loadTimeout = null;
      console.log('[KeyPilot] Iframe loaded successfully');
      sendBridgeInit();
    };

    chromeMount.appendChild(header);
    chromeMount.appendChild(errorContainer);
    this.popoverContainer.appendChild(chromeHost);
    this.popoverContainer.appendChild(iframe);
    // Mount via PopupManager so the backdrop + stacking are consistent across popups.
    // This also keeps the popup in the normal DOM stacking context (no Popover API top-layer),
    // so KeyPilot overlays (green click rectangle) can sit above it by z-index.
    this.popupManager?.showModal?.({
      id: this._popoverPopupId,
      panel: this.popoverContainer,
      onRequestClose: requestClosePopover
    });

    if (isUrlPopover) {
      void (async () => {
        try {
          const bounds = this._computePopoverWindowBounds('modal', originalUrl);
          await this._registerPreviewIframeWatch({
            url: originalUrl,
            kind: 'modal',
            closeKeys,
            width: bounds.width,
            height: bounds.height,
            left: bounds.left,
            top: bounds.top,
            viewportMode: 'desktop'
          });
          const win = await assignPopoverIframeSrc(iframe, iframeSrc, {
            beforeNavigate: () => { armLoadTimeout(); }
          });
          this.popoverIframeWindow = win;
        } catch (e) {
          console.error('[KeyPilot] Failed to load popover URL:', e?.message || e);
          try { clearTimeout(loadTimeout); } catch { /* ignore */ }
          // Prefer OS-window promote over static error UI.
          void this._promoteDeniedIframeToWindow({
            url: originalUrl,
            kind: 'modal',
            closeKeys
          });
        }
      })();
    } else {
      armLoadTimeout();
    }
    sendBridgeInit();

    // Short retry window to cover slow frames / initial about:blank then navigation
    try {
      let attemptsLeft = 6; // ~1.5s total
      this.popoverInitTimer = setInterval(() => {
        if (!this.popoverContainer || attemptsLeft <= 0) {
          clearInterval(this.popoverInitTimer);
          this.popoverInitTimer = null;
          return;
        }
        attemptsLeft -= 1;
        sendBridgeInit();
      }, 250);
    } catch {
      // Ignore
    }

    // Prevent body scroll when popover is open
    document.body.style.overflow = 'hidden';

    // Add keyboard event listeners directly to catch Escape and F key
    // This ensures they work even when iframe has focus
    const handlePopoverKeyDown = (e) => {
      console.log('[KeyPilot] Popover key event:', e.key, 'Target:', e.target, 'Active element:', document.activeElement);
      
      // Escape key - close popover (always, regardless of where it's pressed)
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        requestClosePopover();
        return;
      }
      
      // NOTE: We intentionally do NOT repurpose "F" to close popovers.
      // "F" is KeyPilot's click key, and users expect it to click popover UI (e.g. ×)
      // once the green rectangle can sit above popovers via z-index stacking.
    };

    // Add listeners to document and popover container with capture phase
    // This ensures we catch events even when iframe or other elements have focus
    document.addEventListener('keydown', handlePopoverKeyDown, true);
    this.popoverContainer.addEventListener('keydown', handlePopoverKeyDown, true);
    
    // Store cleanup function and backdrop reference
    this.popoverKeyHandler = handlePopoverKeyDown;

    // Listen for key events forwarded from the iframe (content script bridge).
    // This enables closing the popover even after the user clicks into the iframe,
    // where the parent document can no longer observe keydown events directly.
    this.popoverMessageHandler = (event) => {
      const data = event?.data;
      if (!data || typeof data.type !== 'string') return;
      if (this.popoverIframeWindow && event.source !== this.popoverIframeWindow) return;

      if (data.type === 'KP_POPOVER_BRIDGE_READY') {
        this.popoverBridgeReady = true;
        // Auto-focus iframe so full KeyPilot works inside without a user click.
        // Close keys (Esc/P) are handled by the iframe bridge → parent.
        this._focusPopoverIframe(iframeRef);
        this._installPopoverHybridFocus({
          iframe: iframeRef,
          chromeEls: [header, ...titlebarApi.getInteractiveElements()].filter(Boolean),
          focusChromeEl: closeButton || header
        });
        return;
      }

      if (data.type === 'KP_POPOVER_REQUEST_CLOSE') {
        // Close on configured keys forwarded by the iframe bridge.
        if (closeKeys.includes(String(data.key))) requestClosePopover();
      }

      if (data.type === 'KP_POPOVER_LAUNCH_WALKTHROUGH') {
        // Guide "Launch Walkthrough": close this popover, then open tutorial from reset.
        requestClosePopover();
        try {
          const ob = window.__KeyPilotOnboarding;
          if (ob && typeof ob.resetTutorial === 'function') {
            void ob.resetTutorial();
          }
        } catch {
          // ignore
        }
        return;
      }

      if (data.type === 'KP_POPOVER_BRIDGE_KEYDOWN') {
        const k = String(data.key || '');
        if (k === 'f' || k === 'F') {
          // Prefer "click close button if hovered" so users can use F on the × affordance
          // even when focus is inside the iframe (keydown doesn't propagate to parent).
          clickCloseIfHovered();
        }
      }
    };
    window.addEventListener('message', this.popoverMessageHandler, true);

    // Until the bridge is ready, keep focus on chrome (then hybrid focus takes over).
    try {
      (closeButton || header)?.focus?.();
    } catch (_e) {
      try {
        this.popoverContainer.focus();
      } catch (_e2) {
        // Ignore
      }
    }
  }

  /**
   * Hide the popover
   */
  /**
   * Remembered viewport mode for a host. Default is desktop; only mobile is stored.
   * @param {string} hostname
   * @returns {Promise<'mobile'|'desktop'>}
   */
  async _getPreviewViewportModeForHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    if (!host) return 'desktop';
    try {
      const map = await storageGetValue(PREVIEW_VIEWPORT_BY_HOST_KEY, {});
      if (map && typeof map === 'object' && map[host] === 'mobile') {
        return 'mobile';
      }
    } catch (e) {
      console.warn('[KeyPilot] Failed to read preview viewport prefs:', e?.message || e);
    }
    return 'desktop';
  }

  /**
   * Persist viewport mode for a host. Desktop clears the override (default).
   * @param {string} hostname
   * @param {'mobile'|'desktop'} mode
   * @returns {Promise<void>}
   */
  async _setPreviewViewportModeForHost(hostname, mode) {
    const host = String(hostname || '').toLowerCase();
    if (!host) return;
    try {
      const prev = await storageGetValue(PREVIEW_VIEWPORT_BY_HOST_KEY, {});
      const map = (prev && typeof prev === 'object' && !Array.isArray(prev))
        ? { ...prev }
        : {};
      if (mode === 'mobile') {
        map[host] = 'mobile';
      } else {
        delete map[host];
      }
      await storageSetValue(PREVIEW_VIEWPORT_BY_HOST_KEY, map);
    } catch (e) {
      console.warn('[KeyPilot] Failed to save preview viewport prefs:', e?.message || e);
    }
  }

  /**
   * Ask the service worker to enable/disable mobile User-Agent for this tab's
   * sub_frame requests (Link Preview Mobile mode).
   * @param {boolean} enabled
   * @returns {Promise<boolean>}
   */
  async _setPreviewMobileUa(enabled) {
    const next = !!enabled;
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        this._previewMobileUaActive = false;
        return false;
      }
      const res = await chrome.runtime.sendMessage({
        type: MSG.SET_PREVIEW_MOBILE_UA,
        enabled: next
      });
      if (res?.type === MSG.ERROR) {
        console.warn('[KeyPilot] Preview mobile UA not applied:', res.error || res);
        this._previewMobileUaActive = false;
        return false;
      }
      this._previewMobileUaActive = next;
      return true;
    } catch (e) {
      console.warn('[KeyPilot] Preview mobile UA message failed:', e?.message || e);
      this._previewMobileUaActive = false;
      return false;
    }
  }

  /**
   * Move focus out of the popover (esp. its iframe) before the node is removed.
   * Otherwise Chrome often hands focus to the browser omnibox, which steals keys
   * from the page (notably on New Tab after a second E closes Link Preview).
   */
  _restoreFocusFromPopover() {
    const iframe = this.popoverIframeElement;
    const container = this.popoverContainer;
    if (!iframe && !container) return;

    let active = null;
    try { active = document.activeElement; } catch { /* ignore */ }

    const focusInPopover =
      !!(iframe && active === iframe) ||
      !!(container && active instanceof Node && container.contains(active));

    // Always try to leave the iframe before removal; focus-in-iframe is the
    // main omnibox-steal case even when activeElement reporting is odd.
    try { iframe?.blur?.(); } catch { /* ignore */ }
    if (focusInPopover) {
      try { active?.blur?.(); } catch { /* ignore */ }
    }

    try { window.focus(); } catch { /* ignore */ }

    // Park focus on a surviving element. Prefer body (make it programmatically
    // focusable) so the page keeps keyboard ownership after teardown.
    try {
      const body = document.body;
      if (body) {
        if (!body.hasAttribute('tabindex')) {
          body.setAttribute('tabindex', '-1');
        }
        body.focus({ preventScroll: true });
      }
    } catch { /* ignore */ }
  }

  hidePopover(opts = {}) {
    const closeWindow = opts.closeWindow !== false;

    // Drop denial watch so a late error does not reopen a window after close.
    void this._unregisterPreviewIframeWatch();

    if (closeWindow) {
      void this._closeTrackedPopoverWindow();
    }

    // Drop mobile UA session rule so host-page iframes are not affected after close.
    if (this._previewMobileUaActive) {
      this._previewMobileUaActive = false;
      try {
        void this._setPreviewMobileUa(false);
      } catch { /* ignore */ }
    }

    // Capture focus back onto the page *before* removing a focused iframe.
    try { this._restoreFocusFromPopover(); } catch { /* ignore */ }

    // Stop bridge init retries
    if (this.popoverInitTimer) {
      try {
        clearInterval(this.popoverInitTimer);
      } catch {
        // Ignore
      }
      this.popoverInitTimer = null;
    }

    // Remove iframe bridge message listener
    if (this.popoverMessageHandler) {
      try {
        window.removeEventListener('message', this.popoverMessageHandler, true);
      } catch {
        // Ignore
      }
      this.popoverMessageHandler = null;
    }
    this.popoverIframeWindow = null;
    this.popoverIframeElement = null;
    this.popoverBridgeReady = false;
    this.popoverCloseButton = null;

    // Remove keyboard event listeners
    if (this.popoverKeyHandler) {
      document.removeEventListener('keydown', this.popoverKeyHandler, true);

      if (this.popoverContainer) {
        this.popoverContainer.removeEventListener('keydown', this.popoverKeyHandler, true);
      }

      this.popoverKeyHandler = null;
    }

    // Remove preview popover arrow style if exists
    if (this._popoverArrowStyle) {
      try {
        this._popoverArrowStyle.remove();
      } catch { /* ignore */ }
      this._popoverArrowStyle = null;
    }

    // Remove click-outside handler if exists
    if (this._popoverClickOutsideHandler) {
      try {
        document.removeEventListener('mousedown', this._popoverClickOutsideHandler, true);
      } catch { /* ignore */ }
      this._popoverClickOutsideHandler = null;
    }

    // Tear down preview titlebar drag handlers
    if (this._previewPopoverDragCleanup) {
      try {
        this._previewPopoverDragCleanup();
      } catch { /* ignore */ }
      this._previewPopoverDragCleanup = null;
    }

    // Tear down resize handles (preview mounts outside PopupManager)
    if (this._popoverResizeDispose) {
      try {
        this._popoverResizeDispose();
      } catch { /* ignore */ }
      this._popoverResizeDispose = null;
    }

    // Tear down hybrid chrome/iframe focus routing
    if (this._popoverHybridFocusCleanup) {
      try {
        this._popoverHybridFocusCleanup();
      } catch { /* ignore */ }
      this._popoverHybridFocusCleanup = null;
    }

    if (this.popoverContainer) {
      // For preview popover (direct mount), remove directly
      // For regular popover, unmount via PopupManager
      if (this._isPreviewPopover) {
        try {
          this.popoverContainer.remove();
        } catch { /* ignore */ }
      } else {
        // Unmount via PopupManager (removes panel + shared backdrop when last popup closes).
        try {
          this.popupManager?.hideModal?.(this._popoverPopupId);
        } catch {
          // Fallback: direct remove
          try { this.popoverContainer.remove(); } catch { /* ignore */ }
        }
      }
      this.popoverContainer = null;
    }

    this._isPreviewPopover = false;

    // After DOM teardown, re-assert page focus (container may have held it).
    try {
      window.focus();
      if (document.body && document.activeElement !== document.body) {
        document.body.focus({ preventScroll: true });
      }
    } catch { /* ignore */ }

    // Restore body scroll (only needed for regular popover, but doesn't hurt)
    document.body.style.overflow = '';
  }

  /**
   * Post a message to the popover iframe bridge (if present).
   * @param {any} message
   * @returns {boolean} Whether a postMessage was attempted successfully
   */
  postMessageToPopoverIframe(message) {
    const win = this.popoverIframeWindow;
    if (!win) return false;
    try {
      win.postMessage(message, '*');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cover the overflow box that will jump, run `onCovered` (instant scroll), then uncover.
   * Nested scrollers get their client box; the document root gets the viewport.
   * @param {() => void} onCovered
   * @param {{ durationMs?: number, coverEl?: Element|null, coverRect?: { left: number, top: number, width: number, height: number }|null, edge?: 'top'|'bottom'|null }} [opts]
   * @returns {Promise<void>}
   */
  async runEdgeJumpFade(onCovered, opts = {}) {
    const durationMs = Number.isFinite(Number(opts.durationMs))
      ? Math.max(80, Number(opts.durationMs))
      : SCROLL.EDGE_JUMP_FADE_MS;

    let reduced = false;
    try {
      reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    } catch { /* ignore */ }
    if (reduced) {
      try { onCovered?.(); } catch { /* ignore */ }
      return;
    }

    const token = ++this._edgeJumpFadeToken;
    const el = this._ensureEdgeJumpFadeEl();
    this._positionEdgeJumpFadeEl(el, opts.coverEl || null, opts.coverRect || null);
    const bg = this._resolveEdgeJumpFadeColor(opts.coverEl || null);
    el.style.background = bg;
    this._syncEdgeJumpFadeIcon(el, opts.edge, bg);
    el.style.transition = `opacity ${durationMs}ms ease`;
    await this._fadeEdgeJumpEl(el, 1, durationMs);
    try { onCovered?.(); } catch { /* ignore */ }
    if (token !== this._edgeJumpFadeToken) return;
    await this._fadeEdgeJumpEl(el, 0, durationMs);
    if (token === this._edgeJumpFadeToken) this._removeEdgeJumpFadeEl();
  }

  /**
   * @returns {HTMLElement}
   */
  _ensureEdgeJumpFadeEl() {
    if (this._edgeJumpFadeEl && this._edgeJumpFadeEl.isConnected) return this._edgeJumpFadeEl;
    const el = document.createElement('div');
    el.className = CSS_CLASSES.EDGE_JUMP_FADE;
    el.setAttribute('aria-hidden', 'true');
    const host = document.documentElement || document.body;
    try { host.appendChild(el); } catch { document.body?.appendChild(el); }
    this._edgeJumpFadeEl = el;
    return el;
  }

  /**
   * Pin the veil to the visible overflow box (or the viewport for the document).
   * @param {HTMLElement} veil
   * @param {Element|null} coverEl
   * @param {{ left: number, top: number, width: number, height: number }|null} coverRect
   */
  _positionEdgeJumpFadeEl(veil, coverEl, coverRect) {
    let left = 0;
    let top = 0;
    let width = window.innerWidth || 0;
    let height = window.innerHeight || 0;
    if (coverRect && Number.isFinite(coverRect.width) && Number.isFinite(coverRect.height)) {
      left = coverRect.left;
      top = coverRect.top;
      width = coverRect.width;
      height = coverRect.height;
    } else if (coverEl) {
      try {
        const doc = coverEl.ownerDocument || document;
        const se = doc.scrollingElement;
        const isRoot = coverEl === se || coverEl === doc.documentElement || coverEl === doc.body;
        if (isRoot) {
          left = 0;
          top = 0;
          width = window.innerWidth || 0;
          height = window.innerHeight || 0;
        } else {
          const r = coverEl.getBoundingClientRect();
          left = r.left;
          top = r.top;
          width = r.width;
          height = r.height;
        }
      } catch { /* keep viewport */ }
    }
    veil.style.left = `${Math.round(left)}px`;
    veil.style.top = `${Math.round(top)}px`;
    veil.style.width = `${Math.max(0, Math.round(width))}px`;
    veil.style.height = `${Math.max(0, Math.round(height))}px`;
  }

  /**
   * @param {Element|null} coverEl
   * @returns {string}
   */
  _resolveEdgeJumpFadeColor(coverEl) {
    const isTransparent = (c) => {
      const s = String(c || '').trim().toLowerCase();
      if (!s || s === 'transparent') return true;
      const m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
      if (m && m[4] !== undefined && Number(m[4]) === 0) return true;
      return false;
    };
    try {
      let node = coverEl;
      let hops = 0;
      while (node && hops++ < 12) {
        const c = getComputedStyle(node).backgroundColor;
        if (!isTransparent(c)) return c;
        node = node.parentElement;
      }
      const html = getComputedStyle(document.documentElement);
      const body = document.body ? getComputedStyle(document.body) : html;
      for (const c of [body.backgroundColor, html.backgroundColor]) {
        if (!isTransparent(c)) return c;
      }
    } catch { /* ignore */ }
    try {
      if (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches) return '#111';
    } catch { /* ignore */ }
    return '#fff';
  }

  /**
   * @param {string} color
   * @returns {string}
   */
  _edgeJumpIconFill(color) {
    const s = String(color || '').trim().toLowerCase();
    let r = 255;
    let g = 255;
    let b = 255;
    const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      const h = hex[1];
      if (h.length === 3) {
        r = parseInt(h[0] + h[0], 16);
        g = parseInt(h[1] + h[1], 16);
        b = parseInt(h[2] + h[2], 16);
      } else {
        r = parseInt(h.slice(0, 2), 16);
        g = parseInt(h.slice(2, 4), 16);
        b = parseInt(h.slice(4, 6), 16);
      }
    } else {
      const m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
      if (m) {
        r = Number(m[1]);
        g = Number(m[2]);
        b = Number(m[3]);
      }
    }
    const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return y > 0.55 ? 'rgba(28, 28, 28, 0.62)' : 'rgba(255, 255, 255, 0.78)';
  }

  /**
   * Corner SVG: top-right for Scroll To Top, bottom-right for Scroll To Bottom.
   * @param {HTMLElement} veil
   * @param {'top'|'bottom'|string|null|undefined} edge
   * @param {string} backgroundColor
   */
  _syncEdgeJumpFadeIcon(veil, edge, backgroundColor) {
    const dir = edge === 'bottom' ? 'bottom' : 'top';
    const pathD = EDGE_JUMP_ICON_PATHS[dir];
    let svg = veil.querySelector?.(`.${CSS_CLASSES.EDGE_JUMP_FADE_ICON}`);
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', CSS_CLASSES.EDGE_JUMP_FADE_ICON);
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('viewBox', '0 0 512 512');
      svg.setAttribute('width', '56');
      svg.setAttribute('height', '56');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD);
      svg.appendChild(path);
      veil.appendChild(svg);
    } else {
      const path = svg.querySelector('path');
      if (path) path.setAttribute('d', pathD);
    }
    svg.setAttribute('data-kp-edge', dir);
    const fill = this._edgeJumpIconFill(backgroundColor);
    svg.setAttribute('fill', fill);
    const path = svg.querySelector('path');
    if (path) path.setAttribute('fill', fill);
  }

  /**
   * @param {HTMLElement} el
   * @param {number} opacity
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _fadeEdgeJumpEl(el, opacity, ms) {
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        el.removeEventListener('transitionend', onEnd);
        resolve();
      };
      const onEnd = (e) => {
        if (e.target !== el || (e.propertyName && e.propertyName !== 'opacity')) return;
        done();
      };
      el.addEventListener('transitionend', onEnd);
      const apply = () => { el.style.opacity = String(opacity); };
      requestAnimationFrame(() => requestAnimationFrame(apply));
      setTimeout(done, ms + 80);
    });
  }

  _removeEdgeJumpFadeEl() {
    this._edgeJumpFadeToken += 1;
    const el = this._edgeJumpFadeEl;
    this._edgeJumpFadeEl = null;
    if (!el) return;
    try { el.remove(); } catch { /* ignore */ }
  }

  /**
   * Scroll the popover iframe by a delta (in pixels).
   * @param {number} deltaY
   * @param {'smooth'|'auto'} behavior
   */
  scrollPopoverBy(deltaY, behavior = 'smooth') {
    return this.postMessageToPopoverIframe({
      type: 'KP_POPOVER_SCROLL',
      command: 'scrollBy',
      delta: deltaY,
      behavior
    });
  }

  scrollPopoverToTop(behavior = 'smooth') {
    return this.postMessageToPopoverIframe({
      type: 'KP_POPOVER_SCROLL',
      command: 'scrollToTop',
      behavior
    });
  }

  scrollPopoverToBottom(behavior = 'smooth') {
    return this.postMessageToPopoverIframe({
      type: 'KP_POPOVER_SCROLL',
      command: 'scrollToBottom',
      behavior
    });
  }

  /**
   * Check if popover is currently open (overlay iframe or OS popup window).
   * @returns {boolean}
   */
  isPopoverOpen() {
    return this.popoverContainer !== null || this._popoverWindowId != null;
  }

  /**
   * Show a preview popover near the cursor (picture-in-picture style)
   * @param {string} url - URL to load in iframe
   * @param {Object} opts - Options including mouseX, mouseY for positioning
   * @param {'mobile'|'desktop'} [opts.viewportMode] - Override mode; otherwise host preference or desktop default
   */
  async showPreviewPopover(url, opts = {}) {
    // Remove existing popover if any
    this.hidePopover();

    const { originalUrl, iframeSrc } = preparePopoverIframeUrl(url, { rewriteForEmbed: true });
    url = originalUrl;

    const mouseX = opts.mouseX ?? window.innerWidth / 2;
    const closeKeys = Array.isArray(opts?.closeKeys) && opts.closeKeys.length
      ? opts.closeKeys.map(String)
      : ['Escape', 'e', 'E'];

    // Eager separate-window path for hosts that refuse iframes.
    if (isKnownIframeDenierHost(url)) {
      await this._openPopoverWindow({
        url,
        kind: 'preview',
        closeKeys,
        mouseX,
        viewportMode: opts.viewportMode
      });
      return;
    }

    const popoverWidth = 600;
    const arrowSize = 10; // Kept for drag cleanup / style vars if user resizes later
    const margin = 20; // Margin from viewport edges
    const previewHost = previewHostFromUrl(url);

    // Full viewport height with the existing edge margins (top + bottom).
    const popoverHeight = Math.max(200, window.innerHeight - margin * 2);
    const top = margin;

    // Center horizontally under cursor, but clamp to viewport
    let left = mouseX - popoverWidth / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));

    // No top/bottom caret on a full-height panel (would sit outside the viewport).
    const arrowLeft = Math.max(20, Math.min(mouseX - left, popoverWidth - 20));

    const titleText = 'Link Preview';

    // Default desktop; restore per-host Mobile if the user chose it before.
    /** @type {'mobile'|'desktop'} */
    let viewportMode = 'desktop';
    if (opts.viewportMode === 'mobile' || opts.viewportMode === 'desktop') {
      viewportMode = opts.viewportMode;
    } else {
      try {
        viewportMode = await this._getPreviewViewportModeForHost(previewHost);
      } catch {
        viewportMode = 'desktop';
      }
    }

    // Centralized close request
    const requestClosePopover = () => {
      try {
        if (window.__KeyPilotInstance && typeof window.__KeyPilotInstance.handleClosePopover === 'function') {
          window.__KeyPilotInstance.handleClosePopover();
          return;
        }
      } catch (_e) {
        // Ignore and fall back to direct hide
      }
      this.hidePopover();
    };

    const ensureTopMouseTracking = () => {
      if (this._popoverMouseTrackerInstalled) return;
      this._popoverMouseTrackerInstalled = true;
      const update = (e) => {
        try {
          if (!e) return;
          if (typeof e.clientX === 'number') this._popoverLastMouse.x = e.clientX;
          if (typeof e.clientY === 'number') this._popoverLastMouse.y = e.clientY;
        } catch {
          // ignore
        }
      };
      try { document.addEventListener('mousemove', update, true); } catch { /* ignore */ }
      try { document.addEventListener('pointermove', update, true); } catch { /* ignore */ }
    };

    const clickCloseIfHovered = () => {
      try {
        const btn = this.popoverCloseButton;
        if (!btn) return false;
        const x = this._popoverLastMouse.x;
        const y = this._popoverLastMouse.y;
        if (typeof x !== 'number' || typeof y !== 'number') return false;
        const el = document.elementFromPoint(x, y);
        if (!el) return false;
        if (el === btn || btn.contains(el)) {
          try { btn.click(); } catch { /* ignore */ }
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };

    // Create popover container (full viewport height; no top/bottom caret).
    this.popoverContainer = this.createElement('div', {
      className: 'kpv2-preview-popover-container',
      tabindex: '-1',
      role: 'dialog',
      'aria-modal': 'true',
      style: `
        position: fixed;
        top: ${top}px;
        left: ${left}px;
        width: ${popoverWidth}px;
        height: ${popoverHeight}px;
        background: ${NCT_DARK_UI_PANEL_BACKGROUND};
        border-radius: ${NCT_DARK_UI_PANEL_RADIUS};
        border: ${NCT_DARK_UI_PANEL_BORDER};
        box-shadow: ${NCT_DARK_UI_PANEL_BOX_SHADOW};
        display: flex;
        flex-direction: column;
        overflow: hidden;
        --arrow-left: ${arrowLeft}px;
        z-index: ${Z_INDEX.POPUP_PANEL_BASE};
        font-family: ${KP_UI_FONT};
        font-size: 12px;
        line-height: 1.3;
        letter-spacing: normal;
      `
    });
    // Intentionally hybrid:
    // - The light host owns fixed geometry, the caret pseudo-elements, the
    //   iframe viewport, and resize handles. The iframe bridge/focus flow
    //   depends on this host relationship, and the resize utility pins this
    //   host's box while temporarily disabling iframe pointer events.
    // - Only KeyPilot-owned interactive chrome is placed in the open shadow
    //   root, preventing page CSS from restyling the titlebar and controls.
    // Do not move the iframe or resize handles into this shadow root without
    // updating their focus, hit-testing, and geometry contracts together.
    const previewChromeHost = this.createElement('div', {
      className: 'kpv2-preview-popover-chrome-host',
      style: 'display:flex; flex:0 0 auto; flex-direction:column; min-height:0;'
    });
    const previewChromeShadow = ensureOpenChromeShadow(previewChromeHost, { id: 'link-preview-chrome' });
    const previewChromeMount = previewChromeShadow || previewChromeHost;

    // Inject triangle arrow CSS
    const arrowStyle = this.createElement('style');
    arrowStyle.textContent = `
      .kpv2-preview-popover-container::before {
        content: "";
        position: absolute;
        width: 0;
        height: 0;
        left: var(--arrow-left, 50%);
        margin-left: -${arrowSize}px;
        border: ${arrowSize}px solid transparent;
        z-index: 1;
      }
      .kpv2-preview-popover-container::after {
        content: "";
        position: absolute;
        width: 0;
        height: 0;
        left: var(--arrow-left, 50%);
        margin-left: -${arrowSize - 1}px;
        border: ${arrowSize - 1}px solid transparent;
        z-index: 2;
      }
      .kpv2-preview-popover-container[data-placement="bottom"]::before {
        top: -${arrowSize * 2}px;
        border-bottom-color: rgb(43, 43, 43);
      }
      .kpv2-preview-popover-container[data-placement="bottom"]::after {
        top: -${arrowSize * 2 - 1}px;
        border-bottom-color: rgb(18, 18, 18);
      }
      .kpv2-preview-popover-container[data-placement="top"]::before {
        bottom: -${arrowSize * 2}px;
        border-top-color: rgb(43, 43, 43);
      }
      .kpv2-preview-popover-container[data-placement="top"]::after {
        bottom: -${arrowSize * 2 - 1}px;
        border-top-color: rgb(11, 11, 11);
      }
    `;
    document.head.appendChild(arrowStyle);
    this._popoverArrowStyle = arrowStyle;

    // Store iframe reference for focus management
    let iframeRef = null;
    this.popoverBridgeReady = false;

    // Full-bleed viewport shell (mobile and desktop both fill the popover width).
    const iframeViewport = this.createElement('div', {
      className: 'kpv2-preview-popover-viewport',
      style: `
        flex: 1;
        min-height: 0;
        display: flex;
        align-items: stretch;
        justify-content: stretch;
        overflow: hidden;
        background: #0a0a0a;
      `
    });

    /**
     * Mobile = mobile User-Agent + client hints (true mobile pages).
     * Desktop = normal desktop UA.
     * Both modes fill the popover width; reload is required for UA to take effect.
     * @param {'mobile'|'desktop'} mode
     * @param {{ reload?: boolean }} [opts]
     */
    const applyViewportMode = async (mode, opts = {}) => {
      const next = mode === 'desktop' ? 'desktop' : 'mobile';
      const prev = viewportMode;
      const shouldReload = opts.reload !== false && prev !== next && !!iframeRef;
      viewportMode = next;
      try {
        this.popoverContainer?.setAttribute('data-kp-preview-viewport', viewportMode);
      } catch { /* ignore */ }

      // Full-width frame in both modes (no side letterboxing).
      if (iframeRef) {
        iframeRef.style.width = '100%';
        iframeRef.style.maxWidth = 'none';
        iframeRef.style.flex = '1 1 auto';
        iframeRef.style.alignSelf = 'stretch';
        iframeRef.style.height = '100%';
      }
      iframeViewport.style.justifyContent = 'stretch';

      // Install / clear mobile UA before any navigation so the document request sees it.
      if (viewportMode === 'mobile') {
        await this._setPreviewMobileUa(true);
      } else {
        await this._setPreviewMobileUa(false);
      }

      if (shouldReload && iframeRef) {
        try {
          // Reset load error UI if we were showing it.
          iframeViewport.style.display = '';
          errorContainer.style.display = 'none';
        } catch { /* ignore */ }
        try {
          armLoadTimeout();
        } catch { /* ignore — armLoadTimeout defined later; first apply never reloads */ }
        try {
          // Force a real navigation with the new UA (same-url assignment can be a no-op).
          iframeRef.src = 'about:blank';
          iframeRef.src = iframeSrc;
          this.popoverIframeWindow = iframeRef.contentWindow || null;
        } catch {
          try {
            iframeRef.src = iframeSrc;
            this.popoverIframeWindow = iframeRef.contentWindow || null;
          } catch { /* ignore */ }
        }
      }
    };

    const viewportModeControl = createSegmentedControl({
      value: viewportMode,
      ariaLabel: 'Preview viewport mode',
      className: 'kpv2-preview-viewport-mode',
      options: [
        {
          value: 'mobile',
          label: 'Mobile',
          title: 'Mobile site (mobile User-Agent). Remembered for this website.',
          ariaLabel: 'Mobile preview'
        },
        {
          value: 'desktop',
          label: 'Desktop',
          title: 'Desktop site (default). Remembered for this website.',
          ariaLabel: 'Desktop preview'
        }
      ],
      onChange: (value) => {
        void (async () => {
          await applyViewportMode(value, { reload: true });
          // Persist per website so future Link Previews open in the same mode.
          try {
            await this._setPreviewViewportModeForHost(previewHost, value === 'mobile' ? 'mobile' : 'desktop');
          } catch { /* ignore */ }
        })();
      }
    });

    // Shared URL-popover titlebar: Mobile/Desktop extra + Open / Open in New Tab.
    const titlebarApi = createUrlPopoverTitlebar({
      title: titleText,
      variant: 'preview',
      draggable: true,
      titleAttr: 'Drag to move',
      showClose: true,
      onClose: requestClosePopover,
      closeTitle: 'Close (Esc)',
      hint: 'Press Esc / E to hide',
      extraActions: [viewportModeControl.root],
      className: 'kpv2-preview-popover-titlebar',
      getUrl: () => url,
      afterOpen: () => requestClosePopover(),
      afterOpenNewTab: () => requestClosePopover()
    });
    const header = titlebarApi.titlebar;
    const closeButton = titlebarApi.closeButton;
    this.popoverCloseButton = closeButton;
    ensureTopMouseTracking();

    // Titlebar drag: move the preview popover; clamp to viewport; hide caret once moved.
    let dragState = null;
    const DRAG_MOVE_THRESHOLD_PX = 3;

    const clampPopoverPosition = (leftPx, topPx) => {
      const el = this.popoverContainer;
      if (!el) return { left: leftPx, top: topPx };
      const w = el.offsetWidth || popoverWidth;
      const h = el.offsetHeight || popoverHeight;
      const maxLeft = Math.max(margin, window.innerWidth - w - margin);
      const maxTop = Math.max(margin, window.innerHeight - h - margin);
      return {
        left: Math.max(margin, Math.min(leftPx, maxLeft)),
        top: Math.max(margin, Math.min(topPx, maxTop))
      };
    };

    const hidePreviewArrow = () => {
      const el = this.popoverContainer;
      if (!el || el.dataset.kpDragged === '1') return;
      el.dataset.kpDragged = '1';
      el.removeAttribute('data-placement');
    };

    const onDragPointerMove = (e) => {
      if (!dragState || !this.popoverContainer) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (!dragState.moved) {
        if (Math.abs(dx) < DRAG_MOVE_THRESHOLD_PX && Math.abs(dy) < DRAG_MOVE_THRESHOLD_PX) {
          return;
        }
        dragState.moved = true;
        hidePreviewArrow();
        header.style.cursor = 'grabbing';
        // Prevent iframe from swallowing pointer events mid-drag
        if (this.popoverIframeElement) {
          this.popoverIframeElement.style.pointerEvents = 'none';
        }
      }
      const next = clampPopoverPosition(dragState.originLeft + dx, dragState.originTop + dy);
      this.popoverContainer.style.left = `${next.left}px`;
      this.popoverContainer.style.top = `${next.top}px`;
    };

    const endDrag = (e) => {
      if (!dragState) return;
      const pointerId = dragState.pointerId;
      dragState = null;
      header.style.cursor = 'grab';
      if (this.popoverIframeElement) {
        this.popoverIframeElement.style.pointerEvents = '';
      }
      try {
        if (e && typeof e.pointerId === 'number') {
          header.releasePointerCapture(e.pointerId);
        } else if (typeof pointerId === 'number') {
          header.releasePointerCapture(pointerId);
        }
      } catch { /* ignore */ }
      document.removeEventListener('pointermove', onDragPointerMove, true);
      document.removeEventListener('pointerup', endDrag, true);
      document.removeEventListener('pointercancel', endDrag, true);
    };

    const onTitlebarPointerDown = (e) => {
      // Action / close buttons keep their own click behavior (don't start a drag)
      const interactive = titlebarApi.getInteractiveElements();
      for (const btn of interactive) {
        if (e.target === btn || (btn.contains && btn.contains(e.target))) {
          return;
        }
      }
      // Primary button only for mouse
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (!this.popoverContainer) return;

      e.preventDefault();
      e.stopPropagation();

      const rect = this.popoverContainer.getBoundingClientRect();
      dragState = {
        startX: e.clientX,
        startY: e.clientY,
        originLeft: rect.left,
        originTop: rect.top,
        pointerId: e.pointerId,
        moved: false
      };

      try {
        header.setPointerCapture(e.pointerId);
      } catch { /* ignore */ }

      document.addEventListener('pointermove', onDragPointerMove, true);
      document.addEventListener('pointerup', endDrag, true);
      document.addEventListener('pointercancel', endDrag, true);
    };

    header.addEventListener('pointerdown', onTitlebarPointerDown);

    this._previewPopoverDragCleanup = () => {
      endDrag();
      try {
        header.removeEventListener('pointerdown', onTitlebarPointerDown);
      } catch { /* ignore */ }
    };

    // Generic resize handles (edges + SE grip). Shared util used by all popovers.
    try {
      this._popoverResizeDispose?.();
    } catch { /* ignore */ }
    try {
      const resizeApi = makePopoverResizable(this.popoverContainer, {
        minWidth: 280,
        minHeight: 200,
        margin,
        onResizeStart: () => {
          hidePreviewArrow();
        }
      });
      this._popoverResizeDispose = resizeApi?.dispose || null;
    } catch (e) {
      console.warn('[KeyPilot] Failed to make preview popover resizable:', e?.message || e);
      this._popoverResizeDispose = null;
    }

    // Create error message container (initially hidden)
    const errorContainer = this.createElement('div', {
      className: 'kpv2-popover-error',
      style: `
        flex: 1;
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 20px;
        text-align: center;
        background: #f9f9f9;
      `
    });
    // `display:contents` preserves the original flex fallback layout while
    // still giving KeyPilot's error UI its own isolated shadow tree.
    const previewErrorHost = this.createElement('div', {
      className: 'kpv2-preview-popover-error-host',
      style: 'display:contents;'
    });
    const previewErrorShadow = ensureOpenChromeShadow(previewErrorHost, { id: 'link-preview-error' });
    const previewErrorMount = previewErrorShadow || previewErrorHost;

    const errorIcon = this.createElement('div', {
      style: `
        font-size: 32px;
        margin-bottom: 12px;
        color: #999;
      `
    });
    errorIcon.textContent = '🚫';
    errorContainer.appendChild(errorIcon);

    const errorTitle = this.createElement('div', {
      style: `
        font-size: 14px;
        font-weight: 600;
        color: #333;
        margin-bottom: 6px;
      `
    });
    errorTitle.textContent = 'Cannot Display Page';
    errorContainer.appendChild(errorTitle);

    const errorMessage = this.createElement('div', {
      style: `
        font-size: 12px;
        color: #666;
        margin-bottom: 16px;
        max-width: 300px;
      `
    });
    errorMessage.textContent = 'This website prevents embedding in iframes.';
    errorContainer.appendChild(errorMessage);

    const openInTabButton = this.createElement('button', {
      style: `
        background: #4CAF50;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
      `
    });
    openInTabButton.textContent = 'Open in New Tab';
    openInTabButton.onclick = () => {
      window.open(url, '_blank');
      requestClosePopover();
    };
    errorContainer.appendChild(openInTabButton);

    // Create iframe full-bleed; src is set only after mobile UA is installed (when needed).
    const iframe = createPopoverIframe({
      style: `
        border: none;
        width: 100%;
        max-width: none;
        height: 100%;
        flex: 1 1 auto;
        align-self: stretch;
        background: #fff;
      `
    });
    iframeRef = iframe;
    this.popoverIframeElement = iframe;
    this.popoverIframeWindow = iframe.contentWindow || null;

    // Initialize the iframe bridge; pass closeKeys so Esc/E close from inside the frame.
    const sendBridgeInit = () => {
      try {
        iframe.contentWindow?.postMessage({
          type: 'KP_POPOVER_BRIDGE_INIT',
          closeKeys
        }, '*');
      } catch {
        // Ignore
      }
    };

    // Detect iframe load errors / hangs
    /** @type {ReturnType<typeof setTimeout>|null} */
    let loadTimeout = null;
    const armLoadTimeout = () => {
      if (loadTimeout) {
        try { clearTimeout(loadTimeout); } catch { /* ignore */ }
      }
      loadTimeout = setTimeout(() => {
        console.log('[KeyPilot] Iframe load timeout - showing error as fallback');
        iframeViewport.style.display = 'none';
        errorContainer.style.display = 'flex';
      }, 30000);
    };
    const clearLoadTimeout = () => {
      if (!loadTimeout) return;
      try { clearTimeout(loadTimeout); } catch { /* ignore */ }
      loadTimeout = null;
    };

    iframe.onerror = () => {
      console.log('[KeyPilot] Iframe load error detected');
      clearLoadTimeout();
      iframeViewport.style.display = 'none';
      errorContainer.style.display = 'flex';
    };

    iframe.onload = () => {
      // Ignore the intermediate about:blank used when switching UA modes.
      try {
        const srcAttr = iframe.getAttribute('src') || '';
        if (srcAttr === 'about:blank' || iframe.src === 'about:blank') {
          return;
        }
      } catch { /* ignore */ }
      clearLoadTimeout();
      console.log('[KeyPilot] Iframe loaded successfully');
      sendBridgeInit();
    };

    iframeViewport.appendChild(iframe);
    previewChromeMount.appendChild(header);
    previewErrorMount.appendChild(errorContainer);
    this.popoverContainer.appendChild(previewChromeHost);
    this.popoverContainer.appendChild(iframeViewport);
    this.popoverContainer.appendChild(previewErrorHost);

    // Mark this as a preview popover (for cleanup logic)
    this._isPreviewPopover = true;

    // Mount directly to document.body (no backdrop/blur for preview popover)
    try {
      document.body.appendChild(this.popoverContainer);
    } catch (e) {
      console.error('[KeyPilot] Failed to mount preview popover:', e);
      this._isPreviewPopover = false;
      return;
    }

    // Apply UA for remembered/default mode before first navigation (desktop = no spoof).
    void (async () => {
      try {
        const winBounds = this._computePopoverWindowBounds('preview', url, { mouseX });
        await this._registerPreviewIframeWatch({
          url,
          kind: 'preview',
          closeKeys,
          width: winBounds.width,
          height: winBounds.height,
          left: winBounds.left,
          top: winBounds.top,
          viewportMode
        });
        const win = await assignPopoverIframeSrc(iframe, iframeSrc, {
          beforeNavigate: async () => {
            try {
              await applyViewportMode(viewportMode, { reload: false });
            } catch (e) {
              console.warn('[KeyPilot] Failed to prepare preview viewport mode:', e?.message || e);
            }
            armLoadTimeout();
          }
        });
        this.popoverIframeWindow = win;
      } catch (e) {
        console.error('[KeyPilot] Failed to load preview URL:', e?.message || e);
        clearLoadTimeout();
        void this._promoteDeniedIframeToWindow({
          url,
          kind: 'preview',
          closeKeys,
          viewportMode
        });
      }
    })();

    // Add click-outside-to-close handler for preview popover
    this._popoverClickOutsideHandler = (e) => {
      // Check if click is outside the popover container
      if (this.popoverContainer && !this.popoverContainer.contains(e.target)) {
        console.log('[KeyPilot] Click outside preview popover, closing');
        requestClosePopover();
      }
    };
    // Use a small delay to avoid immediately closing if the preview key click triggered this
    setTimeout(() => {
      if (this.popoverContainer) {
        document.addEventListener('mousedown', this._popoverClickOutsideHandler, true);
      }
    }, 100);

    sendBridgeInit();

    // Retry window for iframe bridge init
    try {
      let attemptsLeft = 6;
      this.popoverInitTimer = setInterval(() => {
        if (!this.popoverContainer || attemptsLeft <= 0) {
          clearInterval(this.popoverInitTimer);
          this.popoverInitTimer = null;
          return;
        }
        attemptsLeft -= 1;
        sendBridgeInit();
      }, 250);
    } catch {
      // Ignore
    }

    // Don't prevent body scroll for preview popover - page should remain interactive

    // Parent-side close while focus is on chrome (titlebar / buttons).
    // When focus is in the iframe, Esc/E are handled by the bridge → REQUEST_CLOSE.
    const handlePopoverKeyDown = (e) => {
      console.log('[KeyPilot] Preview popover key event:', e.key);

      if (e.key === 'Escape' || closeKeys.includes(String(e.key))) {
        // Only handle here if focus is still in the parent document.
        // (If focus is in the iframe, the bridge already owns these keys.)
        const ae = document.activeElement;
        const focusInIframe = ae === iframeRef || ae === iframe;
        if (focusInIframe) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        requestClosePopover();
        return;
      }
    };

    document.addEventListener('keydown', handlePopoverKeyDown, true);
    this.popoverContainer.addEventListener('keydown', handlePopoverKeyDown, true);

    this.popoverKeyHandler = handlePopoverKeyDown;

    // Listen for messages from iframe bridge
    this.popoverMessageHandler = (event) => {
      const data = event?.data;
      if (!data || typeof data.type !== 'string') return;
      if (this.popoverIframeWindow && event.source !== this.popoverIframeWindow) return;

      if (data.type === 'KP_POPOVER_BRIDGE_READY') {
        this.popoverBridgeReady = true;
        // Auto-focus iframe so full KeyPilot works on the preview page without a click.
        // Esc/E close via bridge → parent; hybrid focus returns to chrome on titlebar hover.
        this._focusPopoverIframe(iframeRef);
        this._installPopoverHybridFocus({
          iframe: iframeRef,
          chromeEls: [
            header,
            ...titlebarApi.getInteractiveElements()
          ].filter(Boolean),
          focusChromeEl: closeButton || header
        });
        return;
      }

      if (data.type === 'KP_POPOVER_REQUEST_CLOSE') {
        if (closeKeys.includes(String(data.key))) requestClosePopover();
      }

      if (data.type === 'KP_POPOVER_LAUNCH_WALKTHROUGH') {
        requestClosePopover();
        try {
          const ob = window.__KeyPilotOnboarding;
          if (ob && typeof ob.resetTutorial === 'function') {
            void ob.resetTutorial();
          }
        } catch {
          // ignore
        }
        return;
      }

      if (data.type === 'KP_POPOVER_BRIDGE_KEYDOWN') {
        const k = String(data.key || '');
        if (k === 'f' || k === 'F') {
          clickCloseIfHovered();
        }
      }
    };
    window.addEventListener('message', this.popoverMessageHandler, true);

    // Until bridge ready, park focus on chrome.
    try {
      (closeButton || header)?.focus?.();
    } catch (_e) {
      try {
        this.popoverContainer.focus();
      } catch (_e2) {
        // Ignore
      }
    }
  }

  // =============================================================================
  // DEBUG PANEL - Performance metrics display in upper-right corner
  // =============================================================================

  /**
   * Initialize debug panel if enabled
   */
  initDebugPanel() {
    if (!FEATURE_FLAGS.ENABLE_DEBUG_PANEL) return;

    this.createDebugPanel();
    this.startDebugPanelUpdates();
  }

  /**
   * Create the debug panel element
   */
  createDebugPanel() {
    if (this.debugPanel) return;

    this.debugPanel = document.createElement('div');
    this.debugPanel.id = 'kpv2-debug-panel';
    this.debugPanel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.9);
      color: #00ff00;
      font-family: monospace;
      font-size: 11px;
      padding: 8px 12px;
      border-radius: 4px;
      border: 1px solid #333;
      z-index: ${Z_INDEX.DEBUG_HUD};
      pointer-events: none;
      max-width: 300px;
      white-space: pre-wrap;
      line-height: 1.4;
    `;

    document.body.appendChild(this.debugPanel);
  }

  /**
   * Start periodic updates of debug panel data
   */
  startDebugPanelUpdates() {
    if (!this.debugPanel) return;

    // Update immediately
    this.updateDebugPanel();

    // Update every 2 seconds
    this.debugPanelUpdateInterval = setInterval(() => {
      this.updateDebugPanel();
    }, 2000);
  }

  /**
   * Update debug panel with current metrics
   */
  updateDebugPanel() {
    if (!this.debugPanel || !FEATURE_FLAGS.ENABLE_DEBUG_PANEL) return;

    const data = this.collectDebugData();
    const content = this.formatDebugContent(data);

    this.debugPanel.textContent = content;
  }

  /**
   * Collect debug data from various sources
   */
  collectDebugData() {
    const intersectionManager = window.keyPilot?.intersectionManager;
    const complexPageDetector = intersectionManager?.complexPageDetector;
    const currentState = window.keyPilot?.state?.getState?.() || {};

    // Get hover element information
    const hoverElement = currentState.focusEl;
    let hoverInfo = 'None';
    let clickableReasons = [];
    if (hoverElement) {
      const tagName = hoverElement.tagName?.toLowerCase() || 'unknown';
      const className = hoverElement.className ? `.${hoverElement.className.split(' ')[0]}` : '';
      const id = hoverElement.id ? `#${hoverElement.id}` : '';
      const href = hoverElement.href ? ` → ${hoverElement.href.substring(0, 30)}...` : '';
      const text = hoverElement.textContent?.trim().substring(0, 20) || '';
      hoverInfo = `${tagName}${id}${className}${href ? href : text ? ` "${text}..."` : ''}`;

      // Analyze why this element is clickable
      clickableReasons = this.analyzeClickableReasons(hoverElement);
    }

    const isComplexPage = complexPageDetector ? complexPageDetector.complexityLevel !== 'low' : false;

    return {
      // Page complexity
      complexityLevel: complexPageDetector?.complexityLevel || 'unknown',
      isComplexPage: isComplexPage,

      // Hover information
      hoverElement: hoverInfo,
      clickableReasons: clickableReasons,

      // Element counts
      totalElements: document.querySelectorAll('*').length,
      interactiveElements: document.querySelectorAll(
        'a[href], button, input, select, textarea, [role="button"], [role="link"], [contenteditable="true"], [onclick]'
      ).length,

      // IO metrics
      ioObservations: intersectionManager?.observedInteractiveElements?.size || 0,
      visibleElements: intersectionManager?.visibleInteractiveElements?.size || 0,

      // RBush metrics
      rbushEnabled: intersectionManager?._rtreeEnabled?.() || false,
      rbushItems: intersectionManager?._rtreeItemsByElement?.size || 0,
      rbushQueries: intersectionManager?.metrics?.rtreeQueries || 0,
      rbushHits: intersectionManager?.metrics?.rtreeHits || 0,

      // Performance metrics
      cacheHits: intersectionManager?.metrics?.cacheHits || 0,
      cacheMisses: intersectionManager?.metrics?.cacheMisses || 0,
      observerUpdates: intersectionManager?.metrics?.observerUpdates || 0,

      // Culling stats (only for medium/high complexity sites)
      culledCount: isComplexPage ? (intersectionManager?.metrics?.culledCount || 0) : 0,
      totalCulled: isComplexPage ? (intersectionManager?.metrics?.totalCulled || 0) : 0,

      // Rendering mode
      renderingMode: this.renderingMode || 'unknown',

      // Memory estimate
      estimatedMemory: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage of various components
   */
  estimateMemoryUsage() {
    const intersectionManager = window.keyPilot?.intersectionManager;
    let memoryKB = 0;

    // Estimate RBush memory (rough approximation)
    if (intersectionManager?._rtreeItemsByElement) {
      memoryKB += intersectionManager._rtreeItemsByElement.size * 0.5; // ~0.5KB per item
    }

    // Estimate element cache memory
    if (intersectionManager?.elementPositionCache) {
      memoryKB += intersectionManager.elementPositionCache.size * 1; // ~1KB per cached element
    }

    return Math.round(memoryKB);
  }

  /**
   * Analyze why an element is considered clickable
   */
  analyzeClickableReasons(element) {
    if (!element || element.nodeType !== 1) return [];

    const reasons = [];

    // Check selector matches
    const focusableSel = 'a[href], button, input, select, textarea, video, audio, [contenteditable="true"], [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [data-action], [data-toggle], [data-click], [data-href], [data-link], [vue-click], [ng-click]';
    const matchesSelector = element.matches && element.matches(focusableSel);
    if (matchesSelector) {
      reasons.push('CSS Selector Match');
    }

    // Check role attribute
    const role = (element.getAttribute && (element.getAttribute('role') || '').trim().toLowerCase()) || '';
    const clickableRoles = ['link', 'button', 'slider', 'checkbox', 'radio', 'tab', 'menuitem', 'option', 'switch', 'treeitem', 'combobox', 'spinbutton'];
    const hasRole = role && clickableRoles.includes(role);
    if (hasRole) {
      reasons.push(`ARIA Role: "${role}"`);
    }

    // Check click handlers
    const hasOnClick = element.onclick || element.getAttribute('onclick');
    const elementDetector = window.keyPilot?.elementDetector;
    const hasTrackedClickHandler = elementDetector?.hasTrackedClickHandler?.(element);
    if (hasOnClick) {
      reasons.push('onclick Attribute');
    }
    if (hasTrackedClickHandler) {
      reasons.push('Event Listener (click)');
    }

    // Check cursor style (always check, not just when no other reasons found).
    // Use ElementDetector so CUSTOM_CURSORS mode still reports real page pointers.
    try {
      const hasCursor = elementDetector && typeof elementDetector.hasExplicitCursorPointer === 'function'
        ? elementDetector.hasExplicitCursorPointer(element)
        : !!(window.getComputedStyle && window.getComputedStyle(element).cursor === 'pointer');
      if (hasCursor) {
        reasons.push('CSS cursor: pointer');
      }
    } catch {
      // Ignore getComputedStyle errors
    }

    // If element is determined to be clickable by isLikelyInteractive but we haven't found any reasons,
    // add a generic reason to ensure we show something
    if (reasons.length === 0) {
      try {
        const elementDetector = window.keyPilot?.elementDetector;
        if (elementDetector && typeof elementDetector.isLikelyInteractive === 'function') {
          const isClickable = elementDetector.isLikelyInteractive(element);
          if (isClickable) {
            // If it's clickable but we didn't find a specific reason, check more thoroughly
            // This handles cases where the tracked click handler might not be detected yet
            // or where cursor pointer wasn't checked due to other conditions
            reasons.push('Likely Interactive (detected by element detector)');
          }
        }
      } catch (e) {
        // If isLikelyInteractive check fails, still try to provide a reason
        // Check if element is in the intersection observer's observed elements
        const intersectionManager = window.keyPilot?.intersectionManager;
        if (intersectionManager?.observedInteractiveElements?.has?.(element)) {
          reasons.push('Observed as Interactive Element');
        }
      }
    }

    return reasons;
  }

  /**
   * Format debug data into readable display content
   */
  formatDebugContent(data) {
    const cacheHitRate = data.cacheHits + data.cacheMisses > 0
      ? Math.round((data.cacheHits / (data.cacheHits + data.cacheMisses)) * 100)
      : 0;

    const rbushHitRate = data.rbushQueries > 0
      ? Math.round((data.rbushHits / data.rbushQueries) * 100)
      : 0;

    const cullingSection = data.isComplexPage ? `

🗑️  Spatial Culling
Last Cull: ${data.culledCount.toLocaleString()}
Total Culled: ${data.totalCulled.toLocaleString()}` : '';

    const clickableReasonsSection = data.clickableReasons.length > 0
      ? `\n🔍 Clickable Because:\n${data.clickableReasons.map(reason => `  • ${reason}`).join('\n')}`
      : '';

    return `KeyPilot Debug Panel
───────────────────
Complexity: ${data.complexityLevel.toUpperCase()} ${data.isComplexPage ? '🔴' : '🟢'}
Renderer: ${data.renderingMode.toUpperCase()}

🎯 Hover: ${data.hoverElement}${clickableReasonsSection}

📊 Elements
Total: ${data.totalElements.toLocaleString()}
Interactive: ${data.interactiveElements.toLocaleString()}

👁️  IO Observer
Observed: ${data.ioObservations.toLocaleString()}
Visible: ${data.visibleElements.toLocaleString()}

🌳 RBush Index
Enabled: ${data.rbushEnabled ? '✅' : '❌'}
Items: ${data.rbushItems.toLocaleString()}
Queries: ${data.rbushQueries.toLocaleString()}
Hit Rate: ${rbushHitRate}%${cullingSection}

⚡ Performance
Cache Hits: ${data.cacheHits.toLocaleString()} (${cacheHitRate}%)
Observer Updates: ${data.observerUpdates.toLocaleString()}

💾 Memory: ~${data.estimatedMemory}KB`;
  }

  /**
   * Clean up debug panel
   */
  cleanupDebugPanel() {
    if (this.debugPanelUpdateInterval) {
      clearInterval(this.debugPanelUpdateInterval);
      this.debugPanelUpdateInterval = null;
    }

    if (this.debugPanel) {
      this.debugPanel.remove();
      this.debugPanel = null;
    }
  }

  // =============================================================================
  // SHADOW ROOT DEBUG HUD — leaf / focus / paint + force A|B|C
  // =============================================================================

  /**
   * Enable or disable the interactive shadow-root paint debug HUD.
   * Runtime: `keyPilot.setShadowRootDebugHud(true)`
   * @param {boolean} enabled
   */
  setShadowRootDebugHud(enabled) {
    this._shadowDebugHudEnabled = !!enabled;
    try {
      if (FEATURE_FLAGS) FEATURE_FLAGS.DEBUG_SHADOW_ROOT_HUD = !!enabled;
    } catch { /* ignore */ }

    if (this._shadowDebugHudEnabled) {
      this._ensureShadowRootDebugHud();
      // Re-paint current focus with current override (if any).
      try {
        const focusEl = window.keyPilot?.state?.getState?.()?.focusEl ||
          window.keyPilot?.intersectionManager?.getDomHoveredElement?.() ||
          null;
        if (focusEl) this.updateFocusOverlay(focusEl);
        else this._updateShadowRootDebugHud(null, null, {
          inShadow: false,
          autoStrategy: '—',
          appliedStrategy: '—',
          override: this._shadowDebugPaintOverride
        });
      } catch { /* ignore */ }
    } else {
      this._shadowDebugPaintOverride = null;
      this.cleanupShadowRootDebugHud();
      // Restore auto paint for current focus.
      try {
        const focusEl = window.keyPilot?.state?.getState?.()?.focusEl || null;
        if (focusEl) this.updateFocusOverlay(focusEl);
      } catch { /* ignore */ }
    }
  }

  /**
   * Force paint strategy while the HUD is open.
   * @param {'A'|'B'|'C'|null|string} strategy - null / 'auto' clears override
   */
  setShadowDebugPaintStrategy(strategy) {
    const s = strategy == null ? null : String(strategy).toUpperCase();
    if (s === 'A' || s === 'B' || s === 'C') {
      this._shadowDebugPaintOverride = s;
    } else {
      this._shadowDebugPaintOverride = null;
    }
    this._refreshShadowDebugHudButtons();
    try {
      const focusEl = window.keyPilot?.state?.getState?.()?.focusEl ||
        window.keyPilot?.intersectionManager?.getDomHoveredElement?.() ||
        null;
      if (focusEl) this.updateFocusOverlay(focusEl);
    } catch { /* ignore */ }
  }

  /** @returns {boolean} */
  isShadowRootDebugHudEnabled() {
    return !!this._shadowDebugHudEnabled;
  }

  cleanupShadowRootDebugHud() {
    if (this._shadowDebugHud) {
      try { this._shadowDebugHud.remove(); } catch { /* ignore */ }
      this._shadowDebugHud = null;
    }
  }

  /**
   * Compact element description for the HUD.
   * @param {Element|null|undefined} el
   * @returns {{ line: string, detail: string }}
   */
  _describeElForShadowDebug(el) {
    if (!el || el.nodeType !== 1) {
      return { line: '(none)', detail: '' };
    }
    const tag = el.tagName || '?';
    const id = el.id ? `#${el.id}` : '';
    let cls = '';
    try {
      const cn = typeof el.className === 'string'
        ? el.className
        : (el.className && el.className.baseVal) || '';
      const parts = String(cn).trim().split(/\s+/).filter(Boolean).slice(0, 2);
      cls = parts.length ? '.' + parts.join('.') : '';
    } catch { /* ignore */ }

    let wh = '?×?';
    try {
      const r = el.getBoundingClientRect();
      wh = `${Math.round(r.width)}×${Math.round(r.height)}`;
    } catch { /* ignore */ }

    let inShadow = false;
    const hosts = [];
    try {
      inShadow = this._isInShadowTree(el);
      let n = el;
      let depth = 0;
      while (n && depth++ < 8) {
        const root = typeof n.getRootNode === 'function' ? n.getRootNode() : null;
        if (root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
          hosts.push(root.host?.tagName || 'HOST');
          n = root.host;
        } else {
          break;
        }
      }
    } catch { /* ignore */ }

    let href = '';
    try {
      if (el.href) href = String(el.href).slice(0, 56);
    } catch { /* ignore */ }

    const line = `${tag}${id}${cls}`.slice(0, 72);
    const detailParts = [
      wh,
      inShadow ? `shadow:${hosts.join('←') || '?'}` : 'light',
      href ? href : null
    ].filter(Boolean);
    return { line, detail: detailParts.join(' · ') };
  }

  _ensureShadowRootDebugHud() {
    if (this._shadowDebugHud && this._shadowDebugHud.isConnected) {
      this._shadowDebugHud.style.display = 'block';
      this._refreshShadowDebugHudButtons();
      return this._shadowDebugHud;
    }

    const hud = document.createElement('div');
    hud.id = 'kpv2-shadow-debug-hud';
    hud.className = 'kpv2-shadow-debug-hud';
    hud.setAttribute('data-kp-ui', '1');
    hud.setAttribute('aria-label', 'KeyPilot shadow root debug HUD');
    hud.style.cssText = `
      position: fixed;
      bottom: 12px;
      left: 12px;
      z-index: ${Z_INDEX.DEBUG_HUD};
      width: min(420px, calc(100vw - 24px));
      max-height: min(50vh, 420px);
      overflow: auto;
      background: rgba(12, 16, 22, 0.94);
      color: #d7ffe8;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      line-height: 1.35;
      padding: 10px 12px 12px;
      border-radius: 8px;
      border: 1px solid #3d8f6a;
      box-shadow: 0 8px 28px rgba(0,0,0,0.45);
      pointer-events: auto;
      user-select: text;
    `;

    hud.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <strong style="color:#7CFFB2;letter-spacing:0.02em;">Shadow Root Debug</strong>
        <button type="button" data-kp-shadow-dbg="close"
          style="background:#243028;color:#cfe;border:1px solid #3d8f6a;border-radius:4px;padding:2px 8px;cursor:pointer;font:inherit;">×</button>
      </div>
      <div data-kp-shadow-dbg-body style="white-space:pre-wrap;margin-bottom:10px;color:#b8eccf;"></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
        <span style="color:#8ab89a;">Paint:</span>
        <button type="button" data-kp-shadow-dbg-strategy="auto">Auto</button>
        <button type="button" data-kp-shadow-dbg-strategy="A">A outline</button>
        <button type="button" data-kp-shadow-dbg-strategy="B">B in-target</button>
        <button type="button" data-kp-shadow-dbg-strategy="C">C fixed</button>
      </div>
      <div style="margin-top:8px;color:#6f9a80;font-size:10px;">
        A = element outline · B = absolute ring in host · C = body fixed overlay
      </div>
    `;

    // Shared button chrome; active state set in _refreshShadowDebugHudButtons.
    try {
      hud.querySelectorAll('button[data-kp-shadow-dbg-strategy]').forEach((btn) => {
        btn.style.cssText = `
          background:#1a2820;color:#cfe;border:1px solid #3d5a48;border-radius:4px;
          padding:4px 8px;cursor:pointer;font:inherit;
        `;
      });
    } catch { /* ignore */ }

    const stop = (e) => {
      try { e.stopPropagation(); } catch { /* ignore */ }
      try { e.stopImmediatePropagation?.(); } catch { /* ignore */ }
    };
    hud.addEventListener('pointerdown', stop, true);
    hud.addEventListener('pointerup', stop, true);
    hud.addEventListener('click', (e) => {
      stop(e);
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.getAttribute('data-kp-shadow-dbg') === 'close') {
        this.setShadowRootDebugHud(false);
        return;
      }
      const strat = t.getAttribute('data-kp-shadow-dbg-strategy');
      if (strat === 'auto') this.setShadowDebugPaintStrategy(null);
      else if (strat === 'A' || strat === 'B' || strat === 'C') {
        this.setShadowDebugPaintStrategy(strat);
      }
    }, true);

    document.body.appendChild(hud);
    this._shadowDebugHud = hud;
    this._refreshShadowDebugHudButtons();
    return hud;
  }

  _refreshShadowDebugHudButtons() {
    const hud = this._shadowDebugHud;
    if (!hud) return;
    const active = this._shadowDebugPaintOverride; // null = auto
    try {
      hud.querySelectorAll('button[data-kp-shadow-dbg-strategy]').forEach((btn) => {
        const key = btn.getAttribute('data-kp-shadow-dbg-strategy');
        const isOn =
          (key === 'auto' && !active) ||
          (key === active);
        btn.style.background = isOn ? '#2f6b4a' : '#1a2820';
        btn.style.borderColor = isOn ? '#7CFFB2' : '#3d5a48';
        btn.style.color = isOn ? '#eafff2' : '#cfe';
        btn.style.fontWeight = isOn ? '700' : '400';
      });
    } catch { /* ignore */ }
  }

  /**
   * Refresh leaf line after sticky-host pointer moves (focusEl/paint unchanged).
   * Called from IntersectionObserverManager — does not re-run A/B/C paint.
   */
  refreshShadowRootDebugHudLeaf() {
    if (!this._shadowDebugHudEnabled) return;
    const last = this._shadowDebugLastInfo;
    let focusEl = last?.focus || null;
    try {
      if (!focusEl || !focusEl.isConnected) {
        focusEl = window.keyPilot?.state?.getState?.()?.focusEl ||
          window.keyPilot?.intersectionManager?.getDomHoveredElement?.() ||
          null;
      }
    } catch { focusEl = last?.focus || null; }

    let paintEl = last?.paint || null;
    if (focusEl && (!paintEl || !paintEl.isConnected)) {
      try {
        paintEl = this._resolveElementForFocusStyling(focusEl) || focusEl;
      } catch {
        paintEl = focusEl;
      }
    }

    let inShadow = !!last?.inShadow;
    try {
      if (focusEl) inShadow = this._isInShadowTree(focusEl);
    } catch { /* ignore */ }

    this._updateShadowRootDebugHud(focusEl, paintEl, {
      inShadow,
      autoStrategy: last?.auto || '—',
      appliedStrategy: last?.applied || '—',
      override: this._shadowDebugPaintOverride
    });
  }

  /**
   * Refresh HUD text from current hover / paint decision.
   * @param {Element|null} focusEl
   * @param {Element|null} paintEl
   * @param {{ inShadow: boolean, autoStrategy: string, appliedStrategy: string, override: string|null }} meta
   */
  _updateShadowRootDebugHud(focusEl, paintEl, meta) {
    if (!this._shadowDebugHudEnabled) return;
    const hud = this._ensureShadowRootDebugHud();
    if (!hud) return;

    let leaf = null;
    try {
      leaf = window.keyPilot?.intersectionManager?.getDomHoverLeaf?.() ||
        window.__KP_HOVER_LEAF ||
        null;
    } catch { leaf = null; }

    const leafDesc = this._describeElForShadowDebug(leaf);
    const focusDesc = this._describeElForShadowDebug(focusEl);
    const paintDesc = this._describeElForShadowDebug(paintEl);

    const override = meta?.override || null;
    const autoStrategy = meta?.autoStrategy || '—';
    const applied = meta?.appliedStrategy || '—';
    const inShadow = !!meta?.inShadow;

    this._shadowDebugLastInfo = {
      leaf,
      focus: focusEl,
      paint: paintEl,
      auto: autoStrategy,
      applied,
      inShadow
    };

    const body = hud.querySelector('[data-kp-shadow-dbg-body]');
    if (!body) return;

    const paintSame =
      focusEl && paintEl && focusEl === paintEl
        ? 'same as focus'
        : (paintEl ? 'resolved (may pierce shadow)' : '—');

    body.textContent =
`Leaf (under pointer)
  ${leafDesc.line}
  ${leafDesc.detail || '—'}

Hover target (focusEl / F-activate)
  ${focusDesc.line}
  ${focusDesc.detail || '—'}

Paint target (outline box)
  ${paintDesc.line}
  ${paintDesc.detail || '—'}
  (${paintSame})

Strategy
  focus in shadow: ${inShadow ? 'YES' : 'no'}
  auto would use:  ${autoStrategy}
  applied now:     ${applied}${override ? `  (forced ${override})` : '  (auto)'}`;

    this._refreshShadowDebugHudButtons();
  }
}