/**
 * URL list for the Open URLs key action.
 * Accepts http(s) URLs, and hostnames without a scheme (those become https).
 */

/** Maximum pages one Open URLs instance may open. */
export const OPEN_URLS_MAX = 20;

/**
 * @param {unknown} value
 * @returns {string} Canonical http(s) URL, or '' when the value is not a website URL.
 */
export function canonicalizeHttpUrl(value) {
  let raw = String(value ?? '').trim();
  if (!raw || /\s/.test(raw)) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = `https://${raw}`;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    if (!url.hostname || !url.hostname.includes('.')) return '';
    return url.href;
  } catch {
    return '';
  }
}

/**
 * Trim, canonicalize, de-duplicate, and cap a URL list.
 * A single string is treated as one URL per line.
 * @param {unknown} raw
 * @param {number} [max]
 * @returns {string[]}
 */
export function normalizeOpenUrlList(raw, max = OPEN_URLS_MAX) {
  const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : OPEN_URLS_MAX;
  const items = Array.isArray(raw)
    ? raw
    : (typeof raw === 'string' ? raw.split(/\r?\n/) : []);
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const url = canonicalizeHttpUrl(item);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= limit) break;
  }
  return out;
}
