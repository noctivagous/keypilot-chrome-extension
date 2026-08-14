/**
 * Media Library service (service worker).
 *
 * Owns hash / thumbnail / add-or-duplicate / list / get / delete / zip.
 * Content scripts talk to this via chrome.runtime.sendMessage.
 */

import {
  MediaLibraryStore,
  extFromMime,
  hostFromMediaUrl,
  normalizeLibraryHref,
  normalizeMediaDomain
} from './media-library-store.js';
import { buildZipStore, sanitizeZipPathPart } from './zip-store.js';
import { dataUrlToBlob } from './media-library-transfer.js';
import { parseDpiFromImageBytes } from './image-dpi.js';

export const MEDIA_LIBRARY_THUMB_MAX_WIDTH = 480;
export const MEDIA_LIBRARY_THUMB_WEBP_QUALITY = 0.55;
export const MEDIA_LIBRARY_THUMB_JPEG_QUALITY = 0.55;

/**
 * @typedef {import('./media-library-store.js').MediaLibraryRecord} MediaLibraryRecord
 * @typedef {import('./media-library-store.js').MediaLibraryKind} MediaLibraryKind
 *
 * @typedef {{
 *   id: string,
 *   kind: MediaLibraryKind,
 *   contentHash: string,
 *   sourceUrl: string,
 *   pageUrl: string,
 *   domain: string,
 *   sourceDomain: string,
 *   pageDomain: string,
 *   mime: string,
 *   ext: string,
 *   width: number,
 *   height: number,
 *   byteSize: number,
 *   dpi: number,
 *   createdAt: number,
 *   thumbDataUrl?: string|null
 * }} MediaLibraryItemMeta
 */

