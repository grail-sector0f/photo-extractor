/**
 * Unit tests for rewriteUrlForMaxResolution — the CDN URL upscaling function.
 *
 * This is a pure function: no network calls, no side effects, just string manipulation.
 * Each test provides an input URL and asserts the expected output URL (or a substring
 * of it, where the exact query string ordering doesn't matter).
 *
 * CDNs covered:
 *   - Booking.com (bstatic.com)     — path segment /maxNNNxNNN/ rewritten to /max10000x10000/
 *   - Airbnb (muscache.com)         — aki_policy=xx_large or im_w=1440
 *   - Cloudinary (res.cloudinary.com) — /upload/<transform>/ rewritten to w_4000,c_limit,q_auto
 *   - Imgix (*.imgix.net)           — w=4000, h removed, fit=max
 *   - Viator/TripAdvisor (dynamic-media-cdn.tripadvisor.com) — w=4000, h=-1
 *   - GetYourGuide (cdn.getyourguide.com) — pass-through stub (patterns unconfirmed)
 *   - Unknown / edge cases          — returned unchanged, no throw
 */

import { rewriteUrlForMaxResolution } from '@/lib/cdnRewrite';

// ---------------------------------------------------------------------------
// Booking.com (bstatic.com)
// ---------------------------------------------------------------------------

describe('Booking.com', () => {
  it('rewrites max1024x768 path segment to max10000x10000', () => {
    const input = 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/12345.jpg?k=abc&o=1';
    const result = rewriteUrlForMaxResolution(input);
    expect(result).toContain('/max10000x10000/');
    // Auth tokens must be preserved
    expect(result).toContain('k=abc');
  });

  it('rewrites max500 (no height) path segment to max10000x10000', () => {
    const input = 'https://cf.bstatic.com/xdata/images/hotel/max500/12345.jpg';
    const result = rewriteUrlForMaxResolution(input);
    expect(result).toContain('/max10000x10000/');
  });

  it('handles t-cf subdomain and rewrites path segment', () => {
    const input = 'https://t-cf.bstatic.com/xdata/images/hotel/max300x200/99999.webp?k=xyz';
    const result = rewriteUrlForMaxResolution(input);
    expect(result).toContain('/max10000x10000/');
    expect(result).toContain('k=xyz');
  });

  it('returns URL unchanged when already at max10000x10000', () => {
    const input = 'https://bstatic.com/data/xphoto/max10000x10000/192/19248043.jpg';
    const result = rewriteUrlForMaxResolution(input);
    // Already max — regex may still match and replace with same value, but the URL
    // must contain max10000x10000 and the image path must be intact
    expect(result).toContain('/max10000x10000/');
    expect(result).toContain('19248043');
  });
});

// ---------------------------------------------------------------------------
// Airbnb (muscache.com)
// ---------------------------------------------------------------------------

