---
phase: 02-image-extraction
plan: 02
subsystem: testing
tags: [chrome-extension, content-script, mutation-observer, port-messaging, typescript, vitest, jsdom]

requires:
  - phase: 02-01
    provides: extractImgTags, extractCssBackgrounds, parseSrcset, ImageResult type

provides:
  - Full content script with port lifecycle, scan orchestration, and MutationObserver
  - handleScanSession(port) exported function for testability without WXT wrapper
  - processImg(img, seenUrls) exported function for observer filtering path tests
  - Port mock infrastructure in tests/setup.ts (createMockPort with simulate helpers)
  - contentScript.test.ts covering orchestration wiring and observer lifecycle
  - mutationObserver.test.ts covering processImg filtering and full DOM mutation integration

affects: [03-popup-ui, future-phases-consuming-content-script]

tech-stack:
  added: []
  patterns:
    - Long-lived port pattern (chrome.runtime.onConnect) connecting popup lifecycle to MutationObserver teardown
    - Export internal functions (handleScanSession, processImg) for test-only access without WXT wrapper
    - defineContentScript global stub in tests/setup.ts to allow content.ts imports in jsdom
    - createMockPort factory with _simulateMessage/_simulateDisconnect test helpers
    - Deduplication via shared Set<string> across initial scan and all observer hits

key-files:
  created:
    - entrypoints/content.ts (replaced stub with full implementation)
    - tests/unit/contentScript.test.ts
    - tests/unit/mutationObserver.test.ts
  modified:
    - tests/setup.ts (added onConnect mock, connect mock, createMockPort, defineContentScript stub)

key-decisions:
  - "defineContentScript global stub added to tests/setup.ts so content.ts module loads in jsdom without WXT runtime"
  - "handleScanSession and processImg exported as named exports from content.ts to enable direct unit testing"
  - "blobCount approximated via document.querySelectorAll('img[src^=blob:]').length after initial scan"

patterns-established:
  - "WXT globals that aren't available in test context (defineContentScript) get no-op stubs in tests/setup.ts"
  - "Content script logic extracted from defineContentScript main() into exported functions for testability"
  - "createMockPort factory in tests/setup.ts as the standard way to test port-based messaging"

requirements-completed: [EXTR-03, EXTR-04]

duration: 3min
completed: 2026-03-20
---

# Phase 02 Plan 02: Content Script Port Lifecycle and MutationObserver Summary

**Long-lived port scan session wired into content.ts: SCAN_PAGE triggers extractImgTags + extractCssBackgrounds, MutationObserver streams IMAGE_FOUND for lazy-loaded images, observer disconnects when popup closes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T17:36:38Z
- **Completed:** 2026-03-20T17:40:14Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Content script is no longer a stub — full scan + observe lifecycle implemented
- 62 tests pass across 7 test files (Phase 1 + Phase 2 full suite)
- EXTR-03 and EXTR-04 coverage confirmed on the observer path via non-mocked parseSrcset integration tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend chrome mock and write content script tests (RED)** - `e74bd4e` (test)
2. **Task 2: Implement content script with port lifecycle and MutationObserver** - `45d954f` (feat)
3. **Task 3: MutationObserver integration tests for filtering path** - `f4f9897` (test)

_Note: Task 1 is the TDD RED phase (tests written before implementation)._

## Files Created/Modified

- `entrypoints/content.ts` - Full content script: port lifecycle, scan orchestration, MutationObserver, processImg filtering
- `tests/setup.ts` - Added onConnect mock, connect mock, createMockPort factory, defineContentScript stub
- `tests/unit/contentScript.test.ts` - 6 tests covering scan trigger, SCAN_RESULT shape, IMAGE_FOUND, observer disconnect, port name filter, deduplication
- `tests/unit/mutationObserver.test.ts` - 12 tests covering processImg (100x100, SVG, blob, srcset w/x descriptors, dedup) and full DOM mutation integration

## Decisions Made

- **defineContentScript stub in tests/setup.ts:** WXT's `defineContentScript` is a build-time global not available in jsdom. Added a no-op stub `(globalThis).defineContentScript = (def) => def` so importing content.ts in tests doesn't throw. The stub returns the definition object unchanged — WXT never sees it during tests, but the named exports (handleScanSession, processImg) are accessible.
- **blobCount approximation:** extractImgTags and extractCssBackgrounds log blobs but don't return a count. For Phase 2, blobCount is approximated by querying `img[src^="blob:"]` after the initial scan. CSS blobs are logged but not counted. Accepted limitation per plan spec.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added defineContentScript global stub to tests/setup.ts**
- **Found during:** Task 2 (first test run after writing content.ts)
- **Issue:** `defineContentScript is not defined` — WXT global doesn't exist in jsdom test environment. Content.ts imports failed to load at module evaluation time.
- **Fix:** Added `(globalThis as any).defineContentScript = (definition) => definition` no-op to tests/setup.ts before other content.ts-importing tests run.
- **Files modified:** tests/setup.ts
- **Verification:** All 6 contentScript tests pass; all 62 total tests pass.
- **Committed in:** `45d954f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for the test environment to load content.ts. No scope creep — the stub does nothing at runtime.

## Issues Encountered

None beyond the defineContentScript blocking issue documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Content script fully implemented and tested. Phase 3 (popup UI) can wire up `chrome.runtime.connect({ name: 'scan-session' })` and handle SCAN_RESULT / IMAGE_FOUND messages per the protocol defined here.
- processImg and handleScanSession are exported for future test reuse if Phase 3 needs to test end-to-end message flows.
- Blob URL frequency on Viator/GetYourGuide still unknown — Phase 3 UI should surface the blobCount from SCAN_RESULT payload.

---
*Phase: 02-image-extraction*
*Completed: 2026-03-20*
