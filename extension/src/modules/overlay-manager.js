/**
 * Visual overlay management for focus and delete indicators
 */
import { CSS_CLASSES, Z_INDEX, SELECTORS, MODES, COLORS, FEATURE_FLAGS, CLICKABLE_CATEGORY, KP_UI_FONT, SCROLL } from '../config/constants.js';
import {
  getAllInspectorHostClasses,
  getInspectorDef,
  getInspectorInstructionText
} from './inspector-mode.js';
import { HighlightManager } from './highlight-manager.js';
import { PopupManager } from './popup-manager.js';
import { PopoverController } from './popover-controller.js';
import { FocusOverlayPainter, installFocusOverlayPainter } from './focus-overlay.js';
import { DEFAULT_SETTINGS } from './settings-manager.js';
import {
  containsComposed
} from '../ui/kp-chrome-shadow.js';
import { waitForScrollSettle } from '../utils/scroll-at-point.js';

/** Font Awesome 6 solid paths (viewBox 0 0 512 512) for PAGE_TOP / PAGE_BOTTOM.
 * Bar sits at the arrow tip (top for ↑, bottom for ↓), not the shaft tail.
 */
const EDGE_JUMP_ICON_PATHS = Object.freeze({
  // Up arrow + horizontal bar at tip (top)
  top: 'M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l96 96c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 205.3V384c0 17.7-14.3 32-32 32s-32-14.3-32-32V205.3l-41.4 41.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l96-96zM64 64c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H96C78.3 96 64 81.7 64 64z',
  // Down arrow + horizontal bar at tip (bottom)
  bottom: 'M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l96-96c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 306.7V128c0-17.7-14.3-32-32-32s-32 14.3-32 32V306.7l-41.4-41.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l96 96zM64 448c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H96c-17.7 0-32-14.3-32-32z'
});




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
    this.textFocusEscHint = null; // Vertical “Esc to exit” sidecar left of the orange bar
    this._textFocusEscKeyLabel = 'Esc';
    this.textHoverActivateHint = null; // Vertical “F / to / select” sidecar left of hover field
    this._textHoverActivateKeyLabel = 'F';
    this.hoverClickLabelText = 'F clicks'; // Hover label for click arming in text focus mode
    /** @type {HTMLElement|null} */
    this._edgeJumpFadeEl = null;
    this._edgeJumpFadeToken = 0;
    /** @type {HTMLElement[]} Font Info inspected-run outlines */
    this.fontInfoOverlays = [];

    // Central popup stack + blurred backdrop (kept below click overlays).
    // Note: Panel change callback will be set by KeyPilot after initialization
    this.popupManager = new PopupManager();
    this.popover = new PopoverController(this);

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
     * Forced paint strategy while HUD is open:
     * 'A' | 'B' | 'C' | 'BC' (Auto B→C) | null (full auto).
     * Seeded from Settings default so first HUD open matches Advanced paint mode.
     * @type {'A'|'B'|'C'|'BC'|null}
     */
    this._shadowDebugPaintOverride =
      (DEFAULT_SETTINGS.clickMode && DEFAULT_SETTINGS.clickMode.paintStrategy === 'BC')
        ? 'BC'
        : null;
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

    /**
     * While a scroll gesture is in flight, paint C targets with A so the ring
     * rides the element. Nested overflow (Settings pane) often never reaches
     * the document scroll listener, so repositioning C would miss anyway.
     * @type {boolean}
     */
    this._preferADuringScroll = false;

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

    // Text input hover styling (left “F to select” sidecar; outline is separate).
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
    this.focusOverlayPainter = new FocusOverlayPainter(this);
    this._installFocusClipCacheInvalidation();

    /**
     * Active temporary click/image effect overlays.
     * Fixed-position ghosts must be torn down when the source leaves view,
     * is z-occluded (lightbox), or the page navigates — otherwise they animate
     * alone over the next screen. In-target (B) flashes skip occlusion checks.
     * @type {Set<{ pulse: Element, sourceEl: Element|null, originRect: DOMRect|null, checkOcclusion?: boolean, rafId: number, timeoutId: number, io: IntersectionObserver|null, teardown: () => void }>}
     */
    this._activeEphemeralEffects = new Set();
    this._ephemeralEffectLifecycleInstalled = false;
    /** @type {(() => void)|null} */
    this._ephemeralEffectLifecycleDispose = null;
    
    this.setupOverlayObserver();
    
    // Initialize highlight manager with observer
    this.highlightManager.initialize(this.overlayObserver);
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
        if (focusedTextElement) {
          this.updateTextModeLabels(focusedTextElement);
          this.updateTextFocusEscHint(focusedTextElement);
        } else {
          this.hideTextModeLabels();
          this.hideTextFocusEscHint();
        }
      } else {
        this.hideTextModeLabels();
        this.hideTextFocusEscHint();
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
   * Hits to ignore while probing occlusion (C overlay, B ring, F-click ghosts).
   * @param {Element} hit
   * @param {Element|null|undefined} extraIgnore
   * @returns {boolean}
   */
  _isOcclusionProbeIgnoreHit(hit, extraIgnore = null) {
    if (!hit || hit.nodeType !== 1) return true;
    if (extraIgnore && hit === extraIgnore) return true;
    if (hit === this._inTargetRing || hit === this.focusOverlay) return true;
    try {
      if (hit.hasAttribute && hit.hasAttribute('data-kp-ephemeral-effect')) return true;
      if (hit.hasAttribute && hit.hasAttribute('data-kp-focus-ring')) return true;
      const ringClass = CSS_CLASSES.FOCUS_RING_INTARGET || 'kpv2-focus-ring-intarget';
      if (hit.classList && (hit.classList.contains(ringClass)
        || hit.classList.contains(CSS_CLASSES.FOCUS_OVERLAY))) {
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  /**
   * True when the top meaningful hit at (x,y) is sourceEl (or inside / wrapping it).
   * @param {Element} sourceEl
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  _isPointOnSource(sourceEl, x, y) {
    if (!sourceEl || !Number.isFinite(x) || !Number.isFinite(y)) return true;
    let stack = null;
    try {
      if (typeof document.elementsFromPoint === 'function') {
        stack = document.elementsFromPoint(x, y);
      }
    } catch {
      stack = null;
    }
    if (!stack || !stack.length) return true;
    for (let i = 0; i < stack.length; i++) {
      const hit = stack[i];
      if (this._isOcclusionProbeIgnoreHit(hit)) continue;
      return !!(
        hit === sourceEl ||
        containsComposed(sourceEl, hit) ||
        containsComposed(hit, sourceEl)
      );
    }
    return true;
  }

  /**
   * Shrink a strategy-C viewport rect so covered edges (sticky header, sibling
   * layer) are pulled in. Four-corner samples; an edge is inset when both of
   * its corners are covered, or one corner plus that edge's midpoint.
   * @param {Element} sourceEl
   * @param {{ left: number, top: number, width: number, height: number }} rect
   * @returns {{ left: number, top: number, width: number, height: number }|null}
   */
  _insetCRectForOcclusion(sourceEl, rect) {
    if (!sourceEl || sourceEl.nodeType !== 1 || !rect) return rect || null;
    let box = this._asPositiveViewportRect(rect);
    if (!box) return null;
    if (typeof document.elementsFromPoint !== 'function') return box;

    const MIN = 8;
    const pad = () => Math.max(1, Math.min(6, box.width / 4, box.height / 4));
    const onSrc = (x, y) => this._isPointOnSource(sourceEl, x, y);

    const corners = () => {
      const p = pad();
      return {
        tl: !onSrc(box.left + p, box.top + p),
        tr: !onSrc(box.left + box.width - p, box.top + p),
        bl: !onSrc(box.left + p, box.top + box.height - p),
        br: !onSrc(box.left + box.width - p, box.top + box.height - p)
      };
    };

    const edgeCovered = (side, c) => {
      const p = pad();
      if (side === 'top') {
        if (c.tl && c.tr) return true;
        if (c.tl || c.tr) return !onSrc(box.left + box.width / 2, box.top + p);
      } else if (side === 'bottom') {
        if (c.bl && c.br) return true;
        if (c.bl || c.br) return !onSrc(box.left + box.width / 2, box.top + box.height - p);
      } else if (side === 'left') {
        if (c.tl && c.bl) return true;
        if (c.tl || c.bl) return !onSrc(box.left + p, box.top + box.height / 2);
      } else if (side === 'right') {
        if (c.tr && c.br) return true;
        if (c.tr || c.br) return !onSrc(box.left + box.width - p, box.top + box.height / 2);
      }
      return false;
    };

    const shrinkEdge = (side) => {
      const p = pad();
      if (side === 'top' || side === 'bottom') {
        let lo = 0;
        let hi = Math.max(0, box.height - MIN);
        for (let i = 0; i < 8 && hi - lo > 1; i++) {
          const mid = (lo + hi) / 2;
          const y = side === 'top' ? box.top + mid + p : box.top + box.height - mid - p;
          const clear = onSrc(box.left + p, y) && onSrc(box.left + box.width - p, y);
          if (clear) hi = mid;
          else lo = mid;
        }
        const cut = hi;
        if (!(cut > 0.5)) return;
        if (side === 'top') {
          box = { left: box.left, top: box.top + cut, width: box.width, height: box.height - cut };
        } else {
          box = { left: box.left, top: box.top, width: box.width, height: box.height - cut };
        }
      } else {
        let lo = 0;
        let hi = Math.max(0, box.width - MIN);
        for (let i = 0; i < 8 && hi - lo > 1; i++) {
          const mid = (lo + hi) / 2;
          const x = side === 'left' ? box.left + mid + p : box.left + box.width - mid - p;
          const clear = onSrc(x, box.top + p) && onSrc(x, box.top + box.height - p);
          if (clear) hi = mid;
          else lo = mid;
        }
        const cut = hi;
        if (!(cut > 0.5)) return;
        if (side === 'left') {
          box = { left: box.left + cut, top: box.top, width: box.width - cut, height: box.height };
        } else {
          box = { left: box.left, top: box.top, width: box.width - cut, height: box.height };
        }
      }
    };

    let guard = 0;
    while (guard++ < 4) {
      if (box.width < MIN || box.height < MIN) return null;
      const c = corners();
      const sides = [];
      if (edgeCovered('top', c)) sides.push('top');
      if (edgeCovered('bottom', c)) sides.push('bottom');
      if (edgeCovered('left', c)) sides.push('left');
      if (edgeCovered('right', c)) sides.push('right');
      if (!sides.length) break;
      if (sides.length === 4) return null;
      for (const side of sides) shrinkEdge(side);
    }

    if (!box || box.width < MIN || box.height < MIN) return null;
    return box;
  }

  /**
   * True when a foreign stacking layer now paints over the source center
   * (lightbox / modal portal). IntersectionObserver cannot detect z-index
   * occlusion — this is the real "covered away" check for fixed ghosts.
   *
   * @param {Element} sourceEl
   * @param {Element|null|undefined} pulse - ephemeral effect to ignore in the stack
   * @returns {boolean}
   */
  _isEphemeralSourceOccluded(sourceEl, pulse = null) {
    if (!sourceEl || sourceEl.nodeType !== 1 || !sourceEl.isConnected) return true;
    let rect = null;
    try { rect = sourceEl.getBoundingClientRect(); } catch { return true; }
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return true;

    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
    if (!(x >= 0 && y >= 0 && x <= vw && y <= vh)) return false;

    let stack = null;
    try {
      if (typeof document.elementsFromPoint === 'function') {
        stack = document.elementsFromPoint(x, y);
      }
    } catch { stack = null; }
    if (!stack || !stack.length) return false;

    for (let i = 0; i < stack.length; i++) {
      const hit = stack[i];
      if (this._isOcclusionProbeIgnoreHit(hit, pulse)) continue;

      // Source (or something inside / wrapping it) is still the top meaningful hit.
      if (
        hit === sourceEl ||
        containsComposed(sourceEl, hit) ||
        containsComposed(hit, sourceEl)
      ) {
        return false;
      }

      // Foreign layer above the source (lightbox, modal, site overlay).
      return true;
    }
    return false;
  }

  /**
   * Track a temporary click effect so it is removed when the source target is
   * gone/hidden, occluded (fixed path), or the page navigates — not only when
   * the CSS animation ends.
   *
   * @param {Element} pulse
   * @param {Element|null|undefined} sourceEl
   * @param {{ left: number, top: number, width: number, height: number }|null|undefined} originRect
   * @param {number} cleanupMs
   * @param {{ checkOcclusion?: boolean, minVisibleMs?: number }} [opts]
   *   minVisibleMs: keep the ghost through source teardown/occlusion until this
   *   many ms have elapsed (F-click flash must survive the click's SPA unmount).
   */
  _trackEphemeralEffect(pulse, sourceEl, originRect, cleanupMs, opts = {}) {
    if (!pulse) return;
    this._installEphemeralEffectLifecycle();

    const checkOcclusion = opts?.checkOcclusion === true;
    const minVisibleMs = Number.isFinite(opts?.minVisibleMs)
      ? Math.max(0, opts.minVisibleMs)
      : 0;
    const visibleSince = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();
    const earlyTeardownAllowed = () => {
      if (minVisibleMs <= 0) return true;
      const now = (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : Date.now();
      return (now - visibleSince) >= minVisibleMs;
    };

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
      checkOcclusion,
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

    // Source left the viewport / clipped by an ancestor → drop immediately.
    // (Does not detect z-index lightbox occlusion — see checkOcclusion.)
    if (entry.sourceEl) {
      try {
        entry.io = new IntersectionObserver(
          (records) => {
            if (!earlyTeardownAllowed()) return;
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

    // Poll for disconnect / zero-size / large layout jump / occlusion.
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
      if (src && earlyTeardownAllowed()) {
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
          // Opacity-0 / display:none during view transitions.
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

          // Fixed ghosts: tear down when a lightbox/modal paints over the source.
          if (checkOcclusion && this._isEphemeralSourceOccluded(src, pulse)) {
            teardown();
            return;
          }
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
   * Border-radius for F-click / image-copy ghosts. Prefer the live blue hover
   * paint (B ring or C overlay), then visual resolve on the source elements.
   * Always returns a CSS value (defaults to `0`) so flash corners match the box.
   *
   * @param {...(Element|null|undefined)} sources
   * @returns {string}
   */
  _resolveClickEffectBorderRadius(...sources) {
    // Live strategy-B ring already carries the visual host radius.
    try {
      if (
        this._focusPaintUsesInTargetRing &&
        this._inTargetRing &&
        this._inTargetRing.isConnected
      ) {
        const raw =
          this._inTargetRing.style?.getPropertyValue?.('border-radius') ||
          window.getComputedStyle(this._inTargetRing).borderRadius ||
          '';
        const trimmed = String(raw).trim();
        if (trimmed) return trimmed;
      }
    } catch { /* ignore */ }

    // Live strategy-C fixed overlay.
    try {
      if (
        this._focusPaintUsesFixedOverlay &&
        this.focusOverlay &&
        this.focusOverlay.style.display !== 'none'
      ) {
        const raw =
          this.focusOverlay.style?.borderRadius ||
          window.getComputedStyle(this.focusOverlay).borderRadius ||
          '';
        const trimmed = String(raw).trim();
        if (trimmed) return trimmed;
      }
    } catch { /* ignore */ }

    // Strategy A may have written radius onto the styled host (which
    // `_resolveElementBorderRadius` skips as a KP paint node).
    try {
      const styled = this._currentStyledElement;
      if (
        styled &&
        styled.nodeType === 1 &&
        styled.isConnected &&
        !this._focusPaintUsesInTargetRing &&
        !this._focusPaintUsesFixedOverlay
      ) {
        const raw =
          styled.style?.getPropertyValue?.('border-radius') ||
          window.getComputedStyle(styled).borderRadius ||
          '';
        const trimmed = String(raw).trim();
        if (trimmed && !/^(0|0px)(\s+(0|0px))*$/i.test(trimmed.replace(/\s*\/\s*/g, ' '))) {
          return trimmed;
        }
      }
    } catch { /* ignore */ }

    for (const src of sources) {
      if (!src || src.nodeType !== 1) continue;
      try {
        // Prefer resolve on a non-KP-marker ancestor/child path. If `src` is
        // the styled focus host, temporarily read via descendants/ancestors.
        const r = this._resolveElementBorderRadius(src);
        if (r) return r;
      } catch { /* try next */ }
    }
    return '0';
  }

  /**
   * Apply border-radius onto an ephemeral flash node (div or dash SVG).
   * @param {Element} pulse
   * @param {string|null|undefined} borderRadius
   * @param {{ width?: number, height?: number }|null} [box] - for SVG rx/ry refresh
   */
  _applyEphemeralBorderRadius(pulse, borderRadius, box = null) {
    const radius = (borderRadius && String(borderRadius).trim()) || '0';
    if (!pulse) return;
    try {
      pulse.style.setProperty('border-radius', radius, 'important');
    } catch { /* ignore */ }

    // Dash SVG: keep rx/ry in sync with the resolved radius.
    try {
      if (typeof SVGElement !== 'undefined' && pulse instanceof SVGElement) {
        const shape = pulse.querySelector?.('rect');
        if (shape) {
          const w = Math.max(1, Number(box?.width) || parseFloat(pulse.getAttribute('width')) || 1);
          const h = Math.max(1, Number(box?.height) || parseFloat(pulse.getAttribute('height')) || 1);
          const stroke = 3;
          const rw = Math.max(1, w - stroke);
          const rh = Math.max(1, h - stroke);
          const rx = Math.min(this._borderRadiusToSvgRx(radius, w, h), rw / 2, rh / 2);
          shape.setAttribute('rx', String(rx));
          shape.setAttribute('ry', String(rx));
        }
      }
    } catch { /* ignore */ }
  }

  /**
   * Approximate border-radius in CSS px for SVG rx/ry from a CSS border-radius string.
   * @param {string|null|undefined} borderRadius
   * @param {number} width
   * @param {number} height
   * @returns {number}
   */
  _borderRadiusToSvgRx(borderRadius, width, height) {
    if (!borderRadius) return 0;
    const first = String(borderRadius).trim().split(/\s+/)[0] || '';
    if (!first) return 0;
    if (/^(0|0px|0%)$/i.test(first)) return 0;
    if (first.endsWith('%')) {
      const p = parseFloat(first);
      if (!Number.isFinite(p)) return 0;
      return Math.max(0, Math.min(width, height) * (p / 100));
    }
    const n = parseFloat(first);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
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
   * Local z-index for an ephemeral in-target flash — sit above the live B ring.
   * @param {Element} host
   * @returns {number}
   */
  _inTargetEphemeralZIndex(host) {
    let z = this._maxLocalZIndex(host) + 1;
    try {
      if (this._inTargetRing && this._inTargetRing.parentNode === host) {
        const raw =
          this._inTargetRing.style?.getPropertyValue?.('z-index') ||
          window.getComputedStyle(this._inTargetRing).zIndex;
        const n = parseInt(String(raw), 10);
        if (Number.isFinite(n)) z = Math.max(z, n + 1);
      }
    } catch { /* ignore */ }
    try {
      if (this._isInShadowTree(host)) z = Math.max(z, 2147483000);
    } catch { /* ignore */ }
    return z;
  }

  /**
   * Restyle a fixed-position click-effect node as an absolute inset:0 sibling
   * inside the strategy-B host (co-located; naturally under lightboxes).
   * @param {HTMLElement|SVGSVGElement} pulse
   * @param {Element} host
   * @param {string|null|undefined} borderRadius
   * @param {string} clickEffect
   * @param {{ width: number, height: number }|null} [box]
   */
  _applyInTargetEphemeralLayout(pulse, host, borderRadius, clickEffect, box = null) {
    const z = this._inTargetEphemeralZIndex(host);
    const isSvg = typeof SVGElement !== 'undefined' && pulse instanceof SVGElement;
    const lockTransform = clickEffect !== 'scale' && clickEffect !== 'marquee';

    pulse.style.setProperty('position', 'absolute', 'important');
    pulse.style.setProperty('inset', '0', 'important');
    pulse.style.setProperty('left', '0', 'important');
    pulse.style.setProperty('top', '0', 'important');
    pulse.style.setProperty('right', '0', 'important');
    pulse.style.setProperty('bottom', '0', 'important');
    pulse.style.setProperty('margin', '0', 'important');
    pulse.style.setProperty('pointer-events', 'none', 'important');
    pulse.style.setProperty('z-index', String(z), 'important');
    pulse.style.setProperty('box-sizing', 'border-box', 'important');

    if (isSvg && box) {
      pulse.style.setProperty('width', `${Math.max(1, box.width)}px`, 'important');
      pulse.style.setProperty('height', `${Math.max(1, box.height)}px`, 'important');
      try {
        pulse.setAttribute('width', String(Math.max(1, box.width)));
        pulse.setAttribute('height', String(Math.max(1, box.height)));
      } catch { /* ignore */ }
    } else {
      pulse.style.setProperty('width', 'auto', 'important');
      pulse.style.setProperty('height', 'auto', 'important');
    }

    this._applyEphemeralBorderRadius(pulse, borderRadius, box);
    if (lockTransform) {
      pulse.style.setProperty('transform', 'none', 'important');
      pulse.style.setProperty('transform-origin', 'center', 'important');
      pulse.style.setProperty('scale', 'none', 'important');
      pulse.style.setProperty('translate', 'none', 'important');
      pulse.style.setProperty('rotate', 'none', 'important');
    }
  }

  /**
   * When hover paint is already strategy B, mount the green flash as an absolute
   * sibling inside the same host so lightbox portals naturally cover it.
   * @param {string} clickEffect
   * @param {{ className: string, cleanupMs: number }} presentation
   * @param {Element|null|undefined} activationEl
   * @returns {boolean}
   */
  _tryFlashInTargetEffect(clickEffect, presentation, activationEl) {
    if (!this._focusPaintUsesInTargetRing) return false;
    const host = this._inTargetHost;
    if (!host || host.nodeType !== 1 || !host.isConnected) return false;

    // Only when this host belongs to the activation target (not a stale B ring).
    try {
      if (
        activationEl &&
        activationEl.nodeType === 1 &&
        host !== activationEl &&
        !(typeof host.contains === 'function' && host.contains(activationEl)) &&
        !(typeof activationEl.contains === 'function' && activationEl.contains(host)) &&
        !containsComposed(host, activationEl) &&
        !containsComposed(activationEl, host)
      ) {
        return false;
      }
    } catch { /* keep trying */ }

    let borderRadius = '0';
    try {
      borderRadius = this._resolveClickEffectBorderRadius(host, activationEl);
    } catch { borderRadius = '0'; }

    let hostRect = null;
    try { hostRect = this._asPositiveViewportRect(host.getBoundingClientRect()); } catch { hostRect = null; }
    if (!hostRect) return false;

    const w = Math.max(1, host.clientWidth || hostRect.width);
    const h = Math.max(1, host.clientHeight || hostRect.height);

    /** @type {HTMLElement|SVGSVGElement} */
    let pulse;
    try {
      if (clickEffect === 'dash') {
        pulse = this._createDashChasePulse({ left: 0, top: 0, width: w, height: h }, borderRadius);
        this._applyInTargetEphemeralLayout(pulse, host, borderRadius, clickEffect, { width: w, height: h });
      } else {
        pulse = document.createElement('div');
        pulse.className = presentation.className;
        pulse.setAttribute('aria-hidden', 'true');
        pulse.setAttribute('data-kp-ephemeral-effect', clickEffect);
        this._applyInTargetEphemeralLayout(pulse, host, borderRadius, clickEffect);
      }

      // Last child → above earlier siblings including the blue B ring.
      host.appendChild(pulse);
      this._trackEphemeralEffect(
        pulse,
        host,
        hostRect,
        presentation.cleanupMs,
        { checkOcclusion: false }
      );
      return true;
    } catch (e) {
      try { if (pulse && pulse.isConnected) pulse.remove(); } catch { /* ignore */ }
      if (window.KEYPILOT_DEBUG) {
        console.warn('[KeyPilot] in-target focus pulse failed:', e);
      }
      return false;
    }
  }

  /**
   * Body-fixed green ghosts that copy the blue hover box (A or C, or B fallthrough).
   * Uses occlusion cleanup so lightbox portals do not leave a green linger.
   *
   * @param {string} clickEffect
   * @param {{ className: string, cleanupMs: number }} presentation
   * @param {Element|null|undefined} el
   */
  _flashFixedClickEffect(clickEffect, presentation, el) {
    const { paintEl, rects } = this._resolveClickEffectRects(el);
    if (!rects || !rects.length) return false;

    const radiusSource = (paintEl && paintEl.nodeType === 1) ? paintEl : el;
    let borderRadius = '0';
    try {
      borderRadius = this._resolveClickEffectBorderRadius(
        this._inTargetHost,
        radiusSource,
        el
      );
    } catch { borderRadius = '0'; }

    const trackEl = (paintEl && paintEl.nodeType === 1) ? paintEl : el;
    let mounted = false;

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
        }
        this._applyEphemeralBorderRadius(pulse, borderRadius, liveRect);
        document.body.appendChild(pulse);
        // Kick layout so the CSS animation starts this frame, not after click().
        try { void pulse.offsetWidth; } catch { /* ignore */ }
        this._trackEphemeralEffect(
          pulse,
          trackEl,
          liveRect,
          presentation.cleanupMs,
          { checkOcclusion: true, minVisibleMs: 140 }
        );
        mounted = true;
      } catch (e) {
        if (window.KEYPILOT_DEBUG) {
          console.warn('[KeyPilot] focus pulse failed:', e);
        }
      }
    }
    return mounted;
  }

  /**
   * F-key activation feedback for link-style targets.
   *
   * Always a body-fixed ghost (not an in-target sibling). Click / SPA
   * re-render would unmount an in-host pulse with the target before paint.
   * Occlusion cleanup still drops the ghost once a lightbox covers the source,
   * after a short min-visible window.
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
   * @returns {boolean} true when a pulse node was mounted
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

      if (!showEffect) return false;
    } catch { /* ignore */ }

    const { clickEffect } = this._getClickModeSettings();
    if (clickEffect === 'none') return false;

    const presentation = this._clickEffectPresentation(clickEffect);
    if (!presentation) return false;

    // Don't start an effect if the activation target is already gone / not painted.
    if (el && el.nodeType === 1) {
      if (!el.isConnected) return false;
      try {
        const cs = window.getComputedStyle(el);
        if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
      } catch { /* ignore */ }
    }

    return !!this._flashFixedClickEffect(clickEffect, presentation, el);
  }

  /**
   * Click New Tab / Background, Preview Link, Open Popover when the hover
   * target has no navigable URL.
   * Always a dashed orange strobe (not the user clickEffect, and not gated on
   * link-style category) so buttons, text, and empty space still get a "nope".
   *
   * @param {Element|null} [activationTarget]
   * @param {{ x?: number, y?: number }} [point] cursor fallback when there is no box
   * @returns {boolean}
   */
  flashDeniedDashOutline(activationTarget = null, point = null) {
    const el = (activationTarget && activationTarget.nodeType === 1)
      ? activationTarget
      : (this._currentStyledElement || this._lastFocusElement);

    const skipHuge =
      el === document.documentElement || el === document.body;
    const source = skipHuge ? null : el;

    let rects = [];
    let paintEl = source;
    if (source) {
      try {
        const resolved = this._resolveClickEffectRects(source);
        paintEl = resolved.paintEl || source;
        rects = resolved.rects || [];
      } catch { /* ignore */ }
    } else {
      try {
        if (this.focusOverlay && this.focusOverlay.style.display !== 'none') {
          const r = this._asPositiveViewportRect(this.focusOverlay.getBoundingClientRect());
          if (r) rects = [r];
        }
      } catch { /* ignore */ }
    }

    if (!rects.length) {
      const x = Number(point?.x);
      const y = Number(point?.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        const size = 36;
        rects = [{ left: x - size / 2, top: y - size / 2, width: size, height: size }];
      }
    }
    if (!rects.length) return false;

    const radiusSource = (paintEl && paintEl.nodeType === 1) ? paintEl : source;
    let borderRadius = '0';
    try {
      borderRadius = this._resolveClickEffectBorderRadius(
        this._inTargetHost,
        radiusSource,
        source
      );
    } catch { borderRadius = '0'; }

    const trackEl = (paintEl && paintEl.nodeType === 1) ? paintEl : source;
    let mounted = false;
    for (let i = 0; i < rects.length; i++) {
      const liveRect = rects[i];
      if (!liveRect) continue;
      try {
        const pulse = document.createElement('div');
        pulse.className = CSS_CLASSES.FOCUS_DASH_DENIED;
        pulse.setAttribute('aria-hidden', 'true');
        pulse.setAttribute('data-kp-ephemeral-effect', 'dash-denied');
        pulse.style.left = `${liveRect.left}px`;
        pulse.style.top = `${liveRect.top}px`;
        pulse.style.width = `${liveRect.width}px`;
        pulse.style.height = `${liveRect.height}px`;
        this._applyEphemeralBorderRadius(pulse, borderRadius, liveRect);
        document.body.appendChild(pulse);
        try { void pulse.offsetWidth; } catch { /* ignore */ }
        this._trackEphemeralEffect(
          pulse,
          trackEl,
          liveRect,
          700,
          { checkOcclusion: false, minVisibleMs: 120 }
        );
        mounted = true;
      } catch (e) {
        if (window.KEYPILOT_DEBUG) {
          console.warn('[KeyPilot] denied dash outline failed:', e);
        }
      }
    }
    return mounted;
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
      const borderRadius = this._resolveClickEffectBorderRadius(element);
      this._applyEphemeralBorderRadius(pulse, borderRadius, { width, height });
      document.body.appendChild(pulse);
      this._trackEphemeralEffect(
        pulse,
        element,
        { left, top, width, height },
        900,
        { checkOcclusion: true }
      );
    } catch (e) {
      if (window.KEYPILOT_DEBUG) {
        console.warn('[KeyPilot] image-copy pulse failed:', e);
      }
    }
  }

  /**
   * Outline the Font Info inspected text run (stroke rects, not Text Select fill).
   * @param {Range|null|undefined} range
   */
  showFontInfoOutline(range) {
    this.hideFontInfoOutline();
    if (!range || range.collapsed) return;

    let rects;
    try {
      rects = this.getClientRectsWithShadowSupport(range);
    } catch {
      rects = [];
    }
    if (!rects || !rects.length) return;

    const maxRects = 40;
    const n = Math.min(rects.length, maxRects);
    for (let i = 0; i < n; i++) {
      const rect = rects[i];
      const w = Number(rect.width) || 0;
      const h = Number(rect.height) || 0;
      if (w <= 0 || h <= 0) continue;
      try {
        const overlay = this.createElement('div', {
          className: CSS_CLASSES.FONT_INFO_OUTLINE,
          style: `
            position: fixed;
            left: ${rect.left}px;
            top: ${rect.top}px;
            width: ${w}px;
            height: ${h}px;
            box-sizing: border-box;
            background: ${COLORS.FONT_INFO_OUTLINE_FILL};
            border: 2px solid ${COLORS.FONT_INFO_OUTLINE};
            box-shadow: 0 0 0 1px ${COLORS.FONT_INFO_OUTLINE_SHADOW};
            pointer-events: none;
            z-index: ${Z_INDEX.OVERLAYS_BELOW};
          `
        });
        overlay.setAttribute('aria-hidden', 'true');
        document.body.appendChild(overlay);
        this.fontInfoOverlays.push(overlay);
      } catch { /* ignore */ }
    }
  }

  hideFontInfoOutline() {
    const list = this.fontInfoOverlays || [];
    for (const el of list) {
      try { el.remove(); } catch { /* ignore */ }
    }
    this.fontInfoOverlays = [];
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
    if (this.textFocusEscHint) {
      this.textFocusEscHint.remove();
      this.textFocusEscHint = null;
    }
    if (this.textHoverActivateHint) {
      this.textHoverActivateHint.remove();
      this.textHoverActivateHint = null;
    }

    // Clean up debug panel / shadow HUD
    this.cleanupDebugPanel();
    this.cleanupShadowRootDebugHud();
    this.hideFontInfoOutline();
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

  get popoverContainer() { return this.popover.popoverContainer; }
  set popoverContainer(v) { this.popover.popoverContainer = v; }
  get popoverIframeElement() { return this.popover.popoverIframeElement; }
  set popoverIframeElement(v) { this.popover.popoverIframeElement = v; }
  get popoverIframeWindow() { return this.popover.popoverIframeWindow; }
  set popoverIframeWindow(v) { this.popover.popoverIframeWindow = v; }
  get popoverCloseButton() { return this.popover.popoverCloseButton; }
  set popoverCloseButton(v) { this.popover.popoverCloseButton = v; }
  get _popoverWindowUrl() { return this.popover._popoverWindowUrl; }
  set _popoverWindowUrl(v) { this.popover._popoverWindowUrl = v; }
  get _popoverWindowId() { return this.popover._popoverWindowId; }
  set _popoverWindowId(v) { this.popover._popoverWindowId = v; }
  get _popoverWindowTabId() { return this.popover._popoverWindowTabId; }
  set _popoverWindowTabId(v) { this.popover._popoverWindowTabId = v; }
  get _popoverWindowKind() { return this.popover._popoverWindowKind; }
  set _popoverWindowKind(v) { this.popover._popoverWindowKind = v; }

  clearPopoverWindowTracking() {
    this.popover.clearPopoverWindowTracking();
  }

  setDocsFontScale(scale) { return this.popover.setDocsFontScale(scale); }
  showInPageDocsPopover(opts = {}) { return this.popover.showInPageDocsPopover(opts); }
  setDocsTopic(topicId, hash) { return this.popover.setDocsTopic(topicId, hash); }
  showInPageSettingsPopover(opts = {}) { return this.popover.showInPageSettingsPopover(opts); }
  setSettingsPanel(panelId) { return this.popover.setSettingsPanel(panelId); }
  showPopover(url, opts = {}) { return this.popover.showPopover(url, opts); }
  hidePopover(opts = {}) { return this.popover.hidePopover(opts); }
  postMessageToPopoverIframe(message) { return this.popover.postMessageToPopoverIframe(message); }
  scrollPopoverBy(deltaY, behavior = 'smooth') { return this.popover.scrollPopoverBy(deltaY, behavior); }
  scrollPopoverToTop(behavior = 'smooth') { return this.popover.scrollPopoverToTop(behavior); }
  scrollPopoverToBottom(behavior = 'smooth') { return this.popover.scrollPopoverToBottom(behavior); }
  isPopoverOpen() { return this.popover.isPopoverOpen(); }
  showPreviewPopover(url, opts = {}) { return this.popover.showPreviewPopover(url, opts); }


  /**
   * Cover the overflow box that will jump, run `onCovered` (instant scroll),
   * wait for the scroller to stop moving, then uncover.
   * Nested scrollers get their client box; the document root gets the viewport.
   * @param {() => void} onCovered
   * @param {{ durationMs?: number, coverEl?: Element|null, coverRect?: { left: number, top: number, width: number, height: number }|null, edge?: 'top'|'bottom'|null }} [opts]
   * @returns {Promise<void>}
   */
  async runEdgeJumpFade(onCovered, opts = {}) {
    const durationMs = Number.isFinite(Number(opts.durationMs))
      ? Math.max(80, Number(opts.durationMs))
      : null;

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
    const blurMs = durationMs ?? SCROLL.EDGE_JUMP_BLUR_MS;
    const coverMs = durationMs === null
      ? SCROLL.EDGE_JUMP_COVER_MS
      : Math.round(durationMs * 0.5);
    const revealMs = durationMs ?? SCROLL.EDGE_JUMP_REVEAL_MS;
    const clearMs = durationMs === null
      ? SCROLL.EDGE_JUMP_CLEAR_MS
      : Math.round(durationMs * 0.75);
    this._syncEdgeJumpFadeIcon(el, opts.edge, bg);
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.backdropFilter = 'none';
    el.style.webkitBackdropFilter = 'none';
    el.style.background = this._withEdgeJumpFadeAlpha(bg, 0);
    await this._fadeEdgeJumpEl(el, 1, blurMs, {
      blurPx: 10,
      background: this._withEdgeJumpFadeAlpha(bg, 0.42)
    });
    if (token !== this._edgeJumpFadeToken) return;
    await this._fadeEdgeJumpEl(el, 1, coverMs, {
      blurPx: 0,
      background: this._withEdgeJumpFadeAlpha(bg, 1)
    });
    try { onCovered?.(); } catch { /* ignore */ }
    if (token !== this._edgeJumpFadeToken) return;
    await waitForScrollSettle(opts.coverEl || null, {
      timeoutMs: SCROLL.EDGE_JUMP_SETTLE_MS
    });
    if (token !== this._edgeJumpFadeToken) return;
    await this._fadeEdgeJumpEl(el, 1, revealMs, {
      blurPx: 10,
      background: this._withEdgeJumpFadeAlpha(bg, 0.42)
    });
    if (token !== this._edgeJumpFadeToken) return;
    await this._fadeEdgeJumpEl(el, 0, clearMs, {
      blurPx: 0,
      background: this._withEdgeJumpFadeAlpha(bg, 0)
    });
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
   * Convert the resolved veil color to a translucent tint without applying
   * opacity to the child icon. Computed styles normally return rgb(...), but
   * keep hex support for the dark/light fallbacks above.
   * @param {string} color
   * @param {number} alpha
   * @returns {string}
   */
  _withEdgeJumpFadeAlpha(color, alpha) {
    const s = String(color || '').trim().toLowerCase();
    let r;
    let g;
    let b;
    const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      const h = hex[1];
      r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16);
      g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16);
      b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16);
    } else {
      const rgb = s.match(
        /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*[\d.]+)?\s*\)$/
      );
      if (rgb) {
        r = Number(rgb[1]);
        g = Number(rgb[2]);
        b = Number(rgb[3]);
      }
    }
    if (![r, g, b].every(Number.isFinite)) return `rgba(255, 255, 255, ${alpha})`;
    const a = Math.max(0, Math.min(1, Number(alpha)));
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
  }

  /**
   * Corner SVG: top-left for Scroll To Top, bottom-left for Scroll To Bottom.
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
   * @param {{ blurPx?: number, background?: string }} [state]
   * @returns {Promise<void>}
   */
  _fadeEdgeJumpEl(el, opacity, ms, state = {}) {
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        el.removeEventListener('transitionend', onEnd);
        resolve();
      };
      const onEnd = (e) => {
        if (
          e.target !== el
          || (
            e.propertyName
            && !['opacity', 'backdrop-filter', '-webkit-backdrop-filter', 'background-color']
              .includes(e.propertyName)
          )
        ) return;
        done();
      };
      el.addEventListener('transitionend', onEnd);
      el.style.transition = [
        `opacity ${ms}ms ease`,
        `backdrop-filter ${ms}ms ease`,
        `-webkit-backdrop-filter ${ms}ms ease`,
        `background-color ${ms}ms ease`
      ].join(', ');
      const apply = () => {
        el.style.opacity = String(opacity);
        const blurPx = Number(state.blurPx) || 0;
        const blur = blurPx > 0 ? `blur(${blurPx}px)` : 'none';
        el.style.backdropFilter = blur;
        el.style.webkitBackdropFilter = blur;
        if (state.background) el.style.background = state.background;
      };
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
  // SHADOW ROOT DEBUG HUD — leaf / focus / paint + Auto | Auto B→C | A|B|C
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
      // First open reflects Settings → Advanced paint mode (default Auto B→C).
      this._shadowDebugPaintOverride = this._settingsPaintOverride();
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
      // Restore settings-driven paint for current focus.
      try {
        const focusEl = window.keyPilot?.state?.getState?.()?.focusEl || null;
        if (focusEl) this.updateFocusOverlay(focusEl);
      } catch { /* ignore */ }
    }
  }

  /**
   * Force paint strategy while the HUD is open.
   * @param {'A'|'B'|'C'|'BC'|null|string} strategy
   *   null / 'auto' clears override (full A→B→C auto).
   *   'BC' / 'B->C' / 'AUTO_BC' = Auto B→C (skip A; try B then C).
   */
  setShadowDebugPaintStrategy(strategy) {
    const raw = strategy == null ? null : String(strategy).trim();
    const upper = raw ? raw.toUpperCase() : null;
    if (upper === 'A' || upper === 'B' || upper === 'C') {
      this._shadowDebugPaintOverride = upper;
    } else if (
      upper === 'BC' ||
      upper === 'B->C' ||
      upper === 'B→C' ||
      upper === 'AUTO_BC' ||
      upper === 'AUTO-BC' ||
      upper === 'AUTO B->C' ||
      upper === 'AUTO B→C'
    ) {
      this._shadowDebugPaintOverride = 'BC';
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
      // Hot-reload: rebuild if the Auto B→C control is missing.
      try {
        if (!this._shadowDebugHud.querySelector('[data-kp-shadow-dbg-strategy="BC"]')) {
          this._shadowDebugHud.remove();
          this._shadowDebugHud = null;
        }
      } catch { /* keep existing */ }
    }
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
        <button type="button" data-kp-shadow-dbg-strategy="BC">Auto B→C</button>
        <button type="button" data-kp-shadow-dbg-strategy="A">A outline</button>
        <button type="button" data-kp-shadow-dbg-strategy="B">B in-target</button>
        <button type="button" data-kp-shadow-dbg-strategy="C">C fixed</button>
      </div>
      <div style="margin-top:8px;color:#6f9a80;font-size:10px;">
        Auto = A→B→C · Auto B→C = skip A · A outline · B in-host · C body fixed
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
      else if (strat === 'A' || strat === 'B' || strat === 'C' || strat === 'BC') {
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

    const overrideLabel =
      override === 'BC' ? 'Auto B→C'
        : (override ? `forced ${override}` : null);

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
  applied now:     ${applied}${overrideLabel ? `  (${overrideLabel})` : '  (auto)'}`;

    this._refreshShadowDebugHudButtons();
  }
}

installFocusOverlayPainter(OverlayManager);
