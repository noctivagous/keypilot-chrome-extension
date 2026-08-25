/**
 * Apply resolved theme tokens to chrome roots, pages, and shadow hosts.
 */

import {
  DEFAULT_THEME_ID,
  getAllThemesCss,
  getCutCornerCss,
  getTheme,
  getThemeCss,
  getThemeIconUrl,
  mergeTheme,
  normalizeThemeId,
  themeToCssVars
} from '../../themes/index.js';
import { getThemeFontFaceCss } from '../../themes/font-faces.js';

export { getThemeIconUrl, getTheme, normalizeThemeId, DEFAULT_THEME_ID };

const STYLE_ATTR = 'data-kp-theme-vars';
const FONT_ATTR = 'data-kp-theme-fonts';
const ALL_THEMES_ATTR = 'data-kp-all-themes';

let _activeTheme = getTheme(DEFAULT_THEME_ID);
const _listeners = new Set();

/**
 * @returns {object}
 */
export function getActiveTheme() {
  return _activeTheme;
}

/**
 * @param {(theme: object) => void} fn
 * @returns {() => void}
 */
export function subscribeTheme(fn) {
  if (typeof fn !== 'function') return () => {};
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

function notify() {
  for (const fn of _listeners) {
    try { fn(_activeTheme); } catch { /* ignore */ }
  }
}

/**
 * @param {Element|ShadowRoot|Document|null} root
 * @param {string} css
 * @param {string} attr
 */
function injectStyle(root, css, attr) {
  if (!root) return;
  const doc = root.nodeType === 9 ? root : root.ownerDocument || document;
  const mount = root.nodeType === 9
    ? (root.head || root.documentElement)
    : (root.host ? root : root);
  if (!doc || !mount?.appendChild) return;
  let style = null;
  try { style = mount.querySelector?.(`style[${attr}]`); } catch { /* ignore */ }
  if (!style) {
    try {
      style = doc.createElement('style');
      style.setAttribute(attr, 'true');
      style.textContent = css;
      mount.appendChild(style);
    } catch { /* ignore */ }
    return;
  }
  if (style.textContent !== css) {
    try { style.textContent = css; } catch { /* ignore */ }
  }
}

/**
 * @param {Element|null} el
 * @param {object} theme
 */
export function applyThemeDataset(el, theme) {
  if (!el?.setAttribute) return;
  const id = theme?.id || DEFAULT_THEME_ID;
  try { el.setAttribute('data-kp-theme', id); } catch { /* ignore */ }
  const cut = theme?.shape?.cornerMode === 'cut';
  try {
    if (cut) el.setAttribute('data-kp-corner', 'cut');
    else el.removeAttribute('data-kp-corner');
  } catch { /* ignore */ }
}

/**
 * @param {Element|null} el
 * @param {object} theme
 */
export function applyThemeCssVars(el, theme) {
  if (!el?.style?.setProperty) return;
  const vars = themeToCssVars(theme);
  for (const [k, v] of Object.entries(vars)) {
    try { el.style.setProperty(k, v); } catch { /* ignore */ }
  }
}

/**
 * Stamp all theme maps so `data-kp-theme` switches without rewriting vars.
 * @param {Document|ShadowRoot|null} [root]
 */
export function injectAllThemeMaps(root = document) {
  injectStyle(root, getThemeFontFaceCss(), FONT_ATTR);
  injectStyle(root, `${getAllThemesCss()}\n${getCutCornerCss()}`, ALL_THEMES_ATTR);
}

const CHROME_THEME_HOST_SEL = [
  '.kp-chrome-window',
  '[data-kp-ui-shadow]',
  '[data-kp-select]',
  '.kp-select-menu-host',
  '.kp-select-menu',
  '.kpv2-settings-host',
  '.kpv2-docs-host'
].join(', ');

/**
 * Light-DOM chrome plus open shadow trees (querySelectorAll does not pierce).
 * @param {Document|ShadowRoot|Element|null} root
 * @param {Element[]} [out]
 * @param {Set<Element>} [seen]
 * @returns {Element[]}
 */
function collectChromeThemeHosts(root, out = [], seen = new Set()) {
  if (!root) return out;
  const addHost = (el) => {
    if (!el || seen.has(el)) return;
    seen.add(el);
    out.push(el);
    try {
      if (el.shadowRoot) collectChromeThemeHosts(el.shadowRoot, out, seen);
    } catch { /* ignore */ }
  };
  try {
    if (root.querySelectorAll) {
      root.querySelectorAll(CHROME_THEME_HOST_SEL).forEach(addHost);
    }
  } catch { /* ignore */ }
  return out;
}

/**
 * @param {ShadowRoot|null|undefined} shadow
 * @param {object} theme
 */
function paintShadowTheme(shadow, theme) {
  if (!shadow) return;
  injectAllThemeMaps(shadow);
  injectStyle(shadow, getThemeCss(theme), STYLE_ATTR);
}

/**
 * Refresh mask URLs that were stamped for the previous pack.
 * @param {Document|ShadowRoot|null} root
 * @param {object} theme
 */
function syncThemedIconMasks(root, theme) {
  if (!root?.querySelectorAll) return;
  try {
    root.querySelectorAll('[data-kp-theme-icon]').forEach((el) => {
      const id = el.getAttribute('data-kp-theme-icon');
      const url = getThemeIconUrl(id, theme);
      if (!url || !el.style) return;
      const img = `url("${String(url).replace(/"/g, '\\"')}")`;
      try { el.style.webkitMaskImage = img; } catch { /* ignore */ }
      try { el.style.maskImage = img; } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
}

/**
 * @param {object} theme
 * @param {{ roots?: Array<Document|ShadowRoot|null>, hosts?: Array<Element|null> }} [opts]
 */
export function applyThemeToRoots(theme, opts = {}) {
  _activeTheme = theme || getTheme(DEFAULT_THEME_ID);
  const roots = opts.roots && opts.roots.length ? opts.roots : [document];
  const hostSet = new Set();
  for (const host of (opts.hosts || [])) {
    if (host) hostSet.add(host);
  }
  try {
    collectChromeThemeHosts(document).forEach((el) => hostSet.add(el));
  } catch { /* ignore */ }
  for (const root of roots) {
    collectChromeThemeHosts(root).forEach((el) => hostSet.add(el));
  }

  for (const root of roots) {
    if (!root) continue;
    injectAllThemeMaps(root);
    injectStyle(root, getThemeCss(_activeTheme), STYLE_ATTR);
    const el = root.nodeType === 9 ? root.documentElement : (root.host || null);
    applyThemeDataset(el, _activeTheme);
    if (el) applyThemeCssVars(el, _activeTheme);
  }

  for (const host of hostSet) {
    applyThemeDataset(host, _activeTheme);
    applyThemeCssVars(host, _activeTheme);
    if (host?.shadowRoot) {
      paintShadowTheme(host.shadowRoot, _activeTheme);
      applyThemeDataset(host.shadowRoot.host, _activeTheme);
      syncThemedIconMasks(host.shadowRoot, _activeTheme);
    }
    syncThemedIconMasks(host, _activeTheme);
  }

  for (const root of roots) {
    syncThemedIconMasks(root, _activeTheme);
  }

  try {
    applyThemeDataset(document.documentElement, _activeTheme);
    applyThemeCssVars(document.documentElement, _activeTheme);
    injectAllThemeMaps(document);
    injectStyle(document, getThemeCss(_activeTheme), STYLE_ATTR);
    syncThemedIconMasks(document, _activeTheme);
  } catch { /* ignore */ }

  notify();
  try {
    const id = _activeTheme?.id;
    if (id) localStorage.setItem('kp_theme_id_v1', id);
  } catch { /* ignore */ }
  try {
    const keys = _activeTheme?.keys || {};
    localStorage.setItem('kp_theme_overrides_v1', JSON.stringify({
      keys: {
        shading: keys.shading === 'flat' ? 'flat' : 'bevel',
        cornerMode: keys.cornerMode === 'cut' ? 'cut' : 'radius',
        cutSize: keys.cutSize || '4px',
        border: keys.border || '1px solid rgba(0, 0, 0, 0.4)'
      },
      titlebar: {
        iconDisplay: (_activeTheme?.titlebar?.iconDisplay === 'inline-flex') ? 'inline-flex' : 'none'
      }
    }));
  } catch { /* ignore */ }
  return _activeTheme;
}

/**
 * Resolve theme from settings-shaped object.
 * @param {{ themeId?: string, themeOverrides?: object }} [settings]
 */
export function resolveThemeFromSettings(settings) {
  const id = normalizeThemeId(settings?.themeId);
  const overrides = settings?.themeOverrides && typeof settings.themeOverrides === 'object'
    ? settings.themeOverrides
    : {};
  return getTheme(id, overrides);
}

/**
 * Apply onboarding surface tokens onto a host (dark-pro walkthrough / layout config).
 * @param {Element|null} el
 * @param {object} [theme]
 */
export function applyOnboardingSurface(el, theme = _activeTheme) {
  if (!el?.setAttribute) return;
  try { el.setAttribute('data-kp-surface', 'onboarding'); } catch { /* ignore */ }
  const overlay = theme?.surfaces?.onboarding;
  if (!overlay) {
    applyThemeDataset(el, theme);
    applyThemeCssVars(el, theme);
    return;
  }
  const merged = mergeTheme(theme, overlay);
  applyThemeDataset(el, theme);
  applyThemeCssVars(el, merged);
}

/**
 * Click Mode / cursor patch for the given theme (used on theme select + reset).
 * @param {object} [theme]
 */
export function getThemeClickDefaults(theme = _activeTheme) {
  const d = theme?.clickDefaults || getTheme(DEFAULT_THEME_ID).clickDefaults;
  return {
    cursorMode: d.cursorMode,
    clickMode: {
      ...(d.clickMode || {}),
      cursor: { ...(d.clickMode?.cursor || {}) }
    }
  };
}
