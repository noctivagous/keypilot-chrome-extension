/**
 * Content-script client for the Media Library service worker.
 */

import { MSG } from '../messaging/types.js';
import { isExtensionContextValid } from '../utils/extension-context.js';
import { blobToDataUrl, dataUrlToBlob } from '../utils/media-library-transfer.js';
import {
  isServiceWorkerFetchableVideoUrl,
  MAX_INLINE_VIDEO_BYTES
} from '../utils/video-url-utils.js';

/**
 * @param {object} message
 * @returns {Promise<any>}
 */
async function send(message) {
  if (!isExtensionContextValid()) {
    throw new Error('Extension context invalidated');
  }
  const response = await chrome.runtime.sendMessage(message);
  if (!response) {
    throw new Error('No response from Media Library');
  }
  return response;
}

/**
 * Fetch bytes for a page-media / hovered URL (data: or http(s)).
 * @param {string} url
 * @returns {Promise<Blob|null>}
 */
export async function fetchMediaBlob(url) {
  const src = String(url || '');
  if (!src) return null;
  try {
    if (/^data:/i.test(src)) {
      const res = await fetch(src);
      const blob = await res.blob();
      return blob && blob.size > 0 ? blob : null;
    }
    const res = await fetch(src, { credentials: 'omit', cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob && blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   blob: Blob,
 *   mime?: string,
 *   sourceUrl?: string,
 *   pageUrl?: string
 * }} input
 * @returns {Promise<{ success: boolean, duplicate: boolean, item?: any, error?: string }>}
 */
export async function addImageToMediaLibrary(input) {
  if (!(input?.blob instanceof Blob) || input.blob.size <= 0) {
    return { success: false, duplicate: false, error: 'No image data' };
  }
  let dataUrl = '';
  try {
    dataUrl = await blobToDataUrl(input.blob);
  } catch (e) {
    return { success: false, duplicate: false, error: e?.message || 'No image data' };
  }
  if (!dataUrl) {
    return { success: false, duplicate: false, error: 'No image data' };
  }
  return send({
    type: MSG.MEDIA_LIBRARY_ADD,
    kind: 'image',
    dataUrl,
    mime: input.mime || input.blob.type || '',
    sourceUrl: input.sourceUrl || '',
    pageUrl: input.pageUrl || ''
  });
}

/**
 * Store a hyperlink (href only — no fetch).
 * @param {{ sourceUrl?: string, url?: string, pageUrl?: string }} input
 * @returns {Promise<{ success: boolean, duplicate: boolean, item?: any, error?: string }>}
 */
export async function addUrlToMediaLibrary(input) {
  const sourceUrl = String(input?.sourceUrl || input?.url || '').trim();
  if (!sourceUrl) {
    return { success: false, duplicate: false, error: 'No URL' };
  }
  return send({
    type: MSG.MEDIA_LIBRARY_ADD,
    kind: 'url',
    sourceUrl,
    pageUrl: input?.pageUrl || ''
  });
}

/**
 * Store a video record (`kind: 'video'`). File bytes optional; thumb is the frame/poster.
 *
 * Prefer letting the service worker fetch http(s) progressive URLs (host_permissions).
 * Only inline page-captured blobs (blob:/data:) under {@link MAX_INLINE_VIDEO_BYTES}.
 *
 * @param {{
 *   blob?: Blob,
 *   dataUrl?: string,
 *   mime?: string,
 *   sourceUrl?: string,
 *   pageUrl?: string,
 *   thumbBlob?: Blob,
 *   thumbDataUrl?: string,
 *   width?: number,
 *   height?: number
 * }} input
 * @returns {Promise<{ success: boolean, duplicate: boolean, item?: any, error?: string }>}
 */
export async function addVideoToMediaLibrary(input) {
  const sourceUrl = String(input?.sourceUrl || '').trim();
  const canSwFetch = isServiceWorkerFetchableVideoUrl(sourceUrl);

  let dataUrl = typeof input?.dataUrl === 'string' ? input.dataUrl : '';
  const fileBlob = input?.blob instanceof Blob && input.blob.size > 0 ? input.blob : null;

  // Inline only when SW cannot fetch the URL (page-local blob:/data:), and size fits messaging.
  if (!dataUrl && fileBlob && !canSwFetch && fileBlob.size <= MAX_INLINE_VIDEO_BYTES) {
    try {
      dataUrl = await blobToDataUrl(fileBlob);
    } catch {
      dataUrl = '';
    }
  }

  let thumbDataUrl = typeof input?.thumbDataUrl === 'string' ? input.thumbDataUrl : '';
  if (!thumbDataUrl && input?.thumbBlob instanceof Blob && input.thumbBlob.size > 0) {
    try {
      thumbDataUrl = await blobToDataUrl(input.thumbBlob);
    } catch {
      thumbDataUrl = '';
    }
  }
  if (!dataUrl && !sourceUrl) {
    return { success: false, duplicate: false, error: 'No video' };
  }
  return send({
    type: MSG.MEDIA_LIBRARY_ADD,
    kind: 'video',
    dataUrl,
    mime: input?.mime || fileBlob?.type || '',
    sourceUrl,
    pageUrl: input?.pageUrl || '',
    thumbDataUrl,
    width: Number(input?.width) || 0,
    height: Number(input?.height) || 0,
    /** Ask SW to fetch http(s) bytes when we did not inline a dataUrl. */
    fetchSource: canSwFetch && !dataUrl
  });
}

/**
 * @param {{ kind?: string, domain?: string, includeThumbs?: boolean }} [opts]
 * @returns {Promise<any>}
 */
export async function listMediaLibrary(opts = {}) {
  return send({
    type: MSG.MEDIA_LIBRARY_LIST,
    kind: opts.kind || 'image',
    domain: opts.domain || '',
    includeThumbs: opts.includeThumbs !== false
  });
}

/**
 * @param {string} id
 * @returns {Promise<any>}
 */
export async function getMediaLibraryOriginal(id) {
  const response = await send({
    type: MSG.MEDIA_LIBRARY_GET,
    id: String(id || '')
  });
  const mime = response?.item?.mime || response?.mime || 'application/octet-stream';
  const blob = dataUrlToBlob(response?.dataUrl, mime);
  return { ...response, blob };
}

/**
 * @param {string[]} ids
 * @returns {Promise<any>}
 */
export async function deleteMediaLibraryItems(ids) {
  return send({
    type: MSG.MEDIA_LIBRARY_DELETE,
    ids: Array.isArray(ids) ? ids : []
  });
}

/**
 * @param {{ ids?: string[], kind?: string, domain?: string }} opts
 * @returns {Promise<any>}
 */
export async function zipMediaLibrary(opts = {}) {
  const response = await send({
    type: MSG.MEDIA_LIBRARY_ZIP,
    ids: opts.ids || null,
    kind: opts.kind || 'image',
    domain: opts.domain || ''
  });
  const blob = dataUrlToBlob(response?.dataUrl, 'application/zip');
  return { ...response, blob };
}

/**
 * Trigger a browser download from a blob URL (no chrome.downloads permission).
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  if (!(blob instanceof Blob)) return;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename || 'download';
  a.rel = 'noopener';
  a.style.display = 'none';
  document.documentElement.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => {
    try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ }
  }, 4000);
}
