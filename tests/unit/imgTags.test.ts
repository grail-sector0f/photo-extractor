// @vitest-environment jsdom
// Tests for extractImgTags — the img element scanner.
// jsdom is required here because the function uses document.querySelectorAll
// and reads HTMLImageElement properties (naturalWidth, naturalHeight, complete, etc.)

import { extractImgTags } from '@/lib/extract/imgTags';

// Helper: create a mock <img> element in the DOM with controlled property values.
// naturalWidth/naturalHeight are read-only on real HTMLImageElement, so we use
// Object.defineProperty to override them in tests.
function addImg(attrs: {
  src?: string;
  srcset?: string;
  width?: number;
  height?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  complete?: boolean;
  type?: string;
}) {
  const img = document.createElement('img');
  if (attrs.src) img.src = attrs.src;
  if (attrs.srcset) img.setAttribute('srcset', attrs.srcset);
  if (attrs.type) img.setAttribute('type', attrs.type);
  if (attrs.width) img.width = attrs.width;
  if (attrs.height) img.height = attrs.height;

  // naturalWidth/naturalHeight are read-only; use defineProperty to set test values
  Object.defineProperty(img, 'naturalWidth', {
    value: attrs.naturalWidth ?? attrs.width ?? 0,
    configurable: true,
  });
  Object.defineProperty(img, 'naturalHeight', {
    value: attrs.naturalHeight ?? attrs.height ?? 0,
    configurable: true,
  });
  Object.defineProperty(img, 'complete', {
    value: attrs.complete ?? true,
    configurable: true,
  });

  document.body.appendChild(img);
  return img;
}

describe('extractImgTags', () => {
  // Clear DOM between tests so each test starts with a fresh document.body
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('includes a large image and returns its URL, dimensions, and sourceType', () => {
    addImg({ src: 'https://example.com/photo.jpg', naturalWidth: 800, naturalHeight: 600 });

    const results = extractImgTags();

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://example.com/photo.jpg');
    expect(results[0].sourceType).toBe('img');
    expect(results[0].naturalWidth).toBe(800);
    expect(results[0].naturalHeight).toBe(600);
  });

  it('excludes an image below the 100x100 minimum (50x50)', () => {
    addImg({ src: 'icon.png', naturalWidth: 50, naturalHeight: 50 });

    const results = extractImgTags();

    expect(results).toHaveLength(0);
  });

  it('excludes an image with a .svg extension', () => {
    addImg({ src: 'logo.svg', naturalWidth: 200, naturalHeight: 200 });

    const results = extractImgTags();

    expect(results).toHaveLength(0);
  });

  it('excludes an image with type="image/svg+xml"', () => {
    addImg({ src: 'graphic.png', type: 'image/svg+xml', naturalWidth: 200, naturalHeight: 200 });

    const results = extractImgTags();

    expect(results).toHaveLength(0);
  });

  it('excludes blob URLs and calls console.log with a prefixed message', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    addImg({ src: 'blob:https://example.com/abc123', naturalWidth: 800, naturalHeight: 600 });

    const results = extractImgTags();

    expect(results).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[photo-extractor] blob URL skipped:',
      'blob:https://example.com/abc123'
    );

    consoleSpy.mockRestore();
  });

  it('uses parseSrcset to return the highest-resolution URL when srcset is present', () => {
    addImg({
      src: 'https://example.com/small.jpg',
      srcset: 'https://example.com/small.jpg 320w, https://example.com/large.jpg 1600w',
      naturalWidth: 800,
      naturalHeight: 600,
    });

    const results = extractImgTags();

    expect(results).toHaveLength(1);
    // parseSrcset should pick large.jpg (1600w > 320w)
    expect(results[0].url).toBe('https://example.com/large.jpg');
  });

  it('uses img.width/img.height as fallback when img.complete is false', () => {
    addImg({ src: 'https://example.com/photo.jpg', width: 400, height: 300, complete: false });

    const results = extractImgTags();

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://example.com/photo.jpg');
    // Fallback dimensions from .width/.height
    expect(results[0].naturalWidth).toBe(400);
    expect(results[0].naturalHeight).toBe(300);
  });

  it('deduplicates when multiple img elements share the same URL', () => {
    addImg({ src: 'https://example.com/photo.jpg', naturalWidth: 800, naturalHeight: 600 });
    addImg({ src: 'https://example.com/photo.jpg', naturalWidth: 800, naturalHeight: 600 });

    const results = extractImgTags();

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://example.com/photo.jpg');
  });

  it('returns multiple distinct images from a page with several img tags', () => {
    addImg({ src: 'https://example.com/first.jpg', naturalWidth: 800, naturalHeight: 600 });
    addImg({ src: 'https://example.com/second.jpg', naturalWidth: 1200, naturalHeight: 900 });

    const results = extractImgTags();

    expect(results).toHaveLength(2);
    const urls = results.map((r) => r.url);
    expect(urls).toContain('https://example.com/first.jpg');
    expect(urls).toContain('https://example.com/second.jpg');
  });

  it('excludes an image where exactly one dimension is below 100px', () => {
    // Width is fine (200px) but height is too small (50px)
    addImg({ src: 'banner.jpg', naturalWidth: 200, naturalHeight: 50 });

    const results = extractImgTags();

    expect(results).toHaveLength(0);
  });
});
