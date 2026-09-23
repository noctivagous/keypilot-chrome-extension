/**
 * Decide whether omnibox / new-tab text is a navigable address.
 * Unicode IDNs such as `例子.中国` navigate; CJK text without a host shape stays a search.
 */

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
const HOST_LABEL_RE = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?$/u;
const PUNYCODE_LABEL_RE = /^xn--[a-z0-9-]{1,59}$/i;
const LETTER_TLD_RE = /^[\p{L}]{2,63}$/u;

/**
 * Chrome's address bar accepts ideographic and fullwidth dots as label separators.
 * @param {string} text
 * @returns {string}
 */
function normalizeHostDots(text) {
  return text.replace(/[\u3002\uFF0E]/g, '.');
}

/**
 * @param {string} label
 * @returns {boolean}
 */
function isHostLabel(label) {
  if (!label || label.length > 63) return false;
  if (label.toLowerCase().startsWith('xn--')) return PUNYCODE_LABEL_RE.test(label);
  return HOST_LABEL_RE.test(label);
}

/**
 * @param {string} host
 * @returns {boolean}
 */
function isDomainHost(host) {
  const labels = host.split('.');
  if (labels.length < 2 || labels.some((label) => !isHostLabel(label))) return false;
  const tld = labels[labels.length - 1];
  return LETTER_TLD_RE.test(tld) || PUNYCODE_LABEL_RE.test(tld);
}

/**
 * @param {string} text Scheme-less input with ASCII dots.
 * @returns {boolean}
 */
export function isNavigableHostInput(text) {
  const input = String(text || '');
  if (!input || /\s/u.test(input)) return false;

  const authority = input.split(/[\/?#]/, 1)[0];
  const at = authority.lastIndexOf('@');
  const hostPort = at >= 0 ? authority.slice(at + 1) : authority;
  const host = hostPort.replace(/:\d+$/, '');
  if (!host || host !== host.trim()) return false;
  if (/^localhost$/i.test(host)) return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  return isDomainHost(host);
}

/**
 * Return an absolute URL when the input should navigate, or `''` when it should search.
 * Existing schemes are preserved. Scheme-less hosts get `https://`.
 * @param {string} input
 * @returns {string}
 */
export function urlFromAddressInput(input) {
  const text = String(input || '').trim();
  if (!text) return '';
  if (SCHEME_RE.test(text)) return text;
  if (/\s/u.test(text)) return '';

  const normalized = normalizeHostDots(text);
  if (!isNavigableHostInput(normalized)) return '';
  try {
    const parsed = new URL(`https://${normalized}`);
    if (parsed.protocol !== 'https:' || !parsed.hostname) return '';
  } catch {
    return '';
  }
  return `https://${normalized}`;
}
