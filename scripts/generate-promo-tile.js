#!/usr/bin/env node
/**
 * generate-promo-tile.js
 *
 * Generates a 440x280 PNG promotional tile for the Chrome Web Store listing.
 * Uses only built-in Node.js modules (zlib, fs, path) — no npm dependencies.
 *
 * Design:
 *   - Blue (#2563EB) background, 440x280 px
 *   - White camera icon centered horizontally, positioned in upper portion
 *   - "Photo Extractor" in large white bitmap text below icon
 *   - Tagline in smaller, semi-transparent white bitmap text below title
 *
 * Output: docs/store-assets/promo-tile-440x280.png
 *
 * Note: For a higher-quality version with system fonts, open
 *       scripts/generate-promo-tile.html in Chrome and click Download.
 */

'use strict';

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ─── PNG encoding helpers (identical to generate-icons.js) ───────────────────

function writeUInt32BE(buf, value, offset) {
  buf[offset]     = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8)  & 0xff;
  buf[offset + 3] =  value         & 0xff;
}

function makePNGChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  writeUInt32BE(chunk, len, 0);
  typeBytes.copy(chunk, 4);
  if (len > 0) data.copy(chunk, 8);
  const crc = crc32(chunk.slice(4, 8 + len));
  writeUInt32BE(chunk, crc, 8 + len);
  return chunk;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  writeUInt32BE(ihdrData, width,  0);
  writeUInt32BE(ihdrData, height, 4);
  ihdrData[8]  = 8;  // bit depth
  ihdrData[9]  = 6;  // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const rawSize = (1 + width * 4) * height;
  const raw = Buffer.alloc(rawSize);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const pixelIdx = (y * width + x) * 4;
      const rawIdx = rowStart + 1 + x * 4;
      raw[rawIdx]     = rgba[pixelIdx];
      raw[rawIdx + 1] = rgba[pixelIdx + 1];
      raw[rawIdx + 2] = rgba[pixelIdx + 2];
      raw[rawIdx + 3] = rgba[pixelIdx + 3];
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const ihdr = makePNGChunk('IHDR', ihdrData);
  const idat = makePNGChunk('IDAT', compressed);
  const iend = makePNGChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

// ─── Drawing primitives ───────────────────────────────────────────────────────

function setPixel(pixels, width, x, y, r, g, b, a = 255) {
  const i = (Math.round(y) * width + Math.round(x)) * 4;
  if (i < 0 || i + 3 >= pixels.length) return;
  const srcA = a / 255;
  const dstA = pixels[i + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA > 0) {
    pixels[i]     = Math.round((r * srcA + pixels[i]     * dstA * (1 - srcA)) / outA);
    pixels[i + 1] = Math.round((g * srcA + pixels[i + 1] * dstA * (1 - srcA)) / outA);
    pixels[i + 2] = Math.round((b * srcA + pixels[i + 2] * dstA * (1 - srcA)) / outA);
    pixels[i + 3] = Math.round(outA * 255);
  }
}

function fillRect(pixels, width, height, x, y, w, h, r, g, b, a = 255) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(width,  Math.round(x + w));
  const y1 = Math.min(height, Math.round(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      setPixel(pixels, width, px, py, r, g, b, a);
    }
  }
}

function fillCircle(pixels, width, height, cx, cy, radius, r, g, b, a = 255) {
  const x0 = Math.max(0, Math.floor(cx - radius - 1));
  const y0 = Math.max(0, Math.floor(cy - radius - 1));
  const x1 = Math.min(width,  Math.ceil(cx + radius + 1));
  const y1 = Math.min(height, Math.ceil(cy + radius + 1));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let alpha = 1.0 - Math.max(0, Math.min(1, dist - radius + 0.5));
      if (alpha <= 0) continue;
      setPixel(pixels, width, px, py, r, g, b, Math.round(a * alpha));
    }
  }
}

