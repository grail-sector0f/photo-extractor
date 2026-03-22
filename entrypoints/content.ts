// Content script: image extraction engine.
//
// Registered via WXT's defineContentScript for all URLs. The main() function
// is called by WXT when the content script loads into a tab. It sets up a
// chrome.runtime.onConnect listener to wait for the popup to initiate a scan.
//
// Scan lifecycle (long-lived port pattern):
//   1. Popup opens a port named 'scan-session' via chrome.runtime.connect()
//   2. Popup sends { type: 'SCAN_PAGE' }
//   3. Content script runs extractImgTags() + extractCssBackgrounds(), deduplicates,
//      and replies with { type: 'SCAN_RESULT', payload: { images, blobCount } }
//   4. Content script starts a MutationObserver that watches for new/updated images
//   5. Each new image discovered by the observer is sent as { type: 'IMAGE_FOUND', payload: ImageResult }
//   6. When the popup closes, the port fires onDisconnect and the observer stops
//
// Why long-lived port instead of sendMessage:
//   chrome.runtime.sendMessage is fire-and-forget with a single response. There's
//   no way to know when the popup closes after that response. A port's onDisconnect
//   event fires exactly when the popup frame unloads — the right signal for teardown.

import { extractImgTags } from '@/lib/extract/imgTags';
import { extractCssBackgrounds } from '@/lib/extract/cssBackgrounds';
import { parseSrcset } from '@/lib/extract/srcsetParser';
import type { ImageResult } from '@/lib/extract/types';
import { DEFAULT_SETTINGS } from '@/lib/settings';

// --- processImg ---
//
// Applies the same filtering logic as extractImgTags but for a single img element
// discovered by the MutationObserver. Exported for direct testing in mutationObserver.test.ts.
//
// Filtering rules (same as initial scan, per CONTEXT.md):
//   - Skip if width OR height < 100px
//   - Skip SVG files
//   - Skip blob URLs (log to console for DevTools audit)
//   - Resolve srcset to highest-resolution URL if srcset attribute is present
//   - Skip if URL already in seenUrls (deduplication against initial scan + prior observer hits)
//
// Returns null if the image is filtered out or a duplicate.
// Returns an ImageResult with the resolved URL and dimensions if it passes.
export function processImg(
  img: HTMLImageElement,
  seenUrls: Set<string>,
  minDimension: number = DEFAULT_SETTINGS.minDimension,
): ImageResult | null {
  // --- Dimension check ---
  // Use naturalWidth/naturalHeight when the image has finished loading.
  // Fall back to img.width/img.height (rendered CSS size) if still loading.
  const w = (img.complete && img.naturalWidth > 0) ? img.naturalWidth : img.width;
  const h = (img.complete && img.naturalWidth > 0) ? img.naturalHeight : img.height;

  if (w < minDimension || h < minDimension) {
    return null;
  }

  // --- SVG filter ---
  const rawSrc = img.getAttribute('src') ?? '';
  if (rawSrc.endsWith('.svg') || img.getAttribute('type') === 'image/svg+xml') {
    return null;
  }

  // --- URL resolution ---
  // img.src (DOM property) is always absolute; raw data-* attributes need manual
  // resolution via new URL(raw, document.baseURI) so they work in the popup context.
  const srcsetAttr = img.getAttribute('srcset') ?? '';
  const dataSrcsetAttr = img.getAttribute('data-srcset') ?? '';
  const rawDataSrc =
    img.getAttribute('data-src') ??
    img.getAttribute('data-lazy') ??
    img.getAttribute('data-lazy-src') ??
    '';

  const resolveUrl = (raw: string) => {
    if (!raw) return '';
    try { return new URL(raw, document.baseURI).href; } catch { return raw; }
  };

  const resolvedSrcset = srcsetAttr ? resolveUrl(parseSrcset(srcsetAttr) ?? '') : '';
  const resolvedDataSrcset = dataSrcsetAttr ? resolveUrl(parseSrcset(dataSrcsetAttr) ?? '') : '';

  const url =
    resolvedSrcset ||
    resolvedDataSrcset ||
    img.src ||
    resolveUrl(rawDataSrc);

  // --- Blob URL filter ---
  // Blob URLs are temporary and can't be downloaded directly.
  // Log them to the console for DevTools audit (Phase 3 surfaces count in UI).
  if (url.startsWith('blob:')) {
    console.log('[photo-extractor] blob URL skipped:', url);
    return null;
  }

  // Skip empty URLs
  if (!url) {
    return null;
  }

  // --- Deduplication ---
  // Check against all URLs seen in this scan session (initial scan + prior observer hits).
  if (seenUrls.has(url)) {
    return null;
  }
  seenUrls.add(url);

  return {
    url,
    sourceType: 'img',
    naturalWidth: w,
    naturalHeight: h,
  };
}

