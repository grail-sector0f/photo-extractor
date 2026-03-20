// @vitest-environment jsdom
//
// Integration tests for the observer's filtering path — processImg and the
// full handleScanSession + DOM mutation flow.
//
// Strategy:
//   Part A: Call processImg directly with crafted img elements to verify each
//           filter rule (100x100, SVG skip, blob skip, srcset resolution).
//           parseSrcset is NOT mocked — these tests exercise the real integration path.
//
//   Part B: Use handleScanSession + simulated DOM mutations to verify that the
//           MutationObserver correctly fires IMAGE_FOUND with processImg filtering
//           applied end-to-end.
//
// Why NOT mock parseSrcset here:
//   contentScript.test.ts mocks the extractors to isolate orchestration logic.
//   These tests intentionally test the real srcset resolution path through processImg
//   to provide full EXTR-04 coverage on the observer path (per plan 02-02 requirements).
//
// Requirements covered:
//   EXTR-03: lazy-loaded image detection via MutationObserver
//   EXTR-04: srcset resolution in the observer path

import { processImg, handleScanSession } from '@/entrypoints/content';
import { createMockPort } from '@/tests/setup';

// Mock only the extractors so the initial scan returns empty results,
// giving tests a clean slate to verify observer-discovered images.
// parseSrcset is NOT mocked — let it run through the real implementation.
vi.mock('@/lib/extract/imgTags', () => ({
  extractImgTags: vi.fn(() => []),
}));

vi.mock('@/lib/extract/cssBackgrounds', () => ({
  extractCssBackgrounds: vi.fn(() => []),
}));

// Helper to create mock img elements with overridden read-only properties.
// Object.defineProperty is required because naturalWidth, naturalHeight, and complete
// are read-only on real HTMLImageElement — we can't set them directly in jsdom.
function createImg(attrs: {
  src?: string;
  srcset?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  complete?: boolean;
}): HTMLImageElement {
  const img = document.createElement('img');
  if (attrs.src) img.src = attrs.src;
  if (attrs.srcset) img.setAttribute('srcset', attrs.srcset);
  Object.defineProperty(img, 'naturalWidth', {
    value: attrs.naturalWidth ?? 0,
    configurable: true,
  });
  Object.defineProperty(img, 'naturalHeight', {
    value: attrs.naturalHeight ?? 0,
    configurable: true,
  });
  Object.defineProperty(img, 'complete', {
    value: attrs.complete ?? true,
    configurable: true,
  });
  return img;
}

// --- Part A: processImg direct tests ---

describe('processImg', () => {
  let seenUrls: Set<string>;

  beforeEach(() => {
    // Fresh deduplication set for each test
    seenUrls = new Set<string>();
  });

  it('returns ImageResult for a large img that passes all filters', () => {
    const img = createImg({
      src: 'https://example.com/photo.jpg',
      naturalWidth: 800,
      naturalHeight: 600,
      complete: true,
    });

    const result = processImg(img, seenUrls);

    expect(result).not.toBeNull();
    expect(result?.url).toBe('https://example.com/photo.jpg');
    expect(result?.sourceType).toBe('img');
    expect(result?.naturalWidth).toBe(800);
    expect(result?.naturalHeight).toBe(600);
  });

  it('returns null for an img smaller than 100x100 (both dimensions)', () => {
    const img = createImg({ src: 'https://example.com/icon.jpg', naturalWidth: 50, naturalHeight: 50 });

    expect(processImg(img, seenUrls)).toBeNull();
  });

  it('returns null when only width is below 100px', () => {
    const img = createImg({ src: 'https://example.com/narrow.jpg', naturalWidth: 50, naturalHeight: 400 });

    expect(processImg(img, seenUrls)).toBeNull();
  });

  it('returns null when only height is below 100px', () => {
    const img = createImg({ src: 'https://example.com/short.jpg', naturalWidth: 400, naturalHeight: 50 });

    expect(processImg(img, seenUrls)).toBeNull();
  });

  it('returns null for an SVG img (src ends with .svg)', () => {
    const img = createImg({ src: 'https://example.com/logo.svg', naturalWidth: 800, naturalHeight: 600 });

    expect(processImg(img, seenUrls)).toBeNull();
  });

  it('returns null for a blob URL and logs to console', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const img = createImg({
      src: 'blob:https://example.com/abc-123',
      naturalWidth: 800,
      naturalHeight: 600,
    });

    const result = processImg(img, seenUrls);

    expect(result).toBeNull();
    // Blob URLs must be logged for DevTools audit (CONTEXT.md blob handling decision)
    expect(consoleSpy).toHaveBeenCalledWith(
      '[photo-extractor] blob URL skipped:',
      'blob:https://example.com/abc-123'
    );
  });

  it('resolves srcset w-descriptors and returns the highest-width URL (real parseSrcset)', () => {
    // parseSrcset is NOT mocked — this exercises the real integration path through processImg
    const img = createImg({
      src: 'https://example.com/small.jpg',
      srcset: 'https://example.com/small.jpg 320w, https://example.com/large.jpg 1600w',
      naturalWidth: 400,
      naturalHeight: 300,
    });

    const result = processImg(img, seenUrls);

    expect(result).not.toBeNull();
    // parseSrcset should select large.jpg (1600w > 320w)
    expect(result?.url).toBe('https://example.com/large.jpg');
  });

  it('resolves srcset x-descriptors and returns the highest-density URL (real parseSrcset)', () => {
    const img = createImg({
      src: 'https://example.com/low.jpg',
      srcset: 'https://example.com/low.jpg 1x, https://example.com/high.jpg 2x',
      naturalWidth: 400,
      naturalHeight: 300,
    });

    const result = processImg(img, seenUrls);

    expect(result).not.toBeNull();
    // parseSrcset should select high.jpg (2x > 1x)
    expect(result?.url).toBe('https://example.com/high.jpg');
  });

  it('returns null for a URL already in seenUrls (deduplication)', () => {
    const url = 'https://example.com/already-seen.jpg';
    seenUrls.add(url);

    const img = createImg({ src: url, naturalWidth: 800, naturalHeight: 600 });

    expect(processImg(img, seenUrls)).toBeNull();
  });
});

