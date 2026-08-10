/**
 * Launch Deck state + composition.
 *
 * Persists per-category order / removed / custom via chrome.storage (sync → local).
 * Migrates legacy kpLauncherHiddenLaunchDeck into removed lists.
 */

import { storageGetValue, storageSetValue } from './storage.js';
import {
  LAUNCHER_CATALOG_CATEGORY_KEYS,
  getLauncherCatalog
} from '../config/launcher-sites.js';

export const LAUNCH_DECK_STATE_KEY = 'kpLaunchDeckState_v1';
export const LEGACY_HIDDEN_LAUNCH_DECK_KEY = 'kpLauncherHiddenLaunchDeck';

/**
 * @typedef {{
 *   order: string[],
 *   removed: string[],
 *   custom: Array<{ title: string, url: string }>
 * }} LaunchDeckCategoryState
 */

/**
 * @typedef {Record<string, LaunchDeckCategoryState>} LaunchDeckState
 */

/**
 * Normalize a URL for deck identity / matching.
 * @param {string} url
 * @returns {string}
 */
export function normalizeLaunchDeckUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    const host = (u.hostname || '').toLowerCase();
    const path = (u.pathname || '').replace(/\/+$/, '');
    return `${u.protocol}//${host}${path}${u.search || ''}`;
  } catch {
    return String(url || '').trim().toLowerCase();
  }
}

/**
 * Host without leading www.
 * @param {string} url
 * @returns {string}
 */
