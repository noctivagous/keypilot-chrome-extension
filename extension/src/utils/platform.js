/**
 * Host OS helpers. Used for settings defaults (e.g. middle-click Scroll Line on Mac)
 * and for Option/Alt shortcut legends (Mac Opt, all other hosts Alt).
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

/**
 * Short legend for the Option/Alt modifier. Mac shows Opt; Windows, Linux, and
 * ChromeOS show Alt. Presentation only — event handling stays `e.altKey`.
 * @returns {'Opt'|'Alt'}
 */
export function altModifierLabel() {
  return isMacPlatform() ? 'Opt' : 'Alt';
}

/**
 * Format a system-key shortcut for UI copy (chips, tooltips, getMessage substitutions).
 * @param {string} key
 * @param {{ joiner?: string }} [options]
 * @returns {string}
 */
export function formatAltShortcut(key, options = {}) {
  const joiner = options.joiner ?? '+';
  return `${altModifierLabel()}${joiner}${key}`;
}