function fillRoundRect(pixels, width, height, x, y, w, h, cornerRadius, r, g, b, a = 255) {
  const cr = Math.min(cornerRadius, w / 2, h / 2);
  const corners = [
    [x + cr,     y + cr],
    [x + w - cr, y + cr],
    [x + cr,     y + h - cr],
    [x + w - cr, y + h - cr],
  ];
  const x0 = Math.max(0, Math.floor(x - 1));
  const y0 = Math.max(0, Math.floor(y - 1));
  const x1 = Math.min(width,  Math.ceil(x + w + 1));
  const y1 = Math.min(height, Math.ceil(y + h + 1));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const cx = px + 0.5;
      const cy = py + 0.5;
      let inside = false;
      if (cx >= x + cr && cx <= x + w - cr && cy >= y && cy <= y + h) inside = true;
      else if (cy >= y + cr && cy <= y + h - cr && cx >= x && cx <= x + w) inside = true;
      else {
        for (const [cornerX, cornerY] of corners) {
          const dx = cx - cornerX;
          const dy = cy - cornerY;
          if (Math.sqrt(dx * dx + dy * dy) <= cr) { inside = true; break; }
        }
      }
      let edgeDist = Infinity;
      if (cx >= x + cr && cx <= x + w - cr) edgeDist = Math.min(cy - y, y + h - cy, edgeDist);
      if (cy >= y + cr && cy <= y + h - cr) edgeDist = Math.min(cx - x, x + w - cx, edgeDist);
      for (const [cornerX, cornerY] of corners) {
        const dx = cx - cornerX;
        const dy = cy - cornerY;
        edgeDist = Math.min(edgeDist, cr - Math.sqrt(dx * dx + dy * dy));
      }
      const alpha = Math.max(0, Math.min(1, edgeDist + 0.5));
      if (alpha <= 0) continue;
      setPixel(pixels, width, px, py, r, g, b, Math.round(a * alpha));
    }
  }
}

// ─── Bitmap font (5x7 pixel glyphs, uppercase + lowercase + space) ───────────
// Each glyph is an array of 7 rows, each row a 5-bit mask (bit 4 = leftmost pixel).
// Only the characters needed for "Photo Extractor" and the tagline are defined.

