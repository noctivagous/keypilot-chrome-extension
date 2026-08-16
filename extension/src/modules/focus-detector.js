/**
 * Text field focus detection and management
 */
import { CSS_CLASSES } from '../config/constants.js';
import {
  kpIsTypingContext,
  kpGetDeepActiveElement,
  kpGetComposedEventTarget
} from '../utils/dom-context.js';

export class FocusDetector {
  constructor(stateManager, mouseCoordinateManager = null) {
    this.state = stateManager;
    this.mouseCoordinateManager = mouseCoordinateManager;
    this.currentFocusedElement = null;
    this.textElementObserver = null; // MutationObserver for focused text element
    this.textElementResizeObserver = null; // ResizeObserver for focused text element
    this.documentObserver = null; // MutationObserver for document focus changes
    this._disconnectObserver = null; // MutationObserver: focused field removed from DOM
    this.rafId = null; // requestAnimationFrame ID for position tracking

    // Bound handlers so start/stop can add/remove the same function references.
    this._onFocusIn = this.handleFocusIn.bind(this);
    this._onFocusOut = this.handleFocusOut.bind(this);

    // Open-shadow fields (onboarding practice popover): focusin/focusout on
    // `document` are retargeted to the host. Moving focus between two inputs
    // in the same shadow does not re-fire on document, so we also listen on
    // the field's ShadowRoot while text mode is active.
    this._shadowFocusRoot = null;
    this._onShadowFocusIn = this.handleFocusIn.bind(this);
    this._onShadowFocusOut = this.handleFocusOut.bind(this);
  }

