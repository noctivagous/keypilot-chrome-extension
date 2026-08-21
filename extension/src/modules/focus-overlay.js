/**
 * Focus overlay drawing: DOM / canvas / CSS-custom-props backends, A/B/C
 * paint strategy, and text-field hints. Owned by OverlayManager.
 *
 * Methods run with a host proxy so OverlayManager keeps the paint fields
 * (`focusOverlay`, `_inTargetRing`, …) that scroll and hover code read.
 */
import { CSS_CLASSES, Z_INDEX, SELECTORS, MODES, COLORS, FEATURE_FLAGS, CLICKABLE_CATEGORY, TEXT_FOCUS_HINT_MIN_HEIGHT_PX } from '../config/constants.js';
import { DEFAULT_SETTINGS } from './settings-manager.js';
import {
  closestComposed,
  isClickableKeyPilotChromeElement
} from '../ui/kp-chrome-shadow.js';
import { resolveActivationIdentity } from '../utils/resolve-hovered-link.js';

export const FOCUS_OVERLAY_METHOD_NAMES = Object.freeze(
[
  'setDomHoverFocusColorsEnabled',
  'usesElementFocusStyling',
  'setScrollPaintPreferA',
  '_getNonTextFocusPalette',
  'getFocusCategory',
  'shouldSuppressFocusFill',
  'isVideoLikeElement',
  'initCanvasRenderer',
  'cleanupCanvasRenderer',
  'updateFocusOverlayCanvas',
  'hideFocusOverlayCanvas',
  'initCSSCustomPropsRenderer',
  'cleanupCSSCustomPropsRenderer',
  'updateFocusOverlayCSSCustomProps',
  'hideFocusOverlayCSSCustomProps',
  'setModeSettings',
  '_getClickModeSettings',
  '_settingsPaintOverride',
  '_effectivePaintOverride',
  '_getTextModeSettings',
  'setHoverClickLabelText',
  'formatHoverLabelText',
  'formatActiveTextFieldLabel',
  'ensureTextModeLabels',
  'updateTextModeLabels',
  'hideTextModeLabels',
  'setTextFocusEscKeyLabel',
  'setTextHoverActivateKeyLabel',
  '_escapeHintText',
  '_renderTextFocusEscHint',
  '_renderTextHoverActivateHint',
  'ensureTextFocusEscHint',
  'ensureTextHoverActivateHint',
  '_overlayZIndexAboveTarget',
  '_positionTextFieldSidecar',
  'updateTextFocusEscHint',
  'hideTextFocusEscHint',
  'updateTextHoverActivateHint',
  'hideTextHoverActivateHint',
  'refreshTextHoverActivateHint',
  '_clearTextFocusElementStyling',
  '_getNearbyInputWrappers',
  '_resolveTextFocusPaintHost',
  '_isTightTextFieldWrapper',
  '_isHoverOnActiveTextField',
  '_ensureStylesForElement',
  '_applyTextFocusElementStyling',
  '_shouldHideTextFocusHint',
  '_syncTextFocusHintHidden',
  '_clearTextHoverElementStyling',
  '_applyTextHoverElementStyling',
  'updateFocusOverlay',
  '_installFocusClipCacheInvalidation',
  '_intersectViewportRects',
  '_viewportRectsOverlap',
  '_clipViewportRectToVisible',
  '_findFocusClipContext',
  '_isProbablyClippedByAncestorOverflow',
  '_outerFocusRingWouldBeClipped',
  '_styleClipsOverflow',
  '_styleClipsSelfFor',
  '_styleClipsPaintContain',
  '_styleClipsClipPath',
  '_styleClipsSelf',
  '_composedParent',
  '_shadowInternalClipWrappers',
  '_hostClipsViaInternalShadowWrapper',
  '_isInShadowTree',
  '_getOpenShadowRoot',
  '_shadowHasDefaultSlot',
  '_canMountVisibleChildOnHost',
  '_enqueueShadowPiercingChildren',
  '_findInShadowInTargetMount',
  '_preferredFocusOutlineOffsetPx',
  '_resolveAbsoluteClipFramePaintHost',
  '_minFocusOutlineRoomPx',
  '_computeGradedFocusOutlineOffset',
  '_wouldUseInsetFocusOutline',
  '_strategyAIsViable',
  '_shouldUseFixedFocusOverlay',
  '_isMediaTextSplitCard',
  '_mediaTextShellHasCompetingDest',
  '_focusFillsMediaTextCardShell',
  '_resolveMediaTextCardShell',
  '_isBlockishPaintHost',
  '_liftMediaTextCardPaintHost',
  '_isMediaLikeCoverElement',
  '_hasEdgeFlushMediaCover',
  '_hasDescendantMediaStrip',
  '_hasFullBleedCoveringContent',
  '_hasObscuringFullBleedChild',
  '_isReplacedOrVoidElement',
  '_ensureShadowRootRingHost',
  '_inTargetHostSizeOk',
  '_isViableInTargetHost',
  '_isInsideCssMultiColumn',
  '_findSameSizeInTargetDescendant',
  '_visualFocusRectForInTarget',
  '_resolveInTargetHost',
  '_findInShadowInTargetMountNear',
  '_maxLocalZIndex',
  '_ensureInTargetRingEl',
  '_restoreInTargetHostPosition',
  'hideInTargetFocusRing',
  '_positiveClientRectCount',
  '_visualContentUnionRect',
  '_isFragmentedInlineFocusTarget',
  'updateFocusOverlayInTarget',
  'updateFocusOverlayElementStyling',
  '_findLargestVisibleDescendant',
  '_findDominantReplacedPaintChild',
  '_resolveElementForFocusStyling',
  '_stripFocusStylingFromElement',
  'clearElementFocusStyling',
  '_deepStripFocusMarkers',
  'updateFocusOverlayDOM',
  'hideFocusOverlay',
  'hideFocusOverlayDOM',
  'setRenderingMode',
  'initRenderingMode',
  'cleanupRenderingMode',
  'fadeOutFocusOverlay'
]
);

