/**
 * Generates extension-icon.png — a placeholder mark so packaging succeeds.
 *
 * Deliberately dependency-free: writing the PNG by hand avoids adding an image
 * library to a repo that has none. Replace the output with a real design when
 * one exists; nothing depends on this script at build time.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 256;
const ACCENT = [0x00, 0x78, 0xd4]; // #0078d4, the theme's default accent
const WHITE = [0xff, 0xff, 0xff];

/** Rounded-rectangle coverage test, used for both the tile and the page. */
function insideRounded(x, y, left, top, width, height, radius) {
  if (x < left || y < top || x >= left + width || y >= top + height) return false;
  const dx = Math.min(x - left, left + width - 1 - x);
  const dy = Math.min(y - top, top + height - 1 - y);
  if (dx >= radius || dy >= radius) return true;
  const cx = radius - dx;
  const cy = radius - dy;
  return cx * cx + cy * cy <= radius * radius;
}

function pixel(x, y) {
  if (!insideRounded(x, y, 0, 0, SIZE, SIZE, 52)) return [0, 0, 0, 0];

  // A page, offset slightly left to leave room for the folded corner.
  const pageLeft = 74;
  const pageTop = 56;
  const pageW = 108;
  const pageH = 144;

  if (insideRounded(x, y, pageLeft, pageTop, pageW, pageH, 10)) {
    // Three text lines on the page, in the accent colour.
    const lines = [
      { top: 96, left: 94, width: 68 },
      { top: 124, left: 94, width: 68 },
      { top: 152, left: 94, width: 40 },
    ];
    for (const line of lines) {
      if (y >= line.top && y < line.top + 12 && x >= line.left && x < line.left + line.width) {
        return [...ACCENT, 255];
      }
    }
    return [...WHITE, 255];
  }

  return [...ACCENT, 255];
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = -1;
  for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return crc ^ -1;
}

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
let offset = 0;
for (let y = 0; y < SIZE; y += 1) {
  raw[offset] = 0; // filter type: none
  offset += 1;
  for (let x = 0; x < SIZE; x += 1) {
    const [r, g, b, a] = pixel(x, y);
    raw[offset] = r;
    raw[offset + 1] = g;
    raw[offset + 2] = b;
    raw[offset + 3] = a;
    offset += 4;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type: RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'images', 'extension-icon.png');
writeFileSync(out, png);
console.log(`wrote ${out} (${SIZE}x${SIZE}, ${png.length} bytes)`);
