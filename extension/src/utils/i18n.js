/**
 * Localized extension UI messages.
 *
 * Keep Chrome's locale resolution in the platform: this helper only provides
 * a consistent runtime lookup and a useful development signal for missing
 * catalog entries. Callers should assign returned text with `textContent`,
 * not `innerHTML`.
 */

/**
 * @returns {boolean}
 */
function isDebugBuild() {
  try {
    return !!globalThis.KEYPILOT_DEBUG;
  } catch {
    return false;
  }
}

/**
 * @param {string} key
 * @returns {string}
 */
function missingMessage(key) {
  if (!isDebugBuild()) return '';
  console.warn(`[KeyPilot i18n] Missing message: ${key}`);
  return `[i18n:${key}]`;
}

/**
 * Get a localized extension message.
 *
 * In release builds a missing message returns an empty string, matching
 * Chrome's API. Debug builds instead warn and return an identifiable marker.
 *
 * @param {string} key
 * @param {string|string[]} [substitutions]
 * @returns {string}
 */
export const DEFAULT_LOCALE = 'en';

/**
 * Return the UI language, a hyphen/underscore spelling variant, the base
 * language, then the fallback locale, without duplicates.
 * @param {string} [uiLanguage]
 * @param {string} [baseLocale]
 * @returns {string[]}
 */
export function getLocaleCandidates(uiLanguage, baseLocale = DEFAULT_LOCALE) {
  const fallback = String(baseLocale || DEFAULT_LOCALE);
  const raw = String(
    uiLanguage ?? chrome?.i18n?.getUILanguage?.() ?? fallback
  ).trim();
  const exact = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]+)*$/.test(raw) ? raw : '';
  const base = exact.split(/[-_]/)[0].toLowerCase();
  const alt = exact.includes('-')
    ? exact.replace(/-/g, '_')
    : exact.includes('_')
      ? exact.replace(/_/g, '-')
      : '';
  return [...new Set([exact, alt, base, fallback].filter(Boolean))];
}

/** Canonical English keycap legends → message keys. Physical slot IDs stay English. */
export const KEYCAP_MESSAGE_KEYS = Object.freeze({
  Tab: 'keycap_tab',
  Caps: 'keycap_caps',
  Shift: 'keycap_shift',
  Enter: 'keycap_enter',
  Backspace: 'keycap_backspace',
  Esc: 'keycap_esc',
  Escape: 'keycap_esc'
});

/**
 * Localize a named keycap legend (Tab, Shift, …). Unknown glyphs are returned unchanged.
 * @param {string} text
 * @returns {string}
 */
export function localizeKeycapLabel(text) {
  const raw = String(text || '');
  const key = KEYCAP_MESSAGE_KEYS[raw];
  if (!key) return raw;
  return getMessage(key) || raw;
}

export function getMessage(key, substitutions) {
  const messageKey = typeof key === 'string' ? key.trim() : '';
  if (!messageKey) return missingMessage(String(key || '(empty key)'));

  try {
    const message = chrome?.i18n?.getMessage?.(messageKey, substitutions);
    return typeof message === 'string' && message
      ? message
      : missingMessage(messageKey);
  } catch {
    return missingMessage(messageKey);
  }
}

const ATTRIBUTE_BINDINGS = Object.freeze([
  ['data-i18n', 'textContent'],
  ['data-i18n-placeholder', 'placeholder'],
  ['data-i18n-aria-label', 'aria-label'],
  ['data-i18n-title', 'title']
]);

/**
 * Localize static extension-page markup using message-key data attributes.
 *
 * `data-i18n` writes text with `textContent`; translated strings are never
 * treated as HTML. Attribute-specific bindings use the same message lookup.
 *
 * @param {ParentNode} [root]
 */
export function localizeElements(root = document) {
  if (!root?.querySelectorAll) return;

  for (const [attribute, property] of ATTRIBUTE_BINDINGS) {
    for (const element of root.querySelectorAll(`[${attribute}]`)) {
      const key = element.getAttribute(attribute);
      const message = getMessage(key || '');
      if (!message) continue;
      if (property === 'textContent') {
        element.textContent = message;
      } else {
        element.setAttribute(property, message);
      }
    }
  }
}
