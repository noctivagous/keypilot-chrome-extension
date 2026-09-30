import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extFromImageMagicBytes, mimeFromImageExt } from '../extension/src/utils/image-dpi.js';

function bytes(...parts) {
  const chunks = parts.map((p) => {
    if (typeof p === 'string') return Uint8Array.from([...p].map((c) => c.charCodeAt(0)));
    return Uint8Array.from(p);
  });
  const len = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}

describe('extFromImageMagicBytes', () => {
  it('recognizes png, jpeg, gif, and webp', () => {
    assert.equal(extFromImageMagicBytes(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])), 'png');
    assert.equal(extFromImageMagicBytes(bytes([0xff, 0xd8, 0xff, 0xe0])), 'jpg');
    assert.equal(extFromImageMagicBytes(bytes('GIF89a', [0, 0, 0, 0, 0, 0])), 'gif');
    assert.equal(extFromImageMagicBytes(bytes('RIFF', [0, 0, 0, 0], 'WEBP')), 'webp');
  });

  it('recognizes avif ftyp brands', () => {
    assert.equal(extFromImageMagicBytes(bytes([0, 0, 0, 0x1c], 'ftypavif')), 'avif');
  });

  it('recognizes svg after whitespace', () => {
    assert.equal(extFromImageMagicBytes(bytes('   <svg xmlns="http://www.w3.org/2000/svg">')), 'svg');
  });

  it('returns empty for unknown or short buffers', () => {
    assert.equal(extFromImageMagicBytes(bytes([1, 2])), '');
    assert.equal(extFromImageMagicBytes(bytes('not-an-image!!!!')), '');
    assert.equal(extFromImageMagicBytes(null), '');
  });
});

describe('mimeFromImageExt', () => {
  it('maps common extensions', () => {
    assert.equal(mimeFromImageExt('webp'), 'image/webp');
    assert.equal(mimeFromImageExt('jpg'), 'image/jpeg');
    assert.equal(mimeFromImageExt('svg'), 'image/svg+xml');
  });
});
