/**
 * Element detection and interaction utilities
 */
import { CLICKABLE_CATEGORY, CSS_CLASSES } from '../config/constants.js';

export class ElementDetector {
  constructor() {
    this.CLICKABLE_ROLES = ['link', 'button', 'slider', 'checkbox', 'radio', 'tab', 'menuitem', 'option', 'switch', 'treeitem', 'combobox', 'spinbutton'];

    // Composite widgets / structural containers that often host delegated click
    // listeners. A tracked click handler alone must not make the entire region
    // a KeyPilot hover target — the leaf items (tabs, options, etc.) are.
    this.COMPOSITE_CONTAINER_ROLES = [
      'tablist', 'menu', 'menubar', 'listbox', 'tree', 'grid', 'radiogroup',
      'toolbar', 'group', 'navigation', 'list', 'directory', 'rowgroup', 'table'
    ];

    this.CLICKABLE_SEL = 'a[href], button, input, select, textarea, video, audio';
    this.FOCUSABLE_SEL = 'a[href], button, input, select, textarea, video, audio, [contenteditable="true"], [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [data-action], [data-toggle], [data-click], [data-href], [data-link], [vue-click], [ng-click]';

    // Track elements with addEventListener click handlers
    this.clickHandlerElements = new WeakSet();

    // Depth for nested _withNativePageCursors calls (one suspend/restore pair).
    this._nativeCursorSuspendDepth = 0;
    this._nativeCursorWasHidden = false;

    // Wrap addEventListener to track click handlers
    this.setupEventListenerTracking();
  }

  /**
   * Run `fn` with KeyPilot's custom-cursor override temporarily disabled so
   * getComputedStyle(...).cursor reflects the page's real cursor (e.g. pointer).
   *
   * When CUSTOM_CURSORS is on, style-manager forces:
   *   html.kpv2-cursor-hidden * { cursor: var(--kpv2-cursor) !important; }
   * which makes every element report the crosshair (or other custom cursor) and
   * hides CSS cursor:pointer signals used to find non-semantic clickables.
   *
   * Suspend/restore is synchronous and re-entrant — no paint should occur mid-task.
   * @template T
   * @param {() => T} fn
   * @returns {T}
   */
  _withNativePageCursors(fn) {
    let html = null;
    try { html = document.documentElement; } catch { /* ignore */ }

    if (!html || !html.classList) {
      return fn();
    }

    if (this._nativeCursorSuspendDepth > 0) {
      this._nativeCursorSuspendDepth++;
      try {
        return fn();
      } finally {
        this._nativeCursorSuspendDepth--;
      }
    }

    const hadHidden = html.classList.contains(CSS_CLASSES.CURSOR_HIDDEN);
    this._nativeCursorWasHidden = hadHidden;
    if (hadHidden) {
      try { html.classList.remove(CSS_CLASSES.CURSOR_HIDDEN); } catch { /* ignore */ }
    }
    this._nativeCursorSuspendDepth = 1;
    try {
      return fn();
    } finally {
      this._nativeCursorSuspendDepth = 0;
      if (hadHidden) {
        try { html.classList.add(CSS_CLASSES.CURSOR_HIDDEN); } catch { /* ignore */ }
      }
      this._nativeCursorWasHidden = false;
    }
  }

  /**
   * Computed cursor with custom-cursor override suspended.
   * @param {Element} el
   * @returns {string}
   */
  _getPageComputedCursor(el) {
    if (!el || !window.getComputedStyle) return '';
    return this._withNativePageCursors(() => {
      try {
        return window.getComputedStyle(el).cursor || '';
      } catch {
        return '';
      }
    });
  }

