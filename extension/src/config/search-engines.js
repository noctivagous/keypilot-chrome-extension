/**
 * Search engine catalog (single source of truth).
 * - SEARCH_ENGINE_META: engines selectable as KeyPilot default (settings / omnibox / newtab)
 * - getLauncherSearchSites(): locale list shown in Launcher → Searches Sites
 */

import { getLauncherSearchSites as launcherSearchSitesForLocale, getRegionDefaults } from './region-defaults.js';

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
 * English launcher search homes. Prefer {@link getLauncherSearchSites} at runtime.
 * @type {ReadonlyArray<{ title: string, url: string, isDefault: true }>}
 */
export const LAUNCHER_SEARCH_SITES = Object.freeze(
  launcherSearchSitesForLocale('en').map((row) => Object.freeze(row))
);

export { getLauncherSearchSites } from './region-defaults.js';

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
 * @param {string} [uiLanguage]
 * @returns {SearchEngineMeta}
 */
export function getSearchEngineMeta(engine, uiLanguage) {
  const id = normalizeSearchEngineId(engine);
  const base = SEARCH_ENGINE_META[id] || SEARCH_ENGINE_META[DEFAULT_SEARCH_ENGINE_ID];
  const override = getRegionDefaults(uiLanguage).searchEngineUrls?.[id];
  if (!override) return base;
  return Object.freeze({
    ...base,
    ...(override.homeUrl ? { homeUrl: override.homeUrl } : {}),
    ...(override.searchUrlPrefix ? { searchUrlPrefix: override.searchUrlPrefix } : {})
  });
}
