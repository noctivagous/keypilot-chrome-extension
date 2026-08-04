/**
 * YouTube video ID + official thumbnail URL helpers.
 * Shared by Launcher, New Tab, and page-thumb UI (prefer API thumbs over captures).
 */

/**
 * Extract YouTube video ID from a URL.
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 *
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
export function extractYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '').toLowerCase();

    if (!hostname.includes('youtube.com') && !hostname.includes('youtu.be')) {
      return null;
    }

    // youtu.be/VIDEO_ID
    if (hostname === 'youtu.be' || hostname.endsWith('.youtu.be')) {
      const videoId = urlObj.pathname.slice(1).split('/')[0].split('?')[0].split('&')[0];
      if (videoId && videoId.length === 11) return videoId;
      return null;
    }

    if (hostname.includes('youtube.com')) {
      if (urlObj.pathname === '/watch' && urlObj.searchParams.has('v')) {
        const videoId = urlObj.searchParams.get('v');
        if (videoId && videoId.length === 11) return videoId;
      }

      const embedMatch = urlObj.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch) return embedMatch[1];

      const vMatch = urlObj.pathname.match(/^\/v\/([a-zA-Z0-9_-]{11})/);
      if (vMatch) return vMatch[1];

      const shortsMatch = urlObj.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch) return shortsMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Official YouTube thumbnail URL.
 * @param {string} videoId
 * @param {'default'|'mqdefault'|'hqdefault'|'sddefault'|'maxresdefault'} [quality]
 * @returns {string|null}
 */
export function getYouTubeThumbnailUrl(videoId, quality = 'hqdefault') {
  if (!videoId || typeof videoId !== 'string') return null;
  const valid = ['default', 'mqdefault', 'hqdefault', 'sddefault', 'maxresdefault'];
  const q = valid.includes(quality) ? quality : 'hqdefault';
  return `https://img.youtube.com/vi/${videoId}/${q}.jpg`;
}

/**
 * Prefer official YouTube thumb when the page URL is a video watch/embed link.
 * @param {string|null|undefined} pageUrl
 * @param {'default'|'mqdefault'|'hqdefault'|'sddefault'|'maxresdefault'} [quality]
 * @returns {string|null}
 */
export function getYouTubeThumbnailUrlForPage(pageUrl, quality = 'hqdefault') {
  const id = extractYouTubeVideoId(pageUrl);
  if (!id) return null;
  return getYouTubeThumbnailUrl(id, quality);
}
