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

// Resolve a potentially relative URL to absolute using the page's base URI.
// img.src (DOM property) does this automatically, but raw data-* attributes don't.
// Returns empty string if the input is empty or resolution fails.
function resolveUrl(raw: string): string {
  if (!raw) return '';
  try {
    return new URL(raw, document.baseURI).href;
  } catch {
    return raw;
  }
}

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
    // Check the raw attribute for .svg suffix before paying the cost of URL resolution.
    const rawSrc = img.getAttribute('src') ?? '';
    if (rawSrc.endsWith('.svg') || img.getAttribute('type') === 'image/svg+xml') {
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
    // Many sites (booking.com, airbnb, etc.) use lazy loading: the real URL lives in
    // a data attribute and src is empty or a tiny placeholder until the image scrolls
    // into view. We check data-srcset / data-src as fallbacks before giving up.
    //
    // Priority order:
    //   1. srcset (highest-res from the spec-compliant attribute)
    //   2. data-srcset (lazy-load srcset, same format)
    //   3. src (already loaded or native lazy with src set)
    //   4. data-src / data-lazy / data-lazy-src (single-URL lazy-load attributes)
    const srcsetAttr = img.getAttribute('srcset') ?? '';
    const dataSrcsetAttr = img.getAttribute('data-srcset') ?? '';
    const rawDataSrc =
      img.getAttribute('data-src') ??
      img.getAttribute('data-lazy') ??
      img.getAttribute('data-lazy-src') ??
      '';

    // img.src (DOM property) is always an absolute URL — the browser resolves it
    // against the page's base URI automatically. Raw data-* attributes are not
    // resolved by the browser, so we do it manually via resolveUrl().
    const resolvedSrc = img.src; // already absolute
    const resolvedDataSrc = resolveUrl(rawDataSrc);

    // parseSrcset returns a raw URL string from the attribute — also needs resolution
    const resolvedSrcset = srcsetAttr ? resolveUrl(parseSrcset(srcsetAttr) ?? '') : '';
    const resolvedDataSrcset = dataSrcsetAttr ? resolveUrl(parseSrcset(dataSrcsetAttr) ?? '') : '';

    const url =
      resolvedSrcset ||
      resolvedDataSrcset ||
      resolvedSrc ||
      resolvedDataSrc;

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
