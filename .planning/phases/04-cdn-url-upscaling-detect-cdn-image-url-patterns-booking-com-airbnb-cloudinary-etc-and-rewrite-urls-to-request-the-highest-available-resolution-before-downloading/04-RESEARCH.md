# Phase 4: CDN URL Upscaling - Research

**Researched:** 2026-03-20
**Domain:** CDN image URL pattern detection and URL rewriting (TypeScript, browser extension)
**Confidence:** HIGH (Cloudinary, Imgix, Fastly from official docs; Booking.com/Airbnb/Viator from cross-referenced scraping guides; GetYourGuide LOW)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Support all major travel CDNs in v1: Booking.com, Cloudinary (used by Airbnb), Imgix, Akamai Image Manager, Fastly
- Also explicitly cover GetYourGuide and Viator
- Researcher should audit which CDN each Jennifer-used site actually runs on (done below)
- If GetYourGuide or Viator use a CDN not already in the list, add that CDN as a target
- Request a large fixed max size — 4000px wide (or CDN-specific equivalent) — not stripping all params
- Preserve the original image format (JPG, WebP, AVIF) — do not force conversion
- Rewrite at download time only — just before chrome.downloads.download is triggered
- Thumbnails in popup show original extracted URL — no extra network requests during scan
- The rewrite is applied to the URL in the triggerDownload pipeline (lib/download.ts or callsite)
- If a rewritten URL returns 404 or fails: silently fall back to original URL
- A rewrite failure is not counted as a download failure if the fallback succeeds
- No UI change for rewrite failures

### Claude's Discretion

- Exact regex or URL parsing approach per CDN (URL manipulation vs. regex replacement vs. URLSearchParams)
- How to structure the CDN rewriter module (one function per CDN, or a table of pattern → transform rules)
- Whether to validate rewritten URL format before attempting the download (basic sanity check)
- Test strategy for CDN URL patterns (unit tests with fixture URLs from each CDN)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

No requirement IDs are mapped yet. Proposed IDs for this phase:

| ID | Description | Research Support |
|----|-------------|-----------------|
| CDN-01 | Rewrite Booking.com bstatic.com image URLs to request max-resolution variant | Booking.com URL pattern documented below |
| CDN-02 | Rewrite Airbnb/muscache.com image URLs to request largest available size | Airbnb aki_policy and im_w patterns documented below |
| CDN-03 | Rewrite Cloudinary image URLs to request w_4000 variant | Cloudinary URL format documented below |
| CDN-04 | Rewrite Imgix image URLs to request w=4000 variant | Imgix URL format documented below |
| CDN-05 | Rewrite Viator/TripAdvisor dynamic-media-cdn image URLs to request w=4000 | Viator URL pattern documented below |
| CDN-06 | GetYourGuide image URL rewriting (patterns unconfirmed — may be Imgix or custom) | LOW confidence — see Open Questions |
| CDN-07 | Rewrite Fastly-served image URLs to request width=4000 | Fastly URL format documented below |
| CDN-08 | Silent fallback to original URL when rewritten URL download fails | Fallback pattern via Promise.allSettled documented below |
| CDN-09 | CDN rewrite applied at download time only, not during scan/thumbnail display | Integration point analysis in lib/download.ts or App.tsx callsite |
</phase_requirements>

---

## Summary

This phase adds a URL rewriting layer to the existing download pipeline. When a user clicks "Download Photos," the extension intercepts each image URL, checks if it matches a known CDN pattern, and replaces size-restricting parameters with a high-resolution equivalent before handing the URL to `chrome.downloads.download`. The rewrite is transparent: Jennifer sees no change in the UI.

The five CDNs on the explicit target list have well-documented URL patterns. Booking.com embeds a max-dimension string in the URL path (`max1024x768`). Cloudinary, Imgix, and Fastly use query/path parameters for width and height. Airbnb's muscache.com uses either a named policy parameter (`aki_policy`) or a query param (`im_w`). Viator uses the TripAdvisor dynamic media CDN with `w=` and `h=` query params.

GetYourGuide's CDN domain is `cdn.getyourguide.com` but the specific resize parameter pattern is not publicly documented. Research could not find a confirmed pattern — see Open Questions. The planner should treat GetYourGuide as a LOW-confidence entry requiring live URL inspection before implementation.

