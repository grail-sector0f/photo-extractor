#!/usr/bin/env node
/**
 * generate-icons.js
 *
 * Generates four PNG icon files for the Photo Extractor Chrome extension.
 * Uses only built-in Node.js modules (zlib, fs, path) — no npm dependencies.
 *
 * Icon design:
 *   - Blue (#2563EB) rounded-rectangle background
 *   - White camera body (rounded rectangle, centered)
 *   - White viewfinder bump on top
 *   - Blue lens circle (with white highlight for sizes >= 32)
 *
 * Output: public/icon-16.png, public/icon-32.png, public/icon-48.png, public/icon-128.png
 */

'use strict';

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ─── PNG encoding helpers ─────────────────────────────────────────────────────

/**
 * Write a 4-byte big-endian unsigned integer into a buffer at offset.
 */
function writeUInt32BE(buf, value, offset) {
  buf[offset]     = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8)  & 0xff;
  buf[offset + 3] =  value         & 0xff;
}

/**
 * Build a PNG chunk: length(4) + type(4) + data + crc(4).
 * The CRC covers the type bytes + data bytes.
 */
function makePNGChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);

  // Length field
  writeUInt32BE(chunk, len, 0);

  // Type field
  typeBytes.copy(chunk, 4);

  // Data field
  if (len > 0) data.copy(chunk, 8);

  // CRC32 over type + data
  const crc = crc32(chunk.slice(4, 8 + len));
  writeUInt32BE(chunk, crc, 8 + len);

  return chunk;
}

/**
 * CRC-32 lookup table (IEEE polynomial).
 */
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

/**
 * Encode a raw RGBA pixel array (Uint8Array, row-major) into a PNG buffer.
 * width and height are in pixels.
 */
function encodePNG(width, height, rgba) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk: width(4), height(4), bitDepth(1), colorType(1=grayscale, 2=RGB, 6=RGBA),
  //             compression(1), filter(1), interlace(1)
  const ihdrData = Buffer.alloc(13);
  writeUInt32BE(ihdrData, width,  0);
  writeUInt32BE(ihdrData, height, 4);
  ihdrData[8]  = 8;  // bit depth
  ihdrData[9]  = 6;  // RGBA
  ihdrData[10] = 0;  // deflate compression
  ihdrData[11] = 0;  // adaptive filtering
  ihdrData[12] = 0;  // no interlacing

  // Build raw scanlines: each row is 1 filter byte (0 = None) + width*4 bytes
  const rawSize = (1 + width * 4) * height;
  const raw = Buffer.alloc(rawSize);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      const pixelIdx = (y * width + x) * 4;
      const rawIdx = rowStart + 1 + x * 4;
      raw[rawIdx]     = rgba[pixelIdx];     // R
      raw[rawIdx + 1] = rgba[pixelIdx + 1]; // G
      raw[rawIdx + 2] = rgba[pixelIdx + 2]; // B
      raw[rawIdx + 3] = rgba[pixelIdx + 3]; // A
    }
  }

  // Compress scanlines with deflate (zlib sync)
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const ihdr = makePNGChunk('IHDR', ihdrData);
  const idat = makePNGChunk('IDAT', compressed);
  const iend = makePNGChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// ─── Icon drawing ─────────────────────────────────────────────────────────────

/**
 * Parse a hex color string like '#2563EB' into [r, g, b].
 */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Draw a filled axis-aligned rectangle into the RGBA pixel buffer.
 * Coordinates and dimensions may be fractional — they are rounded.
 */
function fillRect(pixels, width, x, y, w, h, r, g, b, a = 255) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(width, Math.round(x + w));
  const y1 = Math.min(Math.round(pixels.length / (width * 4)), Math.round(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const i = (py * width + px) * 4;
      pixels[i]     = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    }
  }
}

