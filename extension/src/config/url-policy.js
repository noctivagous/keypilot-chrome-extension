/**
 * URL / tab skip policy (single source of truth).
 * Used by the service worker for tab switching and navigation graph recording.
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
