---
phase: 04-cdn-url-upscaling
plan: 02
subsystem: ui
tags: [cdn, download, fallback, react, typescript, vitest]

requires:
  - phase: 04-01
    provides: rewriteUrlForMaxResolution pure function from lib/cdnRewrite.ts

provides:
  - CDN rewrite wired into App.tsx runDownloads with silent fallback
  - fallback behavior unit tests (identity check pattern)
  - Extension build verified with CDN rewrite integration

affects: [end-to-end download flow, popup/App.tsx, user-visible download quality]

tech-stack:
  added: []
  patterns:
    - "CDN rewrite applied at download time only — thumbnails use original URLs"
    - "Identity check (upscaledUrl === url) to detect whether rewrite occurred, skipping try/catch when no rewrite happened"
    - "Silent fallback: try upscaled, catch and retry with original, propagate only if both fail"
    - "deriveExt called on original URL before any rewrite — file extension from source, not CDN params"

key-files:
  created: []
  modified:
    - entrypoints/popup/App.tsx
    - tests/unit/cdnRewrite.test.ts

key-decisions:
  - "Use upscaledUrl === url identity check as fast path — avoids try/catch overhead for non-CDN images"
  - "dispatch DOWNLOAD_PROGRESS after the download (success or successful fallback), not inside the try block — ensures accurate progress tracking"
  - "If fallback also fails, the error propagates to Promise.allSettled and counts as 1 rejection — no double-counting"

patterns-established:
  - "CDN rewrite + fallback pattern: identity check -> skip try/catch if no rewrite -> try/catch with original URL fallback if rewrite applied"

requirements-completed: [CDN-08, CDN-09]

duration: 8min
completed: 2026-03-20
---

# Phase 04 Plan 02: CDN Integration Summary

**CDN URL rewriting wired into download pipeline with silent fallback — extension compiles and downloads now request highest-resolution CDN variants before falling back to original URLs**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-20T18:59:00Z
- **Completed:** 2026-03-20T19:07:00Z
- **Tasks:** 2 of 3 complete (Task 3 is human-verify checkpoint — awaiting user)
- **Files modified:** 2

## Accomplishments

- Imported `rewriteUrlForMaxResolution` into App.tsx and wired it into `runDownloads`
- Try/catch fallback pattern: attempts upscaled URL first, retries with original on any failure
- `deriveExt` called on original URL before rewrite — preserves file extension from source
- Added 2 fallback behavior tests to cdnRewrite.test.ts confirming identity check is reliable
- Extension builds successfully (173.57 kB, no TypeScript errors)

## Task Commits

1. **Task 1: Wire CDN rewrite into runDownloads with fallback** - `c548b66` (feat)
2. **Task 2: Build extension and verify it loads** - `0047291` (build)
3. **Task 3: Verify CDN upscaling in Chrome on a real travel site** - awaiting human verification

## Files Created/Modified

- `entrypoints/popup/App.tsx` - Added cdnRewrite import and upscale+fallback logic in runDownloads
- `tests/unit/cdnRewrite.test.ts` - Added "fallback behavior (identity check)" describe block (2 tests)

## Decisions Made

- Identity check (`upscaledUrl === url`) used as fast path — avoids unnecessary try/catch for all non-CDN images. This works because `rewriteUrlForMaxResolution` returns the same string reference when no rewrite occurs.
- Progress dispatch placed after download completes (success or fallback success) so the count is accurate.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- CDN rewrite is live in the download pipeline. Human verification (Task 3) confirms real-world behavior on Booking.com and Airbnb.
- After Task 3 approval, Phase 04 is complete.

---
*Phase: 04-cdn-url-upscaling*
*Completed: 2026-03-20 (Tasks 1-2; Task 3 pending human verify)*