export class FocusOverlayPainter {
  /** @param {import('./overlay-manager.js').OverlayManager} host */
  constructor(host) {
    this.host = host;
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop === 'host') return host;
        if (prop in FocusOverlayPainter.prototype || Object.prototype.hasOwnProperty.call(target, prop)) {
          const val = Reflect.get(target, prop, receiver);
          return typeof val === 'function' ? val.bind(receiver) : val;
        }
        const val = host[prop];
        return typeof val === 'function' ? val.bind(host) : val;
      },
      set(_target, prop, value) {
        if (prop === 'host') return true;
        host[prop] = value;
        return true;
      }
    });
  }

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
   * Ask hover paint to use A for the rest of this scroll gesture (C rings
   * stay pinned to the last viewport rect).
   * @param {boolean} on
   */
  setScrollPaintPreferA(on) {
    const next = !!on;
    if (this._preferADuringScroll === next) return;
    this._preferADuringScroll = next;
    const el = this._lastFocusElement;
    if (el && el.isConnected) {
      try { this.updateFocusOverlay(el); } catch { /* ignore */ }
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
    const prevPaint =
      this._modeSettings?.clickMode && typeof this._modeSettings.clickMode === 'object'
        ? this._modeSettings.clickMode.paintStrategy
        : undefined;
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

    // Keep Shadow Root Debug selection aligned when the Advanced paint mode changes.
    try {
      const nextPaint = this._getClickModeSettings().paintStrategy;
      if (prevPaint !== nextPaint && this._shadowDebugHudEnabled) {
        this._shadowDebugPaintOverride = this._settingsPaintOverride();
        this._refreshShadowDebugHudButtons();
      }
    } catch { /* ignore */ }

    // Live re-paint so padding / strategy changes apply without a mouse move.
    try {
      const focusEl = window.keyPilot?.state?.getState?.()?.focusEl ||
        window.keyPilot?.intersectionManager?.getDomHoveredElement?.() ||
        null;
      if (focusEl) this.updateFocusOverlay(focusEl);
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
    const paintStrategy = cm.paintStrategy === 'auto' || cm.paintStrategy === 'BC'
      ? cm.paintStrategy
      : (def.paintStrategy === 'auto' ? 'auto' : 'BC');
    const paintBackendDebugDashes = cm.paintBackendDebugDashes === true;
    const padRaw = Number(cm.focusPadding);
    const focusPadding = Number.isFinite(padRaw)
      ? Math.min(Math.max(padRaw, 0), 16)
      : Math.min(Math.max(Number(def.focusPadding) || 2, 0), 16);
    return {
      rectangleThickness: thickness,
      overlayFillEnabled,
      overlayShadowEnabled,
      focusColor,
      clickEffect,
      paintStrategy,
      paintBackendDebugDashes,
      focusPadding
    };
  }

  /**
   * Settings → Advanced paint mode as a HUD-style override token.
   * @returns {'BC'|null} null = full Auto (A→B→C)
   */
  _settingsPaintOverride() {
    try {
      return this._getClickModeSettings().paintStrategy === 'BC' ? 'BC' : null;
    } catch {
      return (DEFAULT_SETTINGS.clickMode?.paintStrategy === 'BC') ? 'BC' : null;
    }
  }

  /**
   * Active paint override: HUD temporary choice while open, else Settings Advanced.
   * @returns {'A'|'B'|'C'|'BC'|null}
   */
  _effectivePaintOverride() {
    if (this._shadowDebugHudEnabled) {
      return this._shadowDebugPaintOverride;
    }
    return this._settingsPaintOverride();
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

  /**
   * Layout-aware cancel key shown in the vertical text-mode sidecar.
   * @param {string} label
   */
  setTextFocusEscKeyLabel(label) {
    const next = String(label || '').trim() || 'Esc';
    if (next === this._textFocusEscKeyLabel) return;
    this._textFocusEscKeyLabel = next;
    if (this.textFocusEscHint) this._renderTextFocusEscHint();
  }

  /**
   * Layout-aware activate key shown in the vertical text-hover sidecar.
   * @param {string} label
   */
  setTextHoverActivateKeyLabel(label) {
    const next = String(label || '').trim() || 'F';
    if (next === this._textHoverActivateKeyLabel) return;
    this._textHoverActivateKeyLabel = next;
    if (this.textHoverActivateHint) this._renderTextHoverActivateHint();
  }

  _escapeHintText(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _renderTextFocusEscHint() {
    if (!this.textFocusEscHint) return;
    const key = this._escapeHintText(this._textFocusEscKeyLabel || 'Esc');
    this.textFocusEscHint.innerHTML =
      `<kbd>${key}</kbd><span>to</span><span>exit</span>`;
  }

  _renderTextHoverActivateHint() {
    if (!this.textHoverActivateHint) return;
    const key = this._escapeHintText(this._textHoverActivateKeyLabel || 'F');
    this.textHoverActivateHint.innerHTML =
      `<kbd>${key}</kbd><span>to</span><span>select</span>`;
  }

  ensureTextFocusEscHint() {
    if (this.textFocusEscHint) return this.textFocusEscHint;
    this.textFocusEscHint = this.createElement('div', {
      className: CSS_CLASSES.TEXT_FOCUS_ESC_HINT,
      style: `
        position: fixed;
        pointer-events: none;
        z-index: ${Z_INDEX.OVERLAYS_ABOVE};
      `
    });
    this._renderTextFocusEscHint();
    document.body.appendChild(this.textFocusEscHint);
    return this.textFocusEscHint;
  }

  ensureTextHoverActivateHint() {
    if (this.textHoverActivateHint) return this.textHoverActivateHint;
    this.textHoverActivateHint = this.createElement('div', {
      className: CSS_CLASSES.TEXT_HOVER_ACTIVATE_HINT,
      style: `
        position: fixed;
        pointer-events: none;
        z-index: ${Z_INDEX.OVERLAYS_ABOVE};
      `
    });
    this._renderTextHoverActivateHint();
    document.body.appendChild(this.textHoverActivateHint);
    return this.textHoverActivateHint;
  }

  /**
   * Body-level sidecars use OVERLAYS_ABOVE, which sits *below* KP chrome
   * (onboarding, practice popover, settings). Fields inside those open
   * shadows still need the hint painted on `document.body` (host overflow
   * would clip an in-shadow mount), so lift z-index above the target’s
   * light-DOM stacking context — still below the cursor.
   * @param {Element|null|undefined} el
   * @returns {number}
   */
  _overlayZIndexAboveTarget(el) {
    const floor = Z_INDEX.OVERLAYS_ABOVE;
    const cap = (Z_INDEX.CURSOR || 2147483050) - 1;
    let maxZ = 0;
    let node = el;
    const seen = new Set();
    while (node && node.nodeType && !seen.has(node)) {
      seen.add(node);
      if (node.nodeType === 1) {
        try {
          let zi = parseInt(node.style?.zIndex, 10);
          if (!Number.isFinite(zi)) {
            zi = parseInt(window.getComputedStyle(node).zIndex, 10);
          }
          if (Number.isFinite(zi) && zi > maxZ) maxZ = zi;
        } catch { /* ignore */ }
      }
      if (node.parentElement) {
        node = node.parentElement;
        continue;
      }
      try {
        const root = typeof node.getRootNode === 'function' ? node.getRootNode() : null;
        node = (root && root.host && root.host !== node) ? root.host : null;
      } catch {
        node = null;
      }
    }
    return Math.min(Math.max(floor, maxZ + 1), cap);
  }

  /**
   * Position a vertical sidecar immediately left of a text field’s left edge.
   * @param {HTMLElement} hint
   * @param {DOMRect|{left:number,top:number,width:number,height:number}} rect
   * @param {{ fallbackWidth?: number, fallbackHeight?: number, targetEl?: Element|null }} [opts]
   */
  _positionTextFieldSidecar(hint, rect, opts = {}) {
    if (!hint || !rect) return;
    hint.style.display = 'flex';
    const w = hint.offsetWidth || opts.fallbackWidth || 28;
    const h = hint.offsetHeight || opts.fallbackHeight || 36;
    const gap = 4;
    hint.style.left = `${Math.round(rect.left - w - gap)}px`;
    hint.style.top = `${Math.round(rect.top + (rect.height - h) / 2)}px`;
    hint.style.visibility = 'visible';
    try {
      hint.style.zIndex = String(this._overlayZIndexAboveTarget(opts.targetEl || null));
    } catch { /* ignore */ }
  }

  /**
   * Stack “Esc / to / exit” immediately left of the orange left-edge bar.
   * @param {Element|null} element
   */
  updateTextFocusEscHint(element) {
    if (!element) {
      this.hideTextFocusEscHint();
      return;
    }

    const host =
      (this._textFocusPaintHost && this._textFocusPaintHost.isConnected)
        ? this._textFocusPaintHost
        : element;
    const rect = this.getBestRect(host);
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      this.hideTextFocusEscHint();
      return;
    }

    this._positionTextFieldSidecar(this.ensureTextFocusEscHint(), rect, {
      fallbackWidth: 28,
      fallbackHeight: 36,
      targetEl: host
    });
  }

  hideTextFocusEscHint() {
    if (this.textFocusEscHint) this.textFocusEscHint.style.display = 'none';
  }

  /**
   * Stack “F / to / select” left of a hovered text field.
   * @param {Element|null} element
   */
  updateTextHoverActivateHint(element) {
    if (!element) {
      this.hideTextHoverActivateHint();
      return;
    }

    const rect = this.getBestRect(element);
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      this.hideTextHoverActivateHint();
      return;
    }

    this._positionTextFieldSidecar(this.ensureTextHoverActivateHint(), rect, {
      fallbackWidth: 28,
      fallbackHeight: 36,
      targetEl: element
    });
  }

  hideTextHoverActivateHint() {
    if (this.textHoverActivateHint) this.textHoverActivateHint.style.display = 'none';
  }

  /** Reposition the hover activate sidecar after scroll/resize when one is active. */
  refreshTextHoverActivateHint() {
    if (!this._textHoverCurrentElement || !this._textHoverCurrentElement.isConnected) {
      this.hideTextHoverActivateHint();
      return;
    }
    this.updateTextHoverActivateHint(this._textHoverCurrentElement);
  }

  _clearTextFocusElementStyling() {
    if (!this._textFocusStyledElements || this._textFocusStyledElements.size === 0) {
      this._textFocusCurrentElement = null;
      this._textFocusPaintHost = null;
      this._textFocusAppliedStyle = null;
      this.hideTextFocusEscHint();
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
      this.hideTextFocusEscHint();
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
      this.hideTextHoverActivateHint();
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
      this.hideTextHoverActivateHint();
    }
  }

  _applyTextHoverElementStyling(inputEl) {
    if (!inputEl || inputEl.nodeType !== 1) {
      this._clearTextHoverElementStyling();
      return;
    }

    // Avoid thrashing while mouse is steady — still refresh the sidecar position.
    if (this._textHoverCurrentElement === inputEl && this._textHoverStyledElements.size > 0) {
      try { inputEl.classList.add(CSS_CLASSES.TEXT_HOVER_INPUT); } catch { /* ignore */ }
      this.updateTextHoverActivateHint(inputEl);
      return;
    }

    this._clearTextHoverElementStyling();
    this._textHoverCurrentElement = inputEl;

    try {
      this._ensureStylesForElement(inputEl);
      inputEl.classList.add(CSS_CLASSES.TEXT_HOVER_INPUT);
      this._textHoverStyledElements.add(inputEl);
    } catch { /* ignore */ }

    // Hover is outline + left sidecar only — do not tint wrapper parents.
    this.updateTextHoverActivateHint(inputEl);
  }

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

    // Text inputs: show orange outline AND the left “F to select” sidecar.
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
          // Shadow skip-A is for hostile site trees. If B cannot mount and A
          // can still show (Settings fieldset, KP chrome), do not jump to C.
          autoStrategy = canB ? 'B' : (this._strategyAIsViable(element) ? 'A' : 'C');
        }
      }

      // Settings Advanced / Debug HUD can force A / B / C, or Auto B→C (skip A).
      const override = this._effectivePaintOverride();
      let strategy = autoStrategy;
      // Same-origin popover iframes (Docs / Settings): parent body-fixed rings
      // paint *under* the iframe. Always outline the inner node (strategy A),
      // even when Settings/HUD prefer Auto B→C.
      let forceIframeA = false;
      try {
        forceIframeA = !!(element.ownerDocument && element.ownerDocument !== document);
      } catch { forceIframeA = false; }
      // Onboarding sits above Z_INDEX.OVERLAYS in an open shadow. Auto B→C
      // either clips the in-target ring or paints C under the panel.
      // Outline the button itself (A), same as popover iframes.
      let forceOnboardingA = false;
      try {
        forceOnboardingA = !!closestComposed(element, '.kp-onboarding-panel');
      } catch { forceOnboardingA = false; }
      // Settings / Docs mount in an open shadow in *this* document (not an
      // iframe). forceIframeA does not apply; without this, Auto B→C skips A
      // and a fieldset legend often fails B's ring-size check → C.
      let forceOwnedChromeA = false;
      try {
        forceOwnedChromeA = !!closestComposed(
          element,
          '.kpv2-settings-host, .kpv2-docs-host, .kpv2-popover-container'
        );
      } catch { forceOwnedChromeA = false; }
      if (forceIframeA || forceOnboardingA || forceOwnedChromeA) {
        autoStrategy = 'A';
        strategy = 'A';
      } else if (override === 'A' || override === 'B' || override === 'C') {
        strategy = override;
      } else if (override === 'BC') {
        // Auto B→C: skip A only while B can mount. If B cannot, prefer A
        // whenever it can still show — C is last resort (A invisible).
        let canB = false;
        try {
          canB = !!(FEATURE_FLAGS && FEATURE_FLAGS.ENABLE_IN_TARGET_FOCUS_RING) &&
            !!this._resolveInTargetHost(element);
        } catch { canB = false; }
        strategy = canB ? 'B' : (this._strategyAIsViable(element) ? 'A' : 'C');
      }

      // Stay off C for the whole scroll gesture. Idle (scroll-end) is the
      // only time we may return to a body-fixed ring.
      if (this._preferADuringScroll && strategy === 'C') {
        strategy = 'A';
      }

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
        // B failed to mount — C only when A cannot show a ring (media cover,
        // overflowing a clipper). Fieldsets / KP chrome usually work on A.
        if (isClickableKeyPilotChromeElement(element) || this._strategyAIsViable(element)) {
          this._focusPaintUsesFixedOverlay = false;
          this._focusPaintUsesInTargetRing = false;
          try { this.hideInTargetFocusRing(); } catch { /* ignore */ }
          try { this.hideFocusOverlayDOM(); } catch { /* ignore */ }
          try {
            this._updateShadowRootDebugHud(element, paintEl, {
              inShadow,
              autoStrategy,
              appliedStrategy: 'A',
              override
            });
          } catch { /* ignore */ }
          return this.updateFocusOverlayElementStyling(element, mode);
        }
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
      if (cResult === 'occluded') {
        this._focusPaintUsesFixedOverlay = false;
        if (isClickableKeyPilotChromeElement(element) || this._strategyAIsViable(element)) {
          try {
            this._updateShadowRootDebugHud(element, paintEl, {
              inShadow,
              autoStrategy,
              appliedStrategy: 'A',
              override
            });
          } catch { /* ignore */ }
          return this.updateFocusOverlayElementStyling(element, mode);
        }
      }
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
   * True when two viewport boxes overlap. Abspos flyouts (Epoch Times header
   * `group-hover` mega-menu) are DOM descendants of an `overflow-x-auto` bar
   * but paint entirely *outside* that bar — the overflow box is not a clipper
   * for that target, so do not use it to skip A or zero out C.
   * @param {{ left?: number, top?: number, width?: number, height?: number, right?: number, bottom?: number }|null|undefined} a
   * @param {{ left?: number, top?: number, width?: number, height?: number, right?: number, bottom?: number }|null|undefined} b
   * @returns {boolean}
   */
  _viewportRectsOverlap(a, b) {
    if (!a || !b) return false;
    const aL = Number(a.left);
    const aT = Number(a.top);
    const aR = Number(a.right != null ? a.right : aL + Number(a.width));
    const aB = Number(a.bottom != null ? a.bottom : aT + Number(a.height));
    const bL = Number(b.left);
    const bT = Number(b.top);
    const bR = Number(b.right != null ? b.right : bL + Number(b.width));
    const bB = Number(b.bottom != null ? b.bottom : bT + Number(b.height));
    if (![aL, aT, aR, aB, bL, bT, bR, bB].every(Number.isFinite)) return false;
    return aR > bL + 0.5 && aL < bR - 0.5 && aB > bT + 0.5 && aT < bB - 0.5;
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

    const origin = out;
    const intersectNode = (n) => {
      if (!n || n.nodeType !== 1) return true;
      let ar = null;
      try { ar = n.getBoundingClientRect(); } catch { ar = null; }
      const cr = this._asPositiveViewportRect(ar);
      if (!cr) return true;
      // Target sits fully outside this overflow box (escaped abspos flyout).
      if (origin && !this._viewportRectsOverlap(origin, cr)) return true;
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

          // Mega-menu links live in the header scroller's DOM but paint below
          // it. No overlap → this overflow box is not clipping the target.
          if (!this._viewportRectsOverlap(ar, er)) {
            n = this._composedParent(n);
            continue;
          }

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
   * Chrome's used value for replaced elements is often `overflow: clip` even
   * when the author never clipped. That is not a wrapper clip; do not treat
   * it as one (it was sending every <img> down the A-dead → C path).
   * @param {Element|null|undefined} el
   * @param {CSSStyleDeclaration|null|undefined} cs
   * @returns {boolean}
   */
  _styleClipsSelfFor(el, cs) {
    if (!cs) return false;
    if (el && this._isReplacedOrVoidElement(el)) {
      const ox = String(cs.overflowX || cs.overflow || '');
      const oy = String(cs.overflowY || cs.overflow || '');
      const authorClip =
        (ox && ox !== 'visible' && ox !== 'clip') ||
        (oy && oy !== 'visible' && oy !== 'clip');
      return authorClip || this._styleClipsPaintContain(cs) || this._styleClipsClipPath(cs);
    }
    return this._styleClipsSelf(cs);
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
   * clip-path (other than none) clips descendants the same way overflow does.
   * Keyboard Ref keycaps use --kp-key-clip for truncated corners.
   * @param {CSSStyleDeclaration|null|undefined} cs
   * @returns {boolean}
   */
  _styleClipsClipPath(cs) {
    if (!cs) return false;
    try {
      const clip = String(cs.clipPath || cs.webkitClipPath || '');
      return !!(clip && clip !== 'none');
    } catch {
      return false;
    }
  }

  _styleClipsSelf(cs) {
    return this._styleClipsOverflow(cs)
      || this._styleClipsPaintContain(cs)
      || this._styleClipsClipPath(cs);
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
   * Driven by Click Mode → Advanced → Padding (historical path-A default: 2).
   */
  _preferredFocusOutlineOffsetPx() {
    try {
      return this._getClickModeSettings().focusPadding;
    } catch {
      return 2;
    }
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
      if (!this._viewportRectsOverlap(ar, er)) continue;
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
   * True when strategy A (CSS outline on the node) can still show a ring.
   * Used so B-fail / Auto B→C does not jump to C for ordinary boxes (Settings
   * fieldset, KP chrome) that never needed a body-fixed overlay.
   * @param {Element|null|undefined} element
   * @returns {boolean}
   */
  _strategyAIsViable(element) {
    if (!element || element.nodeType !== 1) return false;
    let paintEl = element;
    try {
      paintEl = this._resolveFocusPaintElement(element) || element;
    } catch {
      paintEl = element;
    }
    try {
      // A is fine on a single painted box (Epoch Times inline <a><picture><img>
      // outlines the <img>). It fails when the *paint* node (or wrapping card)
      // really splits into image + title / multi-line boxes.
      if (this._positiveClientRectCount(paintEl) >= 2) return false;
      const shell = this._resolveMediaTextCardShell(element);
      if (shell && this._positiveClientRectCount(shell) >= 2) return false;
    } catch { /* ignore */ }
    try {
      if (this._shouldUseFixedFocusOverlay(element)) return false;
    } catch { /* if the geometry check throws, still try A */ }
    try {
      this._ensureStylesForElement(element);
    } catch { /* inline outline still applies in open shadows */ }
    return true;
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

    // Image+text card whose <a> is inline and splits into image + title
    // fragments: A outline is disjoint. A single flex/block card box can
    // take A. Nested headline/thumb links do not qualify (fill check).
    try {
      const shell = this._resolveMediaTextCardShell(paintEl)
        || this._resolveMediaTextCardShell(element);
      // Real split (image + title line boxes), not a single box with 0×0
      // <source> leftovers or a bare `display:inline` wrapping one <img>.
      if (shell && this._positiveClientRectCount(shell) >= 2) {
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
      selfClips = this._styleClipsSelfFor(paintEl, window.getComputedStyle(paintEl));
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
    try { box = this._visualContentUnionRect(el); } catch { box = null; }
    if (!box) {
      try { box = el.getBoundingClientRect(); } catch { box = null; }
    }
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
    try { fr = this._visualContentUnionRect(focusEl) || focusEl.getBoundingClientRect(); } catch { fr = null; }
    try { sr = this._visualContentUnionRect(shell) || shell.getBoundingClientRect(); } catch { sr = null; }
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
      try { ir = this._visualContentUnionRect(el) || el.getBoundingClientRect(); } catch { ir = null; }
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
    try { ir = this._visualContentUnionRect(shell) || shell.getBoundingClientRect(); } catch { ir = null; }
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
   * True when `el` can host an absolute inset:0 ring (not replaced, not a
   * bare-inline / multi-fragment box).
   * @param {Element|null|undefined} el
   * @returns {boolean}
   */
  _isViableInTargetHost(el) {
    if (!el || el.nodeType !== 1) return false;
    if (this._isReplacedOrVoidElement(el)) return false;
    if (this._isFragmentedInlineFocusTarget(el)) return false;
    if (this._isInsideCssMultiColumn(el)) return false;
    return !!this._canMountVisibleChildOnHost(el);
  }

  /**
   * CSS `columns` / `column-count` break absolute containing blocks (Blink
   * paints abspos children in the first column). Strategy B must not mount
   * there — Epoch Times header mega-menu section links use `columns-2`.
   * @param {Element|null|undefined} el
   * @returns {boolean}
   */
  _isInsideCssMultiColumn(el) {
    if (!el || el.nodeType !== 1) return false;
    let n = el;
    let depth = 0;
    while (n && n.nodeType === 1 && depth++ < 12) {
      if (n === document.body || n === document.documentElement) break;
      try {
        const cs = window.getComputedStyle(n);
        const count = parseInt(String(cs.columnCount || ''), 10);
        if (Number.isFinite(count) && count >= 2) return true;
      } catch { /* ignore */ }
      try {
        n = this._composedParent(n);
      } catch {
        n = n.parentElement;
      }
    }
    return false;
  }

  /**
   * Same-size block descendant that can take the B ring (inline <a> wrapping
   * a clipped thumb).
   * @param {Element} start
   * @param {DOMRect|ClientRect|null|undefined} focusRect
   * @returns {Element|null}
   */
  _findSameSizeInTargetDescendant(start, focusRect) {
    if (!start || start.nodeType !== 1) return null;
    /** @type {Element[]} */
    const queue = [];
    try {
      const kids = start.children;
      if (kids) {
        for (let i = 0; i < kids.length; i++) {
          if (kids[i]?.nodeType === 1) queue.push(kids[i]);
        }
      }
    } catch {
      return null;
    }
    let seen = 0;
    while (queue.length && seen++ < 16) {
      const cur = queue.shift();
      if (!cur || cur.nodeType !== 1) continue;
      if (this._isViableInTargetHost(cur)) {
        let r = null;
        try { r = cur.getBoundingClientRect(); } catch { r = null; }
        if (r && r.width >= 8 && r.height >= 8 && this._inTargetHostSizeOk(r, focusRect)) {
          return cur;
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
    return null;
  }

  /**
   * Box used to accept/reject a B host. Prefer the visual media box over an
   * inline <a> line box so a same-size clip wrap matches and a larger
   * caption/card parent does not.
   * @param {Element} element
   * @param {Element|null|undefined} paintEl
   * @returns {DOMRect|ClientRect|null}
   */
  _visualFocusRectForInTarget(element, paintEl) {
    /** @type {Array<DOMRect|ClientRect>} */
    const boxes = [];
    const push = (el) => {
      if (!el || el.nodeType !== 1) return;
      try {
        const union = this._visualContentUnionRect(el);
        if (union && union.width > 1 && union.height > 1) boxes.push(union);
      } catch { /* ignore */ }
      try {
        const r = el.getBoundingClientRect();
        if (r && r.width > 1 && r.height > 1) boxes.push(r);
      } catch { /* ignore */ }
    };
    push(element);
    if (paintEl && paintEl !== element) push(paintEl);
    try {
      const media = this._findDominantReplacedPaintChild(element);
      if (media) push(media);
    } catch { /* ignore */ }
    if (paintEl && paintEl !== element) {
      try {
        const media = this._findDominantReplacedPaintChild(paintEl);
        if (media) push(media);
      } catch { /* ignore */ }
    }
    if (!boxes.length) return null;
    let best = boxes[0];
    let bestArea = best.width * best.height;
    for (let i = 1; i < boxes.length; i++) {
      const a = boxes[i].width * boxes[i].height;
      if (a > bestArea) {
        bestArea = a;
        best = boxes[i];
      }
    }
    return best;
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
    let focusRect = this._visualFocusRectForInTarget(element, paintEl);

    // Open-shadow: size the ring to the clickable, not the owning custom element
    // (news lists share one large shadow host for many small links).
    try {
      const root = typeof paintEl.getRootNode === 'function' ? paintEl.getRootNode() : null;
      if (root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
        // Prefer the clickable itself (flex <a> around an <img>) over the
        // replaced paint child and over the full-width shadow host layer.
        if (this._isViableInTargetHost(element)) {
          let er = null;
          try { er = element.getBoundingClientRect(); } catch { er = null; }
          if (er && er.width >= 8 && er.height >= 8) return element;
        }
        if (this._isViableInTargetHost(paintEl)) {
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
          if (this._isViableInTargetHost(n)) {
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

    if (this._isViableInTargetHost(paintEl)) {
      let pr = null;
      try { pr = paintEl.getBoundingClientRect(); } catch { pr = null; }
      if (pr && pr.width >= 8 && pr.height >= 8) return paintEl;
    }

    // Inline <a> wrapping a block thumb: mount on a same-size block child
    // (clip wrap). Search paint node and semantic <a> (paint may be the <img>).
    let nearChild = this._findSameSizeInTargetDescendant(paintEl, focusRect);
    if (!nearChild && element !== paintEl) {
      nearChild = this._findSameSizeInTargetDescendant(element, focusRect);
    }
    if (nearChild) return nearChild;

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
      if (this._isViableInTargetHost(n)) {
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
   * Max numeric z-index among host pseudos and descendants (excluding the ring).
   * Direct children are not enough: Epoch Times SHORT VIDEOS put the play
   * overlay / poster several levels down, so a sibling-only scan stays at 0
   * and the ring's `max+1` is still under that layer.
   * @param {Element} host
   * @returns {number}
   */
  _maxLocalZIndex(host) {
    let max = 0;
    const consider = (z) => {
      if (z == null || z === '' || z === 'auto') return;
      const n = parseInt(String(z), 10);
      if (!Number.isFinite(n)) return;
      // Ignore site-wide "max int" layers so we do not race popovers.
      if (n > 1000000) return;
      max = Math.max(max, n);
    };

    try {
      for (const pseudo of [':before', ':after']) {
        const ps = window.getComputedStyle(host, pseudo);
        if (ps) consider(ps.zIndex);
      }
    } catch { /* ignore */ }

    const ringClass = CSS_CLASSES.FOCUS_RING_INTARGET || 'kpv2-focus-ring-intarget';
    /** @type {Element[]} */
    const queue = [];
    try {
      const kids = host.children;
      if (kids) {
        for (let i = 0; i < kids.length; i++) {
          if (kids[i]?.nodeType === 1) queue.push(kids[i]);
        }
      }
    } catch {
      return max;
    }

    let seen = 0;
    const maxNodes = 40;
    while (queue.length && seen++ < maxNodes) {
      const child = queue.shift();
      if (!child || child.nodeType !== 1) continue;
      if (child === this._inTargetRing) continue;
      try {
        if (child.classList && child.classList.contains(ringClass)) continue;
        if (child.hasAttribute && child.hasAttribute('data-kp-ephemeral-effect')) continue;
      } catch { /* ignore */ }
      let cs = null;
      try { cs = window.getComputedStyle(child); } catch { cs = null; }
      if (cs && cs.zIndex !== 'auto') consider(cs.zIndex);
      try {
        const kids = child.children;
        if (kids) {
          for (let i = 0; i < kids.length && queue.length < maxNodes; i++) {
            if (kids[i]?.nodeType === 1) queue.push(kids[i]);
          }
        }
      } catch { /* ignore */ }
    }

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
   * Count getClientRects() boxes with a real painted area.
   * `<picture>` / `<source>` leftover 0×0 rects (theepochtimes.com thumbs)
   * must not count as line-box fragments.
   * @param {Element|null|undefined} el
   * @returns {number}
   */
  _positiveClientRectCount(el) {
    if (!el || el.nodeType !== 1) return 0;
    try {
      const rects = el.getClientRects();
      if (!rects || !rects.length) return 0;
      let n = 0;
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (r && r.width > 1 && r.height > 1) n++;
      }
      return n;
    } catch {
      return 0;
    }
  }

  /**
   * Painted union of `el` plus descendant media. Blink omits a tall <img>
   * from an inline host's getBoundingClientRect / getClientRects when the
   * <a> also wraps a display:block title (Rumble `a.category__link`).
   * Strategy B's inset:0 ring follows that under-measured line box unless
   * we size against this union.
   *
   * @param {Element|null|undefined} el
   * @returns {{ left: number, top: number, right: number, bottom: number, width: number, height: number, x: number, y: number }|null}
   */
  _visualContentUnionRect(el) {
    if (!el || el.nodeType !== 1) return null;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    let any = false;
    const absorb = (r) => {
      if (!r || !(r.width > 1) || !(r.height > 1)) return;
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
      any = true;
    };
    try { absorb(el.getBoundingClientRect()); } catch { /* ignore */ }
    try {
      const rects = el.getClientRects();
      if (rects) {
        for (let i = 0; i < rects.length && i < 16; i++) absorb(rects[i]);
      }
    } catch { /* ignore */ }
    try {
      const media = el.querySelectorAll('img, video, canvas, svg');
      for (let i = 0; i < media.length && i < 12; i++) {
        const n = media[i];
        if (!n || n.nodeType !== 1) continue;
        let r = null;
        try { r = n.getBoundingClientRect(); } catch { r = null; }
        if (!r || r.width < 8 || r.height < 8) continue;
        try {
          const host = el.getBoundingClientRect();
          if (host && host.width > 8 && r.width > host.width * 1.35 + 24) continue;
        } catch { /* keep */ }
        absorb(r);
      }
    } catch { /* ignore */ }
    if (!any || !Number.isFinite(left) || !Number.isFinite(top)) return null;
    const width = right - left;
    const height = bottom - top;
    if (!(width > 1) || !(height > 1)) return null;
    return { left, top, right, bottom, width, height, x: left, y: top };
  }

  /**
   * Multi-line / wrapped inline clickables fragment into several line boxes.
   * Absolute `inset:0` on an inline host sizes to one fragment (often first line
   * width only) — do not mount B on that host (climb to a same-size block).
   * @param {Element|null|undefined} el
   * @returns {boolean}
   */
  _isFragmentedInlineFocusTarget(el) {
    if (!el || el.nodeType !== 1) return false;
    if (this._positiveClientRectCount(el) >= 2) return true;
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
    // Do not bail here — `_resolveInTargetHost` may still find a same-size
    // block parent/child (e.g. overflow-hidden thumb wrap around an inline <a>).
    // A larger parent (caption, card chrome) is rejected by the size gate.
    let cardHost = null;
    try { cardHost = this._resolveMediaTextCardShell(element); } catch { cardHost = null; }

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
    // Light DOM: still beat auto-z posters / play overlays (SHORT VIDEOS).
    let z = zLocal;
    try {
      if (this._isInShadowTree(host)) z = Math.max(z, 2147483000);
      else z = Math.max(z, 2);
    } catch {
      z = Math.max(zLocal, 2);
    }

    let focusPad = 0;
    try {
      focusPad = Math.max(0, Number(this._getClickModeSettings().focusPadding) || 0);
    } catch {
      focusPad = 0;
    }
    // Expanding the ring outside an overflow/clip-path host (Keyboard Ref
    // keycaps are overflow:hidden + optional --kp-key-clip) clips the stroke
    // away, then Auto B→C falls through to a body overlay under the window.
    let hostClipsSelf = false;
    try {
      hostClipsSelf = this._styleClipsSelf(window.getComputedStyle(host));
    } catch {
      hostClipsSelf = false;
    }

    // Ancestor clip (carousel `.scroll { overflow:auto }` flush with the card)
    // also shaves an outward pad — same as self-clip.
    let clipRoom = Infinity;
    try {
      clipRoom = this._minFocusOutlineRoomPx(host);
    } catch {
      clipRoom = Infinity;
    }
    // Cannot expand outside the host when the host clips, or when an ancestor
    // clipper is tighter than the outward pad (x.com photo frames are ~1px
    // larger overflow:hidden; SHORT VIDEOS `.scroll` is flush). In that case
    // sit flush (edge 0) — the border-box stroke stays inside the host.
    // Do *not* pull the ring inward; that made every overflow:hidden media
    // tile look inset (x.com <article> photos).
    const outwardBlocked = hostClipsSelf ||
      (Number.isFinite(clipRoom) && clipRoom < focusPad + 0.5);

    try {
      ring.style.setProperty('position', 'absolute', 'important');
      // Always set the four longhands. Do not toggle `inset` vs top/right/…
      // with removeProperty — in Blink `inset` IS those four properties, so
      // removing one form wipes the other and the ring collapses to ~6×6
      // (border-only). Then Auto B→C falls through to C.
      // Negative = expand outside the host; 0 = flush when a clipper would
      // shave an outward pad.
      let edgePx = 0;
      if (!outwardBlocked && focusPad > 0) {
        edgePx = -focusPad;
      }
      const edge = `${edgePx}px`;
      ring.style.setProperty('top', edge, 'important');
      ring.style.setProperty('right', edge, 'important');
      ring.style.setProperty('bottom', edge, 'important');
      ring.style.setProperty('left', edge, 'important');
      ring.style.setProperty('box-sizing', 'border-box', 'important');
      ring.style.setProperty('pointer-events', 'none', 'important');
      ring.style.setProperty('margin', '0', 'important');
      ring.style.setProperty('padding', '0', 'important');
      ring.style.setProperty('width', 'auto', 'important');
      ring.style.setProperty('height', 'auto', 'important');
      ring.style.setProperty('z-index', String(z), 'important');
      ring.style.setProperty('border-width', `${ringWidthPx}px`, 'important');
      // Advanced → Debug paint backend: B = dotted (vs A dashed / C double).
      const borderStyle = this._getClickModeSettings().paintBackendDebugDashes ? 'dotted' : 'solid';
      ring.style.setProperty('border-style', borderStyle, 'important');
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
      ring.style.setProperty('isolation', 'isolate', 'important');
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
      // Allow intentional focusPadding expansion.
      let hostBox = null;
      try { hostBox = host.getBoundingClientRect(); } catch { hostBox = null; }
      const padSlack = focusPad * 2 + 2;
      if (
        hostBox &&
        hostBox.width > 1 &&
        hostBox.height > 1 &&
        (rr.width > hostBox.width * 1.35 + 4 + padSlack ||
          rr.height > hostBox.height * 1.35 + 4 + padSlack)
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
    // Advanced → Debug paint backend: A = dashed outline (vs B dotted / C double).
    try {
      const outlineStyle = this._getClickModeSettings().paintBackendDebugDashes ? 'dashed' : 'solid';
      stylingTarget.style.setProperty('--keypilot-focus-outline-style', outlineStyle);
    } catch {
      stylingTarget.style.setProperty('--keypilot-focus-outline-style', 'solid');
    }

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

    // Shadow trees / same-origin iframe documents: also paint outline inline.
    // Injected <style> can be wiped, and iframe docs do not inherit parent CSS.
    let foreignDoc = false;
    try {
      foreignDoc = !!(stylingTarget.ownerDocument && stylingTarget.ownerDocument !== document);
    } catch { /* ignore */ }
    if (this._isInShadowTree(stylingTarget) || foreignDoc) {
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
        el.style.removeProperty('--keypilot-focus-outline-style');
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
      return 'hidden';
    }
    // Expand by Advanced → Padding so B→C rings match strategy-A outer offset.
    try {
      const pad = Math.max(0, Number(this._getClickModeSettings().focusPadding) || 0);
      if (pad > 0) {
        rect = {
          left: rect.left - pad,
          top: rect.top - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          right: (rect.right != null ? rect.right : rect.left + rect.width) + pad,
          bottom: (rect.bottom != null ? rect.bottom : rect.top + rect.height) + pad
        };
      }
    } catch { /* keep unpadded rect */ }
    // Sticky headers / sibling layers: inset any C edge whose corners are covered.
    try {
      const source = (opts && opts.colorFrom && opts.colorFrom.nodeType === 1)
        ? opts.colorFrom
        : element;
      const inset = this._insetCRectForOcclusion(source, rect);
      if (!inset) {
        this.hideFocusOverlay();
        return 'occluded';
      }
      rect = inset;
    } catch { /* keep un-inset rect */ }
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
    // Advanced → Debug paint backend: C = double (vs A dashed / B dotted).
    const borderStyle = this._getClickModeSettings().paintBackendDebugDashes ? 'double' : 'solid';
    this.focusOverlay.style.border = `${rectangleThickness}px ${borderStyle} ${borderColor}`;
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
}

export function installFocusOverlayPainter(OverlayManager) {
  for (const name of FOCUS_OVERLAY_METHOD_NAMES) {
    OverlayManager.prototype[name] = function (...args) {
      return this.focusOverlayPainter[name](...args);
    };
  }
}
