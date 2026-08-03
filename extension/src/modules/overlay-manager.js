/**
 * Visual overlay management for focus and delete indicators
 */
import { CSS_CLASSES, Z_INDEX, SELECTORS, MODES, COLORS, FEATURE_FLAGS, CLICKABLE_CATEGORY, KP_UI_FONT } from '../config/constants.js';
import { MSG } from '../messaging/types.js';
import { HighlightManager } from './highlight-manager.js';
import { PopupManager } from './popup-manager.js';
import { DEFAULT_SETTINGS } from './settings-manager.js';
import { storageGetValue, storageSetValue } from '../utils/storage.js';
import { makePopoverResizable } from '../utils/popover-resize.js';
import { createPreviewOpenActionButtons } from '../ui/preview-open-actions.js';
import {
  createPopoverTitlebar,
  createTitlebarCloseHint
} from '../ui/popover-titlebar.js';
import { createSegmentedControl } from '../ui/segmented-control.js';

/** Per-host Link Preview viewport mode: { [hostname]: 'mobile' }. Missing/default = desktop. */
const PREVIEW_VIEWPORT_BY_HOST_KEY = 'kp_link_preview_viewport_by_host';

/**
 * @param {string} url
 * @returns {string} normalized hostname (lowercase, no leading www.)
 */
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
    this.renderingMode = 'canvas'; // Default to current DOM-based rendering

    // Canvas rendering backend
    this.canvasOverlay = null;
    this.canvasContext = null;

    // CSS Custom Properties rendering backend
    this.cssCustomPropsOverlay = null;

    this.focusOverlay = null;
    this.deleteOverlay = null;
    this.focusedTextOverlay = null; // New overlay for focused text fields
    this.viewportModalFrame = null; // Viewport modal frame for text focus mode
    this.activeTextInputFrame = null; // Pulsing frame for active text inputs
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
      focusedText: true,
      activeTextInput: true,
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

    // When DOM-hover listener mode is enabled, render non-text focus rectangles in blue so it's
    // visually obvious we're using browser-native hover targeting (vs RBush-driven hit-testing).
    this._useDomHoverFocusColors = false;

    // Text focus styling (we style the focused input + nearby wrapper parents directly).
    this._textFocusCurrentElement = null;
    this._textFocusStyledElements = new Set();

    // Text input hover styling (we tint hovered inputs instead of drawing orange frames).
    this._textHoverCurrentElement = null;
    this._textHoverStyledElements = new Set();

    // Last known focus target (used for F-click scale-up pulse across all render modes).
    this._lastFocusElement = null;
    this._lastFocusRect = null;

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

    const rect = (rectOverride && typeof rectOverride === 'object')
      ? rectOverride
      : this.getBestRect(element);
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

    const rect = (rectOverride && typeof rectOverride === 'object')
      ? rectOverride
      : this.getBestRect(element);
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

  // SELECTION RECTANGLE FUNCTIONALITY ONLY
  setSelectionMode(mode) {
    return this.highlightManager.setSelectionMode(mode);
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
    return { strokeThickness: thickness, labelsEnabled: tm.labelsEnabled };
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
      return;
    }
    try {
      for (const el of this._textFocusStyledElements) {
        if (!el || el.nodeType !== 1) continue;
        try {
          el.classList.remove(CSS_CLASSES.TEXT_FOCUS_INPUT);
          el.classList.remove(CSS_CLASSES.TEXT_FOCUS_INPUT_PARENT);
        } catch { /* ignore */ }
      }
    } finally {
      this._textFocusStyledElements.clear();
      this._textFocusCurrentElement = null;
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

    // Avoid thrashing the DOM on RAF-driven overlay refreshes.
    if (this._textFocusCurrentElement === inputEl && this._textFocusStyledElements.size > 0) {
      try { inputEl.classList.add(CSS_CLASSES.TEXT_FOCUS_INPUT); } catch { /* ignore */ }
      return;
    }

    this._clearTextFocusElementStyling();
    this._textFocusCurrentElement = inputEl;

    try {
      this._ensureStylesForElement(inputEl);
      inputEl.classList.add(CSS_CLASSES.TEXT_FOCUS_INPUT);
      this._textFocusStyledElements.add(inputEl);
    } catch { /* ignore */ }

    const parents = this._getNearbyInputWrappers(inputEl);
    for (const p of parents) {
      try {
        this._ensureStylesForElement(p);
        p.classList.add(CSS_CLASSES.TEXT_FOCUS_INPUT_PARENT);
        this._textFocusStyledElements.add(p);
      } catch { /* ignore */ }
    }
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

    const parents = this._getNearbyInputWrappers(inputEl);
    for (const p of parents) {
      try {
        this._ensureStylesForElement(p);
        p.classList.add(CSS_CLASSES.TEXT_HOVER_INPUT_PARENT);
        this._textHoverStyledElements.add(p);
      } catch { /* ignore */ }
    }
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
          } else if (overlay === this.deleteOverlay) {
            this.overlayVisibility.delete = isVisible;
            overlay.style.visibility = isVisible ? 'visible' : 'hidden';
          } else if (overlay === this.focusedTextOverlay) {
            this.overlayVisibility.focusedText = isVisible;
            overlay.style.visibility = isVisible ? 'visible' : 'hidden';
          } else if (overlay === this.activeTextInputFrame) {
            this.overlayVisibility.activeTextInput = isVisible;
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

  updateOverlays(focusEl, deleteEl, mode, focusedTextElement = null, focusRectOverride = null) {
    // Debug logging when debug mode is enabled
    if (window.KEYPILOT_DEBUG && focusEl) {
      console.log('[KeyPilot Debug] Updating overlays:', {
        focusElement: focusEl.tagName,
        mode: mode,
        willShowFocus: mode === 'none' || mode === 'text_focus' || mode === 'highlight' || mode === 'popover',
        focusedTextElement: focusedTextElement?.tagName
      });
    }
    
    // Show focus overlay in normal mode, text focus mode, highlight mode, AND popover mode.
    // Popovers are modal but still need the green rectangle so the user can F-click UI
    // affordances like the close (×) button.
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
    
    // Text focus mode styling: tint the actual focused input (and nearby wrapper parents)
    // instead of drawing an orange frame overlay.
    if (mode === 'text_focus' && focusedTextElement) {
      this._applyTextFocusElementStyling(focusedTextElement);
    } else {
      this._clearTextFocusElementStyling();
    }

    // Always suppress the legacy orange text-focus frame overlays (we now style the element itself).
    this.hideFocusedTextOverlay();
    this.hideActiveTextInputFrame();
    
    // Show viewport modal frame when in text focus mode (controlled by flag)
    this.updateViewportModalFrame(mode === 'text_focus' && FEATURE_FLAGS.SHOW_WINDOW_OUTLINE);
    
    // Only show delete overlay in delete mode
    if (mode === 'delete') {
      this.updateDeleteOverlay(deleteEl);
    } else {
      this.hideDeleteOverlay();
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

    // Text inputs should NOT get a ring/frame on hover. Instead, tint background.
    // This applies regardless of rendering mode (canvas/dom/css-props) and also in DOM-hover styling mode.
    try {
      const isTextInput = element && element.matches && element.matches(SELECTORS.FOCUSABLE_TEXT);
      if (isTextInput) {
        // Clear any previous non-text focus visuals (rectangles / rings).
        try { this.hideFocusOverlay(); } catch { /* ignore */ }
        this._applyTextHoverElementStyling(element);
        return;
      }
    } catch { /* ignore */ }

    // Non-text elements: ensure we remove any lingering hover tint.
    this._clearTextHoverElementStyling();

    // When DOM hover mode is enabled, style the element directly (fast path).
    // Clipped contexts use inset rings (negative outline-offset) — not a fixed
    // overlay — so we keep hover chrome snappy.
    if (this._useDomHoverFocusColors) {
      // Hide any fixed-position backends so we never double-paint with canvas.
      try { this.hideFocusOverlayCanvas(); } catch { /* ignore */ }
      try { this.hideFocusOverlayCSSCustomProps(); } catch { /* ignore */ }
      try { this.hideFocusOverlayDOM(); } catch { /* ignore */ }
      return this.updateFocusOverlayElementStyling(element, mode);
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

  /**
   * Find ancestors that would clip an outer focus ring around `element`.
   *
   * Used only when FEATURE_FLAGS.ENABLE_FOCUS_CLIP_INSET and/or
   * ENABLE_FOCUS_TIGHT_WRAPPER_PROMOTION are on (see constants.js for tentative
   * purpose). Never opens page overflow — that broke carousels (IMDb).
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
    const clippers = [];
    /** @type {Element|null} */
    let tightWrapper = null;

    if (!element || element.nodeType !== 1) {
      return { clippers, tightWrapper };
    }

    let er;
    try {
      er = element.getBoundingClientRect();
    } catch {
      return { clippers, tightWrapper };
    }
    if (!er || !(er.width > 0) || !(er.height > 0)) {
      return { clippers, tightWrapper };
    }

    // Outer ring needs a little space outside the border box.
    const pad = 8;
    const needLeft = er.left - pad;
    const needTop = er.top - pad;
    const needRight = er.right + pad;
    const needBottom = er.bottom + pad;

    // Walk composed ancestors (parentElement + open shadow host hops).
    // archive.org nests clickables inside media-button → … → NAV[overflow:hidden];
    // a parentElement-only walk stops at the shadow root and misses clippers.
    const composedParent = (node) => {
      if (!node || node.nodeType !== 1) return null;
      if (node.parentElement) return node.parentElement;
      try {
        const root = typeof node.getRootNode === 'function' ? node.getRootNode() : null;
        if (root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
          return root.host || null;
        }
      } catch { /* ignore */ }
      return null;
    };

    try {
      let n = composedParent(element);
      let depth = 0;
      // Nested open shadows (archive.org tiles/nav) often need more than 12 hops.
      while (n && n.nodeType === 1 && depth++ < 24) {
        if (n === document.documentElement || n === document.body) {
          n = composedParent(n);
          continue;
        }

        const cs = window.getComputedStyle(n);
        if (!cs) {
          n = composedParent(n);
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
            n = composedParent(n);
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

        n = composedParent(n);
      }
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

    // Optional clip-aware paint (flags in FEATURE_FLAGS — see constants.js).
    // Never mutate page overflow (broke IMDb carousels). Prefer painting on the
    // real hover target so data-kp-focus lands on the clickable <a>, not a parent.
    let useInset = false;
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
      if (clipInsetOn) {
        useInset =
          !!(clipCtx.clippers && clipCtx.clippers.length) ||
          this._isProbablyClippedByAncestorOverflow(stylingTarget);
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

    // Shadow DOM: document CSS does not pierce; inject into this root on first use.
    this._ensureStylesForElement(stylingTarget);

    // Apply styling using CSS custom properties
    stylingTarget.style.setProperty('--keypilot-focus-ring-color', ringColor);
    stylingTarget.style.setProperty('--keypilot-focus-ring-width', ringWidth);
    stylingTarget.style.setProperty('--keypilot-focus-shadow-color', shadowColor);
    stylingTarget.style.setProperty('--keypilot-focus-ring-bg-color', ringBgColor);
    stylingTarget.style.setProperty('--keypilot-focus-box-shadow', boxShadow);

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

    // Store reference for cleanup
    this._currentStyledElement = stylingTarget;

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Applied element styling:', {
        tagName: stylingTarget.tagName,
        originalTagName: element?.tagName,
        styledDifferentElement: stylingTarget !== element,
        useInset: useInset,
        clipInsetFlag: clipInsetOn,
        tightPromoteFlag: tightPromoteOn,
        tightWrapper: !!(clipCtx && clipCtx.tightWrapper),
        ringColor: ringColor,
        isTextInput: isTextInput
      });
    }
  }

  /**
   * Largest in-tree descendant with a positive box (for collapsed anchors that
   * only wrap position:absolute media — e.g. Breitbart video carousel thumbs).
   * @param {HTMLElement} element
   * @returns {HTMLElement|null}
   */
  _findLargestVisibleDescendant(element) {
    if (!element || element.nodeType !== 1) return null;
    let best = null;
    let bestArea = 0;
    let visited = 0;
    const maxNodes = 48;
    const queue = [element];
    while (queue.length && visited < maxNodes) {
      const cur = queue.shift();
      if (!cur || cur.nodeType !== 1) continue;
      visited++;
      if (cur !== element) {
        let r = null;
        try { r = cur.getBoundingClientRect(); } catch { r = null; }
        if (r && r.width >= 8 && r.height >= 8) {
          const area = r.width * r.height;
          if (area > bestArea) {
            bestArea = area;
            best = /** @type {HTMLElement} */ (cur);
          }
        }
      }
      try {
        const kids = cur.children;
        if (kids) {
          for (let i = 0; i < kids.length; i++) {
            if (kids[i]?.nodeType === 1) queue.push(kids[i]);
          }
        }
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
   * 2) Inline elements that contain block children can be split into multiple
   *    inline fragments, causing outline/box-shadow to render as disjoint pieces.
   *
   * Strategy:
   * - If the element has no usable box, style the largest visible descendant
   *   (or a sized parent that wraps abspos content).
   * - If `element.getClientRects()` indicates fragmentation (2+ rects) and
   *   element is inline-ish, find the largest single-rect descendant.
   * - Otherwise, return `element`.
   *
   * @param {HTMLElement} element
   * @returns {HTMLElement}
   */
  _resolveElementForFocusStyling(element) {
    if (!element || element.nodeType !== 1) return element;

    // Collapsed clickable (0×0) with visible abspos children — paint on media.
    let br = null;
    try { br = element.getBoundingClientRect(); } catch { br = null; }
    if (!br || br.width < 2 || br.height < 2) {
      const descendant = this._findLargestVisibleDescendant(element);
      if (descendant) return descendant;

      // No sized descendant: try parent that actually boxes the abspos content
      // (e.g. .video-image { position: relative } wrapping the collapsed <a>).
      try {
        let p = element.parentElement;
        let hops = 0;
        while (p && p.nodeType === 1 && hops++ < 4) {
          if (p === document.body || p === document.documentElement) break;
          let pr = null;
          try { pr = p.getBoundingClientRect(); } catch { pr = null; }
          if (pr && pr.width >= 8 && pr.height >= 8) {
            return /** @type {HTMLElement} */ (p);
          }
          p = p.parentElement;
        }
      } catch { /* ignore */ }
      return element;
    }

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
        const kids = curEl.children;
        if (kids && kids.length) {
          for (let i = 0; i < kids.length; i++) {
            const k = kids[i];
            if (k && k.nodeType === 1) queue.push({ el: /** @type {HTMLElement} */ (k), depth: d + 1 });
            if (queue.length > maxNodes) break;
          }
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
          '.keypilot-focus-element, .keypilot-focus-element--inset, [data-kp-focus]'
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
          '.keypilot-focus-element, .keypilot-focus-element--inset, [data-kp-focus]'
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

  updateFocusOverlayDOM(element, mode = MODES.NONE, rectOverride = null) {
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

    // Determine if this is a text input element
    const isTextInput = element.matches && element.matches(SELECTORS.FOCUSABLE_TEXT);
    const suppressFill = this.shouldSuppressFocusFill(element);

    // We'll use this rect both for sizing/positioning and for deciding whether to render a fill.
    const rect = (rectOverride && typeof rectOverride === 'object')
      ? rectOverride
      : this.getBestRect(element);
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
    // When DOM hover mode is enabled, clear element styling only (no canvas ring).
    if (this._useDomHoverFocusColors) {
      this.clearElementFocusStyling({ deep: false });
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

  updateDeleteOverlay(element) {
    if (!element) {
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] updateDeleteOverlay: no element provided');
      }
      this.hideDeleteOverlay();
      return;
    }

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] updateDeleteOverlay called for:', {
        tagName: element.tagName,
        className: element.className,
        id: element.id
      });
    }

    if (!this.deleteOverlay) {
      this.deleteOverlay = this.createElement('div', {
        className: CSS_CLASSES.DELETE_OVERLAY,
        style: `
          position: fixed;
          pointer-events: none;
          z-index: ${Z_INDEX.OVERLAYS};
          border: 3px solid ${COLORS.DELETE_RED};
          box-shadow: 0 0 0 2px ${COLORS.DELETE_SHADOW}, 0 0 12px 2px ${COLORS.DELETE_SHADOW_BRIGHT};
          background: transparent;
          will-change: transform;
        `
      });
      document.body.appendChild(this.deleteOverlay);
      
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Delete overlay created and added to DOM:', {
          element: this.deleteOverlay,
          className: this.deleteOverlay.className,
          parent: this.deleteOverlay.parentElement?.tagName
        });
      }
      
      // Start observing the overlay for visibility optimization
      if (this.overlayObserver) {
        this.overlayObserver.observe(this.deleteOverlay);
      }
    }

    const rect = this.getBestRect(element);
    
    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Delete overlay positioning:', {
        rect: rect,
        overlayExists: !!this.deleteOverlay,
        overlayVisibility: this.overlayVisibility.delete
      });
    }
    
    if (rect.width > 0 && rect.height > 0) {
      // Use left/top positioning instead of transform for consistency with focus overlay
      this.deleteOverlay.style.left = `${rect.left}px`;
      this.deleteOverlay.style.top = `${rect.top}px`;
      this.deleteOverlay.style.width = `${rect.width}px`;
      this.deleteOverlay.style.height = `${rect.height}px`;
      this.deleteOverlay.style.display = 'block';
      this.deleteOverlay.style.visibility = 'visible';
      
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Delete overlay positioned at:', {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        });
      }
    } else {
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Delete overlay hidden - invalid rect:', rect);
      }
      this.hideDeleteOverlay();
    }
  }

  hideDeleteOverlay() {
    if (this.deleteOverlay) {
      this.deleteOverlay.style.display = 'none';
    }
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



  updateFocusedTextOverlay(element) {
    console.log('[KeyPilot] updateFocusedTextOverlay called with element:', element?.tagName, element?.type);

    if (!element) {
      console.log('[KeyPilot] No element provided, hiding overlay');
      this.hideFocusedTextOverlay();
      return;
    }

    console.log('[KeyPilot] Creating focused text overlay');
    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] updateFocusedTextOverlay called for:', {
        tagName: element.tagName,
        className: element.className,
        id: element.id
      });
    }

    if (!this.focusedTextOverlay) {
      this.focusedTextOverlay = this.createElement('div', {
        className: CSS_CLASSES.FOCUSED_TEXT_OVERLAY || 'kpv2-focused-text-overlay',
        style: `
          position: fixed;
          pointer-events: none;
          z-index: ${Z_INDEX.OVERLAYS_BELOW};
          background: transparent;
          will-change: transform;
        `
      });
      document.body.appendChild(this.focusedTextOverlay);
      
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Focused text overlay created and added to DOM:', {
          element: this.focusedTextOverlay,
          className: this.focusedTextOverlay.className,
          parent: this.focusedTextOverlay.parentElement?.tagName
        });
      }
      
      // Start observing the overlay for visibility optimization
      if (this.overlayObserver) {
        this.overlayObserver.observe(this.focusedTextOverlay);
      }
    }

    // Darkened orange color for focused text fields
    const borderColor = COLORS.ORANGE_SHADOW_DARK; // Slightly more opaque
    const shadowColor = COLORS.ORANGE_SHADOW_LIGHT; // Darker shadow
    
    const { strokeThickness } = this._getTextModeSettings();
    this.focusedTextOverlay.style.border = `${strokeThickness}px solid ${borderColor}`;
    this.focusedTextOverlay.style.boxShadow = `0 0 0 2px ${shadowColor}, 0 0 10px 2px ${COLORS.ORANGE_BORDER}`;

    // Always get fresh rect to handle dynamic position/size changes
    const rect = this.getBestRect(element);
    
    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Focused text overlay positioning:', {
        rect: rect,
        overlayExists: !!this.focusedTextOverlay,
        overlayVisibility: this.overlayVisibility.focusedText,
        timestamp: Date.now()
      });
    }
    
    if (rect.width > 0 && rect.height > 0) {
      // Position the overlay with fresh coordinates
      this.focusedTextOverlay.style.left = `${rect.left}px`;
      this.focusedTextOverlay.style.top = `${rect.top}px`;
      this.focusedTextOverlay.style.width = `${rect.width}px`;
      this.focusedTextOverlay.style.height = `${rect.height}px`;
      this.focusedTextOverlay.style.display = 'block';
      this.focusedTextOverlay.style.visibility = 'visible';
      
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Focused text overlay positioned at:', {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          timestamp: Date.now()
        });
      }
    } else {
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Focused text overlay hidden - invalid rect:', rect);
      }
      this.hideFocusedTextOverlay();
    }
  }

  hideFocusedTextOverlay() {
    if (this.focusedTextOverlay) {
      this.focusedTextOverlay.style.display = 'none';
    }
  }

  updateActiveTextInputFrame(element) {
    if (!element) {
      this.hideActiveTextInputFrame();
      return;
    }

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] updateActiveTextInputFrame called for:', {
        tagName: element.tagName,
        className: element.className,
        id: element.id
      });
    }

    if (!this.activeTextInputFrame) {
      this.activeTextInputFrame = this.createElement('div', {
        className: CSS_CLASSES.ACTIVE_TEXT_INPUT_FRAME,
        style: `
          position: fixed;
          pointer-events: none;
          z-index: ${Z_INDEX.OVERLAYS_ABOVE};
          background: transparent;
          will-change: transform, opacity;
        `
      });
      document.body.appendChild(this.activeTextInputFrame);
      
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Active text input frame created and added to DOM:', {
          element: this.activeTextInputFrame,
          className: this.activeTextInputFrame.className,
          parent: this.activeTextInputFrame.parentElement?.tagName
        });
      }
      
      // Start observing the overlay for visibility optimization
      if (this.overlayObserver) {
        this.overlayObserver.observe(this.activeTextInputFrame);
      }
    }

    // Always get fresh rect to handle dynamic position/size changes
    const rect = this.getBestRect(element);
    
    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Active text input frame positioning:', {
        rect: rect,
        overlayExists: !!this.activeTextInputFrame,
        overlayVisibility: this.overlayVisibility.activeTextInput,
        timestamp: Date.now()
      });
    }
    
    if (rect.width > 0 && rect.height > 0) {
      // Position the pulsing frame with fresh coordinates
      this.activeTextInputFrame.style.left = `${rect.left}px`;
      this.activeTextInputFrame.style.top = `${rect.top}px`;
      this.activeTextInputFrame.style.width = `${rect.width}px`;
      this.activeTextInputFrame.style.height = `${rect.height}px`;
      this.activeTextInputFrame.style.display = 'block';
      this.activeTextInputFrame.style.visibility = 'visible';
      
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Active text input frame positioned at:', {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          timestamp: Date.now()
        });
      }
    } else {
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Active text input frame hidden - invalid rect:', rect);
      }
      this.hideActiveTextInputFrame();
    }
  }

  hideActiveTextInputFrame() {
    if (this.activeTextInputFrame) {
      this.activeTextInputFrame.style.display = 'none';
    }
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
          border: 1px solid ${COLORS.ORANGE_BORDER};
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
          border: 1px solid ${COLORS.FOCUS_GREEN};
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

  updateElementClasses(focusEl, deleteEl, prevFocusEl, prevDeleteEl) {
    // Remove previous classes
    if (prevFocusEl && prevFocusEl !== focusEl) {
      prevFocusEl.classList.remove(CSS_CLASSES.FOCUS);
    }
    if (prevDeleteEl && prevDeleteEl !== deleteEl) {
      prevDeleteEl.classList.remove(CSS_CLASSES.DELETE);
    }

    // Add new classes (ensure shadow styles first so brightness filter applies in open roots)
    if (focusEl) {
      this._ensureStylesForElement(focusEl);
      focusEl.classList.add(CSS_CLASSES.FOCUS);
    }
    if (deleteEl) {
      this._ensureStylesForElement(deleteEl);
      deleteEl.classList.add(CSS_CLASSES.DELETE);
    }
  }

  getBestRect(element) {
    if (!element) return { left: 0, top: 0, width: 0, height: 0 };
    
    let rect = element.getBoundingClientRect();
    
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
        const childRect = child.getBoundingClientRect();
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
   * Read a non-zero computed border-radius from an element.
   * @param {Element|null|undefined} el
   * @returns {string|null}
   */
  _readNonZeroBorderRadius(el) {
    try {
      if (!el || el.nodeType !== 1) return null;
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
   * Resolve a CSS border-radius that matches the visual shape of the activation target.
   * Prefer the element itself; if it is not rounded (common for <a> wrapping a card/image),
   * use a large rounded descendant that fills most of the host box.
   *
   * @param {Element|null|undefined} element
   * @returns {string|null} CSS border-radius value, or null to keep stylesheet default
   */
  _resolveElementBorderRadius(element) {
    if (!element || element.nodeType !== 1) return null;

    const own = this._readNonZeroBorderRadius(element);
    if (own) return own;

    try {
      let parentArea = 0;
      try {
        const pr = element.getBoundingClientRect();
        parentArea = Math.max(0, (pr.width || 0) * (pr.height || 0));
      } catch {
        parentArea = 0;
      }

      const candidates = [];
      try {
        if (element.children && element.children.length) {
          for (const child of element.children) candidates.push(child);
        }
      } catch { /* ignore */ }

      // Media often carries the visible corner radius on image links / cards.
      try {
        const media = element.querySelectorAll?.('img, svg, video, picture');
        if (media && media.length) {
          for (const m of media) candidates.push(m);
        }
      } catch { /* ignore */ }

      let best = null;
      let bestArea = 0;
      for (const c of candidates) {
        const radius = this._readNonZeroBorderRadius(c);
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
    } catch { /* ignore */ }

    return null;
  }

  /**
   * Resolve the viewport rect of the current focus outline for activation feedback.
   * Works across DOM-hover element styling, DOM overlay, CSS-custom-props, and canvas modes.
   * @returns {{ left: number, top: number, width: number, height: number }|null}
   */
  _getFocusPulseRect() {
    // Prefer live geometry from active visuals.
    try {
      if (this.focusOverlay && this.focusOverlay.style.display !== 'none') {
        const r = this.focusOverlay.getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) {
          return { left: r.left, top: r.top, width: r.width, height: r.height };
        }
      }
    } catch { /* ignore */ }

    try {
      if (this.cssCustomPropsOverlay && this.cssCustomPropsOverlay.style.display !== 'none') {
        const r = this.cssCustomPropsOverlay.getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) {
          return { left: r.left, top: r.top, width: r.width, height: r.height };
        }
      }
    } catch { /* ignore */ }

    try {
      const el = this._currentStyledElement || this._lastFocusElement;
      if (el && el.nodeType === 1 && el.isConnected) {
        const r = this.getBestRect(el);
        if (r && r.width > 0 && r.height > 0) {
          return { left: r.left, top: r.top, width: r.width, height: r.height };
        }
      }
    } catch { /* ignore */ }

    // Last known rect from hover tracking (may be slightly stale after scroll).
    if (this._lastFocusRect && this._lastFocusRect.width > 0 && this._lastFocusRect.height > 0) {
      return { ...this._lastFocusRect };
    }
    return null;
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
   * Uses a temporary floating rectangle so it works in every render mode
   * (including DOM-hover element styling, where there is no focusOverlay div).
   *
   * Effect style comes from settings (clickMode.clickEffect):
   *   - flash (default): hard strobe on the outline
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

    const rect = this._getFocusPulseRect();
    if (!rect) return;

    // Optional: briefly brighten the persistent DOM overlay if present.
    try {
      if (this.focusOverlay && this.focusOverlay.style.display !== 'none') {
        const originalBorder = this.focusOverlay.style.border;
        const originalBoxShadow = this.focusOverlay.style.boxShadow;
        this.focusOverlay.style.border = `3px solid ${COLORS.FLASH_GREEN}`;
        this.focusOverlay.style.boxShadow =
          `0 0 0 2px ${COLORS.FLASH_GREEN_SHADOW}, 0 0 20px 4px ${COLORS.FLASH_GREEN_GLOW}`;
        this.focusOverlay.style.transition = 'border 0.15s ease-out, box-shadow 0.15s ease-out';
        setTimeout(() => {
          if (!this.focusOverlay) return;
          this.focusOverlay.style.border = originalBorder;
          this.focusOverlay.style.boxShadow = originalBoxShadow;
          setTimeout(() => {
            if (this.focusOverlay) this.focusOverlay.style.transition = '';
          }, 150);
        }, 150);
      }
    } catch { /* ignore */ }

    // Click-effect ghost (link-style categories only).
    try {
      // Prefer a live rect from the activation target when available so tracking
      // compares against the same box we paint.
      let liveRect = rect;
      if (el && el.nodeType === 1) {
        try {
          const r = el.getBoundingClientRect();
          if (r && r.width > 0 && r.height > 0) {
            liveRect = {
              left: r.left,
              top: r.top,
              width: r.width,
              height: r.height
            };
          }
        } catch { /* keep last-focus rect */ }
      }

      // Don't start an effect if the target is already gone / not painted.
      if (el && el.nodeType === 1) {
        if (!el.isConnected) return;
        try {
          const cs = window.getComputedStyle(el);
          if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return;
        } catch { /* ignore */ }
      }

      const borderRadius = this._resolveElementBorderRadius(el);
      /** @type {HTMLElement|SVGSVGElement} */
      let pulse;
      if (clickEffect === 'dash') {
        pulse = this._createDashChasePulse(liveRect, borderRadius);
      } else {
        pulse = document.createElement('div');
        pulse.className = presentation.className;
        pulse.setAttribute('aria-hidden', 'true');
        pulse.setAttribute('data-kp-ephemeral-effect', clickEffect);
        // Position via left/top/width/height; CSS animation scales from transform-origin center.
        pulse.style.left = `${liveRect.left}px`;
        pulse.style.top = `${liveRect.top}px`;
        pulse.style.width = `${liveRect.width}px`;
        pulse.style.height = `${liveRect.height}px`;
        // Match corners to the clicked element (pill links, rounded cards, circular avatars).
        if (borderRadius) {
          pulse.style.borderRadius = borderRadius;
        }
      }
      document.body.appendChild(pulse);
      this._trackEphemeralEffect(pulse, el, liveRect, presentation.cleanupMs);
    } catch (e) {
      if (window.KEYPILOT_DEBUG) {
        console.warn('[KeyPilot] focus pulse failed:', e);
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
    if (this.deleteOverlay) {
      this.deleteOverlay.remove();
      this.deleteOverlay = null;
    }
    // Clean up highlight manager
    if (this.highlightManager) {
      this.highlightManager.cleanup();
    }
    if (this.focusedTextOverlay) {
      this.focusedTextOverlay.remove();
      this.focusedTextOverlay = null;
    }
    if (this.viewportModalFrame) {
      this.viewportModalFrame.remove();
      this.viewportModalFrame = null;
    }
    if (this.activeTextInputFrame) {
      this.activeTextInputFrame.remove();
      this.activeTextInputFrame = null;
    }
    if (this.escExitLabelText) {
      this.escExitLabelText.remove();
      this.escExitLabelText = null;
    }
    if (this.escExitLabelHover) {
      this.escExitLabelHover.remove();
      this.escExitLabelHover = null;
    }

    // Clean up debug panel
    this.cleanupDebugPanel();
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
   * Show popover with iframe containing the linked page.
   * Uses the shared {@link createPopoverTitlebar} chrome: single titlebar with
   * title, optional close-key hint, and uniform × close when enabled.
   *
   * @param {string} url - The URL to load in the popover
   * @param {object} [opts]
   * @param {string} [opts.title] - Optional title for the titlebar (defaults to url)
   * @param {string} [opts.hintKeyLabel] - Optional key label in the titlebar hint (defaults to 'P')
   * @param {boolean} [opts.showClose=true] - Whether to show the titlebar close button
   * @param {string|Node|null} [opts.titlebarHint] - Override titlebar hint (string or Node)
   * @param {string[]} [opts.closeKeys] - Keys forwarded from iframe that should request close (defaults to ['Escape','p','P'])
   * @param {string} [opts.width] - Optional fixed width (e.g., '920px', overrides default 80vw)
   * @param {string} [opts.height] - Optional fixed height (e.g., '600px', overrides default 80vh)
   */
  showPopover(url, opts = {}) {
    // Remove existing popover if any
    this.hidePopover();

    const titleText = (opts && typeof opts.title === 'string' && opts.title.trim()) ? opts.title.trim() : String(url || '');
    const hintKeyLabel = (opts && typeof opts.hintKeyLabel === 'string' && opts.hintKeyLabel.trim()) ? opts.hintKeyLabel.trim() : 'P';
    const closeKeys = Array.isArray(opts?.closeKeys) && opts.closeKeys.length
      ? opts.closeKeys.map(String)
      : ['Escape', 'p', 'P'];

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
        width: ${opts.width || '80vw'};
        height: ${opts.height || '80vh'};
        max-width: 100vw;          /* prevents overflow on very small screens */
        max-height: 100vh;
        margin: auto;              /* this is what centers it perfectly */
        background: linear-gradient(rgb(18, 18, 18) 0%, rgb(11, 11, 11) 100%);
        border-radius: 8px;
        border: 1px solid rgb(43, 43, 43);
        box-shadow: rgba(0, 0, 0, 0.65) 0px 8px 24px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: ${KP_UI_FONT};
        font-size: 14px;
        line-height: 1.3;
        letter-spacing: normal;
      `
    });




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
    const titlebarApi = createPopoverTitlebar({
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
      window.open(url, '_blank');
      requestClosePopover();
    };
    errorContainer.appendChild(openInTabButton);

    // Create iframe
    const iframe = this.createElement('iframe', {
      src: url,
      tabindex: '0',
      style: `
        flex: 1;
        border: none;
        width: 100%;
        height: 100%;
      `
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
    iframe.onerror = () => {
      console.log('[KeyPilot] Iframe load error detected');
      iframe.style.display = 'none';
      errorContainer.style.display = 'flex';
    };

    // Optional: Very long timeout as last resort (30 seconds) for cases where
    // iframe never fires onload/onerror (shouldn't happen with declarativeNetRequest)
    const loadTimeout = setTimeout(() => {
      // Only show error if iframe hasn't loaded at all (no onload fired)
      // This is a fallback for edge cases
      console.log('[KeyPilot] Iframe load timeout - showing error as fallback');
      iframe.style.display = 'none';
      errorContainer.style.display = 'flex';
    }, 30000);

    iframe.onload = () => {
      clearTimeout(loadTimeout);
      // Iframe loaded successfully - keep it visible
      // Note: We can't check contentDocument for cross-origin iframes,
      // but if onload fired, the iframe should be working
      console.log('[KeyPilot] Iframe loaded successfully');
      sendBridgeInit();
    };

    this.popoverContainer.appendChild(header);
    this.popoverContainer.appendChild(iframe);
    this.popoverContainer.appendChild(errorContainer);
    // Mount via PopupManager so the backdrop + stacking are consistent across popups.
    // This also keeps the popup in the normal DOM stacking context (no Popover API top-layer),
    // so KeyPilot overlays (green click rectangle) can sit above it by z-index.
    this.popupManager?.showModal?.({
      id: this._popoverPopupId,
      panel: this.popoverContainer,
      onRequestClose: requestClosePopover
    });
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
          chromeEls: [header, closeButton].filter(Boolean),
          focusChromeEl: closeButton || header
        });
        return;
      }

      if (data.type === 'KP_POPOVER_REQUEST_CLOSE') {
        // Close on configured keys forwarded by the iframe bridge.
        if (closeKeys.includes(String(data.key))) requestClosePopover();
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

  hidePopover() {
    // Drop mobile UA session rule so host-page iframes are not affected after close.
    if (this._previewMobileUaActive) {
      this._previewMobileUaActive = false;
      try {
        void this._setPreviewMobileUa(false);
      } catch { /* ignore */ }
    }

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
   * Check if popover is currently open
   * @returns {boolean}
   */
  isPopoverOpen() {
    return this.popoverContainer !== null;
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

    const mouseX = opts.mouseX ?? window.innerWidth / 2;
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
    const closeKeys = Array.isArray(opts?.closeKeys) && opts.closeKeys.length
      ? opts.closeKeys.map(String)
      : ['Escape', 'e', 'E'];

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
        background: linear-gradient(rgb(18, 18, 18) 0%, rgb(11, 11, 11) 100%);
        border-radius: 8px;
        border: 1px solid rgb(43, 43, 43);
        box-shadow: rgba(0, 0, 0, 0.65) 0px 8px 24px;
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

    // Shared outline Open / Open in New Tab controls (also used by Launcher preview).
    const { actions: previewOpenActions } = createPreviewOpenActionButtons({
      getUrl: () => url,
      afterOpen: () => requestClosePopover(),
      afterOpenNewTab: () => requestClosePopover()
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
          iframeRef.src = url;
          this.popoverIframeWindow = iframeRef.contentWindow || null;
        } catch {
          try {
            iframeRef.src = url;
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

    // Single standard titlebar (drag handle): title + hint + mode + actions + uniform × close.
    const titlebarApi = createPopoverTitlebar({
      title: titleText,
      variant: 'preview',
      draggable: true,
      titleAttr: 'Drag to move',
      showClose: true,
      onClose: requestClosePopover,
      closeTitle: 'Close (Esc)',
      hint: 'Press Esc / E to hide',
      actions: [viewportModeControl.root, previewOpenActions],
      className: 'kpv2-preview-popover-titlebar'
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
    const iframe = this.createElement('iframe', {
      tabindex: '0',
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
    this.popoverContainer.appendChild(header);
    this.popoverContainer.appendChild(iframeViewport);
    this.popoverContainer.appendChild(errorContainer);

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
        // First apply: set UA without reload; then assign src once.
        await applyViewportMode(viewportMode, { reload: false });
      } catch (e) {
        console.warn('[KeyPilot] Failed to prepare preview viewport mode:', e?.message || e);
      }
      try {
        armLoadTimeout();
        iframe.src = url;
        this.popoverIframeWindow = iframe.contentWindow || null;
      } catch (e) {
        console.error('[KeyPilot] Failed to load preview URL:', e?.message || e);
        clearLoadTimeout();
        iframeViewport.style.display = 'none';
        errorContainer.style.display = 'flex';
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
            closeButton,
            viewportModeControl.root,
            previewOpenActions
          ].filter(Boolean),
          focusChromeEl: closeButton || header
        });
        return;
      }

      if (data.type === 'KP_POPOVER_REQUEST_CLOSE') {
        if (closeKeys.includes(String(data.key))) requestClosePopover();
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
}