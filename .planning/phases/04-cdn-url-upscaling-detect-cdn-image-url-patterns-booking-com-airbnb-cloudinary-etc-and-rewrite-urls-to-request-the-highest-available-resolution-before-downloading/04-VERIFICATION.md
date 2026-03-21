---
phase: 04-cdn-url-upscaling
verified: 2026-03-20T21:00:00Z
status: human_needed
score: 13/14 must-haves verified
human_verification:
  - test: "Load extension in Chrome, open a Booking.com hotel page, scan page, download 2-3 photos, confirm downloaded files are higher resolution than the thumbnails displayed in the popup grid"
    expected: "Downloaded images are noticeably larger in dimensions than the CDN thumbnail sizes shown on the page. No console errors in the popup inspector."
    why_human: "Resolution improvement from CDN URL rewriting cannot be verified programmatically without making actual HTTP requests to Booking.com's CDN. The code is correct but the real-world effect requires a live test."
  - test: "Repeat the above on an Airbnb listing page (muscache.com URLs). Confirm higher-resolution downloads."
    expected: "Downloaded images are higher resolution than what the page displays. aki_policy or im_w rewrite is in effect."
    why_human: "Same reason as above — real CDN response needed to confirm the rewrite produces a larger image, not a 404."
  - test: "Force a rewritten URL to fail (e.g., load extension on Booking.com, intercept a download in DevTools Network panel and confirm the fallback to original URL occurs when the upscaled URL returns 404)"
    expected: "Image downloads successfully using the original URL. The 'Saved N photos' count is not decremented for the retried image."
    why_human: "Fallback behavior requires a failing CDN response which cannot be simulated in unit tests without network access."
---

# Phase 4: CDN URL Upscaling Verification Report

**Phase Goal:** When Jennifer downloads photos, the extension detects known CDN URL patterns (Booking.com, Airbnb, Cloudinary, Imgix, Viator/TripAdvisor) and rewrites URLs to request the highest available resolution — so she gets full-quality images instead of thumbnail-sized versions.

**Verified:** 2026-03-20T21:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Booking.com bstatic.com URLs are rewritten to max10000x10000 | VERIFIED | `rewriteBooking` replaces `/max\d+(x\d+)?/` with `/max10000x10000/`; 4 passing tests |
| 2 | Airbnb muscache.com URLs are rewritten to xx_large or im_w=1440 | VERIFIED | `rewriteAirbnb` sets aki_policy=xx_large or im_w=1440; 4 passing tests |
| 3 | Cloudinary URLs are rewritten to w_4000,c_limit,q_auto | VERIFIED | `rewriteCloudinary` replaces first transform segment; 3 passing tests |
| 4 | Imgix URLs are rewritten to w=4000 and fit=max with h removed | VERIFIED | `rewriteImgix` sets w=4000, deletes h, sets fit=max; 3 passing tests including notimgix.net guard |
| 5 | Viator/TripAdvisor URLs are rewritten to w=4000 and h=-1 | VERIFIED | `rewriteViator` sets w=4000 and h=-1; 2 passing tests covering both subdomains |
| 6 | GetYourGuide URLs pass through unchanged (documented stub) | VERIFIED | `rewriteGetYourGuide` returns url.href unchanged with TODO comment; 1 passing test |
| 7 | Unknown CDN URLs pass through unchanged | VERIFIED | No CDN match returns rawUrl; 1 passing test |
| 8 | Invalid URLs pass through unchanged without throwing | VERIFIED | try/catch on `new URL()` returns rawUrl on parse failure; 2 passing tests (empty string, "not-a-url") |
| 9 | CDN rewrite applied at download time only, not during scan or thumbnail display | VERIFIED | `rewriteUrlForMaxResolution` is only called at line 311 inside `runDownloads()` in App.tsx; not called in scan path, content script, or thumbnail rendering |
| 10 | If a rewritten URL fails, the original URL is tried as fallback | VERIFIED | try/catch in `runDownloads`: catches failure from `sendDownloadMessage(upscaledUrl...)` and retries with `sendDownloadMessage(url...)` |
| 11 | A rewrite failure + successful fallback counts as 0 failures in UI | VERIFIED | `dispatch({ type: 'DOWNLOAD_PROGRESS' })` fires after the fallback succeeds; error propagates to `Promise.allSettled` only if both fail |
| 12 | If both rewritten and original URLs fail, counts as exactly 1 failure | VERIFIED | Fallback `await sendDownloadMessage(url...)` throws, caught by `Promise.allSettled` as 1 rejected result; no double-counting |
| 13 | deriveExt uses the original URL, not the rewritten URL | VERIFIED | Line 310: `const ext = deriveExt(url)` called before line 311: `const upscaledUrl = rewriteUrlForMaxResolution(url)` |
| 14 | Downloading from Booking.com/Airbnb produces higher-resolution images than page thumbnails | NEEDS HUMAN | Code is correct; actual resolution improvement requires live CDN response verification |

