/**
 * Client helpers for page-preview card backgrounds.
 *
 * Prefer official YouTube thumbnails for video URLs; otherwise request a
 * stored capture from the service worker (IndexedDB).
 */

import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  getYouTubeThumbnailUrlForPage
} from '../utils/youtube-thumb.js';

export {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  getYouTubeThumbnailUrlForPage
};

/**
 * Build the darkened cover background used by Launcher / New Tab cards.
 * @param {string} imageUrl
 * @param {number} [topAlpha=0.7]
 * @param {number} [bottomAlpha=0.85]
 * @returns {string}
 */
export function buildDarkenedThumbBackground(imageUrl, topAlpha = 0.55, bottomAlpha = 0.78) {
  const url = String(imageUrl || '').trim();
  if (!url) return '';
  const t = Math.max(0, Math.min(1, Number(topAlpha) || 0.7));
  const b = Math.max(0, Math.min(1, Number(bottomAlpha) || 0.85));
  // Quote data: / http(s) URLs for CSS url().
  const safe = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return (
    `linear-gradient(to bottom, rgba(0,0,0,${t}) 0%, rgba(0,0,0,${b}) 100%), ` +
    `url("${safe}") center / cover no-repeat`
  );
}

/**
 * Request a stored page screenshot from the service worker.
 * @param {string} pageUrl
 * @returns {Promise<string|null>} data URL or null
 */
export async function requestPageThumb(pageUrl) {
  const url = String(pageUrl || '').trim();
  if (!url) return null;

  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      return null;
    }
    const response = await chrome.runtime.sendMessage({
      type: 'KP_GET_PAGE_THUMB',
      pageUrl: url
    });
    if (
      response &&
      response.type === 'KP_PAGE_THUMB_RESPONSE' &&
      response.success &&
      typeof response.dataUrl === 'string' &&
      response.dataUrl
    ) {
      return response.dataUrl;
    }
  } catch {
    // SW unavailable or no thumb.
  }
  return null;
}

/**
 * Resolve the best available card background image URL for a page.
 * YouTube video → official thumb; else stored capture.
 *
 * @param {string} pageUrl
 * @param {{ youtubePrefer?: boolean, youtubeQuality?: string }} [opts]
 * @returns {Promise<{ url: string, source: 'youtube'|'capture' }|null>}
 */
export async function resolveCardBackgroundImage(pageUrl, opts = {}) {
  const youtubePrefer = opts.youtubePrefer !== false;
  if (youtubePrefer) {
    const yt = getYouTubeThumbnailUrlForPage(
      pageUrl,
      /** @type {any} */ (opts.youtubeQuality || 'hqdefault')
    );
    if (yt) return { url: yt, source: 'youtube' };
  }

  const dataUrl = await requestPageThumb(pageUrl);
  if (dataUrl) return { url: dataUrl, source: 'capture' };
  return null;
}

/**
 * Apply a darkened page-preview (or YouTube) background to a card element.
 * Falls back to solid colors until a thumb is available.
 *
 * @param {HTMLElement} el
 * @param {string} pageUrl
 * @param {object} [opts]
 * @param {string} [opts.fallbackSolid='#2a2a2a']
 * @param {string} [opts.hoverSolid='#333']
 * @param {boolean} [opts.manageHover=false] wire mouseenter/leave for darken lift
 * @param {boolean} [opts.youtubePrefer=true]
 * @param {number} [opts.idleTop=0.7]
 * @param {number} [opts.idleBottom=0.85]
 * @param {number} [opts.hoverTop=0.5]
 * @param {number} [opts.hoverBottom=0.75]
 * @param {boolean} [opts.useCssVar=false] set --kp-page-thumb + class instead of inline bg
 * @param {string} [opts.cssVarName='--kp-page-thumb']
 * @param {string} [opts.readyClass='kp-has-page-thumb']
 * @returns {{ refresh: () => Promise<void>, dispose: () => void }}
 */
export function applyCardBackground(el, pageUrl, opts = {}) {
  if (!el) {
    return { refresh: async () => {}, dispose: () => {} };
  }

  const fallbackSolid = opts.fallbackSolid || '#2a2a2a';
  const hoverSolid = opts.hoverSolid || '#333';
  const manageHover = opts.manageHover === true;
  const youtubePrefer = opts.youtubePrefer !== false;
  // Idle uses the previous hover darkness; hover lifts further for more photo.
  const idleTop = opts.idleTop != null ? opts.idleTop : 0.55;
  const idleBottom = opts.idleBottom != null ? opts.idleBottom : 0.78;
  const hoverTop = opts.hoverTop != null ? opts.hoverTop : 0.32;
  const hoverBottom = opts.hoverBottom != null ? opts.hoverBottom : 0.52;
  const useCssVar = opts.useCssVar === true;
  const cssVarName = opts.cssVarName || '--kp-page-thumb';
  const readyClass = opts.readyClass || 'kp-has-page-thumb';

  let disposed = false;
  let hovering = false;
  /** @type {string|null} */
  let thumbUrl = null;

  const paintSolid = (hover) => {
    if (useCssVar) {
      try {
        el.classList.remove(readyClass);
        el.style.removeProperty(cssVarName);
      } catch {
        // ignore
      }
      // Leave ambient CSS background when no thumb.
      return;
    }
    el.style.background = hover ? hoverSolid : fallbackSolid;
  };

  const paintThumb = (url, hover) => {
    if (useCssVar) {
      try {
        const safe = String(url).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        el.style.setProperty(cssVarName, `url("${safe}")`);
        el.classList.add(readyClass);
        if (hover) el.classList.add('kp-page-thumb-hover');
        else el.classList.remove('kp-page-thumb-hover');
      } catch {
        // ignore
      }
      return;
    }
    const top = hover ? hoverTop : idleTop;
    const bottom = hover ? hoverBottom : idleBottom;
    el.style.background = buildDarkenedThumbBackground(url, top, bottom);
  };

  const paint = () => {
    if (disposed || !el.isConnected) return;
    if (thumbUrl) paintThumb(thumbUrl, hovering);
    else paintSolid(hovering);
  };

  const onEnter = () => {
    hovering = true;
    paint();
  };
  const onLeave = () => {
    hovering = false;
    paint();
  };

  if (manageHover) {
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
  }

  // Immediate solid / optional sync YouTube paint.
  paintSolid(false);
  if (youtubePrefer) {
    const yt = getYouTubeThumbnailUrlForPage(pageUrl, 'hqdefault');
    if (yt) {
      thumbUrl = yt;
      try {
        el.dataset.kpThumbSource = 'youtube';
        el.dataset.kpThumbUrl = yt;
        el.dataset.kpThumbReady = '1';
      } catch {
        // ignore
      }
      paint();
    }
  }

  const refresh = async () => {
    if (disposed) return;
    // Already have YouTube official — do not replace with capture.
    if (thumbUrl && el.dataset?.kpThumbSource === 'youtube') return;

    const resolved = await resolveCardBackgroundImage(pageUrl, { youtubePrefer });
    if (disposed || !el.isConnected) return;
    if (!resolved?.url) return;

    // Prefer keeping youtube if resolve returned youtube.
    thumbUrl = resolved.url;
    try {
      el.dataset.kpThumbSource = resolved.source;
      el.dataset.kpThumbUrl = resolved.url;
      el.dataset.kpThumbReady = '1';
    } catch {
      // ignore
    }
    paint();
  };

  // Async capture lookup (no-op if YouTube already painted and we skip).
  void refresh();

  const dispose = () => {
    disposed = true;
    if (manageHover) {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    }
  };

  return { refresh, dispose };
}
