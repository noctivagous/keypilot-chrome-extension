/**
 * Shared DOM/keyboard context helpers (single source of truth).
 * Used by EventManager and the shared popover iframe bridge.
 */

/** Input types where letter keys should type, not run KeyPilot shortcuts. */
export const TEXT_ENTRY_INPUT_TYPES = Object.freeze([
  'text',
  'search',
  'url',
  'email',
  'tel',
  'password',
  'number',
  'date',
  'datetime-local',
  'month',
  'week',
  'time'
]);

const TEXT_ENTRY_TYPE_SET = new Set(TEXT_ENTRY_INPUT_TYPES);

/**
 * Walk open shadow roots and same-origin iframes to find the true focused element.
 * document.activeElement stops at shadow hosts and at <iframe> shells
 * (Gutenberg's editor-canvas, etc.).
 *
 * @param {Document|ShadowRoot|null|undefined} [root]
 * @returns {Element|null}
 */
export function getDeepActiveElement(root = document) {
  let active = null;
  try {
    active = root?.activeElement || null;
  } catch {
    active = null;
  }

  let guard = 0;
  while (active && guard++ < 12) {
    let next = null;
    try {
      next = active.shadowRoot?.activeElement || null;
    } catch {
      next = null;
    }
    if (next) {
      active = next;
      continue;
    }

    let tag = '';
    try { tag = String(active.tagName || '').toUpperCase(); } catch { tag = ''; }
    if (tag === 'IFRAME' || tag === 'FRAME') {
      try {
        const innerDoc = /** @type {HTMLIFrameElement} */ (active).contentDocument;
        const inner = innerDoc?.activeElement || null;
        if (inner && inner !== active) {
          active = inner;
          continue;
        }
      } catch {
        // Cross-origin: cannot read the child document.
      }
    }
    break;
  }

  return active;
}

/**
 * Best-effort real event target across open shadow boundaries.
 * Prefer composedPath()[0]; fall back to event.target.
 *
 * @param {Event|null|undefined} e
 * @returns {EventTarget|null}
 */
export function getComposedEventTarget(e) {
  if (!e) return null;
  try {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : null;
    if (path && path.length) {
      for (const node of path) {
        if (node && /** @type {any} */ (node).nodeType === 1) return node;
      }
    }
  } catch { /* ignore */ }
  return e.target || null;
}

/**
 * True only when the user is in a real text-entry field where letter keys should type.
 * Non-text inputs (checkbox, radio, button, range, etc.) must NOT block KeyPilot shortcuts.
 *
 * @param {EventTarget|null|undefined} target
 * @param {{ treatSelectAsTyping?: boolean }} [opts]
 * @returns {boolean}
 */
export function isTypingContext(target, opts = {}) {
  if (!target) return false;

  // Text nodes can be the original event target inside contenteditable.
  let el = /** @type {any} */ (target);
  try {
    if (el.nodeType === 3) el = el.parentElement;
  } catch { /* ignore */ }
  if (!el || el.nodeType !== 1) return false;

  const node = /** @type {HTMLElement} */ (el);

  try {
    if (node.isConnected === false) return false;
  } catch { /* ignore */ }

  try {
    if (node.isContentEditable) return true;
  } catch { /* ignore */ }

  // Walk up a few ancestors for nested contenteditable hosts / custom wrappers.
  try {
    let p = node.parentElement;
    let depth = 0;
    while (p && depth++ < 4) {
      if (p.isContentEditable) return true;
      p = p.parentElement;
    }
  } catch { /* ignore */ }

  const tag = node.tagName?.toLowerCase?.() || '';
  if (tag === 'textarea') {
    return !(/** @type {HTMLTextAreaElement} */ (node)).disabled;
  }
  if (opts.treatSelectAsTyping && tag === 'select') {
    return !(/** @type {HTMLSelectElement} */ (node)).disabled;
  }
  if (tag !== 'input') return false;

  const input = /** @type {HTMLInputElement} */ (node);
  if (input.disabled || input.readOnly) return false;

  const type = String(input.type || 'text').toLowerCase();
  return TEXT_ENTRY_TYPE_SET.has(type);
}

/**
 * Resolve the element that should suppress KeyPilot letter shortcuts right now.
 * Checks composed event target first, then deep activeElement (shadow-aware).
 *
 * @param {Event|null|undefined} e
 * @param {{ treatSelectAsTyping?: boolean }} [opts]
 * @returns {Element|null}
 */
export function resolveTypingTarget(e, opts = {}) {
  const composed = getComposedEventTarget(e);
  if (isTypingContext(composed, opts)) return /** @type {Element} */ (composed);

  const deep = getDeepActiveElement();
  if (deep && isTypingContext(deep, opts)) return deep;

  // Last resort: light-DOM activeElement (may be a shadow host — still try).
  try {
    if (typeof document !== 'undefined' && isTypingContext(document.activeElement, opts)) {
      return /** @type {Element} */ (document.activeElement);
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * @param {KeyboardEvent|null|undefined} e
 * @returns {boolean}
 */
export function hasModifierKeys(e) {
  if (!e) return false;
  return !!(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey);
}

/**
 * Bundle-safe aliases for class methods.
 * After import-stripping, methods like `isTypingContext(){ return isTypingContext() }`
 * can be ambiguous; always call through these distinct names from EventManager.
 */
export const kpIsTypingContext = isTypingContext;
export const kpResolveTypingTarget = resolveTypingTarget;
export const kpGetDeepActiveElement = getDeepActiveElement;
export const kpGetComposedEventTarget = getComposedEventTarget;
export const kpHasModifierKeys = hasModifierKeys;
