/**
 * IndexedDB store for the Media Library (personal scrapbook of web media).
 *
 * Lives at the extension origin (service worker / extension pages). Content
 * scripts must not open this DB — they would hit the page origin instead.
 */

export const MEDIA_LIBRARY_DB_NAME = 'kp_media_library';
export const MEDIA_LIBRARY_DB_VERSION = 1;
export const MEDIA_LIBRARY_STORE = 'items';

/**
 * @typedef {'image'|'video'|'document'|'url'} MediaLibraryKind
 *
 * @typedef {{
 *   id: string,
 *   kind: MediaLibraryKind,
 *   contentHash: string,
 *   sourceUrl: string,
 *   pageUrl: string,
 *   domain: string,
 *   mime: string,
 *   ext: string,
 *   width: number,
 *   height: number,
 *   byteSize: number,
 *   dpi: number,
 *   createdAt: number,
 *   blob: Blob,
 *   thumbBlob: Blob|null
 * }} MediaLibraryRecord
 */

/**
 * Absolute http(s) href for URL records. Empty if the value is not a saveable link.
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function normalizeLibraryHref(raw) {
  const input = String(raw || '').trim();
  if (!input) return '';
  try {
    const u = new URL(input);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.href;
  } catch {
    return '';
  }
}

/**
 * Hostname for grouping, www-stripped.
 * @param {string|null|undefined} rawUrl
 * @returns {string}
 */
export function hostFromMediaUrl(rawUrl) {
  const input = String(rawUrl || '').trim();
  if (!input) return '';
  try {
    const u = new URL(input);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    let host = (u.hostname || '').toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    return host;
  } catch {
    return '';
  }
}

/**
 * Image-host domain for grouping. Prefers the media URL (CDN / image service),
 * not the page the user was browsing. Falls back to pageUrl for data:/blob:.
 * @param {string|null|undefined} sourceUrl
 * @param {string|null|undefined} [pageUrl]
 * @returns {string}
 */
export function normalizeMediaDomain(sourceUrl, pageUrl) {
  const from = hostFromMediaUrl(sourceUrl);
  if (from) return from;
  const page = hostFromMediaUrl(pageUrl);
  if (page) return page;
  const raw = String(sourceUrl || '').trim();
  if (/^data:/i.test(raw)) return 'data';
  if (/^blob:/i.test(raw)) return 'blob';
  return '(unknown)';
}

/** @type {Readonly<Record<string, string>>} */
const DOCUMENT_MIME_EXT = Object.freeze({
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'application/vnd.oasis.opendocument.text': 'ODT',
  'application/rtf': 'RTF',
  'text/rtf': 'RTF',
  'text/markdown': 'MD',
  'text/csv': 'CSV',
  'application/epub+zip': 'EPUB',
  'application/zip': 'ZIP',
  'application/x-zip-compressed': 'ZIP',
  'application/json': 'JSON'
});

/**
 * Display file type from mime / filename (JPG, WEBP, PNG, …).
 * @param {string|null|undefined} mime
 * @param {string|null|undefined} [sourceUrl]
 * @returns {string}
 */
