/**
 * OptimizedScrollManager — scroll lifecycle for KeyPilot chrome.
 *
 * ## Current primary path (DOM-hover element rings + element-styled text mode)
 * Focus/text chrome is painted *on* the target element, so it scrolls with the
 * page. This manager no longer:
 *   - clears element focus styling on scroll start (that caused ring flicker)
 *   - re-paints focus overlays every frame for element-styled focus
 *   - revives legacy fixed orange text-field frame overlays
 *
 * What it still does:
 *   1. Track `isScrolling` so mouse hit-testing can pause mid-scroll
 *   2. Fire `keypilot:scroll-end` so under-cursor targeting re-queries
 *   3. Live-refresh highlight selection overlays (fixed dashed rects / carets)
 *   4. Reposition fixed chrome still in use: inspector outlines, text-mode labels
 *
 * ## Future / alternate backends (canvas or DOM fixed focus rings, RBush hit-test)
 * When `overlayManager.usesElementFocusStyling()` is false, fixed focus overlays
 * are repositioned (~60fps) during scroll again. IntersectionObserver can hide
 * those fixed layers when their targets leave the viewport.
 */
export class OptimizedScrollManager {
  /**
   * @param {*} overlayManager
   * @param {*} stateManager
   * @param {{ onScrollFrame?: () => void }} [hooks] - optional live scroll hooks (e.g. highlight refresh)
   */
  constructor(overlayManager, stateManager, hooks = {}) {
    this.overlayManager = overlayManager;
    this.stateManager = stateManager;
    this.onScrollFrame = typeof hooks?.onScrollFrame === 'function' ? hooks.onScrollFrame : null;

    /** @type {boolean} */
    this.isScrolling = false;
    this.scrollTimeout = null;
    this.scrollStartTime = 0;

    /** @type {IntersectionObserver|null} */
    this.scrollObserver = null;

    /** Elements observed for fixed-overlay viewport exit (inspector / fixed focus). */
    this.scrollSensitiveElements = new Set();

    // ~60fps throttle for work that must track scroll (highlight, fixed overlays)
    this.throttledScrollHandler = this.throttle(this.handleScrollThrottled.bind(this), 16);

    this.boundScrollHandler = null;
    this.stateUnsubscribe = null;

    this.scrollMetrics = {
      scrollEvents: 0,
      overlayUpdates: 0,
      throttledCalls: 0,
      averageScrollDuration: 0
    };
  }

  init() {
    this.setupScrollObserver();
    this.setupScrollListeners();
    this.setupStateSubscription();
    this.observeCurrentStateElements();
  }

  /**
   * True when focus chrome is CSS on the element (scrolls with the page).
   * False when a fixed canvas/DOM overlay must be repositioned on scroll.
   * @returns {boolean}
   */
  _usesElementFocusStyling() {
    try {
      if (typeof this.overlayManager?.usesElementFocusStyling === 'function') {
        return !!this.overlayManager.usesElementFocusStyling();
      }
      // Fallback if OverlayManager is an older build
      return !!this.overlayManager?._useDomHoverFocusColors;
    } catch {
      return true;
    }
  }

  observeCurrentStateElements() {
    const currentState = this.stateManager?.getState?.();
    if (!currentState) return;

    // Only observe targets that drive *fixed* overlays (or fixed focus backend).
    if (!this._usesElementFocusStyling()) {
      this.observeElementForScroll(currentState.focusEl);
    }
    this.observeElementForScroll(
      currentState.inspectorEl || currentState.deleteEl || currentState.colsEl
    );
  }

