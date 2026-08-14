/**
 * Minimal ZIP (STORE / method 0) writer.
 *
 * Images are already compressed, so we skip DEFLATE. No ZIP64 — each file and
 * the archive must stay under 4 GiB, which is fine for a personal image library.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * @param {Uint8Array} bytes
 * @returns {number}
 */
export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  const len = bytes.length;
  for (let i = 0; i < len; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Sanitize one path segment (no slashes).
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function sanitizeZipPathPart(raw) {
  const s = String(raw || '')
    .replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_')
    .replace(/^\.+/, '_')
    .trim();
  return s.slice(0, 80) || 'item';
}

/**
 * @param {number} [ms]
 * @returns {{ time: number, date: number }}
 */
function dosDateTime(ms) {
  const d = new Date(Number(ms) || Date.now());
  const year = d.getFullYear();
  const safeYear = year < 1980 ? 1980 : year;
  const time =
    (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date =
    ((safeYear - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

/**
 * @param {DataView} view
 * @param {number} offset
 * @param {number} value
 */
function u16(view, offset, value) {
  view.setUint16(offset, value >>> 0, true);
}

/**
 * @param {DataView} view
 * @param {number} offset
 * @param {number} value
 */
function u32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

/**
 * Build an uncompressed ZIP archive.
 *
 * @param {Array<{ name: string, data: Uint8Array, mtime?: number }>} files
 * @returns {Blob}
 */
export function buildZipStore(files) {
  const list = Array.isArray(files) ? files : [];
  /** @type {Array<{ nameBytes: Uint8Array, data: Uint8Array, crc: number, time: number, date: number, offset: number }>} */
  const entries = [];

  let offset = 0;
  for (const file of list) {
    const name = String(file?.name || 'file').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!name || !file?.data) continue;
    const nameBytes = new TextEncoder().encode(name);
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    const { time, date } = dosDateTime(file.mtime);
    entries.push({
      nameBytes,
      data,
      crc: crc32(data),
      time,
      date,
      offset
    });
    offset += 30 + nameBytes.length + data.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const e of entries) {
    centralSize += 46 + e.nameBytes.length;
  }
  const endSize = 22;
  const total = centralStart + centralSize + endSize;
  const buf = new ArrayBuffer(total);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  let p = 0;
  for (const e of entries) {
    // Local file header
    u32(view, p, 0x04034b50);
    u16(view, p + 4, 20); // version needed
    u16(view, p + 6, 0x0800); // UTF-8 flag
    u16(view, p + 8, 0); // STORE
    u16(view, p + 10, e.time);
    u16(view, p + 12, e.date);
    u32(view, p + 14, e.crc);
    u32(view, p + 18, e.data.length);
    u32(view, p + 22, e.data.length);
    u16(view, p + 26, e.nameBytes.length);
    u16(view, p + 28, 0);
    bytes.set(e.nameBytes, p + 30);
    bytes.set(e.data, p + 30 + e.nameBytes.length);
    p += 30 + e.nameBytes.length + e.data.length;
  }

  for (const e of entries) {
    u32(view, p, 0x02014b50);
    u16(view, p + 4, 20); // version made by
    u16(view, p + 6, 20); // version needed
    u16(view, p + 8, 0x0800);
    u16(view, p + 10, 0);
    u16(view, p + 12, e.time);
    u16(view, p + 14, e.date);
    u32(view, p + 16, e.crc);
    u32(view, p + 20, e.data.length);
    u32(view, p + 24, e.data.length);
    u16(view, p + 28, e.nameBytes.length);
    u16(view, p + 30, 0);
    u16(view, p + 32, 0);
    u16(view, p + 34, 0);
    u16(view, p + 36, 0);
    u32(view, p + 38, 0);
    u32(view, p + 42, e.offset);
    bytes.set(e.nameBytes, p + 46);
    p += 46 + e.nameBytes.length;
  }

  u32(view, p, 0x06054b50);
  u16(view, p + 4, 0);
  u16(view, p + 6, 0);
  u16(view, p + 8, entries.length);
  u16(view, p + 10, entries.length);
  u32(view, p + 12, centralSize);
  u32(view, p + 16, centralStart);
  u16(view, p + 20, 0);

  return new Blob([buf], { type: 'application/zip' });
}
