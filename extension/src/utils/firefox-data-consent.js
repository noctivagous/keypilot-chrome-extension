/**
 * Firefox 140+ built-in consent for KeyPilot's user-enabled external lookups.
 * Chrome does not expose this API, so it keeps its existing behavior.
 */

export const FIREFOX_EXTERNAL_LOOKUP_DATA_TYPES = Object.freeze([
  'browsingActivity',
  'websiteContent',
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
 * Chrome has no Firefox data-consent API, so its lookup behavior is unchanged.
 * Firefox enables external lookups only after the user grants every declared
 * data type from the Settings page.
 */
export async function hasFirefoxExternalLookupConsent() {
  const permissions = firefoxPermissionsApi();
  if (!permissions || typeof permissions.getAll !== 'function') return true;

  try {
    const granted = await permissions.getAll();
    const dataCollection = Array.isArray(granted?.data_collection)
      ? granted.data_collection
      : [];
    return FIREFOX_EXTERNAL_LOOKUP_DATA_TYPES.every((type) => dataCollection.includes(type));
  } catch {
    return false;
  }
}

export async function requestFirefoxExternalLookupConsent() {
  const permissions = firefoxPermissionsApi();
  if (!permissions || typeof permissions.request !== 'function') return false;

  try {
    return !!await permissions.request({
      data_collection: [...FIREFOX_EXTERNAL_LOOKUP_DATA_TYPES],
    });
  } catch {
    return false;
  }
}