**Score:** 13/14 truths verified (1 requires human)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/cdnRewrite.ts` | Pure function `rewriteUrlForMaxResolution` with per-CDN rewriters | VERIFIED | 234 lines, exports `rewriteUrlForMaxResolution`, 6 per-CDN private functions, JSDoc on all functions |
| `tests/unit/cdnRewrite.test.ts` | Fixture-based unit tests for all CDN patterns | VERIFIED | 229 lines, 22 tests across 8 describe blocks, all passing |
| `entrypoints/popup/App.tsx` | runDownloads with CDN rewrite + fallback wrapper | VERIFIED | Import at line 27, integration at lines 308-329, correct ordering of ext derivation and rewrite |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tests/unit/cdnRewrite.test.ts` | `lib/cdnRewrite.ts` | `import { rewriteUrlForMaxResolution } from '@/lib/cdnRewrite'` | WIRED | Line 18 of test file; 22 tests exercise the import |
| `entrypoints/popup/App.tsx` | `lib/cdnRewrite.ts` | `import { rewriteUrlForMaxResolution } from '../../lib/cdnRewrite'` | WIRED | Line 27; called at line 311 inside runDownloads |
| `entrypoints/popup/App.tsx` | `lib/download.ts` (via background) | `sendDownloadMessage` called with both upscaledUrl and original url in fallback | WIRED | Lines 315, 319, 323; pattern matches plan spec |

---

### Requirements Coverage

CDN requirement IDs (CDN-01 through CDN-09) are defined in `04-RESEARCH.md`, the phase's own research document. They are referenced in `04-01-PLAN.md`, `04-02-PLAN.md`, and `ROADMAP.md`. They do NOT appear in `.planning/REQUIREMENTS.md`, which only covers v1 requirements (EXTR-*, NAME-*, UI-*, STOR-*). This is a documentation gap — the CDN requirements were created as phase-specific research artifacts rather than top-level project requirements.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CDN-01 | 04-01-PLAN.md | Rewrite Booking.com bstatic.com URLs to max-resolution variant | SATISFIED | `rewriteBooking` with `/max10000x10000/` rewrite; 4 tests pass |
| CDN-02 | 04-01-PLAN.md | Rewrite Airbnb muscache.com URLs to largest available size | SATISFIED | `rewriteAirbnb` with aki_policy=xx_large and im_w=1440; 4 tests pass |
| CDN-03 | 04-01-PLAN.md | Rewrite Cloudinary URLs to w_4000 variant | SATISFIED | `rewriteCloudinary` with `/upload/w_4000,c_limit,q_auto/`; 3 tests pass |
| CDN-04 | 04-01-PLAN.md | Rewrite Imgix URLs to w=4000 variant | SATISFIED | `rewriteImgix` with w=4000, h removed, fit=max; 3 tests pass |
| CDN-05 | 04-01-PLAN.md | Rewrite Viator/TripAdvisor URLs to w=4000 | SATISFIED | `rewriteViator` with w=4000, h=-1; 2 tests pass |
| CDN-06 | 04-01-PLAN.md | GetYourGuide URL rewriting (stub pending DevTools audit) | SATISFIED (stub) | Pass-through stub with TODO comment per plan spec; 1 test passes |
| CDN-07 | NOT CLAIMED | Fastly IO rewriting | NOT IN SCOPE | Deliberately omitted per plan decision — false-positive risk too high. CDN-07 is not in any plan's `requirements` field. Omission is intentional and documented. |
| CDN-08 | 04-02-PLAN.md | Silent fallback to original URL when rewritten URL fails | SATISFIED | try/catch in runDownloads retries with original URL; fallback behavior tests added |
| CDN-09 | 04-02-PLAN.md | CDN rewrite applied at download time only, not during scan/thumbnail display | SATISFIED | `rewriteUrlForMaxResolution` called only inside runDownloads; not present in scan path or content script |