  /**
   * True when el is a layout/composite container that should not become a
   * clickable hover target solely because of a delegated click listener.
   * @param {Element} el
   * @param {string} [role]
   * @returns {boolean}
   */
  isCompositeClickContainer(el, role = '') {
    if (!el || el.nodeType !== 1) return false;
    const r = (role || (el.getAttribute && (el.getAttribute('role') || '').trim().toLowerCase()) || '');
    if (r && this.COMPOSITE_CONTAINER_ROLES.includes(r)) return true;
    const tag = el.tagName;
    return tag === 'NAV' || tag === 'UL' || tag === 'OL' || tag === 'MENU' ||
      tag === 'TABLE' || tag === 'TBODY' || tag === 'THEAD' || tag === 'TFOOT';
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

  /**
   * Like Node.contains, but crosses open shadow boundaries via host hops.
   * archive.org tiles: clickable <a> in tile-dispatcher wraps <collection-tile>
   * whose internals live in a nested shadow — plain contains() is always false
   * for those descendants, which breaks sticky hover and nested-chrome checks.
   *
   * @param {Node|null|undefined} host
   * @param {Node|null|undefined} node
   * @returns {boolean}
   */
  composedContains(host, node) {
    if (!host || !node || host.nodeType !== 1) return false;
    if (host === node) return true;
    try {
      if (host.contains(node)) return true;
    } catch { /* ignore */ }

    let n = node;
    let depth = 0;
    while (n && depth++ < 32) {
      if (n === host) return true;
      try {
        if (n.parentElement) {
          n = n.parentElement;
          continue;
        }
        const root = typeof n.getRootNode === 'function' ? n.getRootNode() : null;
        if (root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
          n = root.host || null;
          continue;
        }
      } catch {
        break;
      }
      break;
    }
    return false;
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

  /**
   * True when this element itself sets cursor:pointer (not merely inheriting it).
   * Sites like suno.com put `cursor-pointer` on <body>, which would otherwise make
   * every node look interactive via getComputedStyle().cursor.
   *
   * When KeyPilot custom cursors are enabled, page cursor styles are overridden
   * with !important — this method suspends that override before reading computed
   * styles so cursor:pointer-only clickables still get hover outlines.
   */
  hasExplicitCursorPointer(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      if (el === document.body || el === document.documentElement) return false;
    } catch { /* ignore */ }

    try {
      if (el.style && String(el.style.cursor || '').toLowerCase() === 'pointer') {
        return true;
      }
    } catch { /* ignore */ }

    try {
      const cls = typeof el.className === 'string'
        ? el.className
        : (el.className && typeof el.className.baseVal === 'string' ? el.className.baseVal : '');
      if (cls && (/\bcursor-pointer\b/i.test(cls) || /\bcursorPointer\b/.test(cls))) {
        return true;
      }
    } catch { /* ignore */ }

    // Local CSS rule: computed pointer while parent is not pointer.
    // Must read with custom-cursor override suspended (see _withNativePageCursors).
    try {
      if (!window.getComputedStyle) return false;
      return this._withNativePageCursors(() => {
        const own = window.getComputedStyle(el).cursor;
        if (own !== 'pointer') return false;
        const parent = el.parentElement;
        if (!parent) return false;
        return window.getComputedStyle(parent).cursor !== 'pointer';
      });
    } catch {
      return false;
    }
  }

  isLikelyInteractive(el, opts = {}) {
    if (!el || el.nodeType !== 1) return false;

    // Never treat the page root as a clickable hover target. Sites often put
    // delegated click listeners on body/html; if we accept those, hover can
    // "stick" on the previous real target when the pointer moves to empty chrome.
    try {
      if (el === document.body || el === document.documentElement) return false;
      if (el.tagName === 'BODY' || el.tagName === 'HTML') return false;
    } catch { /* ignore */ }
    
    const allowCursor = (opts && Object.prototype.hasOwnProperty.call(opts, 'allowCursor'))
      ? !!opts.allowCursor
      : true;

    const matchesSelector = el.matches(this.FOCUSABLE_SEL);
    const role = (el.getAttribute && (el.getAttribute('role') || '').trim().toLowerCase()) || '';
    const hasRole = role && this.CLICKABLE_ROLES.includes(role);

    // Explicit onclick attribute still counts as intentional interactivity.
    // Tracked addEventListener('click') alone is weaker — often event delegation
    // on a parent list/nav/tablist — and must not light up the whole container.
    const hasInlineClick = !!(el.onclick || (el.getAttribute && el.getAttribute('onclick')));
    const hasTrackedClick = this.hasTrackedClickHandler(el);
    let hasClickHandler = hasInlineClick || hasTrackedClick;
    if (hasClickHandler && !matchesSelector && !hasRole && !hasInlineClick &&
        this.isCompositeClickContainer(el, role)) {
      hasClickHandler = false;
    }

    // getComputedStyle() is relatively expensive; only use it as a last resort.
    // Ignore inherited cursor:pointer from body/html-wide styles.
    let hasCursor = false;
    if (allowCursor && !matchesSelector && !hasRole && !hasClickHandler) {
      hasCursor = this.hasExplicitCursorPointer(el);
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

  /**
   * Whether an element is (or belongs to) a media/progress scrubber UI.
   * Used for focus styling (no link-style fill) and activation routing.
   */
  isScrubberLike(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      if (this.isNativeType(el, 'range')) return true;
      const role = (el.getAttribute('role') || '').trim().toLowerCase();
      if (role === 'slider') return true;
      if (this.looksLikeScrubTrack(el)) return true;
      if (typeof el.closest === 'function') {
        if (el.closest('[role="slider"], input[type="range"]')) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Thin, wide interactive bar — typical custom progress/seek track (Rumble, Suno presentation).
   * Strict geometry only; no "nearby control" search.
   */
  looksLikeScrubTrack(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'VIDEO' || el.tagName === 'AUDIO') {
        return false;
      }
      // Never treat real controls as tracks.
      if (typeof el.closest === 'function') {
        if (el.closest('button, [role="button"], a[href], select, textarea')) return false;
      }

      const role = (el.getAttribute('role') || '').trim().toLowerCase();
      if (role && role !== 'presentation' && role !== 'none' && role !== 'slider' && role !== 'progressbar') {
        if (this.CLICKABLE_ROLES.includes(role) && role !== 'slider') return false;
      }

      const rect = el.getBoundingClientRect();
      if (!rect || rect.width < 64 || rect.height <= 0 || rect.height > 28) return false;
      if (rect.width / Math.max(rect.height, 1) < 4) return false;

      let pe = 'auto';
      try { pe = window.getComputedStyle(el).pointerEvents; } catch { /* ignore */ }
      if (pe === 'none') return false;

      // Pointer / presentation / progress semantics on this node (not inherited body cursor alone).
      if (
        this.hasExplicitCursorPointer(el) ||
        role === 'presentation' ||
        role === 'slider' ||
        role === 'progressbar'
      ) {
        return true;
      }

      // Rumble-style: cursor may be set on a parent chrome node via inline style.
      // Read with custom-cursor override suspended so CUSTOM_CURSORS mode still works.
      const cursor = this._getPageComputedCursor(el);
      if (cursor !== 'pointer') return false;
      let p = el.parentElement;
      let d = 0;
      while (p && d < 3) {
        if (this.hasExplicitCursorPointer(p)) return true;
        // Parent is also a thin wide bar (track stack).
        try {
          const pr = p.getBoundingClientRect();
          if (pr.width >= rect.width * 0.9 && pr.height > 0 && pr.height <= 28) return true;
        } catch { /* ignore */ }
        p = p.parentElement;
        d++;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Structural range/slider for the hit element only — no proximity / playbar scanning.
   * Thumb-style players: range is a sibling of the visual track under the same trackHost.
   * @param {Element} el
   * @returns {HTMLElement|null}
   */
  findRelatedRangeOrSlider(el) {
    if (!el || el.nodeType !== 1) return null;

    try {
      if (this.isNativeType(el, 'range')) return /** @type {HTMLElement} */ (el);
      const role = (el.getAttribute('role') || '').trim().toLowerCase();
      if (role === 'slider') return /** @type {HTMLElement} */ (el);
    } catch { /* ignore */ }

    // Direct ancestor only (not "find any range in the playbar").
    try {
      if (typeof el.closest === 'function') {
        const viaClosest = el.closest('input[type="range"], [role="slider"]');
        if (viaClosest) return /** @type {HTMLElement} */ (viaClosest);
      }
    } catch { /* ignore */ }

    // Structural sibling thumb: only when this node (or a short ancestor) is the scrub track.
    // trackHost > [presentation track | wrapper > input[type=range]]
    let n = el;
    let depth = 0;
    while (n && n.nodeType === 1 && depth < 5) {
      const onTrack =
        this.looksLikeScrubTrack(n) ||
        ((n.getAttribute?.('role') || '').trim().toLowerCase() === 'presentation' &&
          (() => {
            try {
              const r = n.getBoundingClientRect();
              return r.width >= 64 && r.height > 0 && r.height <= 28;
            } catch {
              return false;
            }
          })());

      if (onTrack && n.parentElement) {
        for (const sib of n.parentElement.children) {
          if (!sib || sib === n || sib.nodeType !== 1) continue;
          if (this.isNativeType(sib, 'range')) return /** @type {HTMLElement} */ (sib);
          const r = (sib.getAttribute?.('role') || '').trim().toLowerCase();
          if (r === 'slider') return /** @type {HTMLElement} */ (sib);
          // One level only: wrapper that holds the thumb-sized range input.
          try {
            for (const child of sib.children || []) {
              if (this.isNativeType(child, 'range')) return /** @type {HTMLElement} */ (child);
              const cr = (child.getAttribute?.('role') || '').trim().toLowerCase();
              if (cr === 'slider') return /** @type {HTMLElement} */ (child);
            }
          } catch { /* ignore */ }
        }
      }

      n = n.parentElement;
      depth++;
    }

    return null;
  }

  /**
   * Resolve a scrubber for the hit element only (track / range / role=slider).
   * Does not pull in nearby play/volume buttons via playbar-wide searches.
   * @param {Element|null} el
   * @param {number} [clientX]
   * @param {number} [clientY]
   * @returns {{ kind: 'range'|'role-slider'|'track', control: HTMLElement, track: HTMLElement }|null}
   */
  resolveScrubber(el, clientX, clientY) {
    if (!el || el.nodeType !== 1) return null;

    // Play/volume/nav controls must never resolve as the progress scrubber.
    try {
      if (el.tagName === 'A' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON') return null;
      if (el.tagName === 'INPUT') {
        const t = (el.getAttribute('type') || 'text').toLowerCase();
        if (t !== 'range') return null;
      }
      if (typeof el.closest === 'function') {
        if (el.closest('button, [role="button"], a[href], select, textarea')) return null;
      }
    } catch { /* ignore */ }

    const control = this.findRelatedRangeOrSlider(el);
    if (control) {
      const kind = this.isNativeType(control, 'range') ? 'range' : 'role-slider';
      const track = this.getScrubTrackElement(control, el) || control;
      return { kind, control, track: /** @type {HTMLElement} */ (track) };
    }

    // Custom track with no ARIA/range (Rumble-style pure div scrubber).
    let n = el;
    let depth = 0;
    while (n && n.nodeType === 1 && depth < 5) {
      if (this.looksLikeScrubTrack(n)) {
        try {
          const r = n.getBoundingClientRect();
          if (r.width > window.innerWidth * 0.98 && r.height > 40) {
            n = n.parentElement;
            depth++;
            continue;
          }
        } catch { /* ignore */ }

        let track = /** @type {HTMLElement} */ (n);
        let p = n.parentElement;
        let up = 0;
        while (p && up < 3) {
          if (this.looksLikeScrubTrack(p)) {
            try {
              const pr = p.getBoundingClientRect();
              const tr = track.getBoundingClientRect();
              if (pr.width >= tr.width * 0.9 && pr.height <= 28) track = /** @type {HTMLElement} */ (p);
            } catch { /* ignore */ }
          }
          p = p.parentElement;
          up++;
        }

        return { kind: 'track', control: track, track };
      }
      n = n.parentElement;
      depth++;
    }

    return null;
  }

  /**
   * For thumb-sized range inputs, return the full-width track element used for geometry/seek.
   * @param {Element} control - range or role=slider
   * @param {Element} [hintEl] - original hit element
   * @returns {HTMLElement|null}
   */
  getScrubTrackElement(control, hintEl) {
    if (!control || control.nodeType !== 1) return null;

    try {
      if ((control.getAttribute('role') || '').trim().toLowerCase() === 'slider') {
        return /** @type {HTMLElement} */ (control);
      }
    } catch { /* ignore */ }

    let controlRect = null;
    try { controlRect = control.getBoundingClientRect(); } catch { controlRect = null; }

    // Prefer an explicit presentation sibling/host around a tiny thumb input.
    const roots = [];
    try {
      if (control.parentElement) roots.push(control.parentElement);
      if (control.parentElement?.parentElement) roots.push(control.parentElement.parentElement);
      if (control.parentElement?.parentElement?.parentElement) {
        roots.push(control.parentElement.parentElement.parentElement);
      }
      if (hintEl && hintEl !== control) roots.push(hintEl, hintEl.parentElement);
    } catch { /* ignore */ }

    for (const root of roots) {
      if (!root || !root.querySelector) continue;
      try {
        const presentation = root.querySelector?.(':scope > [role="presentation"], [role="presentation"]');
        if (presentation) {
          const pr = presentation.getBoundingClientRect();
          if (pr.width > 40 && (!controlRect || pr.width > controlRect.width * 2)) {
            return /** @type {HTMLElement} */ (presentation);
          }
        }
      } catch { /* ignore */ }

      // Host that is substantially wider than the thumb is the track.
      try {
        const rr = root.getBoundingClientRect();
        if (controlRect && rr.width > controlRect.width * 3 && rr.height <= 48 && rr.height > 0) {
          return /** @type {HTMLElement} */ (root);
        }
      } catch { /* ignore */ }
    }

    // Walk up for a significantly wider horizontal host.
    let n = control.parentElement;
    let depth = 0;
    while (n && depth < 6) {
      try {
        const rr = n.getBoundingClientRect();
        if (controlRect && rr.width > Math.max(controlRect.width * 3, 80) && rr.height <= 40) {
          // Prefer a presentation child if present.
          const pres = n.querySelector?.('[role="presentation"]');
          if (pres) {
            const pr = pres.getBoundingClientRect();
            if (pr.width > 40) return /** @type {HTMLElement} */ (pres);
          }
          return /** @type {HTMLElement} */ (n);
        }
      } catch { /* ignore */ }
      n = n.parentElement;
      depth++;
    }

    // Hint element itself may be the track fill.
    if (hintEl && this.looksLikeScrubTrack(hintEl)) {
      return /** @type {HTMLElement} */ (hintEl);
    }

    return /** @type {HTMLElement} */ (control);
  }

  findClickable(el) {
    // Batch cursor-override suspension for the whole ancestor walk so we don't
    // toggle html.kpv2-cursor-hidden once per node when probing cursor:pointer.
    return this._withNativePageCursors(() => this._findClickableUnsuspended(el));
  }

  _findClickableUnsuspended(el) {
    // Standard interactive walk only — no scrubber "proximity" remapping of hover focus.
    // F-activation still resolves scrubbers from the hit target in ActivationHandler.
    let n = el;
    let depth = 0;
    let cursorOnlyCandidate = null;
    // Depth 20: archive.org-style nested open shadows (tile-dispatcher → collection-tile → …)
    // can sit well below 10 steps from the deepest hit target.
    while (n && n !== document.body && n.nodeType === 1 && depth < 20) {
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

  /**
   * True when `el` is nested chrome inside `host` (More menu, small sub-links,
   * icon buttons) rather than the primary hover target for the row/card/tab.
   * @param {Element} el
   * @param {Element} host
   * @returns {boolean}
   */
  _isNestedHoverChrome(el, host) {
    if (!el || !host || el === host || el.nodeType !== 1 || host.nodeType !== 1) return false;
    try {
      if (!this.composedContains(host, el)) return false;
    } catch {
      return false;
    }

    const tag = el.tagName;
    const role = ((el.getAttribute && el.getAttribute('role')) || '').trim().toLowerCase();
    if (tag === 'BUTTON' || role === 'button') return true;
    if (el.getAttribute && el.getAttribute('aria-haspopup')) return true;

    // Small nested links inside a larger row/card (trend "with X", avatars, etc.).
    if (tag === 'A' || role === 'link') {
      try {
        const er = el.getBoundingClientRect();
        const hr = host.getBoundingClientRect();
        const eArea = Math.max(1, er.width * er.height);
        const hArea = Math.max(1, hr.width * hr.height);
        return eArea < hArea * 0.35;
      } catch {
        return true;
      }
    }
    return false;
  }

  /**
   * Prefer a stable "host" interactive for hover chrome: row-sized role=link
   * cards and role=tab strips, instead of nested More/buttons/sub-links.
   * @param {Element} leaf
   * @returns {Element|null}
   */
  _findPreferableHoverHost(leaf) {
    if (!leaf || leaf.nodeType !== 1) return null;

    /** @type {Element|null} */
    let hostLink = null;
    /** @type {Element|null} */
    let hostTab = null;
    let n = leaf;
    let depth = 0;
    while (n && n !== document.body && n.nodeType === 1 && depth++ < 14) {
      const role = ((n.getAttribute && n.getAttribute('role')) || '').trim().toLowerCase();
      if (role === 'tab') hostTab = n;
      if (role === 'link') {
        try {
          const r = n.getBoundingClientRect();
          // Row/card-ish: wide enough and tall enough to be the primary target.
          if (r.width >= 100 && r.height >= 32) hostLink = n;
        } catch { /* ignore */ }
      }
      n = n.parentElement || (n.getRootNode instanceof Function && n.getRootNode() instanceof ShadowRoot
        ? n.getRootNode().host
        : null);
    }

    // Tabs: always prefer the tab host over an inner label/button.
    if (hostTab && (leaf === hostTab || this.composedContains(hostTab, leaf))) return hostTab;

    // Link rows/cards: promote nested chrome up to the host row.
    if (hostLink && this.composedContains(hostLink, leaf) && leaf !== hostLink) {
      if (this._isNestedHoverChrome(leaf, hostLink)) return hostLink;
    }
    return null;
  }

  /**
   * Resolve the element that should receive hover focus chrome / F-activate.
   * Stabilizes against nested controls and brief nulls while still inside the
   * previous host (generic fix for list rows, tabs, cards — not site-specific).
   *
   * @param {Element|null|undefined} underEl - Deepest node under the pointer
   * @param {Element|null|undefined} prevFocus - Previous hover focus element
   * @returns {Element|null}
   */
  resolveHoverFocusTarget(underEl, prevFocus = null) {
    const under = underEl && underEl.nodeType === 1 ? underEl : null;
    const prev = prevFocus && prevFocus.nodeType === 1 && prevFocus.isConnected
      ? prevFocus
      : null;

    // Sticky: pointer still inside previous host → keep it when leaf is missing
    // or is nested chrome (avoids thrash / clear between children).
    // Use composedContains so open-shadow tile content (archive.org collection-tile
    // inside tile-dispatcher <a>) still counts as "inside" the focused link.
    if (prev && under) {
      try {
        if (this.composedContains(prev, under)) {
          const leafInside = this.findClickable(under);
          if (!leafInside || leafInside === prev || this._isNestedHoverChrome(leafInside, prev)) {
            return prev;
          }
          // Leaf is a distinct primary target inside prev (e.g. large nested link):
          // still prefer host for row-sized role=link / tab.
          const host = this._findPreferableHoverHost(leafInside);
          if (host === prev) return prev;
          if (host) return host;
          return leafInside;
        }
      } catch { /* ignore */ }
    }

    if (!under) return null;

    const leaf = this.findClickable(under);
    if (!leaf) return null;

    const host = this._findPreferableHoverHost(leaf);
    return host || leaf;
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

  /**
   * Classify an interactive element into a clickable category.
   * Categories drive hover chrome, F-key feedback, and activation — sliders are
   * not treated as links even when they share a player bar with other controls.
   *
   * Priority: text > slider > button > link > media > control > generic
   *
   * @param {Element|null} el
   * @returns {string} One of CLICKABLE_CATEGORY values
   */
  getClickableCategory(el) {
    if (!el || el.nodeType !== 1) return CLICKABLE_CATEGORY.NONE;

    try {
      // 1) Text entry
      if (this.isTextLike(el) || this.isContentEditable(el)) {
        return CLICKABLE_CATEGORY.TEXT;
      }

      // 2) Slider / scrubber (before link — track fills must not inherit "link" UI)
      if (this.isNativeType(el, 'range')) return CLICKABLE_CATEGORY.SLIDER;
      const role = (el.getAttribute?.('role') || '').trim().toLowerCase();
      if (role === 'slider' || role === 'progressbar') return CLICKABLE_CATEGORY.SLIDER;
      if (this.looksLikeScrubTrack(el)) return CLICKABLE_CATEGORY.SLIDER;
      try {
        if (typeof el.closest === 'function' &&
            el.closest('input[type="range"], [role="slider"], [role="progressbar"]')) {
          return CLICKABLE_CATEGORY.SLIDER;
        }
      } catch { /* ignore */ }

      // 3) Button — findClickable returns the button host itself when hovering children
      if (el.tagName === 'BUTTON' || role === 'button') return CLICKABLE_CATEGORY.BUTTON;
      try {
        if (typeof el.matches === 'function' && el.matches('[role="button"]')) {
          return CLICKABLE_CATEGORY.BUTTON;
        }
      } catch { /* ignore */ }

      // 4) Link (navigation) — only when the resolved target is the link itself
      if (el.tagName === 'A' && /** @type {any} */ (el).href) return CLICKABLE_CATEGORY.LINK;
      if (role === 'link') return CLICKABLE_CATEGORY.LINK;
      try {
        if (typeof el.matches === 'function' && el.matches('a[href], [role="link"]')) {
          return CLICKABLE_CATEGORY.LINK;
        }
      } catch { /* ignore */ }

      // 5) Media surface (video/audio element or host that is the media control itself)
      if (el.tagName === 'VIDEO' || el.tagName === 'AUDIO') return CLICKABLE_CATEGORY.MEDIA;

      // 6) Other form / ARIA controls
      if (el.tagName === 'SELECT') return CLICKABLE_CATEGORY.CONTROL;
      if (this.isNativeType(el, 'checkbox') || this.isNativeType(el, 'radio') ||
          this.isNativeType(el, 'file') || this.isNativeType(el, 'color') ||
          this.isNativeType(el, 'date') || this.isNativeType(el, 'time')) {
        return CLICKABLE_CATEGORY.CONTROL;
      }
      if (['checkbox', 'radio', 'tab', 'menuitem', 'option', 'switch', 'treeitem',
           'combobox', 'spinbutton'].includes(role)) {
        return CLICKABLE_CATEGORY.CONTROL;
      }

      // 7) Catch remaining interactive nodes (cursor / handlers / inputs)
      if (el.tagName === 'INPUT') {
        // Non-text, non-range inputs already handled; leftover types → control
        return CLICKABLE_CATEGORY.CONTROL;
      }
      if (this.isLikelyInteractive(el)) return CLICKABLE_CATEGORY.GENERIC;

      return CLICKABLE_CATEGORY.NONE;
    } catch {
      return CLICKABLE_CATEGORY.NONE;
    }
  }

  /**
   * Whether this category should get "link-style" hover/activation chrome:
   * scale-up pulse, link key hints, navigational affordances.
   * Sliders and media surfaces are excluded.
   * @param {string} category
   * @returns {boolean}
   */
  isLinkStyleCategory(category) {
    return category === CLICKABLE_CATEGORY.LINK || category === CLICKABLE_CATEGORY.GENERIC;
  }

  /**
   * Whether focus fill (blue wash) should be suppressed for this category/element.
   * @param {Element|null} el
   * @returns {boolean}
   */
  shouldSuppressFocusFillForElement(el) {
    const cat = this.getClickableCategory(el);
    if (cat === CLICKABLE_CATEGORY.SLIDER) return true;
    if (cat === CLICKABLE_CATEGORY.TEXT) return true;
    // Media: suppress only when the player shell has semantic seek chrome
    // (thumbnail videos without a range/slider keep the blue wash).
    if (cat === CLICKABLE_CATEGORY.MEDIA) {
      try {
        let root = el;
        if (el?.tagName === 'VIDEO' && el.parentElement) root = el.parentElement;
        let n = root;
        let depth = 0;
        while (n && n.nodeType === 1 && depth < 5) {
          if (n === document.body || n === document.documentElement) break;
          if (n.querySelector?.('input[type="range"], [role="slider"], [role="progressbar"]')) {
            return true;
          }
          try {
            const r = n.getBoundingClientRect();
            if (r.height > window.innerHeight * 0.85 && r.width > window.innerWidth * 0.85) break;
          } catch { /* ignore */ }
          n = n.parentElement;
          depth++;
        }
      } catch { /* ignore */ }
      return false;
    }
    return false;
  }
}
