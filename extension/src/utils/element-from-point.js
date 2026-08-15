/**
 * Shadow-piercing elementFromPoint (does not enter iframes).
 *
 * `document.elementFromPoint` stops at an open-shadow host. The usual next step
 * is `host.shadowRoot.elementFromPoint`, but when the pointer is over slotted
 * light-DOM (Square market-button labels, etc.) that call returns the host
 * itself. Fall back to the smallest shadow descendant whose box contains the
 * point so activation/hover see the inner control, not the custom-element host.
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
  while (el && el.shadowRoot && guard++ < 10) {
    let nested = null;
    try {
      nested = el.shadowRoot.elementFromPoint(x, y);
    } catch {
      break;
    }
    // Slotted label: the shadow hit-test reports the host. Keep walking.
    if (!nested || nested === el) {
      nested = deepestShadowElementAtPoint(el.shadowRoot, x, y);
    }
    if (!nested || nested === el) break;
    el = nested;
  }
  return el || null;
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
