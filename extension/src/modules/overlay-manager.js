/**
 * Visual overlay management for focus and delete indicators
 */
import { CSS_CLASSES, Z_INDEX, SELECTORS, MODES, COLORS, FEATURE_FLAGS } from '../config/constants.js';
import { HighlightManager } from './highlight-manager.js';
import { PopupManager } from './popup-manager.js';

export class OverlayManager {
  constructor() {
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

    // Central popup stack + blurred backdrop (kept below click overlays).
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
    
    this.setupOverlayObserver();
    
    // Initialize highlight manager with observer
    this.highlightManager.initialize(this.overlayObserver);
  }

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
    const rectangleThickness = Number(cm.rectangleThickness);
    const thickness = Number.isFinite(rectangleThickness) ? Math.min(Math.max(rectangleThickness, 1), 16) : 3;
    const overlayFillEnabled = cm.overlayFillEnabled === false ? false : true;
    return { rectangleThickness: thickness, overlayFillEnabled };
  }

  _getTextModeSettings() {
    const tm = this._modeSettings?.textMode && typeof this._modeSettings.textMode === 'object'
      ? this._modeSettings.textMode
      : {};
    const strokeThickness = Number(tm.strokeThickness);
    const thickness = Number.isFinite(strokeThickness) ? Math.min(Math.max(strokeThickness, 1), 16) : 3;
    const labelsEnabled = tm.labelsEnabled === false ? false : true;
    return { strokeThickness: thickness, labelsEnabled };
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
            overlay.style.visibility = isVisible ? 'visible' : 'hidden';
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

  updateOverlays(focusEl, deleteEl, mode, focusedTextElement = null) {
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
      this.updateFocusOverlay(focusEl, mode);
      
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
    
    // Show focused text overlay when in text focus mode
    console.log('[KeyPilot] Text mode overlay check:', { mode, hasFocusedTextElement: !!focusedTextElement });
    if (mode === 'text_focus' && focusedTextElement) {
      console.log('[KeyPilot] Creating text mode overlays for:', focusedTextElement.tagName);
      this.updateFocusedTextOverlay(focusedTextElement);
      this.updateActiveTextInputFrame(focusedTextElement);
    } else {
      if (mode === 'text_focus' && !focusedTextElement) {
        console.log('[KeyPilot] Text mode active but no focused text element');
      }
      this.hideFocusedTextOverlay();
      this.hideActiveTextInputFrame();
    }
    
    // Show viewport modal frame when in text focus mode (controlled by flag)
    this.updateViewportModalFrame(mode === 'text_focus' && FEATURE_FLAGS.SHOW_WINDOW_OUTLINE);
    
    // Only show delete overlay in delete mode
    if (mode === 'delete') {
      this.updateDeleteOverlay(deleteEl);
    } else {
      this.hideDeleteOverlay();
    }
    
    // Show highlight overlay in highlight mode
    if (mode === 'highlight') {
      this.highlightManager.updateHighlightOverlay(focusEl);
      this.highlightManager.showHighlightModeIndicator();
    } else {
      this.highlightManager.hideHighlightOverlay();
      this.highlightManager.hideHighlightModeIndicator();
      this.highlightManager.hideHighlightRectangleOverlay();
    }
  }

  updateFocusOverlay(element, mode = MODES.NONE) {
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
    const isVideo = element.tagName === 'VIDEO';

    // We'll use this rect both for sizing/positioning and for deciding whether to render a fill.
    const rect = this.getBestRect(element);
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
      // Green color for all non-text elements
      borderColor = COLORS.FOCUS_GREEN;
      shadowColor = COLORS.GREEN_SHADOW;
      backgroundColor = (isVideo || isVeryLarge) ? 'transparent' : COLORS.FOCUS_GREEN_BG_T2;
    }

    // Settings-driven behavior for Click Mode focus rectangle.
    const { rectangleThickness, overlayFillEnabled } = this._getClickModeSettings();
    if (!isTextInput && !isVideo && !isVeryLarge && overlayFillEnabled === false) {
      backgroundColor = 'transparent';
    }

    // Debug logging
    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] updateFocusOverlay called for:', {
        tagName: element.tagName,
        className: element.className,
        text: element.textContent?.substring(0, 30),
        mode: mode,
        isTextInput: isTextInput,
        isVideo: isVideo,
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
    const brightShadowColor = isTextInput ? COLORS.ORANGE_SHADOW : COLORS.GREEN_SHADOW_BRIGHT;
    this.focusOverlay.style.boxShadow = `0 0 0 2px ${shadowColor}, 0 0 10px 2px ${brightShadowColor}`;
    
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

  hideFocusOverlay() {
    if (this.focusOverlay) {
      this.focusOverlay.style.display = 'none';
    }
  }

  /**
   * Fade out the focus overlay rect, then hide it.
   * Useful after clicks that mutate the DOM (accordions, menus, etc.) so we don't leave a stale rect.
   */
  fadeOutFocusOverlay(durationMs = 120) {
    if (!this.focusOverlay) return;
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

  // Highlight methods delegated to HighlightManager
  updateHighlightRectangleOverlay(startPosition, currentPosition) {
    return this.highlightManager.updateHighlightRectangleOverlay(startPosition, currentPosition);
  }

  hideHighlightRectangleOverlay() {
    return this.highlightManager.hideHighlightRectangleOverlay();
  }

  updateHighlightSelectionOverlays(selection) {
    return this.highlightManager.updateHighlightSelectionOverlays(selection);
  }

  clearHighlightSelectionOverlays() {
    return this.highlightManager.clearHighlightSelectionOverlays();
  }

  // Character selection methods
  setSelectionMode(mode) {
    return this.highlightManager.setSelectionMode(mode);
  }

  getSelectionMode() {
    return this.highlightManager.getSelectionMode();
  }

  startCharacterSelection(position, findTextNodeAtPosition, getTextOffsetAtPosition) {
    return this.highlightManager.startCharacterSelection(position, findTextNodeAtPosition, getTextOffsetAtPosition);
  }

  updateCharacterSelection(currentPosition, startPosition, findTextNodeAtPosition, getTextOffsetAtPosition) {
    return this.highlightManager.updateCharacterSelection(currentPosition, startPosition, findTextNodeAtPosition, getTextOffsetAtPosition);
  }

  completeCharacterSelection() {
    return this.highlightManager.completeCharacterSelection();
  }

  clearCharacterSelection() {
    return this.highlightManager.clearCharacterSelection();
  }

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
        className: 'kpv2-focused-text-overlay',
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

    // Add new classes
    if (focusEl) {
      focusEl.classList.add(CSS_CLASSES.FOCUS);
    }
    if (deleteEl) {
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

  flashFocusOverlay() {
    if (!this.focusOverlay || this.focusOverlay.style.display === 'none') {
      return; // No overlay to flash
    }
    
    // Create flash animation by temporarily changing the overlay style
    const originalBorder = this.focusOverlay.style.border;
    const originalBoxShadow = this.focusOverlay.style.boxShadow;
    
    // Flash with brighter colors
    this.focusOverlay.style.border = `3px solid ${COLORS.FLASH_GREEN}`;
    this.focusOverlay.style.boxShadow = `0 0 0 2px ${COLORS.FLASH_GREEN_SHADOW}, 0 0 20px 4px ${COLORS.FLASH_GREEN_GLOW}`;
    this.focusOverlay.style.transition = 'border 0.15s ease-out, box-shadow 0.15s ease-out';
    
    // Reset after animation
    setTimeout(() => {
      if (this.focusOverlay) {
        this.focusOverlay.style.border = originalBorder;
        this.focusOverlay.style.boxShadow = originalBoxShadow;
        
        // Remove transition after reset to avoid interfering with normal updates
        setTimeout(() => {
          if (this.focusOverlay) {
            this.focusOverlay.style.transition = '';
          }
        }, 150);
      }
    }, 150);
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
   * Show popover with iframe containing the linked page
   * @param {string} url - The URL to load in the popover
   * @param {object} [opts]
   * @param {string} [opts.title] - Optional title for the header (defaults to url)
   * @param {string} [opts.hintKeyLabel] - Optional key label in the hint bar (defaults to 'E')
   * @param {string[]} [opts.closeKeys] - Keys forwarded from iframe that should request close (defaults to ['Escape','e','E'])
   * @param {string} [opts.width] - Optional fixed width (e.g., '920px', overrides default 80vw)
   * @param {string} [opts.height] - Optional fixed height (e.g., '600px', overrides default 80vh)
   */
  showPopover(url, opts = {}) {
    // Remove existing popover if any
    this.hidePopover();

    const titleText = (opts && typeof opts.title === 'string' && opts.title.trim()) ? opts.title.trim() : String(url || '');
    const hintKeyLabel = (opts && typeof opts.hintKeyLabel === 'string' && opts.hintKeyLabel.trim()) ? opts.hintKeyLabel.trim() : 'E';
    const closeKeys = Array.isArray(opts?.closeKeys) && opts.closeKeys.length
      ? opts.closeKeys.map(String)
      : ['Escape', 'e', 'E'];

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
      `
    });




    // Store iframe reference for focus management
    let iframeRef = null;
    this.popoverBridgeReady = false;

    // Create header with close button
    const header = this.createElement('div', {
      style: `
        padding: 12px 16px;
        background: linear-gradient(180deg, #232323 0%, #151515 100%);
        border-bottom: 1px solid #2b2b2b;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
      `
    });

    // Hint banner above the title bar
    const hintBar = this.createElement('div', {
      className: 'kpv2-popover-hint',
      style: `
        padding: 8px 16px;
        background: linear-gradient(180deg, #1e1e1e 0%, #121212 100%);
        border-bottom: 1px solid #2b2b2b;
        font-size: 12px;
        line-height: 1.4;
        color: #d6d6d6;
        flex-shrink: 0;
      `
    });
    hintBar.appendChild(document.createTextNode('Press '));
    const kbd = this.createElement('kbd', {
      style: `
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 11px;
        padding: 1px 6px;
        border: 1px solid #3a3a3a;
        border-bottom-color: #2a2a2a;
        border-radius: 4px;
        background: linear-gradient(180deg, #2b2b2b 0%, #1a1a1a 100%);
        color: #f1f1f1;
      `
    });
    kbd.textContent = hintKeyLabel;
    hintBar.appendChild(kbd);
    hintBar.appendChild(document.createTextNode(' / '));
    const kbdEsc = this.createElement('kbd', {
      style: `
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 11px;
        padding: 1px 6px;
        border: 1px solid #3a3a3a;
        border-bottom-color: #2a2a2a;
        border-radius: 4px;
        background: linear-gradient(180deg, #2b2b2b 0%, #1a1a1a 100%);
        color: #f1f1f1;
      `
    });
    kbdEsc.textContent = 'Esc';
    hintBar.appendChild(kbdEsc);
    hintBar.appendChild(document.createTextNode(' to close. Use Z/X/C/V/B/N to scroll. Press F to click a link under the mouse.'));

    const title = this.createElement('div', {
      style: `
        font-size: 14px;
        font-weight: 500;
        color: #e8e8e8;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
        margin-right: 12px;
      `
    });
    title.textContent = titleText;
    header.appendChild(title);

    const closeButton = this.createElement('button', {
      style: `
        background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%);
        border: 1px solid #3a3a3a;
        font-size: 20px;
        cursor: pointer;
        color: #e8e8e8;
        padding: 4px 8px;
        line-height: 1;
        border-radius: 4px;
        flex-shrink: 0;
      `
    });
    closeButton.textContent = '×';
    closeButton.title = 'Close (Esc)';
    closeButton.onclick = () => requestClosePopover();
    header.appendChild(closeButton);
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
    const sendBridgeInit = () => {
      try {
        iframe.contentWindow?.postMessage({ type: 'KP_POPOVER_BRIDGE_INIT' }, '*');
      } catch {
        // Ignore
      }
    };

    // Important: Do NOT auto-focus the iframe.
    // Key events inside an iframe do not propagate to the parent document, so
    // auto-focusing it breaks Escape-to-close and other KeyPilot shortcuts.
    // Users can still interact with the iframe via mouse; focusing it is optional.

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

    this.popoverContainer.appendChild(hintBar);
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
        // Auto-focus the iframe once we know the bridge is active, so Esc/E + scroll still work.
        try {
          iframeRef?.focus();
        } catch (_e) { }
        try {
          iframeRef?.contentWindow?.focus?.();
        } catch (_e2) { }
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

    // Default focus: keep focus in the parent (close button) until the iframe bridge acks ready.
    // Once ready, we will auto-focus the iframe so keyboard interaction begins immediately.
    try {
      // Prefer focusing the close button so it’s obvious where focus is.
      closeButton.focus();
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
  hidePopover() {
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

    if (this.popoverContainer) {
      // Unmount via PopupManager (removes panel + shared backdrop when last popup closes).
      try {
        this.popupManager?.hideModal?.(this._popoverPopupId);
      } catch {
        // Fallback: direct remove
        try { this.popoverContainer.remove(); } catch { /* ignore */ }
      }
      this.popoverContainer = null;
    }

    // Restore body scroll
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
}