// --- handleScanSession ---
//
// Core scan logic for a single scan session. Exported for direct testing without
// needing WXT's defineContentScript wrapper.
//
// Called when the popup opens a 'scan-session' port. Sets up the full lifecycle:
//   - Listens for SCAN_PAGE to trigger the initial scan
//   - Starts the MutationObserver to catch lazy-loaded images
//   - Tears everything down when the port disconnects
export function handleScanSession(port: chrome.runtime.Port): void {
  // Shared Set for deduplication across the initial scan AND all subsequent
  // MutationObserver hits. Prevents the same image URL appearing twice.
  const seenUrls = new Set<string>();

  // Reference to the MutationObserver so we can disconnect it on port close
  let observer: MutationObserver | null = null;

  port.onMessage.addListener((msg: unknown) => {
    const message = msg as { type: string; minDimension?: number };
    if (message.type !== 'SCAN_PAGE') return;

    // Read minDimension from the SCAN_PAGE message, falling back to the default.
    // The popup passes settings.minDimension so users can configure the threshold.
    const minDim = message.minDimension ?? DEFAULT_SETTINGS.minDimension;

    // --- Initial scan ---
    // Run both extractors and merge results into one deduplicated list
    const imgResults = extractImgTags(minDim);
    const cssResults = extractCssBackgrounds();
    const allResults = [...imgResults, ...cssResults];

    // Deduplicate: add all URLs from initial scan to seenUrls so the observer
    // won't re-send images already in the initial batch
    const deduped: ImageResult[] = [];
    for (const result of allResults) {
      if (!seenUrls.has(result.url)) {
        seenUrls.add(result.url);
        deduped.push(result);
      }
    }

    // Count blob URLs in DOM as an approximation for the Phase 3 UI audit counter.
    // The extractors already filter blobs out, so we count them separately here.
    // This approach counts <img src="blob:..."> elements; CSS blob backgrounds are
    // logged by extractCssBackgrounds but not counted here (acceptable for Phase 2).
    const blobCount = document.querySelectorAll('img[src^="blob:"]').length;

    // Send initial batch back to popup
    port.postMessage({
      type: 'SCAN_RESULT',
      payload: {
        images: deduped,
        blobCount,
      },
    });

    // --- MutationObserver for lazy-loaded images ---
    // Starts after the initial scan to catch images that appear as the user scrolls.
    // Config mirrors the recommendation in RESEARCH.md Pattern 5:
    //   - childList: catches new img elements added to the DOM (lazy loaders)
    //   - subtree: catches images nested inside newly added container elements
    //   - attributes + attributeFilter: catches lazy loaders that set src after adding the element
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // New DOM nodes added — check each for img elements
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const el = node as Element;

            // Check if the added node itself is an img
            if (el.tagName === 'IMG') {
              // Pass minDim captured in closure from SCAN_PAGE message
              const result = processImg(el as HTMLImageElement, seenUrls, minDim);
              if (result) {
                port.postMessage({ type: 'IMAGE_FOUND', payload: result });
              }
            }

            // Check for img descendants in newly added subtrees
            // (e.g., a card component added to DOM that contains multiple images)
            el.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
              const result = processImg(img, seenUrls, minDim);
              if (result) {
                port.postMessage({ type: 'IMAGE_FOUND', payload: result });
              }
            });
          });
        }

        if (mutation.type === 'attributes') {
          // Attribute updated on an existing element — check if it's an img's src/srcset
          // (lazy loaders often set src="" initially and then update it after scroll)
          const el = mutation.target as HTMLElement;
          if (el.tagName === 'IMG') {
            const result = processImg(el as HTMLImageElement, seenUrls, minDim);
            if (result) {
              port.postMessage({ type: 'IMAGE_FOUND', payload: result });
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      // Only fire on src/srcset changes — without this, every class/aria/data change
      // fires the callback, causing very high CPU on busy pages (RESEARCH.md Pitfall 2)
      // Also watch data-src / data-srcset / data-lazy — lazy loaders often set
      // these before (or instead of) updating src directly.
      attributeFilter: ['src', 'srcset', 'data-src', 'data-srcset', 'data-lazy', 'data-lazy-src'],
    });
  });

  // Disconnect the MutationObserver when the popup closes.
  // The port's onDisconnect fires exactly when the popup frame unloads — this is
  // the correct lifecycle signal for observer teardown.
  port.onDisconnect.addListener(() => {
    observer?.disconnect();
  });
}

// --- Content script entry point ---
//
// WXT calls main() when the content script loads in a tab.
// All it does is register the onConnect listener — actual scan logic is in handleScanSession.
export default defineContentScript({
  matches: ['<all_urls>'],
  main(_ctx) {
    // Wait for popup to open a 'scan-session' port.
    // Ports with other names are ignored (future-proofing; only one scan protocol in v1).
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name !== 'scan-session') return;
      handleScanSession(port);
    });
  },
});
