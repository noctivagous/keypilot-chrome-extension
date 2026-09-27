/**
 * Locale-specific stock Open URLs lists and search-engine homes.
 * Editable sources: i18n/region-defaults/<locale>.json
 * The extension loads extension/src/config/region-defaults-data.js. background.js
 * is an unbundled module service worker, so it cannot import JSON from outside
 * the extension root.
 */

import { getLocaleCandidates } from '../utils/i18n.js';
import { regionDefaultFiles } from './region-defaults-data.js';

/** @type {Readonly<Record<string, RegionDefaultsFile>>} */
const REGION_FILES = regionDefaultFiles;
const en = REGION_FILES.en;

/** @typedef {{ urls?: string[] }} StockSocialMediaDefaults */
/** @typedef {{ homeUrl?: string, searchUrlPrefix?: string }} SearchEngineUrlOverride */
/**
 * @typedef {{
 *   stockSocialMedia?: StockSocialMediaDefaults,
 *   searchEngineUrls?: Record<string, SearchEngineUrlOverride>,
 *   launcherSearchSites?: Array<{ title: string, url: string }>
 * }} RegionDefaultsFile
 */

/** Regional catalogs that inherit omitted keys from a shipped sibling. */
const REGION_PARENT = Object.freeze({
  es_419: 'es',
  zh_HK: 'zh_TW'
});

/**
 * @param {unknown} tag
 * @returns {string}
 */
function catalogId(tag) {
  return String(tag || '').trim().replace(/-/g, '_');
}

/**
 * @param {string} [uiLanguage]
 * @returns {string[]}
 */
function candidateCatalogIds(uiLanguage) {
  const out = [];
  for (const tag of getLocaleCandidates(uiLanguage)) {
    const id = catalogId(tag);
    if (!id) continue;
    out.push(id);
    const parent = REGION_PARENT[id];
    if (parent) out.push(parent);
  }
  return [...new Set(out)];
}

/**
 * @param {RegionDefaultsFile} base
 * @param {RegionDefaultsFile} overlay
 * @returns {RegionDefaultsFile}
 */
function mergeRegion(base, overlay) {
  if (!overlay) return base;
  const searchEngineUrls = { ...(base.searchEngineUrls || {}) };
  for (const [id, urls] of Object.entries(overlay.searchEngineUrls || {})) {
    searchEngineUrls[id] = {
      ...(searchEngineUrls[id] || {}),
      ...urls
    };
  }
  return {
    stockSocialMedia: overlay.stockSocialMedia || base.stockSocialMedia,
    searchEngineUrls,
    launcherSearchSites: overlay.launcherSearchSites || base.launcherSearchSites
  };
}

/**
 * @param {string} [uiLanguage]
 * @returns {RegionDefaultsFile}
 */
export function getRegionDefaults(uiLanguage) {
  let resolved = /** @type {RegionDefaultsFile} */ ({ ...en });
  for (const id of [...candidateCatalogIds(uiLanguage)].reverse()) {
    const file = REGION_FILES[id];
    if (file) resolved = mergeRegion(resolved, file);
  }
  return resolved;
}

/**
 * Shipped region-default catalog ids (underscore form).
 * @returns {string[]}
 */
export function listRegionDefaultLocales() {
  return Object.keys(REGION_FILES);
}

/**
 * @param {string} [uiLanguage]
 * @returns {string[]}
 */
export function getStockSocialMediaUrls(uiLanguage) {
  const urls = getRegionDefaults(uiLanguage).stockSocialMedia?.urls;
  return Array.isArray(urls) ? urls.slice() : [];
}

/**
 * @param {string} [uiLanguage]
 * @returns {Array<{ title: string, url: string, isDefault: true }>}
 */
export function getLauncherSearchSites(uiLanguage) {
  const rows = getRegionDefaults(uiLanguage).launcherSearchSites;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && typeof row.title === 'string' && typeof row.url === 'string')
    .map((row) => ({ title: row.title, url: row.url, isDefault: true }));
}