**Note on CDN-07 (Fastly):** This ID appears in RESEARCH.md but is not claimed by either plan's `requirements` field. The omission is an intentional architectural decision documented in both the RESEARCH.md and plan decisions: Fastly IO has no unique domain pattern and relying on generic width/height query params creates unacceptable false-positive risk. This is not an orphaned gap — it is a scoped-out requirement with documented rationale.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/cdnRewrite.ts` | 225-226 | `TODO: GetYourGuide resize params unknown` | Info | Intentional — GetYourGuide stub is documented as pending DevTools audit. The stub is production-safe: URLs still download at CDN default size. |

No blocker or warning anti-patterns found. The GetYourGuide TODO is by design.

---

### Human Verification Required

#### 1. Booking.com higher-resolution download

**Test:** Load the extension in Chrome. Navigate to any Booking.com hotel page. Click the extension icon, scan the page, select 2-3 photos, and download. Open the downloaded files and compare their pixel dimensions to what is visible in the popup thumbnail grid.

**Expected:** Downloaded images have noticeably higher pixel dimensions than the CDN thumbnails shown on the page. No console errors in the popup (right-click popup > Inspect > Console).

**Why human:** Verifying that `/max10000x10000/` returns a larger image requires an actual HTTP request to Booking.com's CDN. The URL rewrite logic is correct; the CDN response cannot be verified without a live network call.

#### 2. Airbnb higher-resolution download

**Test:** Same steps as above on an Airbnb listing page (muscache.com URLs).

**Expected:** Downloaded images are higher resolution than page thumbnails. aki_policy or im_w rewrite is in effect.

**Why human:** Same reason — real CDN response required.

#### 3. Fallback behavior on a failing rewritten URL

**Test:** This is an advanced test. In Chrome DevTools (Network tab), intercept the upscaled CDN URL request during download and simulate a 404 (or use a staging URL that you know returns 404). Confirm the download still succeeds and "Saved N photos" count is correct.

**Expected:** Image downloads via the original URL. Success count is not penalized for the failed rewrite attempt.

**Why human:** Fallback logic requires a network failure to trigger. The code path is correct but only exercisable with real network conditions or a mock server.

---

### Gaps Summary

No automated gaps found. All code-verifiable must-haves pass:

- `lib/cdnRewrite.ts` is substantive (234 lines, 6 CDN rewriters, full JSDoc), correctly implements all 6 CDN patterns
- `tests/unit/cdnRewrite.test.ts` is substantive (229 lines, 22 tests across 8 describe blocks), all 22 tests pass
- `entrypoints/popup/App.tsx` is correctly wired: import present, `deriveExt(url)` called before `rewriteUrlForMaxResolution(url)`, identity check (`upscaledUrl === url`) as fast path, try/catch fallback for CDN rewrites
- Full test suite (143 tests) is green with zero regressions
- Build output `.output/chrome-mv3/manifest.json` exists (confirmed from commit `0047291`)
- CDN-07 (Fastly) is intentionally out of scope — not an oversight

The only outstanding item is live-CDN human verification that the URL rewrites actually produce higher-resolution images when served by Booking.com and Airbnb.

**Documentation note:** CDN requirements (CDN-01 through CDN-09) exist only in phase-level research docs and the ROADMAP, not in `.planning/REQUIREMENTS.md`. This is not a defect in the implementation but is a traceability gap if requirements need to be tracked at the project level in a future update.

---

_Verified: 2026-03-20T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