  setupScrollObserver() {
    // Hide fixed overlays when their target leaves the viewport. Element-styled
    // focus rings must not be cleared here — they leave with the element.
    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target;
          if (entry.isIntersecting) {
            this.scrollSensitiveElements.add(element);
          } else {
            this.scrollSensitiveElements.delete(element);
            this.hideFixedOverlaysForElement(element);
          }
        }
      },
      {
        rootMargin: '20px',
        threshold: [0, 1.0]
      }
    );
  }

  setupScrollListeners() {
    this.boundScrollHandler = this.handleScroll.bind(this);
    // Capture: nested overflow scrollers (chat panes, etc.) bubble poorly
    document.addEventListener('scroll', this.boundScrollHandler, {
      passive: true,
      capture: true
    });
  }

  setupStateSubscription() {
    this.stateUnsubscribe = this.stateManager.subscribe((newState, prevState) => {
      const elementFocus = this._usesElementFocusStyling();

      if (newState.focusEl !== prevState.focusEl) {
        if (prevState.focusEl) this.unobserveElementForScroll(prevState.focusEl);
        // Element-styled focus does not need IO tracking for overlay hide/show.
        if (!elementFocus && newState.focusEl) {
          this.observeElementForScroll(newState.focusEl);
        }
      }

      const prevInsp = prevState.inspectorEl || prevState.deleteEl || prevState.colsEl;
      const nextInsp = newState.inspectorEl || newState.deleteEl || newState.colsEl;
      if (nextInsp !== prevInsp) {
        if (prevInsp) this.unobserveElementForScroll(prevInsp);
        if (nextInsp) this.observeElementForScroll(nextInsp);
      }
    });
  }

  handleScroll(_event) {
    this.scrollMetrics.scrollEvents++;

    if (!this.isScrolling) {
      this.isScrolling = true;
      this.scrollStartTime = performance.now();

      // Fixed focus backends only: drop a stuck ring until the throttled path
      // repositions it. Never call hideFocusOverlay in element-styling mode —
      // that clears data-kp-focus / outline mid-scroll and causes flicker.
      if (!this._usesElementFocusStyling()) {
        try {
          this.overlayManager?.hideFocusOverlay?.();
        } catch { /* ignore */ }
      }
    }

    this.throttledScrollHandler();

    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.scrollTimeout = setTimeout(() => {
      this.handleScrollEnd();
    }, 100);
  }

  handleScrollThrottled() {
    this.scrollMetrics.throttledCalls++;

    let currentState;
    try {
      currentState = this.stateManager.getState();
    } catch {
      return;
    }
    if (!currentState) return;

    const mode = currentState.mode;
    let didOverlayWork = false;

    // Highlight: dashed selection rect + carets are document-anchored fixed layers.
    if (mode === 'highlight' && this.onScrollFrame) {
      try {
        this.onScrollFrame();
        didOverlayWork = true;
      } catch {
        // Non-fatal — selection refresh must never break scroll handling
      }
    }

    // Inspector pick (Delete / Cols / …): fixed outline around the target.
    const inspectorEl =
      currentState.inspectorEl || currentState.deleteEl || currentState.colsEl;
    if (inspectorEl && inspectorEl.isConnected) {
      this._updateInspectorOverlay(inspectorEl);
      didOverlayWork = true;
    }

    // Text mode: labels are fixed-position; field chrome is on the element itself.
    if (
      mode === 'text_focus' &&
      currentState.focusedTextElement &&
      currentState.focusedTextElement.isConnected
    ) {
      try {
        this.overlayManager?.updateTextModeLabels?.(currentState.focusedTextElement);
        didOverlayWork = true;
      } catch { /* ignore */ }
    }

    // Fixed focus overlay backend (canvas / DOM rect) — not used on the primary path.
    if (
      !this._usesElementFocusStyling() &&
      currentState.focusEl &&
      currentState.focusEl.isConnected
    ) {
      try {
        this.overlayManager?.updateFocusOverlay?.(currentState.focusEl);
        didOverlayWork = true;
      } catch { /* ignore */ }
    }

    if (didOverlayWork) {
      this.scrollMetrics.overlayUpdates++;
    }
  }

  _updateInspectorOverlay(element) {
    const kind =
      this.stateManager.getState()?.inspectorKind ||
      null;
    if (typeof this.overlayManager?.updateInspectorOverlay === 'function') {
      this.overlayManager.updateInspectorOverlay(element, kind);
    } else {
      this.overlayManager?.updateDeleteOverlay?.(element);
    }
  }

  observeElementForScroll(element) {
    if (element && this.scrollObserver) {
      try {
        this.scrollObserver.observe(element);
      } catch { /* ignore */ }
      this.scrollSensitiveElements.add(element);
    }
  }

  unobserveElementForScroll(element) {
    if (element && this.scrollObserver) {
      try {
        this.scrollObserver.unobserve(element);
      } catch { /* ignore */ }
      this.scrollSensitiveElements.delete(element);
    }
  }

  /**
   * Hide fixed-position overlays for a target that left the viewport.
   * Does not clear element-styled focus rings.
   * @param {Element} element
   */
  hideFixedOverlaysForElement(element) {
    const currentState = this.stateManager.getState();
    if (!currentState) return;

    if (!this._usesElementFocusStyling() && currentState.focusEl === element) {
      try {
        this.overlayManager?.hideFocusOverlay?.();
      } catch { /* ignore */ }
    }

    const inspectorEl =
      currentState.inspectorEl || currentState.deleteEl || currentState.colsEl;
    if (inspectorEl === element) {
      try {
        if (typeof this.overlayManager?.hideInspectorOverlay === 'function') {
          this.overlayManager.hideInspectorOverlay();
        } else {
          this.overlayManager?.hideDeleteOverlay?.();
        }
      } catch { /* ignore */ }
    }
  }

  handleScrollEnd() {
    const scrollDuration = performance.now() - this.scrollStartTime;
    this.scrollMetrics.averageScrollDuration =
      (this.scrollMetrics.averageScrollDuration + scrollDuration) / 2;

    this.isScrolling = false;

    let currentState;
    try {
      currentState = this.stateManager.getState();
    } catch {
      currentState = null;
    }

    // Re-query under-cursor target after the viewport moved (mouse often still).
    if (
      currentState?.lastMouse &&
      currentState.lastMouse.x >= 0 &&
      currentState.lastMouse.y >= 0
    ) {
      try {
        document.dispatchEvent(
          new CustomEvent('keypilot:scroll-end', {
            detail: {
              mouseX: currentState.lastMouse.x,
              mouseY: currentState.lastMouse.y
            }
          })
        );
      } catch { /* ignore */ }
    }

    this.cleanupScrollObservers();
  }

  cleanupScrollObservers() {
    // Drop observers for disconnected nodes (isConnected works for open shadow).
    for (const element of [...this.scrollSensitiveElements]) {
      if (!element || !element.isConnected) {
        this.unobserveElementForScroll(element);
      }
    }
  }

  throttle(func, limit) {
    let inThrottle = false;
    return (...args) => {
      if (inThrottle) return;
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    };
  }

  getScrollMetrics() {
    const throttleRatio =
      this.scrollMetrics.scrollEvents > 0
        ? (
            (this.scrollMetrics.throttledCalls / this.scrollMetrics.scrollEvents) *
            100
          ).toFixed(1)
        : 0;

    return {
      ...this.scrollMetrics,
      throttleRatio: `${throttleRatio}%`,
      activeSensitiveElements: this.scrollSensitiveElements.size,
      isCurrentlyScrolling: this.isScrolling,
      elementFocusStyling: this._usesElementFocusStyling()
    };
  }

  cleanup() {
    if (this.scrollObserver) {
      try {
        this.scrollObserver.disconnect();
      } catch { /* ignore */ }
      this.scrollObserver = null;
    }

    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = null;
    }

    if (this.stateUnsubscribe) {
      try {
        this.stateUnsubscribe();
      } catch { /* ignore */ }
      this.stateUnsubscribe = null;
    }

    this.scrollSensitiveElements.clear();

    if (this.boundScrollHandler) {
      document.removeEventListener('scroll', this.boundScrollHandler, { capture: true });
      this.boundScrollHandler = null;
    }
  }
}