export function launchDeckHost(url) {
  try {
    return new URL(String(url || '').trim()).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * @returns {LaunchDeckCategoryState}
 */
export function emptyCategoryDeckState() {
  return { order: [], removed: [], custom: [] };
}

/**
 * @param {any} raw
 * @returns {LaunchDeckCategoryState}
 */
function normalizeCategoryState(raw) {
  const out = emptyCategoryDeckState();
  if (!raw || typeof raw !== 'object') return out;
  if (Array.isArray(raw.order)) {
    out.order = raw.order
      .map((u) => normalizeLaunchDeckUrl(String(u || '')))
      .filter(Boolean);
  }
  if (Array.isArray(raw.removed)) {
    out.removed = raw.removed
      .map((u) => normalizeLaunchDeckUrl(String(u || '')))
      .filter(Boolean);
  }
  if (Array.isArray(raw.custom)) {
    out.custom = raw.custom
      .map((c) => {
        const url = String(c?.url || '').trim();
        const key = normalizeLaunchDeckUrl(url);
        if (!key) return null;
        return {
          title: String(c?.title || '').trim() || key,
          url
        };
      })
      .filter(Boolean);
  }
  return out;
}

/**
 * @param {any} raw
 * @returns {LaunchDeckState}
 */
export function normalizeLaunchDeckState(raw) {
  /** @type {LaunchDeckState} */
  const state = Object.create(null);
  for (const key of LAUNCHER_CATALOG_CATEGORY_KEYS) {
    state[key] = normalizeCategoryState(raw?.[key]);
  }
  return state;
}

/**
 * @param {LaunchDeckState} state
 * @param {string[]} hiddenUrls
 * @returns {LaunchDeckState}
 */
export function migrateHiddenIntoRemoved(state, hiddenUrls) {
  const next = normalizeLaunchDeckState(state);
  const hidden = (Array.isArray(hiddenUrls) ? hiddenUrls : [])
    .map((u) => normalizeLaunchDeckUrl(String(u || '')))
    .filter(Boolean);
  if (!hidden.length) return next;

  for (const key of LAUNCHER_CATALOG_CATEGORY_KEYS) {
    const removed = new Set(next[key].removed);
    for (const h of hidden) removed.add(h);
    next[key].removed = Array.from(removed);
  }
  return next;
}

/**
 * Load deck state; migrate legacy hide list once.
 * @returns {Promise<LaunchDeckState>}
 */
export async function loadLaunchDeckState() {
  try {
    const raw = await storageGetValue(LAUNCH_DECK_STATE_KEY, null);
    let state = normalizeLaunchDeckState(raw);

    const legacy = await storageGetValue(LEGACY_HIDDEN_LAUNCH_DECK_KEY, null);
    if (Array.isArray(legacy) && legacy.length) {
      state = migrateHiddenIntoRemoved(state, legacy);
      await persistLaunchDeckState(state);
      try {
        await storageSetValue(LEGACY_HIDDEN_LAUNCH_DECK_KEY, []);
      } catch {
        /* ignore */
      }
    }
    return state;
  } catch (err) {
    console.warn('[launch-deck] Failed to load state:', err);
    return normalizeLaunchDeckState(null);
  }
}

/**
 * @param {LaunchDeckState} state
 * @returns {Promise<void>}
 */
export async function persistLaunchDeckState(state) {
  try {
    await storageSetValue(LAUNCH_DECK_STATE_KEY, normalizeLaunchDeckState(state));
  } catch (err) {
    console.warn('[launch-deck] Failed to persist state:', err);
  }
}

/**
 * @param {LaunchDeckState} state
 * @param {string} categoryKey
 * @returns {LaunchDeckCategoryState}
 */
export function getCategoryDeckState(state, categoryKey) {
  return state?.[categoryKey] || emptyCategoryDeckState();
}

/**
 * Pathname without trailing slash (empty for `/`).
 * @param {string} url
 * @returns {string}
 */
function sitePathPrefix(url) {
  try {
    const path = new URL(String(url || '').trim()).pathname || '';
    if (!path || path === '/') return '';
    return path.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/**
 * Whether a history/item URL belongs to a catalog site (host + optional path).
 * @param {string} itemUrl
 * @param {{ url?: string }} site
 * @param {Array<{ url?: string }>} [siblings]
 * @returns {boolean}
 */
export function itemMatchesLaunchSite(itemUrl, site, siblings = null) {
  const siteHost = launchDeckHost(site?.url);
  const itemHost = launchDeckHost(itemUrl);
  if (!siteHost || !itemHost) return false;

  if (itemHost !== siteHost && !itemHost.endsWith('.' + siteHost)) {
    return false;
  }

  const sitePath = sitePathPrefix(site.url);
  let itemPath = '';
  try {
    itemPath = (new URL(String(itemUrl || '').trim()).pathname || '').replace(/\/+$/, '');
    if (itemPath === '/') itemPath = '';
  } catch {
    return false;
  }

  if (sitePath) {
    return itemPath === sitePath || itemPath.startsWith(`${sitePath}/`);
  }

  const sibs = Array.isArray(siblings) ? siblings : [];
  for (const sib of sibs) {
    if (!sib?.url || sib.url === site.url) continue;
    const sibHost = launchDeckHost(sib.url);
    const sibPath = sitePathPrefix(sib.url);
    if (!sibPath || !sibHost) continue;
    const hostOk = itemHost === sibHost || itemHost.endsWith('.' + sibHost);
    if (!hostOk) continue;
    if (itemPath === sibPath || itemPath.startsWith(`${sibPath}/`)) {
      return false;
    }
  }
  return true;
}

/**
 * Visit score / last visit for a site against history rows.
 * @param {{ url?: string }} site
 * @param {Array<{ url?: string, visitCount?: number, lastVisitTime?: number }>} history
 * @param {Array<{ url?: string }>} siblings
 * @returns {{ visitCount: number, lastVisitTime: number }}
 */
export function siteVisitStats(site, history, siblings) {
  let visitCount = 0;
  let lastVisitTime = 0;
  if (!Array.isArray(history) || !history.length) {
    return { visitCount, lastVisitTime };
  }
  for (const item of history) {
    if (!itemMatchesLaunchSite(item?.url, site, siblings)) continue;
    const n = Number(item.visitCount);
    visitCount += Number.isFinite(n) && n > 0 ? n : 1;
    const t = Number(item.lastVisitTime) || 0;
    if (t > lastVisitTime) lastVisitTime = t;
  }
  return { visitCount, lastVisitTime };
}

/**
 * Compose Launch Deck cards for a catalog category.
 *
 * @param {string} categoryKey
 * @param {{
 *   state?: LaunchDeckState,
 *   history?: Array<{ url?: string, visitCount?: number, lastVisitTime?: number }>,
 *   showDeck?: boolean
 * }} [opts]
 * @returns {Array<{
 *   title: string,
 *   url: string,
 *   seed?: boolean,
 *   isDefault?: boolean,
 *   searchUrlPrefix?: string,
 *   visitCount: number,
 *   lastVisitTime: number,
 *   custom?: boolean
 * }>}
 */
export function composeLaunchDeck(categoryKey, opts = {}) {
  if (opts.showDeck === false) return [];

  const catalog = getLauncherCatalog(categoryKey);
  if (!catalog.length && categoryKey !== 'searches') return [];

  const catState = getCategoryDeckState(opts.state, categoryKey);
  const removed = new Set(catState.removed || []);
  const history = Array.isArray(opts.history) ? opts.history : [];
  const siblings = catalog;

  /** @type {Map<string, any>} */
  const byKey = new Map();

  const addCandidate = (entry, flags = {}) => {
    const key = normalizeLaunchDeckUrl(entry.url);
    if (!key || removed.has(key)) return;
    const stats = siteVisitStats(entry, history, siblings);
    const prev = byKey.get(key);
    const next = {
      title: entry.title || key,
      url: entry.url,
      seed: !!entry.seed,
      isDefault: entry.isDefault !== undefined ? !!entry.isDefault : !!entry.seed,
      searchUrlPrefix: entry.searchUrlPrefix,
      visitCount: stats.visitCount,
      lastVisitTime: stats.lastVisitTime,
      custom: !!flags.custom,
      ...flags
    };
    if (!prev) {
      byKey.set(key, next);
      return;
    }
    // Prefer richer metadata; keep higher visit stats.
    byKey.set(key, {
      ...prev,
      ...next,
      title: prev.title || next.title,
      searchUrlPrefix: prev.searchUrlPrefix || next.searchUrlPrefix,
      visitCount: Math.max(prev.visitCount || 0, next.visitCount || 0),
      lastVisitTime: Math.max(prev.lastVisitTime || 0, next.lastVisitTime || 0),
      seed: prev.seed || next.seed,
      custom: prev.custom || next.custom
    });
  };

  // Seeds always eligible (unless removed).
  for (const site of catalog) {
    if (site.seed) addCandidate(site);
  }

  // Catalog sites with any visit match (auto-add).
  for (const site of catalog) {
    if (site.seed) continue;
    const stats = siteVisitStats(site, history, siblings);
    if (stats.visitCount > 0) addCandidate(site);
  }

  // User customs.
  for (const custom of catState.custom || []) {
    addCandidate(custom, { custom: true, seed: false, isDefault: false });
  }

  // Manually ordered URLs that were re-added after remove: if in order and in
  // catalog/custom already handled; also re-include catalog entries listed in
  // order even if not seed/visited (user explicitly added via picker).
  for (const orderedUrl of catState.order || []) {
    const key = normalizeLaunchDeckUrl(orderedUrl);
    if (!key || removed.has(key) || byKey.has(key)) continue;
    const fromCatalog = catalog.find(
      (s) => normalizeLaunchDeckUrl(s.url) === key
    );
    if (fromCatalog) {
      addCandidate(fromCatalog);
      continue;
    }
    const fromCustom = (catState.custom || []).find(
      (c) => normalizeLaunchDeckUrl(c.url) === key
    );
    if (fromCustom) addCandidate(fromCustom, { custom: true });
  }

  const candidates = Array.from(byKey.values());
  const order = Array.isArray(catState.order) ? catState.order : [];
  const hasOrder = order.length > 0;

  if (hasOrder) {
    const orderIndex = new Map(
      order.map((u, i) => [normalizeLaunchDeckUrl(u), i])
    );
    const ordered = [];
    const unordered = [];
    for (const item of candidates) {
      const key = normalizeLaunchDeckUrl(item.url);
      if (orderIndex.has(key)) ordered.push(item);
      else unordered.push(item);
    }
    ordered.sort(
      (a, b) =>
        (orderIndex.get(normalizeLaunchDeckUrl(a.url)) ?? 0) -
        (orderIndex.get(normalizeLaunchDeckUrl(b.url)) ?? 0)
    );
    unordered.sort(compareByVisitsThenCatalog);
    return [...ordered, ...unordered];
  }

  return candidates.slice().sort(compareByVisitsThenCatalog);
}

/**
 * @param {{ visitCount?: number, lastVisitTime?: number, seed?: boolean, title?: string }} a
 * @param {{ visitCount?: number, lastVisitTime?: number, seed?: boolean, title?: string }} b
 */
function compareByVisitsThenCatalog(a, b) {
  const va = Number(a.visitCount) || 0;
  const vb = Number(b.visitCount) || 0;
  if (vb !== va) return vb - va;
  const la = Number(a.lastVisitTime) || 0;
  const lb = Number(b.lastVisitTime) || 0;
  if (lb !== la) return lb - la;
  // Never-visited seeds after visited; among equal, title.
  if (!!b.seed !== !!a.seed) return a.seed ? 1 : -1;
  return String(a.title || '').localeCompare(String(b.title || ''));
}

/**
 * Ensure category bucket exists on mutable state.
 * @param {LaunchDeckState} state
 * @param {string} categoryKey
 * @returns {LaunchDeckCategoryState}
 */
export function ensureCategoryDeckState(state, categoryKey) {
  if (!state[categoryKey]) state[categoryKey] = emptyCategoryDeckState();
  return state[categoryKey];
}

/**
 * Remove a URL from the deck for a category (persists exclusion).
 * @param {LaunchDeckState} state
 * @param {string} categoryKey
 * @param {string} url
 * @returns {LaunchDeckState}
 */
export function removeFromLaunchDeck(state, categoryKey, url) {
  const next = normalizeLaunchDeckState(state);
  if (!LAUNCHER_CATALOG_CATEGORY_KEYS.includes(categoryKey)) return next;
  const cat = ensureCategoryDeckState(next, categoryKey);
  const key = normalizeLaunchDeckUrl(url);
  if (!key) return next;
  if (!cat.removed.includes(key)) cat.removed.push(key);
  cat.order = cat.order.filter((u) => normalizeLaunchDeckUrl(u) !== key);
  cat.custom = cat.custom.filter((c) => normalizeLaunchDeckUrl(c.url) !== key);
  return next;
}

/**
 * Add a catalog or custom site; clears removed and appends to order.
 * @param {LaunchDeckState} state
 * @param {string} categoryKey
 * @param {{ title: string, url: string, fromCatalog?: boolean }} site
 * @returns {LaunchDeckState}
 */
export function addToLaunchDeck(state, categoryKey, site) {
  const next = normalizeLaunchDeckState(state);
  if (!LAUNCHER_CATALOG_CATEGORY_KEYS.includes(categoryKey)) return next;
  const cat = ensureCategoryDeckState(next, categoryKey);
  const key = normalizeLaunchDeckUrl(site.url);
  if (!key) return next;

  cat.removed = cat.removed.filter((u) => u !== key);
  if (!cat.order.includes(key)) cat.order.push(key);

  const inCatalog = getLauncherCatalog(categoryKey).some(
    (s) => normalizeLaunchDeckUrl(s.url) === key
  );
  if (!inCatalog && !site.fromCatalog) {
    const exists = cat.custom.some((c) => normalizeLaunchDeckUrl(c.url) === key);
    if (!exists) {
      cat.custom.push({
        title: site.title || key,
        url: site.url
      });
    }
  }
  return next;
}

/**
 * Persist explicit order from current deck URL list.
 * @param {LaunchDeckState} state
 * @param {string} categoryKey
 * @param {string[]} urlsInOrder
 * @returns {LaunchDeckState}
 */
export function setLaunchDeckOrder(state, categoryKey, urlsInOrder) {
  const next = normalizeLaunchDeckState(state);
  if (!LAUNCHER_CATALOG_CATEGORY_KEYS.includes(categoryKey)) return next;
  const cat = ensureCategoryDeckState(next, categoryKey);
  cat.order = (urlsInOrder || [])
    .map((u) => normalizeLaunchDeckUrl(u))
    .filter(Boolean);
  return next;
}

/**
 * Catalog entries not currently on the composed deck (for Add picker).
 * @param {string} categoryKey
 * @param {Array<{ url?: string }>} currentDeck
 * @returns {Array<{ title: string, url: string }>}
 */
export function getAddableCatalogSites(categoryKey, currentDeck) {
  const onDeck = new Set(
    (currentDeck || [])
      .map((s) => normalizeLaunchDeckUrl(s?.url))
      .filter(Boolean)
  );
  return getLauncherCatalog(categoryKey)
    .filter((s) => !onDeck.has(normalizeLaunchDeckUrl(s.url)))
    .map((s) => ({ title: s.title, url: s.url }));
}
