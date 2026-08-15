/**
 * Video-under-cursor extraction for Copy Video.
 * Image discovery stays in image-utils.js; this module only matches <video>.
 *
 * URL / bytes strategy (research-backed):
 * - Prefer progressive file URLs (mp4/webm/…) from currentSrc + <source src>.
 * - Skip HLS/DASH manifests (m3u8/mpd) for byte download — they are playlists, not files.
 * - MediaSource `blob:` URLs are not downloadable as a file; fall back to any http(s) <source>.
 * - Page-context fetch works for same-origin / blob: Blob URLs; http(s) bytes are fetched in
 *   the extension service worker (host_permissions bypass CORS).
 */

import {
  deepElementFromPoint,
  getVideoPosterUrl,
  isHtmlVideo,
  materializeVideoElement,
  videoHasDrawableFrame
} from './image-utils.js';
import { fetchMediaBlob } from '../modules/media-library-client.js';
import {
  isProgressiveMediaUrl,
  isServiceWorkerFetchableVideoUrl,
  isStreamingManifestUrl
} from './video-url-utils.js';

export {
  isProgressiveMediaUrl,
  isServiceWorkerFetchableVideoUrl,
  isStreamingManifestUrl,
  MAX_INLINE_VIDEO_BYTES
} from './video-url-utils.js';

const MAX_ANCESTOR_DEPTH = 12;

/**
 * @typedef {{
 *   element: HTMLVideoElement,
 *   currentSrc: string,
 *   fileUrl: string,
 *   posterUrl: string,
 *   videoWidth: number,
 *   videoHeight: number,
 *   duration: number,
 *   thumbBlob: Blob|null,
 *   thumbMime: string,
 *   blob: Blob|null,
 *   mimeType: string,
 *   usesMediaSource: boolean
 * }} HoveredVideoResult
 */

function isKeyPilotChrome(el) {
  if (!el || el.nodeType !== 1) return false;
  try {
    const id = typeof el.id === 'string' ? el.id : '';
    if (id && (id === 'kpv2-cursor' || id.startsWith('kpv2-'))) return true;
  } catch { /* ignore */ }
  try {
    const cls = typeof el.className === 'string'
      ? el.className
      : (el.className && typeof el.className.baseVal === 'string' ? el.className.baseVal : '');
    if (cls && (/\bkpv2-/.test(cls) || /\bkp-/.test(cls))) return true;
  } catch { /* ignore */ }
  return false;
}

function getParentOrHost(el) {
  let next = null;
  try { next = el.parentElement; } catch { next = null; }
  if (!next) {
    try {
      const root = el.getRootNode && el.getRootNode();
      if (root && /** @type {any} */ (root).host) next = /** @type {any} */ (root).host;
    } catch { /* ignore */ }
  }
  return next;
}

