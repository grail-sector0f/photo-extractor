// Unit tests for buildSafeFilename — the collision-safe filename builder.
// These tests run against mocked Chrome APIs (see tests/setup.ts).

import { buildSafeFilename } from '@/lib/download';
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