/**
 * Draw a filled circle into the RGBA pixel buffer using alpha-weighted blending.
 * cx, cy = center (may be fractional); radius = pixel radius.
 */
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
      // Sub-pixel anti-aliasing: blend based on distance from edge
      let alpha = 1.0 - Math.max(0, Math.min(1, dist - radius + 0.5));
      if (alpha <= 0) continue;
      const srcA = (a / 255) * alpha;
      const i = (py * width + px) * 4;
      // Alpha-composite over existing pixel
      const dstA = pixels[i + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA > 0) {
        pixels[i]     = Math.round((r * srcA + pixels[i]     * dstA * (1 - srcA)) / outA);
        pixels[i + 1] = Math.round((g * srcA + pixels[i + 1] * dstA * (1 - srcA)) / outA);
        pixels[i + 2] = Math.round((b * srcA + pixels[i + 2] * dstA * (1 - srcA)) / outA);
        pixels[i + 3] = Math.round(outA * 255);
      }
    }
  }
}

/**
 * Draw a filled rounded rectangle into the RGBA pixel buffer.
 *
 * Uses a signed distance field (SDF) approach:
 *   1. Find the nearest point on the "inner rect" (rect shrunk by cornerRadius on all sides)
 *   2. Distance from that point → 0 inside inner rect, grows toward corners
 *   3. edgeDist = cornerRadius - dist → positive inside, negative outside
 *
 * This correctly handles all pixel positions without the band/corner split bug
 * that made interior pixels transparent when corner distances were applied globally.
 */
function fillRoundRect(pixels, width, height, x, y, w, h, cornerRadius, r, g, b, a = 255) {
  const cr = Math.min(cornerRadius, w / 2, h / 2);
  const x0 = Math.max(0, Math.floor(x - 1));
  const y0 = Math.max(0, Math.floor(y - 1));
  const x1 = Math.min(width,  Math.ceil(x + w + 1));
  const y1 = Math.min(height, Math.ceil(y + h + 1));

  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const cx = px + 0.5;
      const cy = py + 0.5;

      // Clamp pixel center to the inner rect (rect shrunk by cr on each side).
      // Points inside the inner rect clamp to themselves (dist=0).
      // Points in corner regions clamp to the nearest corner center.
      const nearX = Math.max(x + cr, Math.min(x + w - cr, cx));
      const nearY = Math.max(y + cr, Math.min(y + h - cr, cy));
      const dx = cx - nearX;
      const dy = cy - nearY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Positive = inside rounded rect, negative = outside.
      const edgeDist = cr - dist;
      const alpha = Math.max(0, Math.min(1, edgeDist + 0.5));
      if (alpha <= 0) continue;

      const srcA = (a / 255) * alpha;
      const i = (py * width + px) * 4;
      const dstA = pixels[i + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA > 0) {
        pixels[i]     = Math.round((r * srcA + pixels[i]     * dstA * (1 - srcA)) / outA);
        pixels[i + 1] = Math.round((g * srcA + pixels[i + 1] * dstA * (1 - srcA)) / outA);
        pixels[i + 2] = Math.round((b * srcA + pixels[i + 2] * dstA * (1 - srcA)) / outA);
        pixels[i + 3] = Math.round(outA * 255);
      }
    }
  }
}

/**
 * Draw a 4-pointed sparkle star (like the auto_awesome / sparkle icon).
 *
 * Uses polar coordinates: r(θ) = outerR * |cos(2θ)|^power
 * power=1 → moderate tips; power=2 → sharp diamond-like tips.
 * The star has tips at 0°, 90°, 180°, 270° and deepest concavity at 45° intervals.
 */
