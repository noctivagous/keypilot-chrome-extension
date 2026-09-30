/**
 * Read X/Y resolution (DPI) from JPEG EXIF or PNG pHYs.
 * Isolated from page-media-utils so the service worker can import it
 * without pulling image-utils / DOM helpers.
 *
 * @param {ArrayBuffer} buf
 * @returns {number|null}
 */
export function parseDpiFromImageBytes(buf) {
  if (!buf || buf.byteLength < 24) return null;
  const view = new DataView(buf);
  if (
    view.getUint32(0) === 0x89504e47 &&
    view.getUint32(4) === 0x0d0a1a0a
  ) {
    let offset = 8;
    while (offset + 12 <= view.byteLength) {
      const len = view.getUint32(offset);
      const type =
        String.fromCharCode(
          view.getUint8(offset + 4),
          view.getUint8(offset + 5),
          view.getUint8(offset + 6),
          view.getUint8(offset + 7)
        );
      const dataStart = offset + 8;
      if (type === 'pHYs' && len >= 9 && dataStart + 9 <= view.byteLength) {
        const ppux = view.getUint32(dataStart);
        const unit = view.getUint8(dataStart + 8);
        if (unit === 1 && ppux > 0) return Math.round(ppux * 0.0254);
        return null;
      }
      offset += 12 + len;
      if (type === 'IEND') break;
    }
    return null;
  }

  if (view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (marker === 0xe1 && size >= 8) {
      const start = offset + 4;
      const end = offset + 2 + size;
      if (start + 6 > view.byteLength) break;
      const head = String.fromCharCode(
        view.getUint8(start),
        view.getUint8(start + 1),
        view.getUint8(start + 2),
        view.getUint8(start + 3)
      );
      if (head === 'Exif') {
        const tiffStart = start + 6;
        if (tiffStart + 8 > view.byteLength) break;
        const le = view.getUint16(tiffStart) === 0x4949;
        const u16 = (o) => (le ? view.getUint16(o, true) : view.getUint16(o, false));
        const u32 = (o) => (le ? view.getUint32(o, true) : view.getUint32(o, false));
        const ifd0 = tiffStart + u32(tiffStart + 4);
        if (ifd0 + 2 > end) break;
        const entries = u16(ifd0);
        let xRes = null;
        let yRes = null;
        let unit = 2;
        for (let i = 0; i < entries; i++) {
          const e = ifd0 + 2 + i * 12;
          if (e + 12 > end) break;
          const tag = u16(e);
          const type = u16(e + 2);
          const count = u32(e + 4);
          const valOff = e + 8;
          const readRational = (off) => {
            if (off + 8 > view.byteLength) return null;
            const num = u32(off);
            const den = u32(off + 4);
            if (!den) return null;
            return num / den;
          };
          if (tag === 0x011a && type === 5 && count === 1) {
            xRes = readRational(tiffStart + u32(valOff));
          } else if (tag === 0x011b && type === 5 && count === 1) {
            yRes = readRational(tiffStart + u32(valOff));
          } else if (tag === 0x0128 && type === 3 && count === 1) {
            unit = u16(valOff);
          }
        }
        const res = xRes || yRes;
        if (res && res > 0) {
          if (unit === 3) return Math.round(res * 2.54);
          return Math.round(res);
        }
      }
    }
    if (size < 2) break;
    offset += 2 + size;
    if (marker === 0xda) break;
  }
  return null;
}

/**
 * File-type extension from image magic bytes (png, jpg, gif, webp, avif, …).
 * Empty string when the buffer is too short or unrecognized.
 *
 * @param {ArrayBuffer|Uint8Array|null|undefined} buf
 * @returns {string}
 */
export function extFromImageMagicBytes(buf) {
  if (!buf) return '';
  const u8 = buf instanceof Uint8Array
    ? buf
    : (buf instanceof ArrayBuffer ? new Uint8Array(buf) : null);
  if (!u8 || u8.byteLength < 3) return '';

  const ascii = (start, n) => {
    const end = Math.min(u8.byteLength, start + n);
    let s = '';
    for (let i = start; i < end; i++) s += String.fromCharCode(u8[i]);
    return s;
  };

  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) return 'png';
  if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return 'jpg';
  if (u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x38) return 'gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'webp';
  if (u8[0] === 0x42 && u8[1] === 0x4d) return 'bmp';
  if (u8[0] === 0x00 && u8[1] === 0x00 && u8[2] === 0x01 && u8[3] === 0x00) return 'ico';
  if (
    (u8[0] === 0x49 && u8[1] === 0x49 && u8[2] === 0x2a && u8[3] === 0x00)
    || (u8[0] === 0x4d && u8[1] === 0x4d && u8[2] === 0x00 && u8[3] === 0x2a)
  ) return 'tif';

  if (ascii(4, 4) === 'ftyp') {
    const brands = ascii(8, Math.min(28, u8.byteLength - 8)).toLowerCase();
    if (brands.includes('avif') || brands.includes('avis') || brands.includes('avio')) return 'avif';
    if (
      brands.includes('heic')
      || brands.includes('heix')
      || brands.includes('heif')
      || brands.includes('mif1')
      || brands.includes('msf1')
    ) return 'heic';
  }

  let i = 0;
  if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) i = 3;
  while (i < u8.byteLength && (u8[i] === 0x20 || u8[i] === 0x09 || u8[i] === 0x0a || u8[i] === 0x0d)) i += 1;
  const head = ascii(i, Math.min(80, u8.byteLength - i)).toLowerCase();
  if (head.startsWith('<svg') || head.startsWith('<!doctype svg')) return 'svg';
  if (head.startsWith('<?xml') && head.includes('<svg')) return 'svg';
  return '';
}

/**
 * @param {string} ext
 * @returns {string}
 */
export function mimeFromImageExt(ext) {
  const e = String(ext || '').toLowerCase();
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  if (e === 'svg') return 'image/svg+xml';
  if (e === 'tif' || e === 'tiff') return 'image/tiff';
  if (e === 'ico') return 'image/x-icon';
  if (e === 'heic' || e === 'heif') return 'image/heic';
  if (e && /^[a-z0-9]+$/.test(e)) return `image/${e}`;
  return '';
}
