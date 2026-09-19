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

/**
 * Fill static shortcut chips after localizeElements(). Chrome i18n cannot
 * branch on OS, so markup keeps canonical Alt and JS retargets to Opt on Mac.
 * @param {ParentNode} [root]
 */
export function applyAltShortcutNodes(root = document) {
  if (!root?.querySelectorAll) return;
  for (const el of root.querySelectorAll('[data-kp-alt-mod]')) {
    el.textContent = altModifierLabel();
  }
  for (const el of root.querySelectorAll('[data-kp-alt-shortcut]')) {
    const key = el.getAttribute('data-kp-alt-shortcut');
    if (!key) continue;
    const joiner = el.getAttribute('data-kp-alt-joiner');
    el.textContent = formatAltShortcut(key, joiner ? { joiner } : undefined);
  }
}
