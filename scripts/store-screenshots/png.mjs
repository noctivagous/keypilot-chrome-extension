/**
 * PNG signature + IHDR helpers for store-listing asset validation.
 */
export function pngDimensions(buf) {
  const png = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (png.length < 29 || png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) {
    throw new Error('Input is not a PNG');
  }
  const type = png.toString('ascii', 12, 16);
  if (type !== 'IHDR') {
    throw new Error('PNG is missing IHDR');
  }
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    bitDepth: png[24],
    colorType: png[25]
  };
}
