/**
 * Host OS helpers. Used for settings defaults (e.g. middle-click Scroll Line on Mac).
 */

/**
 * @returns {boolean}
 */
export function isMacPlatform() {
  try {
    const uaPlatform = navigator.userAgentData?.platform;
    if (typeof uaPlatform === 'string' && uaPlatform) {
      return uaPlatform === 'macOS';
    }
  } catch { /* ignore */ }
  try {
    const plat = String(navigator.platform || '');
    const ua = String(navigator.userAgent || '');
    return /^Mac/i.test(plat) || /Mac OS X/i.test(ua);
  } catch { /* ignore */ }
  return false;
}
