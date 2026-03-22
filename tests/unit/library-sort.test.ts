import { describe, it, expect } from 'vitest';
import { compareRecords, filterRecords } from '../../entrypoints/popup/App';
import type { SavedPhotoRecord } from '../../lib/library';

/**
 * Helper to create a minimal SavedPhotoRecord for testing.
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

describe('compareRecords (newest first)', () => {
  it('sorts newer records before older records', () => {
    const older = makeRecord({ savedAt: '2026-01-01T00:00:00.000Z' });
    const newer = makeRecord({ savedAt: '2026-03-15T00:00:00.000Z' });
    expect(compareRecords(older, newer)).toBeGreaterThan(0);
    expect(compareRecords(newer, older)).toBeLessThan(0);
  });

  it('returns 0 for identical timestamps', () => {
    const a = makeRecord({ savedAt: '2026-01-01T00:00:00.000Z' });
    const b = makeRecord({ savedAt: '2026-01-01T00:00:00.000Z' });
    expect(compareRecords(a, b)).toBe(0);
  });

  it('sorts an array newest first', () => {
    const records = [
      makeRecord({ id: '1', savedAt: '2026-01-01T00:00:00.000Z' }),
      makeRecord({ id: '2', savedAt: '2026-03-01T00:00:00.000Z' }),
      makeRecord({ id: '3', savedAt: '2026-02-01T00:00:00.000Z' }),
    ];
    const sorted = [...records].sort(compareRecords);
    expect(sorted.map((r) => r.id)).toEqual(['2', '3', '1']);
  });
});

describe('filterRecords', () => {
  const records = [
    makeRecord({ id: '1', destination: 'bali', category: 'accommodation', year: '2025' }),
    makeRecord({ id: '2', destination: 'bali', category: 'landscape', year: '2026' }),
    makeRecord({ id: '3', destination: 'san-francisco', category: 'activities', year: '2026' }),
  ];

  it('returns all records when no filters are active', () => {
    const result = filterRecords(records, { destination: '', category: '', year: '' });
    expect(result).toHaveLength(3);
  });

  it('filters by destination', () => {
    const result = filterRecords(records, { destination: 'bali', category: '', year: '' });
    expect(result.map((r) => r.id)).toEqual(['1', '2']);
  });

  it('filters by category', () => {
    const result = filterRecords(records, { destination: '', category: 'landscape', year: '' });
    expect(result.map((r) => r.id)).toEqual(['2']);
  });

  it('filters by year', () => {
    const result = filterRecords(records, { destination: '', category: '', year: '2026' });
    expect(result.map((r) => r.id)).toEqual(['2', '3']);
  });

  it('combines multiple filters', () => {
    const result = filterRecords(records, { destination: 'bali', category: '', year: '2026' });
    expect(result.map((r) => r.id)).toEqual(['2']);
  });

  it('returns empty array when no records match', () => {
    const result = filterRecords(records, { destination: 'tokyo', category: '', year: '' });
    expect(result).toHaveLength(0);
  });
});
