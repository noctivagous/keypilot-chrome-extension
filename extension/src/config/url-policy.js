/**
 * URL / tab skip policy (single source of truth).
 * Used by the service worker for tab switching and navigation graph recording,
 * and by the toolbar popup to hide KeyPilot where content scripts cannot run.
 */

/** Schemes that should not be recorded in the per-tab navigation graph. */
export const SKIP_URL_PATTERNS = Object.freeze([
  /^chrome:\/\//i,
  /^chrome-extension:\/\//i,
  /^edge:\/\//i,
  /^about:/i,
  /^data:/i,
  /^chrome-native:/i,
  /^view-source:/i
]);

/**
 * Patterns for Q/W tab cycling (after KeyPilot New Tab is allowlisted).
 * Note: chrome-extension:// is intentionally not in this list so other extension
 * pages can participate if needed; New Tab is handled explicitly below.
 */
export const SKIP_TAB_URL_PATTERNS = Object.freeze([
  /^chrome:\/\//i,
  /^edge:\/\//i,
  /^about:/i,
  /^data:/i,
  /^chrome-native:/i,
  /^view-source:/i
]);

/**
 * Schemes Chromium will not inject content scripts into (plus sibling browsers).
 * chrome-extension:// is handled separately so our own pages stay usable.
 */
export const CONTENT_SCRIPT_RESTRICTED_SCHEMES = Object.freeze([
  /^chrome:\/\//i,
  /^chrome-untrusted:\/\//i,
  /^chrome-search:\/\//i,
  /^chrome-native:\/\//i,
  /^edge:\/\//i,
  /^opera:\/\//i,
  /^brave:\/\//i,
  /^about:/i,
  /^data:/i,
  /^javascript:/i,
  /^view-source:/i,
  /^devtools:\/\//i,
  /^moz-extension:\/\//i
]);

/**
 * @param {string|null|undefined} url
 * @returns {boolean}
 */
export function isSkippableUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const u = url.trim();
  if (!u) return true;
  return SKIP_URL_PATTERNS.some((pattern) => pattern.test(u));
}

/**
 * True when this URL is KeyPilot's custom New Tab (or Chromium's chrome://newtab
 * surface while that override is active).
 * @param {string|null|undefined} u
 * @returns {boolean}
 */
export function isKeyPilotNewTabUrl(u) {
  if (!u || typeof u !== 'string') return false;
  const s = u.trim();
  if (!s) return false;

  // Common Chromium/Chrome variants when New Tab is overridden.
  if (/^chrome:\/\/newtab\/?/i.test(s) || /^chrome:\/\/new-tab-page\/?/i.test(s)) {
    return true;
  }

  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return false;
    const kpNewTabUrl = chrome.runtime.getURL('pages/newtab.html');
    if (s === kpNewTabUrl || s.startsWith(`${kpNewTabUrl}#`) || s.startsWith(`${kpNewTabUrl}?`)) {
      return true;
    }
    const kp = new URL(kpNewTabUrl);
    const parsed = new URL(s);
    if (parsed.origin === kp.origin && parsed.pathname.endsWith('/pages/newtab.html')) {
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * True for this extension's own chrome-extension:// pages (settings, docs, newtab.html).
 * @param {string|null|undefined} url
 * @returns {boolean}
 */
export function isOwnExtensionUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const s = url.trim();
  if (!s) return false;
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return false;
    // Compare protocol + host, not origin: chrome-extension: is a non-special
    // scheme in the URL spec, so origin is the string "null" in some parsers.
    const own = new URL(chrome.runtime.getURL('_/'));
    const parsed = new URL(s);
    return parsed.protocol === own.protocol && parsed.host === own.host;
  } catch {
    return false;
  }
}

/**
 * Chrome / Edge / Opera extension galleries block content scripts even on https.
 * @param {string|null|undefined} url
 * @returns {boolean}
 */
export function isWebStoreUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host === 'chromewebstore.google.com' || host.endsWith('.chromewebstore.google.com')) {
      return true;
    }
    if (host === 'chrome.google.com' && (path === '/webstore' || path.startsWith('/webstore/'))) {
      return true;
    }
    if (host === 'microsoftedge.microsoft.com' && (path === '/addons' || path.startsWith('/addons/'))) {
      return true;
    }
    if (host === 'addons.opera.com' || host.endsWith('.addons.opera.com')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Whether Chrome will refuse to run this extension's content scripts on `url`.
 * Includes chrome:// (extensions, NTP, settings), the Web Store, and other
 * extension pages. Own KeyPilot pages are allowed. file:// is left to the
 * user "Allow access to file URLs" setting — probe injectability at runtime.
 *
 * @param {string|null|undefined} url
 * @returns {boolean}
 */
export function isContentScriptRestrictedUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const s = url.trim();
  if (!s) return true;
  if (isOwnExtensionUrl(s)) return false;
  if (isWebStoreUrl(s)) return true;
  if (/^chrome-extension:\/\//i.test(s)) return true;
  return CONTENT_SCRIPT_RESTRICTED_SCHEMES.some((pattern) => pattern.test(s));
}

/**
 * Whether a browser tab should be skipped for Q/W tab cycling.
 * @param {{ url?: string, pendingUrl?: string }|null|undefined} tab
 * @returns {boolean}
 */
export function isSkippableTab(tab) {
  const url = typeof tab?.url === 'string' ? tab.url : '';
  const pendingUrl = typeof tab?.pendingUrl === 'string' ? tab.pendingUrl : '';
  if (!url && !pendingUrl) return true;

  // Always allow the KeyPilot custom New Tab page in left/right tab cycling.
  if (isKeyPilotNewTabUrl(url) || isKeyPilotNewTabUrl(pendingUrl)) return false;

  return SKIP_TAB_URL_PATTERNS.some((pattern) => pattern.test(url || pendingUrl));
}
