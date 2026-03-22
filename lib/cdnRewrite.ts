/**
 * cdnRewrite.ts — Pure function for CDN URL upscaling.
 *
 * Takes any image URL and, if it matches a known CDN pattern, rewrites the
 * size/dimension parameters to request the highest practical resolution.
 *
 * This is a pure function:
 *   - No network calls
 *   - No side effects
 *   - No external dependencies
 *   - Uses the native URL API for safe, reliable URL parsing and manipulation
 *
 * Supported CDNs:
 *   1. Booking.com (bstatic.com)       — /maxNNNxNNN/ → /max10000x10000/
 *   2. Airbnb (muscache.com)           — aki_policy → xx_large, im_w → 1440
 *   3. Cloudinary (res.cloudinary.com) — /upload/<transform>/ → w_4000,c_limit,q_auto
 *   4. Imgix (*.imgix.net)             — w=4000, h removed, fit=max
 *   5. Viator/TripAdvisor (dynamic-media-cdn.tripadvisor.com) — w=4000, h=-1
 *   6. GetYourGuide (cdn.getyourguide.com) — pass-through stub (patterns unconfirmed)
 *
 * Unknown CDNs and invalid URLs are returned unchanged without throwing.
 *
 * Note on Fastly: Omitted intentionally. Fastly IO has no unique domain pattern —
 * detection relies on generic width/height query params, which creates false-positive
 * risk on non-Fastly sites. No confirmed Jennifer-used site runs Fastly IO. Can be
 * added later if a specific site is identified.
 */

/**
 * Rewrite an image URL to request the highest available resolution from the
 * detected CDN. Returns the URL unchanged if no CDN pattern matches, or if
 * the URL cannot be parsed.
 *
 * @param rawUrl - Any image URL (CDN or otherwise)
 * @returns      - Upscaled CDN URL, or the original rawUrl if no match
 */
export function rewriteUrlForMaxResolution(rawUrl: string): string {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    // URL is malformed (e.g., "not-a-url" or "") — return unchanged, no throw
    return rawUrl;
  }

  const { hostname } = url;

  // Route to the appropriate per-CDN rewriter based on hostname
  if (hostname.endsWith('bstatic.com')) {
    return rewriteBooking(url);
  }

  if (hostname.endsWith('muscache.com')) {
    return rewriteAirbnb(url);
  }

  if (hostname === 'res.cloudinary.com') {
    return rewriteCloudinary(url);
  }

  // Leading dot is intentional: prevents "notimgix.net" from matching
  if (hostname.endsWith('.imgix.net')) {
    return rewriteImgix(url);
  }

  if (hostname.endsWith('dynamic-media-cdn.tripadvisor.com')) {
    return rewriteViator(url);
  }

  if (hostname === 'cdn.getyourguide.com') {
    return rewriteGetYourGuide(url);
  }

  // No CDN pattern matched — return unchanged
  return rawUrl;
}

// ---------------------------------------------------------------------------
// Per-CDN rewriter functions (private)
// ---------------------------------------------------------------------------

/**
 * Rewrite a Booking.com (bstatic.com) image URL to request max resolution.
 *
 * Booking.com encodes image dimensions in the URL pathname as a path segment:
 *   /xdata/images/hotel/max1024x768/12345.jpg
 *   /xdata/images/hotel/max500/12345.jpg
 *
 * We replace that segment with /max10000x10000/ to request the largest available
 * size. Query params like k= and o= are authentication tokens and must be preserved.
 *
 * IMPORTANT: Only hotel images (/hotel/ path) are rewritten. Attractions images use
 * /xphoto/ and have a lower max resolution (e.g. max1200) — requesting max10000x10000
 * on those paths returns a 404 HTML page. Leave xphoto URLs unchanged so they
 * download at their actual maximum size.
 *
 * Source: Booking.com bstatic CDN URL structure observed in production.
 *
 * @param url - Parsed Booking.com URL
 * @returns   - Upscaled URL string, or url.href unchanged if path is not a hotel image
 */
