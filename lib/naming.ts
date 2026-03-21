/**
 * naming.ts — Pure functions for building safe, normalized filenames.
 *
 * These functions are used by the popup to construct the basename and extension
 * for each download before calling triggerDownload(url, basename, ext).
 *
 * Filename format: destination_vendor_category[_year][_notes]
 * (the collision-safe index suffix is added later by buildSafeFilename in download.ts)
 *
 * Character normalization is intentionally conservative because Tern Travel's
 * exact filename character limitations are unknown. The safe subset:
 *   - lowercase only
 *   - spaces converted to hyphens
 *   - anything not alphanumeric or hyphen is stripped
 */

/**
 * Normalize a single filename field (destination, vendor, category, or notes).
 *
 * Steps applied in order:
 *   1. trim() — removes leading/trailing whitespace before any other transform
 *   2. toLowerCase() — all lowercase for consistent, case-insensitive filenames
 *   3. replace spaces with hyphens — "four seasons" becomes "four-seasons"
 *   4. strip everything else — only [a-z0-9-] survives; accents, symbols, etc. are removed
 *
 * @param value - Raw user input (destination, vendor, category, or notes)
 * @returns     - Normalized slug safe for use in filenames
 *
 * @example
 *   normalizeField("Four Seasons")   // → "four-seasons"
 *   normalizeField("café & résumé")  // → "caf-rsum" (accented chars stripped)
 *   normalizeField("  spaces  ")     // → "spaces"
 *   normalizeField("")               // → ""
 */
export function normalizeField(value: string): string {
  return value
    .trim()                          // remove leading/trailing whitespace first
    .toLowerCase()                   // lowercase everything
    .replace(/\s+/g, '-')           // convert any run of whitespace to a single hyphen
    .replace(/[^a-z0-9\-]/g, '')    // strip everything not alphanumeric or hyphen
    .replace(/-{2,}/g, '-');        // collapse consecutive hyphens (e.g., from "& " → "--") to one
}

/**
 * Build the filename basename (without extension or collision suffix) from the
 * five naming form fields.
 *
 * The three required fields (destination, vendor, category) are always included.
 * Year is inserted between category and notes — both optional, omitted when blank.
 * All fields are normalized via normalizeField() before joining.
 *
 * Output format:  destination_vendor_category
 *            or:  destination_vendor_category_year          (year provided, no notes)
 *            or:  destination_vendor_category_notes         (no year, notes provided)
 *            or:  destination_vendor_category_year_notes    (both provided)
 *
 * Note: normalizeField strips non-[a-z0-9-] characters, so a year like "2025"
 * passes through unchanged (digits survive). Letters in a year value are also
 * preserved (e.g., "2025a" → "2025a").
 *
 * @param destination - Where the image was taken (e.g., "Bali")
 * @param vendor      - Property or vendor name (e.g., "Four Seasons")
 * @param category    - Image category (e.g., "pool", "room", "lobby")
 * @param year        - Optional travel year (e.g., "2025") — omitted if blank
 * @param notes       - Optional free-text tag (e.g., "sunset view") — omitted if blank
 * @returns           - Underscore-joined basename ready for triggerDownload()
 *
 * @example
 *   buildBasename("Bali", "Four Seasons", "Pool")                      // → "bali_four-seasons_pool"
 *   buildBasename("bali", "four-seasons", "pool", "2025")              // → "bali_four-seasons_pool_2025"
 *   buildBasename("bali", "four-seasons", "pool", "2025", "sunset")    // → "bali_four-seasons_pool_2025_sunset"
 *   buildBasename("bali", "four-seasons", "pool", "", "sunset")        // → "bali_four-seasons_pool_sunset"
 *   buildBasename("bali", "four-seasons", "pool", undefined, "sunset") // → "bali_four-seasons_pool_sunset"
 */
export function buildBasename(
  destination: string,
  vendor: string,
  category: string,
  year?: string,
  notes?: string,
): string {
  // Start with the three required fields, each normalized
  const parts = [destination, vendor, category].map(normalizeField);

  // Append year only if it has actual content after trimming
  // (empty string and whitespace-only year values are omitted)
  if (year && year.trim()) {
    parts.push(normalizeField(year));
  }

  // Append notes only if it has actual content after trimming
  // (empty string and whitespace-only notes are omitted)
  if (notes && notes.trim()) {
    parts.push(normalizeField(notes));
  }

  return parts.join('_');
}

/**
 * Derive the file extension from an image URL.
 *
 * Extracts the extension from the URL's pathname (not the full URL string) so
 * that query parameters like "?w=800&format=webp" don't affect the result.
 * Only known image extensions are accepted; anything else falls back to 'jpg'.
 *
 * Known extensions: jpg, jpeg, png, webp, gif, avif
 *
 * Fallback to 'jpg' for:
 *   - URLs with no extension in the pathname (common on CDNs)
 *   - Unknown extensions (e.g., .bmp, .tiff)
 *   - Malformed URLs that cannot be parsed
 *
 * @param url - Full image URL (may include query string, fragment, etc.)
 * @returns   - Lowercase extension string without leading dot (e.g., "jpg", "webp")
 *
 * @example
 *   deriveExt("https://example.com/photo.jpg?w=800")            // → "jpg"
 *   deriveExt("https://example.com/image.PNG")                  // → "png"
 *   deriveExt("https://cdn.example.com/image/upload/v1/photo")  // → "jpg" (no ext)
 *   deriveExt("https://example.com/photo.bmp")                  // → "jpg" (unknown ext)
 *   deriveExt("not-a-url")                                       // → "jpg" (parse error)
 */
export function deriveExt(url: string): string {
  // Known image extensions that Chrome and Tern Travel can handle safely
  const KNOWN_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];

  try {
    // Parse the URL to isolate the pathname, which excludes query strings and fragments
    const pathname = new URL(url).pathname;

    // Find the last dot in the pathname to locate the extension
    const lastDot = pathname.lastIndexOf('.');

    // No dot means no extension — fall back to jpg
    if (lastDot === -1) return 'jpg';

    // Extract everything after the last dot and normalize to lowercase
    const ext = pathname.slice(lastDot + 1).toLowerCase();

    // Return the extension only if it's a known image format; otherwise fallback
    return KNOWN_EXTENSIONS.includes(ext) ? ext : 'jpg';
  } catch {
    // URL parsing failed (e.g., "not-a-url") — fall back safely
    return 'jpg';
  }
}