**Primary recommendation:** Build `lib/cdnRewrite.ts` as a pure function `rewriteUrlForMaxResolution(url: string): string`. It takes an absolute URL, checks hostname against known CDN patterns, applies the appropriate rewrite, and returns the mutated URL. No network calls — pure string manipulation. Integrate as a one-liner in `runDownloads()` in `App.tsx` before calling `sendDownloadMessage`.

---

## CDN Audit: Which Sites Use Which CDN

| Site Jennifer Uses | CDN/Image Server | Domain Pattern | Confidence |
|---|---|---|---|
| Booking.com | Custom (bstatic CDN) | `cf.bstatic.com`, `t-cf.bstatic.com` | HIGH |
| Airbnb | Akamai edge + muscache origin | `a0.muscache.com`, `a1.muscache.com`, etc. | HIGH |
| GetYourGuide | Unknown (likely custom or Imgix) | `cdn.getyourguide.com` | LOW — patterns unconfirmed |
| Viator | TripAdvisor dynamic media CDN | `dynamic-media-cdn.tripadvisor.com`, `hare-dynamic-media-cdn.tripadvisor.com` | HIGH |

**Note:** Airbnb does NOT use Cloudinary directly. Muscache.com is Akamai-backed but uses Airbnb's own URL schema. Cloudinary should still be in the target list because Airbnb's newer `/im/` paths use custom Akamai Image Manager policies, and Cloudinary is widely used by other travel sites.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| None | — | CDN URL rewriting is pure string manipulation; no library needed | URL API built into browsers/Node is sufficient |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Native `URL` API | Browser built-in | Parse URL, read/write searchParams and pathname | Used throughout codebase already |
| `URLSearchParams` | Browser built-in | Read/write query params without string concatenation | Preferred over manual regex for query params |

**No new npm dependencies needed for this phase.** The entire rewriter is pure TypeScript using `new URL()` and `URLSearchParams`.

---

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── cdnRewrite.ts        # New: CDN URL detection + rewriting (pure function)
├── download.ts          # Existing: triggerDownload — unchanged interface
├── naming.ts            # Existing
└── extract/             # Existing — no changes this phase
tests/unit/
├── cdnRewrite.test.ts   # New: fixture-based unit tests per CDN
└── ...                  # Existing tests unchanged
```

### Pattern 1: Pure Rewriter Function

**What:** A single exported function that takes a URL string and returns a (potentially modified) URL string. No side effects, no async. Easy to test exhaustively.

**When to use:** This phase. The function is called synchronously before the download, so async is not needed.

```typescript
// lib/cdnRewrite.ts
/**
 * Rewrite a CDN image URL to request the highest practical resolution.
 * Returns the original URL unchanged if no CDN pattern matches.
 * Pure function — no network calls, no side effects.
 */