function fillStar(pixels, width, height, cx, cy, outerR, power, r, g, b, a = 255) {
  const x0 = Math.max(0, Math.floor(cx - outerR - 1));
  const y0 = Math.max(0, Math.floor(cy - outerR - 1));
  const x1 = Math.min(width,  Math.ceil(cx + outerR + 1));
  const y1 = Math.min(height, Math.ceil(cy + outerR + 1));

  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const theta = Math.atan2(dy, dx);
      // Radius of the star boundary at this angle
      const starR = outerR * Math.pow(Math.abs(Math.cos(2 * theta)), power);
      const edgeDist = starR - dist;
      const alpha = Math.max(0, Math.min(1, edgeDist + 0.5));
      if (alpha <= 0) continue;

      const srcA = (a / 255) * alpha;
      const i = (py * width + px) * 4;
      const dstA = pixels[i + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA > 0) {
        pixels[i]     = Math.round((r * srcA + pixels[i]     * dstA * (1 - srcA)) / outA);
        pixels[i + 1] = Math.round((g * srcA + pixels[i + 1] * dstA * (1 - srcA)) / outA);
        pixels[i + 2] = Math.round((b * srcA + pixels[i + 2] * dstA * (1 - srcA)) / outA);
        pixels[i + 3] = Math.round(outA * 255);
      }
    }
  }
}

/**
 * Render the camera icon at the given size and return a raw RGBA Uint8Array.
 *
 * Design (matches the high-fidelity mockup):
 *   - Background: blue rounded rect (22% corner radius)
 *   - Camera body: white rounded rect, wide and centered in lower ~55% of icon
 *   - Viewfinder bump: white rounded rect, centered above camera body top edge
 *   - Lens circle: white filled circle, centered in camera body
 *   - Sparkle star: blue 4-pointed star inside lens circle (32px+ only)
 *
 * At 16px the star is omitted (too small to render cleanly); a plain white
 * lens circle is used instead to keep the shape legible.
 */
function renderIcon(size) {
  const s = size;
  const pixels = new Uint8Array(s * s * 4); // all zeros = transparent

  const [blue_r, blue_g, blue_b] = hexToRgb('#2563EB');
  const [white_r, white_g, white_b] = [255, 255, 255];

  // --- Background (blue rounded rect, full bleed) ---
  const bgCorner = Math.round(s * 0.22);
  fillRoundRect(pixels, s, s, 0, 0, s, s, bgCorner, blue_r, blue_g, blue_b);

  // --- Camera body (white rounded rect) ---
  // Sits in the lower ~55% of the icon with 12% side margins
  const bx = s * 0.12;
  const bw = s * 0.76;
  const bh = s * 0.44;
  const by = s * 0.40;
  const br = Math.max(1, s * 0.08);
  fillRoundRect(pixels, s, s, bx, by, bw, bh, br, white_r, white_g, white_b);

  // --- Viewfinder bump (white rounded rect, centered above camera body) ---
  // Width ~30% of icon, height ~14%, overlaps the camera body top edge by 1px
  const vw = s * 0.30;
  const vh = s * 0.14;
  const vx = (s - vw) / 2;
  const vy = by - vh + 1;
  const vr = Math.max(1, s * 0.06);
  fillRoundRect(pixels, s, s, vx, vy, vw, vh, vr, white_r, white_g, white_b);

  // --- Lens circle (white, centered in camera body) ---
  const lensR = s * 0.18;
  const lensX = s * 0.50;
  const lensY = by + bh * 0.50;
  fillCircle(pixels, s, s, lensX, lensY, lensR, white_r, white_g, white_b);

  // --- Sparkle star (blue 4-pointed star inside lens, 32px and above only) ---
  // power=1.5 gives moderately pointed tips matching the mockup sparkle style
  if (s >= 32) {
    const starR = lensR * 0.68;
    fillStar(pixels, s, s, lensX, lensY, starR, 1.5, blue_r, blue_g, blue_b);
  }

  return pixels;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const sizes = [16, 32, 48, 128];
const outDir = path.join(__dirname, '..', 'public');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

for (const size of sizes) {
  const rgba = renderIcon(size);
  const png = encodePNG(size, size, rgba);
  const outPath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Written: ${outPath} (${png.length} bytes)`);
}

console.log('\nAll icons generated successfully.');
