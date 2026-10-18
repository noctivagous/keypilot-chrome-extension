/**
 * Identity for a button or form control that a deferred click must press later
 * in the same document. A match has to agree on tag, type, name, and value.
 * If that control is gone, nothing else is clicked.
 */

const SAFE_SELECTOR = /^(?:[a-z][a-z0-9]*:nth-of-type\([1-9]\d*\)(?: > )?)+$/i;

/**
 * @param {Element|null|undefined} el
 * @returns {boolean}
 */
export function isFormButton(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = String(el.tagName || '').toUpperCase();
  if (tag === 'BUTTON') return true;
  if (tag === 'INPUT') {
    const type = String(el.getAttribute?.('type') || 'text').toLowerCase();
    return type === 'submit' || type === 'button' || type === 'image' || type === 'reset';
  }
  return false;
}

/**
 * @param {Element|null|undefined} el
 * @returns {Element|null}
 */
export function closestFormButton(el) {
  /** @type {Set<Element>} */
  const seen = new Set();
  let node = el;
  while (node && node.nodeType === 1 && !seen.has(node)) {
    seen.add(node);
    if (isFormButton(node)) return node;
    if (node.parentElement) {
      node = node.parentElement;
      continue;
    }
    const root = typeof node.getRootNode === 'function' ? node.getRootNode() : null;
    node = root && root.host ? root.host : null;
  }
  return null;
}

/**
 * @param {Element} el
 * @returns {string}
 */
function controlType(el) {
  const tag = String(el.tagName || '').toUpperCase();
  if (tag === 'BUTTON') {
    const type = String(el.getAttribute?.('type') || 'submit').toLowerCase();
    return type === 'button' || type === 'reset' || type === 'submit' ? type : 'submit';
  }
  return String(el.getAttribute?.('type') || '').toLowerCase();
}

/**
 * @param {Element} el
 * @param {{ tag?: string, type?: string, name?: string, value?: string }} desc
 * @returns {boolean}
 */
function sameControl(el, desc) {
  if (!isFormButton(el)) return false;
  if (String(el.tagName || '').toLowerCase() !== desc.tag) return false;
  if (controlType(el) !== desc.type) return false;
  if (String(el.getAttribute?.('name') || '') !== String(desc.name || '')) return false;
  if (String(el.getAttribute?.('value') || '') !== String(desc.value || '')) return false;
  return true;
}

/**
 * @param {Element} el
 * @param {string} text
 * @returns {boolean}
 */
function sameText(el, text) {
  if (!text) return true;
  const current = String(el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return current === text;
}

/**
 * @param {ParentNode|null|undefined} root
 * @returns {Element[]}
 */
function collectElements(root) {
  /** @type {Element[]} */
  const out = [];
  const children = root?.children ? Array.from(root.children) : [];
  for (const child of children) {
    if (!child || child.nodeType !== 1) continue;
    out.push(child);
    out.push(...collectElements(child));
  }
  return out;
}

/**
 * @param {Element} el
 * @returns {string}
 */
function lightDomSelector(el) {
  const root = typeof el.getRootNode === 'function' ? el.getRootNode() : null;
  if (root && root.host) return '';
  /** @type {string[]} */
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && node.parentElement) {
    const parent = node.parentElement;
    const sameTag = Array.from(parent.children || []).filter((child) => child.tagName === node.tagName);
    const index = sameTag.indexOf(node) + 1;
    if (index < 1) return '';
    parts.unshift(`${String(node.tagName).toLowerCase()}:nth-of-type(${index})`);
    node = parent;
  }
  return parts.join(' > ');
}

/**
 * @param {Document} doc
 * @param {string} selector
 * @returns {Element|null}
 */
function resolveSelector(doc, selector) {
  if (!SAFE_SELECTOR.test(selector) || selector.length > 500) return null;
  let scope = doc.documentElement || null;
  if (!scope) return null;
  for (const step of selector.split(' > ')) {
    const match = /^([a-z][a-z0-9]*):nth-of-type\(([1-9]\d*)\)$/i.exec(step);
    if (!match) return null;
    const kids = Array.from(scope.children || []).filter((child) => (
      String(child.tagName || '').toLowerCase() === match[1].toLowerCase()
    ));
    scope = kids[Number(match[2]) - 1] || null;
    if (!scope) return null;
  }
  return scope;
}

/**
 * @param {Element} el
 * @param {Document} doc
 * @returns {object|null}
 */
export function describeDeferredClickTarget(el, doc) {
  if (!isFormButton(el) || !doc?.documentElement) return null;
  const tag = String(el.tagName).toLowerCase();
  const type = controlType(el);
  const name = String(el.getAttribute?.('name') || '').slice(0, 80);
  const value = String(el.getAttribute?.('value') || '').slice(0, 80);
  const id = String(el.id || '').slice(0, 80);
  const text = String(el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const selector = lightDomSelector(el).slice(0, 500);
  const controls = collectElements(doc.documentElement).filter((node) => (
    sameControl(node, { tag, type, name, value })
  ));
  const controlIndex = controls.indexOf(el);
  let formIndex = null;
  if (el.form && doc.forms) {
    const index = Array.from(doc.forms).indexOf(el.form);
    if (index >= 0) formIndex = index;
  }
  if (!id && !selector && controlIndex < 0) return null;
  return { tag, type, name, value, id, text, selector, controlIndex, formIndex };
}

/**
 * @param {Document} doc
 * @param {object|null|undefined} desc
 * @returns {Element|null}
 */
export function findDeferredClickTarget(doc, desc) {
  if (!doc?.documentElement || !desc) return null;
  if (desc.tag !== 'button' && desc.tag !== 'input') return null;
  const accept = (el) => !!el && sameControl(el, desc) && sameText(el, String(desc.text || ''));
  if (desc.id && typeof doc.getElementById === 'function') {
    const byId = doc.getElementById(String(desc.id));
    if (accept(byId)) return byId;
  }
  if (typeof desc.selector === 'string' && desc.selector) {
    const bySelector = resolveSelector(doc, desc.selector);
    if (accept(bySelector)) return bySelector;
  }
  const controls = collectElements(doc.documentElement).filter((node) => sameControl(node, desc));
  const indexed = controls[desc.controlIndex];
  return accept(indexed) ? indexed : null;
}
