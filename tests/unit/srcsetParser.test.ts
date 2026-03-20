// Tests for parseSrcset — the srcset attribute parser.
// No DOM needed; pure function tests only. No @vitest-environment jsdom annotation.

import { parseSrcset } from '@/lib/extract/srcsetParser';

describe('parseSrcset', () => {
  // --- w-descriptor (width in pixels) ---

  it('returns the largest-w URL from a width-descriptor srcset', () => {
    const result = parseSrcset('image-320.jpg 320w, image-800.jpg 800w, image-1600.jpg 1600w');
    expect(result).toBe('image-1600.jpg');
  });

  it('returns the only w-descriptor URL when there is one candidate', () => {
    const result = parseSrcset('image-800.jpg 800w');
    expect(result).toBe('image-800.jpg');
  });

  // --- x-descriptor (pixel density) ---

  it('returns the largest-x URL from a density-descriptor srcset', () => {
    const result = parseSrcset('low.jpg 1x, high.jpg 2x, ultra.jpg 3x');
    expect(result).toBe('ultra.jpg');
  });

  // --- no descriptor (implicit 1x) ---

  it('returns the URL when there is no descriptor (implicit 1x)', () => {
    const result = parseSrcset('only.jpg');
    expect(result).toBe('only.jpg');
  });

  // --- empty / whitespace ---

  it('returns null for an empty string', () => {
    const result = parseSrcset('');
    expect(result).toBeNull();
  });

  it('returns null for a whitespace-only string', () => {
    const result = parseSrcset('   ');
    expect(result).toBeNull();
  });

  // --- mixed descriptors: w takes priority ---

  it('prefers w-descriptors over x-descriptors when both are present', () => {
    // "mixed.jpg 500w" should be selected because w-candidates are preferred
    const result = parseSrcset('mixed.jpg 500w, other.jpg 2x');
    expect(result).toBe('mixed.jpg');
  });

  // --- tied values: first match acceptable ---

  it('returns one of the tied URLs when two candidates share the same w value', () => {
    const result = parseSrcset('a.jpg 200w, b.jpg 200w');
    // Either "a.jpg" or "b.jpg" is acceptable when values are tied
    expect(['a.jpg', 'b.jpg']).toContain(result);
  });

  // --- malformed descriptor ---

  it('skips candidates with a malformed descriptor (e.g., "bad.jpg w")', () => {
    // "w" alone with no numeric prefix should be skipped; fall back to no-descriptor candidates
    const result = parseSrcset('bad.jpg w, good.jpg');
    // "bad.jpg w" is skipped; "good.jpg" has no descriptor (implicit 1x)
    expect(result).toBe('good.jpg');
  });

  it('returns null when all candidates have malformed descriptors and no fallback', () => {
    const result = parseSrcset('bad.jpg w, other.jpg x');
    expect(result).toBeNull();
  });
});
