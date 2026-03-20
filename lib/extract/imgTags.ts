// Scans all <img> elements on the current page and returns those that pass
// the photo-quality filters: minimum 100x100 pixels, no SVGs, no blob URLs.
//
// srcset resolution: if a srcset attribute is present, parseSrcset() picks the
// highest-resolution candidate. Falls back to src if no srcset or parsing fails.
//
// Deduplication: a Set<string> of seen URLs ensures each unique photo URL
// appears at most once in the result array, even if multiple img elements share it.

import { parseSrcset } from './srcsetParser';
import type { ImageResult } from './types';

// Minimum dimension (in pixels) for both width and height.
// Images smaller than this in either dimension are skipped — they're likely
// icons, thumbnails, or UI decorations rather than real travel photos.
const MIN_DIMENSION = 100;

export function extractImgTags(): ImageResult[] {
  const results: ImageResult[] = [];
  // Tracks URLs we've already added; prevents duplicates from multiple img tags
  const seen = new Set<string>();

  document.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    // --- SVG filter ---
    // SVG files are vector graphics, not photos; skip them entirely.
    const src = img.getAttribute('src') ?? '';
    if (src.endsWith('.svg') || img.getAttribute('type') === 'image/svg+xml') {
      return;
    }

    // --- Dimension check ---
    // Use natural dimensions (the actual file resolution) when the image has finished
    // loading (img.complete === true AND naturalWidth > 0).
    // Fall back to img.width/img.height (CSS rendered size) if the image is still loading —
    // this prevents valid large photos from being dropped during a scan.
    const w = (img.complete && img.naturalWidth > 0) ? img.naturalWidth : img.width;
    const h = (img.complete && img.naturalWidth > 0) ? img.naturalHeight : img.height;

    if (w < MIN_DIMENSION || h < MIN_DIMENSION) {
      return;
    }

    // --- URL resolution ---
    // If srcset is present, parse it to find the highest-resolution candidate.
    // Fall back to src if srcset is absent or produces no valid URL.
    const srcsetAttr = img.getAttribute('srcset') ?? '';
    const url = (srcsetAttr ? (parseSrcset(srcsetAttr) ?? src) : src);

    // --- Blob URL filter ---
    // Blob URLs are temporary object references that can't be downloaded directly.
    // Log them to the console for DevTools audit (Phase 3 will surface the count in UI).
    if (url.startsWith('blob:')) {
      console.log('[photo-extractor] blob URL skipped:', url);
      return;
    }

    // Skip empty URLs (e.g., img with no src at all)
    if (!url) {
      return;
    }

    // --- Deduplication ---
    if (seen.has(url)) {
      return;
    }
    seen.add(url);

    results.push({
      url,
      sourceType: 'img',
      naturalWidth: w,
      naturalHeight: h,
    });
  });

  return results;
}
