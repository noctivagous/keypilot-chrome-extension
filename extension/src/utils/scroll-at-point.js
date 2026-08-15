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
 * Nested overflow (any axis) under a viewport point, then the document.
 * Used by Scroll Line: lock this target at activation. Does not pick a single
 * axis or require remaining room in a direction.
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ doc?: Document, win?: Window }} [ctx]
 * @returns {{ el: Element, canX: boolean, canY: boolean }|null}
 */
export function findScrollableAtPoint(clientX, clientY, ctx = {}) {
  const doc = ctx.doc || document;
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
      if (win && typeof win.scrollBy === 'function') {
        win.scrollBy({ left: dx, top: dy, behavior });
        return { scrolled: true, el: doc.scrollingElement || doc.documentElement || null };
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
      if (win && typeof win.scrollBy === 'function') {
        win.scrollBy({ top: s * amount, left: 0, behavior });
        return { scrolled: true, axis: 'y', el: doc.scrollingElement || doc.documentElement || null };
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
        win.scrollTo({ top, left: win.pageXOffset || 0, behavior });
        return { scrolled: true, axis: 'y', el: se || null };
      }
    } catch { /* ignore */ }
    return { scrolled: false, axis: null, el: null };
  }

  const { el, axis } = target;
  const ok = scrollElementToEdge(el, axis, s, behavior, doc, win);
  return { scrolled: ok, axis, el };
}
