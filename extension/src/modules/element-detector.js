/**
 * Element detection and interaction utilities
 */
import { CLICKABLE_CATEGORY, CSS_CLASSES, FEATURE_FLAGS } from '../config/constants.js';
import { deepElementFromPoint as pierceElementFromPoint } from '../utils/element-from-point.js';
import {
  resolveHoveredLink,
  activationIdentitiesMatch,
  isOwnActionControl,
  resolveActivationIdentity,
  uniqueDescendantNavigableLink
} from '../utils/resolve-hovered-link.js';

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

    this.CLICKABLE_SEL = 'a[href], button, input, select, textarea, video, audio, summary';
    // Include <summary> so details/summary groups (e.g. New Tab recent-history outlines)
    // are semantic hover/F targets for the full header, not only cursor:pointer leaves.
    this.FOCUSABLE_SEL = 'a[href], button, input, select, textarea, video, audio, summary, [contenteditable="true"], [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [data-action], [data-toggle], [data-click], [data-href], [data-link], [vue-click], [ng-click]';

    // Track elements with addEventListener click handlers
    this.clickHandlerElements = new WeakSet();
    /** @type {WeakMap<Element, Set<Function|EventListenerObject>>} */
    this.clickHandlerListeners = new WeakMap();

    // Depth for nested _withNativePageCursors calls (one suspend/restore pair).
    this._nativeCursorSuspendDepth = 0;
    this._nativeCursorWasHidden = false;

    // Optional: wrap addEventListener to track click handlers (JS-only clickables).
    if (FEATURE_FLAGS.ENABLE_CLICK_LISTENER_TRACKING !== false) {
      this.setupEventListenerTracking();
    }
  }

  /**
   * True when Crosshair mode is forcing `--kpv2-cursor` on the page via
   * `html.kpv2-cursor-hidden`.
   * @returns {boolean}
   */
  _isCursorOverrideActive() {
    try {
      return !!document.documentElement?.classList?.contains(CSS_CLASSES.CURSOR_HIDDEN);
    } catch {
      return false;
    }
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
   * IMPORTANT: Toggling that class invalidates styles for the whole document.
   * Only call this when a cursor:pointer probe is actually required — never on
   * the semantic-clickable hot path (see findClickable).
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
    // Fast path: No-custom-cursor mode — nothing to suspend.
    if (!hadHidden) {
      return fn();
    }

    this._nativeCursorWasHidden = true;
    try { html.classList.remove(CSS_CLASSES.CURSOR_HIDDEN); } catch { /* ignore */ }
    this._nativeCursorSuspendDepth = 1;
    try {
      return fn();
    } finally {
      this._nativeCursorSuspendDepth = 0;
      try { html.classList.add(CSS_CLASSES.CURSOR_HIDDEN); } catch { /* ignore */ }
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
      tag === 'TABLE' || tag === 'TBODY' || tag === 'THEAD' || tag === 'TFOOT' ||
      tag === 'HEADER';
  }

  /**
   * Google Closure `jsaction` (Gmail thread rows, Maps, etc.).
   * Weak like a tracked listener — composite list/grid shells must not light up.
   * @param {Element|null|undefined} el
   * @returns {boolean}
   */
  hasJsActionHandler(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      const raw = el.getAttribute && el.getAttribute('jsaction');
      return !!(raw && String(raw).trim());
    } catch {
      return false;
    }
  }

  /**
   * @param {Element|null|undefined} el
   * @returns {string}
   */
  _jsActionToken(el) {
    if (!el || el.nodeType !== 1) return '';
    try {
      return String((el.getAttribute && el.getAttribute('jsaction')) || '').replace(/\s+/g, ' ').trim();
    } catch {
      return '';
    }
  }

  /**
   * Inbox scroller / feed shells also have jsaction; those must not become F-targets.
   * Thread rows (~40–80px) and chips stay.
   * @param {Element} el
   * @returns {boolean}
   */
  _jsActionHostTooLarge(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      const r = el.getBoundingClientRect();
      if (!r || !(r.height > 0)) return false;
      return r.height > 160;
    } catch {
      return false;
    }
  }

  /**
   * jsaction on a chip/tab scroller (Google News `jsname=w60JDf`) must not make
   * the whole strip an F-target when the pointer is in the gap between items.
   * @param {Element} el
   * @returns {boolean}
   */
  _isJsActionMultiItemShell(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      const items = el.querySelectorAll(
        '[role="tab"], [role="button"], button, a[href], [role="link"], [role="menuitem"], [role="option"]'
      );
      return !!(items && items.length >= 2);
    } catch {
      return false;
    }
  }

  /**
   * jsaction-only hosts that are list/strip shells, not a single row/card click.
   * @param {Element} el
   * @returns {boolean}
   */
  _isJsActionDelegationShell(el) {
    try {
      if (this._jsActionHostTooLarge(el)) return true;
    } catch { /* ignore */ }
    try {
      if (this._isJsActionMultiItemShell(el)) return true;
    } catch { /* ignore */ }
    return false;
  }

  /**
   * Site chrome bar (full-width header/nav) — not a real F-target.
   * NVIDIA sets cursor:pointer on `nav.global-nav` / `.nav-header`, which
   * would otherwise light up the entire top bar and then sticky-trap items.
   * @param {Element} el
   * @returns {boolean}
   */
  _isFullBleedChromeBar(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      if (this.isCompositeClickContainer(el)) return true;
    } catch { /* ignore */ }
    let role = '';
    try {
      role = ((el.getAttribute && el.getAttribute('role')) || '').trim().toLowerCase();
    } catch { /* ignore */ }
    // Inbox/thread rows are full-width and sit under the Gmail header — not a nav bar.
    try {
      if (el.tagName === 'TR' || role === 'row') return false;
    } catch { /* ignore */ }
    if (role === 'banner' || role === 'navigation') return true;
    try {
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth || 0;
      if (!(r && vw > 0 && r.width > 0 && r.height > 0)) return false;
      // Short strip spanning most of the viewport, parked at the top.
      return r.width >= vw * 0.7 && r.height <= 120 && r.top <= 80;
    } catch {
      return false;
    }
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
          if (listener && (typeof listener === 'function' || typeof listener.handleEvent === 'function')) {
            let set = elementDetectorInstance.clickHandlerListeners.get(this);
            if (!set) {
              set = new Set();
              elementDetectorInstance.clickHandlerListeners.set(this, set);
            }
            set.add(listener);
          }
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
   * True when `a` and `b` share an addEventListener('click') function.
   * Action controls (buttons) never match this way — Add to Cart must keep
   * its own ring even if a parent card also has a click listener.
   * Isolated-world wrap only sees listeners registered in this world.
   * @param {Element|null|undefined} a
   * @param {Element|null|undefined} b
   * @returns {boolean}
   */
  _shareClickListener(a, b) {
    if (!a || !b || a === b || a.nodeType !== 1 || b.nodeType !== 1) return false;
    try {
      if (isOwnActionControl(a) || isOwnActionControl(b)) return false;
    } catch { /* continue */ }
    let sa = null;
    let sb = null;
    try { sa = this.clickHandlerListeners.get(a); } catch { sa = null; }
    try { sb = this.clickHandlerListeners.get(b); } catch { sb = null; }
    if (!sa || !sb || !sa.size || !sb.size) return false;
    try {
      for (const fn of sa) {
        if (sb.has(fn)) return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  /**
   * Host is the click surface F would actually fire (row jsaction, card URL, …).
   * @param {Element} el
   * @returns {boolean}
   */
  _hasDelegatedClickSurface(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      if (this.hasJsActionHandler(el) || this.hasTrackedClickHandler(el)) return true;
    } catch { /* ignore */ }
    try {
      if (el.onclick || (el.getAttribute && el.getAttribute('onclick'))) return true;
    } catch { /* ignore */ }
    try {
      if (resolveActivationIdentity(el)) return true;
    } catch { /* ignore */ }
    return false;
  }

  /**
   * Gmail subject `div.xS[role=link]` has no href/onclick; F bubbles to `tr[jsaction]`.
   * Distinct widgets (star, checkbox, attachment chip) must not inherit.
   * @param {Element} leaf
   * @param {Element} host
   * @returns {boolean}
   */
  _leafInheritsHostActivation(leaf, host) {
    if (!leaf || !host || leaf === host || leaf.nodeType !== 1 || host.nodeType !== 1) {
      return false;
    }
    try {
      if (isOwnActionControl(leaf)) return false;
    } catch { /* continue */ }
    let role = '';
    try {
      role = ((leaf.getAttribute && leaf.getAttribute('role')) || '').trim().toLowerCase();
      // role=link without a URL is still the parent's open-row action (Gmail subject).
      if (role && role !== 'link' && this.CLICKABLE_ROLES.includes(role)) return false;
    } catch { /* continue */ }
    try {
      if (resolveActivationIdentity(leaf)) return false;
    } catch { /* continue */ }
    // X quote cards are role=link with no href; the parent <article> has an
    // implied status permalink. Those are different F-targets — do not absorb
    // the quote into the outer tweet (Gmail subject→row still works: row has
    // no nav: identity, only jsaction).
    try {
      const leafIsControl = role === 'link' ||
        (typeof leaf.matches === 'function' && leaf.matches(this.FOCUSABLE_SEL));
      if (leafIsControl) {
        const hostId = resolveActivationIdentity(host);
        if (hostId && hostId.slice(0, 4) === 'nav:') return false;
      }
    } catch { /* continue */ }
    try {
      const leafTok = this._jsActionToken(leaf);
      const hostTok = this._jsActionToken(host);
      if (leafTok && leafTok !== hostTok) return false;
      // Don't jump over a closer jsaction widget (Gmail attachment chip).
      if (hostTok) {
        let n = leaf.parentElement;
        let depth = 0;
        while (n && n !== host && n.nodeType === 1 && depth++ < 14) {
          const tok = this._jsActionToken(n);
          if (tok && tok !== hostTok) return false;
          n = n.parentElement;
        }
      }
    } catch { /* continue */ }
    try {
      return this._hasDelegatedClickSurface(host);
    } catch {
      return false;
    }
  }

  /**
   * Same F-destination: matching URL / data-href / onclick, a shared click fn,
   * or a nested label that only activates by bubbling to the host (Gmail rows).
   * @param {Element} leaf
   * @param {Element} host
   * @returns {boolean}
   */
  _skipForParentDestinationsMatch(leaf, host) {
    try {
      if (activationIdentitiesMatch(leaf, host)) return true;
    } catch { /* ignore */ }
    try {
      if (this._shareClickListener(leaf, host)) return true;
    } catch { /* ignore */ }
    try {
      if (this._leafInheritsHostActivation(leaf, host)) return true;
    } catch { /* ignore */ }
    try {
      if (this._hostPrimaryNavMatchesLeaf(leaf, host)) return true;
    } catch { /* ignore */ }
    return false;
  }

  /**
   * Leaf is the only navigable dest inside `host` (Gmail left-nav `.TO` chip:
   * short <a>Inbox</a> in a 240×32 row). Parent need not declare href/jsaction.
   * @param {Element} leaf
   * @param {Element} host
   * @returns {boolean}
   */
  _hostPrimaryNavMatchesLeaf(leaf, host) {
    if (!leaf || !host || leaf === host || leaf.nodeType !== 1 || host.nodeType !== 1) {
      return false;
    }
    try {
      if (isOwnActionControl(leaf) || isOwnActionControl(host)) return false;
    } catch { /* continue */ }
    let leafId = '';
    try { leafId = resolveActivationIdentity(leaf); } catch { leafId = ''; }
    if (!leafId || leafId.slice(0, 4) !== 'nav:') return false;
    try {
      const hostId = resolveActivationIdentity(host);
      if (hostId && hostId !== leafId) return false;
    } catch { /* ignore */ }
    try {
      if (!this.composedContains(host, leaf)) return false;
    } catch {
      return false;
    }
    // Gmail row labels are mostly the link text ("Inbox 89"). A lone @mention
    // inside tweet prose is a small fraction — keep the mention's own ring
    // (two mentions already fail uniqueDescendantNavigableLink).
    try {
      const hostText = String(host.innerText || '').replace(/\s+/g, ' ').trim();
      const leafText = String(leaf.innerText || leaf.textContent || '').replace(/\s+/g, ' ').trim();
      if (hostText.length >= 8 && leafText.length >= 1 &&
          leafText.length < hostText.length * 0.45) {
        return false;
      }
    } catch { /* continue */ }
    // Full-width layout slots around a centered CTA (Crunchyroll
    // `.perks-section-unlock-more-perks-button-slot` is ~1050×40 for a 183×40
    // button). Same-height hosts that are much wider are not label rows.
    try {
      const lr = leaf.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      if (lr.width > 0 && lr.height > 0 && hr.width > 0 && hr.height > 0) {
        const sameHeight = hr.height <= Math.max(lr.height * 1.15, lr.height + 4);
        if (sameHeight && hr.width > lr.width * 2.2 + 24) return false;
      }
    } catch { /* continue */ }
    try {
      const unique = uniqueDescendantNavigableLink(host);
      if (!unique?.link) return false;
      if (unique.link === leaf) return true;
      let leafHref = '';
      try { leafHref = String(/** @type {any} */ (leaf).href || '').trim(); } catch { leafHref = ''; }
      return !!(leafHref && unique.url === leafHref);
    } catch {
      return false;
    }
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
    return pierceElementFromPoint(x, y);
  }

  /**
   * URL + element for G / B / E / P / Copy URL.
   * Ancestor <a href> first; then a descendant permalink inside a card.
   * @param {Element|null|undefined} el
   * @returns {{ url: string, link: Element }|null}
   */
  resolveHoveredLink(el) {
    return resolveHoveredLink(el);
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
    // Shadow-root children have parentElement === null; compare against the host.
    try {
      if (!window.getComputedStyle) return false;
      const probe = () => {
        const own = window.getComputedStyle(el).cursor;
        if (own !== 'pointer') return false;
        let parent = el.parentElement;
        if (!parent) {
          try {
            const root = typeof el.getRootNode === 'function' ? el.getRootNode() : null;
            if (root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
              parent = root.host || null;
            }
          } catch { /* ignore */ }
        }
        if (!parent || parent === document.body || parent === document.documentElement) {
          return true;
        }
        return window.getComputedStyle(parent).cursor !== 'pointer';
      };
      // Avoid class thrash when Crosshair override is off.
      return this._isCursorOverrideActive() ? this._withNativePageCursors(probe) : probe();
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
    const hasJsAction = this.hasJsActionHandler(el);
    let hasClickHandler = hasInlineClick || hasTrackedClick || hasJsAction;
    if (hasClickHandler && !matchesSelector && !hasRole && !hasInlineClick &&
        this.isCompositeClickContainer(el, role)) {
      hasClickHandler = false;
    }
    if (hasClickHandler && hasJsAction && !hasInlineClick && !hasTrackedClick &&
        !matchesSelector && !hasRole && this._isJsActionDelegationShell(el)) {
      hasClickHandler = false;
    }

    // getComputedStyle() is relatively expensive; only use it as a last resort.
    // Ignore inherited cursor:pointer from body/html-wide styles.
    // Do not promote a full-width header/nav shell just because it sets
    // cursor:pointer (NVIDIA `.nav-header` / `nav.global-nav`).
    let hasCursor = false;
    if (allowCursor && !matchesSelector && !hasRole && !hasClickHandler &&
        !this._isFullBleedChromeBar(el)) {
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

    // Native range that already paints its own track (Docs/Settings scale sliders).
    // Do not promote a wrapping <label> or titlebar chrome as seek geometry.
    try {
      if (this.isNativeType(control, 'range') && controlRect && controlRect.width >= 40) {
        return /** @type {HTMLElement} */ (control);
      }
    } catch { /* ignore */ }

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

  /**
   * Walk ancestors for an interactive target.
   * @param {Element|null|undefined} el
   * @param {{ allowCursor?: boolean }} [opts]
   * @returns {Element|null}
   */
  _findClickableWalk(el, opts = {}) {
    const allowCursor = opts.allowCursor !== false;
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
      if (allowCursor && !cursorOnlyCandidate && this.isLikelyInteractive(n, { allowCursor: true })) {
        cursorOnlyCandidate = n;
      }

      n = n.parentElement || (n.getRootNode() instanceof ShadowRoot ? n.getRootNode().host : null);
      depth++;
    }

    if (!allowCursor) return null;

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

  findClickable(el) {
    // Standard interactive walk only — no scrubber "proximity" remapping of hover focus.
    // F-activation still resolves scrubbers from the hit target in ActivationHandler.
    //
    // Two-pass on purpose (see focus-ring-paint.md performance notes):
    // 1) Semantic-only walk — never toggles html.kpv2-cursor-hidden. This is the
    //    common case (links/buttons) and must stay as cheap as No-custom-cursor.
    // 2) Cursor:pointer fallback — suspend the Crosshair override once for the
    //    whole walk. Eager suspend-on-every-findClickable was invalidating styles
    //    for the entire document on each pointerover and made Crosshair feel like
    //    a slower / different outline path even though paint is still A→B→C.
    const semantic = this._findClickableWalk(el, { allowCursor: false });
    if (semantic) return semantic;

    if (this._isCursorOverrideActive()) {
      return this._withNativePageCursors(() =>
        this._findClickableWalk(el, { allowCursor: true })
      );
    }
    return this._findClickableWalk(el, { allowCursor: true });
  }

  /**
   * True when `el` is redundant nested chrome of `host`: F on the leaf would
   * do the same thing as F on the host (same navigation / implied permalink).
   *
   * Different URL or a distinct action (like / reply / Show more) is not chrome.
   * Flyouts that only share a DOM ancestor still get their own ring.
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

    try {
      if (this._isFullBleedChromeBar(host)) return false;
    } catch { /* ignore */ }

    // Flyout descendants sit outside the host's painted chip (NVIDIA mega-menu).
    try {
      const er = el.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      if (er.width > 0 && er.height > 0 && hr.width > 0 && hr.height > 0) {
        const overlapW = Math.max(0, Math.min(er.right, hr.right) - Math.max(er.left, hr.left));
        const overlapH = Math.max(0, Math.min(er.bottom, hr.bottom) - Math.max(er.top, hr.top));
        const eArea = er.width * er.height;
        const overlapArea = overlapW * overlapH;
        if (overlapArea < eArea * 0.4) return false;
      }
    } catch { /* ignore */ }

    try {
      return this._skipForParentDestinationsMatch(el, host);
    } catch {
      return false;
    }
  }

  /**
   * Top-bar disclosure chip (NVIDIA Products, etc.): small painted box that
   * owns a large DOM flyout. Used to avoid sticky-hover on the chip.
   * @param {Element} el
   * @returns {boolean}
   */
  _isCompactDisclosureHost(el) {
    if (!el || el.nodeType !== 1) return false;
    let role = '';
    let hasPopup = false;
    try {
      role = ((el.getAttribute && el.getAttribute('role')) || '').trim().toLowerCase();
      hasPopup = !!(el.getAttribute && el.getAttribute('aria-haspopup'));
    } catch { /* ignore */ }
    if (role !== 'menuitem' && !hasPopup) return false;
    try {
      const r = el.getBoundingClientRect();
      if (!r || r.width <= 0 || r.height <= 0) return false;
      return r.height <= 72 && r.width <= 280;
    } catch {
      return true;
    }
  }

  /**
   * Settings → Click Mode → Skip for parent (on by default).
   * @returns {boolean}
   */
  _skipForParentEnabled() {
    try {
      const v = window.keyPilot?._settings?.clickMode?.skipForParent;
      if (v === false) return false;
    } catch { /* default on */ }
    return true;
  }

  /**
   * Larger same-destination card/overlay to hover instead of `leaf`.
   * Sibling stretched links (Home Depot product-pod overlay) count; a
   * different-destination child (Add to Cart) is never replaced.
   * @param {Element} leaf
   * @returns {Element|null}
   */
  _findSkipForParentHost(leaf) {
    if (!this._skipForParentEnabled()) return null;
    if (!leaf || leaf.nodeType !== 1) return null;

    let leafRect = null;
    try { leafRect = leaf.getBoundingClientRect(); } catch { leafRect = null; }
    if (!leafRect || !(leafRect.width > 0) || !(leafRect.height > 0)) return null;
    const leafArea = leafRect.width * leafRect.height;

    /** @type {Element|null} */
    let best = null;
    let bestArea = 0;

    const consider = (el) => {
      if (!el || el === leaf || el.nodeType !== 1) return;
      try {
        // Explicit cursor:pointer counts (Gmail `tr.zA`); inherited pointer does not.
        // jsaction is a skip-host signal only — not a global hover target (list
        // shells / Google News chip strips with many tabs).
        // Label rows that only wrap a nested <a> (Gmail Inbox/Starred) are not
        // independently interactive — still valid skip hosts.
        const ok = this.isLikelyInteractive(el, { allowCursor: true }) ||
          (this.hasJsActionHandler(el) && !this._isJsActionDelegationShell(el)) ||
          this._hostPrimaryNavMatchesLeaf(leaf, el);
        if (!ok) return;
      } catch {
        return;
      }
      try {
        if (this._isFullBleedChromeBar(el) || this.isCompositeClickContainer(el)) return;
      } catch { /* ignore */ }
      try {
        if (!this._skipForParentDestinationsMatch(leaf, el)) return;
      } catch {
        return;
      }
      let r = null;
      try { r = el.getBoundingClientRect(); } catch { r = null; }
      // 24px: compact Gmail rows; 32px excluded those.
      if (!r || r.width < 100 || r.height < 24) return;
      const area = r.width * r.height;
      if (area < leafArea * 1.35) return;
      // Inbox table wrappers / feed shells, not the message row.
      if (r.height > Math.max(96, leafRect.height * 4) && area > leafArea * 8) return;
      const overlapW = Math.max(0, Math.min(r.right, leafRect.right) - Math.max(r.left, leafRect.left));
      const overlapH = Math.max(0, Math.min(r.bottom, leafRect.bottom) - Math.max(r.top, leafRect.top));
      if (overlapW * overlapH < leafArea * 0.8) return;
      if (area > bestArea) {
        bestArea = area;
        best = el;
      }
    };

    let n = leaf;
    let depth = 0;
    while (n && n !== document.body && n.nodeType === 1 && depth++ < 14) {
      consider(n);
      let parent = null;
      try {
        parent = n.parentElement ||
          (typeof n.getRootNode === 'function' && n.getRootNode() instanceof ShadowRoot
            ? n.getRootNode().host
            : null);
      } catch {
        parent = n.parentElement;
      }
      if (!parent || parent.nodeType !== 1 || parent === document.body) break;
      try {
        const kids = parent.children;
        if (kids) {
          for (let i = 0; i < kids.length; i++) consider(kids[i]);
        }
      } catch { /* ignore */ }
      n = parent;
    }

    return best;
  }

  /**
   * @param {Element|null|undefined} el
   * @returns {Element|null|undefined}
   */
  _applySkipForParent(el) {
    if (!el || el.nodeType !== 1) return el;
    try {
      const host = this._findSkipForParentHost(el);
      if (host) return host;
    } catch { /* keep el */ }
    return el;
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
   * CSS "stretched link" metrics: `a::after { position:absolute; inset:0 }` (etc.)
   * expands the hit region to a card while getBoundingClientRect stays on the label.
   * Pattern used by msn.com `cs-responsive-card` headlines (and many card grids).
   *
   * @param {Element} el
   * @returns {{ w: number, h: number, pseudo: string, contentRect: DOMRect }|null}
   */
  _getStretchedLinkMetrics(el) {
    if (!el || el.nodeType !== 1) return null;
    const tag = el.tagName;
    const role = ((el.getAttribute && el.getAttribute('role')) || '').trim().toLowerCase();
    if (tag !== 'A' && role !== 'link') return null;

    let er = null;
    try { er = el.getBoundingClientRect(); } catch { er = null; }
    if (!er || !(er.width > 0) || !(er.height > 0)) return null;
    const contentArea = er.width * er.height;

    for (const pseudo of ['::after', '::before']) {
      let cs = null;
      try { cs = window.getComputedStyle(el, pseudo); } catch { cs = null; }
      if (!cs) continue;
      const content = cs.content;
      if (!content || content === 'none' || content === 'normal') continue;
      if (cs.position !== 'absolute' && cs.position !== 'fixed') continue;
      if (cs.pointerEvents === 'none') continue;

      const w = parseFloat(cs.width);
      const h = parseFloat(cs.height);
      if (!Number.isFinite(w) || !Number.isFinite(h) || w < 40 || h < 40) continue;

      const overlayArea = w * h;
      // Must meaningfully expand beyond the label box (card vs title line).
      if (overlayArea < contentArea * 1.6) continue;
      if (w < er.width * 1.05 && h < er.height * 1.25) continue;

      return { w, h, pseudo, contentRect: er };
    }
    return null;
  }

  /**
   * Closest ancestor (incl. open-shadow hosts) whose box matches the stretched
   * pseudo size — typically the card shell (`.root` / `cs-responsive-card`).
   * Prefers a same-size semantic host (article / href-bearing custom element).
   *
   * @param {Element} el
   * @param {{ w: number, h: number }} stretch
   * @returns {Element|null}
   */
  _findStretchedLinkCoverHost(el, stretch) {
    if (!el || !stretch) return null;

    let n = el.parentElement ||
      (typeof el.getRootNode === 'function' && el.getRootNode() instanceof ShadowRoot
        ? el.getRootNode().host
        : null);
    let depth = 0;
    /** @type {Element|null} */
    let best = null;

    while (n && n !== document.body && n.nodeType === 1 && depth++ < 12) {
      if (n === document.documentElement) break;

      let r = null;
      try { r = n.getBoundingClientRect(); } catch { r = null; }
      if (r && r.width > 0 && r.height > 0) {
        const dw = Math.abs(r.width - stretch.w);
        const dh = Math.abs(r.height - stretch.h);
        if (dw <= 6 && dh <= 6) {
          best = n;
          const role = ((n.getAttribute && n.getAttribute('role')) || '').trim().toLowerCase();
          const href = typeof /** @type {any} */ (n).href === 'string'
            ? /** @type {any} */ (n).href
            : (n.getAttribute && n.getAttribute('href'));
          const semantic = !!(href) ||
            role === 'link' || role === 'article' || role === 'listitem' ||
            n.tagName === 'A' || n.tagName === 'ARTICLE';
          if (semantic) return n;
        } else if (best) {
          // Left the matching-size band — return last geometric match.
          break;
        }
        // Don't climb into huge feed / page shells.
        if (r.width * r.height > stretch.w * stretch.h * 4) break;
      }

      n = n.parentElement ||
        (typeof n.getRootNode === 'function' && n.getRootNode() instanceof ShadowRoot
          ? n.getRootNode().host
          : null);
    }
    return best;
  }

  /**
   * Stretched-link hover: outline the card shell when the pointer is only on the
   * ::before/::after hit expansion (media / chrome); keep the link when the
   * pointer is on the visible label (headline text).
   *
   * @param {Element} leaf - semantic link from findClickable
   * @param {number|null|undefined} clientX
   * @param {number|null|undefined} clientY
   * @returns {Element|null} leaf, cover host, or null if not a stretched link
   */
  _resolveStretchedLinkHoverTarget(leaf, clientX = null, clientY = null) {
    const stretch = this._getStretchedLinkMetrics(leaf);
    if (!stretch) return null;

    const hasPoint = Number.isFinite(clientX) && Number.isFinite(clientY);
    // On the visible label → headline ring (TNW-style title target).
    if (hasPoint && this.pointInElementUnionBox(leaf, clientX, clientY, 1)) {
      return leaf;
    }

    const cover = this._findStretchedLinkCoverHost(leaf, stretch);
    if (!cover) return null;
    if (hasPoint && !this.pointInElementUnionBox(cover, clientX, clientY, 2)) {
      return null;
    }
    return cover;
  }

  /**
   * Large clickable sibling under non-interactive overlay chrome.
   *
   * Pattern (thenextweb.com visual cards, many news grids):
   *   .card
   *     a.card__image   ← full-bleed media link
   *     header          ← absolute overlay (topic + title); not itself clickable
   *       h2 > a        ← headline (separate primary target)
   *       span.topic
   *
   * Ancestor-only findClickable(header|topic) returns null even though the
   * media <a> sits under the pointer in the paint stack. Prefer that underlay
   * so the large rectangle gets the hover ring unless the user is on the
   * headline (or other real nested control).
   *
   * @param {Element} under - deepest hit node (not interactive)
   * @returns {Element|null}
   */
  _findSiblingUnderlayClickable(under) {
    if (!under || under.nodeType !== 1) return null;

    let n = under;
    let depth = 0;
    while (n && n !== document.body && n.nodeType === 1 && depth++ < 10) {
      const parent = n.parentElement ||
        (typeof n.getRootNode === 'function' && n.getRootNode() instanceof ShadowRoot
          ? n.getRootNode().host
          : null);
      if (!parent || parent.nodeType !== 1) break;
      if (parent === document.body || parent === document.documentElement) break;

      // Do not promote out of composite containers (nav/tablist/menu…) —
      // those hosts often have many large interactive children.
      try {
        if (this.isCompositeClickContainer(parent)) {
          n = parent;
          continue;
        }
      } catch { /* ignore */ }

      let underRect = null;
      try { underRect = n.getBoundingClientRect(); } catch { underRect = null; }

      try {
        const kids = parent.children;
        if (!kids || !kids.length) {
          n = parent;
          continue;
        }

        /** @type {Element|null} */
        let best = null;
        let bestArea = 0;

        for (let i = 0; i < kids.length; i++) {
          const sib = kids[i];
          if (!sib || sib === n || sib.nodeType !== 1) continue;
          // Must be a real interactive target (not cursor:pointer alone on chrome).
          if (!this.isLikelyInteractive(sib, { allowCursor: false })) continue;

          let sr = null;
          try { sr = sib.getBoundingClientRect(); } catch { sr = null; }
          if (!sr || sr.width < 80 || sr.height < 40) continue;

          // Sibling must substantially cover the overlay chrome we hit (media
          // underlay), not merely sit beside it in a row/column layout.
          if (underRect) {
            const overlapW =
              Math.max(0, Math.min(sr.right, underRect.right) - Math.max(sr.left, underRect.left));
            const overlapH =
              Math.max(0, Math.min(sr.bottom, underRect.bottom) - Math.max(sr.top, underRect.top));
            const underArea = Math.max(1, underRect.width * underRect.height);
            const overlapArea = overlapW * overlapH;
            // Require most of the overlay box to sit over the sibling.
            if (overlapArea < underArea * 0.55) continue;
            // Sibling should be at least as large as the overlay (card media).
            if (sr.width * sr.height < underArea * 0.85) continue;
          }

          const area = sr.width * sr.height;
          if (area > bestArea) {
            bestArea = area;
            best = sib;
          }
        }

        if (best) return best;
      } catch { /* ignore */ }

      n = parent;
    }

    return null;
  }

  /**
   * True when (clientX, clientY) lies inside the element's union bounding box
   * (getBoundingClientRect), optionally padded. Used for multi-line link gaps:
   * hit-testing skips space between line boxes, but the union rect still covers them.
   * @param {Element} el
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} [padPx]
   * @returns {boolean}
   */
  pointInElementUnionBox(el, clientX, clientY, padPx = 2) {
    if (!el || el.nodeType !== 1) return false;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
    let r = null;
    try { r = el.getBoundingClientRect(); } catch { r = null; }
    if (!r || !(r.width > 0) || !(r.height > 0)) return false;
    const pad = Number.isFinite(padPx) ? padPx : 2;
    return (
      clientX >= r.left - pad &&
      clientX <= r.right + pad &&
      clientY >= r.top - pad &&
      clientY <= r.bottom + pad
    );
  }

  /**
   * Resolve the element that should receive hover focus chrome / F-activate.
   * Stabilizes against nested controls and brief nulls while still inside the
   * previous host (generic fix for list rows, tabs, cards — not site-specific).
   *
   * @param {Element|null|undefined} underEl - Deepest node under the pointer
   * @param {Element|null|undefined} prevFocus - Previous hover focus element
   * @param {number|null|undefined} [clientX] - pointer x (for multi-line gap sticky)
   * @param {number|null|undefined} [clientY] - pointer y
   * @returns {Element|null}
   */
  resolveHoverFocusTarget(underEl, prevFocus = null, clientX = null, clientY = null) {
    const under = underEl && underEl.nodeType === 1 ? underEl : null;
    const prev = prevFocus && prevFocus.nodeType === 1 && prevFocus.isConnected
      ? prevFocus
      : null;
    const hasPoint = Number.isFinite(clientX) && Number.isFinite(clientY);

    // Sticky: pointer still inside previous host → keep it when leaf is missing
    // or is nested chrome (avoids thrash / clear between children).
    // Use composedContains so open-shadow tile content (archive.org collection-tile
    // inside tile-dispatcher <a>) still counts as "inside" the focused link.
    if (prev && under) {
      // Fast path: still on the same node.
      if (under === prev) return prev;

      try {
        if (this.composedContains(prev, under)) {
          // Compact disclosure (menuitem chip + mega-menu): the flyout is a
          // DOM child but sits outside the chip box. Do not sticky-keep the
          // chip while the pointer is in the panel.
          const flyoutAwayFromChip =
            hasPoint &&
            this._isCompactDisclosureHost(prev) &&
            !this.pointInElementUnionBox(prev, clientX, clientY, 4);
          if (!flyoutAwayFromChip) {
            // IMPORTANT: do NOT use Element.closest() here. closest() stops at
            // shadow roots, so open-shadow leaves (archive.org tiles, MSN Fluent)
            // always look like "no primary ancestor" and we'd keep `prev` forever
            // while the pointer moves across different shadow interactives that
            // still compose-contain under the same host. findClickable walks
            // parentElement + shadow host hops and is the source of truth.
            const leafInside = this.findClickable(under);
            // Stretched link (msn.com card ::after): switch between card shell and
            // headline label by geometry — must run before nested-chrome sticky, or
            // the small title <a> is treated as chrome inside the card forever.
            if (leafInside) {
              try {
                const stretchTarget = this._resolveStretchedLinkHoverTarget(
                  leafInside, clientX, clientY
                );
                if (stretchTarget) return this._applySkipForParent(stretchTarget);
              } catch { /* ignore */ }
            }
            if (!leafInside || leafInside === prev || this._isNestedHoverChrome(leafInside, prev)) {
              return prev;
            }
            // Leaf is a distinct primary target inside prev (e.g. large nested link):
            // still prefer host for row-sized role=link / tab.
            const host = this._findPreferableHoverHost(leafInside);
            if (host === prev) return prev;
            if (host) return this._applySkipForParent(host);
            return this._applySkipForParent(leafInside);
          }
        }
      } catch { /* ignore */ }

      // Sticky for underlay media: previous focus is a large sibling under the
      // non-interactive overlay the pointer is on (header/topic over card image).
      // composedContains(prev, under) is false for siblings, so the block above
      // does not apply — still keep the card rectangle unless a new leaf target
      // (headline link) is under the pointer.
      try {
        if (!this.findClickable(under)) {
          const underlay = this._findSiblingUnderlayClickable(under);
          if (underlay === prev) return prev;
        }
      } catch { /* ignore */ }
    }

    // Multi-line / wrapped clickable text: gaps between line boxes are not part
    // of the element's hit region, so `under` jumps to a parent/sibling and
    // focus would clear (outline flicker on A/B/C). If the pointer is still
    // inside prev's union bounding rect, keep prev unless a different primary
    // clickable actually owns the point.
    if (prev && hasPoint && this.pointInElementUnionBox(prev, clientX, clientY, 3)) {
      let leafAtPoint = null;
      try {
        leafAtPoint = under ? this.findClickable(under) : null;
      } catch {
        leafAtPoint = null;
      }
      // Stretched link inside a card-sized prev: allow media↔headline retarget.
      if (leafAtPoint) {
        try {
          const stretchTarget = this._resolveStretchedLinkHoverTarget(
            leafAtPoint, clientX, clientY
          );
          if (stretchTarget) return this._applySkipForParent(stretchTarget);
        } catch { /* ignore */ }
      }
      if (!leafAtPoint || leafAtPoint === prev || this._isNestedHoverChrome(leafAtPoint, prev)) {
        return prev;
      }
      // Full-width header/nav previously hovered: inner menu items must win.
      try {
        if (this._isFullBleedChromeBar(prev) && leafAtPoint !== prev) {
          const host = this._findPreferableHoverHost(leafAtPoint);
          return this._applySkipForParent(host || leafAtPoint);
        }
      } catch { /* ignore */ }
      try {
        if (
          !this.composedContains(prev, leafAtPoint) &&
          this.pointInElementUnionBox(leafAtPoint, clientX, clientY, 1)
        ) {
          const host = this._findPreferableHoverHost(leafAtPoint);
          return this._applySkipForParent(host || leafAtPoint);
        }
      } catch { /* keep prev */ }
      return prev;
    }

    if (!under) return null;

    const leaf = this.findClickable(under);
    if (!leaf) {
      // Non-interactive overlay on top of full-bleed media/link (TNW cards, etc.).
      const underlay = this._findSiblingUnderlayClickable(under);
      if (!underlay) return null;
      const underlayHost = this._findPreferableHoverHost(underlay);
      return this._applySkipForParent(underlayHost || underlay);
    }

    // msn.com-style stretched headline: card shell on media/chrome, link on title.
    try {
      const stretchTarget = this._resolveStretchedLinkHoverTarget(leaf, clientX, clientY);
      if (stretchTarget) return this._applySkipForParent(stretchTarget);
    } catch { /* ignore */ }

    const host = this._findPreferableHoverHost(leaf);
    return this._applySkipForParent(host || leaf);
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

      // 3) Button / disclosure summary — findClickable returns the host when hovering children
      if (el.tagName === 'BUTTON' || role === 'button' || el.tagName === 'SUMMARY') {
        return CLICKABLE_CATEGORY.BUTTON;
      }
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
