/**
 * Client helpers for page-preview card backgrounds.
 *
 * Prefer official video thumbnails (YouTube, Dailymotion, Rumble/Odysee/Vimeo
 * via SW oEmbed) for video URLs. Page-screenshot captures are parked in
 * unused/page-previews/ for a later version.
 *
 * Loads are rate-limited, session-cached, and (optionally) deferred until the
 * card is near the scroll viewport so grids stay filled without a stampede.
 */

import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  getYouTubeThumbnailUrlForPage,
  getSyncVideoThumbnailUrlForPage,
  isVideoSiteUrl
} from '../utils/youtube-thumb.js';
import {
  getCachedCardThumb,
  observeThumbVisibility,
  preloadThumbImage,
  resolveCardThumbQueued,
  setCachedCardThumb
} from '../utils/thumb-load-queue.js';
import { MSG } from '../messaging/types.js';
import { hasFirefoxExternalLookupConsent } from '../utils/firefox-data-consent.js';

export {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  getYouTubeThumbnailUrlForPage,
  getSyncVideoThumbnailUrlForPage,
  isVideoSiteUrl
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
 * Request an official video thumbnail (oEmbed / sync) via the service worker.
 * @param {string} pageUrl
 * @returns {Promise<{ url: string, source: string }|null>}
 */
export async function requestVideoThumb(pageUrl) {
  const url = String(pageUrl || '').trim();
  if (!url || !isVideoSiteUrl(url)) return null;
  if (!await hasFirefoxExternalLookupConsent()) return null;

  // Sync patterns (YouTube / Dailymotion) — no round-trip needed.
  const sync = getSyncVideoThumbnailUrlForPage(url, 'hqdefault');
  if (sync) {
    const source = extractYouTubeVideoId(url) ? 'youtube' : 'dailymotion';
    return { url: sync, source };
  }

  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      return null;
    }
    const response = await chrome.runtime.sendMessage({
      type: MSG.GET_VIDEO_THUMB,
      pageUrl: url
    });
    if (
      response &&
      response.type === MSG.VIDEO_THUMB_RESPONSE &&
      response.success &&
      typeof response.thumbUrl === 'string' &&
      response.thumbUrl
    ) {
      return {
        url: response.thumbUrl,
        source: typeof response.source === 'string' ? response.source : 'video'
      };
    }
  } catch {
    // SW unavailable or no thumb.
  }
  return null;
}

/**
 * Resolve the best available card background image URL for a page.
 * Video URL → official thumb; otherwise no background (captures parked).
 *
 * @param {string} pageUrl
 * @param {{ youtubePrefer?: boolean, videoPrefer?: boolean, youtubeQuality?: string }} [opts]
 * @returns {Promise<{ url: string, source: string }|null>}
 */
export async function resolveCardBackgroundImage(pageUrl, opts = {}) {
  const videoPrefer = opts.videoPrefer !== false && opts.youtubePrefer !== false;
  if (videoPrefer) {
    const video = await requestVideoThumb(pageUrl);
    if (video?.url) return video;
  }
  return null;
}

/**
 * Apply a darkened page-preview (or video) background to a card element.
 * Falls back to solid colors until a thumb is available.
 *
 * @param {HTMLElement} el
 * @param {string} pageUrl
 * @param {object} [opts]
 * @param {string} [opts.fallbackSolid='#2a2a2a']
 * @param {string} [opts.hoverSolid='#333']
 * @param {boolean} [opts.manageHover=false] wire mouseenter/leave for darken lift
 * @param {boolean} [opts.youtubePrefer=true]
 * @param {boolean} [opts.videoPrefer=true]
 * @param {boolean} [opts.lazy=false] defer resolve until near viewport
 * @param {Element|null} [opts.lazyRoot=null] IntersectionObserver root (scroll container)
 * @param {string} [opts.lazyRootMargin] default ~100% → visible + ~2× buffer
 * @param {number} [opts.priority=0] queue priority (higher first)
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
  const videoPrefer = opts.videoPrefer !== false && opts.youtubePrefer !== false;
  const lazy = opts.lazy === true;
  const lazyRoot = opts.lazyRoot === undefined ? null : opts.lazyRoot;
  const lazyRootMargin = opts.lazyRootMargin || '100% 100% 100% 100%';
  const priority = Number(opts.priority) || 0;
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
  /** @type {string|null} */
  let thumbSource = null;
  /** @type {(() => void)|null} */
  let unobserve = null;

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

  const setThumb = (url, source) => {
    thumbUrl = url;
    thumbSource = source;
    try {
      el.dataset.kpThumbSource = source || '';
      el.dataset.kpThumbUrl = url || '';
      el.dataset.kpThumbReady = url ? '1' : '0';
    } catch {
      // ignore
    }
    paint();
  };

  /**
   * Paint only after the image has decoded (avoids blank CSS backgrounds).
   * @param {string} url
   * @param {string} source
   */
  const setThumbWhenReady = async (url, source) => {
    if (disposed || !url) return;
    const ok = await preloadThumbImage(url);
    if (disposed || !el.isConnected) return;
    if (!ok) return;
    setThumb(url, source);
  };

  // Immediate solid fallback. Cached / sync thumbs paint after decode,
  // and (when lazy) only once the card is near the scroll viewport.
  paintSolid(false);

  const applyKnownThumb = async () => {
    if (disposed) return;
    const cached = getCachedCardThumb(pageUrl);
    if (cached?.url) {
      await setThumbWhenReady(cached.url, cached.source);
      return;
    }
    if (!videoPrefer) return;
    const sync = getSyncVideoThumbnailUrlForPage(pageUrl, 'hqdefault');
    if (!sync) return;
    const source = extractYouTubeVideoId(pageUrl) ? 'youtube' : 'dailymotion';
    setCachedCardThumb(pageUrl, { url: sync, source });
    await setThumbWhenReady(sync, source);
  };

  const refresh = async () => {
    if (disposed) return;
    // Already have an official video thumb — do not replace with capture.
    if (thumbUrl && thumbSource && thumbSource !== 'capture') return;

    const resolved = await resolveCardThumbQueued(
      pageUrl,
      (url) => resolveCardBackgroundImage(url, { videoPrefer }),
      { priority, preload: true }
    );
    if (disposed || !el.isConnected) return;
    if (!resolved?.url) return;

    // Queued path already preloaded; paint immediately.
    setThumb(resolved.url, resolved.source);
  };

  const startLoad = () => {
    if (disposed) return;
    void (async () => {
      await applyKnownThumb();
      if (disposed) return;
      // Sync/cached official thumbs don't need capture/oEmbed follow-up.
      if (thumbUrl && thumbSource && thumbSource !== 'capture') return;
      await refresh();
    })();
  };

  if (lazy) {
    unobserve = observeThumbVisibility(el, startLoad, {
      root: lazyRoot,
      rootMargin: lazyRootMargin
    });
  } else {
    startLoad();
  }

  const dispose = () => {
    disposed = true;
    try { unobserve?.(); } catch { /* ignore */ }
    unobserve = null;
    if (manageHover) {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    }
  };

  return { refresh, dispose };
}
