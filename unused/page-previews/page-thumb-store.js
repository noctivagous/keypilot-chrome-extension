/**
 * IndexedDB store for low-res page screenshots used as card backgrounds.
 *
 * PARKED: originally `extension/src/utils/page-thumb-store.js`.
 *
 * Not for chrome.storage.local — favicon-style data URLs do not scale to
 * thousands of page previews. Blobs live here; UI fetches via the SW.
 */

export const PAGE_THUMB_DB_NAME = 'kp_page_thumbs';
export const PAGE_THUMB_DB_VERSION = 2;
export const PAGE_THUMB_STORE = 'thumbs';
/** Maps requested/pre-redirect urlKey → final capture urlKey after load. */
export const PAGE_THUMB_REDIRECT_STORE = 'redirects';

/** Tracking params stripped so near-duplicate visits share one thumb. */
const STRIP_QUERY_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'si'
]);

/**
 * Normalize a page URL into a stable storage key.
 * - http/https only
 * - lowercase host, drop default ports
 * - drop hash
 * - drop common tracking query params
 * - collapse trailing slash (except root)
 *
 * @param {string|null|undefined} rawUrl
 * @returns {string} empty string if not a usable key
 */
export function normalizePageThumbKey(rawUrl) {
  const input = String(rawUrl || '').trim();
  if (!input) return '';

  try {
    const u = new URL(input);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';

    let host = (u.hostname || '').toLowerCase();
    if (!host) return '';
    // Align with extractDomain / favicon grouping so www and apex share a thumb.
    if (host.startsWith('www.')) host = host.slice(4);
    if (!host) return '';

    // Drop default ports.
    let port = u.port || '';
    if (
      (u.protocol === 'http:' && port === '80') ||
      (u.protocol === 'https:' && port === '443')
    ) {
      port = '';
    }

    let pathname = u.pathname || '/';
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    // Filter tracking params; keep order of remaining keys stable via sort.
    const kept = [];
    u.searchParams.forEach((value, key) => {
      const k = String(key || '');
      if (!k) return;
      if (STRIP_QUERY_PARAMS.has(k.toLowerCase())) return;
      if (/^utm_/i.test(k)) return;
      kept.push([k, value]);
    });
    kept.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const qs = kept.length
      ? `?${kept.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
      : '';

    const hostPort = port ? `${host}:${port}` : host;
    return `${u.protocol}//${hostPort}${pathname}${qs}`;
  } catch {
    return '';
  }
}

/**
 * Host (no www) from a page URL or stored urlKey.
 * @param {string|null|undefined} rawUrl
 * @returns {string}
 */
export function pageThumbHost(rawUrl) {
  const input = String(rawUrl || '').trim();
  if (!input) return '';
  try {
    const u = new URL(input.includes('://') ? input : `https://${input}`);
    let host = (u.hostname || '').toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    return host;
  } catch {
    return '';
  }
}

/**
 * Site-root key for the same origin as rawUrl (e.g. https://example.com/).
 * @param {string|null|undefined} rawUrl
 * @returns {string}
 */
export function pageThumbRootKey(rawUrl) {
  const input = String(rawUrl || '').trim();
  if (!input) return '';
  try {
    const u = new URL(input);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return normalizePageThumbKey(`${u.protocol}//${u.host}/`);
  } catch {
    return '';
  }
}

/** Multi-part public suffixes we treat as a single TLD unit (naive eTLD+1). */
const MULTI_PART_TLDS = new Set([
  'co.uk',
  'com.au',
  'co.jp',
  'com.br',
  'co.nz',
  'co.za',
  'com.mx',
  'co.in',
  'com.cn',
  'org.uk',
  'ac.uk',
  'gov.uk'
]);

/**
 * Registrable / "site" domain (naive eTLD+1) so related product hosts can share
 * thumbs: account.proton.me ↔ mail.proton.me → proton.me.
 *
 * @param {string|null|undefined} rawUrl
 * @returns {string}
 */
export function pageThumbSiteDomain(rawUrl) {
  const host = pageThumbHost(rawUrl);
  if (!host) return '';
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_TLDS.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

/**
 * @param {IDBRequest} request
 * @returns {Promise<any>}
 */
function idbReq(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IDB request failed'));
  });
}

/**
 * @param {IDBTransaction} tx
 * @returns {Promise<void>}
 */
function idbTxDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IDB transaction aborted'));
  });
}

/**
 * @typedef {{
 *   urlKey: string,
 *   blob: Blob,
 *   mime: string,
 *   width: number,
 *   height: number,
 *   capturedAt: number,
 *   lastSeenAt: number,
 *   pinned: boolean,
 *   byteSize: number,
 *   sourceUrl: string
 * }} PageThumbRecord
 */