/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
async function sha256Hex(blob) {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(/** @type {string} */ (reader.result));
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Gallery thumbnail + natural dimensions of the original.
 * @param {Blob} blob
 * @returns {Promise<{ thumbBlob: Blob|null, width: number, height: number }>}
 */
async function encodeThumb(blob) {
  if (!blob || blob.size < 8) {
    return { thumbBlob: null, width: 0, height: 0 };
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return { thumbBlob: null, width: 0, height: 0 };
  }

  const origW = bitmap.width || 0;
  const origH = bitmap.height || 0;

  try {
    if (origW < 1 || origH < 1) {
      return { thumbBlob: null, width: origW, height: origH };
    }

    let width = origW;
    let height = origH;
    if (width > MEDIA_LIBRARY_THUMB_MAX_WIDTH) {
      const scale = MEDIA_LIBRARY_THUMB_MAX_WIDTH / width;
      width = MEDIA_LIBRARY_THUMB_MAX_WIDTH;
      height = Math.max(1, Math.round(height * scale));
    }

    if (typeof OffscreenCanvas === 'undefined') {
      return { thumbBlob: blob, width: origW, height: origH };
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { thumbBlob: null, width: origW, height: origH };
    ctx.drawImage(bitmap, 0, 0, width, height);

    /** @type {Blob|null} */
    let out = null;
    try {
      out = await canvas.convertToBlob({
        type: 'image/webp',
        quality: MEDIA_LIBRARY_THUMB_WEBP_QUALITY
      });
    } catch {
      out = null;
    }
    if (!out || out.size === 0) {
      try {
        out = await canvas.convertToBlob({
          type: 'image/jpeg',
          quality: MEDIA_LIBRARY_THUMB_JPEG_QUALITY
        });
      } catch {
        out = null;
      }
    }
    return { thumbBlob: out && out.size > 0 ? out : null, width: origW, height: origH };
  } finally {
    try { bitmap.close(); } catch { /* ignore */ }
  }
}

/**
 * @param {MediaLibraryRecord} record
 * @param {{ includeThumb?: boolean }} [opts]
 * @returns {Promise<MediaLibraryItemMeta>}
 */
async function toMeta(record, opts = {}) {
  const sourceDomain = hostFromMediaUrl(record.sourceUrl);
  const pageDomain = hostFromMediaUrl(record.pageUrl);
  const domain = sourceDomain || record.domain || pageDomain || '(unknown)';
  /** @type {MediaLibraryItemMeta} */
  const meta = {
    id: record.id,
    kind: record.kind,
    contentHash: record.contentHash,
    sourceUrl: record.sourceUrl,
    pageUrl: record.pageUrl,
    domain,
    sourceDomain,
    pageDomain,
    mime: record.mime,
    ext: record.ext,
    width: record.width,
    height: record.height,
    byteSize: record.byteSize,
    dpi: Number(record.dpi) || 0,
    createdAt: record.createdAt
  };
  if (opts.includeThumb && record.thumbBlob) {
    try {
      meta.thumbDataUrl = await blobToDataUrl(record.thumbBlob);
    } catch {
      meta.thumbDataUrl = null;
    }
  }
  return meta;
}

/**
 * @param {string} kind
 * @returns {MediaLibraryKind}
 */
function normalizeKind(kind) {
  const k = String(kind || 'image');
  if (k === 'video' || k === 'document' || k === 'url') return k;
  return 'image';
}

function emptyCounts() {
  return { image: 0, video: 0, document: 0, url: 0 };
}

function groupingDomain(record) {
  return hostFromMediaUrl(record?.sourceUrl)
    || String(record?.domain || '').trim()
    || hostFromMediaUrl(record?.pageUrl)
    || '(unknown)';
}

export class MediaLibraryService {
  constructor() {
    this.store = new MediaLibraryStore();
    /** Serialize writes so duplicate checks stay consistent. */
    this._chain = Promise.resolve();
  }

  /**
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   * @template T
   */
  _enqueue(fn) {
    const next = this._chain.then(fn, fn);
    this._chain = next.then(() => undefined, () => undefined);
    return next;
  }

  /**
   * @param {{
   *   blob?: Blob,
   *   dataUrl?: string,
   *   mime?: string,
   *   sourceUrl?: string,
   *   pageUrl?: string,
   *   kind?: MediaLibraryKind
   * }} input
   * @returns {Promise<{ success: boolean, duplicate: boolean, item?: MediaLibraryItemMeta, error?: string }>}
   */
  addImage(input) {
    return this._enqueue(() => this._addImage(input));
  }

  /**
   * Store a hyperlink (href only — no fetch). Duplicate keyed by the absolute URL.
   * @param {{ sourceUrl?: string, url?: string, pageUrl?: string }} input
   * @returns {Promise<{ success: boolean, duplicate: boolean, item?: MediaLibraryItemMeta, error?: string }>}
   */
  addUrl(input) {
    return this._enqueue(() => this._addUrl(input));
  }

  /**
   * Store a video. File blob optional; otherwise a uri-list of sourceUrl so the Videos tab lists it.
   * @param {{
   *   blob?: Blob,
   *   dataUrl?: string,
   *   mime?: string,
   *   sourceUrl?: string,
   *   pageUrl?: string,
   *   thumbBlob?: Blob,
   *   thumbDataUrl?: string,
   *   width?: number,
   *   height?: number
   * }} input
   */
  addVideo(input) {
    return this._enqueue(() => this._addVideo(input));
  }

  /**
   * @param {{ sourceUrl?: string, url?: string, pageUrl?: string }} input
   */
  async _addUrl(input) {
    const sourceUrl = normalizeLibraryHref(input?.sourceUrl || input?.url);
    if (!sourceUrl) {
      return { success: false, duplicate: false, error: 'No URL' };
    }

    const blob = new Blob([`${sourceUrl}\n`], { type: 'text/uri-list' });
    let contentHash = '';
    try {
      contentHash = await sha256Hex(blob);
    } catch (e) {
      return { success: false, duplicate: false, error: e?.message || 'Could not hash URL' };
    }

    try {
      const existing = await this.store.getByHash(contentHash);
      if (existing) {
        const item = await toMeta(existing, { includeThumb: false });
        return { success: true, duplicate: true, item };
      }
    } catch (e) {
      console.warn('[MediaLibrary] URL hash lookup failed:', e?.message || e);
    }

    const pageUrl = String(input?.pageUrl || '');
    const domain = normalizeMediaDomain(sourceUrl, pageUrl);
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? `ml_${crypto.randomUUID()}`
      : `ml_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

    /** @type {MediaLibraryRecord} */
    const record = {
      id,
      kind: 'url',
      contentHash,
      sourceUrl,
      pageUrl,
      domain,
      mime: 'text/uri-list',
      ext: 'URL',
      width: 0,
      height: 0,
      byteSize: blob.size,
      dpi: 0,
      createdAt: Date.now(),
      blob,
      thumbBlob: null
    };

    try {
      await this.store.put(record);
    } catch (e) {
      try {
        const existing = await this.store.getByHash(contentHash);
        if (existing) {
          return { success: true, duplicate: true, item: await toMeta(existing, { includeThumb: false }) };
        }
      } catch { /* ignore */ }
      return { success: false, duplicate: false, error: e?.message || 'Could not save URL' };
    }

    return { success: true, duplicate: false, item: await toMeta(record, { includeThumb: false }) };
  }

  /**
   * @param {{
   *   blob?: Blob,
   *   dataUrl?: string,
   *   mime?: string,
   *   sourceUrl?: string,
   *   pageUrl?: string,
   *   thumbBlob?: Blob,
   *   thumbDataUrl?: string,
   *   width?: number,
   *   height?: number
   * }} input
   */
  async _addVideo(input) {
    const sourceUrl = String(input?.sourceUrl || '').trim();
    let blob = input?.blob instanceof Blob ? input.blob : null;
    if (!(blob instanceof Blob) || blob.size <= 0) {
      blob = dataUrlToBlob(input?.dataUrl, input?.mime || '');
    }
    const looksLikeVideoFile = blob instanceof Blob && blob.size > 0
      && !/^text\/uri-list/i.test(blob.type || input?.mime || '');
    if (!looksLikeVideoFile) {
      if (!sourceUrl) {
        return { success: false, duplicate: false, error: 'No video' };
      }
      blob = new Blob([`${sourceUrl}\n`], { type: 'text/uri-list' });
    }

    let contentHash = '';
    try {
      contentHash = await sha256Hex(blob);
    } catch (e) {
      return { success: false, duplicate: false, error: e?.message || 'Could not hash video' };
    }

    try {
      const existing = await this.store.getByHash(contentHash);
      if (existing) {
        const item = await toMeta(existing, { includeThumb: false });
        return { success: true, duplicate: true, item };
      }
    } catch (e) {
      console.warn('[MediaLibrary] video hash lookup failed:', e?.message || e);
    }

    let thumbBlob = input?.thumbBlob instanceof Blob && input.thumbBlob.size > 0
      ? input.thumbBlob
      : dataUrlToBlob(input?.thumbDataUrl, 'image/png');
    if (!(thumbBlob instanceof Blob) || thumbBlob.size <= 0) thumbBlob = null;

    let width = Number(input?.width) || 0;
    let height = Number(input?.height) || 0;
    if (thumbBlob) {
      try {
        const encoded = await encodeThumb(thumbBlob);
        if (encoded.thumbBlob && encoded.thumbBlob.size > 0) thumbBlob = encoded.thumbBlob;
        if (!width && encoded.width) width = encoded.width;
        if (!height && encoded.height) height = encoded.height;
      } catch { /* keep original thumb */ }
    }

    const pageUrl = String(input?.pageUrl || '');
    const domain = normalizeMediaDomain(sourceUrl, pageUrl);
    const mime = looksLikeVideoFile
      ? (String(input?.mime || blob.type || 'video/mp4').split(';')[0].trim() || 'video/mp4')
      : 'text/uri-list';
    let ext = extFromMime(mime, sourceUrl);
    if (looksLikeVideoFile && (ext === 'IMG' || ext === 'URL')) ext = 'MP4';

    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? `ml_${crypto.randomUUID()}`
      : `ml_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

    /** @type {MediaLibraryRecord} */
    const record = {
      id,
      kind: 'video',
      contentHash,
      sourceUrl,
      pageUrl,
      domain,
      mime,
      ext,
      width,
      height,
      byteSize: blob.size,
      dpi: 0,
      createdAt: Date.now(),
      blob,
      thumbBlob
    };

    try {
      await this.store.put(record);
    } catch (e) {
      try {
        const existing = await this.store.getByHash(contentHash);
        if (existing) {
          return { success: true, duplicate: true, item: await toMeta(existing, { includeThumb: false }) };
        }
      } catch { /* ignore */ }
      return { success: false, duplicate: false, error: e?.message || 'Could not save video' };
    }

    return { success: true, duplicate: false, item: await toMeta(record, { includeThumb: false }) };
  }

  /**
   * @param {{
   *   blob?: Blob,
   *   dataUrl?: string,
   *   mime?: string,
   *   sourceUrl?: string,
   *   pageUrl?: string,
   *   kind?: MediaLibraryKind
   * }} input
   */
  async _addImage(input) {
    let blob = input?.blob instanceof Blob ? input.blob : null;
    if (!(blob instanceof Blob) || blob.size <= 0) {
      blob = dataUrlToBlob(input?.dataUrl, input?.mime || 'image/png');
    }
    if (!(blob instanceof Blob) || blob.size <= 0) {
      return { success: false, duplicate: false, error: 'No image data' };
    }

    const kind = normalizeKind(input.kind);
    if (kind !== 'image') {
      return { success: false, duplicate: false, error: 'Media Library currently supports images only' };
    }

    let contentHash = '';
    try {
      contentHash = await sha256Hex(blob);
    } catch (e) {
      return { success: false, duplicate: false, error: e?.message || 'Could not hash image' };
    }

    try {
      const existing = await this.store.getByHash(contentHash);
      if (existing) {
        const item = await toMeta(existing, { includeThumb: false });
        return { success: true, duplicate: true, item };
      }
    } catch (e) {
      console.warn('[MediaLibrary] hash lookup failed:', e?.message || e);
    }

    const mime = String(input.mime || blob.type || 'image/png').split(';')[0].trim() || 'image/png';
    const sourceUrl = String(input.sourceUrl || '');
    const pageUrl = String(input.pageUrl || '');
    const domain = normalizeMediaDomain(sourceUrl, pageUrl);
    const ext = extFromMime(mime, sourceUrl);
    const { thumbBlob, width, height } = await encodeThumb(blob);
    let dpi = 0;
    try {
      const head = await blob.slice(0, 65536).arrayBuffer();
      dpi = parseDpiFromImageBytes(head) || 0;
    } catch { /* ignore */ }
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? `ml_${crypto.randomUUID()}`
      : `ml_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

    /** @type {MediaLibraryRecord} */
    const record = {
      id,
      kind: 'image',
      contentHash,
      sourceUrl,
      pageUrl,
      domain,
      mime,
      ext,
      width,
      height,
      byteSize: blob.size,
      dpi,
      createdAt: Date.now(),
      blob,
      thumbBlob
    };

    try {
      await this.store.put(record);
    } catch (e) {
      // Unique-index race: treat as duplicate.
      try {
        const existing = await this.store.getByHash(contentHash);
        if (existing) {
          return { success: true, duplicate: true, item: await toMeta(existing, { includeThumb: false }) };
        }
      } catch { /* ignore */ }
      return { success: false, duplicate: false, error: e?.message || 'Could not save image' };
    }

    return { success: true, duplicate: false, item: await toMeta(record, { includeThumb: false }) };
  }

  /**
   * @param {{ kind?: MediaLibraryKind, domain?: string, includeThumbs?: boolean }} [opts]
   * @returns {Promise<{
   *   success: boolean,
   *   items: MediaLibraryItemMeta[],
   *   counts: Record<string, number>,
   *   domains: Array<{ domain: string, count: number }>,
   *   error?: string
   * }>}
   */
  async list(opts = {}) {
    try {
      const kind = opts.kind ? normalizeKind(opts.kind) : 'image';
      const domainFilter = String(opts.domain || '').trim();
      let rows = await this.store.getByKind(kind);
      if (domainFilter) {
        rows = rows.filter((r) => groupingDomain(r) === domainFilter);
      }
      rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      const includeThumbs = opts.includeThumbs !== false;
      /** @type {MediaLibraryItemMeta[]} */
      const items = [];
      for (const row of rows) {
        // eslint-disable-next-line no-await-in-loop
        items.push(await toMeta(row, { includeThumb: includeThumbs }));
      }

      const allOfKind = domainFilter
        ? await this.store.getByKind(kind)
        : rows;
      /** @type {Map<string, number>} */
      const domainCounts = new Map();
      for (const r of allOfKind) {
        const d = groupingDomain(r);
        domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
      }
      const domains = Array.from(domainCounts.entries())
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => a.domain.localeCompare(b.domain));

      const all = await this.store.getAll();
      const counts = emptyCounts();
      for (const r of all) {
        if (r.kind === 'video') counts.video += 1;
        else if (r.kind === 'document') counts.document += 1;
        else if (r.kind === 'url') counts.url += 1;
        else counts.image += 1;
      }

      return { success: true, items, counts, domains };
    } catch (e) {
      return {
        success: false,
        items: [],
        counts: emptyCounts(),
        domains: [],
        error: e?.message || 'Could not list Media Library'
      };
    }
  }

  /**
   * @param {string} id
   * @returns {Promise<{ success: boolean, item?: MediaLibraryItemMeta, blob?: Blob, error?: string }>}
   */
  async getOriginal(id) {
    try {
      const row = await this.store.get(id);
      if (!row) return { success: false, error: 'Not found' };
      return { success: true, item: await toMeta(row, { includeThumb: false }), blob: row.blob };
    } catch (e) {
      return { success: false, error: e?.message || 'Could not load item' };
    }
  }

  /**
   * @param {string[]} ids
   * @returns {Promise<{ success: boolean, deleted: number, error?: string }>}
   */
  async deleteIds(ids) {
    const keys = (Array.isArray(ids) ? ids : []).map((id) => String(id || '')).filter(Boolean);
    if (!keys.length) return { success: true, deleted: 0 };
    try {
      await this.store.deleteMany(keys);
      return { success: true, deleted: keys.length };
    } catch (e) {
      return { success: false, deleted: 0, error: e?.message || 'Could not delete' };
    }
  }

  /**
   * @param {{ ids?: string[], kind?: MediaLibraryKind, domain?: string }} opts
   * @returns {Promise<{ success: boolean, blob?: Blob, filename?: string, empty?: boolean, error?: string }>}
   */
  async zip(opts = {}) {
    try {
      /** @type {MediaLibraryRecord[]} */
      let rows = [];
      const ids = Array.isArray(opts.ids) ? opts.ids.map((id) => String(id || '')).filter(Boolean) : [];
      let filename = 'Images.zip';

      if (ids.length) {
        for (const id of ids) {
          // eslint-disable-next-line no-await-in-loop
          const row = await this.store.get(id);
          if (row) rows.push(row);
        }
        filename = ids.length === 1 ? zipFilenameForRecord(rows[0]) : 'Media-selection.zip';
      } else if (opts.domain) {
        const domain = String(opts.domain);
        const kind = normalizeKind(opts.kind || 'image');
        rows = (await this.store.getByKind(kind)).filter((r) => groupingDomain(r) === domain);
        filename = `${sanitizeZipPathPart(domain)}.zip`;
      } else {
        const kind = normalizeKind(opts.kind || 'image');
        rows = await this.store.getByKind(kind);
        filename = kind === 'video' ? 'Videos.zip'
          : kind === 'document' ? 'Documents.zip'
            : kind === 'url' ? 'URLs.zip'
              : 'Images.zip';
      }

      if (!rows.length) {
        return { success: false, empty: true, error: 'Nothing to download' };
      }

      /** @type {Array<{ name: string, data: Uint8Array, mtime?: number }>} */
      const files = [];
      const usedNames = new Set();
      for (const row of rows) {
        let data;
        if (isUrlShortcutRecord(row)) {
          data = urlShortcutBytes(row.sourceUrl || '');
        } else {
          const buf = await row.blob.arrayBuffer();
          data = new Uint8Array(buf);
        }
        let name = zipEntryName(row);
        if (usedNames.has(name)) {
          const stem = name.replace(/(\.[^.]+)$/, '');
          const ext = name.slice(stem.length);
          let n = 2;
          while (usedNames.has(`${stem}-${n}${ext}`)) n += 1;
          name = `${stem}-${n}${ext}`;
        }
        usedNames.add(name);
        files.push({ name, data, mtime: row.createdAt });
      }

      const blob = buildZipStore(files);
      return { success: true, blob, filename };
    } catch (e) {
      return { success: false, error: e?.message || 'Could not build zip' };
    }
  }
}

/**
 * @param {MediaLibraryRecord|null|undefined} row
 * @returns {string}
 */
function isUrlShortcutRecord(row) {
  if (!row) return false;
  if (row.kind === 'url') return true;
  return row.kind === 'video'
    && (String(row.ext || '') === 'URL' || /^text\/uri-list/i.test(String(row.mime || '')));
}

/**
 * @param {MediaLibraryRecord|null|undefined} row
 * @returns {string}
 */
function zipEntryName(row) {
  if (!row) return 'item.bin';
  const domain = sanitizeZipPathPart(groupingDomain(row) || 'unknown');
  const id = sanitizeZipPathPart(String(row.id || 'item').replace(/^ml_/, ''));
  if (isUrlShortcutRecord(row)) return `${domain}/${id}.url`;
  const ext = String(row.ext || 'IMG').toLowerCase();
  const fileExt = ext === 'jpeg' ? 'jpg' : ext;
  return `${domain}/${id}.${fileExt}`;
}

/**
 * @param {MediaLibraryRecord|null|undefined} row
 * @returns {string}
 */
function zipFilenameForRecord(row) {
  if (!row) return 'image.zip';
  if (isUrlShortcutRecord(row)) {
    return `${sanitizeZipPathPart(row.domain || (row.kind === 'video' ? 'video' : 'url'))}.url.zip`;
  }
  const ext = String(row.ext || 'IMG').toLowerCase();
  const fileExt = ext === 'jpeg' ? 'jpg' : ext;
  return `${sanitizeZipPathPart(row.domain || (row.kind === 'video' ? 'video' : 'image'))}.${fileExt}.zip`;
}

/**
 * @param {string} href
 * @returns {Uint8Array}
 */
function urlShortcutBytes(href) {
  const body = `[InternetShortcut]\r\nURL=${String(href || '').trim()}\r\n`;
  return new TextEncoder().encode(body);
}

export const mediaLibraryService = new MediaLibraryService();