const GLYPHS = {
  // 5 wide x 7 tall bitmaps, rows top to bottom, bit 4 = left
  ' ': [0b00000,0b00000,0b00000,0b00000,0b00000,0b00000,0b00000],
  'P': [0b11110,0b10001,0b10001,0b11110,0b10000,0b10000,0b10000],
  'h': [0b10000,0b10000,0b11110,0b10001,0b10001,0b10001,0b10001],
  'o': [0b01110,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
  't': [0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b00011],
  'a': [0b01110,0b00001,0b01111,0b10001,0b10001,0b10011,0b01101],
  'E': [0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b11111],
  'x': [0b10001,0b10001,0b01010,0b00100,0b01010,0b10001,0b10001],
  'r': [0b10110,0b11001,0b10000,0b10000,0b10000,0b10000,0b10000],
  'c': [0b01111,0b10000,0b10000,0b10000,0b10000,0b10000,0b01111],
  'e': [0b01110,0b10001,0b10001,0b11111,0b10000,0b10000,0b01111],
  'S': [0b01111,0b10000,0b10000,0b01110,0b00001,0b00001,0b11110],
  'v': [0b10001,0b10001,0b10001,0b10001,0b10001,0b01010,0b00100],
  'p': [0b11110,0b10001,0b10001,0b11110,0b10000,0b10000,0b10000],
  'w': [0b10001,0b10001,0b10001,0b10101,0b10101,0b11011,0b10001],
  's': [0b01111,0b10000,0b10000,0b01110,0b00001,0b00001,0b11110],
  'i': [0b01110,0b00100,0b00100,0b00100,0b00100,0b00100,0b01110],
  'u': [0b10001,0b10001,0b10001,0b10001,0b10001,0b10001,0b01111],
  'd': [0b00001,0b00001,0b01101,0b10011,0b10001,0b10001,0b01111],
  'n': [0b11110,0b10001,0b10001,0b10001,0b10001,0b10001,0b10001],
  'm': [0b11011,0b10101,0b10101,0b10101,0b10101,0b10101,0b10001],
  'f': [0b00111,0b00100,0b11100,0b00100,0b00100,0b00100,0b00100],
  'g': [0b01111,0b10001,0b10001,0b01111,0b00001,0b10001,0b01110],
  'l': [0b11000,0b01000,0b01000,0b01000,0b01000,0b01000,0b11111],
  'k': [0b10001,0b10010,0b10100,0b11000,0b10100,0b10010,0b10001],
  'y': [0b10001,0b10001,0b10001,0b01111,0b00001,0b00001,0b01110],
  'T': [0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b00100],
  'A': [0b00100,0b01010,0b10001,0b11111,0b10001,0b10001,0b10001],
  'C': [0b01111,0b10000,0b10000,0b10000,0b10000,0b10000,0b01111],
  'R': [0b11110,0b10001,0b10001,0b11110,0b10100,0b10010,0b10001],
  'X': [0b10001,0b01010,0b00100,0b00100,0b00100,0b01010,0b10001],
  'O': [0b01110,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
  'I': [0b01110,0b00100,0b00100,0b00100,0b00100,0b00100,0b01110],
  'H': [0b10001,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
  'b': [0b10000,0b10000,0b11110,0b10001,0b10001,0b10001,0b11110],
};

/**
 * Render a string at (startX, startY) using the bitmap font.
 * scale: how many canvas pixels per bitmap pixel
 */
function drawText(pixels, canvasWidth, canvasHeight, text, startX, startY, scale, r, g, b, a = 255) {
  const charWidth  = 5;
  const charHeight = 7;
  const kerning    = 1; // extra px between chars
  let curX = startX;
  for (const ch of text) {
    const glyph = GLYPHS[ch];
    if (!glyph) { curX += (charWidth + kerning) * scale; continue; }
    for (let row = 0; row < charHeight; row++) {
      for (let col = 0; col < charWidth; col++) {
        if (glyph[row] & (1 << (charWidth - 1 - col))) {
          // Fill a scale x scale block
          fillRect(pixels, canvasWidth, canvasHeight,
            curX + col * scale,
            startY + row * scale,
            scale, scale, r, g, b, a);
        }
      }
    }
    curX += (charWidth + kerning) * scale;
  }
}

/** Measure text width in canvas pixels */
function measureText(text, scale) {
  const charWidth = 5;
  const kerning   = 1;
  return text.length * (charWidth + kerning) * scale - kerning * scale;
}

// ─── Camera icon drawing (same proportions as generate-icons.js) ──────────────

function drawCameraIcon(pixels, canvasWidth, canvasHeight, x, y, size) {
  const s = size;
  const [blueR, blueG, blueB] = [0x25, 0x63, 0xEB];

  // Camera body (white rounded rect)
  const bw = s * 0.62;
  const bh = s * 0.42;
  const bx = x + (s - bw) / 2;
  const by = y + s * 0.34;
  const br = Math.max(1, s * 0.08);
  fillRoundRect(pixels, canvasWidth, canvasHeight, bx, by, bw, bh, br, 255, 255, 255);

  // Viewfinder bump
  const vw = s * 0.22;
  const vh = s * 0.10;
  const vx = x + (s - vw) / 2;
  const vy = by - vh + 1;
  fillRect(pixels, canvasWidth, canvasHeight, vx, vy, vw, vh + 1, 255, 255, 255);

  // Lens (blue circle)
  const lensR = s * 0.13;
  const lensX = x + s / 2;
  const lensY = by + bh / 2 + s * 0.02;
  fillCircle(pixels, canvasWidth, canvasHeight, lensX, lensY, lensR, blueR, blueG, blueB);

  // Lens highlight
  const hlR = lensR * 0.25;
  const hlX = lensX - lensR * 0.3;
  const hlY = lensY - lensR * 0.3;
  fillCircle(pixels, canvasWidth, canvasHeight, hlX, hlY, hlR, 255, 255, 255, Math.round(255 * 0.5));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const W = 440;
const H = 280;
const pixels = new Uint8Array(W * H * 4);

// Fill blue background
const [blueR, blueG, blueB] = [0x25, 0x63, 0xEB];
fillRect(pixels, W, H, 0, 0, W, H, blueR, blueG, blueB);

// Draw camera icon (80px) centered horizontally, top at y=45
const iconSize = 80;
const iconX = (W - iconSize) / 2;
const iconY = 45;
drawCameraIcon(pixels, W, H, iconX, iconY, iconSize);

// Draw "Photo Extractor" title text
// Use scale=3 (each bitmap pixel = 3 canvas pixels) for a large title
const titleText  = 'Photo Extractor';
const titleScale = 3;
const titleW     = measureText(titleText, titleScale);
const titleX     = Math.round((W - titleW) / 2);
const titleY     = iconY + iconSize + 18; // 18px gap below icon
drawText(pixels, W, H, titleText, titleX, titleY, titleScale, 255, 255, 255);

// Draw tagline text
// Use scale=2 for a smaller tagline
const tagText  = 'Save photos with structured names';
const tagScale = 2;
const tagW     = measureText(tagText, tagScale);
const tagX     = Math.round((W - tagW) / 2);
const tagY     = titleY + 7 * titleScale + 10; // below title with 10px gap
drawText(pixels, W, H, tagText, tagX, tagY, tagScale, 255, 255, 255, 200); // semi-transparent

// Encode and write
const outDir  = path.join(__dirname, '..', 'docs', 'store-assets');
const outPath = path.join(outDir, 'promo-tile-440x280.png');
fs.mkdirSync(outDir, { recursive: true });
const png = encodePNG(W, H, pixels);
fs.writeFileSync(outPath, png);
console.log(`Written: ${outPath} (${png.length} bytes)`);
console.log('\nNote: For a higher-quality version with system fonts,');
console.log('open scripts/generate-promo-tile.html in Chrome and click Download.');
