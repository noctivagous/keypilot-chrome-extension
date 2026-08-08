import { EventManager } from './event-manager.js';
import { COLORS, Z_INDEX, CSS_CLASSES, FEATURE_FLAGS, RECTANGLE_SELECTION, ELEMENT_SELECT_TAGS } from '../config/constants.js';

/**
 * HighlightManager - Manages all highlighting functionality including overlays and selection
 */
export class HighlightManager extends EventManager {
  constructor() {
    super();

    // Highlight overlays
    this.highlightOverlay = null; // Overlay for highlight mode
    this.highlightRectangleOverlay = null; // Real-time highlight rectangle overlay
    this.highlightSelectionOverlays = []; // Array of overlays for selected text regions
    this.highlightModeIndicator = null; // Visual indicator for highlight mode

    // Selection mode state
    this.selectionMode = 'character'; // 'character' | 'rectangle' | 'element'
    
    // Character selection state
    this.characterSelectionActive = false;
    this.characterStartPosition = null; // Starting position for character selection
    this.characterStartTextNode = null; // Starting text node
    this.characterStartOffset = 0; // Starting character offset

    // Rectangle selection state
    this.rectOriginPoint = null; // Origin point established by first press (viewport at press time)
    this.rectOriginDocumentPoint = null; // Origin in document coordinates (scroll-stable anchor)
    // Rectangle mode start caret (node+offset) — document-anchored; do not re-resolve from frozen viewport
    this.rectangleStartCaret = null;

    // Element-rectangle selection (semantic HTML granularity)
    /** @type {Element[]} */
    this.elementMatchedElements = [];
    this._elementSelectSelector = ELEMENT_SELECT_TAGS.map((t) => String(t)).join(',');

    // Debug HUD
    this.debugHUD = null; // Debug HUD overlay for live rectangle debugging
    this.debugUpdateCount = 0; // Counter for debug updates

    // Overlay visibility tracking
    this.overlayVisibility = {
      highlight: true,
      highlightRectangle: true
    };

    // Intersection observer for performance optimization
    this.overlayObserver = null;
  }

  /**
   * Initialize the highlight manager with intersection observer
   */
  initialize(overlayObserver) {
    this.overlayObserver = overlayObserver;
  }