export function rewriteUrlForMaxResolution(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    // Not a valid absolute URL — return unchanged
    return rawUrl;
  }

  const { hostname } = url;

  if (hostname.endsWith('bstatic.com')) return rewriteBooking(url);
  if (hostname.endsWith('muscache.com')) return rewriteAirbnb(url);
  if (hostname.endsWith('res.cloudinary.com')) return rewriteCloudinary(url);
  if (hostname.endsWith('.imgix.net')) return rewriteImgix(url);
  if (hostname.endsWith('dynamic-media-cdn.tripadvisor.com')) return rewriteViator(url);
  if (hostname.endsWith('cdn.getyourguide.com')) return rewriteGetYourGuide(url);

  return rawUrl;  // no match — return original unchanged
}
```

**Why hostname-first:** Hostname checks are O(1) string suffix matches. Regex on full URL strings is slower and harder to maintain. If a URL doesn't match a known hostname, it's immediately returned — no regex engine overhead.

### Pattern 2: Per-CDN Rewrite Functions

Each CDN gets its own private function. This keeps the logic isolated and independently testable.

```typescript
// Source: bstatic.com URL analysis (see Sources section)
// Pattern: cf.bstatic.com/xdata/images/hotel/max1024x768/12345.jpg
//          Replace max{W}x{H} or max{W} in path with max10000x10000
function rewriteBooking(url: URL): string {
  // Replace any "max{digits}" or "max{digits}x{digits}" segment in the path
  url.pathname = url.pathname.replace(/\/max\d+(x\d+)?\//, '/max10000x10000/');
  return url.href;
}

// Source: muscache.com URL analysis
// Old format: ?aki_policy=large → replace with aki_policy=xx_large
// New format: ?im_w=720 → replace with im_w=1440 (Airbnb's documented max)
function rewriteAirbnb(url: URL): string {
  if (url.searchParams.has('aki_policy')) {
    url.searchParams.set('aki_policy', 'xx_large');
    return url.href;
  }
  if (url.searchParams.has('im_w')) {
    url.searchParams.set('im_w', '1440');  // Airbnb's documented max is 1440px
    return url.href;
  }
  return url.href;
}

// Source: cloudinary.com/documentation
// Pattern: res.cloudinary.com/{cloud}/image/upload/w_300,h_200,c_fill/image.jpg
// Strategy: replace transformation segment with w_4000,c_limit
function rewriteCloudinary(url: URL): string {
  // Cloudinary transformations are in the path after /upload/
  // Replace the entire transformation string between /upload/ and the next /
  url.pathname = url.pathname.replace(
    /\/upload\/[^/]+\//,
    '/upload/w_4000,c_limit,q_auto/'
  );
  return url.href;
}

// Source: docs.imgix.com (official)
// Pattern: {domain}.imgix.net/path/image.jpg?w=300&h=200&fit=clip
// Strategy: set w=4000, remove h, set fit=max
function rewriteImgix(url: URL): string {
  url.searchParams.set('w', '4000');
  url.searchParams.delete('h');
  url.searchParams.set('fit', 'max');
  return url.href;
}

// Source: Viator Partner API docs / TripAdvisor scraping community
// Pattern: dynamic-media-cdn.tripadvisor.com/media/photo-o/{id}/caption.jpg?w=600&h=400&s=1
// Strategy: w=4000, h=-1 (unconstrained height), s=1
function rewriteViator(url: URL): string {
  url.searchParams.set('w', '4000');
  url.searchParams.set('h', '-1');  // -1 = unconstrained, as documented in API examples
  return url.href;
}

// GetYourGuide: LOW CONFIDENCE — pattern not confirmed
// cdn.getyourguide.com confirmed as CDN domain but resize parameters unknown
// Placeholder: return URL unchanged until confirmed via DevTools inspection
function rewriteGetYourGuide(url: URL): string {
  return url.href;  // TODO: confirm resize params via live site inspection
}
```

### Pattern 3: Integration Point in runDownloads

The rewrite is applied in `App.tsx`'s `runDownloads` function, just before `sendDownloadMessage`. This keeps `triggerDownload` unchanged.

```typescript
// In App.tsx, inside the Promise.allSettled map callback (current code):
//   await sendDownloadMessage(url, numberedBasenames[i], ext);
//
// After this phase:
//   const upscaledUrl = rewriteUrlForMaxResolution(url);
//   await sendDownloadMessage(upscaledUrl, numberedBasenames[i], ext);
```

The `ext` derivation (`deriveExt(url)`) should use the ORIGINAL url (not the rewritten one) so format is derived from the filename in the original URL, not any CDN transform parameters. Or derive it before rewriting. Either works since CDN rewriting doesn't change the file extension in the pathname.

### Pattern 4: Fallback on Rewrite Failure

The existing `Promise.allSettled` pattern in `runDownloads` already provides one level of failure isolation. The fallback for a failed rewritten URL requires wrapping the message send:

```typescript
// Pseudocode — exact implementation is planner's discretion
async function sendWithFallback(originalUrl: string, basename: string, ext: string): Promise<void> {
  const upscaledUrl = rewriteUrlForMaxResolution(originalUrl);

  if (upscaledUrl === originalUrl) {
    // No rewrite applied — just download directly
    await sendDownloadMessage(originalUrl, basename, ext);
    return;
  }

  try {
    await sendDownloadMessage(upscaledUrl, basename, ext);
  } catch {
    // Rewritten URL failed — fall back to original
    // This fallback attempt is not counted as a failure in the UI
    await sendDownloadMessage(originalUrl, basename, ext);
  }
}
```

**Important:** the fallback must propagate the error if the fallback URL also fails. Only swallow the error from the rewritten URL attempt. The `done`/`failed` counts in the reducer must not be double-counted.

### Anti-Patterns to Avoid

- **Regex on full URL string:** Hard to maintain, easy to match wrong part (query param vs. path segment). Use `new URL()` to parse first.
- **Stripping all query params:** Risks fetching 20MB+ originals. Always set a concrete max dimension.
- **Applying rewrite during scan/thumbnail phase:** Adds network requests and slows the scan. Rewrite only at download time.
- **Modifying `triggerDownload` signature:** Keep `triggerDownload(url, basename, ext)` unchanged. Apply rewrite at callsite in App.tsx.
- **Running a HEAD request to verify rewritten URL exists:** Unnecessary network roundtrip and won't work cross-origin in MV3. Just attempt the download and rely on the fallback.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL parsing | Manual regex on raw strings | `new URL()` built-in | Handles encoding, relative refs, query strings correctly |
| Query param manipulation | String concatenation | `URLSearchParams` | Handles encoding, multi-value params, deletion |
| CDN detection | Custom domain parser | `url.hostname.endsWith(...)` | Simple, readable, correct for subdomains |

**Key insight:** CDN URL rewriting is string surgery on well-structured URLs. The native URL API handles all the edge cases (percent-encoding, multiple params with same name, trailing slashes) that manual regex gets wrong.

---

## CDN URL Pattern Reference

This is the core technical output of the research. Documented per CDN with confidence levels.

### Booking.com (HIGH confidence)

**CDN:** Custom bstatic CDN
**Domains:** `cf.bstatic.com`, `t-cf.bstatic.com`, `q-xx.bstatic.com`
**URL structure:**
```
https://cf.bstatic.com/xdata/images/hotel/max1024x768/182867058.jpg?k=abc123&o=...
https://cf.bstatic.com/xdata/images/hotel/max500/182867058.jpg
https://bstatic.com/data/xphoto/max10000x10000/192/19248043.jpg
```

**Size parameter:** Embedded in path as `/max{W}x{H}/` or `/max{W}/`

**Rewrite strategy:** Replace path segment matching `/max\d+(x\d+)?/` with `/max10000x10000/`

**Max supported:** `max10000x10000` confirmed in Booking.com API docs — this is their full-resolution endpoint

**Preserve:** Query params (`k=`, `o=`, `hp=`) are authentication tokens — must NOT be removed

**Example transform:**
```
before: /xdata/images/hotel/max1024x768/12345.jpg?k=abc
after:  /xdata/images/hotel/max10000x10000/12345.jpg?k=abc
```

---

### Airbnb / muscache.com (MEDIUM-HIGH confidence)

**CDN:** Akamai edge, origin `muscache.com` (Airbnb-owned domain)
**Domains:** `a0.muscache.com`, `a1.muscache.com`, `a2.muscache.com`
**Two URL formats exist (both in use):**

**Format A — aki_policy named sizes:**
```
https://a2.muscache.com/im/pictures/58614995-e794.../photo.jpg?aki_policy=large
```
Known policy values (ascending size): `small`, `large`, `x_large`, `xx_large`
Rewrite: set `aki_policy=xx_large`
**Airbnb's documented max upload is 1440x960px — xx_large corresponds to this.**

**Format B — im_w pixel width:**
```
https://a0.muscache.com/im/pictures/miso/Hosting-46812239/original/abc.jpeg?im_w=720
```
Rewrite: set `im_w=1440` (Airbnb's documented output max)

**Detection:** Check `hostname.endsWith('muscache.com')`, then branch on `aki_policy` vs `im_w` presence.

**Preserve:** All other query params (format, quality flags)

---

### Cloudinary (HIGH confidence)

**Source:** Official Cloudinary docs (cloudinary.com/documentation)
**Domains:** `res.cloudinary.com`
**URL structure:**
```
https://res.cloudinary.com/{cloud-name}/image/upload/{transformations}/{asset-id}.jpg
```

**Transformation segment format:** Comma-separated params between `/upload/` and the next `/`
```
w_300,h_200,c_fill,q_auto
```

**Key parameters:**
- `w_N` — width in pixels
- `h_N` — height in pixels
- `c_fill` / `c_limit` / `c_scale` — crop mode
- `q_auto` — automatic quality
- `f_auto` — automatic format (preserve format by NOT including this)

**Rewrite strategy:** Replace the entire transformation segment with `w_4000,c_limit,q_auto`

`c_limit` is the correct crop mode here: it resizes down to fit within dimensions but never upscales. Safe for all images.

**Preserve:** Format extension in the URL (`.jpg`, `.webp`) — do not add `f_auto`

**Example transform:**
```
before: /upload/w_300,h_200,c_fill/photo.jpg
after:  /upload/w_4000,c_limit,q_auto/photo.jpg
```

**Regex for path transformation:**
```typescript
url.pathname = url.pathname.replace(
  /\/upload\/[^/]+\//,
  '/upload/w_4000,c_limit,q_auto/'
);
```

---

### Imgix (HIGH confidence)

**Source:** Official docs.imgix.com
**Domains:** `*.imgix.net` (any subdomain), also used by sites with custom domains pointing to Imgix
**URL structure:** Standard HTTPS URL with query parameters
```
https://example.imgix.net/photo.jpg?w=300&h=200&fit=clip&q=80
```

**Key parameters:**
- `w` — width in pixels (max: 8192 per Imgix platform limit)
- `h` — height in pixels
- `fit` — resize mode: `clip`, `max`, `crop`, `fill`, etc.
- `q` — quality 0-100

**Rewrite strategy:** Set `w=4000`, delete `h`, set `fit=max`

`fit=max` means "resize to fit within dimensions but never upscale" — correct behavior.

**Example transform:**
```
before: /photo.jpg?w=300&h=200&fit=clip
after:  /photo.jpg?w=4000&fit=max
```

**Note:** GetYourGuide uses `cdn.getyourguide.com` which is NOT a `.imgix.net` subdomain. If GYG uses Imgix, they use a custom domain. Detection requires inspecting actual GYG image URLs — see Open Questions.

---

### Viator / TripAdvisor dynamic media CDN (HIGH confidence)

**Source:** Viator Partner API docs + TripAdvisor scraping community (cross-verified)
**Domains:** `dynamic-media-cdn.tripadvisor.com`, `hare-dynamic-media-cdn.tripadvisor.com`
**URL structure:**
```
https://dynamic-media-cdn.tripadvisor.com/media/photo-o/{id}/caption.jpg?w=1000&h=-1&s=1
https://hare-dynamic-media-cdn.tripadvisor.com/media/photo-o/{id}/caption.jpg?w=100&h=100&s=1
```

**Key parameters:**
- `w` — width in pixels
- `h` — height (`-1` = unconstrained; observed in practice)
- `s` — unknown (always `1` in examples; do not change)

**Rewrite strategy:** Set `w=4000`, set `h=-1`

**Preserve:** `s=1` and any other params

**Example transform:**
```
before: ?w=600&h=400&s=1
after:  ?w=4000&h=-1&s=1
```

---

### Fastly Image Optimizer (MEDIUM confidence — not yet confirmed on a specific Jennifer-used site)

**Source:** Official Fastly IO docs
**Domains:** No single domain pattern — Fastly IO is configured per customer CDN. Relies on query string presence.
**URL structure:**
```
https://example.com/image.jpg?width=800&height=600
https://example.com/image.jpg?width=400
```

**Key parameters:**
- `width` — integer pixels (max 8192)
- `height` — integer pixels
- `fit` — `bounds`, `cover`, `crop`, etc.

**Rewrite strategy:** Set `width=4000`, delete `height`

**Detection challenge:** Fastly IO has no unique domain pattern. It can only be detected by the presence of `width` or `height` query params, which might collide with non-Fastly sites. **Do not auto-detect Fastly by query params alone — risk of false positives.** Only add Fastly detection if a specific Jennifer-used site is confirmed to use it.

**Recommendation:** Omit Fastly from the initial implementation unless GetYourGuide or another site is confirmed to use it. Fastly is in the locked decision list, so include it but with a comment that it requires a confirmed site.

---

### Akamai Image Manager (MEDIUM confidence)

**Source:** Official Akamai techdocs.akamai.com
**Domains:** No unique domain pattern — Akamai IM uses `?im=` query param
**URL structure:**
```
https://www.example.com/image.jpg?im=Resize=(400,400)
https://www.example.com/image.jpg?im=Resize,width=400,height=400
```

**Detection:** Presence of `?im=` query param
**Rewrite strategy:** Replace `im=` value with `Resize=(4000,4000)`

**Same false-positive risk as Fastly — `im=` is a common query param name.** Airbnb uses `im_w` (note the underscore) which is different. Akamai Image Manager uses just `im=`. Detection must be exact-match on the param name.

**Recommendation:** Same as Fastly — include in codebase but mark as requiring a confirmed site for the `im=` host. Do not activate on muscache.com (Airbnb has its own policy/param system, not Akamai IM query string style).

---

### GetYourGuide (LOW confidence)

**Source:** Only finding is CDN domain `cdn.getyourguide.com` from their public API spec
**Domain confirmed:** `cdn.getyourguide.com`
**Resize parameters:** NOT confirmed by any source

**What is known:** GYG uses `cdn.getyourguide.com` as their image CDN. The pattern of URL parameters is unknown.

**What is not known:** Whether they support any dynamic resizing at all, or whether images are pre-sized static assets. Whether they use Imgix, Fastly, or a proprietary system behind this domain.

**Recommended action (for planner):** Add a stub function for GetYourGuide that currently returns the URL unchanged. Add a TODO comment citing the need for a live DevTools inspection of cdn.getyourguide.com image URLs. This satisfies the locked decision (GetYourGuide is a target) while being honest that we don't have the pattern yet.

---

## Common Pitfalls

### Pitfall 1: Removing Auth Query Params on Booking.com

**What goes wrong:** Booking.com image URLs include `k=`, `o=`, and `hp=` query params that are authentication tokens. Stripping them to "clean up" the URL will cause 403 errors.

**Why it happens:** When rewriting only the pathname, URLSearchParams are preserved automatically. The risk is if someone constructs a new URL from scratch instead of mutating the existing `url` object.

**How to avoid:** Always mutate `url.pathname` on the existing `URL` object. Never construct a new URL from only the path.

**Warning signs:** 403 errors on Booking.com downloads but not on other CDNs.

---

### Pitfall 2: Cloudinary Has Chained Transformations

**What goes wrong:** Some Cloudinary URLs have multiple transformation segments chained with `/`, like:
```
/upload/t_media_lib_thumb/w_300,h_200,c_fill/photo.jpg
```
A simple replace of the first transformation segment may break the chain or miss the size params entirely.

**Why it happens:** Cloudinary supports named transformations and transformation chains. The size params might be in a different segment than expected.

**How to avoid:** The regex `/\/upload\/[^/]+\//` only replaces the FIRST segment after `/upload/`. For this phase, that is acceptable — we replace whatever transformation comes first with our max-size transform. The chained parts (if present) will be dropped, which is fine since we're requesting max size anyway.

**Warning sign:** Cloudinary URL still looks small after rewrite — check if there were multiple transformation segments.

---

### Pitfall 3: im_w vs im= (Airbnb vs Akamai)

**What goes wrong:** Confusing Airbnb's `im_w` parameter (Airbnb-specific) with Akamai Image Manager's `im=` parameter. They are completely different.

**Why it happens:** The names are similar. Airbnb's muscache.com runs Akamai as the edge layer, but the URL parameters are Airbnb's own schema, not Akamai IM syntax.

**How to avoid:** In the muscache.com rewriter, check specifically for `im_w` (with underscore). Never match generic `im=` on the muscache domain.

---

### Pitfall 4: Fallback Must Not Double-Count Failures

**What goes wrong:** If the rewritten URL fails and falls back to the original, and then the original also fails, the download counts as 1 failure in the UI. But if the fallback logic is inside the per-download closure, and it catches the rewrite error but then re-throws the original failure, the `Promise.allSettled` result will correctly count it as 1 rejection.

**Why it happens:** Developers wrap the fallback in a try/catch and forget to re-throw when the fallback itself fails.

**How to avoid:** Ensure the fallback wrapper always propagates the error if the fallback URL also fails.

---

### Pitfall 5: Viator's h=-1 Is Not a Typo

**What goes wrong:** A developer assumes `h=-1` is an error and changes it to `h=3000`, resulting in center-cropped images.

**Why it happens:** Negative height looks like a bug. But `h=-1` is documented in Viator's own Partner API examples as the unconstrained height mode.

**How to avoid:** Comment this explicitly in the rewrite function.

---

### Pitfall 6: Imgix Domain Detection Must Use .endsWith

**What goes wrong:** Checking `hostname.includes('imgix.net')` instead of `hostname.endsWith('.imgix.net')` would incorrectly match domains like `notimgix.net`.

**How to avoid:** Always use `hostname.endsWith('.imgix.net')` for Imgix detection.

---

## Code Examples

### Vitest unit test structure (matches existing project pattern)

```typescript
// tests/unit/cdnRewrite.test.ts
import { rewriteUrlForMaxResolution } from '@/lib/cdnRewrite';

describe('rewriteUrlForMaxResolution', () => {
  describe('Booking.com', () => {
    it('replaces max1024x768 with max10000x10000', () => {
      const input = 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/12345.jpg?k=abc&o=1';
      const result = rewriteUrlForMaxResolution(input);
      expect(result).toContain('/max10000x10000/');
      expect(result).toContain('k=abc');  // auth param preserved
    });

    it('replaces max500 (no height) with max10000x10000', () => {
      const input = 'https://cf.bstatic.com/xdata/images/hotel/max500/12345.jpg';
      expect(rewriteUrlForMaxResolution(input)).toContain('/max10000x10000/');
    });
  });

  describe('Airbnb', () => {
    it('replaces aki_policy=large with aki_policy=xx_large', () => {
      const input = 'https://a0.muscache.com/im/pictures/abc.jpg?aki_policy=large';
      expect(rewriteUrlForMaxResolution(input)).toContain('aki_policy=xx_large');
    });

    it('replaces im_w=720 with im_w=1440', () => {
      const input = 'https://a0.muscache.com/im/pictures/miso/abc.jpeg?im_w=720';
      expect(rewriteUrlForMaxResolution(input)).toContain('im_w=1440');
    });
  });

  describe('Cloudinary', () => {
    it('replaces transformation segment after /upload/', () => {
      const input = 'https://res.cloudinary.com/demo/image/upload/w_300,h_200,c_fill/sample.jpg';
      const result = rewriteUrlForMaxResolution(input);
      expect(result).toContain('/upload/w_4000,c_limit,q_auto/');
    });
  });

  describe('Imgix', () => {
    it('sets w=4000 and fit=max, removes h', () => {
      const input = 'https://assets.example.imgix.net/photo.jpg?w=300&h=200&fit=clip';
      const result = rewriteUrlForMaxResolution(input);
      const params = new URL(result).searchParams;
      expect(params.get('w')).toBe('4000');
      expect(params.get('fit')).toBe('max');
      expect(params.has('h')).toBe(false);
    });
  });

  describe('Viator / TripAdvisor', () => {
    it('sets w=4000 and h=-1', () => {
      const input = 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/21/66/c5/99/caption.jpg?w=1000&h=-1&s=1';
      const result = rewriteUrlForMaxResolution(input);
      const params = new URL(result).searchParams;
      expect(params.get('w')).toBe('4000');
      expect(params.get('h')).toBe('-1');
      expect(params.get('s')).toBe('1');  // s preserved
    });
  });

  describe('no match', () => {
    it('returns URL unchanged for unknown CDN', () => {
      const input = 'https://example.com/photo.jpg?w=300';
      expect(rewriteUrlForMaxResolution(input)).toBe(input);
    });

    it('returns URL unchanged for invalid URL', () => {
      expect(rewriteUrlForMaxResolution('not-a-url')).toBe('not-a-url');
    });
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|---|---|---|
| Fetch original CDN URL → download thumbnail | Rewrite URL to max-res variant before download | Jennifer gets full-quality images |
| Strip all query params to get "clean" URL | Set specific max-size params (4000px target) | Avoids 20MB+ raw originals; CDNs cap at their own max anyway |
| Convert format on download | Preserve original format (JPG/WebP/AVIF) | No re-encoding quality loss |

---

## Open Questions

1. **GetYourGuide CDN resize parameters**
   - What we know: CDN domain is `cdn.getyourguide.com`
   - What's unclear: Whether dynamic resizing is supported; what parameters control size
   - Recommendation: Inspect actual GYG image URLs in Chrome DevTools (Network tab, filter by `cdn.getyourguide.com`) before implementing the rewrite function. If no resize params found, the CDN-06 requirement becomes "no-op for now — return URL unchanged."

2. **Airbnb aki_policy exhaustive value list**
   - What we know: `large`, `x_large`, `xx_large` confirmed from community sources. `xx_large` corresponds to 1440px (Airbnb's documented max output).
   - What's unclear: Whether `xxx_large` or similar exists beyond `xx_large`
   - Recommendation: Use `xx_large` as the target. If a live test shows the image is still small, inspect the actual URL in DevTools.

3. **Cloudinary chained transformation handling**
   - What we know: The regex replaces the first transformation segment
   - What's unclear: Whether any of the target sites use chained Cloudinary transformations
   - Recommendation: Implement the simple single-segment replacement first. If tests with real URLs fail, the pattern can be extended.

4. **Fastly-specific site**
   - What we know: Fastly IO uses `?width=` params; max is 8192px
   - What's unclear: Which specific Jennifer-used site runs Fastly IO
   - Recommendation: Include Fastly in the CDN list but only activate detection if a specific hostname is confirmed during implementation/testing.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | None (vitest config via package.json `"test": "vitest run"`) |
| Quick run command | `npx vitest run tests/unit/cdnRewrite.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CDN-01 | Booking.com max-dimension path rewrite | unit | `npx vitest run tests/unit/cdnRewrite.test.ts` | ❌ Wave 0 |
| CDN-02 | Airbnb aki_policy and im_w rewrite | unit | `npx vitest run tests/unit/cdnRewrite.test.ts` | ❌ Wave 0 |
| CDN-03 | Cloudinary w_ transform rewrite | unit | `npx vitest run tests/unit/cdnRewrite.test.ts` | ❌ Wave 0 |
| CDN-04 | Imgix w= param rewrite | unit | `npx vitest run tests/unit/cdnRewrite.test.ts` | ❌ Wave 0 |
| CDN-05 | Viator w= h=-1 rewrite | unit | `npx vitest run tests/unit/cdnRewrite.test.ts` | ❌ Wave 0 |
| CDN-06 | GetYourGuide stub (no-op pending inspection) | unit | `npx vitest run tests/unit/cdnRewrite.test.ts` | ❌ Wave 0 |
| CDN-07 | Fastly width= rewrite | unit | `npx vitest run tests/unit/cdnRewrite.test.ts` | ❌ Wave 0 |
| CDN-08 | Fallback to original URL when rewrite fails | unit | `npx vitest run tests/unit/cdnRewrite.test.ts` | ❌ Wave 0 |
| CDN-09 | No rewrite during scan/thumbnail phase | manual | Visual inspection — thumbnails use original URLs | N/A |
| CDN-01..08 | No-match URLs returned unchanged | unit | `npx vitest run tests/unit/cdnRewrite.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/unit/cdnRewrite.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/cdnRewrite.test.ts` — covers CDN-01 through CDN-08; use fixture URLs documented in this research
- [ ] `lib/cdnRewrite.ts` — the module under test (create in Wave 0 with stubs before writing tests)

---

## Sources

### Primary (HIGH confidence)

- **cloudinary.com/documentation** — Transformation URL format, w_, h_, c_limit, c_fill, q_auto parameters
- **docs.imgix.com/en-US/apis/rendering** — w parameter, fit parameter, 8192px max dimension
- **www.fastly.com/documentation/reference/io/width/** — width parameter, 8192px max, URL examples
- **techdocs.akamai.com/ivm/docs/imquery** — IMQuery format, Resize transformation syntax
- **bstatic.com** (Booking.com developer API) — max10000x10000 confirmed as full-resolution endpoint
- **partnerresources.viator.com** — Viator Partner API photo URL format (w=, h=, s= params)

### Secondary (MEDIUM confidence)

- **scrapfly.io/blog/posts/how-to-scrape-bookingcom** — Booking.com bstatic.com URL path pattern examples (`max1024x768`, `max500`)
- **medium.com/@samcrawford/airbnb-slow-loading** — Airbnb muscache.com URL patterns, im_w parameter
- **community.withairbnb.com** — Airbnb max output 1440x960px, xx_large policy value
- **TripAdvisor scraping community (GitHub/Apify)** — dynamic-media-cdn.tripadvisor.com w/h/s params

### Tertiary (LOW confidence)

- **code.getyourguide.com/partner-api-spec** — Only CDN domain (`cdn.getyourguide.com`) identified; no resize parameter pattern
- **Search results for GetYourGuide imgix** — Indirect evidence GYG may use Imgix; not confirmed

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new dependencies; native URL API
- Booking.com CDN pattern: HIGH — confirmed from Booking.com API docs and scraping community
- Airbnb CDN pattern: MEDIUM-HIGH — im_w confirmed from multiple sources; aki_policy values confirmed from community but not official docs
- Cloudinary pattern: HIGH — official docs
- Imgix pattern: HIGH — official docs
- Viator/TripAdvisor pattern: HIGH — Viator partner API docs + confirmed in scraping examples
- GetYourGuide pattern: LOW — CDN domain only, no resize params found
- Fastly pattern: HIGH (API) — but no confirmed Jennifer-used site found
- Akamai IM pattern: MEDIUM — official docs, but muscache.com uses Airbnb-specific schema not Akamai IM query syntax
- Architecture patterns: HIGH — based on existing codebase patterns
- Fallback pattern: HIGH — fits directly into existing Promise.allSettled pattern

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (CDN URL schemas are stable; Airbnb aki_policy most likely to change)
