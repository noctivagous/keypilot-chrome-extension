/**
 * URL helpers for Link Preview / launcher iframes.
 *
 * Many hosts refuse a full-page iframe (`X-Frame-Options` / CSP / server-side
 * Sec-Fetch-Dest checks). KeyPilot already strips frame headers via DNR;
 * some sites (notably X) still return Chrome's "refused to connect". For
 * those we rewrite to an official embeddable document and keep the original
 * URL for Open / Open in New Tab.
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
 * @param {string} host
 * @returns {boolean}
 */
function isXHost(host) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  return (
    h === 'x.com' ||
    h === 'twitter.com' ||
    h === 'mobile.x.com' ||
    h === 'mobile.twitter.com'
  );
}

const X_RESERVED_HANDLES = new Set([
  'home', 'explore', 'search', 'i', 'settings', 'compose', 'messages',
  'notifications', 'login', 'signup', 'tos', 'privacy', 'intent',
  'hashtag', 'share'
]);

/**
 * Map a page URL to something an iframe is allowed to load.
 * Unknown hosts are returned unchanged.
 * @param {string} url
 * @returns {string}
 */
export function rewriteUrlForIframePreview(url) {
  const s = String(url || '').trim();
  if (!s) return s;
  try {
    const u = new URL(s);
    if (!isXHost(u.hostname)) return s;

    const status = u.pathname.match(/\/(?:i\/web\/)?status(?:es)?\/(\d+)/i);
    if (status) {
      const id = status[1];
      return `https://platform.twitter.com/embed/Tweet.html?id=${encodeURIComponent(id)}&theme=dark&dnt=true`;
    }

    const handleMatch = u.pathname.match(/^\/@?([A-Za-z0-9_]{1,15})\/?$/);
    if (handleMatch && !X_RESERVED_HANDLES.has(handleMatch[1].toLowerCase())) {
      return `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(handleMatch[1])}`;
    }
  } catch { /* ignore */ }
  return s;
}
