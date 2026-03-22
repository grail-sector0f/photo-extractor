/**
 * library.ts — Library data layer: types, storage helpers, and LRU cap logic.
 *
 * This module is the single source of truth for persisting download history.
 * Every successful download appends a SavedPhotoRecord to chrome.storage.local
 * under the 'savedPhotos' key. The library view reads these records to display
 * a browsable, sortable grid of everything Jennifer has saved.
 *
 * Pattern mirrors lib/settings.ts — pure dependency, no side effects on import.
 */

/**
 * A single record representing one downloaded photo.
 *
 * Fields capture the metadata the user entered at download time so the library
 * can filter and sort by destination, vendor, category, year, or notes.
 *
 * - id: timestamp-based unique ID (e.g. "1711234567890-0") — index in the batch
 *   appended to make parallel downloads within the same millisecond unique.
 * - url: original source URL before any CDN rewrite — used for thumbnail display.
 * - filename: relative path within Downloads/ (e.g. "travel-photos/bali_four-seasons_pool_2025_01.jpg")
 * - destination: normalized destination field value
 * - vendor: normalized vendor/property field value
 * - category: category field value (landscape, accommodation, dining, activities)
 * - year: year field value as a string (e.g. "2025")
 * - notes: optional advisory notes (empty string when not provided)
 * - savedAt: ISO 8601 timestamp of when the download completed
 */
export interface SavedPhotoRecord {
  id: string;
  url: string;
  filename: string;
  destination: string;
  vendor: string;
  category: string;
  year: string;
  notes: string;
  savedAt: string;
}

/**
 * The chrome.storage.local key under which all library records are stored.
 * Exported so tests can verify the exact key used for storage operations.
 */
export const STORAGE_KEY = 'savedPhotos';

/**
 * Maximum number of records to keep in the library.
 * When this limit is exceeded, the oldest entries (those at the beginning of the
 * array) are dropped — LRU (Least Recently Used) eviction. New records are always
 * appended to the end, so the oldest is always at index 0.
 *
 * 500 records gives Jennifer years of usage before any eviction occurs.
 */
export const MAX_RECORDS = 500;

/**
 * Load all saved photo records from chrome.storage.local.
 *
 * Returns an empty array if nothing has been saved yet — callers never need
 * to handle undefined or null values.
 *
 * @returns Promise resolving to the full array of SavedPhotoRecord objects (may be empty)
 */
export async function loadLibrary(): Promise<SavedPhotoRecord[]> {
  // Fetch the stored array (or an empty object if nothing saved yet)
  const data = await chrome.storage.local.get(STORAGE_KEY);

  // Cast to the expected type; fall back to empty array if key doesn't exist
  return (data[STORAGE_KEY] as SavedPhotoRecord[]) ?? [];
}

/**
 * Append a new photo record to the library and persist to chrome.storage.local.
 *
 * Enforces a MAX_RECORDS cap via LRU eviction: if adding the new record would
 * push the total above MAX_RECORDS, the oldest entries (lowest indices) are
 * dropped until the array fits within the cap. This preserves the most recent
 * downloads, which are the ones Jennifer is most likely to want.
 *
 * @param record - The SavedPhotoRecord to append
 */
export async function appendToLibrary(record: SavedPhotoRecord): Promise<void> {
  // Load the existing records first (may be empty array)
  const existing = await loadLibrary();

  // Append the new record to the end (newest records are at the tail)
  const updated = [...existing, record];

  // Apply LRU cap: if over limit, drop oldest entries from the front
  const capped =
    updated.length > MAX_RECORDS
      ? updated.slice(updated.length - MAX_RECORDS) // keep only the most recent MAX_RECORDS
      : updated;

  // Persist the capped array back to storage
  await chrome.storage.local.set({ [STORAGE_KEY]: capped });
}

/**
 * Remove a single record from the library by its ID.
 *
 * Used when the user manually deletes a record from the Library view
 * (e.g., because the underlying file was deleted from disk).
 *
 * @param id - The id field of the SavedPhotoRecord to remove
 */
export async function removeFromLibrary(id: string): Promise<void> {
  const existing = await loadLibrary();
  const updated = existing.filter((r) => r.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: updated });
}
