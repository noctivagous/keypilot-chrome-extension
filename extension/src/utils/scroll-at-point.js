/**
 * Cursor-aware keyboard scrolling.
 *
 * C / V (delta) and Z / X (edge) should scroll the nearest overflow container
 * under the pointer first; only if nothing nested can scroll do we fall back
 * to the document / window. Horizontal-only overflow maps up/left and
 * down/right; mixed or vertical-only overflow uses up/down.
 */

/** Pixels of slack when testing whether an edge still has room to scroll. */
const EDGE_EPS = 1;

/**
 * KeyPilot uses `auto` for Settings "instant" (and Fade edge-jumps).
 * CSSOM `behavior: 'auto'` is NOT instant — it follows CSS `scroll-behavior`.
 * @param {string|null|undefined} behavior
 * @returns {boolean}
 */
export function isInstantScrollBehavior(behavior) {
  return behavior === 'auto' || behavior === 'instant';
}

/**
 * @param {Element|null|undefined} el
 * @param {Document} [doc]
 * @returns {Element[]}
 */
function collectScrollBehaviorNodes(el, doc) {
  /** @type {Element[]} */
  const nodes = [];
  const add = (n) => {
    if (n && n.nodeType === 1 && !nodes.includes(n)) nodes.push(n);
  };
  add(el);
  try {
    add(doc?.scrollingElement);
    add(doc?.documentElement);
    add(doc?.body);
  } catch { /* ignore */ }
  return nodes;
}

/**
 * Temporarily force CSS `scroll-behavior: auto` so assignment / two-arg
 * `scrollTo` cannot be interpolated.
 * @param {Element[]} nodes
 * @returns {() => void}
 */
function forceCssScrollBehaviorAuto(nodes) {
  /** @type {{ node: Element, had: boolean, value: string }[]} */
  const saved = [];
  for (const node of nodes) {
    try {
      const style = node.style;
      if (!style) continue;
      saved.push({
        node,
        had: style.getPropertyValue('scroll-behavior') !== '',
        value: style.getPropertyValue('scroll-behavior')
      });
      style.setProperty('scroll-behavior', 'auto', 'important');
    } catch { /* ignore */ }
  }
  return () => {
    for (const { node, had, value } of saved) {
      try {
        if (had) node.style.setProperty('scroll-behavior', value);
        else node.style.removeProperty('scroll-behavior');
      } catch { /* ignore */ }
    }
  };
}

/**
 * Best-effort: Lenis / similar engines keep lerping after native scrollTo.
 * @param {Window|null|undefined} win
 * @param {number} left
 * @param {number} top
 */
function tryHijackInstant(win, left, top) {
  if (!win) return;
  const inst = win.lenis;
  if (inst && typeof inst.scrollTo === 'function') {
    try {
      inst.scrollTo(top, { immediate: true, force: true, lock: false });
    } catch {
      try { inst.scrollTo(top, { immediate: true }); } catch { /* ignore */ }
    }
  }
  const loco = win.locoScroll || win.locomotiveScroll;
  if (loco && typeof loco.scrollTo === 'function') {
    try {
      loco.scrollTo(top, { duration: 0, disableLerp: true, immediate: true });
    } catch { /* ignore */ }
  }
}

/**
 * Jump `el` to an absolute offset in one frame (ignores CSS smooth scrolling).
 * @param {Element} el
 * @param {number} left
 * @param {number} top
 * @param {Document} [doc]
 * @param {Window} [win]
 * @returns {boolean}
 */
export function applyInstantScrollTo(el, left, top, doc = document, win = window) {
  if (!el) return false;
  const L = Number(left) || 0;
  const T = Number(top) || 0;
  const restore = forceCssScrollBehaviorAuto(collectScrollBehaviorNodes(el, doc));
  try {
    try { void el.offsetHeight; } catch { /* flush */ }

    try {
      if (typeof el.scrollTo === 'function') {
        try {
          el.scrollTo({ left: L, top: T, behavior: 'instant' });
        } catch {
          el.scrollTo(L, T);
        }
      }
    } catch { /* ignore */ }

    try {
      el.scrollLeft = L;
      el.scrollTop = T;
    } catch { /* ignore */ }

    if (isDocumentScrollRoot(el, doc) && win && typeof win.scrollTo === 'function') {
      try {
        try {
          win.scrollTo({ left: L, top: T, behavior: 'instant' });
        } catch {
          win.scrollTo(L, T);
        }
      } catch { /* ignore */ }
    }

    tryHijackInstant(win, L, T);
    return true;
  } finally {
    restore();
  }
}

