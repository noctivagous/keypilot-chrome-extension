/**
 * Video URL classification helpers (no DOM / fetch — safe for client + SW).
 */

/** Inline message cap for page-captured blobs (SW fetches larger http(s) files). */
export const MAX_INLINE_VIDEO_BYTES = 8 * 1024 * 1024;

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isStreamingManifestUrl(url) {
  const s = String(url || '').trim();
  if (!s) return false;
  const path = s.split('?')[0].split('#')[0].toLowerCase();
  if (/\.(m3u8|mpd|ism)(\/|$)/i.test(path)) return true;
  if (/\/(manifest|master\.m3u8|playlist\.m3u8|index\.m3u8)(\/|$)/i.test(path)) return true;
  return /[?&](format=m3u8|type=m3u8|playlist=m3u8)\b/i.test(s);
}

/**
 * Progressive media file (or in-page blob/data video) — candidate for byte download.
 * @param {string} url
 * @returns {boolean}
 */
export function isProgressiveMediaUrl(url) {
  const s = String(url || '').trim();
  if (!s) return false;
  if (/^(blob:|data:video\/)/i.test(s)) return true;
  if (!/^https?:/i.test(s)) return false;
  if (isStreamingManifestUrl(s)) return false;
  const path = s.split('?')[0].split('#')[0].toLowerCase();
  return /\.(mp4|webm|ogv|ogg|mov|m4v|mkv|m4a)(\/|$)/i.test(path) || /\/video\//i.test(path);
}

/**
 * http(s) URL the service worker can try to fetch as file bytes.
 * @param {string} url
 * @returns {boolean}
 */
export function isServiceWorkerFetchableVideoUrl(url) {
  const s = String(url || '').trim();
  if (!/^https?:\/\//i.test(s)) return false;
  return !isStreamingManifestUrl(s);
}
