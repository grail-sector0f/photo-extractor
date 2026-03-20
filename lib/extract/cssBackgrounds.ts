// Scans all DOM elements for CSS background-image URLs and returns those that pass
// the photo-quality filters: minimum 100x100 element size, no SVGs, no blob URLs.
//
// Why getComputedStyle: Reading an element's inline style misses backgrounds applied
// via stylesheets. getComputedStyle returns the final computed value from all sources.
//
// Why regex exec loop: background-image can contain multiple layers separated by commas
// (e.g., "url('a.jpg'), linear-gradient(...), url('b.jpg')"). We must extract all
// url() tokens, not just the first match.
//
// Why reset lastIndex: The URL_REGEX uses the /g (global) flag, making it stateful.
// If exec() is called across elements without resetting lastIndex to 0, subsequent
// calls resume from the last match position of the previous element's string.

import type { ImageResult } from './types';

// Matches url("..."), url('...'), and url(...) — all three quote variations.
// Capture group 1 is the URL inside the parentheses.
const URL_REGEX = /url\(["']?([^"')]+)["']?\)/g;

// Minimum rendered element size in either dimension.
// Elements smaller than this are likely UI decorations, not photo containers.
const MIN_DIMENSION = 100;

export function extractCssBackgrounds(): ImageResult[] {
  const results: ImageResult[] = [];
  // Deduplication: ensures each URL appears at most once across all elements
  const seen = new Set<string>();

  document.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const bgImage = window.getComputedStyle(el).backgroundImage;

    // Skip elements with no background image
    if (!bgImage || bgImage === 'none') return;

    // Reset regex state before processing this element's background-image string.
    // This is required because the /g flag makes exec() stateful via lastIndex.
    URL_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = URL_REGEX.exec(bgImage)) !== null) {
      const url = match[1];

      // Skip empty captures
      if (!url) continue;

      // --- Blob URL filter ---
      // Blob URLs are temporary and cannot be downloaded; log for DevTools audit
      if (url.startsWith('blob:')) {
        console.log('[photo-extractor] blob CSS background skipped:', url);
        continue;
      }

      // --- SVG filter ---
      if (url.endsWith('.svg')) continue;

      // --- Deduplication ---
      if (seen.has(url)) continue;

      // --- Dimension filter ---
      // CSS background images don't expose naturalWidth/naturalHeight —
      // use the element's rendered dimensions as a proxy filter instead.
      const rect = el.getBoundingClientRect();
      if (rect.width < MIN_DIMENSION || rect.height < MIN_DIMENSION) continue;

      seen.add(url);
      // CSS backgrounds have no naturalWidth/naturalHeight to report
      results.push({ url, sourceType: 'css-background' });
    }
  });

  return results;
}
