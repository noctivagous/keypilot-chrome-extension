/**
 * Video-under-cursor extraction for Copy Video.
 * Image discovery stays in image-utils.js; this module only matches <video>.
 */

import {
  deepElementFromPoint,
  getVideoPosterUrl,
  isHtmlVideo,
  materializeVideoElement,
  videoHasDrawableFrame
} from './image-utils.js';
import { fetchMediaBlob } from '../modules/media-library-client.js';

const MAX_ANCESTOR_DEPTH = 12;

/**
 * @typedef {{
 *   element: HTMLVideoElement,
 *   currentSrc: string,
 *   posterUrl: string,
 *   videoWidth: number,
 *   videoHeight: number,
 *   duration: number,
 *   thumbBlob: Blob|null,
 *   thumbMime: string,
 *   blob: Blob|null,
 *   mimeType: string
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
 * @param {Element} start
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
 * @param {HTMLVideoElement} video
 * @returns {string}
 */
function videoCurrentSrc(video) {
  try {
    const cur = typeof video.currentSrc === 'string' ? video.currentSrc.trim() : '';
    if (cur) return cur;
  } catch { /* ignore */ }
  try {
    const src = typeof video.src === 'string' ? video.src.trim() : '';
    if (src) return src;
  } catch { /* ignore */ }
  try {
    const source = video.querySelector?.('source[src]');
    const attr = source?.getAttribute?.('src') || '';
    if (attr) {
      try {
        return new URL(attr, video.ownerDocument?.baseURI || document.baseURI).href;
      } catch {
        return String(attr);
      }
    }
  } catch { /* ignore */ }
  return '';
}

function looksLikeMediaFileUrl(url) {
  const s = String(url || '');
  if (!s) return false;
  if (/^(blob:|data:)/i.test(s)) return true;
  if (!/^https?:/i.test(s)) return false;
  const path = s.split('?')[0].split('#')[0].toLowerCase();
  return /\.(mp4|webm|ogv|ogg|mov|m4v|mkv)(\/|$)/i.test(path) || /\/video\//i.test(path);
}

/**
 * Find the <video> under the cursor and return frame thumb + optional file blob.
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

  const currentSrc = videoCurrentSrc(video);
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
  if (currentSrc && looksLikeMediaFileUrl(currentSrc)) {
    try {
      blob = await fetchMediaBlob(currentSrc);
      if (blob && blob.size > 0) {
        mimeType = blob.type || '';
      } else {
        blob = null;
      }
    } catch {
      blob = null;
    }
  }

  if (!thumbBlob && !currentSrc && !videoHasDrawableFrame(video)) return null;

  return {
    element: video,
    currentSrc,
    posterUrl,
    videoWidth,
    videoHeight,
    duration,
    thumbBlob,
    thumbMime,
    blob,
    mimeType
  };
}