export function extFromMime(mime, sourceUrl) {
  const m = String(mime || '').toLowerCase().split(';')[0].trim();
  if (m.startsWith('image/')) {
    const sub = m.slice(6).split('+')[0];
    if (sub === 'jpeg' || sub === 'jpg') return 'JPG';
    if (sub === 'svg+xml' || sub === 'svg') return 'SVG';
    if (sub === 'x-icon' || sub === 'vnd.microsoft.icon') return 'ICO';
    if (sub === 'tiff') return 'TIF';
    if (sub) return sub.toUpperCase();
  }
  if (m.startsWith('video/')) {
    const sub = m.slice(6).split('+')[0];
    if (sub === 'quicktime') return 'MOV';
    if (sub === 'x-matroska') return 'MKV';
    if (sub === 'ogg') return 'OGV';
    if (sub === 'mp4' || sub === 'webm' || sub === 'mpeg') return sub.toUpperCase();
    if (sub) return sub.toUpperCase().slice(0, 5);
    return 'MP4';
  }
  if (m.startsWith('audio/')) {
    const sub = m.slice(6).split('+')[0];
    if (sub === 'mpeg' || sub === 'mp3') return 'MP3';
    if (sub === 'mp4' || sub === 'x-m4a') return 'M4A';
    if (sub === 'ogg' || sub === 'vorbis') return 'OGG';
    if (sub === 'wav' || sub === 'x-wav') return 'WAV';
    if (sub) return sub.toUpperCase().slice(0, 5);
    return 'AUD';
  }
  if (DOCUMENT_MIME_EXT[m]) return DOCUMENT_MIME_EXT[m];
  if (m === 'text/uri-list' || m === 'application/internet-shortcut') {
    return 'URL';
  }
  if (m === 'text/plain') return 'TXT';
  const url = String(sourceUrl || '');
  const path = url.split('?')[0].split('#')[0];
  const dot = path.lastIndexOf('.');
  if (dot >= 0 && dot > path.lastIndexOf('/')) {
    let ext = path.slice(dot + 1).toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (ext && /^[a-z0-9]{2,5}$/.test(ext)) {
      return ext === 'jpg' ? 'JPG' : ext.toUpperCase();
    }
  }
  return m.startsWith('image/') ? 'IMG' : 'BIN';
}

const IMAGE_EXT_SET = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'ico', 'bmp', 'tif', 'tiff', 'heic', 'heif'
]);
const VIDEO_EXT_SET = new Set([
  'mp4', 'mov', 'webm', 'm4v', 'mkv', 'avi', 'mpg', 'mpeg', 'ogv'
]);

/**
 * Classify fetched bytes for Media Library ingest.
 * `webpage` means do not store — the URL is a page, not a file.
 * @param {string|null|undefined} mime
 * @param {string|null|undefined} [sourceUrl]
 * @returns {'image'|'video'|'document'|'url'|'webpage'}
 */
export function classifyLibraryKind(mime, sourceUrl) {
  const m = String(mime || '').toLowerCase().split(';')[0].trim();
  if (m === 'text/uri-list' || m === 'application/internet-shortcut') return 'url';
  if (m === 'text/html' || m === 'application/xhtml+xml') return 'webpage';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';

  const ext = extFromMime(m, sourceUrl).toLowerCase();
  if (ext === 'html' || ext === 'htm') return 'webpage';
  if (IMAGE_EXT_SET.has(ext) || ext === 'img') return 'image';
  if (VIDEO_EXT_SET.has(ext)) return 'video';
  if (m.startsWith('audio/') || m.startsWith('application/') || m.startsWith('text/')) return 'document';
  if (ext && ext !== 'bin' && ext !== 'url') return 'document';
  return 'document';
}

/**
 * @param {Blob} blob
 * @returns {Promise<boolean>}
 */