  /**
   * Set the selection mode
   * @param {string} mode - 'character' | 'rectangle' | 'element'
   */
  setSelectionMode(mode) {
    if (mode === 'character' || mode === 'rectangle' || mode === 'element') {
      this.selectionMode = mode;
      
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Selection mode set to:', mode);
      }
    }
  }

  /**
   * Get the current selection mode
   * @returns {string} - Current selection mode
   */
  getSelectionMode() {
    return this.selectionMode;
  }

  /**
   * Initialize the highlight manager with edge-only rectangle intersection observer
   * @param {RectangleIntersectionObserver} rectangleObserver - Edge-only intersection observer
   * @param {Function} notificationCallback - Callback for user notifications
   */
  initializeEdgeOnlyProcessing(rectangleObserver, notificationCallback = null) {
    this.rectangleIntersectionObserver = rectangleObserver;
    this.edgeOnlyProcessingEnabled = FEATURE_FLAGS.USE_EDGE_ONLY_SELECTION && FEATURE_FLAGS.ENABLE_EDGE_ONLY_PROCESSING;
    
    // Set up notification callback for performance monitoring
    if (notificationCallback && this.rectangleIntersectionObserver) {
      this.rectangleIntersectionObserver.setNotificationCallback(notificationCallback);
    }
    
    if (window.KEYPILOT_DEBUG && FEATURE_FLAGS.DEBUG_EDGE_ONLY_PROCESSING) {
      console.log('[KeyPilot Debug] Highlight manager initialized with edge-only processing:', {
        enabled: this.edgeOnlyProcessingEnabled,
        observer: !!this.rectangleIntersectionObserver,
        caching: FEATURE_FLAGS.ENABLE_SELECTION_CACHING,
        monitoring: FEATURE_FLAGS.ENABLE_EDGE_PERFORMANCE_MONITORING,
        notificationCallback: !!notificationCallback
      });
    }
  }

  /**
   * Create a DOM element with specified properties
   */
  createElement(tagName, properties = {}) {
    const element = document.createElement(tagName);

    if (properties.className) {
      element.className = properties.className;
    }

    if (properties.style) {
      element.style.cssText = properties.style;
    }

    return element;
  }

  /**
   * Update highlight overlay for focused element
   */
  updateHighlightOverlay(element) {
    if (!element) {
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] updateHighlightOverlay: no element provided');
      }
      this.hideHighlightOverlay();
      return;
    }

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] updateHighlightOverlay called for:', {
        tagName: element.tagName,
        className: element.className,
        id: element.id
      });
    }

    if (!this.highlightOverlay) {
      this.highlightOverlay = this.createElement('div', {
        className: CSS_CLASSES.HIGHLIGHT_OVERLAY,
        style: `
          position: fixed;
          pointer-events: none;
          z-index: ${Z_INDEX.OVERLAYS};
          border: 3px solid ${COLORS.HIGHLIGHT_BLUE};
          box-shadow: 0 0 0 2px ${COLORS.HIGHLIGHT_SHADOW}, 0 0 12px 2px ${COLORS.HIGHLIGHT_SHADOW_BRIGHT};
          background: transparent;
          will-change: transform;
        `
      });
      document.body.appendChild(this.highlightOverlay);

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Highlight overlay created and added to DOM:', {
          element: this.highlightOverlay,
          className: this.highlightOverlay.className,
          parent: this.highlightOverlay.parentElement?.tagName
        });
      }

      // Start observing the overlay for visibility optimization
      if (this.overlayObserver) {
        this.overlayObserver.observe(this.highlightOverlay);
      }
    }

    const rect = element.getBoundingClientRect();

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Highlight overlay positioning:', {
        rect: rect,
        overlayExists: !!this.highlightOverlay,
        overlayVisibility: this.overlayVisibility.highlight
      });
    }

    if (rect.width > 0 && rect.height > 0) {
      this.highlightOverlay.style.left = `${rect.left}px`;
      this.highlightOverlay.style.top = `${rect.top}px`;
      this.highlightOverlay.style.width = `${rect.width}px`;
      this.highlightOverlay.style.height = `${rect.height}px`;
      this.highlightOverlay.style.display = 'block';
      this.highlightOverlay.style.visibility = 'visible';

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Highlight overlay positioned at:', {
          left: rect.left, top: rect.top, width: rect.width, height: rect.height
        });
      }
    } else {
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Highlight overlay hidden - invalid rect:', rect);
      }
      this.hideHighlightOverlay();
    }
  }

  /**
   * Hide the highlight overlay
   */
  hideHighlightOverlay() {
    if (this.highlightOverlay) {
      this.highlightOverlay.style.display = 'none';

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Highlight overlay hidden');
      }
    }
  }

  /**
   * Update edge-only processing rectangle bounds for all workflows
   * @param {Object} rectOriginPoint - Origin point {x, y} (viewport coordinates)
   * @param {Object} currentPosition - Current cursor position {x, y} (viewport coordinates)
   */
  updateEdgeOnlyProcessingRectangle(rectOriginPoint, currentPosition) {
    if (!this.edgeOnlyProcessingEnabled || !this.rectangleIntersectionObserver) {
      return;
    }

    if (!rectOriginPoint || !currentPosition) {
      return;
    }

    try {
      // Convert viewport coordinates to document coordinates
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;

      const originDocX = rectOriginPoint.x + scrollX;
      const originDocY = rectOriginPoint.y + scrollY;
      const currentDocX = currentPosition.x + scrollX;
      const currentDocY = currentPosition.y + scrollY;

      // Calculate rectangle bounds in document coordinates
      const rect = {
        left: Math.min(originDocX, currentDocX),
        top: Math.min(originDocY, currentDocY),
        width: Math.abs(currentDocX - originDocX),
        height: Math.abs(currentDocY - originDocY)
      };

      // Update edge-only processing rectangle
      this.rectangleIntersectionObserver.updateRectangle(rect);

      if (window.KEYPILOT_DEBUG && FEATURE_FLAGS.DETAILED_EDGE_LOGGING) {
        console.log('[KeyPilot Debug] Edge-only processing rectangle updated:', {
          viewport: { origin: rectOriginPoint, current: currentPosition },
          document: { originDocX, originDocY, currentDocX, currentDocY },
          rect: rect
        });
      }
    } catch (error) {
      console.warn('[KeyPilot] Error updating edge-only processing rectangle:', error);
    }
  }

  /**
   * Document-anchored origin converted to the current viewport (for caret resolve / overlay).
   * @returns {{x:number,y:number}|null}
   */
  getOriginViewportPoint() {
    if (!this.rectOriginDocumentPoint) return null;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    return {
      x: this.rectOriginDocumentPoint.x - scrollX,
      y: this.rectOriginDocumentPoint.y - scrollY
    };
  }

  /**
   * Ensure the selection origin is stored in document space (scroll-stable).
   * @param {Object} viewportPoint - {x,y} viewport coordinates at anchor time
   */
  ensureRectOriginDocumentPoint(viewportPoint) {
    if (this.rectOriginDocumentPoint || !viewportPoint) return;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    this.rectOriginPoint = { ...viewportPoint };
    this.rectOriginDocumentPoint = {
      x: viewportPoint.x + scrollX,
      y: viewportPoint.y + scrollY
    };
  }

  /**
   * Update the highlight rectangle overlay showing the selection area.
   * Origin is document-anchored so the rectangle stays glued to content while scrolling.
   * @param {Object} rectOriginPoint - Origin point from first press {x, y} (viewport at press; used only to seed)
   * @param {Object} currentPosition - Current cursor position {x, y} (viewport coordinates)
   */
  updateHighlightRectangleOverlay(rectOriginPoint, currentPosition) {
    if (!currentPosition) {
      this.hideHighlightRectangleOverlay();
      return;
    }

    // Seed document-space origin once; never recompute from a frozen viewport after scroll.
    if (!this.rectOriginDocumentPoint) {
      if (!rectOriginPoint) {
        this.hideHighlightRectangleOverlay();
        return;
      }
      this.ensureRectOriginDocumentPoint(rectOriginPoint);
      this.showDebugHUD();
    }

    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

    // Free end follows the cursor in viewport space → document via current scroll
    const currentDocumentPosition = {
      x: currentPosition.x + scrollX,
      y: currentPosition.y + scrollY
    };

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] updateHighlightRectangleOverlay called:', {
        rectOriginPoint,
        currentPosition,
        rectOriginDocumentPoint: this.rectOriginDocumentPoint,
        currentDocumentPosition,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      });
    }

    if (!this.highlightRectangleOverlay) {
      this.highlightRectangleOverlay = this.createElement('div', {
        className: 'kpv2-highlight-rectangle-overlay',
        style: `
          position: fixed;
          pointer-events: none;
          z-index: ${Z_INDEX.OVERLAYS_BELOW_2};
          background: ${COLORS.HIGHLIGHT_SELECTION_BG};
          border: 2px dashed ${COLORS.HIGHLIGHT_BLUE};
          box-shadow: 0 0 0 1px ${COLORS.HIGHLIGHT_SHADOW}, 0 0 8px 1px ${COLORS.HIGHLIGHT_SHADOW_BRIGHT};
          will-change: transform;
          opacity: 0.8;
          box-sizing: border-box;
        `
      });
      document.body.appendChild(this.highlightRectangleOverlay);

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Highlight rectangle overlay created and added to DOM:', {
          element: this.highlightRectangleOverlay,
          className: this.highlightRectangleOverlay.className,
          parent: this.highlightRectangleOverlay.parentElement?.tagName
        });
      }

      // Start observing the overlay for visibility optimization
      if (this.overlayObserver) {
        this.overlayObserver.observe(this.highlightRectangleOverlay);
      }
    }

    // Desktop file selection behavior: rectangle from document-anchored origin → free end
    const documentLeft = Math.min(this.rectOriginDocumentPoint.x, currentDocumentPosition.x);
    const documentTop = Math.min(this.rectOriginDocumentPoint.y, currentDocumentPosition.y);
    const width = Math.abs(currentDocumentPosition.x - this.rectOriginDocumentPoint.x);
    const height = Math.abs(currentDocumentPosition.y - this.rectOriginDocumentPoint.y);

    // Convert document coordinates back to viewport for fixed-position overlay
    const viewportLeft = documentLeft - scrollX;
    const viewportTop = documentTop - scrollY;

    // Calculate direction for debugging
    const deltaX = currentDocumentPosition.x - this.rectOriginDocumentPoint.x;
    const deltaY = currentDocumentPosition.y - this.rectOriginDocumentPoint.y;
    const quadrant = this.getQuadrant(deltaX, deltaY);

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Highlight rectangle overlay positioning:', {
        documentLeft, documentTop, width, height,
        viewportLeft, viewportTop,
        rectOriginDocumentPoint: this.rectOriginDocumentPoint,
        currentDocumentPosition,
        deltaX, deltaY, quadrant,
        direction: {
          horizontal: deltaX >= 0 ? 'right' : 'left',
          vertical: deltaY >= 0 ? 'down' : 'up'
        }
      });
    }

    // Prepare calculated values for debug HUD
    const calculatedValues = {
      documentLeft,
      documentTop,
      width,
      height,
      viewportLeft,
      viewportTop,
      quadrant
    };

    // Update debug HUD with current information
    this.updateDebugHUD(
      rectOriginPoint,
      currentPosition,
      this.rectOriginDocumentPoint,
      currentDocumentPosition,
      calculatedValues
    );

    // Edge-only stack is for rectangle mode only (character uses caret APIs).
    if (this.selectionMode === 'rectangle') {
      this.updateEdgeOnlyProcessingRectangle(rectOriginPoint, currentPosition);
    }

    // Determine if rectangle should be visible based on configuration
    const shouldShowRectangle = this.shouldShowRectangle(width, height, deltaX, deltaY);
    
    if (shouldShowRectangle) {
      this.highlightRectangleOverlay.style.left = `${viewportLeft}px`;
      this.highlightRectangleOverlay.style.top = `${viewportTop}px`;
      this.highlightRectangleOverlay.style.width = `${width}px`;
      this.highlightRectangleOverlay.style.height = `${height}px`;
      this.highlightRectangleOverlay.style.display = 'block';
      this.highlightRectangleOverlay.style.visibility = 'visible';

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Highlight rectangle overlay positioned at:', {
          viewportLeft, viewportTop, width, height, quadrant,
          shouldShow: shouldShowRectangle,
          minWidth: RECTANGLE_SELECTION.MIN_WIDTH,
          minHeight: RECTANGLE_SELECTION.MIN_HEIGHT
        });
      }
    } else {
      this.highlightRectangleOverlay.style.display = 'none';

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Highlight rectangle overlay hidden:', { 
          width, height, 
          shouldShow: shouldShowRectangle,
          minWidth: RECTANGLE_SELECTION.MIN_WIDTH,
          minHeight: RECTANGLE_SELECTION.MIN_HEIGHT,
          reason: width < RECTANGLE_SELECTION.MIN_WIDTH ? 'width too small' : 
                  height < RECTANGLE_SELECTION.MIN_HEIGHT ? 'height too small' : 'other'
        });
      }
    }
  }

  /**
   * Determine which quadrant the current position is relative to the origin
   * @param {number} deltaX - Horizontal distance from origin
   * @param {number} deltaY - Vertical distance from origin
   * @returns {string} - Quadrant identifier
   */
  getQuadrant(deltaX, deltaY) {
    if (deltaX >= 0 && deltaY >= 0) return 'bottom-right';
    if (deltaX < 0 && deltaY >= 0) return 'bottom-left';
    if (deltaX < 0 && deltaY < 0) return 'top-left';
    if (deltaX >= 0 && deltaY < 0) return 'top-right';
    return 'origin';
  }

  /**
   * Determine if the rectangle should be visible based on size and configuration
   * @param {number} width - Rectangle width in pixels
   * @param {number} height - Rectangle height in pixels
   * @param {number} deltaX - Horizontal distance from origin
   * @param {number} deltaY - Vertical distance from origin
   * @returns {boolean} - Whether rectangle should be shown
   */
  shouldShowRectangle(width, height, deltaX, deltaY) {
    // Always hide if zero dimensions and HIDE_ZERO_SIZE is enabled
    if (RECTANGLE_SELECTION.HIDE_ZERO_SIZE && (width === 0 || height === 0)) {
      return false;
    }

    // Show immediate feedback for any movement if enabled
    if (RECTANGLE_SELECTION.SHOW_IMMEDIATE_FEEDBACK && (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0)) {
      return true;
    }

    // Check minimum size requirements
    const meetsMinWidth = width >= RECTANGLE_SELECTION.MIN_WIDTH;
    const meetsMinHeight = height >= RECTANGLE_SELECTION.MIN_HEIGHT;
    
    // Check minimum drag distance
    const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const meetsMinDrag = dragDistance >= RECTANGLE_SELECTION.MIN_DRAG_DISTANCE;

    // Rectangle is visible if it meets size requirements OR minimum drag distance
    return (meetsMinWidth && meetsMinHeight) || meetsMinDrag;
  }

  /**
   * Hide the highlight rectangle overlay
   */
  hideHighlightRectangleOverlay() {
    if (this.highlightRectangleOverlay) {
      this.highlightRectangleOverlay.style.display = 'none';

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Highlight rectangle overlay hidden');
      }
    }

    // Reset rectangle selection state
    this.resetRectangleSelection();
  }

  /**
   * Remove the highlight rectangle overlay from the DOM and drop the element
   * reference, so the next rectangle session starts with a fresh element.
   * (Hiding alone leaves a detached node that a later session would restyle
   * without re-adding it to the DOM — invisible.)
   */
  removeHighlightRectangleOverlay() {
    if (this.highlightRectangleOverlay) {
      if (this.overlayObserver) {
        try { this.overlayObserver.unobserve(this.highlightRectangleOverlay); } catch { /* ignore */ }
      }
      try { this.highlightRectangleOverlay.remove(); } catch { /* ignore */ }
      this.highlightRectangleOverlay = null;

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Highlight rectangle overlay removed');
      }
    }

    // Reset rectangle selection state
    this.resetRectangleSelection();
  }

  /**
   * Get current selection from edge-only processing
   * @returns {Selection|null} - Browser selection object or null
   */
  getEdgeOnlySelection() {
    if (!this.edgeOnlyProcessingEnabled || !this.rectangleIntersectionObserver) {
      return null;
    }

    try {
      return this.rectangleIntersectionObserver.createSelectionFromIntersection();
    } catch (error) {
      console.warn('[KeyPilot] Error getting edge-only selection:', error);
      return null;
    }
  }

  /**
   * Start character-level selection at the given position
   * Prefer native caret APIs; fall back to findTextNode only if needed.
   * @param {Object} position - Position {x, y} in viewport coordinates
   * @param {Function} findTextNodeAtPosition - Function to find text node at position
   * @param {Function} getTextOffsetAtPosition - Function to get text offset at position
   */
  startCharacterSelection(position, findTextNodeAtPosition, getTextOffsetAtPosition) {
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
      console.warn('[KeyPilot] Invalid position for character selection:', position);
      return false;
    }

    try {
      // Fresh session: drop any leftover overlay DOM from a previous run
      this.clearHighlightSelectionOverlays();

      // Document-anchored origin for the dashed guide rectangle
      this.rectOriginPoint = { ...position };
      this.rectOriginDocumentPoint = {
        x: position.x + (window.pageXOffset || document.documentElement.scrollLeft || 0),
        y: position.y + (window.pageYOffset || document.documentElement.scrollTop || 0)
      };

      // Prefer O(1) caret API over TreeWalker scan
      let textNode = null;
      let offset = 0;
      const caret = this.resolveCaretAtPoint(position.x, position.y, document);
      if (caret?.textNode) {
        textNode = caret.textNode;
        offset = caret.offset;
      } else if (typeof findTextNodeAtPosition === 'function') {
        textNode = findTextNodeAtPosition(position.x, position.y);
        if (textNode && typeof getTextOffsetAtPosition === 'function') {
          offset = getTextOffsetAtPosition(textNode, position.x, position.y);
        }
      }

      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
        if (window.KEYPILOT_DEBUG) {
          console.log('[KeyPilot Debug] No text node found at position for character selection');
        }
        // Keep origin for rectangle guide; selection arms when cursor hits text
        this.characterSelectionActive = false;
        this.characterStartTextNode = null;
        this.characterStartOffset = 0;
        this.characterStartPosition = { ...position };
        return false;
      }

      if (typeof offset !== 'number' || offset < 0) {
        offset = 0;
      }
      const maxOff = textNode.textContent ? textNode.textContent.length : 0;
      offset = Math.max(0, Math.min(offset, maxOff));

      // Store character selection state
      this.characterSelectionActive = true;
      this.characterStartPosition = { ...position };
      this.characterStartTextNode = textNode;
      this.characterStartOffset = offset;

      // Create initial selection range
      const ownerDocument = textNode.ownerDocument || document;
      const range = ownerDocument.createRange();
      range.setStart(textNode, offset);
      range.setEnd(textNode, offset);

      // Set browser selection (native paint — no custom overlays on the hot path)
      const selection = this.getSelectionForDocument(ownerDocument);
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Character selection started:', {
          position,
          textNode: textNode.textContent?.substring(0, 50),
          offset,
          selectedText: textNode.textContent?.charAt(offset)
        });
      }

      return true;
    } catch (error) {
      console.error('[KeyPilot] Error starting character selection:', error);
      this.resetCharacterSelection();
      return false;
    }
  }

  /**
   * Resolve a caret (text node + offset) at viewport coordinates via native APIs.
   * Prefer caretRangeFromPoint / caretPositionFromPoint — O(1) vs TreeWalker scans.
   * @param {number} x
   * @param {number} y
   * @param {Document} [ownerDocument]
   * @returns {{ textNode: Text, offset: number }|null}
   */
  resolveCaretAtPoint(x, y, ownerDocument = document) {
    try {
      const doc = ownerDocument || document;

      // Chromium / Safari
      if (typeof doc.caretRangeFromPoint === 'function') {
        const caretRange = doc.caretRangeFromPoint(x, y);
        if (caretRange && caretRange.startContainer) {
          const node = caretRange.startContainer;
          if (node.nodeType === Node.TEXT_NODE) {
            return { textNode: node, offset: caretRange.startOffset };
          }
          // Element container: try first text child at offset
          if (node.nodeType === Node.ELEMENT_NODE && node.childNodes?.length) {
            const child = node.childNodes[Math.min(caretRange.startOffset, node.childNodes.length - 1)];
            if (child?.nodeType === Node.TEXT_NODE) {
              return { textNode: child, offset: 0 };
            }
          }
        }
      }

      // Firefox
      if (typeof doc.caretPositionFromPoint === 'function') {
        const pos = doc.caretPositionFromPoint(x, y);
        if (pos && pos.offsetNode) {
          const node = pos.offsetNode;
          if (node.nodeType === Node.TEXT_NODE) {
            return { textNode: node, offset: pos.offset };
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Build a forward/backward Range from two caret points and apply it to Selection.
   * @param {{ textNode: Text, offset: number }} start
   * @param {{ textNode: Text, offset: number }} end
   * @returns {Selection|null}
   */
  applyCaretSelection(start, end) {
    if (!start?.textNode || !end?.textNode) return null;
    try {
      const ownerDocument = start.textNode.ownerDocument || document;
      const selection = this.getSelectionForDocument(ownerDocument);
      if (!selection) return null;

      // Determine document order so setStart/setEnd never throws for reverse drag.
      let first = start;
      let second = end;
      if (start.textNode === end.textNode) {
        if (start.offset > end.offset) {
          first = end;
          second = start;
        }
      } else {
        const pos = start.textNode.compareDocumentPosition(end.textNode);
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) {
          // end is before start
          first = end;
          second = start;
        }
      }

      const range = ownerDocument.createRange();
      range.setStart(first.textNode, first.offset);
      range.setEnd(second.textNode, second.offset);

      selection.removeAllRanges();
      selection.addRange(range);
      return selection;
    } catch (error) {
      if (window.KEYPILOT_DEBUG) {
        console.warn('[KeyPilot] applyCaretSelection failed:', error);
      }
      return null;
    }
  }

  /**
   * Update character-level selection to the current position.
   * Fast path only: native caret APIs (like browser drag-select).
   * The legacy full-document rectangle character scan is intentionally not used
   * on the mousemove path — it freezes complex pages.
   *
   * @param {Object} currentPosition - Current position {x, y} in viewport coordinates
   * @param {Object} startPosition - Start position {x, y} in viewport coordinates  
   * @param {Function} findTextNodeAtPosition - Function to find text node at position
   * @param {Function} getTextOffsetAtPosition - Function to get text offset at position
   */
  updateCharacterSelection(currentPosition, startPosition, findTextNodeAtPosition, getTextOffsetAtPosition) {
    if (!currentPosition || typeof currentPosition.x !== 'number' || typeof currentPosition.y !== 'number') {
      return false;
    }

    // Drop detached start nodes (page re-render) so we can re-seed cleanly
    if (this.characterStartTextNode && !this.characterStartTextNode.isConnected) {
      this.characterSelectionActive = false;
      this.characterStartTextNode = null;
      this.characterStartOffset = 0;
    }

    if (!this.characterSelectionActive || !this.characterStartTextNode) {
      // Late start: first press was not on text, or start node went away.
      // Prefer caret API only (cheap). Avoid findTextNode TreeWalker on the hot path.
      const caret = this.resolveCaretAtPoint(currentPosition.x, currentPosition.y, document);
      if (caret?.textNode) {
        if (!this.rectOriginDocumentPoint && startPosition) {
          this.ensureRectOriginDocumentPoint(startPosition);
        } else if (!this.rectOriginDocumentPoint) {
          this.ensureRectOriginDocumentPoint(currentPosition);
        }
        this.characterSelectionActive = true;
        this.characterStartPosition = { ...currentPosition };
        this.characterStartTextNode = caret.textNode;
        this.characterStartOffset = caret.offset;
      } else {
        // Still draw guide rect from origin → cursor while hunting for text
        const originVp = this.getOriginViewportPoint() || startPosition;
        if (originVp) {
          this.updateHighlightRectangleOverlay(originVp, currentPosition);
        }
        return false;
      }
    }

    try {
      // Guide rect always uses document-anchored origin (scroll-stable).
      const originVp = this.getOriginViewportPoint() || startPosition;
      if (originVp) {
        this.updateHighlightRectangleOverlay(originVp, currentPosition);
      }

      const ownerDocument = this.characterStartTextNode.ownerDocument || document;
      const startCaret = {
        textNode: this.characterStartTextNode,
        offset: this.characterStartOffset
      };

      // Prefer native caret resolution at the live cursor (O(1))
      let endCaret = null;
      if (FEATURE_FLAGS.USE_NATIVE_SELECTION_API !== false) {
        endCaret = this.resolveCaretAtPoint(currentPosition.x, currentPosition.y, ownerDocument);
      }

      // Keep last good selection when cursor is between text nodes.
      // Do NOT call findTextNodeAtPosition here — it TreeWalks and freezes pages.
      if (!endCaret) {
        return true;
      }

      // Native Selection paint only — custom blue overlays thrash the main thread
      // (create/destroy dozens of nodes + IO observe on every move/scroll).
      const selection = this.applyCaretSelection(startCaret, endCaret);
      if (selection && window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Character selection updated (caret path):', {
          selectedText: selection.toString().substring(0, 100),
          rangeCount: selection.rangeCount,
          usedNativeCaret: true
        });
      }

      return true;
    } catch (error) {
      console.error('[KeyPilot] Error updating character selection:', error);
      return false;
    }
  }

  /**
   * Rectangle / intelligent selection: caret at origin → caret at current (browser drag semantics).
   * Origin caret is stored as node+offset (scroll-stable). Free end follows the mouse viewport.
   * Rectangle overlay is always document-anchored and safe to refresh during scroll.
   * @param {Object} startPosition - {x, y} viewport at press (seed only)
   * @param {Object} currentPosition - {x, y} viewport (live cursor)
   * @param {Function} [findTextNodeAtPosition]
   * @param {Function} [getTextOffsetAtPosition]
   * @returns {Selection|null}
   */
  updateRectangleSelectionFromCarets(startPosition, currentPosition, findTextNodeAtPosition, getTextOffsetAtPosition) {
    if (!currentPosition) return null;

    try {
      if (startPosition) {
        this.ensureRectOriginDocumentPoint(startPosition);
      }
      this.updateHighlightRectangleOverlay(startPosition, currentPosition);

      const ownerDocument = document;
      let startCaret = this.rectangleStartCaret;
      let endCaret = null;

      // Resolve / refresh start caret once (or if node detached after DOM change)
      const startNodeGone = startCaret?.textNode && !startCaret.textNode.isConnected;
      if (!startCaret || startNodeGone) {
        const originVp = this.getOriginViewportPoint() || startPosition;
        if (originVp) {
          if (FEATURE_FLAGS.USE_NATIVE_SELECTION_API !== false) {
            startCaret = this.resolveCaretAtPoint(originVp.x, originVp.y, ownerDocument);
          }
          if (!startCaret && typeof findTextNodeAtPosition === 'function') {
            const textNode = findTextNodeAtPosition(originVp.x, originVp.y);
            if (textNode && typeof getTextOffsetAtPosition === 'function') {
              const offset = getTextOffsetAtPosition(textNode, originVp.x, originVp.y);
              if (typeof offset === 'number' && offset >= 0) {
                startCaret = { textNode, offset };
              }
            }
          }
          if (startCaret) {
            this.rectangleStartCaret = startCaret;
          }
        }
      }

      if (FEATURE_FLAGS.USE_NATIVE_SELECTION_API !== false) {
        endCaret = this.resolveCaretAtPoint(currentPosition.x, currentPosition.y, ownerDocument);
      }

      if (!endCaret && typeof findTextNodeAtPosition === 'function') {
        const textNode = findTextNodeAtPosition(currentPosition.x, currentPosition.y);
        if (textNode && typeof getTextOffsetAtPosition === 'function') {
          const offset = getTextOffsetAtPosition(textNode, currentPosition.x, currentPosition.y);
          if (typeof offset === 'number' && offset >= 0) {
            endCaret = { textNode, offset };
          }
        }
      }

      if (!startCaret || !endCaret) {
        return null;
      }

      // Native Selection paint only (no custom per-rect overlays on hot path).
      return this.applyCaretSelection(startCaret, endCaret);
    } catch (error) {
      console.warn('[KeyPilot] Error updating rectangle selection from carets:', error);
      return null;
    }
  }

  /**
   * Element-granularity rectangle selection: find semantic HTML elements that
   * intersect the drag rect; deepest match wins when both ancestor+descendant hit.
   * @param {Object} startPosition - {x, y} viewport (seed)
   * @param {Object} currentPosition - {x, y} viewport (live)
   * @returns {Element[]}
   */
  updateElementRectangleSelection(startPosition, currentPosition) {
    if (!currentPosition) {
      this.elementMatchedElements = [];
      this.clearHighlightSelectionOverlays();
      return [];
    }

    try {
      if (startPosition) {
        this.ensureRectOriginDocumentPoint(startPosition);
      }
      this.updateHighlightRectangleOverlay(startPosition, currentPosition);

      const rect = this.computeViewportRectFromOriginAndCursor(currentPosition);
      if (!rect || rect.width < (RECTANGLE_SELECTION.MIN_WIDTH || 3)
          || rect.height < (RECTANGLE_SELECTION.MIN_HEIGHT || 3)) {
        this.elementMatchedElements = [];
        this.clearHighlightSelectionOverlays();
        return [];
      }

      const matched = this.findSemanticElementsIntersectingRect(rect);
      this.elementMatchedElements = matched;
      this.paintElementSelectionOverlays(matched);
      return matched;
    } catch (error) {
      console.warn('[KeyPilot] Error updating element rectangle selection:', error);
      this.elementMatchedElements = [];
      return [];
    }
  }

  /**
   * Current dashed-rect bounds in viewport coordinates (from document-anchored origin).
   * @returns {{ left: number, top: number, width: number, height: number, right: number, bottom: number }|null}
   */
  getCurrentHighlightRectangleViewportBounds() {
    if (!this.rectOriginDocumentPoint) return null;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const originVp = {
      x: this.rectOriginDocumentPoint.x - scrollX,
      y: this.rectOriginDocumentPoint.y - scrollY
    };

    // Free end: last mouse is applied via overlay; derive from overlay DOM if present.
    let freeX = originVp.x;
    let freeY = originVp.y;
    if (this.highlightRectangleOverlay && this.highlightRectangleOverlay.style.display !== 'none') {
      try {
        const r = this.highlightRectangleOverlay.getBoundingClientRect();
        if (r.width > 0 || r.height > 0) {
          return {
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            right: r.right,
            bottom: r.bottom
          };
        }
      } catch { /* fall through */ }
    }

    // Fallback: use stored rectOriginPoint vs nothing useful
    if (this.rectOriginPoint) {
      freeX = this.rectOriginPoint.x;
      freeY = this.rectOriginPoint.y;
    }
    const left = Math.min(originVp.x, freeX);
    const top = Math.min(originVp.y, freeY);
    const right = Math.max(originVp.x, freeX);
    const bottom = Math.max(originVp.y, freeY);
    return {
      left,
      top,
      width: right - left,
      height: bottom - top,
      right,
      bottom
    };
  }

  /**
   * @param {{ left: number, top: number, right: number, bottom: number, width: number, height: number }} rect
   * @param {Object} currentPosition - live cursor for free end if overlay unavailable
   * @returns {{ left: number, top: number, right: number, bottom: number, width: number, height: number }|null}
   */
  computeViewportRectFromOriginAndCursor(currentPosition) {
    if (!this.rectOriginDocumentPoint || !currentPosition) return null;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const ox = this.rectOriginDocumentPoint.x - scrollX;
    const oy = this.rectOriginDocumentPoint.y - scrollY;
    const left = Math.min(ox, currentPosition.x);
    const top = Math.min(oy, currentPosition.y);
    const right = Math.max(ox, currentPosition.x);
    const bottom = Math.max(oy, currentPosition.y);
    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top
    };
  }

  /**
   * @param {{ left: number, top: number, right: number, bottom: number }} rect
   * @returns {Element[]}
   */
  findSemanticElementsIntersectingRect(rect) {
    if (!rect || !this._elementSelectSelector) return [];

    let candidates = [];
    try {
      candidates = Array.from(document.querySelectorAll(this._elementSelectSelector));
    } catch {
      return [];
    }

    const hits = [];
    for (const el of candidates) {
      if (!el || el.nodeType !== 1) continue;
      if (this._isKeyPilotChromeElement(el)) continue;
      let r;
      try {
        r = el.getBoundingClientRect();
      } catch {
        continue;
      }
      if (!r || (r.width <= 0 && r.height <= 0)) continue;
      if (!this._rectsIntersect(rect, r)) continue;
      hits.push(el);
    }

    return this._deepestWins(hits);
  }

  /**
   * Prefer deepest elements: drop any hit that contains another hit.
   * @param {Element[]} elements
   * @returns {Element[]}
   */
  _deepestWins(elements) {
    if (!elements || elements.length <= 1) return elements || [];
    const set = new Set(elements);
    return elements.filter((el) => {
      for (const other of set) {
        if (other === el) continue;
        try {
          if (el.contains(other)) return false;
        } catch { /* ignore */ }
      }
      return true;
    });
  }

  /**
   * @param {{ left: number, top: number, right: number, bottom: number }} a
   * @param {DOMRect|{ left: number, top: number, right: number, bottom: number }} b
   */
  _rectsIntersect(a, b) {
    return !(
      a.right < b.left ||
      a.left > b.right ||
      a.bottom < b.top ||
      a.top > b.bottom
    );
  }

  _isKeyPilotChromeElement(el) {
    try {
      if (!(el instanceof Element)) return false;
      // Do NOT include .kpv2-cursor-hidden — that class lives on <html> whenever
      // Crosshair cursor mode is on, so closest() would match every page node.
      if (el.closest?.('.kp-floating-keyboard-help, .kp-control-strip, .kp-keybindings-popover, .kp-action-config-panel')) {
        return true;
      }
      const cls = typeof el.className === 'string' ? el.className : '';
      if (cls.includes('kpv2-') || cls.includes('kp-')) {
        // Allow selecting page content that happens to use kp-; only skip our overlays.
        if (el.classList?.contains?.('kpv2-highlight-rectangle-overlay')
          || el.classList?.contains?.('kpv2-highlight-selection-overlay')
          || el.classList?.contains?.('kpv2-inspector-overlay')
          || el.classList?.contains?.('kpv2-inspector-picked-overlay')
          || el.classList?.contains?.('kpv2-inspector-union-overlay')) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Paint blue selection overlays for matched elements (not caret Selection).
   * @param {Element[]} elements
   */
  paintElementSelectionOverlays(elements) {
    this.clearHighlightSelectionOverlays();
    const list = Array.isArray(elements) ? elements : [];
    let created = 0;
    const MAX = 80;
    for (const el of list) {
      if (created >= MAX) break;
      if (!el?.isConnected) continue;
      let rect;
      try {
        rect = el.getBoundingClientRect();
      } catch {
        continue;
      }
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;
      const overlay = this.createElement('div', {
        className: 'kpv2-highlight-selection-overlay',
        style: `
          position: fixed;
          left: ${rect.left}px;
          top: ${rect.top}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          background: ${COLORS.HIGHLIGHT_SELECTION_BG};
          border: 1px solid ${COLORS.HIGHLIGHT_SELECTION_BORDER};
          pointer-events: none;
          z-index: ${Z_INDEX.HIGHLIGHT_SELECTION};
          box-sizing: border-box;
        `
      });
      try {
        document.body.appendChild(overlay);
        this.highlightSelectionOverlays.push(overlay);
        if (this.overlayObserver) this.overlayObserver.observe(overlay);
        created += 1;
      } catch { /* ignore */ }
    }
  }

  /**
   * @returns {Element[]}
   */
  getMatchedElements() {
    return (this.elementMatchedElements || []).filter((el) => el && el.isConnected);
  }

  /**
   * Clear element-match state (does not clear dashed rect unless caller does).
   */
  clearElementSelection() {
    this.elementMatchedElements = [];
    this.clearHighlightSelectionOverlays();
  }

  /**
   * Reposition highlight rectangle + selection overlays after scroll without a mouse move.
   * Origin stays document-anchored; free end uses last known viewport mouse.
   * @param {Object} currentViewportMouse - {x,y}
   * @param {Function} [findTextNodeAtPosition]
   * @param {Function} [getTextOffsetAtPosition]
   * @returns {Selection|null|boolean}
   */
  syncSelectionToScroll(currentViewportMouse, findTextNodeAtPosition, getTextOffsetAtPosition) {
    if (!currentViewportMouse || !this.rectOriginDocumentPoint) {
      // Still try character path if active without rect seed
      if (this.characterSelectionActive && this.characterStartTextNode) {
        return this.updateCharacterSelection(
          currentViewportMouse,
          this.getOriginViewportPoint(),
          findTextNodeAtPosition,
          getTextOffsetAtPosition
        );
      }
      return null;
    }

    if (this.selectionMode === 'character' || this.characterSelectionActive) {
      return this.updateCharacterSelection(
        currentViewportMouse,
        this.getOriginViewportPoint(),
        findTextNodeAtPosition,
        getTextOffsetAtPosition
      );
    }

    if (this.selectionMode === 'element') {
      return this.updateElementRectangleSelection(
        this.getOriginViewportPoint(),
        currentViewportMouse
      );
    }

    return this.updateRectangleSelectionFromCarets(
      this.getOriginViewportPoint(),
      currentViewportMouse,
      findTextNodeAtPosition,
      getTextOffsetAtPosition
    );
  }

  /**
   * Create a character selection constrained to rectangle bounds
   * @param {Object} rectBounds - Rectangle bounds {left, top, right, bottom} in document coordinates
   * @returns {Selection|null} - Browser selection object or null
   */
  createRectangleConstrainedCharacterSelection(rectBounds) {
    try {
      const ownerDocument = this.characterStartTextNode.ownerDocument || document;
      const selection = this.getSelectionForDocument(ownerDocument);
      
      if (!selection) {
        return null;
      }

      // Clear existing selection
      selection.removeAllRanges();

      // Find the first and last character positions within the rectangle
      const { startPosition, endPosition } = this.findRectangleBoundaryPositions(rectBounds);
      
      if (!startPosition || !endPosition) {
        if (window.KEYPILOT_DEBUG) {
          console.log('[KeyPilot Debug] No valid start/end positions found in rectangle');
        }
        return selection;
      }

      // Create a single range from start to end position
      const range = ownerDocument.createRange();
      range.setStart(startPosition.textNode, startPosition.offset);
      range.setEnd(endPosition.textNode, endPosition.offset);

      selection.addRange(range);

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Rectangle character selection created:', {
          startText: startPosition.textNode.textContent?.substring(startPosition.offset, startPosition.offset + 10),
          endText: endPosition.textNode.textContent?.substring(Math.max(0, endPosition.offset - 10), endPosition.offset),
          selectedText: selection.toString().substring(0, 100)
        });
      }

      return selection;
    } catch (error) {
      console.error('[KeyPilot] Error creating rectangle-constrained character selection:', error);
      return null;
    }
  }

  /**
   * Find the first and last character positions within the rectangle bounds
   * @param {Object} rectBounds - Rectangle bounds in document coordinates
   * @returns {Object} - {startPosition, endPosition} with textNode and offset
   */
  findRectangleBoundaryPositions(rectBounds) {
    let startPosition = null;
    let endPosition = null;

    try {
      // Find all text nodes that intersect with the rectangle
      const intersectingTextNodes = this.findTextNodesForHighlighting(rectBounds);
      
      if (intersectingTextNodes.length === 0) {
        return { startPosition: null, endPosition: null };
      }

      // Sort text nodes by document position
      intersectingTextNodes.sort((a, b) => {
        const comparison = a.compareDocumentPosition(b);
        if (comparison & Node.DOCUMENT_POSITION_FOLLOWING) {
          return -1; // a comes before b
        } else if (comparison & Node.DOCUMENT_POSITION_PRECEDING) {
          return 1; // a comes after b
        }
        return 0;
      });

      // Find the first character in the rectangle (topmost, leftmost)
      for (const textNode of intersectingTextNodes) {
        const firstCharOffset = this.findFirstCharacterInRectangle(textNode, rectBounds);
        if (firstCharOffset !== -1) {
          startPosition = { textNode, offset: firstCharOffset };
          break;
        }
      }

      // Find the last character in the rectangle (bottommost, rightmost)
      for (let i = intersectingTextNodes.length - 1; i >= 0; i--) {
        const textNode = intersectingTextNodes[i];
        const lastCharOffset = this.findLastCharacterInRectangle(textNode, rectBounds);
        if (lastCharOffset !== -1) {
          endPosition = { textNode, offset: lastCharOffset };
          break;
        }
      }

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Rectangle boundary positions:', {
          intersectingNodes: intersectingTextNodes.length,
          startPosition: startPosition ? {
            text: startPosition.textNode.textContent?.substring(0, 30),
            offset: startPosition.offset
          } : null,
          endPosition: endPosition ? {
            text: endPosition.textNode.textContent?.substring(0, 30),
            offset: endPosition.offset
          } : null
        });
      }

      return { startPosition, endPosition };
    } catch (error) {
      console.error('[KeyPilot] Error finding rectangle boundary positions:', error);
      return { startPosition: null, endPosition: null };
    }
  }

  /**
   * Find the first character in a text node that falls within the rectangle
   * @param {Text} textNode - Text node to search
   * @param {Object} rectBounds - Rectangle bounds in document coordinates
   * @returns {number} - Character offset or -1 if none found
   */
  findFirstCharacterInRectangle(textNode, rectBounds) {
    const text = textNode.textContent;
    if (!text) return -1;

    for (let i = 0; i < text.length; i++) {
      if (this.isCharacterInRectangle(textNode, i, rectBounds)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Find the last character in a text node that falls within the rectangle
   * @param {Text} textNode - Text node to search
   * @param {Object} rectBounds - Rectangle bounds in document coordinates
   * @returns {number} - Character offset + 1 (for range end) or -1 if none found
   */
  findLastCharacterInRectangle(textNode, rectBounds) {
    const text = textNode.textContent;
    if (!text) return -1;

    for (let i = text.length - 1; i >= 0; i--) {
      if (this.isCharacterInRectangle(textNode, i, rectBounds)) {
        return i + 1; // Return offset + 1 for range end position
      }
    }
    return -1;
  }



  /**
   * Find text nodes that intersect with the rectangle
   * @param {Object} rectBounds - Rectangle bounds in document coordinates
   * @returns {Text[]} - Array of intersecting text nodes
   */
  // =============================================================================
  // VISUAL HIGHLIGHTING - Text node finding functions
  // These functions are specifically for visual highlighting that shows green
  // rectangles over text for UI feedback (not actual text selections)
  // =============================================================================

  /**
   * VISUAL HIGHLIGHTING: Finds text nodes for displaying highlight rectangles
   * Used by updateHighlightOverlay() to show green rectangles over text for UI feedback
   * @param {Object} rectBounds - Rectangle bounds with left, top, right, bottom properties
   * @returns {Array} - Array of text nodes that intersect with the rectangle
   */
  findTextNodesForHighlighting(rectBounds) {
    const textNodes = [];
    
    try {
      // Use TreeWalker to find all text nodes in the document
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Skip empty text nodes
            if (!node.textContent || !node.textContent.trim()) {
              return NodeFilter.FILTER_REJECT;
            }
            
            // Check if text node intersects with rectangle
            if (this.textNodeIntersectsRectangle(node, rectBounds)) {
              return NodeFilter.FILTER_ACCEPT;
            }
            
            return NodeFilter.FILTER_REJECT;
          }
        }
      );

      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }
    } catch (error) {
      console.warn('[KeyPilot] Error finding text nodes in rectangle:', error);
    }

    return textNodes;
  }

  /**
   * Check if a text node intersects with the rectangle
   * @param {Text} textNode - Text node to check
   * @param {Object} rectBounds - Rectangle bounds in document coordinates
   * @returns {boolean} - True if intersects
   */
  textNodeIntersectsRectangle(textNode, rectBounds) {
    try {
      const range = document.createRange();
      range.selectNodeContents(textNode);
      const rect = range.getBoundingClientRect();
      
      // Convert viewport coordinates to document coordinates
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      
      const nodeLeft = rect.left + scrollX;
      const nodeTop = rect.top + scrollY;
      const nodeRight = nodeLeft + rect.width;
      const nodeBottom = nodeTop + rect.height;
      
      // Check for intersection
      return !(nodeRight < rectBounds.left || 
               nodeLeft > rectBounds.right || 
               nodeBottom < rectBounds.top || 
               nodeTop > rectBounds.bottom);
    } catch (error) {
      console.warn('[KeyPilot] Error checking text node intersection:', error);
      return false;
    }
  }



  /**
   * Check if a character position is within rectangle bounds
   * @param {Text} textNode - Text node containing the character
   * @param {number} offset - Character offset within the text node
   * @param {Object} rectBounds - Rectangle bounds in document coordinates
   * @returns {boolean} - True if character is within bounds
   */
  isCharacterInRectangle(textNode, offset, rectBounds) {
    try {
      const range = document.createRange();
      range.setStart(textNode, offset);
      range.setEnd(textNode, Math.min(offset + 1, textNode.textContent.length));
      
      const rect = range.getBoundingClientRect();
      
      // Skip zero-size rectangles (like at end of text)
      if (rect.width === 0 && rect.height === 0) {
        return false;
      }
      
      // Convert viewport coordinates to document coordinates
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      
      const charLeft = rect.left + scrollX;
      const charTop = rect.top + scrollY;
      const charRight = charLeft + rect.width;
      const charBottom = charTop + rect.height;
      
      // Check if character center is within rectangle bounds
      const charCenterX = charLeft + rect.width / 2;
      const charCenterY = charTop + rect.height / 2;
      
      return charCenterX >= rectBounds.left && 
             charCenterX <= rectBounds.right && 
             charCenterY >= rectBounds.top && 
             charCenterY <= rectBounds.bottom;
    } catch (error) {
      console.warn('[KeyPilot] Error checking character in rectangle:', error);
      return false;
    }
  }

  /**
   * Read selected text without tearing down session state.
   * Use before async clipboard so highlight mode can exit cleanly first.
   * @returns {string}
   */
  peekCharacterSelectedText() {
    try {
      const selection = window.getSelection();
      return selection ? (selection.toString() || '') : '';
    } catch {
      return '';
    }
  }

  /**
   * Complete character selection and return the selected text
   * @returns {string|null} - Selected text or null if no selection
   */
  completeCharacterSelection() {
    try {
      const selectedText = this.peekCharacterSelectedText();
      
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Character selection completed:', {
          selectedText: selectedText.substring(0, 100),
          length: selectedText.length,
          wasActive: this.characterSelectionActive
        });
      }

      return selectedText;
    } catch (error) {
      console.error('[KeyPilot] Error completing character selection:', error);
      return null;
    } finally {
      // Full teardown so the next H session starts clean
      this.clearCharacterSelection();
    }
  }

  /**
   * Clear the current character selection without completing it
   */
  clearCharacterSelection() {
    try {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
      this.clearHighlightSelectionOverlays();
      // Hide dashed guide without going through hide→reset→resetCharacter loops twice
      if (this.highlightRectangleOverlay) {
        this.highlightRectangleOverlay.style.display = 'none';
      }
      this.hideDebugHUD?.();
    } catch (error) {
      console.warn('[KeyPilot] Error clearing character selection:', error);
    } finally {
      // Always reset flags — previously leave-active state caused bad re-entry
      this.resetCharacterSelection();
    }
  }

  /**
   * Reset character selection state
   */
  resetCharacterSelection() {
    this.characterSelectionActive = false;
    this.characterStartPosition = null;
    this.characterStartTextNode = null;
    this.characterStartOffset = 0;

    // Also reset rectangle state since character selection uses rectangle overlay
    this.resetRectangleSelection();

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Character selection state reset');
    }
  }

  /**
   * Compare the document positions of two text nodes
   * @param {Text} node1 - First text node
   * @param {Text} node2 - Second text node
   * @returns {number} - Negative if node1 comes before node2, positive if after, 0 if same
   */
  compareTextNodePositions(node1, node2) {
    if (node1 === node2) {
      return 0;
    }

    try {
      const comparison = node1.compareDocumentPosition(node2);
      
      if (comparison & Node.DOCUMENT_POSITION_FOLLOWING) {
        return -1; // node1 comes before node2
      } else if (comparison & Node.DOCUMENT_POSITION_PRECEDING) {
        return 1; // node1 comes after node2
      } else {
        return 0; // Same position (shouldn't happen)
      }
    } catch (error) {
      console.warn('[KeyPilot] Error comparing text node positions:', error);
      return 0;
    }
  }

  /**
   * Get selection object for the given document context
   * @param {Document} ownerDocument - Document context
   * @returns {Selection|null} - Selection object or null
   */
  getSelectionForDocument(ownerDocument) {
    try {
      if (ownerDocument && ownerDocument.getSelection) {
        return ownerDocument.getSelection();
      }
      return window.getSelection();
    } catch (error) {
      console.warn('[KeyPilot] Error getting selection for document:', error);
      return window.getSelection();
    }
  }

  /**
   * Reset rectangle selection state
   */
  resetRectangleSelection() {
    this.rectOriginPoint = null;
    this.rectOriginDocumentPoint = null;
    this.rectangleStartCaret = null;
    this.elementMatchedElements = [];
    this.debugUpdateCount = 0;

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Rectangle selection state reset');
    }

    // Hide debug HUD when selection ends
    this.hideDebugHUD();
  }

  /**
   * Toggle debug HUD feature flag
   */
  toggleDebugHUD(enabled) {
    // Temporarily override the feature flag
    FEATURE_FLAGS.DEBUG_RECTANGLE_HUD = enabled;

    if (!enabled) {
      this.hideDebugHUD();
    }

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Debug HUD toggled:', enabled);
    }
  }



  /**
   * Create or show the debug HUD for rectangle selection
   */
  showDebugHUD() {
    // Enable debug HUD if KEYPILOT_DEBUG is true or feature flag is enabled
    if (!FEATURE_FLAGS.DEBUG_RECTANGLE_HUD && !window.KEYPILOT_DEBUG) {
      return;
    }

    if (this.debugHUD) {
      this.debugHUD.style.display = 'block';
      return;
    }

    this.debugHUD = this.createElement('div', {
      className: 'kpv2-rectangle-debug-hud',
      style: `
        position: fixed;
        top: 10px;
        left: 10px;
        background: rgba(0, 0, 0, 0.9);
        color: #00ff00;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        padding: 15px;
        border-radius: 8px;
        z-index: ${Z_INDEX.DEBUG_HUD};
        pointer-events: none;
        white-space: pre-line;
        min-width: 400px;
        max-width: 500px;
        border: 2px solid #00ff00;
        box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
      `
    });

    document.body.appendChild(this.debugHUD);

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Debug HUD created and shown');
    }
  }

  /**
   * Hide the debug HUD
   */
  hideDebugHUD() {
    if (this.debugHUD) {
      this.debugHUD.style.display = 'none';

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Debug HUD hidden');
      }
    }
  }

  /**
   * Update the debug HUD with current rectangle information
   */
  updateDebugHUD(rectOriginPoint, currentPosition, rectOriginDocumentPoint, currentDocumentPosition, calculatedValues) {
    if ((!FEATURE_FLAGS.DEBUG_RECTANGLE_HUD && !window.KEYPILOT_DEBUG) || !this.debugHUD) {
      return;
    }

    this.debugUpdateCount++;

    const timestamp = new Date().toLocaleTimeString();
    const pageInfo = {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight
    };

    const debugInfo = `🎯 RECTANGLE DEBUG HUD - Update #${this.debugUpdateCount}
⏰ Time: ${timestamp}

📍 VIEWPORT COORDINATES:
  Origin: (${rectOriginPoint?.x || 'null'}, ${rectOriginPoint?.y || 'null'})
  Current: (${currentPosition?.x || 'null'}, ${currentPosition?.y || 'null'})
  Delta: (${currentPosition && rectOriginPoint ? currentPosition.x - rectOriginPoint.x : 'null'}, ${currentPosition && rectOriginPoint ? currentPosition.y - rectOriginPoint.y : 'null'})

📄 DOCUMENT COORDINATES:
  Origin: (${rectOriginDocumentPoint?.x || 'null'}, ${rectOriginDocumentPoint?.y || 'null'})
  Current: (${currentDocumentPosition?.x || 'null'}, ${currentDocumentPosition?.y || 'null'})
  Delta: (${currentDocumentPosition && rectOriginDocumentPoint ? currentDocumentPosition.x - rectOriginDocumentPoint.x : 'null'}, ${currentDocumentPosition && rectOriginDocumentPoint ? currentDocumentPosition.y - rectOriginDocumentPoint.y : 'null'})

📏 CALCULATED RECTANGLE:
  Document Left: ${calculatedValues?.documentLeft || 'null'}
  Document Top: ${calculatedValues?.documentTop || 'null'}
  Width: ${calculatedValues?.width || 'null'}
  Height: ${calculatedValues?.height || 'null'}
  Viewport Left: ${calculatedValues?.viewportLeft || 'null'}
  Viewport Top: ${calculatedValues?.viewportTop || 'null'}
  Quadrant: ${calculatedValues?.quadrant || 'null'}

🌐 PAGE CONTEXT:
  Scroll: (${pageInfo.scrollX}, ${pageInfo.scrollY})
  Viewport: ${pageInfo.innerWidth} × ${pageInfo.innerHeight}
  Document: ${pageInfo.documentWidth} × ${pageInfo.documentHeight}

📐 RECTANGLE INFO:
  Area: ${(calculatedValues?.width * calculatedValues?.height) || 0}px²
  Min Width: ${RECTANGLE_SELECTION.MIN_WIDTH}px
  Min Height: ${RECTANGLE_SELECTION.MIN_HEIGHT}px
  Min Drag: ${RECTANGLE_SELECTION.MIN_DRAG_DISTANCE}px

🔧 OVERLAY CALLS:
  Position: left=${calculatedValues?.viewportLeft}px, top=${calculatedValues?.viewportTop}px
  Size: width=${calculatedValues?.width}px, height=${calculatedValues?.height}px
  Drag Distance: ${Math.sqrt((currentDocumentPosition?.x - rectOriginDocumentPoint?.x) ** 2 + (currentDocumentPosition?.y - rectOriginDocumentPoint?.y) ** 2).toFixed(1)}px
  Should Show: ${this.shouldShowRectangle(calculatedValues?.width, calculatedValues?.height, currentDocumentPosition?.x - rectOriginDocumentPoint?.x, currentDocumentPosition?.y - rectOriginDocumentPoint?.y)}
  Display: ${this.shouldShowRectangle(calculatedValues?.width, calculatedValues?.height, currentDocumentPosition?.x - rectOriginDocumentPoint?.x, currentDocumentPosition?.y - rectOriginDocumentPoint?.y) ? 'block' : 'none'}
  Visibility: ${this.shouldShowRectangle(calculatedValues?.width, calculatedValues?.height, currentDocumentPosition?.x - rectOriginDocumentPoint?.x, currentDocumentPosition?.y - rectOriginDocumentPoint?.y) ? 'visible' : 'hidden'}`;

    this.debugHUD.textContent = debugInfo;
  }

  /**
   * Update selection overlays to highlight the actual selected text regions with shadow DOM support
   * @param {Selection} selection - Browser Selection object
   */
  updateHighlightSelectionOverlays(selection) {
    // Clear existing selection overlays
    this.clearHighlightSelectionOverlays();

    if (!selection || selection.rangeCount === 0) {
      return;
    }

    try {
      // Cap overlays so huge selections cannot create thousands of DOM nodes per frame
      // (main-thread freeze). Browser native selection paint still shows the text.
      const MAX_SELECTION_OVERLAY_RECTS = 80;
      let created = 0;

      for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        created += this.createSelectionOverlaysForRangeWithShadowSupport(range, MAX_SELECTION_OVERLAY_RECTS - created);
        if (created >= MAX_SELECTION_OVERLAY_RECTS) break;
      }

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Updated highlight selection overlays with shadow DOM support:', {
          rangeCount: selection.rangeCount,
          overlayCount: this.highlightSelectionOverlays.length,
          selectedText: selection.toString().substring(0, 50)
        });
      }
    } catch (error) {
      console.warn('[KeyPilot] Error updating highlight selection overlays with shadow DOM support:', error);
      this.clearHighlightSelectionOverlays();
    }
  }

  /**
   * Create selection overlays for a specific range with shadow DOM support
   * @param {Range} range - DOM Range object
   * @param {number} [maxRects=80] - Max client rects to materialize as overlay nodes
   * @returns {number} - Number of overlays created
   */
  createSelectionOverlaysForRangeWithShadowSupport(range, maxRects = 80) {
    if (!range || range.collapsed) {
      return 0;
    }

    let created = 0;
    try {
      // Get all rectangles for the range (handles multi-line selections)
      const rects = this.getClientRectsWithShadowSupport(range);
      const limit = Math.max(0, maxRects);

      for (let i = 0; i < rects.length && created < limit; i++) {
        const rect = rects[i];

        // Skip zero-width or zero-height rectangles
        if (rect.width <= 0 || rect.height <= 0) {
          continue;
        }

        // Create overlay element for this rectangle
        const overlay = this.createElement('div', {
          className: 'kpv2-highlight-selection-overlay',
          style: `
            position: fixed;
            left: ${rect.left}px;
            top: ${rect.top}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            background: ${COLORS.HIGHLIGHT_SELECTION_BG};
            border: 1px solid ${COLORS.HIGHLIGHT_BLUE};
            pointer-events: none;
            z-index: ${Z_INDEX.OVERLAYS_BELOW};
            will-change: transform;
            opacity: 0.7;
          `
        });

        // Append to main document body (overlays should always be in main document)
        document.body.appendChild(overlay);
        this.highlightSelectionOverlays.push(overlay);
        created++;

        // Start observing the overlay for visibility optimization
        if (this.overlayObserver) {
          this.overlayObserver.observe(overlay);
        }
      }

      if (window.KEYPILOT_DEBUG && rects.length > 0) {
        console.log('[KeyPilot Debug] Created selection overlays for range with shadow DOM support:', {
          rectCount: rects.length,
          created,
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
    return created;
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
   * Create highlight selection overlay for a range (legacy method for compatibility)
   */
  createHighlightSelectionOverlay(range) {
    // Delegate to the shadow DOM-aware method
    this.createSelectionOverlaysForRangeWithShadowSupport(range);
  }

  /**
   * Clear all highlight selection overlays
   */
  clearHighlightSelectionOverlays() {
    this.highlightSelectionOverlays.forEach(overlay => {
      if (this.overlayObserver) {
        this.overlayObserver.unobserve(overlay);
      }
      overlay.remove();
    });
    this.highlightSelectionOverlays = [];

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Cleared highlight selection overlays');
    }
  }

  /**
   * Show companion instruction overlay while selection is active.
   * @param {{ finishKey?: string }} [opts] - physical key to press again (e.g. "H" or "Y")
   */
  showHighlightModeIndicator(opts = {}) {
    const finishKeyRaw = opts.finishKey || (this.selectionMode === 'character' ? 'H' : 'Y');
    const finishKey = String(finishKeyRaw).toUpperCase();
    const modeText = `Press ${finishKey} again to finish selection`;

    if (this.highlightModeIndicator) {
      this.highlightModeIndicator.textContent = modeText;
      this.highlightModeIndicator.style.display = 'block';
      return;
    }

    this.highlightModeIndicator = this.createElement('div', {
      className: 'kpv2-highlight-mode-indicator',
      style: `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${COLORS.HIGHLIGHT_BLUE};
        color: white;
        padding: 10px 14px;
        font-size: 14px;
        font-weight: bold;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        border-radius: 6px;
        box-shadow: 0 2px 10px ${COLORS.HIGHLIGHT_SHADOW};
        z-index: ${Z_INDEX.MESSAGE_BOX};
        pointer-events: none;
        will-change: transform, opacity;
        animation: kpv2-pulse 1.5s ease-in-out infinite;
        letter-spacing: 0.01em;
      `
    });

    this.highlightModeIndicator.textContent = modeText;
    document.body.appendChild(this.highlightModeIndicator);

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Highlight mode indicator shown:', modeText);
    }
  }

  /**
   * Hide highlight mode indicator
   */
  hideHighlightModeIndicator() {
    if (this.highlightModeIndicator) {
      this.highlightModeIndicator.remove();
      this.highlightModeIndicator = null;

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Highlight mode indicator hidden');
      }
    }
  }

  /**
   * Set overlay visibility
   */
  setOverlayVisibility(overlayType, isVisible) {
    if (overlayType === 'highlight' && this.highlightOverlay) {
      this.overlayVisibility.highlight = isVisible;
      this.highlightOverlay.style.visibility = isVisible ? 'visible' : 'hidden';
    } else if (overlayType === 'highlightRectangle' && this.highlightRectangleOverlay) {
      this.overlayVisibility.highlightRectangle = isVisible;
      this.highlightRectangleOverlay.style.visibility = isVisible ? 'visible' : 'hidden';
    }
  }

  /**
   * Clean up all highlight overlays and resources
   */
  cleanup() {
    // Clean up highlight overlays
    if (this.highlightOverlay) {
      this.highlightOverlay.remove();
      this.highlightOverlay = null;
    }
    if (this.highlightRectangleOverlay) {
      this.highlightRectangleOverlay.remove();
      this.highlightRectangleOverlay = null;
    }

    // Clear highlight selection overlays
    this.clearHighlightSelectionOverlays();

    if (this.highlightModeIndicator) {
      this.highlightModeIndicator.remove();
      this.highlightModeIndicator = null;
    }

    // Clean up debug HUD
    if (this.debugHUD) {
      this.debugHUD.remove();
      this.debugHUD = null;
    }

    // Reset selection states
    this.resetCharacterSelection();
    this.resetRectangleSelection();

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] HighlightManager cleanup completed');
    }
  }
}