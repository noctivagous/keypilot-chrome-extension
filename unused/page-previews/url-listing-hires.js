/**
 * PARKED: high-res favicon upgrade formerly in `extension/src/ui/url-listing.js`.
 *
 * Live `url-listing.js` still exports `GENERIC_FAVICON_DATA_URL`,
 * `getExtensionFaviconUrl`, `attachFaviconWithUpgrade` (Chrome `/_favicon/`
 * + generic fallback only), and `createFaviconImg`.
 *
 * Restore: merge these functions back, then restore the Google s2 / SW probe
 * branches in `attachFaviconWithUpgrade` and `createFaviconImg`.
 */

/**
 * Google's public favicon service — loadable as <img src> (img-src https:) without fetch/connect-src.
 * Often higher-res than Chrome's cached tab favicon when sz is large.
 *
 * @param {string} pageUrl
 * @param {number} [size]
 * @returns {string}
 */
export function getGoogleS2FaviconUrl(pageUrl, size = 128) {
  const s = Math.max(16, Math.min(256, Number(size) || 128));
  try {
    const u = new URL(String(pageUrl || '').trim());
    // Only real web pages — chrome://newtab etc. have hostnames like "newtab"
    // that are not domains and should not hit Google's favicon CDN.
    const scheme = String(u.protocol || '').toLowerCase();
    if (scheme !== 'http:' && scheme !== 'https:') return '';
    const domain = (u.hostname || '').replace(/^www\./i, '');
    if (!domain) return '';
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${s}`;
  } catch {
    return '';
  }
}

/**
 * Request favicon from service worker (multi-source high-res probe + cache).
 * Requires extension_pages CSP connect-src to allow https: fetches in the SW.
 *
 * @param {string} pageUrl
 * @param {number} [size]
 * @returns {Promise<string|null>} Data URL or null if failed
 */
export async function requestFaviconFromServiceWorker(pageUrl, size = 32) {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      return null;
    }

    const response = await chrome.runtime.sendMessage({
      type: 'KP_GET_FAVICON',
      pageUrl: pageUrl,
      size: size
    });

    if (response && response.type === 'KP_FAVICON_RESPONSE' && response.success && response.dataUrl) {
      return response.dataUrl;
    }
  } catch (e) {
    // Message passing failed or service worker unavailable
  }
  return null;
}

/**
 * Former high-res upgrade order (CSP-safe):
 * 1. Chrome `/_favicon/` (instant, often low-res)
 * 2. Google s2 as direct <img src> (no fetch; uses img-src)
 * 3. Service-worker multi-source probe → data: URL (needs connect-src https:)
 *
 * Restore into `attachFaviconWithUpgrade` after painting Chrome's favicon:
 *
 * ```
 * const googleUrl = getGoogleS2FaviconUrl(url, requestSize);
 * // on Chrome img error → googleUrl, then generic fallback
 * // if highRes: rAF Google upgrade + requestFaviconFromServiceWorker(...)
 * ```
 *
 * Restore into `createFaviconImg` when `highRes` is true:
 *
 * ```
 * requestFaviconFromServiceWorker(url, Math.max(size, 128)).then((dataUrl) => {
 *   if (dataUrl && img.isConnected) {
 *     img.src = dataUrl;
 *     img.dataset.kpFaviconHires = 'true';
 *   }
 * }).catch(() => {});
 * ```
 */