  start() {
    if (window.KEYPILOT_DEBUG) console.log('[KeyPilot] FocusDetector starting...');

    // Listen for focus/blur events
    document.addEventListener('focusin', this._onFocusIn, true);
    document.addEventListener('focusout', this._onFocusOut, true);

    // Set up MutationObserver for document to catch programmatic focus changes
    this.setupDocumentObserver();

    // Immediate check: google.com (and others) autofocus the search box *before*
    // our document_idle content script runs, so we never see that focusin.
    try { this.checkCurrentFocus(); } catch { /* ignore */ }

    // Follow-up checks for late autofocus / SPA replacements of the search field.
    setTimeout(() => {
      this.checkCurrentFocus();
      if (window.KEYPILOT_DEBUG) console.log('[KeyPilot] Initial focus check completed');
    }, 100);
    setTimeout(() => this.checkCurrentFocus(), 500);

    // Also check when DOM is fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        try { this.checkCurrentFocus(); } catch { /* ignore */ }
        setTimeout(() => this.checkCurrentFocus(), 100);
      });
    }

    // Check when page is fully loaded (including images, etc.)
    window.addEventListener('load', () => {
      try { this.checkCurrentFocus(); } catch { /* ignore */ }
      setTimeout(() => this.checkCurrentFocus(), 100);
    });

    // Returning to the tab: browser may restore focus without a focusin we saw.
    try {
      window.addEventListener('focus', () => {
        setTimeout(() => this.checkCurrentFocus(), 0);
      });
    } catch { /* ignore */ }
  }

  stop() {
    document.removeEventListener('focusin', this._onFocusIn, true);
    document.removeEventListener('focusout', this._onFocusOut, true);
    this._detachShadowFocusBridge();

    // Clean up observers
    this.cleanupTextElementObservers();
    this.cleanupDocumentObserver();

    // Clean up any remaining focused element reference
    if (this.currentFocusedElement) {
      this.currentFocusedElement = null;
    }
  }

  handleFocusIn(e) {
    // composedPath reaches into open shadow roots; event.target is often the host.
    const composed = kpGetComposedEventTarget(e);
    const deep = this.getDeepActiveElement();
    const candidate = this.isTextInput(composed)
      ? composed
      : (this.isTextInput(deep) ? deep : null);

    if (window.KEYPILOT_DEBUG) {
      console.log(
        '[KeyPilot] FocusIn event:',
        candidate?.tagName || e.target?.tagName,
        candidate?.type || e.target?.type || 'N/A',
        'id:',
        candidate?.id || e.target?.id || 'none'
      );
    }

    if (candidate) {
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot] Text input focused - setting text mode:', candidate.tagName, candidate.type || 'N/A');
      }
      this.setTextFocus(candidate);
    }
  }

  handleFocusOut(e) {
    const composed = kpGetComposedEventTarget(e);
    let leftText =
      this.isTextInput(composed) ||
      this.isTextInput(e.target) ||
      (this.currentFocusedElement && e.target === this.currentFocusedElement);

    // Clicking out of a same-origin editor iframe: the field lives inside the
    // canvas, but the event target is the <iframe> shell.
    if (!leftText && this.currentFocusedElement) {
      try {
        const tag = String(e.target?.tagName || '').toUpperCase();
        if (tag === 'IFRAME' || tag === 'FRAME') leftText = true;
      } catch { /* ignore */ }
    }

    if (leftText) {
      console.debug('Text input blurred:', composed?.tagName || e.target?.tagName, composed?.type || e.target?.type || 'N/A');
      if (this._clearTextFocusIfDisconnected()) return;
      // Longer delay to allow for focus changes and prevent premature clearing during slider interaction
      setTimeout(() => {
        if (this._clearTextFocusIfDisconnected()) return;
        const currentlyFocused = this.getDeepActiveElement();
        console.debug('Focus check after blur - currently focused:', currentlyFocused?.tagName, currentlyFocused?.type, currentlyFocused?.id);
        if (!this.isTextInput(currentlyFocused)) {
          console.debug('Clearing text focus - no text input currently focused');
          this.clearTextFocus();
        } else {
          // Focus moved to another text field — keep/update text mode.
          if (currentlyFocused !== this.currentFocusedElement) {
            this.setTextFocus(currentlyFocused);
          } else {
            console.debug('Keeping text focus - text input still focused');
          }
        }
      }, 100); // Increased delay to handle slider interactions
    }
  }

  checkCurrentFocus() {
    if (this._clearTextFocusIfDisconnected()) return;
    const activeElement = this.getDeepActiveElement();

    if (this.isTextInput(activeElement)) {
      if (this.currentFocusedElement !== activeElement) {
        console.debug('Text focus detected during check:', activeElement.tagName, activeElement.type || 'N/A', 'ID:', activeElement.id || 'none');
        this.setTextFocus(activeElement);
      }
    } else if (this.currentFocusedElement) {
      console.debug('Text focus cleared during check');
      this.clearTextFocus();
    }
  }

  /**
   * Text-mode field chrome is element-styled; fixed labels track via
   * OptimizedScrollManager + ResizeObserver/input/mutation observers.
   * Perpetual rAF getBoundingClientRect loops are no longer needed.
   */
  startPositionTracking() {
    this.stopPositionTracking();
    if (this.currentFocusedElement) {
      try {
        this.lastKnownRect = this.currentFocusedElement.getBoundingClientRect();
      } catch { /* ignore */ }
    }
  }

  stopPositionTracking() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
      console.debug('Position tracking stopped');
    }
  }

  setupDocumentObserver() {
    if (!window.MutationObserver) return;

    this.documentObserver = new MutationObserver((mutations) => {
      let shouldCheckFocus = false;

      mutations.forEach((mutation) => {
        // Check for focus-related attribute changes
        if (mutation.type === 'attributes') {
          const attrName = mutation.attributeName;
          // Watch for tabindex changes or other focus-related attributes
          if (attrName === 'contenteditable') {
            shouldCheckFocus = true;
          }
        }
      });

      if (shouldCheckFocus) {
        // Debounce focus checks to avoid excessive calls
        if (this.focusCheckTimeout) {
          clearTimeout(this.focusCheckTimeout);
        }
        this.focusCheckTimeout = setTimeout(() => {
          this.checkCurrentFocus();
          this.focusCheckTimeout = null;
        }, 100);
      }
    });

    // Observe the entire document for attribute changes
    this.documentObserver.observe(document, {
      attributes: true,
      attributeFilter: ['contenteditable'],
      subtree: true
    });

    console.debug('Document MutationObserver set up for focus-related changes');
  }

  cleanupDocumentObserver() {
    if (this.documentObserver) {
      this.documentObserver.disconnect();
      this.documentObserver = null;
    }

    if (this.focusCheckTimeout) {
      clearTimeout(this.focusCheckTimeout);
      this.focusCheckTimeout = null;
    }

    console.debug('Document observer cleaned up');
  }

  getDeepActiveElement() {
    return kpGetDeepActiveElement();
  }

  isTextInput(element) {
    if (!element || element.nodeType !== 1) return false;

    try {
      if (element.isConnected === false) return false;
      // KeyPilot omnibox is a text input, but we do NOT want it to trigger text focus mode.
      // Omnibox is its own overlay/mode, and entering text_focus here breaks its keyboard UX.
      if (element.classList?.contains?.(CSS_CLASSES.OMNIBOX_INPUT)) return false;
      const omniboxRoot = element.closest?.(`.${CSS_CLASSES.OMNIBOX_BACKDROP}`) || element.closest?.(`.${CSS_CLASSES.OMNIBOX_PANEL}`);
      if (omniboxRoot) return false;
      // Align with keyboard shortcut suppression (includes bare <input>, date types, etc.).
      return kpIsTypingContext(element);
    } catch {
      return false;
    }
  }

  _detachShadowFocusBridge() {
    const root = this._shadowFocusRoot;
    this._shadowFocusRoot = null;
    if (!root) return;
    try { root.removeEventListener('focusin', this._onShadowFocusIn, true); } catch { /* ignore */ }
    try { root.removeEventListener('focusout', this._onShadowFocusOut, true); } catch { /* ignore */ }
  }

  /**
   * Listen for focus moves that stay inside an open ShadowRoot (document
   * listeners never see those — the retargeted target stays the host).
   * @param {Element} element
   */
  _attachShadowFocusBridge(element) {
    let root = null;
    try { root = typeof element.getRootNode === 'function' ? element.getRootNode() : null; } catch { root = null; }
    const isShadow = !!(root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot);
    if (!isShadow) {
      this._detachShadowFocusBridge();
      return;
    }
    if (this._shadowFocusRoot === root) return;
    this._detachShadowFocusBridge();
    this._shadowFocusRoot = root;
    try { root.addEventListener('focusin', this._onShadowFocusIn, true); } catch { /* ignore */ }
    try { root.addEventListener('focusout', this._onShadowFocusOut, true); } catch { /* ignore */ }
  }

  setTextFocus(element) {
    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot] Setting text focus for element:', element.tagName, element.type || 'N/A');
    }

    // Update current focused element reference
    this.currentFocusedElement = element;

    this._attachShadowFocusBridge(element);

    // Set up observers for the focused text element
    this.setupTextElementObservers(element);

    // Position cursor appropriately for text focus mode
    this.positionCursorForTextFocus(element);

    // Snapshot rect; continuous rAF tracking removed (see startPositionTracking).
    this.startPositionTracking();

    // Set mode and focused element in a single state update to ensure proper cursor initialization
    this.state.setState({
      mode: 'text_focus',
      focusedTextElement: element,
      focusEl: null // Clear to ensure hasClickableElement starts as false
    });
  }

  /**
   * Position cursor for text focus mode
   * Uses stored coordinates if available, otherwise positions underneath the text field
   * @param {Element} element - The focused text element
   */
  positionCursorForTextFocus(element) {
    if (!element || !this.mouseCoordinateManager) {
      return;
    }

    // Try to get stored coordinates first
    const storedCoordinates = this.mouseCoordinateManager.lastStoredCoordinates;
    
    if (storedCoordinates) {
      // Use stored coordinates if available and valid
      const x = Math.min(storedCoordinates.x, window.innerWidth - 20);
      const y = Math.min(storedCoordinates.y, window.innerHeight - 20);
      const validX = Math.max(10, x);
      const validY = Math.max(10, y);
      
      this.state.setMousePosition(validX, validY);
      
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot] Positioned cursor using stored coordinates for text focus:', {
          x: validX, y: validY
        });
      }
    } else {
      // Fallback: position cursor underneath the text field
      const rect = element.getBoundingClientRect();
      const x = rect.left + (rect.width / 2);
      const y = rect.bottom + 10; // 10px below the text field
      
      // Ensure coordinates are within viewport bounds
      const validX = Math.min(Math.max(10, x), window.innerWidth - 20);
      const validY = Math.min(Math.max(10, y), window.innerHeight - 20);
      
      this.state.setMousePosition(validX, validY);
      
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot] Positioned cursor underneath text field:', {
          x: validX, y: validY, elementRect: rect
        });
      }
    }
  }

  clearTextFocus() {
    // Stop position tracking
    this.stopPositionTracking();

    this._detachShadowFocusBridge();

    // Clean up observers
    this.cleanupTextElementObservers();

    // Clear focused element reference
    this.currentFocusedElement = null;
    this.state.setState({
      mode: 'none',
      focusedTextElement: null
    });
  }

  isInTextFocus() {
    return this.state.getState().mode === 'text_focus';
  }

  getFocusedElement() {
    return this.currentFocusedElement;
  }

  /**
   * If the field that put us in text mode was removed (inspector rebuild, SPA
   * replace, etc.), blur/focusout often never fires — especially on macOS where
   * clicking Save does not move focus off the input. Exit text mode immediately.
   * @returns {boolean} true when text mode was cleared
   */
  _clearTextFocusIfDisconnected() {
    const el = this.currentFocusedElement;
    if (!el) return false;
    let connected = true;
    try { connected = el.isConnected !== false; } catch { connected = false; }
    if (connected) return false;
    this.clearTextFocus();
    return true;
  }

  setupTextElementObservers(element) {
    if (!element) return;

    // Clean up any existing observers first
    this.cleanupTextElementObservers();
    this._watchFocusedElementDisconnected(element);

    // Store initial position for comparison
    this.lastKnownRect = element.getBoundingClientRect();

    // 1. ResizeObserver for size changes
    if (window.ResizeObserver) {
      this.textElementResizeObserver = new ResizeObserver((entries) => {
        // Debounce resize updates
        if (this.resizeTimeout) {
          clearTimeout(this.resizeTimeout);
        }
        this.resizeTimeout = setTimeout(() => {
          this.triggerOverlayUpdate();
          this.resizeTimeout = null;
        }, 16); // ~60fps
      });

      // Observe the text element itself
      this.textElementResizeObserver.observe(element);
      console.debug('ResizeObserver set up for text element');
    }

    // 2. Input event listener for content changes that affect size
    this.inputEventHandler = () => {
      // Debounce input updates
      if (this.inputTimeout) {
        clearTimeout(this.inputTimeout);
      }
      this.inputTimeout = setTimeout(() => {
        console.debug('Input event detected - triggering overlay update');
        this.triggerOverlayUpdate();
        this.inputTimeout = null;
      }, 16);
    };

    element.addEventListener('input', this.inputEventHandler);
    console.debug('Input event listener set up for text element');

    // 3. MutationObserver for attribute and DOM changes
    if (window.MutationObserver) {
      this.textElementObserver = new MutationObserver((mutations) => {
        let shouldUpdate = false;

        mutations.forEach((mutation) => {
          // Watch for style and class changes that affect position/size
          if (mutation.type === 'attributes') {
            const attrName = mutation.attributeName;
            if (attrName === 'style' || attrName === 'class') {
              console.debug('MutationObserver detected attribute change:', attrName, mutation.target.tagName);
              shouldUpdate = true;
            }
            // Also watch for size-related attributes
            if (['rows', 'cols', 'width', 'height'].includes(attrName)) {
              console.debug('MutationObserver detected size attribute change:', attrName);
              shouldUpdate = true;
            }
          }

          // DOM structure changes
          if (mutation.type === 'childList') {
            console.debug('MutationObserver detected DOM structure change');
            shouldUpdate = true;
          }

          // Content changes
          if (mutation.type === 'characterData') {
            console.debug('MutationObserver detected content change');
            shouldUpdate = true;
          }
        });

        if (shouldUpdate) {
          // Debounce mutation updates
          if (this.mutationTimeout) {
            clearTimeout(this.mutationTimeout);
          }
          this.mutationTimeout = setTimeout(() => {
            this.triggerOverlayUpdate();
            this.mutationTimeout = null;
          }, 16);
        }
      });

      // Observe the element itself with comprehensive options
      this.textElementObserver.observe(element, {
        attributes: true,
        attributeOldValue: true,
        characterData: true,
        childList: true,
        subtree: true
      });

      // Observe parent elements for layout changes
      let parent = element.parentElement;
      let observedParents = 0;
      while (parent && observedParents < 2) {
        this.textElementObserver.observe(parent, {
          attributes: true,
          attributeFilter: ['style', 'class'],
          childList: true
        });
        parent = parent.parentElement;
        observedParents++;
      }

      console.debug('MutationObserver set up for element and', observedParents, 'parents');
    }

    // Position polling removed
  }

  /**
   * Watch ancestors of the focused field so removing it from the tree exits text mode.
   * @param {Element} element
   */
  _watchFocusedElementDisconnected(element) {
    if (!window.MutationObserver || !element) return;
    if (this._disconnectObserver) {
      this._disconnectObserver.disconnect();
      this._disconnectObserver = null;
    }
    let root = null;
    try { root = element.getRootNode?.() || null; } catch { root = null; }
    // Watch the *owning* document (iframe canvas, not the top wp-admin page).
    let target = null;
    try {
      if (root && root.nodeType === 9) {
        target = /** @type {Document} */ (root).documentElement || root;
      } else if (root && root !== document) {
        target = root;
      } else {
        target = document.documentElement;
      }
    } catch {
      target = document.documentElement;
    }
    if (!target || target.nodeType == null) return;

    this._disconnectObserver = new MutationObserver(() => {
      this._clearTextFocusIfDisconnected();
    });
    try {
      this._disconnectObserver.observe(target, { childList: true, subtree: true });
    } catch {
      this._disconnectObserver = null;
    }
  }

  cleanupTextElementObservers() {
    if (this._disconnectObserver) {
      this._disconnectObserver.disconnect();
      this._disconnectObserver = null;
    }

    if (this.textElementObserver) {
      this.textElementObserver.disconnect();
      this.textElementObserver = null;
    }

    if (this.textElementResizeObserver) {
      this.textElementResizeObserver.disconnect();
      this.textElementResizeObserver = null;
    }

    if (this.inputEventHandler && this.currentFocusedElement) {
      this.currentFocusedElement.removeEventListener('input', this.inputEventHandler);
      this.inputEventHandler = null;
    }

    // Stop position tracking
    this.stopPositionTracking();

    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }

    if (this.mutationTimeout) {
      clearTimeout(this.mutationTimeout);
      this.mutationTimeout = null;
    }

    if (this.inputTimeout) {
      clearTimeout(this.inputTimeout);
      this.inputTimeout = null;
    }

    console.debug('Text element observers cleaned up');
  }

  triggerOverlayUpdate() {
    // Trigger a state update to refresh overlays with current element position
    if (this.currentFocusedElement && this.state.getState().mode === 'text_focus') {
      // Force overlay update by triggering a state change
      this.state.setState({
        mode: 'text_focus',
        focusedTextElement: this.currentFocusedElement,
        _overlayUpdateTrigger: Date.now() // Unique value to force update
      });

      console.debug('Triggered overlay update for text element position/size change');
    }
  }
}