/**
 * @param {Element|null|undefined} el
 * @param {Document} [doc]
 * @param {Window} [win]
 * @returns {{ x: number, y: number }}
 */
export function readScrollPoint(el, doc = document, win = window) {
  try {
    if (el && !isDocumentScrollRoot(el, doc)) {
      return { x: Number(el.scrollLeft) || 0, y: Number(el.scrollTop) || 0 };
    }
  } catch { /* fall through */ }
  try {
    return {
      x: Number(win.scrollX ?? win.pageXOffset) || 0,
      y: Number(win.scrollY ?? win.pageYOffset) || 0
    };
  } catch {
    return { x: 0, y: 0 };
  }
}

/**
 * Wait until the scroller stops moving (or `timeoutMs`), so a Fade veil is
 * not lifted while CSS/Lenis is still interpolating.
 * @param {Element|null|undefined} el
 * @param {{ timeoutMs?: number, doc?: Document, win?: Window }} [opts]
 * @returns {Promise<void>}
 */
export function waitForScrollSettle(el, opts = {}) {
  const doc = opts.doc || el?.ownerDocument || document;
  const win = opts.win || doc.defaultView || window;
  const timeoutMs = Number.isFinite(Number(opts.timeoutMs))
    ? Math.max(0, Number(opts.timeoutMs))
    : 480;

  return new Promise((resolve) => {
    let last = readScrollPoint(el, doc, win);
    let stableFrames = 0;
    const t0 = typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const tick = () => {
      if (done) return;
      const now = typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
      const p = readScrollPoint(el, doc, win);
      if (Math.abs(p.x - last.x) < 1 && Math.abs(p.y - last.y) < 1) stableFrames += 1;
      else stableFrames = 0;
      last = p;
      if (stableFrames >= 2 || now - t0 >= timeoutMs) {
        finish();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Composed parent: light DOM parent, or open shadow host when crossing a root.
 * @param {Node|null|undefined} node
 * @returns {Element|null}
 */
function composedParent(node) {
  if (!node || node.nodeType !== 1) return null;
  const el = /** @type {Element} */ (node);
  if (el.parentElement) return el.parentElement;
  try {
    const root = typeof el.getRootNode === 'function' ? el.getRootNode() : null;
    if (root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
      return root.host || null;
    }
  } catch { /* ignore */ }
  return null;
}

import { deepElementFromPoint as elementFromPointDeep } from './element-from-point.js';
export { elementFromPointDeep };

/**
 * @param {string|null|undefined} overflow
 * @returns {boolean}
 */
function overflowAllowsScroll(overflow) {
  const o = String(overflow || '').toLowerCase();
  return o === 'auto' || o === 'scroll' || o === 'overlay';
}

/**
 * True when `el` is the document scrolling root (html / body / scrollingElement).
 * These often report overflow:visible yet still scroll the viewport.
 * @param {Element} el
 * @param {Document} doc
 * @returns {boolean}
 */
export function isDocumentScrollRoot(el, doc) {
  try {
    const se = doc.scrollingElement;
    if (se && el === se) return true;
    if (el === doc.documentElement || el === doc.body) return true;
  } catch { /* ignore */ }
  return false;
}

/**
 * @typedef {{ canY: boolean, canX: boolean, maxTop: number, maxLeft: number }} ScrollCapacity
 */

/**
 * @param {Element} el
 * @param {Document} doc
 * @returns {ScrollCapacity}
 */
export function getScrollCapacity(el, doc = document) {
  if (!el || el.nodeType !== 1) {
    return { canY: false, canX: false, maxTop: 0, maxLeft: 0 };
  }

  let maxTop = 0;
  let maxLeft = 0;
  try {
    maxTop = Math.max(0, (el.scrollHeight || 0) - (el.clientHeight || 0));
    maxLeft = Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0));
  } catch {
    return { canY: false, canX: false, maxTop: 0, maxLeft: 0 };
  }

  // Document roots: treat as scrollable when content overflows even if CSS
  // overflow is visible (browser default viewport scrolling).
  if (isDocumentScrollRoot(el, doc)) {
    return {
      canY: maxTop > EDGE_EPS,
      canX: maxLeft > EDGE_EPS,
      maxTop,
      maxLeft
    };
  }

  let oy = '';
  let ox = '';
  try {
    const cs = (el.ownerDocument?.defaultView || window).getComputedStyle(el);
    oy = cs?.overflowY || '';
    ox = cs?.overflowX || '';
  } catch {
    return { canY: false, canX: false, maxTop: 0, maxLeft: 0 };
  }

  return {
    canY: overflowAllowsScroll(oy) && maxTop > EDGE_EPS,
    canX: overflowAllowsScroll(ox) && maxLeft > EDGE_EPS,
    maxTop,
    maxLeft
  };
}

/**
 * @param {Element} el
 * @param {'y'|'x'} axis
 * @param {number} sign  -1 = up/left, +1 = down/right
 * @returns {boolean}
 */
export function canScrollInDirection(el, axis, sign) {
  if (!el) return false;
  try {
    if (axis === 'y') {
      const top = el.scrollTop || 0;
      if (sign < 0) return top > EDGE_EPS;
      const max = Math.max(0, (el.scrollHeight || 0) - (el.clientHeight || 0));
      return top < max - EDGE_EPS;
    }
    const left = el.scrollLeft || 0;
    if (sign < 0) return left > EDGE_EPS;
    const max = Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0));
    return left < max - EDGE_EPS;
  } catch {
    return false;
  }
}

/**
 * Apply a delta to an element (or window for document roots).
 * @param {Element} el
 * @param {number} deltaX
 * @param {number} deltaY
 * @param {ScrollBehavior} [behavior]
 * @param {Document} [doc]
 * @param {Window} [win]
 * @returns {boolean}
 */
export function scrollElementBy(el, deltaX, deltaY, behavior = 'smooth', doc = document, win = window) {
  if (!el) return false;
  const dx = Number(deltaX) || 0;
  const dy = Number(deltaY) || 0;
  if (!dx && !dy) return false;

  if (isInstantScrollBehavior(behavior)) {
    const left = (Number(el.scrollLeft) || 0) + dx;
    const top = (Number(el.scrollTop) || 0) + dy;
    return applyInstantScrollTo(el, left, top, doc, win);
  }

  const opts = { left: dx, top: dy, behavior };

  // Prefer element.scrollBy; fall back to mutating scrollTop/scrollLeft.
  try {
    if (typeof el.scrollBy === 'function') {
      el.scrollBy(opts);
      return true;
    }
  } catch { /* fall through */ }

  try {
    if (behavior === 'smooth' && typeof el.scrollTo === 'function') {
      el.scrollTo({
        left: (el.scrollLeft || 0) + dx,
        top: (el.scrollTop || 0) + dy,
        behavior
      });
      return true;
    }
  } catch { /* fall through */ }

  try {
    if (dx) el.scrollLeft = (el.scrollLeft || 0) + dx;
    if (dy) el.scrollTop = (el.scrollTop || 0) + dy;
    return true;
  } catch { /* ignore */ }

  // Last resort for document roots.
  if (isDocumentScrollRoot(el, doc) && win && typeof win.scrollBy === 'function') {
    try {
      win.scrollBy(opts);
      return true;
    } catch {
      try {
        win.scrollBy(dx, dy);
        return true;
      } catch { /* ignore */ }
    }
  }

  return false;
}

/**
 * Current offset on an axis (element, or window for document roots).
 * @param {Element|null|undefined} el
 * @param {'y'|'x'} axis
 * @param {Document} [doc]
 * @param {Window} [win]
 * @returns {number}
 */
export function readScrollAxisPos(el, axis, doc = document, win = window) {
  try {
    if (el && axis === 'x') return Number(el.scrollLeft) || 0;
    if (el && axis === 'y') return Number(el.scrollTop) || 0;
  } catch { /* fall through */ }
  try {
    if (axis === 'x') return Number(win.scrollX || win.pageXOffset) || 0;
    return Number(win.scrollY || win.pageYOffset) || 0;
  } catch {
    return 0;
  }
}

/**
 * Scroll an element (or window for document roots) to an absolute axis position.
 * Prefer this over stacking `scrollBy` while a key is held so the browser can
 * retarget one smooth animation instead of fighting overlapping ones.
 * @param {Element} el
 * @param {'y'|'x'} axis
 * @param {number} pos
 * @param {ScrollBehavior} [behavior]
 * @param {Document} [doc]
 * @param {Window} [win]
 * @returns {boolean}
 */
export function scrollElementToPos(el, axis, pos, behavior = 'smooth', doc = document, win = window) {
  if (!el || (axis !== 'y' && axis !== 'x')) return false;
  const raw = Number(pos);
  if (!Number.isFinite(raw)) return false;

  let left = 0;
  let top = 0;
  try {
    if (axis === 'y') {
      const max = Math.max(0, (el.scrollHeight || 0) - (el.clientHeight || 0));
      left = el.scrollLeft || 0;
      top = Math.min(max, Math.max(0, raw));
    } else {
      const max = Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0));
      top = el.scrollTop || 0;
      left = Math.min(max, Math.max(0, raw));
    }
  } catch {
    return false;
  }

  if (isInstantScrollBehavior(behavior)) {
    return applyInstantScrollTo(el, left, top, doc, win);
  }

  const opts = { left, top, behavior };

  try {
    if (typeof el.scrollTo === 'function') {
      el.scrollTo(opts);
      return true;
    }
  } catch { /* fall through */ }

  try {
    if (axis === 'y') el.scrollTop = top;
    else el.scrollLeft = left;
    return true;
  } catch { /* ignore */ }

  if (isDocumentScrollRoot(el, doc) && win && typeof win.scrollTo === 'function') {
    try {
      win.scrollTo(opts);
      return true;
    } catch {
      try {
        if (axis === 'y') win.scrollTo(win.pageXOffset || 0, top);
        else win.scrollTo(left, win.pageYOffset || 0);
        return true;
      } catch { /* ignore */ }
    }
  }

  return false;
}