describe('Airbnb', () => {
  it('rewrites aki_policy=large to xx_large', () => {
    const input = 'https://a0.muscache.com/im/pictures/abc.jpg?aki_policy=large';
    const result = rewriteUrlForMaxResolution(input);
    expect(result).toContain('aki_policy=xx_large');
  });

  it('rewrites aki_policy=small to xx_large', () => {
    const input = 'https://a2.muscache.com/im/pictures/abc.jpg?aki_policy=small';
    const result = rewriteUrlForMaxResolution(input);
    expect(result).toContain('aki_policy=xx_large');
  });

  it('rewrites im_w=720 to im_w=1440', () => {
    const input = 'https://a0.muscache.com/im/pictures/miso/abc.jpeg?im_w=720';
    const result = rewriteUrlForMaxResolution(input);
    expect(result).toContain('im_w=1440');
  });

  it('returns URL unchanged when no size param present', () => {
    const input = 'https://a1.muscache.com/im/pictures/abc.jpg';
    const result = rewriteUrlForMaxResolution(input);
    expect(result).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// Cloudinary (res.cloudinary.com)
// ---------------------------------------------------------------------------

describe('Cloudinary', () => {
  it('replaces w_300,h_200,c_fill transform with w_4000,c_limit,q_auto', () => {
    const input = 'https://res.cloudinary.com/demo/image/upload/w_300,h_200,c_fill/sample.jpg';
    const result = rewriteUrlForMaxResolution(input);
    expect(result).toContain('/upload/w_4000,c_limit,q_auto/');
  });

  it('replaces t_media_lib_thumb transform with w_4000,c_limit,q_auto', () => {
    const input = 'https://res.cloudinary.com/demo/image/upload/t_media_lib_thumb/photo.jpg';
    const result = rewriteUrlForMaxResolution(input);
    expect(result).toContain('/upload/w_4000,c_limit,q_auto/');
  });

  it('returns URL unchanged when no /upload/ segment present', () => {
    const input = 'https://res.cloudinary.com/demo/image/fetch/https://example.com/photo.jpg';
    const result = rewriteUrlForMaxResolution(input);
    expect(result).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// Imgix (*.imgix.net)
// ---------------------------------------------------------------------------

describe('Imgix', () => {
  it('sets w=4000, fit=max and removes h from a URL with w, h, and fit', () => {
    const input = 'https://assets.example.imgix.net/photo.jpg?w=300&h=200&fit=clip';
    const result = rewriteUrlForMaxResolution(input);
    const url = new URL(result);
    expect(url.searchParams.get('w')).toBe('4000');
    expect(url.searchParams.get('fit')).toBe('max');
    expect(url.searchParams.has('h')).toBe(false);
  });

  it('sets w=4000 and fit=max when only w param present', () => {
    const input = 'https://cdn.site.imgix.net/image.png?w=100';
    const result = rewriteUrlForMaxResolution(input);
    const url = new URL(result);
    expect(url.searchParams.get('w')).toBe('4000');
    expect(url.searchParams.get('fit')).toBe('max');
  });

  it('does not match notimgix.net (no leading dot guard)', () => {
    // "notimgix.net" contains "imgix.net" as a substring but must NOT be treated as Imgix.
    // The implementation uses .endsWith('.imgix.net') which requires a leading dot.
    const input = 'https://notimgix.net/photo.jpg?w=100';
    const result = rewriteUrlForMaxResolution(input);
    expect(result).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// Viator / TripAdvisor (dynamic-media-cdn.tripadvisor.com)
// ---------------------------------------------------------------------------

describe('Viator / TripAdvisor', () => {
  it('sets w=4000 and preserves h=-1 and s=1', () => {
    const input =
      'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/21/66/c5/99/caption.jpg?w=1000&h=-1&s=1';
    const result = rewriteUrlForMaxResolution(input);
    const url = new URL(result);
    expect(url.searchParams.get('w')).toBe('4000');
    expect(url.searchParams.get('h')).toBe('-1');
    expect(url.searchParams.get('s')).toBe('1');
  });

  it('sets w=4000, h=-1 and preserves s when h was a positive value', () => {
    const input =
      'https://hare-dynamic-media-cdn.tripadvisor.com/media/photo-o/id/caption.jpg?w=100&h=100&s=1';
    const result = rewriteUrlForMaxResolution(input);
    const url = new URL(result);
    expect(url.searchParams.get('w')).toBe('4000');
    expect(url.searchParams.get('h')).toBe('-1');
    expect(url.searchParams.get('s')).toBe('1');
  });
});

// ---------------------------------------------------------------------------
// GetYourGuide (cdn.getyourguide.com) — pass-through stub
// ---------------------------------------------------------------------------

describe('GetYourGuide', () => {
  it('returns URL unchanged (stub — resize params unconfirmed)', () => {
    const input = 'https://cdn.getyourguide.com/img/tour/abc123.jpg';
    const result = rewriteUrlForMaxResolution(input);
    expect(result).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// No-match / edge cases
// ---------------------------------------------------------------------------

describe('no-match and edge cases', () => {
  it('returns unknown CDN URL unchanged', () => {
    const input = 'https://example.com/photo.jpg?w=300';
    const result = rewriteUrlForMaxResolution(input);
    expect(result).toBe(input);
  });

  it('returns invalid URL string unchanged without throwing', () => {
    const input = 'not-a-url';
    expect(() => rewriteUrlForMaxResolution(input)).not.toThrow();
    expect(rewriteUrlForMaxResolution(input)).toBe(input);
  });

  it('returns empty string unchanged without throwing', () => {
    const input = '';
    expect(() => rewriteUrlForMaxResolution(input)).not.toThrow();
    expect(rewriteUrlForMaxResolution(input)).toBe(input);
  });
});
