/**
 * PARKED: client helper formerly in `extension/src/ui/page-thumb-ui.js`.
 *
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
