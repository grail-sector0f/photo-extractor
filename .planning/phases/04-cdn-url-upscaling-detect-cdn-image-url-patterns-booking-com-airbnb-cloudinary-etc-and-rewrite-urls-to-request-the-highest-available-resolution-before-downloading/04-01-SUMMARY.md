---
phase: 04-cdn-url-upscaling
plan: 01
subsystem: api
tags: [cdn, url-rewriting, booking-com, airbnb, cloudinary, imgix, viator, getyourguide, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 03-popup-and-naming
    provides: "Download pipeline that accepts URLs — rewriteUrlForMaxResolution will be called before triggering downloads"
provides:
  - "rewriteUrlForMaxResolution pure function — takes any image URL, returns upscaled CDN URL or original unchanged"
  - "Per-CDN rewriters for Booking.com, Airbnb, Cloudinary, Imgix, Viator/TripAdvisor, GetYourGuide stub"
  - "Comprehensive fixture-based unit tests for all 6 CDN patterns (20 tests)"
affects:
  - "04-02 (CDN integration) — will import rewriteUrlForMaxResolution and call it before triggerDownload"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure function URL rewriting — no side effects, no network calls, native URL API only"
    - "Per-CDN private functions routed by hostname.endsWith() / hostname === checks"
    - "try/catch on new URL() to handle malformed inputs without throwing"
    - "TDD fixture-based tests: one describe block per CDN with real-world URL fixtures"

key-files:
  created:
    - lib/cdnRewrite.ts
    - tests/unit/cdnRewrite.test.ts
  modified: []

key-decisions:
  - "Imgix guard uses .endsWith('.imgix.net') with leading dot to prevent notimgix.net false-positive"
  - "Airbnb im_w capped at 1440 — documented maximum for Airbnb image pipeline"
  - "Viator h=-1 is intentional per Viator Partner API — unconstrained height, not a bug"
  - "GetYourGuide is a pass-through stub — resize params unconfirmed, TODO left for DevTools audit"
  - "Fastly IO omitted — no unique domain pattern, false-positive risk too high on generic w/h params"
  - "Cloudinary regex /\\/upload\\/[^/]+\\// replaces first transform segment only, preserves public_id"

patterns-established:
  - "CDN rewriter pattern: hostname check → delegate to private per-CDN function → return url.href"
  - "URL mutation pattern: parse with new URL(), mutate searchParams/pathname, return url.href"

requirements-completed: [CDN-01, CDN-02, CDN-03, CDN-04, CDN-05, CDN-06]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 4 Plan 01: CDN URL Rewriting Module Summary

**Pure function `rewriteUrlForMaxResolution` with hostname-based routing to 6 per-CDN rewriters, covering Booking.com, Airbnb, Cloudinary, Imgix, Viator/TripAdvisor, and a GetYourGuide stub — 20 passing unit tests, no new dependencies.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-21T01:54:14Z
- **Completed:** 2026-03-21T01:57:07Z
- **Tasks:** 1 (TDD: RED + GREEN phases)
- **Files modified:** 2

## Accomplishments

- Created `lib/cdnRewrite.ts` with `rewriteUrlForMaxResolution` as the sole public export
- Wrote 20 fixture-based unit tests across 7 describe blocks before writing any implementation (TDD RED)
- All 20 tests pass; full suite of 141 tests remains green with zero regressions

## Task Commits

1. **RED — Failing tests** — `c7a4fcb` (test)
2. **GREEN — Implementation** — `ce2a420` (feat)

_TDD task: test commit then implementation commit, no separate refactor needed._

## Files Created/Modified

- `lib/cdnRewrite.ts` — Pure function module with per-CDN rewriters and JSDoc on every function
- `tests/unit/cdnRewrite.test.ts` — 20 fixture-based unit tests, one describe block per CDN

## Decisions Made

- Imgix guard uses `.endsWith('.imgix.net')` with a leading dot — prevents `notimgix.net` from false-matching
- Airbnb `im_w` set to `1440` — documented maximum for Airbnb's image pipeline; higher values silently clamp
- Viator `h=-1` is intentional, not a bug — Viator Partner API documents `-1` as "unconstrained height"
- GetYourGuide left as a pass-through stub with a `TODO` comment for DevTools audit before implementing
- Fastly IO deliberately omitted — its only detection signal is generic `width`/`height` query params, which would cause false positives on any site that happens to use those param names

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `rewriteUrlForMaxResolution` is ready to be imported in Plan 04-02 (CDN integration into the download pipeline)
- Call site: import from `@/lib/cdnRewrite`, call before `triggerDownload(url, basename, ext)`
- GetYourGuide stub is production-safe — returns URL unchanged, downloads will still succeed at CDN's default size

---
*Phase: 04-cdn-url-upscaling*
*Completed: 2026-03-20*
