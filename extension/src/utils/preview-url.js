/**
 * URL helpers for Link Preview / Open Popover / launcher window opens.
 */

/**
 * Prefer HTTPS so mixed-content / insecure loads are less likely.
 * @param {string} url
 * @returns {string}
 */
export function preferHttpsForPreview(url) {
  const s = String(url || '').trim();
  if (!s) return s;
  if (/^http:\/\//i.test(s)) {
    return `https://${s.slice('http://'.length)}`;
  }
  return s;
}

/**
 * True when this is an external page URL (Open Popover / Link Preview),
 * not an extension page (Settings / Guide).
 * @param {string} url
 * @returns {boolean}
 */
export function isHttpPopoverUrl(url) {
  const s = String(url || '').trim();
  if (!s) return false;
  try {
    const proto = new URL(s).protocol;
    return proto === 'http:' || proto === 'https:';
  } catch {
    return /^https?:\/\//i.test(s);
  }
}
