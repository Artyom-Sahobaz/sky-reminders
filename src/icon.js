// Draws a little hot-air-balloon icon in code, so the app needs no image files.
const { nativeImage } = require('electron');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeTrayIcon(size = 32) {
  const px = Buffer.alloc(size * size * 4);
  const S = 4; // supersample for smooth edges
  const stripes = [
    [255, 107, 107],
    [255, 209, 102],
    [255, 107, 107],
    [255, 209, 102],
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const u = (x + (sx + 0.5) / S) / size; // 0..1
          const v = (y + (sy + 0.5) / S) / size;
          let col = null;
          // balloon envelope
          const dx = (u - 0.5) / 0.4, dy = (v - 0.4) / 0.38;
          if (dx * dx + dy * dy <= 1 && v < 0.72) {
            const band = Math.min(3, Math.floor(((dx + 1) / 2) * 4));
            col = stripes[band];
          } else if (v > 0.7 && v < 0.78 && Math.abs(u - 0.5) < 0.2 - (v - 0.7) * 1.2) {
            col = [255, 107, 107];
          }
          // basket
          if (v >= 0.82 && v <= 0.96 && Math.abs(u - 0.5) <= 0.12) col = [160, 98, 54];
          // ropes
          if (v > 0.74 && v < 0.82 && (Math.abs(u - 0.4 - (v - 0.74) * 0.3) < 0.025 || Math.abs(u - 0.6 + (v - 0.74) * 0.3) < 0.025))
            col = [120, 80, 50];
          if (col) {
            r += col[0]; g += col[1]; b += col[2]; a += 255;
          }
        }
      }
      const n = S * S, i = (y * size + x) * 4;
      if (a) {
        const cov = a / 255;
        px[i] = r / cov; px[i + 1] = g / cov; px[i + 2] = b / cov; px[i + 3] = a / n;
      }
    }
  }
  return nativeImage.createFromBuffer(encodePng(size, px));
}

module.exports = { makeTrayIcon };