/**
 * @typedef {{
 *   fromKey: string,
 *   toKey: string,
 *   fromUrl: string,
 *   toUrl: string,
 *   at: number
 * }} PageThumbRedirect
 */

export class PageThumbStore {
  constructor() {
    /** @type {IDBDatabase|null} */
    this._db = null;
    /** @type {Promise<IDBDatabase>|null} */
    this._opening = null;
  }

  /**
   * @returns {Promise<IDBDatabase>}
   */
  async open() {
    if (this._db) return this._db;
    if (this._opening) return this._opening;

    this._opening = new Promise((resolve, reject) => {
      let req;
      try {
        req = indexedDB.open(PAGE_THUMB_DB_NAME, PAGE_THUMB_DB_VERSION);
      } catch (e) {
        this._opening = null;
        reject(e);
        return;
      }

      req.onupgradeneeded = (event) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PAGE_THUMB_STORE)) {
          const store = db.createObjectStore(PAGE_THUMB_STORE, { keyPath: 'urlKey' });
          store.createIndex('byLastSeen', 'lastSeenAt', { unique: false });
          store.createIndex('byPinned', 'pinned', { unique: false });
          store.createIndex('byCapturedAt', 'capturedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(PAGE_THUMB_REDIRECT_STORE)) {
          const redirs = db.createObjectStore(PAGE_THUMB_REDIRECT_STORE, {
            keyPath: 'fromKey'
          });
          redirs.createIndex('byToKey', 'toKey', { unique: false });
          redirs.createIndex('byAt', 'at', { unique: false });
        }
        void event;
      };

      req.onsuccess = () => {
        this._db = req.result;
        this._db.onclose = () => {
          this._db = null;
        };
        this._opening = null;
        resolve(this._db);
      };

      req.onerror = () => {
        this._opening = null;
        reject(req.error || new Error('Failed to open page thumb DB'));
      };

      req.onblocked = () => {
        console.warn('[PageThumbStore] open blocked — close other IDB connections');
      };
    });

    return this._opening;
  }

  /**
   * @param {string} urlKey
   * @returns {Promise<PageThumbRecord|null>}
   */
  async get(urlKey) {
    const key = String(urlKey || '');
    if (!key) return null;
    const db = await this.open();
    const tx = db.transaction(PAGE_THUMB_STORE, 'readonly');
    const store = tx.objectStore(PAGE_THUMB_STORE);
    const row = await idbReq(store.get(key));
    await idbTxDone(tx);
    return row || null;
  }

  /**
   * @param {PageThumbRecord} record
   * @returns {Promise<void>}
   */
  async put(record) {
    if (!record || !record.urlKey || !record.blob) {
      throw new Error('Invalid page thumb record');
    }
    const db = await this.open();
    const tx = db.transaction(PAGE_THUMB_STORE, 'readwrite');
    const store = tx.objectStore(PAGE_THUMB_STORE);
    store.put(record);
    await idbTxDone(tx);
  }

  /**
   * @param {string} urlKey
   * @returns {Promise<void>}
   */
  async delete(urlKey) {
    const key = String(urlKey || '');
    if (!key) return;
    const db = await this.open();
    const tx = db.transaction(PAGE_THUMB_STORE, 'readwrite');
    tx.objectStore(PAGE_THUMB_STORE).delete(key);
    await idbTxDone(tx);
  }

  /**
   * @param {string[]} urlKeys
   * @returns {Promise<void>}
   */
  async deleteMany(urlKeys) {
    const keys = (Array.isArray(urlKeys) ? urlKeys : []).filter(Boolean);
    if (!keys.length) return;
    const db = await this.open();
    const tx = db.transaction(PAGE_THUMB_STORE, 'readwrite');
    const store = tx.objectStore(PAGE_THUMB_STORE);
    for (const k of keys) store.delete(k);
    await idbTxDone(tx);
  }

  /**
   * @returns {Promise<PageThumbRecord[]>}
   */
  async getAll() {
    const db = await this.open();
    const tx = db.transaction(PAGE_THUMB_STORE, 'readonly');
    const rows = await idbReq(tx.objectStore(PAGE_THUMB_STORE).getAll());
    await idbTxDone(tx);
    return Array.isArray(rows) ? rows : [];
  }

  /**
   * @param {string} urlKey
   * @param {boolean} pinned
   * @returns {Promise<void>}
   */
  async setPinned(urlKey, pinned) {
    const key = String(urlKey || '');
    if (!key) return;
    const db = await this.open();
    const tx = db.transaction(PAGE_THUMB_STORE, 'readwrite');
    const store = tx.objectStore(PAGE_THUMB_STORE);
    const row = await idbReq(store.get(key));
    if (row) {
      row.pinned = Boolean(pinned);
      store.put(row);
    }
    await idbTxDone(tx);
  }

  /**
   * Batch-update pinned flags for keys that exist.
   * @param {Map<string, boolean>|Record<string, boolean>} pinMap
   * @returns {Promise<number>} number of rows updated
   */
  async applyPinMap(pinMap) {
    const entries =
      pinMap instanceof Map
        ? Array.from(pinMap.entries())
        : Object.entries(pinMap || {});
    if (!entries.length) return 0;

    const db = await this.open();
    const tx = db.transaction(PAGE_THUMB_STORE, 'readwrite');
    const store = tx.objectStore(PAGE_THUMB_STORE);
    let updated = 0;

    for (const [urlKey, pinned] of entries) {
      if (!urlKey) continue;
      // eslint-disable-next-line no-await-in-loop
      const row = await idbReq(store.get(urlKey));
      if (!row) continue;
      const next = Boolean(pinned);
      if (row.pinned !== next) {
        row.pinned = next;
        store.put(row);
        updated += 1;
      }
    }

    await idbTxDone(tx);
    return updated;
  }

  /**
   * Touch lastSeenAt without rewriting the blob.
   * @param {string} urlKey
   * @param {number} [ts]
   * @returns {Promise<void>}
   */
  async touchLastSeen(urlKey, ts = Date.now()) {
    const key = String(urlKey || '');
    if (!key) return;
    const db = await this.open();
    const tx = db.transaction(PAGE_THUMB_STORE, 'readwrite');
    const store = tx.objectStore(PAGE_THUMB_STORE);
    const row = await idbReq(store.get(key));
    if (row) {
      row.lastSeenAt = Number(ts) || Date.now();
      store.put(row);
    }
    await idbTxDone(tx);
  }

  /**
   * Persist requested → final URL mapping after a redirect/forward.
   * @param {PageThumbRedirect} record
   * @returns {Promise<void>}
   */
  async putRedirect(record) {
    if (!record?.fromKey || !record?.toKey) return;
    if (record.fromKey === record.toKey) return;
    const db = await this.open();
    if (!db.objectStoreNames.contains(PAGE_THUMB_REDIRECT_STORE)) return;
    const tx = db.transaction(PAGE_THUMB_REDIRECT_STORE, 'readwrite');
    tx.objectStore(PAGE_THUMB_REDIRECT_STORE).put({
      fromKey: record.fromKey,
      toKey: record.toKey,
      fromUrl: record.fromUrl || record.fromKey,
      toUrl: record.toUrl || record.toKey,
      at: Number(record.at) || Date.now()
    });
    await idbTxDone(tx);
  }

  /**
   * @param {string} fromKey
   * @returns {Promise<PageThumbRedirect|null>}
   */
  async getRedirect(fromKey) {
    const key = String(fromKey || '');
    if (!key) return null;
    const db = await this.open();
    if (!db.objectStoreNames.contains(PAGE_THUMB_REDIRECT_STORE)) return null;
    const tx = db.transaction(PAGE_THUMB_REDIRECT_STORE, 'readonly');
    const row = await idbReq(tx.objectStore(PAGE_THUMB_REDIRECT_STORE).get(key));
    await idbTxDone(tx);
    return row || null;
  }

  /**
   * @returns {Promise<PageThumbRedirect[]>}
   */
  async getAllRedirects() {
    const db = await this.open();
    if (!db.objectStoreNames.contains(PAGE_THUMB_REDIRECT_STORE)) return [];
    const tx = db.transaction(PAGE_THUMB_REDIRECT_STORE, 'readonly');
    const rows = await idbReq(tx.objectStore(PAGE_THUMB_REDIRECT_STORE).getAll());
    await idbTxDone(tx);
    return Array.isArray(rows) ? rows : [];
  }

  /**
   * @param {string} fromKey
   * @returns {Promise<void>}
   */
  async deleteRedirect(fromKey) {
    const key = String(fromKey || '');
    if (!key) return;
    const db = await this.open();
    if (!db.objectStoreNames.contains(PAGE_THUMB_REDIRECT_STORE)) return;
    const tx = db.transaction(PAGE_THUMB_REDIRECT_STORE, 'readwrite');
    tx.objectStore(PAGE_THUMB_REDIRECT_STORE).delete(key);
    await idbTxDone(tx);
  }
}
