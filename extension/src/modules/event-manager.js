/**
 * Centralized event management
 *
 * Build note: content-bundled.js concatenates modules and strips ESM imports.
 * Free functions from earlier modules (e.g. `dom-context.js`) remain in scope.
 * Never use `import { x as y }` aliases — the alias binding is deleted with the import.
 */
import { isTypingContext, hasModifierKeys } from '../utils/dom-context.js';

export class EventManager {
  constructor() {
    this.listeners = new Map();
    this.isActive = false;
  }

  start() {
    if (this.isActive) return;
    
    this.addListener(document, 'keydown', this.handleKeyDown.bind(this), { capture: true });
    
    // Multiple mouse move listeners to catch events that might be captured
    this.addListener(document, 'mousemove', this.handleMouseMove.bind(this));
    this.addListener(document, 'mousemove', this.handleMouseMove.bind(this), { capture: true });
    this.addListener(window, 'mousemove', this.handleMouseMove.bind(this));
    
    // Additional mouse events for better tracking
    this.addListener(document, 'mouseenter', this.handleMouseMove.bind(this));
    this.addListener(document, 'mouseover', this.handleMouseMove.bind(this));
    
    this.addListener(document, 'scroll', this.handleScroll.bind(this), { passive: true });
    
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
    const key = `${element.constructor.name}-${event}`;
    
    if (this.listeners.has(key)) {
      this.removeListener(element, event);
    }
    
    element.addEventListener(event, handler, options);
    this.listeners.set(key, { element, event, handler, options });
  }

  removeListener(element, event) {
    const key = `${element.constructor.name}-${event}`;
    const listener = this.listeners.get(key);
    
    if (listener) {
      listener.element.removeEventListener(listener.event, listener.handler, listener.options);
      this.listeners.delete(key);
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
   * Delegate to shared helper (module free function after import strip).
   * Identifier resolves to the imported/bundled free function, not this method.
   */
  isTypingContext(target) {
    return isTypingContext(target);
  }

  /**
   * Delegate to shared helper (module free function after import strip).
   * Identifier resolves to the imported/bundled free function, not this method.
   */
  hasModifierKeys(e) {
    return hasModifierKeys(e);
  }
}