/**
 * Resolve which axis to use for a capacity snapshot.
 * Prefer vertical when it can move in `sign`; else horizontal when it can.
 * @param {ScrollCapacity} cap
 * @param {Element} el
 * @param {number} sign
 * @returns {'y'|'x'|null}
 */
function pickAxis(cap, el, sign) {
  if (cap.canY && canScrollInDirection(el, 'y', sign)) return 'y';
  if (cap.canX && canScrollInDirection(el, 'x', sign)) return 'x';
  return null;
}

/**
 * Find the best scroll target under a viewport point.
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} sign  -1 = up/left (C), +1 = down/right (V)
 * @param {{ doc?: Document, win?: Window }} [ctx]
 * @returns {{ el: Element, axis: 'y'|'x' }|null}
 */
export function findScrollTargetAtPoint(clientX, clientY, sign, ctx = {}) {
  const doc = ctx.doc || document;
  const x = Number(clientX);
  const y = Number(clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  let start = elementFromPointDeep(x, y, doc);
  // If hit-testing failed (e.g. over nothing), still allow document scroll.
  if (!start) {
    const se = doc.scrollingElement || doc.documentElement || doc.body;
    if (se) {
      const cap = getScrollCapacity(se, doc);
      const axis = pickAxis(cap, se, sign);
      if (axis) return { el: se, axis };
    }
    return null;
  }

  // Skip non-element / text nodes.
  if (start.nodeType !== 1) {
    start = start.parentElement || /** @type {Element|null} */ (composedParent(start));
  }

  /** @type {Element|null} */
  let n = /** @type {Element|null} */ (start);
  let depth = 0;
  /** @type {Element|null} */
  let seenDocRoot = null;

  while (n && n.nodeType === 1 && depth++ < 64) {
    if (n.tagName === 'IFRAME' || n.tagName === 'FRAME') {
      // Caller handles iframe forwarding; do not treat the shell as a scroller.
      return null;
    }

    // Skip KeyPilot chrome (ids/classes) so we don't scroll our own overlays.
    try {
      const id = n.id || '';
      if (id === 'kpv2-cursor' || id === 'kpv2-frame-hover' || (typeof id === 'string' && id.startsWith('kpv2-'))) {
        n = composedParent(n);
        continue;
      }
      if (n.classList) {
        let skip = false;
        n.classList.forEach((c) => {
          if (typeof c === 'string' && c.startsWith('kpv2-')) skip = true;
        });
        if (skip) {
          n = composedParent(n);
          continue;
        }
      }
    } catch { /* ignore */ }

    const cap = getScrollCapacity(n, doc);
    if (cap.canY || cap.canX) {
      if (isDocumentScrollRoot(n, doc)) {
        seenDocRoot = n;
        // Keep walking? Document roots are usually outermost — try them last
        // only after nested candidates fail. Continue so nested is preferred
        // when we somehow start above them; normally we hit nested first.
        n = composedParent(n);
        continue;
      }
      const axis = pickAxis(cap, n, sign);
      if (axis) return { el: n, axis };
    }

    n = composedParent(n);
  }

  // Fallback: document scrolling element / html / body / window.
  const candidates = [];
  try {
    if (doc.scrollingElement) candidates.push(doc.scrollingElement);
  } catch { /* ignore */ }
  try {
    if (doc.documentElement) candidates.push(doc.documentElement);
  } catch { /* ignore */ }
  try {
    if (doc.body) candidates.push(doc.body);
  } catch { /* ignore */ }
  if (seenDocRoot) candidates.push(seenDocRoot);

  const tried = new Set();
  for (const el of candidates) {
    if (!el || tried.has(el)) continue;
    tried.add(el);
    const cap = getScrollCapacity(el, doc);
    const axis = pickAxis(cap, el, sign);
    if (axis) return { el, axis };
  }

  return null;
}

/**
 * True when the node is KeyPilot chrome that should not be treated as a scroller.
 * @param {Element} n
 * @returns {boolean}
 */
function isKeyPilotScrollChrome(n) {
  try {
    const id = n.id || '';
    if (id === 'kpv2-cursor' || id === 'kpv2-frame-hover' || (typeof id === 'string' && id.startsWith('kpv2-'))) {
      return true;
    }
    if (n.classList) {
      let skip = false;
      n.classList.forEach((c) => {
        if (typeof c === 'string' && c.startsWith('kpv2-')) skip = true;
      });
      if (skip) return true;
    }
  } catch { /* ignore */ }
  return false;
}

/**
 * True when the box is wider than tall (landscape).
 * @param {Element} el
 * @returns {boolean}
 */
export function isWideOverflowTarget(el) {
  if (!el || el.nodeType !== 1) return false;
  let r = null;
  try { r = el.getBoundingClientRect(); } catch { r = null; }
  if (!r || !(r.width > 1) || !(r.height > 1)) return false;
  return r.width > r.height + 1;
}

/**
 * Horizontal-only landscape overflow (image/video carousels). Vertical-only
 * landscape panes — including full-viewport app-shell columns — are the page
 * scroller and must not be skipped.
 * @param {Element} el
 * @param {ScrollCapacity} [cap]
 * @returns {boolean}
 */
export function isCarouselLikeOverflowTarget(el, cap) {
  if (!el || !cap || !cap.canX || cap.canY) return false;
  return isWideOverflowTarget(el);
}

/**
 * Nested overflow (any axis) under a viewport point, then the document.
 * Used by Scroll Line: lock this target at activation. Does not pick a single
 * axis or require remaining room in a direction.
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ doc?: Document, win?: Window, skipWideTargets?: boolean }} [ctx]
 * @returns {{ el: Element, canX: boolean, canY: boolean }|null}
 */
export function findScrollableAtPoint(clientX, clientY, ctx = {}) {
  const doc = ctx.doc || document;
  const skipWide = !!ctx.skipWideTargets;
  const x = Number(clientX);
  const y = Number(clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  let start = elementFromPointDeep(x, y, doc);
  if (!start) {
    const se = doc.scrollingElement || doc.documentElement || doc.body;
    if (!se) return null;
    const cap = getScrollCapacity(se, doc);
    if (cap.canX || cap.canY) return { el: se, canX: cap.canX, canY: cap.canY };
    return null;
  }

  if (start.nodeType !== 1) {
    start = start.parentElement || /** @type {Element|null} */ (composedParent(start));
  }

  /** @type {Element|null} */
  let n = /** @type {Element|null} */ (start);
  let depth = 0;
  /** @type {Element|null} */
  let seenDocRoot = null;

  while (n && n.nodeType === 1 && depth++ < 64) {
    if (n.tagName === 'IFRAME' || n.tagName === 'FRAME') {
      return null;
    }

    if (isKeyPilotScrollChrome(n)) {
      n = composedParent(n);
      continue;
    }

    const cap = getScrollCapacity(n, doc);
    if (cap.canY || cap.canX) {
      if (isDocumentScrollRoot(n, doc)) {
        seenDocRoot = n;
        n = composedParent(n);
        continue;
      }
      if (skipWide && isCarouselLikeOverflowTarget(n, cap)) {
        n = composedParent(n);
        continue;
      }
      return { el: n, canX: cap.canX, canY: cap.canY };
    }

    n = composedParent(n);
  }

  const candidates = [];
  try {
    if (doc.scrollingElement) candidates.push(doc.scrollingElement);
  } catch { /* ignore */ }
  try {
    if (doc.documentElement) candidates.push(doc.documentElement);
  } catch { /* ignore */ }
  try {
    if (doc.body) candidates.push(doc.body);
  } catch { /* ignore */ }
  if (seenDocRoot) candidates.push(seenDocRoot);

  const tried = new Set();
  for (const el of candidates) {
    if (!el || tried.has(el)) continue;
    tried.add(el);
    const cap = getScrollCapacity(el, doc);
    if (cap.canX || cap.canY) return { el, canX: cap.canX, canY: cap.canY };
  }

  return null;
}

/**
 * Apply independent X/Y deltas to the overflow under a point (Scroll Line).
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} deltaX
 * @param {number} deltaY
 * @param {ScrollBehavior} [behavior]
 * @param {{ doc?: Document, win?: Window }} [ctx]
 * @returns {{ scrolled: boolean, el: Element|null }}
 */
export function scrollByAtPoint(clientX, clientY, deltaX, deltaY, behavior = 'auto', ctx = {}) {
  const doc = ctx.doc || document;
  const win = ctx.win || (doc.defaultView || window);
  let dx = Number(deltaX) || 0;
  let dy = Number(deltaY) || 0;
  if (!dx && !dy) return { scrolled: false, el: null };

  const target = findScrollableAtPoint(clientX, clientY, { doc, win });
  if (!target) {
    try {
      const se = doc.scrollingElement || doc.documentElement || doc.body;
      if (se && isInstantScrollBehavior(behavior)) {
        const ok = applyInstantScrollTo(
          se,
          (Number(se.scrollLeft) || 0) + dx,
          (Number(se.scrollTop) || 0) + dy,
          doc,
          win
        );
        return { scrolled: ok, el: se };
      }
      if (win && typeof win.scrollBy === 'function') {
        win.scrollBy({ left: dx, top: dy, behavior });
        return { scrolled: true, el: se || null };
      }
    } catch { /* ignore */ }
    return { scrolled: false, el: null };
  }

  if (!target.canX) dx = 0;
  if (!target.canY) dy = 0;
  if (!dx && !dy) return { scrolled: false, el: target.el };

  const ok = scrollElementBy(target.el, dx, dy, behavior, doc, win);
  return { scrolled: ok, el: target.el };
}

/**
 * Scroll under the cursor: nested overflow first, then the page.
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} sign  -1 = C (up/left), +1 = V (down/right)
 * @param {number} deltaPx  positive distance in the chosen direction
 * @param {ScrollBehavior} [behavior]
 * @param {{ doc?: Document, win?: Window }} [ctx]
 * @returns {{ scrolled: boolean, axis: 'y'|'x'|null, el: Element|null }}
 */
export function scrollAtPoint(clientX, clientY, sign, deltaPx, behavior = 'smooth', ctx = {}) {
  const doc = ctx.doc || document;
  const win = ctx.win || (doc.defaultView || window);
  const amount = Math.abs(Number(deltaPx)) || 0;
  const s = sign < 0 ? -1 : 1;

  if (!amount) {
    return { scrolled: false, axis: null, el: null };
  }

  const target = findScrollTargetAtPoint(clientX, clientY, s, { doc, win });
  if (!target) {
    // Absolute last resort: window scroll on Y (preserves old C/V behavior).
    try {
      const se = doc.scrollingElement || doc.documentElement || doc.body;
      if (se && isInstantScrollBehavior(behavior)) {
        const ok = applyInstantScrollTo(
          se,
          Number(se.scrollLeft) || 0,
          (Number(se.scrollTop) || 0) + s * amount,
          doc,
          win
        );
        return { scrolled: ok, axis: 'y', el: se };
      }
      if (win && typeof win.scrollBy === 'function') {
        win.scrollBy({ top: s * amount, left: 0, behavior });
        return { scrolled: true, axis: 'y', el: se || null };
      }
    } catch { /* ignore */ }
    return { scrolled: false, axis: null, el: null };
  }

  const { el, axis } = target;
  const dx = axis === 'x' ? s * amount : 0;
  const dy = axis === 'y' ? s * amount : 0;
  const ok = scrollElementBy(el, dx, dy, behavior, doc, win);
  return { scrolled: ok, axis, el };
}

/**
 * Jump an element (or window for document roots) to the start/end of an axis.
 * @param {Element} el
 * @param {'y'|'x'} axis
 * @param {number} sign  -1 = top/left, +1 = bottom/right
 * @param {ScrollBehavior} [behavior]
 * @param {Document} [doc]
 * @param {Window} [win]
 * @returns {boolean}
 */
export function scrollElementToEdge(el, axis, sign, behavior = 'smooth', doc = document, win = window) {
  if (!el || (axis !== 'y' && axis !== 'x')) return false;
  const s = sign < 0 ? -1 : 1;

  let left = 0;
  let top = 0;
  try {
    if (axis === 'y') {
      left = el.scrollLeft || 0;
      top = s < 0 ? 0 : Math.max(0, (el.scrollHeight || 0) - (el.clientHeight || 0));
    } else {
      top = el.scrollTop || 0;
      left = s < 0 ? 0 : Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0));
    }
  } catch {
    return false;
  }

  if (isInstantScrollBehavior(behavior)) {
    return applyInstantScrollTo(el, left, top, doc, win);
  }

  const opts = { left, top, behavior };

  try {
    if (typeof el.scrollTo === 'function') {
      el.scrollTo(opts);
      return true;
    }
  } catch { /* fall through */ }

  try {
    if (axis === 'y') el.scrollTop = top;
    else el.scrollLeft = left;
    return true;
  } catch { /* ignore */ }

  if (isDocumentScrollRoot(el, doc) && win && typeof win.scrollTo === 'function') {
    try {
      win.scrollTo(opts);
      return true;
    } catch {
      try {
        if (axis === 'y') win.scrollTo(win.pageXOffset || 0, top);
        else win.scrollTo(left, win.pageYOffset || 0);
        return true;
      } catch { /* ignore */ }
    }
  }

  return false;
}

