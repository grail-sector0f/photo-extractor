import { describe, it, expect } from 'vitest';
import { compareRecords } from '../../entrypoints/popup/App';
import type { SavedPhotoRecord } from '../../lib/library';

/**
 * Helper to create a minimal SavedPhotoRecord for sort testing.
 * All fields default to safe empty/placeholder values; overrides are spread last.
 */
function makeRecord(overrides: Partial<SavedPhotoRecord>): SavedPhotoRecord {
  return {
    id: '1',
    url: 'https://example.com/img.jpg',
    filename: 'test.jpg',
    destination: '',
    vendor: '',
    category: '',
    year: '',
    notes: '',
    savedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('library sort', () => {
  describe('compareRecords with savedAt (newest first)', () => {
    it('sorts newer records before older records', () => {
      const older = makeRecord({ savedAt: '2026-01-01T00:00:00.000Z' });
      const newer = makeRecord({ savedAt: '2026-03-15T00:00:00.000Z' });
      // older should come AFTER newer, so comparator(older, newer) > 0
      expect(compareRecords(older, newer, 'savedAt')).toBeGreaterThan(0);
      // newer should come BEFORE older, so comparator(newer, older) < 0
      expect(compareRecords(newer, older, 'savedAt')).toBeLessThan(0);
    });

    it('returns 0 for identical timestamps', () => {
      const a = makeRecord({ savedAt: '2026-01-01T00:00:00.000Z' });
      const b = makeRecord({ savedAt: '2026-01-01T00:00:00.000Z' });
      expect(compareRecords(a, b, 'savedAt')).toBe(0);
    });
  });

  describe('compareRecords with destination (alphabetical ascending)', () => {
    it('sorts alphabetically ascending', () => {
      const bali = makeRecord({ destination: 'Bali' });
      const maldives = makeRecord({ destination: 'Maldives' });
      // Bali < Maldives → comparator(bali, maldives) < 0
      expect(compareRecords(bali, maldives, 'destination')).toBeLessThan(0);
      // Maldives > Bali → comparator(maldives, bali) > 0
      expect(compareRecords(maldives, bali, 'destination')).toBeGreaterThan(0);
    });

    it('returns 0 for identical values', () => {
      const a = makeRecord({ destination: 'Bali' });
      const b = makeRecord({ destination: 'Bali' });
      expect(compareRecords(a, b, 'destination')).toBe(0);
    });
  });

  describe('compareRecords with vendor (alphabetical ascending)', () => {
    it('sorts alphabetically ascending', () => {
      const fs = makeRecord({ vendor: 'Four Seasons' });
      const ritz = makeRecord({ vendor: 'Ritz Carlton' });
      // "Four Seasons" < "Ritz Carlton" alphabetically
      expect(compareRecords(fs, ritz, 'vendor')).toBeLessThan(0);
    });
  });

  describe('compareRecords with category (alphabetical ascending)', () => {
    it('sorts alphabetically ascending', () => {
      const pool = makeRecord({ category: 'Pool' });
      const room = makeRecord({ category: 'Room' });
      // "Pool" < "Room" alphabetically
      expect(compareRecords(pool, room, 'category')).toBeLessThan(0);
    });
  });

  describe('compareRecords with year (alphabetical ascending)', () => {
    it('sorts year strings ascending', () => {
      const y2024 = makeRecord({ year: '2024' });
      const y2026 = makeRecord({ year: '2026' });
      // "2024" < "2026" lexicographically (and chronologically)
      expect(compareRecords(y2024, y2026, 'year')).toBeLessThan(0);
    });
  });

  describe('full array sort integration', () => {
    it('sorts an array of records by savedAt newest first', () => {
      const records = [
        makeRecord({ id: '1', savedAt: '2026-01-01T00:00:00.000Z' }),
        makeRecord({ id: '2', savedAt: '2026-03-01T00:00:00.000Z' }),
        makeRecord({ id: '3', savedAt: '2026-02-01T00:00:00.000Z' }),
      ];
      const sorted = [...records].sort((a, b) => compareRecords(a, b, 'savedAt'));
      // Expected order: Mar (newest) → Feb → Jan (oldest)
      expect(sorted.map((r) => r.id)).toEqual(['2', '3', '1']);
    });

    it('sorts an array of records by destination alphabetically', () => {
      const records = [
        makeRecord({ id: '1', destination: 'Maldives' }),
        makeRecord({ id: '2', destination: 'Bali' }),
        makeRecord({ id: '3', destination: 'Costa Rica' }),
      ];
      const sorted = [...records].sort((a, b) => compareRecords(a, b, 'destination'));
      // Expected order: Bali → Costa Rica → Maldives
      expect(sorted.map((r) => r.id)).toEqual(['2', '3', '1']);
    });
  });
});
