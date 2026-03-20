// @vitest-environment jsdom
// Tests for extractCssBackgrounds — the CSS background-image scanner.
// jsdom is required for document.createElement, document.body, and getComputedStyle.
//
// IMPORTANT: jsdom's getComputedStyle does NOT process applied CSS stylesheets —
// it only returns what is set via el.style. We mock window.getComputedStyle per-test
// to return controlled background-image values, and mock getBoundingClientRect for
// dimension filtering.

import { extractCssBackgrounds } from '@/lib/extract/cssBackgrounds';

// Helper: add a div to the DOM, mock its computed background-image and dimensions.
// Returns the element so tests can set up multiple elements with different values.
function addDivWithBackground(
  backgroundImage: string,
  width = 200,
  height = 200
): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);

  vi.spyOn(window, 'getComputedStyle').mockImplementation((target) => {
    if (target === el) {
      return { backgroundImage } as CSSStyleDeclaration;
    }
    // All other elements get 'none' to avoid interference
    return { backgroundImage: 'none' } as CSSStyleDeclaration;
  });

  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    bottom: height,
    right: width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);

  return el;
}

describe('extractCssBackgrounds', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes an element with a double-quoted url() background', () => {
    addDivWithBackground('url("photo.jpg")');

    const results = extractCssBackgrounds();

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('photo.jpg');
    expect(results[0].sourceType).toBe('css-background');
  });

  it('includes an element with a single-quoted url() background', () => {
    addDivWithBackground("url('photo.jpg')");

    const results = extractCssBackgrounds();

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('photo.jpg');
  });

  it('includes an element with an unquoted url() background', () => {
    addDivWithBackground('url(photo.jpg)');

    const results = extractCssBackgrounds();

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('photo.jpg');
  });

  it('extracts both image URLs from a multi-layer background (ignores non-url layers)', () => {
    // Multi-layer: a.jpg, a gradient (no url), and b.jpg
    addDivWithBackground('url("a.jpg"), linear-gradient(to bottom, black, white), url("b.jpg")');

    const results = extractCssBackgrounds();

    expect(results).toHaveLength(2);
    const urls = results.map((r) => r.url);
    expect(urls).toContain('a.jpg');
    expect(urls).toContain('b.jpg');
  });

  it('excludes an element below the 100x100 minimum (50x50)', () => {
    addDivWithBackground('url("photo.jpg")', 50, 50);

    const results = extractCssBackgrounds();

    expect(results).toHaveLength(0);
  });

  it('excludes SVG background images', () => {
    addDivWithBackground('url("icon.svg")', 200, 200);

    const results = extractCssBackgrounds();

    expect(results).toHaveLength(0);
  });

  it('excludes blob URLs and calls console.log with a prefixed message', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    addDivWithBackground('url("blob:https://example.com/abc123")', 200, 200);

    const results = extractCssBackgrounds();

    expect(results).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[photo-extractor] blob CSS background skipped:',
      'blob:https://example.com/abc123'
    );

    consoleSpy.mockRestore();
  });

  it('skips elements with background-image: none', () => {
    // addDivWithBackground with 'none' should result in no extraction
    addDivWithBackground('none', 200, 200);

    const results = extractCssBackgrounds();

    expect(results).toHaveLength(0);
  });

  it('deduplicates when two elements share the same background URL', () => {
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');
    document.body.appendChild(el1);
    document.body.appendChild(el2);

    vi.spyOn(window, 'getComputedStyle').mockImplementation((target) => {
      if (target === el1 || target === el2) {
        return { backgroundImage: 'url("same.jpg")' } as CSSStyleDeclaration;
      }
      return { backgroundImage: 'none' } as CSSStyleDeclaration;
    });

    vi.spyOn(el1, 'getBoundingClientRect').mockReturnValue({
      width: 200, height: 200, top: 0, left: 0, bottom: 200, right: 200, x: 0, y: 0, toJSON: () => ({})
    } as DOMRect);
    vi.spyOn(el2, 'getBoundingClientRect').mockReturnValue({
      width: 200, height: 200, top: 0, left: 0, bottom: 200, right: 200, x: 0, y: 0, toJSON: () => ({})
    } as DOMRect);

    const results = extractCssBackgrounds();

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('same.jpg');
  });

  it('excludes an element where one dimension is exactly below 100px', () => {
    // Width fine (200px) but height too small (99px)
    addDivWithBackground('url("wide-banner.jpg")', 200, 99);

    const results = extractCssBackgrounds();

    expect(results).toHaveLength(0);
  });
});