// --- Part B: Full observer integration tests ---

describe('handleScanSession + MutationObserver', () => {
  beforeEach(() => {
    // Clean DOM between tests so observer mutations don't bleed across
    document.body.innerHTML = '';
  });

  it('sends IMAGE_FOUND when a large img is appended to DOM after SCAN_PAGE', async () => {
    const port = createMockPort('scan-session');
    handleScanSession(port as unknown as chrome.runtime.Port);
    port._simulateMessage({ type: 'SCAN_PAGE' });

    // Append a large img after the scan starts
    const img = createImg({
      src: 'https://example.com/lazy.jpg',
      naturalWidth: 400,
      naturalHeight: 300,
      complete: true,
    });
    document.body.appendChild(img);

    // Wait for MutationObserver microtask to fire
    await new Promise(r => setTimeout(r, 0));

    const imageFoundCalls = port.postMessage.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === 'IMAGE_FOUND'
    );
    expect(imageFoundCalls.length).toBeGreaterThan(0);
    expect(imageFoundCalls[0][0]).toMatchObject({
      type: 'IMAGE_FOUND',
      payload: expect.objectContaining({
        url: 'https://example.com/lazy.jpg',
      }),
    });
  });

  it('resolves srcset through observer path and sends IMAGE_FOUND with highest-res URL', async () => {
    // This is the core EXTR-04 test on the observer path (not mocking parseSrcset)
    const port = createMockPort('scan-session');
    handleScanSession(port as unknown as chrome.runtime.Port);
    port._simulateMessage({ type: 'SCAN_PAGE' });

    const img = createImg({
      src: 'https://example.com/thumb.jpg',
      srcset: 'https://example.com/thumb.jpg 200w, https://example.com/full.jpg 1200w',
      naturalWidth: 400,
      naturalHeight: 300,
      complete: true,
    });
    document.body.appendChild(img);

    await new Promise(r => setTimeout(r, 0));

    const imageFoundCalls = port.postMessage.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === 'IMAGE_FOUND'
    );
    expect(imageFoundCalls.length).toBeGreaterThan(0);
    // parseSrcset should select full.jpg (1200w > 200w)
    expect(imageFoundCalls[0][0]).toMatchObject({
      type: 'IMAGE_FOUND',
      payload: expect.objectContaining({ url: 'https://example.com/full.jpg' }),
    });
  });

  it('does NOT send IMAGE_FOUND for a small img (below 100x100) added to DOM', async () => {
    const port = createMockPort('scan-session');
    handleScanSession(port as unknown as chrome.runtime.Port);
    port._simulateMessage({ type: 'SCAN_PAGE' });

    // Clear SCAN_RESULT postMessage count so we can check cleanly
    port.postMessage.mockClear();

    const img = createImg({
      src: 'https://example.com/tiny.jpg',
      naturalWidth: 30,
      naturalHeight: 30,
      complete: true,
    });
    document.body.appendChild(img);

    await new Promise(r => setTimeout(r, 0));

    // processImg filters this out — no IMAGE_FOUND should be posted
    const imageFoundCalls = port.postMessage.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === 'IMAGE_FOUND'
    );
    expect(imageFoundCalls.length).toBe(0);
  });
});
