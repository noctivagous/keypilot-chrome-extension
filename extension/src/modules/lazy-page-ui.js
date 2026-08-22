/**
 * Lazy loaders for occasional extension-page UI (Settings, Docs).
 *
 * Bundles are local MV3 web-accessible resources. The specifier is always
 * `chrome.runtime.getURL(...)` so esbuild cannot fold them into content-bundled.js,
 * and so packaged builds never fetch remote code.
 */

/** @typedef {'docs'|'settings'} PageUiId */

export const PAGE_UI_BUNDLES = Object.freeze({
  docs: 'pages/docs-bundled.js',
  settings: 'pages/settings-bundled.js'
});

/** @type {Map<PageUiId, Promise<any>>} */
const cache = new Map();

/**
 * @param {PageUiId} id
 * @returns {string}
 */
export function pageUiBundlePath(id) {
  const rel = PAGE_UI_BUNDLES[id];
  if (!rel) throw new Error(`Unknown page UI bundle: ${id}`);
  return rel;
}

/**
 * @param {PageUiId} id
 * @returns {string}
 */
export function pageUiBundleUrl(id) {
  if (typeof chrome?.runtime?.getURL !== 'function') {
    throw new Error('chrome.runtime.getURL is required to load page UI');
  }
  return chrome.runtime.getURL(pageUiBundlePath(id));
}

/**
 * Dynamic-import a page UI ESM bundle. Cached after the first successful call.
 * @param {PageUiId} id
 * @returns {Promise<any>}
 */
export function loadPageUi(id) {
  const hit = cache.get(id);
  if (hit) return hit;
  const href = pageUiBundleUrl(id);
  const pending = import(href);
  cache.set(id, pending);
  pending.catch(() => {
    cache.delete(id);
  });
  return pending;
}

export function loadDocsUi() {
  return loadPageUi('docs');
}

export function loadSettingsUi() {
  return loadPageUi('settings');
}
