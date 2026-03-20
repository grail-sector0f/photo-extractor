---
phase: 02-image-extraction
plan: 01
subsystem: extraction
tags: [typescript, vitest, jsdom, dom, srcset, css-backgrounds]

requires:
  - phase: 01-foundation
    provides: vitest config, tests/setup.ts chrome mocks, lib/ module structure

provides:
  - lib/extract/types.ts — ImageResult interface shared by all extractors
  - lib/extract/srcsetParser.ts — parseSrcset() returning highest-res URL from srcset attributes
  - lib/extract/imgTags.ts — extractImgTags() scanning <img> elements with filtering
  - lib/extract/cssBackgrounds.ts — extractCssBackgrounds() scanning CSS background-image properties
  - 30 unit tests covering EXTR-01, EXTR-02, EXTR-04

affects: [02-02, content-script wiring, scan session orchestration]

tech-stack:
  added: [jsdom@26.x (dev dep — required by vitest 3.x for jsdom environment)]
  patterns:
    - TDD red-green cycle for each module before implementation
    - Object.defineProperty to override read-only HTMLImageElement properties in tests
    - vi.spyOn(window, 'getComputedStyle') per-test mocking for CSS background tests
    - Shared ImageResult interface for cross-module type consistency
    - Set<string> deduplication pattern for URL results

key-files:
  created:
    - lib/extract/types.ts
    - lib/extract/srcsetParser.ts
    - lib/extract/imgTags.ts
    - lib/extract/cssBackgrounds.ts
    - tests/unit/srcsetParser.test.ts
    - tests/unit/imgTags.test.ts
    - tests/unit/cssBackgrounds.test.ts

key-decisions:
  - "jsdom installed as dev dep to unblock vitest 3.x environment initialization (vitest 3.x tries to import jsdom at startup even for non-jsdom tests)"
  - "parseSrcset prefers w-descriptors over x-descriptors when both appear in same srcset string"
  - "extractImgTags falls back to img.width/height when img.complete is false, preventing valid large photos from being dropped mid-load"
  - "extractCssBackgrounds uses getBoundingClientRect as dimension proxy (CSS backgrounds have no naturalWidth)"
  - "URL_REGEX.lastIndex reset before each element to avoid stateful /g flag corruption across elements"

patterns-established:
  - "Pattern: @vitest-environment jsdom comment at top of test files that need DOM APIs"
  - "Pattern: Object.defineProperty(img, 'naturalWidth', { configurable: true }) for read-only DOM property overrides"
  - "Pattern: vi.spyOn(window, 'getComputedStyle') with target-based branching for CSS mock isolation"
  - "Pattern: Set<string> seen-URLs deduplication inside extractor functions"

requirements-completed: [EXTR-01, EXTR-02, EXTR-04]

duration: 5min
completed: 2026-03-20
---

# Phase 2 Plan 1: Core Extraction Modules Summary

**Three pure extraction modules — srcset parser, img tag scanner, CSS background scanner — with shared ImageResult type and 30 unit tests covering EXTR-01, EXTR-02, and EXTR-04.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-20T17:29:26Z
- **Completed:** 2026-03-20T17:33:54Z
- **Tasks:** 3 (all TDD)
- **Files modified:** 7 created, 2 modified (package.json, package-lock.json)

## Accomplishments

- parseSrcset() correctly selects highest-resolution URL from any srcset string (w or x descriptors), returns null on empty/malformed input
- extractImgTags() scans all img elements, filters below 100x100, skips SVGs and blob URLs, resolves srcset to highest-res via parseSrcset, deduplicates
- extractCssBackgrounds() walks all DOM elements, reads getComputedStyle().backgroundImage, handles all url() quote variants and multi-layer backgrounds, filters by rendered element size, deduplicates
- Full test suite: 44 tests across 5 files, all green including Phase 1 tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ImageResult type and srcset parser with tests** - `ad4ed39` (feat)
2. **Task 2: Create img tag extractor with tests** - `a9d090c` (feat)
3. **Task 3: Create CSS background-image extractor with tests** - `2eef993` (feat)

_Note: TDD tasks each followed red (tests written, import fails) → green (implementation passes) cycle._

## Files Created/Modified

- `lib/extract/types.ts` — ImageResult interface: url, sourceType, optional naturalWidth/naturalHeight
- `lib/extract/srcsetParser.ts` — parseSrcset() with w/x descriptor parsing and priority logic
- `lib/extract/imgTags.ts` — extractImgTags() with SVG/blob/dimension filtering and srcset resolution
- `lib/extract/cssBackgrounds.ts` — extractCssBackgrounds() with URL_REGEX exec loop and dimension proxy
- `tests/unit/srcsetParser.test.ts` — 10 tests: w-descriptors, x-descriptors, no-descriptor, empty, whitespace, mixed, tie, malformed
- `tests/unit/imgTags.test.ts` — 10 tests: include large, exclude small/SVG/blob, srcset, fallback dims, dedup, multiple, one-dim fail
- `tests/unit/cssBackgrounds.test.ts` — 10 tests: double-quote, single-quote, unquoted, multi-layer, size filter, SVG, blob, none, dedup, one-dim fail
- `package.json` / `package-lock.json` — jsdom added as dev dependency

## Decisions Made

- jsdom installed as a dev dep. Vitest 3.x attempts to import jsdom during environment discovery at startup, even for test files that don't request it. Without jsdom installed, all test runs fail with ERR_MODULE_NOT_FOUND.
- parseSrcset gives w-descriptors priority over x-descriptors. When both appear in the same srcset string (mixed), w-value candidates are selected first since pixel width is more deterministic than device pixel ratio.
- extractImgTags falls back to img.width/img.height when img.complete is false. This prevents valid large photos that are still downloading at scan time from being incorrectly filtered out.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing jsdom dev dependency**
- **Found during:** Task 1 (first test run)
- **Issue:** Vitest 3.2.4 tries to import jsdom at startup during environment discovery. Without it installed, all vitest runs fail with `Cannot find package 'jsdom'` — even for test files that don't use jsdom environment.
- **Fix:** `npm install --save-dev jsdom`
- **Files modified:** package.json, package-lock.json
- **Verification:** `npx vitest run tests/unit/srcsetParser.test.ts` exits 0 after install
- **Committed in:** ad4ed39 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for any vitest tests to run. No scope creep.

## Issues Encountered

None beyond the jsdom blocking issue documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 02-02 (content script wiring) can now import all three extractors from `lib/extract/`. The extraction logic is tested in isolation. 02-02 will wire extractImgTags() + extractCssBackgrounds() into the content script's SCAN_PAGE handler and add the MutationObserver lifecycle.

---
*Phase: 02-image-extraction*
*Completed: 2026-03-20*
