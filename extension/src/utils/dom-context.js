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
 * True only when the user is in a real text-entry field where letter keys should type.
 * Non-text inputs (checkbox, radio, button, range, etc.) must NOT block KeyPilot shortcuts.
 *
 * @param {EventTarget|null|undefined} target
 * @param {{ treatSelectAsTyping?: boolean }} [opts]
 * @returns {boolean}
 */
export function isTypingContext(target, opts = {}) {
  if (!target || /** @type {any} */ (target).nodeType !== 1) return false;
  const el = /** @type {HTMLElement} */ (target);

  try {
    if (el.isContentEditable) return true;
  } catch { /* ignore */ }

  const tag = el.tagName?.toLowerCase?.() || '';
  if (tag === 'textarea') {
    return !(/** @type {HTMLTextAreaElement} */ (el)).disabled;
  }
  if (opts.treatSelectAsTyping && tag === 'select') {
    return !(/** @type {HTMLSelectElement} */ (el)).disabled;
  }
  if (tag !== 'input') return false;

  const input = /** @type {HTMLInputElement} */ (el);
  if (input.disabled || input.readOnly) return false;

  const type = String(input.type || 'text').toLowerCase();
  return TEXT_ENTRY_TYPE_SET.has(type);
}

/**
 * @param {KeyboardEvent|null|undefined} e
 * @returns {boolean}
 */
export function hasModifierKeys(e) {
  if (!e) return false;
  return !!(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey);
}