export async function blobLooksLikeHtml(blob) {
  if (!(blob instanceof Blob) || blob.size <= 0) return false;
  try {
    const head = await blob.slice(0, 256).text();
    const t = String(head || '').trimStart().slice(0, 80).toLowerCase();
    return t.startsWith('<!doctype html') || t.startsWith('<html');
  } catch {
    return false;
  }
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

export class MediaLibraryStore {
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
        req = indexedDB.open(MEDIA_LIBRARY_DB_NAME, MEDIA_LIBRARY_DB_VERSION);
      } catch (e) {
        this._opening = null;
        reject(e);
        return;
      }

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(MEDIA_LIBRARY_STORE)) {
          const store = db.createObjectStore(MEDIA_LIBRARY_STORE, { keyPath: 'id' });
          store.createIndex('byContentHash', 'contentHash', { unique: true });
          store.createIndex('byDomain', 'domain', { unique: false });
          store.createIndex('byKind', 'kind', { unique: false });
          store.createIndex('byCreatedAt', 'createdAt', { unique: false });
        }
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
        reject(req.error || new Error('Failed to open media library DB'));
      };

      req.onblocked = () => {
        console.warn('[MediaLibraryStore] open blocked — close other IDB connections');
      };
    });

    return this._opening;
  }

  /**
   * @param {string} id
   * @returns {Promise<MediaLibraryRecord|null>}
   */
  async get(id) {
    const key = String(id || '');
    if (!key) return null;
    const db = await this.open();
    const tx = db.transaction(MEDIA_LIBRARY_STORE, 'readonly');
    const row = await idbReq(tx.objectStore(MEDIA_LIBRARY_STORE).get(key));
    await idbTxDone(tx);
    return row || null;
  }

  /**
   * @param {string} contentHash
   * @returns {Promise<MediaLibraryRecord|null>}
   */
  async getByHash(contentHash) {
    const hash = String(contentHash || '');
    if (!hash) return null;
    const db = await this.open();
    const tx = db.transaction(MEDIA_LIBRARY_STORE, 'readonly');
    const idx = tx.objectStore(MEDIA_LIBRARY_STORE).index('byContentHash');
    const row = await idbReq(idx.get(hash));
    await idbTxDone(tx);
    return row || null;
  }

  /**
   * @param {MediaLibraryRecord} record
   * @returns {Promise<void>}
   */
  async put(record) {
    if (!record?.id || !record.blob || !record.contentHash) {
      throw new Error('Invalid media library record');
    }
    const db = await this.open();
    const tx = db.transaction(MEDIA_LIBRARY_STORE, 'readwrite');
    tx.objectStore(MEDIA_LIBRARY_STORE).put(record);
    await idbTxDone(tx);
  }

  /**
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    const key = String(id || '');
    if (!key) return;
    const db = await this.open();
    const tx = db.transaction(MEDIA_LIBRARY_STORE, 'readwrite');
    tx.objectStore(MEDIA_LIBRARY_STORE).delete(key);
    await idbTxDone(tx);
  }

  /**
   * @param {string[]} ids
   * @returns {Promise<void>}
   */
  async deleteMany(ids) {
    const keys = (Array.isArray(ids) ? ids : []).map((id) => String(id || '')).filter(Boolean);
    if (!keys.length) return;
    const db = await this.open();
    const tx = db.transaction(MEDIA_LIBRARY_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_LIBRARY_STORE);
    for (const k of keys) store.delete(k);
    await idbTxDone(tx);
  }

  /**
   * @returns {Promise<MediaLibraryRecord[]>}
   */
  async getAll() {
    const db = await this.open();
    const tx = db.transaction(MEDIA_LIBRARY_STORE, 'readonly');
    const rows = await idbReq(tx.objectStore(MEDIA_LIBRARY_STORE).getAll());
    await idbTxDone(tx);
    return Array.isArray(rows) ? rows : [];
  }

  /**
   * @param {MediaLibraryKind} kind
   * @returns {Promise<MediaLibraryRecord[]>}
   */
  async getByKind(kind) {
    const k = String(kind || '');
    if (!k) return [];
    const db = await this.open();
    const tx = db.transaction(MEDIA_LIBRARY_STORE, 'readonly');
    const idx = tx.objectStore(MEDIA_LIBRARY_STORE).index('byKind');
    const rows = await idbReq(idx.getAll(k));
    await idbTxDone(tx);
    return Array.isArray(rows) ? rows : [];
  }

  /**
   * @param {string} domain
   * @returns {Promise<MediaLibraryRecord[]>}
   */
  async getByDomain(domain) {
    const d = String(domain || '');
    if (!d) return [];
    const db = await this.open();
    const tx = db.transaction(MEDIA_LIBRARY_STORE, 'readonly');
    const idx = tx.objectStore(MEDIA_LIBRARY_STORE).index('byDomain');
    const rows = await idbReq(idx.getAll(d));
    await idbTxDone(tx);
    return Array.isArray(rows) ? rows : [];
  }
}