/**
 * Scroll under the cursor to the edge: nested overflow first, then the page.
 * Same targeting as {@link scrollAtPoint} (C/V); Z jumps to start, X to end.
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} sign  -1 = Z (top/left), +1 = X (bottom/right)
 * @param {ScrollBehavior} [behavior]
 * @param {{ doc?: Document, win?: Window }} [ctx]
 * @returns {{ scrolled: boolean, axis: 'y'|'x'|null, el: Element|null }}
 */
export function scrollToEdgeAtPoint(clientX, clientY, sign, behavior = 'smooth', ctx = {}) {
  const doc = ctx.doc || document;
  const win = ctx.win || (doc.defaultView || window);
  const s = sign < 0 ? -1 : 1;

  const target = findScrollTargetAtPoint(clientX, clientY, s, { doc, win });
  if (!target) {
    // Absolute last resort: window scroll on Y (preserves old Z/X page behavior).
    try {
      if (win && typeof win.scrollTo === 'function') {
        const se = doc.scrollingElement || doc.documentElement || doc.body;
        const top = s < 0
          ? 0
          : Math.max(0, (se?.scrollHeight || doc.body?.scrollHeight || 0) - (win.innerHeight || 0));
        const left = win.pageXOffset || 0;
        if (se && isInstantScrollBehavior(behavior)) {
          applyInstantScrollTo(se, left, top, doc, win);
        } else {
          win.scrollTo({ top, left, behavior });
        }
        return { scrolled: true, axis: 'y', el: se || null };
      }
    } catch { /* ignore */ }
    return { scrolled: false, axis: null, el: null };
  }

  const { el, axis } = target;
  const ok = scrollElementToEdge(el, axis, s, behavior, doc, win);
  return { scrolled: ok, axis, el };
}
