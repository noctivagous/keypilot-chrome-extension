/**
 * Firefox 140+ built-in consent for optional video-thumbnail lookups.
 * Chrome does not expose this API, so it keeps its existing behavior.
 */

export const FIREFOX_VIDEO_THUMBNAIL_DATA_TYPES = Object.freeze([
  'browsingActivity',
]);

function firefoxPermissionsApi() {
  try {
    return globalThis.browser?.permissions || null;
  } catch {
    return null;
  }
}

export function isFirefoxDataConsentAvailable() {
  const permissions = firefoxPermissionsApi();
  return !!(
    permissions &&
    typeof permissions.getAll === 'function' &&
    typeof permissions.request === 'function'
  );
}

/**
 * Chrome has no Firefox data-consent API, so its thumbnail behavior is unchanged.
 * Firefox enables optional video-thumbnail requests only after the user grants
 * browsing-activity consent from the Settings page.
 */
export async function hasFirefoxVideoThumbnailConsent() {
  const permissions = firefoxPermissionsApi();
  if (!permissions || typeof permissions.getAll !== 'function') return true;

  try {
    const granted = await permissions.getAll();
    const dataCollection = Array.isArray(granted?.data_collection)
      ? granted.data_collection
      : [];
    return FIREFOX_VIDEO_THUMBNAIL_DATA_TYPES.every((type) => dataCollection.includes(type));
  } catch {
    return false;
  }
}

export async function requestFirefoxVideoThumbnailConsent() {
  const permissions = firefoxPermissionsApi();
  if (!permissions || typeof permissions.request !== 'function') return false;

  try {
    return !!await permissions.request({
      data_collection: [...FIREFOX_VIDEO_THUMBNAIL_DATA_TYPES],
    });
  } catch {
    return false;
  }
}