function rewriteBooking(url: URL): string {
  // Only rewrite hotel images — attractions (/xphoto/) and other paths are left unchanged
  if (!url.pathname.includes('/hotel/')) {
    return url.href;
  }

  // Match /maxNNN/ (width only) or /maxNNNxNNN/ (width x height) path segments
  const rewritten = url.pathname.replace(/\/max\d+(x\d+)?\//i, '/max10000x10000/');

  if (rewritten === url.pathname) {
    // No match — path had no max-dimension segment
    return url.href;
  }

  url.pathname = rewritten;
  return url.href;
}

/**
 * Rewrite an Airbnb (muscache.com) image URL to request the largest available size.
 *
 * Airbnb uses two different query param strategies:
 *   1. aki_policy=<size>  — policy-based sizing (large, small, medium, etc.)
 *      → Set to "xx_large" for the highest resolution
 *   2. im_w=<pixels>      — explicit pixel width
 *      → Set to 1440 (the documented maximum for Airbnb's image pipeline)
 *
 * If neither param is present, the URL is returned unchanged — there is no safe
 * way to request a larger size without knowing which strategy Airbnb is using.
 *
 * Source: Airbnb image CDN API observed in production; xx_large is the largest
 * documented aki_policy value.
 *
 * @param url - Parsed Airbnb URL
 * @returns   - Upscaled URL string, or url.href unchanged if no size param found
 */
function rewriteAirbnb(url: URL): string {
  if (url.searchParams.has('aki_policy')) {
    url.searchParams.set('aki_policy', 'xx_large');
    return url.href;
  }

  if (url.searchParams.has('im_w')) {
    url.searchParams.set('im_w', '1440');
    return url.href;
  }

  // No recognized size param — return unchanged
  return url.href;
}

/**
 * Rewrite a Cloudinary (res.cloudinary.com) image URL to request max resolution.
 *
 * Cloudinary URLs have a transformation segment immediately after /upload/:
 *   /image/upload/<transformation>/public_id.jpg
 *
 * We replace the first transformation segment with w_4000,c_limit,q_auto:
 *   - w_4000      — request up to 4000px wide (Cloudinary hard-limits beyond this)
 *   - c_limit     — crop mode "limit": only scale down, never up; preserves aspect ratio
 *   - q_auto      — automatic quality optimization
 *
 * Source: Cloudinary Image Transformation documentation.
 *
 * @param url - Parsed Cloudinary URL
 * @returns   - Upscaled URL string, or url.href unchanged if no /upload/ segment found
 */
function rewriteCloudinary(url: URL): string {
  // Match /upload/<segment>/ where <segment> is the first transformation block.
  // A segment is any sequence of characters that is not a forward slash.
  const rewritten = url.pathname.replace(/\/upload\/[^/]+\//, '/upload/w_4000,c_limit,q_auto/');

  if (rewritten === url.pathname) {
    // No /upload/<transform>/ pattern found in path
    return url.href;
  }

  url.pathname = rewritten;
  return url.href;
}

/**
 * Rewrite an Imgix (*.imgix.net) image URL to request max resolution.
 *
 * Imgix uses query params for sizing:
 *   - w=<pixels>   — output width
 *   - h=<pixels>   — output height (removed to allow unconstrained height)
 *   - fit=<mode>   — resize mode
 *
 * We set w=4000, remove h (so height scales proportionally), and set fit=max
 * (which scales up to the requested width without cropping).
 *
 * Source: Imgix URL API documentation.
 *
 * @param url - Parsed Imgix URL (hostname must end with .imgix.net)
 * @returns   - Upscaled URL string
 */
function rewriteImgix(url: URL): string {
  url.searchParams.set('w', '4000');
  url.searchParams.delete('h');       // Remove height constraint; let it scale proportionally
  url.searchParams.set('fit', 'max');
  return url.href;
}

/**
 * Rewrite a Viator/TripAdvisor image URL to request max resolution.
 *
 * Viator (owned by TripAdvisor) uses query params for sizing:
 *   - w=<pixels>  — output width
 *   - h=<pixels>  — output height (-1 means unconstrained, per Viator Partner API)
 *   - s=<value>   — session/signature token (must be preserved)
 *
 * Setting h=-1 is NOT a bug — it is explicitly documented in the Viator Partner
 * API as the way to request unconstrained height (i.e., maintain aspect ratio).
 *
 * Source: Viator Partner API documentation; TripAdvisor Media CDN observed in production.
 *
 * @param url - Parsed Viator/TripAdvisor URL
 * @returns   - Upscaled URL string
 */
function rewriteViator(url: URL): string {
  url.searchParams.set('w', '4000');
  url.searchParams.set('h', '-1');    // -1 = unconstrained height per Viator Partner API
  return url.href;
}

/**
 * Pass-through stub for GetYourGuide (cdn.getyourguide.com) image URLs.
 *
 * GetYourGuide's resize parameter conventions are unconfirmed. Returning the URL
 * unchanged is safe — the image will still download, just at the original CDN size.
 *
 * TODO: GetYourGuide resize params unknown — inspect live site URLs in DevTools
 * before implementing. Check for w=, size=, or similar patterns on cdn.getyourguide.com.
 *
 * @param url - Parsed GetYourGuide URL
 * @returns   - url.href unchanged
 */
function rewriteGetYourGuide(url: URL): string {
  return url.href;
}
