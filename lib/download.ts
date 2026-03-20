/**
 * download.ts — collision-safe file download utility.
 *
 * Two exported functions:
 *   buildSafeFilename  — checks Chrome's download history and returns the next
 *                        available filename (with _01/_02 suffix if needed)
 *   triggerDownload    — kicks off the actual download after calling keepAlive
 */

import { keepAlive } from './keepalive';

/**
 * Build a filename that won't silently overwrite an existing file.
 *
 * Strategy: query Chrome's download history for files whose name contains the
 * basename. Filter to exact path matches (search is substring-based, so
 * "bali_pool" would also match "bali_pool_resort" without the filter).
 * Return the clean name if it's available, otherwise increment a zero-padded
 * counter until a free slot is found.
 *
 * Limitation: this checks Chrome's download *history*, not the actual filesystem.
 * Files that were downloaded outside Chrome (or after clearing history) are
 * invisible. Accepted for Phase 1 — see RESEARCH.md Pitfall 4 for context.
 *
 * @param basename  - The base filename, no extension (e.g., "bali_pool")
 * @param ext       - Extension without leading dot (e.g., "jpg")
 * @param subfolder - Folder relative to Downloads root (e.g., "travel-photos")
 * @returns         - Relative path from Downloads root (e.g., "travel-photos/bali_pool.jpg")
 */
export async function buildSafeFilename(
  basename: string,
  ext: string,
  subfolder: string,
): Promise<string> {
  // The prefix we'll look for in history — e.g., "travel-photos/bali_pool"
  const pathPrefix = `${subfolder}/${basename}`;

  // Query download history for anything matching the basename.
  // filenameRegex matches against the full absolute path, so we escape special chars.
  // We'll filter more precisely below to avoid matching e.g. "bali_pool_resort".
  const escapedBasename = basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existing = await chrome.downloads.search({
    filenameRegex: escapedBasename,
    limit: 100,
  });

  // Build a set of filenames that are already taken.
  // We only count entries where the absolute path contains our exact path prefix,
  // either followed by "." (clean name) or "_" (a suffixed variant).
  // This excludes entries like "bali_pool_resort.jpg" from blocking "bali_pool.jpg".
  const taken = new Set(
    existing
      .filter((d) => {
        if (!d.filename) return false;
        // Replace backslashes for Windows path compatibility
        const normalized = d.filename.replace(/\\/g, '/');
        // Match exact base: ends with "<prefix>.<ext>" or contains "<prefix>_"
        return (
          normalized.endsWith(`${pathPrefix}.${ext}`) ||
          normalized.includes(`${pathPrefix}_`)
        );
      })
      .map((d) => {
        // Normalize to just the relative portion we care about for comparison
        const normalized = d.filename!.replace(/\\/g, '/');
        // Extract from subfolder/ onwards (e.g., "travel-photos/bali_pool.jpg")
        const idx = normalized.lastIndexOf(`${subfolder}/`);
        return idx >= 0 ? normalized.slice(idx) : normalized;
      }),
  );

  // Try the clean name first
  const cleanName = `${pathPrefix}.${ext}`;
  if (!taken.has(cleanName)) {
    return cleanName;
  }

  // Clean name is taken — find the next available numbered slot (_01, _02, ..., _99)
  for (let i = 1; i <= 99; i++) {
    const candidate = `${pathPrefix}_${String(i).padStart(2, '0')}.${ext}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  // All 99 counter slots are taken — this should never happen in practice
  throw new Error(
    `buildSafeFilename: all 99 filename slots exhausted for "${pathPrefix}.${ext}"`,
  );
}

/**
 * Download a file into the travel-photos subfolder with a collision-safe name.
 *
 * Call order matters:
 *   1. keepAlive  — resets the 30s SW idle timer before any async work
 *   2. buildSafeFilename — checks history and picks a safe filename
 *   3. chrome.downloads.download — hands the file to Chrome
 *
 * We use conflictAction: 'overwrite' because buildSafeFilename already guarantees
 * the chosen path is unique. Chrome won't actually overwrite anything — this just
 * suppresses the "file exists" prompt in case our history check had a gap.
 *
 * @param url       - The full URL of the image to download
 * @param basename  - Desired base filename without extension (e.g., "bali_pool")
 * @param ext       - File extension without leading dot (e.g., "jpg")
 * @returns         - The numeric download ID Chrome assigns to this download
 */
export async function triggerDownload(
  url: string,
  basename: string,
  ext: string,
): Promise<number> {
  // Step 1: Touch storage.session to reset SW idle timer
  await keepAlive();

  // Step 2: Determine a safe filename (checks Chrome's download history)
  const filename = await buildSafeFilename(basename, ext, 'travel-photos');

  // Step 3: Initiate the download
  const downloadId = await chrome.downloads.download({
    url,
    filename,
    conflictAction: 'overwrite', // safe because buildSafeFilename already avoided collisions
    saveAs: false, // no Save-As dialog — goes straight to Downloads/travel-photos/
  });

  return downloadId;
}
