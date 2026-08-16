/**
 * URL helpers for Link Preview / Open Popover / launcher iframes.
 *
 * Many hosts refuse a full-page iframe (`X-Frame-Options` / CSP / server-side
 * Sec-Fetch-Dest checks). KeyPilot strips frame headers via DNR for most sites.
 * Hosts that still refuse (notably X, Facebook, Instagram) open a sized OS
 * popup window to the real URL instead of an embed rewrite.
 */

/**
 * Prefer HTTPS so mixed-content / insecure framing is less likely.
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
 * Normalize hostname for denier matching (strip leading www.).
 * @param {string} host
 * @returns {string}
 */
function normalizeHost(host) {
  return String(host || '').toLowerCase().replace(/^www\./, '');
}

/**
 * Hosts that refuse framed documents even after DNR header stripping.
 * Link Preview / Open Popover open these in a sized Chrome popup by default.
 * @param {string} host
 * @returns {boolean}
 */
export function isKnownIframeDenierHostname(host) {
  const h = normalizeHost(host);
  if (!h) return false;

  // X / Twitter
  if (
    h === 'x.com' ||
    h === 'twitter.com' ||
    h === 'mobile.x.com' ||
    h === 'mobile.twitter.com' ||
    h.endsWith('.x.com') ||
    h.endsWith('.twitter.com')
  ) {
    return true;
  }

  // Facebook
  if (
    h === 'facebook.com' ||
    h === 'fb.com' ||
    h === 'm.facebook.com' ||
    h === 'm.fb.com' ||
    h === 'web.facebook.com' ||
    h.endsWith('.facebook.com') ||
    h.endsWith('.fb.com')
  ) {
    return true;
  }

  // Instagram
  if (
    h === 'instagram.com' ||
    h === 'm.instagram.com' ||
    h.endsWith('.instagram.com')
  ) {
    return true;
  }

  return false;
}

/**
 * True when this URL should skip the overlay iframe and open an OS popup.
 * @param {string} url
 * @returns {boolean}
 */
export function isKnownIframeDenierHost(url) {
  const s = String(url || '').trim();
  if (!s) return false;
  try {
    return isKnownIframeDenierHostname(new URL(preferHttpsForPreview(s)).hostname);
  } catch {
    return false;
  }
}

/**
 * Identity rewrite kept for launcher callers; embeds are no longer used.
 * Prefer {@link isKnownIframeDenierHost} + OS popup for framing deniers.
 * @param {string} url
 * @returns {string}
 */
export function rewriteUrlForIframePreview(url) {
  return String(url || '').trim();
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

/**
 * Normalize a popover URL for iframe load vs Open / Open in New Tab.
 * HTTPS is always preferred. Embed rewrite is a no-op (kept for API compat).
 *
 * @param {string} url
 * @param {{ rewriteForEmbed?: boolean }} [opts]
 * @returns {{ originalUrl: string, iframeSrc: string }}
 */
export function preparePopoverIframeUrl(url, { rewriteForEmbed = false } = {}) {
  const originalUrl = preferHttpsForPreview(url);
  const iframeSrc = rewriteForEmbed
    ? rewriteUrlForIframePreview(originalUrl)
    : originalUrl;
  return { originalUrl, iframeSrc };
}

/**
 * Create an iframe with no `src` so callers can prepare UA / DNR first.
 *
 * @param {object} [opts]
 * @param {Document} [opts.doc]
 * @param {string} [opts.style]
 * @param {string} [opts.className]
 * @param {string} [opts.tabindex='0']
 * @returns {HTMLIFrameElement}
 */
export function createPopoverIframe({
  doc = document,
  style = '',
  className,
  tabindex = '0'
} = {}) {
  const iframe = doc.createElement('iframe');
  iframe.tabIndex = Number.parseInt(String(tabindex), 10) || 0;
  if (style) iframe.style.cssText = style;
  if (className) iframe.className = className;
  return iframe;
}

/**
 * Assign iframe `src` after optional async setup (e.g. mobile UA).
 *
 * @param {HTMLIFrameElement} iframe
 * @param {string} iframeSrc
 * @param {{ beforeNavigate?: () => (void|Promise<void>) }} [opts]
 * @returns {Promise<Window|null>}
 */
export async function assignPopoverIframeSrc(iframe, iframeSrc, { beforeNavigate } = {}) {
  if (typeof beforeNavigate === 'function') {
    await beforeNavigate();
  }
  iframe.src = String(iframeSrc || '');
  return iframe.contentWindow || null;
}
