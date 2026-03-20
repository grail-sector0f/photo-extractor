// Unit tests for buildSafeFilename — the collision-safe filename builder.
// These tests run against mocked Chrome APIs (see tests/setup.ts).

import { buildSafeFilename } from '@/lib/download';
import { normalizeField, buildBasename, deriveExt } from '@/lib/naming';
import { chromeMock } from '../setup';

describe('buildSafeFilename', () => {
  it('returns a clean name with no suffix when no collision exists', async () => {
    // chrome.downloads.search returns nothing — the filename is available
    chromeMock.downloads.search.mockResolvedValue([]);

    const result = await buildSafeFilename('bali_pool', 'jpg', 'travel-photos');

    expect(result).toBe('travel-photos/bali_pool.jpg');
  });

  it('returns _01 suffix when the base name is already taken', async () => {
    // Simulate: travel-photos/bali_pool.jpg already exists in download history
    chromeMock.downloads.search.mockResolvedValue([
      { filename: '/Users/jennifer/Downloads/travel-photos/bali_pool.jpg' },
    ]);

    const result = await buildSafeFilename('bali_pool', 'jpg', 'travel-photos');

    expect(result).toBe('travel-photos/bali_pool_01.jpg');
  });

  it('returns _02 suffix when base and _01 are both taken', async () => {
    // Simulate: both base and _01 exist
    chromeMock.downloads.search.mockResolvedValue([
      { filename: '/Users/jennifer/Downloads/travel-photos/bali_pool.jpg' },
      { filename: '/Users/jennifer/Downloads/travel-photos/bali_pool_01.jpg' },
    ]);

    const result = await buildSafeFilename('bali_pool', 'jpg', 'travel-photos');

    expect(result).toBe('travel-photos/bali_pool_02.jpg');
  });

  it('returns a clean name for a different subfolder', async () => {
    // Same logic applies regardless of which subfolder is used
    chromeMock.downloads.search.mockResolvedValue([]);

    const result = await buildSafeFilename('tokyo_ritz', 'png', 'my-photos');

    expect(result).toBe('my-photos/tokyo_ritz.png');
  });

  it('handles empty search results correctly (returns clean name)', async () => {
    // Explicitly verify the happy-path with zero results in history
    chromeMock.downloads.search.mockResolvedValue([]);

    const result = await buildSafeFilename('paris_hotel', 'jpg', 'travel-photos');

    expect(result).toBe('travel-photos/paris_hotel.jpg');
  });

  it('does not count unrelated downloads as collisions', async () => {
    // A download with a similar but different basename should not block the clean name
    chromeMock.downloads.search.mockResolvedValue([
      // "bali_pool_resort" contains "bali_pool" as a substring but is a different file
      { filename: '/Users/jennifer/Downloads/travel-photos/bali_pool_resort.jpg' },
    ]);

    const result = await buildSafeFilename('bali_pool', 'jpg', 'travel-photos');

    // The precise filter in buildSafeFilename should exclude "bali_pool_resort.jpg"
    expect(result).toBe('travel-photos/bali_pool.jpg');
  });

  it('throws an error when all 99 counter slots are exhausted', async () => {
    // Build a history with the base name + all 99 suffixed variants
    const fakeHistory = [
      { filename: '/Users/jennifer/Downloads/travel-photos/bali_pool.jpg' },
    ];
    for (let i = 1; i <= 99; i++) {
      fakeHistory.push({
        filename: `/Users/jennifer/Downloads/travel-photos/bali_pool_${String(i).padStart(2, '0')}.jpg`,
      });
    }
    chromeMock.downloads.search.mockResolvedValue(fakeHistory);

    await expect(
      buildSafeFilename('bali_pool', 'jpg', 'travel-photos')
    ).rejects.toThrow();
  });
});

describe('normalizeField', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(normalizeField('Bali Beach')).toBe('bali-beach');
  });

  it('handles multi-word vendor names', () => {
    expect(normalizeField('Four Seasons')).toBe('four-seasons');
  });

  it('strips accented characters and ampersand', () => {
    // accented chars (é, à, etc.) are not in [a-z0-9\-] after lowercasing, so stripped
    expect(normalizeField('café & résumé')).toBe('caf-rsum');
  });

  it('strips non-alphanumeric, non-hyphen characters', () => {
    expect(normalizeField('hello!!!world')).toBe('helloworld');
  });

  it('trims leading and trailing spaces before normalizing', () => {
    expect(normalizeField('  spaces  ')).toBe('spaces');
  });

  it('leaves already-clean slugs unchanged', () => {
    expect(normalizeField('already-clean')).toBe('already-clean');
  });

  it('lowercases uppercase input', () => {
    expect(normalizeField('UPPER')).toBe('upper');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeField('')).toBe('');
  });
});

describe('buildBasename', () => {
  it('joins three normalized fields with underscores', () => {
    expect(buildBasename('bali', 'four-seasons', 'pool')).toBe('bali_four-seasons_pool');
  });

  it('normalizes each field before joining', () => {
    expect(buildBasename('Bali', 'Four Seasons', 'Pool')).toBe('bali_four-seasons_pool');
  });

  it('includes notes segment when notes is non-empty', () => {
    expect(buildBasename('bali', 'four-seasons', 'pool', 'sunset view')).toBe(
      'bali_four-seasons_pool_sunset-view'
    );
  });

  it('omits notes segment when notes is empty string', () => {
    expect(buildBasename('bali', 'four-seasons', 'pool', '')).toBe('bali_four-seasons_pool');
  });

  it('omits notes segment when notes is whitespace-only', () => {
    expect(buildBasename('bali', 'four-seasons', 'pool', '   ')).toBe('bali_four-seasons_pool');
  });

  it('omits notes segment when notes is undefined', () => {
    expect(buildBasename('bali', 'four-seasons', 'pool', undefined)).toBe('bali_four-seasons_pool');
  });
});

describe('deriveExt', () => {
  it('extracts jpg from a simple URL', () => {
    expect(deriveExt('https://example.com/photo.jpg')).toBe('jpg');
  });

  it('ignores query string when extracting extension', () => {
    expect(deriveExt('https://example.com/photo.jpg?w=800')).toBe('jpg');
  });

  it('lowercases uppercase extensions', () => {
    expect(deriveExt('https://example.com/photo.PNG')).toBe('png');
  });

  it('extracts webp extension', () => {
    expect(deriveExt('https://example.com/photo.webp')).toBe('webp');
  });

  it('falls back to jpg for extensionless CDN URLs', () => {
    expect(deriveExt('https://cdn.example.com/image/upload/v123/photo')).toBe('jpg');
  });

  it('falls back to jpg for unknown extensions like bmp', () => {
    expect(deriveExt('https://example.com/photo.bmp')).toBe('jpg');
  });

  it('falls back to jpg when URL parsing fails', () => {
    expect(deriveExt('not-a-url')).toBe('jpg');
  });

  it('extracts avif extension', () => {
    expect(deriveExt('https://example.com/image.avif')).toBe('avif');
  });

  it('extracts gif extension', () => {
    expect(deriveExt('https://example.com/image.gif')).toBe('gif');
  });

  it('extracts jpeg extension', () => {
    expect(deriveExt('https://example.com/image.jpeg')).toBe('jpeg');
  });
});