function pointInRect(x, y, rect) {
  if (!rect) return false;
  const w = Number(rect.width) || 0;
  const h = Number(rect.height) || 0;
  if (w < 1 || h < 1) return false;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function elementContainsPoint(el, x, y) {
  try {
    return pointInRect(x, y, el.getBoundingClientRect());
  } catch {
    return false;
  }
}

/**
 * @param {Element|null|undefined} el
 * @returns {HTMLVideoElement|null}
 */
function videoFromSelf(el) {
  if (!isHtmlVideo(el) || isKeyPilotChrome(el)) return null;
  return /** @type {HTMLVideoElement} */ (el);
}

/**
 * @param {Element} root
 * @param {number} x
 * @param {number} y
 * @returns {HTMLVideoElement|null}
 */
function findVideoInSubtree(root, x, y) {
  if (!root || root.nodeType !== 1) return null;
  try {
    if (typeof root.querySelectorAll !== 'function') return null;
    const videos = root.querySelectorAll('video');
    for (let i = 0; i < videos.length; i++) {
      const video = /** @type {HTMLVideoElement} */ (videos[i]);
      if (isKeyPilotChrome(video)) continue;
      if (!elementContainsPoint(video, x, y)) continue;
      return video;
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * @param {Element} start
 * @param {number} x
 * @param {number} y
 * @returns {HTMLVideoElement|null}
 */
function findVideoFromElement(start, x, y) {
  let el = start;
  let depth = 0;
  while (el && el.nodeType === 1 && depth < MAX_ANCESTOR_DEPTH) {
    if (isKeyPilotChrome(el)) {
      el = getParentOrHost(el);
      depth++;
      continue;
    }
    const self = videoFromSelf(el);
    if (self) return self;
    const nested = findVideoInSubtree(el, x, y);
    if (nested) return nested;
    el = getParentOrHost(el);
    depth++;
  }
  return null;
}

/**
 * @param {number} x
 * @param {number} y
 * @returns {HTMLVideoElement|null}
 */
function findVideoFromPointStack(x, y) {
  let stack = null;
  try {
    if (typeof document.elementsFromPoint === 'function') {
      stack = document.elementsFromPoint(x, y);
    }
  } catch {
    stack = null;
  }
  if (!stack || !stack.length) return null;
  const limit = Math.min(stack.length, 24);
  for (let i = 0; i < limit; i++) {
    const el = stack[i];
    if (!el || el.nodeType !== 1) continue;
    if (isKeyPilotChrome(el)) continue;
    const self = videoFromSelf(el);
    if (self) return self;
    const nested = findVideoInSubtree(el, x, y);
    if (nested) return nested;
  }
  return null;
}

/**
 * @param {string} raw
 * @param {string} [base]
 * @returns {string}
 */
function absolutizeUrl(raw, base) {
  const s = String(raw || '').trim();
  if (!s) return '';
  try {
    return new URL(s, base || (typeof document !== 'undefined' ? document.baseURI : undefined)).href;
  } catch {
    return s;
  }
}

/**
 * @param {HTMLVideoElement} video
 * @returns {boolean}
 */
function videoUsesMediaSource(video) {
  try {
    const srcObject = /** @type {any} */ (video).srcObject;
    if (srcObject && typeof MediaSource !== 'undefined' && srcObject instanceof MediaSource) {
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

/**
 * Collect absolute candidate URLs from the video element (currentSrc, src, <source>).
 * @param {HTMLVideoElement} video
 * @returns {string[]}
 */
export function collectVideoSourceUrls(video) {
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  const base = video?.ownerDocument?.baseURI || (typeof document !== 'undefined' ? document.baseURI : '');

  const push = (raw) => {
    const href = absolutizeUrl(raw, base);
    if (!href || seen.has(href)) return;
    seen.add(href);
    out.push(href);
  };

  try {
    const cur = typeof video.currentSrc === 'string' ? video.currentSrc.trim() : '';
    if (cur) push(cur);
  } catch { /* ignore */ }
  try {
    const src = typeof video.src === 'string' ? video.src.trim() : '';
    if (src) push(src);
  } catch { /* ignore */ }
  try {
    const sources = video.querySelectorAll?.('source[src]');
    if (sources) {
      for (let i = 0; i < sources.length; i++) {
        push(sources[i].getAttribute('src') || '');
      }
    }
  } catch { /* ignore */ }

  return out;
}

/**
 * Best URL to fetch as a progressive file (page blob: or http progressive).
 * @param {string[]} urls
 * @param {{ usesMediaSource?: boolean }} [opts]
 * @returns {string}
 */
export function pickPreferredFileUrl(urls, opts = {}) {
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
  if (!list.length) return '';

  const progressive = list.filter((u) => isProgressiveMediaUrl(u));
  // MediaSource blob: is not a real file — prefer any progressive http among <source>.
  if (opts.usesMediaSource) {
    const httpProg = progressive.filter((u) => /^https?:/i.test(u));
    if (httpProg.length) return httpProg[0];
    const http = list.filter((u) => isServiceWorkerFetchableVideoUrl(u));
    if (http.length) return http[0];
    return '';
  }

  if (progressive.length) {
    // Prefer http progressive over blob when both exist (SW can fetch http).
    const httpProg = progressive.filter((u) => /^https?:/i.test(u));
    if (httpProg.length) return httpProg[0];
    return progressive[0];
  }

  const http = list.filter((u) => isServiceWorkerFetchableVideoUrl(u));
  if (http.length) return http[0];
  return list[0] || '';
}

/**
 * Prefer a durable http(s) URL for clipboard (never a dead blob: when http exists).
 * @param {string[]} urls
 * @param {string} [fileUrl]
 * @returns {string}
 */
export function pickClipboardVideoUrl(urls, fileUrl = '') {
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
  const https = list.filter((u) => /^https?:\/\//i.test(u));
  if (https.length) {
    const prog = https.filter((u) => isProgressiveMediaUrl(u) && !isStreamingManifestUrl(u));
    if (prog.length) return prog[0];
    const nonManifest = https.filter((u) => !isStreamingManifestUrl(u));
    return nonManifest[0] || https[0];
  }
  if (fileUrl && !/^blob:/i.test(fileUrl)) return fileUrl;
  return fileUrl || list[0] || '';
}

/**
 * Page-context fetch only when the SW cannot (blob:/data:).
 * @param {string} url
 * @returns {Promise<Blob|null>}
 */
async function fetchPageLocalVideoBlob(url) {
  const src = String(url || '').trim();
  if (!src) return null;
  if (!/^(blob:|data:)/i.test(src)) return null;
  try {
    const blob = await fetchMediaBlob(src);
    return blob && blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

/**
 * Find the <video> under the cursor and return URL candidates + optional local file blob.
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ elementFromPoint?: (x: number, y: number) => Element|null }} [options]
 * @returns {Promise<HoveredVideoResult|null>}
 */
export async function getHoveredVideo(clientX, clientY, options = {}) {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

  let video = findVideoFromPointStack(clientX, clientY);

  if (!video) {
    const hitFn = typeof options.elementFromPoint === 'function'
      ? options.elementFromPoint
      : deepElementFromPoint;
    let hit = null;
    try { hit = hitFn(clientX, clientY); } catch { hit = null; }
    if (hit && hit.nodeType === 1) {
      video = findVideoFromElement(hit, clientX, clientY);
    }
  }

  if (!video) return null;

  const usesMediaSource = videoUsesMediaSource(video);
  const candidates = collectVideoSourceUrls(video);
  const fileUrl = pickPreferredFileUrl(candidates, { usesMediaSource });
  const currentSrc = pickClipboardVideoUrl(candidates, fileUrl);
  const posterUrl = getVideoPosterUrl(video);
  const videoWidth = Number(video.videoWidth) || 0;
  const videoHeight = Number(video.videoHeight) || 0;
  let duration = 0;
  try {
    const d = Number(video.duration);
    if (Number.isFinite(d) && d > 0) duration = d;
  } catch { /* ignore */ }

  /** @type {Blob|null} */
  let thumbBlob = null;
  let thumbMime = 'image/png';
  try {
    const thumb = await materializeVideoElement(video);
    if (thumb?.blob) {
      thumbBlob = thumb.blob;
      thumbMime = thumb.mimeType || 'image/png';
    }
  } catch { /* ignore */ }

  /** @type {Blob|null} */
  let blob = null;
  let mimeType = '';
  // Only fetch in-page blob:/data: here. http(s) is fetched by the service worker.
  if (fileUrl && /^(blob:|data:)/i.test(fileUrl) && !usesMediaSource) {
    try {
      blob = await fetchPageLocalVideoBlob(fileUrl);
      if (blob && blob.size > 0) {
        mimeType = blob.type || '';
      } else {
        blob = null;
      }
    } catch {
      blob = null;
    }
  }

  if (!thumbBlob && !currentSrc && !fileUrl && !videoHasDrawableFrame(video)) return null;

  return {
    element: video,
    currentSrc,
    fileUrl: fileUrl || currentSrc,
    posterUrl,
    videoWidth,
    videoHeight,
    duration,
    thumbBlob,
    thumbMime,
    blob,
    mimeType,
    usesMediaSource
  };
}
