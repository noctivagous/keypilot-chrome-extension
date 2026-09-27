/**
 * Open or closed shadow root for an element.
 *
 * Page JS cannot read `attachShadow({ mode: 'closed' })`. Chrome extension
 * isolated worlds can via `chrome.dom.openOrClosedShadowRoot`; Firefox exposes
 * `element.openOrClosedShadowRoot`. pokemon.com's header nav is a closed
 * shadow on a zero-height wrapper — without this, hover/click see only the host.
 *
 * @param {Element|null|undefined} el
 * @returns {ShadowRoot|null}
 */
export function getAccessibleShadowRoot(el) {
  if (!el) return null;
  try {
    if (el.shadowRoot) return el.shadowRoot;
  } catch { /* ignore */ }
  try {
    const opened = globalThis.chrome?.dom?.openOrClosedShadowRoot?.(el);
    if (opened) return opened;
  } catch { /* ignore */ }
  try {
    const fx = el.openOrClosedShadowRoot;
    if (fx) return fx;
  } catch { /* ignore */ }
  return null;
}

/**
 * Shadow-piercing elementFromPoint (does not enter iframes).
 *
 * `document.elementFromPoint` stops at a shadow host (open or closed). The usual
 * next step is `host.shadowRoot.elementFromPoint`, but when the pointer is over
 * slotted light-DOM (Square market-button labels, etc.) that call returns the
 * host itself. Fall back to the smallest shadow descendant whose box contains
 * the point so activation/hover see the inner control, not the custom-element host.
 *
 * @param {number} x
 * @param {number} y
 * @param {Document} [doc]
 * @returns {Element|null}
 */
export function deepElementFromPoint(x, y, doc = document) {
  let el = null;
  try {
    el = doc.elementFromPoint(x, y);
  } catch {
    return null;
  }

  let guard = 0;
  while (el && guard++ < 10) {
    const root = getAccessibleShadowRoot(el);
    if (!root) break;
    let nested = null;
    try {
      nested = root.elementFromPoint(x, y);
    } catch {
      nested = null;
    }
    // Slotted label: the shadow hit-test reports the host. Keep walking.
    if (!nested || nested === el) {
      nested = deepestShadowElementAtPoint(root, x, y);
    }
    if (!nested || nested === el) break;
    el = nested;
  }
  return el || null;
}

/**
 * Deepest node for a pointer/mouse event.
 *
 * `composedPath()` stops at a closed-shadow host for listeners outside that
 * tree, so pokemon.com's header reports the empty wrapper instead of Pokédex.
 * When the path leaf has a closed shadow we can open, re-hit-test at the event
 * coordinates.
 *
 * @param {Event|null|undefined} e
 * @param {Document} [doc]
 * @returns {Element|null}
 */
export function deepestEventTarget(e, doc) {
  if (!e) return null;
  let raw = null;
  try {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : null;
    if (Array.isArray(path)) {
      for (const n of path) {
        if (n && n.nodeType === 1) {
          raw = n;
          break;
        }
      }
    }
  } catch { /* ignore */ }
  if (!raw && e.target && e.target.nodeType === 1) raw = e.target;
  if (!raw) return null;

  const x = typeof e.clientX === 'number' ? e.clientX : NaN;
  const y = typeof e.clientY === 'number' ? e.clientY : NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return raw;

  let closedHost = false;
  try {
    closedHost = !!getAccessibleShadowRoot(raw) && !raw.shadowRoot;
  } catch {
    closedHost = false;
  }
  if (!closedHost) return raw;

  const ownerDoc = doc || raw.ownerDocument || document;
  const deep = deepElementFromPoint(x, y, ownerDoc);
  return deep || raw;
}

/**
 * Smallest element inside an open shadow root whose border box contains (x, y).
 * @param {ShadowRoot} root
 * @param {number} x
 * @param {number} y
 * @returns {Element|null}
 */
export function deepestShadowElementAtPoint(root, x, y) {
  if (!root || typeof root.querySelectorAll !== 'function') return null;
  let nodes;
  try {
    nodes = root.querySelectorAll('*');
  } catch {
    return null;
  }

  let best = null;
  let bestArea = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!n || n.nodeType !== 1) continue;
    let r;
    try {
      r = n.getBoundingClientRect();
    } catch {
      continue;
    }
    if (!(r.width > 0) || !(r.height > 0)) continue;
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    const area = r.width * r.height;
    if (area < bestArea) {
      bestArea = area;
      best = n;
    }
  }
  return best;
}
