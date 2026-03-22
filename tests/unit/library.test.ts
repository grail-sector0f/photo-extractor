// Unit tests for lib/library.ts — the library data layer.
// Tests cover: SavedPhotoRecord type fields, loadLibrary, appendToLibrary, LRU cap behavior.
// The chrome.storage.local mock from tests/setup.ts is available globally.

import { chromeMock } from '../setup';
import {
  type SavedPhotoRecord,
  loadLibrary,
  appendToLibrary,
  STORAGE_KEY,
  MAX_RECORDS,
} from '@/lib/library';

// Helper to build a minimal valid SavedPhotoRecord for testing.
// Pass overrides to customize specific fields without repeating boilerplate.
function makeRecord(overrides: Partial<SavedPhotoRecord> = {}): SavedPhotoRecord {
  return {
    id: '1711234567890-0',
    url: 'https://example.com/photo.jpg',
    filename: 'travel-photos/bali_four-seasons_pool_2025_01.jpg',
    destination: 'bali',
    vendor: 'four-seasons',
    category: 'accommodation',
    year: '2025',
    notes: '',
    savedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('STORAGE_KEY and MAX_RECORDS', () => {
  it('STORAGE_KEY is savedPhotos', () => {
    expect(STORAGE_KEY).toBe('savedPhotos');
  });

  it('MAX_RECORDS is 500', () => {
    expect(MAX_RECORDS).toBe(500);
  });
});

describe('SavedPhotoRecord shape', () => {
  it('has all 9 required fields', () => {
    const record = makeRecord();
    // Verify every required field exists on the record
    expect(record).toHaveProperty('id');
    expect(record).toHaveProperty('url');
    expect(record).toHaveProperty('filename');
    expect(record).toHaveProperty('destination');
    expect(record).toHaveProperty('vendor');
    expect(record).toHaveProperty('category');
    expect(record).toHaveProperty('year');
    expect(record).toHaveProperty('notes');
    expect(record).toHaveProperty('savedAt');
  });
});

describe('loadLibrary', () => {
  it('returns [] when storage has no savedPhotos key', async () => {
    // chrome.storage.local.get returns empty object — nothing stored yet
    chromeMock.storage.local.get.mockResolvedValue({});

    const result = await loadLibrary();

    expect(result).toEqual([]);
  });

  it('returns stored array when savedPhotos key exists', async () => {
    const stored: SavedPhotoRecord[] = [makeRecord({ id: 'a' }), makeRecord({ id: 'b' })];
    chromeMock.storage.local.get.mockResolvedValue({ savedPhotos: stored });

    const result = await loadLibrary();

    expect(result).toEqual(stored);
  });

  it('calls chrome.storage.local.get with the savedPhotos key', async () => {
    chromeMock.storage.local.get.mockResolvedValue({});

    await loadLibrary();

    expect(chromeMock.storage.local.get).toHaveBeenCalledWith('savedPhotos');
  });
});

describe('appendToLibrary', () => {
  it('appends a record to an empty library and calls chrome.storage.local.set', async () => {
    // Start with an empty library
    chromeMock.storage.local.get.mockResolvedValue({});

    const record = makeRecord({ id: 'new-1' });
    await appendToLibrary(record);

    // Should have written the record into an array under savedPhotos
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      savedPhotos: [record],
    });
  });

  it('appends to existing records when under the cap', async () => {
    const existing: SavedPhotoRecord[] = [makeRecord({ id: 'existing-1' })];
    chromeMock.storage.local.get.mockResolvedValue({ savedPhotos: existing });

    const newRecord = makeRecord({ id: 'new-2' });
    await appendToLibrary(newRecord);

    // Both the existing and new record should be present
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      savedPhotos: [...existing, newRecord],
    });
  });

  it('LRU cap: when 500 records exist and 1 is added, result has 500 records with oldest dropped', async () => {
    // Build exactly MAX_RECORDS existing records — the oldest is at index 0
    const existing: SavedPhotoRecord[] = Array.from({ length: MAX_RECORDS }, (_, i) =>
      makeRecord({ id: `record-${i}` }),
    );
    chromeMock.storage.local.get.mockResolvedValue({ savedPhotos: existing });

    const newRecord = makeRecord({ id: 'brand-new' });
    await appendToLibrary(newRecord);

    // Capture what was written
    const setCall = chromeMock.storage.local.set.mock.calls[0][0] as { savedPhotos: SavedPhotoRecord[] };
    const written = setCall.savedPhotos;

    // Total must not exceed MAX_RECORDS
    expect(written.length).toBe(MAX_RECORDS);
    // The oldest record (index 0) must be gone
    expect(written.find((r) => r.id === 'record-0')).toBeUndefined();
    // The newest record must be last
    expect(written[written.length - 1].id).toBe('brand-new');
    // record-1 is now the oldest surviving entry
    expect(written[0].id).toBe('record-1');
  });

  it('preserves all existing records when count is below cap after append', async () => {
    // 3 existing records + 1 new = 4, well under 500
    const existing: SavedPhotoRecord[] = Array.from({ length: 3 }, (_, i) =>
      makeRecord({ id: `old-${i}` }),
    );
    chromeMock.storage.local.get.mockResolvedValue({ savedPhotos: existing });

    const newRecord = makeRecord({ id: 'newest' });
    await appendToLibrary(newRecord);

    const setCall = chromeMock.storage.local.set.mock.calls[0][0] as { savedPhotos: SavedPhotoRecord[] };
    expect(setCall.savedPhotos.length).toBe(4);
    // All original records preserved
    expect(setCall.savedPhotos.find((r) => r.id === 'old-0')).toBeDefined();
    expect(setCall.savedPhotos.find((r) => r.id === 'old-1')).toBeDefined();
    expect(setCall.savedPhotos.find((r) => r.id === 'old-2')).toBeDefined();
  });
});
