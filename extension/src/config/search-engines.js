/**
 * Search engine catalog (single source of truth).
 * - SEARCH_ENGINE_META: engines selectable as KeyPilot default (settings / omnibox / newtab)
 * - LAUNCHER_SEARCH_SITES: full list shown in Launcher → Searches Sites
 */

/** @typedef {'brave'|'google'|'duckduckgo'} SearchEngineId */

/**
 * @typedef {{
 *   id: SearchEngineId,
 *   label: string,
 *   homeUrl: string,
 *   searchUrlPrefix: string
 * }} SearchEngineMeta
 */

/** @type {Readonly<Record<SearchEngineId, SearchEngineMeta>>} */
export const SEARCH_ENGINE_META = Object.freeze({
  brave: Object.freeze({
    id: 'brave',
    label: 'Brave',
    homeUrl: 'https://search.brave.com/',
    searchUrlPrefix: 'https://search.brave.com/search?q='
  }),
  google: Object.freeze({
    id: 'google',
    label: 'Google',
    homeUrl: 'https://www.google.com/',
    searchUrlPrefix: 'https://www.google.com/search?q='
  }),
  duckduckgo: Object.freeze({
    id: 'duckduckgo',
    label: 'DuckDuckGo',
    homeUrl: 'https://duckduckgo.com/',
    searchUrlPrefix: 'https://duckduckgo.com/?q='
  })
});

export const DEFAULT_SEARCH_ENGINE_ID = /** @type {SearchEngineId} */ ('brave');

/**
 * Launcher Sites for the Searches category.
 * Includes settings engines plus additional common search homes.
 * @type {ReadonlyArray<{ title: string, url: string, isDefault: true }>}
 */
export const LAUNCHER_SEARCH_SITES = Object.freeze([
  Object.freeze({ title: 'Google', url: 'https://google.com', isDefault: true }),
  Object.freeze({ title: 'Bing', url: 'https://bing.com', isDefault: true }),
  Object.freeze({ title: 'DuckDuckGo', url: 'https://duckduckgo.com', isDefault: true }),
  Object.freeze({ title: 'Yahoo', url: 'https://yahoo.com', isDefault: true }),
  Object.freeze({ title: 'Brave Search', url: 'https://search.brave.com', isDefault: true }),
  Object.freeze({ title: 'Ecosia', url: 'https://ecosia.org', isDefault: true }),
  Object.freeze({ title: 'Startpage', url: 'https://startpage.com', isDefault: true }),
  Object.freeze({ title: 'Yandex', url: 'https://yandex.com', isDefault: true })
]);

/**
 * @param {any} raw
 * @returns {SearchEngineId}
 */
export function normalizeSearchEngineId(raw) {
  if (raw === 'google' || raw === 'duckduckgo' || raw === 'brave') return raw;
  return DEFAULT_SEARCH_ENGINE_ID;
}

/**
 * @param {any} engine
 * @returns {SearchEngineMeta}
 */
export function getSearchEngineMeta(engine) {
  const id = normalizeSearchEngineId(engine);
  return SEARCH_ENGINE_META[id] || SEARCH_ENGINE_META[DEFAULT_SEARCH_ENGINE_ID];
}
