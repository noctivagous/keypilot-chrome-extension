import { cssVarsToBlock, getCutCornerCss, getSelectMenuCss, getTitlebarChromeCss, hasThemeOverrides, mergeTheme, normalizeThemeId, themeToCssVars, THEME_IDS, THEME_META, DEFAULT_THEME_ID } from './schema.js';
import { DARK_PRO_THEME } from './dark-pro/theme.js';
import { GRAY_METAL_PRO_THEME } from './gray-metal-pro/theme.js';
import { GX_ER_THEME } from './gx-er/theme.js';
import { getThemeIconUrl } from './icons.js';

export {
  DEFAULT_THEME_ID,
  THEME_IDS,
  THEME_META,
  normalizeThemeId,
  themeToCssVars,
  cssVarsToBlock,
  getCutCornerCss,
  getSelectMenuCss,
  getTitlebarChromeCss,
  mergeTheme,
  hasThemeOverrides,
  getThemeIconUrl
};

const PACKAGES = Object.freeze({
  'dark-pro': DARK_PRO_THEME,
  'gray-metal-pro': GRAY_METAL_PRO_THEME,
  'gx-er': GX_ER_THEME
});

/**
 * @returns {{ id: string, name: string }[]}
 */
export function listThemes() {
  return THEME_IDS.map((id) => ({ id, name: THEME_META[id]?.name || id }));
}

/**
 * @param {string} [id]
 * @param {object} [overrides]
 */
export function getTheme(id, overrides) {
  const key = normalizeThemeId(id);
  const base = PACKAGES[key] || PACKAGES[DEFAULT_THEME_ID];
  return mergeTheme(base, overrides && typeof overrides === 'object' ? overrides : {});
}

/**
 * All theme CSS var maps keyed by id (for early-inject stamp).
 * @returns {string}
 */
export function getAllThemesCss() {
  const blocks = THEME_IDS.map((id) => {
    const vars = themeToCssVars(getTheme(id));
    return cssVarsToBlock(
      vars,
      `:host([data-kp-theme="${id}"]), [data-kp-theme="${id}"]`
    );
  });
  const onboarding = themeToCssVars(
    mergeTheme(DARK_PRO_THEME, DARK_PRO_THEME.surfaces?.onboarding || {})
  );
  blocks.push(cssVarsToBlock(
    onboarding,
    `[data-kp-theme="dark-pro"][data-kp-surface="onboarding"], [data-kp-theme="dark-pro"] [data-kp-surface="onboarding"]`
  ));
  return `${blocks.join('\n')}\n${getCutCornerCss()}\n${getTitlebarChromeCss()}\n${getSelectMenuCss()}`;
}

/**
 * @param {object} theme
 * @returns {string}
 */
export function getThemeCss(theme) {
  const vars = themeToCssVars(theme);
  const id = theme?.id || DEFAULT_THEME_ID;
  return `${cssVarsToBlock(vars, `:host, :root, [data-kp-theme="${id}"]`)}\n${getCutCornerCss()}\n${getTitlebarChromeCss()}\n${getSelectMenuCss()}`;
}
