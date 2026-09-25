/**
 * Bookmark-folder helpers for the Open Bookmarks key action.
 * Folder choice is stored on the Action Instance. The service worker reads
 * the live Bookmarks tree when the key is pressed.
 */

import { canonicalizeHttpUrl } from './open-url-list.js';

/** Maximum bookmark links one Open Bookmarks press opens. */
export const OPEN_BOOKMARKS_MAX = 30;

/** Maximum random bookmark tabs one Random Bookmark press opens. */
export const RANDOM_BOOKMARK_MAX = 30;

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeBookmarkFolderId(raw) {
  const id = String(raw ?? '').trim();
  if (!id || id.length > 64 || /\s/.test(id)) return '';
  return id;
}

/**
 * Folders in Bookmarks Manager order, skipping the invisible root.
 * @param {unknown} tree chrome.bookmarks.getTree() result
 * @returns {Array<{ id: string, path: string }>}
 */
export function listBookmarkFolders(tree) {
  /** @type {Array<{ id: string, path: string }>} */
  const out = [];
  /**
   * @param {unknown} nodes
   * @param {string[]} ancestors
   */
  const walk = (nodes, ancestors) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const children = /** @type {{ children?: unknown, url?: unknown, id?: unknown, title?: unknown }} */ (node).children;
      const url = /** @type {{ url?: unknown }} */ (node).url;
      const isFolder = !url && Array.isArray(children);
      if (!isFolder) continue;
      const id = String(/** @type {{ id?: unknown }} */ (node).id || '');
      if (id && id !== '0') {
        const title = String(/** @type {{ title?: unknown }} */ (node).title || '').trim() || id;
        const path = [...ancestors, title].join(' / ');
        out.push({ id, path });
        walk(children, [...ancestors, title]);
      } else {
        walk(children, ancestors);
      }
    }
  };
  walk(Array.isArray(tree) ? tree : [], []);
  return out;
}

/**
 * Website bookmarks in tree order, including subfolders, capped at `max`.
 * @param {unknown} nodes
 * @param {number} [max]
 * @returns {string[]}
 */
export function collectBookmarkUrls(nodes, max = OPEN_BOOKMARKS_MAX) {
  const limit = max === Infinity
    ? Infinity
    : (Number.isFinite(max) && max > 0 ? Math.floor(max) : OPEN_BOOKMARKS_MAX);
  /** @type {string[]} */
  const out = [];
  /**
   * @param {unknown} list
   */
  const walk = (list) => {
    if (!Array.isArray(list) || out.length >= limit) return;
    for (const node of list) {
      if (out.length >= limit) return;
      if (!node || typeof node !== 'object') continue;
      const url = canonicalizeHttpUrl(/** @type {{ url?: unknown }} */ (node).url);
      if (url) out.push(url);
      const children = /** @type {{ children?: unknown }} */ (node).children;
      if (Array.isArray(children) && children.length) walk(children);
    }
  };
  walk(Array.isArray(nodes) ? nodes : []);
  return out;
}

/**
 * Clamp a Random Bookmark count to 1…RANDOM_BOOKMARK_MAX.
 * @param {unknown} raw
 * @returns {number}
 */
export function normalizeRandomBookmarkCount(raw) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 1;
  return Math.min(RANDOM_BOOKMARK_MAX, Math.max(1, n));
}

/**
 * Pick up to `count` distinct bookmark URLs.
 * @param {readonly string[]} urls
 * @param {unknown} count
 * @param {() => number} [random] Returns a number in [0, 1).
 * @returns {string[]}
 */
export function pickRandomBookmarkUrls(urls, count, random = Math.random) {
  /** @type {string[]} */
  const pool = [];
  const seen = new Set();
  for (const url of urls || []) {
    const key = String(url || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    pool.push(key);
  }
  const n = Math.min(pool.length, normalizeRandomBookmarkCount(count));
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, n);
}
