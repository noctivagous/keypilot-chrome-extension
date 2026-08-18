/**
 * Semantic icon ids → relative path under themes/<pack>/icons/.
 * Theme `icons.overrides` replace the file for that pack; otherwise shared.
 */

export const THEME_ICON_FILES = Object.freeze({
  close: 'chrome/close.svg',
  collapse: 'chrome/collapse.svg',
  gear: 'chrome/gear.svg',
  keyboard: 'chrome/keyboard.svg',
  window: 'chrome/window.svg'
});

export const THEME_ICON_IDS = Object.freeze(Object.keys(THEME_ICON_FILES));

/**
 * @param {string} semanticId
 * @param {object} [theme]
 * @returns {string} chrome-extension URL or empty string
 */
export function getThemeIconUrl(semanticId, theme) {
  const id = typeof semanticId === 'string' ? semanticId : '';
  const baseFile = THEME_ICON_FILES[id];
  if (!baseFile || !id) return '';
  const pack = theme?.icons?.pack || 'shared';
  const fallback = theme?.icons?.fallbackPack || 'shared';
  const override = theme?.icons?.overrides && theme.icons.overrides[id];
  const file = typeof override === 'string' && override.trim() ? override.trim() : baseFile;
  const folder = override ? pack : fallback;
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(`themes/${folder}/icons/${file}`);
    }
  } catch { /* ignore */ }
  return `themes/${folder}/icons/${file}`;
}
