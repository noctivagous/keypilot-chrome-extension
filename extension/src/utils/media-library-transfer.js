/**
 * JSON-safe binary transfer for chrome.runtime.sendMessage.
 *
 * Extension messages are JSON-serialized (not structured clone). Blob / ArrayBuffer
 * arrive as empty objects, which is why Media Library ADD used to flash "No image data".
 * Data URLs are strings and match the page-thumb path. Do not fetch(data:) — extension
 * CSP connect-src blocks it.
 */

/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(/** @type {string} */ (reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * @param {string|null|undefined} dataUrl
 * @param {string} [fallbackMime]
 * @returns {Blob|null}
 */
export function dataUrlToBlob(dataUrl, fallbackMime = 'application/octet-stream') {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return null;
  }

  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;

  const header = dataUrl.slice(5, comma);
  const payload = dataUrl.slice(comma + 1);
  const isBase64 = /;base64/i.test(header);
  const mimeMatch = header.match(/^([^;,]*)/);
  const mime = (mimeMatch && mimeMatch[1] ? mimeMatch[1] : '').trim() || fallbackMime;

  try {
    if (isBase64) {
      const binary = atob(payload);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mime });
    }
    const decoded = decodeURIComponent(payload);
    return new Blob([decoded], { type: mime });
  } catch (e) {
    console.warn('[MediaLibrary] dataUrlToBlob failed:', e?.message || e);
    return null;
  }
}
