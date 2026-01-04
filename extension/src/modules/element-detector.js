/**
 * Element detection and interaction utilities
 */
export class ElementDetector {
  constructor() {
    this.CLICKABLE_ROLES = ['link', 'button', 'slider', 'checkbox', 'radio', 'tab', 'menuitem', 'option', 'switch', 'treeitem', 'combobox', 'spinbutton'];

    this.CLICKABLE_SEL = 'a[href], button, input, select, textarea, video, audio';
    this.FOCUSABLE_SEL = 'a[href], button, input, select, textarea, video, audio, [contenteditable="true"], [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [data-action], [data-toggle], [data-click], [data-href], [data-link], [vue-click], [ng-click]';

    // Track elements with addEventListener click handlers
    this.clickHandlerElements = new WeakSet();

    // Wrap addEventListener to track click handlers
    this.setupEventListenerTracking();
  }

  setupEventListenerTracking() {
    // Store the original addEventListener
    const originalAddEventListener = EventTarget.prototype.addEventListener;

    // Wrap addEventListener to track click handlers
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      // Call the original method
      originalAddEventListener.call(this, type, listener, options);

      // Track click handlers
      if (type === 'click' && this instanceof Element) {
        try {
          // Use a WeakSet to avoid memory leaks
          elementDetectorInstance.clickHandlerElements.add(this);
        } catch {
          // Ignore errors in tracking
        }
      }
    };

    // Also track the element detector instance for the wrapped function
    window.elementDetectorInstance = this;
  }

  hasTrackedClickHandler(el) {
    return this.clickHandlerElements.has(el);
  }

  deepElementFromPoint(x, y) {
    let el = document.elementFromPoint(x, y);
    let guard = 0;
    while (el && el.shadowRoot && guard++ < 10) {
      const nested = el.shadowRoot.elementFromPoint(x, y);
      if (!nested || nested === el) break;
      el = nested;
    }
    return el;
  }

  isLikelyInteractive(el, opts = {}) {
    if (!el || el.nodeType !== 1) return false;
    
    const allowCursor = (opts && Object.prototype.hasOwnProperty.call(opts, 'allowCursor'))
      ? !!opts.allowCursor
      : true;

    const matchesSelector = el.matches(this.FOCUSABLE_SEL);
    const role = (el.getAttribute && (el.getAttribute('role') || '').trim().toLowerCase()) || '';
    const hasRole = role && this.CLICKABLE_ROLES.includes(role);
    
    // Check for other interactive indicators
    const hasClickHandler = el.onclick || el.getAttribute('onclick') || this.hasTrackedClickHandler(el);

    // getComputedStyle() is relatively expensive; only use it as a last resort.
    let hasCursor = false;
    if (allowCursor && !matchesSelector && !hasRole && !hasClickHandler) {
      try {
        hasCursor = !!(window.getComputedStyle && window.getComputedStyle(el).cursor === 'pointer');
      } catch {
        hasCursor = false;
      }
    }
    
    // Debug logging
    if (window.KEYPILOT_DEBUG && (matchesSelector || hasRole || hasClickHandler || hasCursor)) {
      console.log('[KeyPilot Debug] isLikelyInteractive:', {
        tagName: el.tagName,
        href: el.href,
        matchesSelector: matchesSelector,
        role: role,
        hasRole: hasRole,
        hasClickHandler: !!hasClickHandler,
        hasTrackedClickHandler: this.hasTrackedClickHandler(el),
        hasCursor: hasCursor,
        allowCursor: allowCursor,
        selector: this.FOCUSABLE_SEL
      });
    }

    return matchesSelector || hasRole || hasClickHandler || hasCursor;
  }

  findClickable(el) {
    let n = el;
    let depth = 0;
    let cursorOnlyCandidate = null;
    while (n && n !== document.body && n.nodeType === 1 && depth < 10) {
      // Prefer semantic clickables (anchors/buttons/roles/handlers/etc.) over cursor:pointer-only
      // descendants. This avoids returning child <img>/<div> nodes inside <a href> that inherit
      // cursor:pointer from the anchor.
      if (this.isLikelyInteractive(n, { allowCursor: false })) {
        if (window.KEYPILOT_DEBUG) {
          console.log('[KeyPilot Debug] findClickable found:', {
            tagName: n.tagName,
            href: n.href,
            className: n.className,
            depth: depth
          });
        }
        return n;
      }

      // Cursor-pointer-only fallback: store the first cursor candidate but keep walking up.
      // If we later find a semantic interactive ancestor, we'll return that instead.
      if (!cursorOnlyCandidate && this.isLikelyInteractive(n, { allowCursor: true })) {
        cursorOnlyCandidate = n;
      }

      n = n.parentElement || (n.getRootNode() instanceof ShadowRoot ? n.getRootNode().host : null);
      depth++;
    }
    
    const finalResult = cursorOnlyCandidate || (el && this.isLikelyInteractive(el) ? el : null);
    if (window.KEYPILOT_DEBUG && !finalResult && el) {
      console.log('[KeyPilot Debug] findClickable found nothing for:', {
        tagName: el.tagName,
        href: el.href,
        className: el.className
      });
    }
    
    return finalResult;
  }

  isTextLike(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      return ['text', 'search', 'url', 'email', 'tel', 'password', 'number'].includes(t);
    }
    return false;
  }

  isNativeType(el, type) {
    return el && el.tagName === 'INPUT' && (el.getAttribute('type') || '').toLowerCase() === type;
  }

  isContentEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    return el.isContentEditable || el.getAttribute('contenteditable') === 'true';
  }
}