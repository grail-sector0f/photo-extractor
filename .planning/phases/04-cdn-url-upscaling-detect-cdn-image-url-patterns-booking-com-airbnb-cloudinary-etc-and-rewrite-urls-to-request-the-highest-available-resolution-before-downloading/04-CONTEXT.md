# Phase 4: CDN URL Upscaling - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

When the extension extracts an image URL from a travel site, that URL often already contains resize parameters baked in by the CDN (e.g., `max300x200`, `w_720`, `c_fill,h_480`). This phase adds a URL rewriting layer that detects known CDN patterns and rewrites those URLs to request the highest available resolution before the download is triggered — so Jennifer gets a full-size photo instead of the thumbnail-sized version the page was displaying.

Scope: URL detection + rewriting logic only. No changes to extraction (content script), thumbnail display, or naming. The rewrite happens at download time, transparently, with silent fallback to the original URL if the rewrite fails.

</domain>

<decisions>
## Implementation Decisions

### CDN target list
- Support all major travel CDNs in v1: Booking.com, Cloudinary (used by Airbnb), Imgix, Akamai Image Manager, Fastly
- Also explicitly cover GetYourGuide and Viator — Jennifer uses these sites regularly (per PROJECT.md)
- Researcher should audit which CDN each Jennifer-used site actually runs on (Viator and GetYourGuide CDN patterns may or may not match the five above)
- If GetYourGuide or Viator use a CDN not already in the list, add that CDN as a target

### Resolution strategy
- Request a large fixed max size — 4000px wide (or the CDN-specific equivalent) — rather than stripping all params
- Rationale: stripping all params risks 20MB+ raw originals; a 4000px request gets high-quality output without absurd file sizes. Most CDNs serve their actual maximum if you request more than they have.
- Preserve the original image format (JPG, WebP, AVIF) — do not force conversion to JPG
- Rationale: tern.travel supports WebP natively (per REQUIREMENTS.md), and preserving format avoids re-encoding quality loss

### Where the rewrite happens
- Rewrite at download time only — just before `chrome.downloads.download` is triggered
- Thumbnails in the popup grid show the original extracted URL (as today) — no extra network requests during scan
- The rewrite is applied to the URL passed to `triggerDownload()` in `lib/download.ts` (or injected at the callsite in `App.tsx` before calling `triggerDownload`)

### Fallback on rewrite failure
- If a rewritten URL returns a 404 or fails to download: silently fall back to the original extracted URL
- No UI change — Jennifer sees the normal "Saved N photos" success or the existing "Saved X of N — Y failed" partial failure message
- A rewrite failure is not counted as a download failure as long as the fallback succeeds

### Claude's Discretion
- Exact regex or URL parsing approach per CDN (URL manipulation vs. regex replacement vs. URLSearchParams)
- How to structure the CDN rewriter module (one function per CDN, or a table of pattern → transform rules)
- Whether to validate rewritten URL format before attempting the download (basic sanity check)
- Test strategy for CDN URL patterns (unit tests with fixture URLs from each CDN)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing download pipeline
- `lib/download.ts` — `triggerDownload(url, basename, ext)` and `buildSafeFilename` — the integration point where CDN rewriting will be applied
- `lib/keepalive.ts` — SW keepalive; called automatically by `triggerDownload`, no changes needed

### Existing extraction pipeline (read-only — no changes in this phase)
- `entrypoints/content.ts` — Scan protocol and ImageResult creation; rewriting happens downstream, not here
- `lib/extract/types.ts` — `ImageResult` type: `{ url, sourceType, naturalWidth, naturalHeight }`
- `lib/extract/imgTags.ts` — Current URL resolution logic (srcset, data-src, etc.)

### Popup download callsite
- `entrypoints/popup/App.tsx` — Where `triggerDownload` is called per selected image; CDN rewrite will be applied here or wrapped into `triggerDownload`

### Project requirements
- `.planning/REQUIREMENTS.md` — EXTR-04 (highest-resolution srcset selection, already complete); no new requirements defined yet for this phase — researcher should propose requirement IDs
- `.planning/ROADMAP.md` — Phase 4 goal and depends-on (Phase 3)

### Prior phase context
- `.planning/phases/03-popup-and-naming/03-CONTEXT.md` — Download pipeline decisions, batch download mechanics, error message format ("Saved X of N — Y failed")
- `.planning/phases/02-image-extraction/02-CONTEXT.md` — ImageResult type, scan protocol, blob URL handling

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/download.ts` — `triggerDownload(url, basename, ext)`: the URL parameter is where CDN rewriting applies. Either rewrite before calling, or wrap inside a new `triggerDownloadWithUpscale()` helper.
- `lib/extract/srcsetParser.ts` — Already handles srcset resolution to highest-res URL. CDN rewriting is a complementary step that runs after srcset resolution.

### Established Patterns
- **URL resolution**: `new URL(raw, document.baseURI).href` pattern is used throughout extraction — CDN rewriter should work with absolute URLs (already the case by the time downloads are triggered)
- **Async download**: `triggerDownload` is async; a CDN URL fetch/validation step can be added without changing the calling interface
- **Error handling**: existing batch download tracks failures via `Promise.allSettled` in `App.tsx` — fallback logic fits naturally into this pattern

### Integration Points
- `entrypoints/popup/App.tsx` — `runDownloads` function builds the URL array and calls `triggerDownload` per image. CDN rewrite can be applied here before the call, or inside a wrapper.
- New module: `lib/cdnRewrite.ts` (suggested) — contains CDN detection + URL rewriting logic, importable by `App.tsx` or `download.ts`

</code_context>

<specifics>
## Specific Ideas

- Sites Jennifer uses that must work: Booking.com, Airbnb, GetYourGuide, Viator (all named in PROJECT.md)
- Researcher should look up actual CDN URL patterns for each site — Viator and GetYourGuide are not documented in the codebase yet
- 4000px is the target max; if a CDN has a lower documented max, use that instead of requesting 4000

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-cdn-url-upscaling*
*Context gathered: 2026-03-20*
