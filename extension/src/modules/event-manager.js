/**
 * Centralized event management
 *
 * Build note: content-bundled.js concatenates modules and strips ESM imports.
 * Free functions from earlier modules (e.g. `dom-context.js`) remain in scope.
 * Never use `import { x as y }` aliases — the alias binding is deleted with the import.
 * Call free functions via distinct names (kpIsTypingContext, …) from methods so the
 * method name cannot shadow the free function after bundling.
 */
import {
  kpIsTypingContext,
  kpHasModifierKeys,
  kpGetDeepActiveElement,
  kpGetComposedEventTarget,
  kpResolveTypingTarget
} from '../utils/dom-context.js';

export class EventManager {
  constructor() {
    this.listeners = new Map();
    this.isActive = false;
  }

  start() {
    if (this.isActive) return;

    this.addListener(document, 'keydown', this.handleKeyDown.bind(this), { capture: true });

    // Single capture pointer/mouse move is enough for cursor coords + non-DOM-hover modes.
    // (Legacy triple mousemove + mouseover/enter amplified work on every pixel.)
    // Scroll is owned by OptimizedScrollManager — do not register a no-op scroll here.
    const moveOpts = { capture: true, passive: true };
    if (typeof PointerEvent !== 'undefined') {
      this.addListener(document, 'pointermove', this.handleMouseMove.bind(this), moveOpts);
    } else {
      this.addListener(document, 'mousemove', this.handleMouseMove.bind(this), moveOpts);
    }

    this.isActive = true;
  }

  stop() {
    if (!this.isActive) return;
    
    this.removeAllListeners();
    this.isActive = false;
  }

  cleanup() {
    this.stop();
    if (this.focusDetector) {
      this.focusDetector.stop();
    }
  }

  addListener(element, event, handler, options = {}) {
    // Include capture flag so capture + bubble listeners don't clobber each other.
    const capture = !!(options && (options.capture || options === true));
    const key = `${element.constructor.name}-${event}-${capture ? 'c' : 'b'}`;
    
    if (this.listeners.has(key)) {
      this.removeListenerByKey(key);
    }
    
    element.addEventListener(event, handler, options);
    this.listeners.set(key, { element, event, handler, options, capture });
  }

  removeListenerByKey(key) {
    const listener = this.listeners.get(key);
    if (listener) {
      listener.element.removeEventListener(listener.event, listener.handler, listener.options);
      this.listeners.delete(key);
    }
  }

  removeListener(element, event) {
    // Remove both capture and bubble variants for this element+event.
    for (const capture of [true, false]) {
      const key = `${element.constructor.name}-${event}-${capture ? 'c' : 'b'}`;
      this.removeListenerByKey(key);
    }
  }

  removeAllListeners() {
    for (const [_key, listener] of this.listeners) {
      listener.element.removeEventListener(listener.event, listener.handler, listener.options);
    }
    this.listeners.clear();
  }

  handleKeyDown(_e) {
    // Override in implementation
  }

  handleMouseMove(_e) {
    // Override in implementation  
  }

  handleScroll(_e) {
    // Override in implementation
  }

  /**
   * @param {EventTarget|null|undefined} target
   * @returns {boolean}
   */
  isTypingContext(target) {
    return kpIsTypingContext(target);
  }

  /**
   * @returns {Element|null}
   */
  getDeepActiveElement() {
    return kpGetDeepActiveElement();
  }

  /**
   * @param {Event|null|undefined} e
   * @returns {EventTarget|null}
   */
  getComposedEventTarget(e) {
    return kpGetComposedEventTarget(e);
  }

  /**
   * @param {Event|null|undefined} e
   * @returns {Element|null}
   */
  resolveTypingTarget(e) {
    return kpResolveTypingTarget(e);
  }

  /**
   * @param {KeyboardEvent|null|undefined} e
   * @returns {boolean}
   */
  hasModifierKeys(e) {
    return kpHasModifierKeys(e);
  }
}
