---
phase: 03-popup-and-naming
plan: 02
subsystem: ui
tags: [react, tailwind, chrome-extension, useReducer, chrome-storage, popup]

requires:
  - phase: 03-01
    provides: normalizeField, buildBasename, deriveExt functions in lib/naming.ts
  - phase: 02-image-extraction
    provides: scan-session port protocol, ImageResult type, content script
  - phase: 01-foundation
    provides: DOWNLOAD_FILE message handler in background.ts, chrome.downloads pipeline

provides:
  - Complete popup UI in entrypoints/popup/App.tsx replacing Phase 1 stub
  - popupReducer and initialState exported as named exports for testing
  - 35 unit tests for all reducer state transitions (popup-reducer.test.ts)

affects: [03-03, any future popup changes]

tech-stack:
  added: []
  patterns:
    - useReducer for unified async state (avoids stale closure bugs from multiple useState)
    - Promise.allSettled for batch downloads with partial-failure reporting
    - chrome.runtime.connect scan-session port wiring from popup to content script
    - chrome.storage.local pre-fill on mount + persist after download

key-files:
  created:
    - entrypoints/popup/App.tsx (full popup UI — 390+ lines, all components inline)
    - tests/unit/popup-reducer.test.ts (35 reducer unit tests)
  modified: []

key-decisions:
  - "Bottom section (selection bar + form + download button) only visible after scan returns images — not shown in idle/scanning/empty/timeout states"
  - "runDownloads only persists to chrome.storage.local when at least 1 download succeeded (saved > 0)"
  - "Image placeholder error handler uses display:none on the img and shows sibling div — avoids broken image icon"

patterns-established:
  - "Pattern: export reducer + initialState as named exports for direct unit testing without React rendering"
  - "Pattern: all popup state transitions in a single reducer — scan, selection, form fields, download progress"
  - "Pattern: startScan returns a cleanup function (clearTimeout + port.disconnect) for correct teardown"

requirements-completed: [UI-01, UI-02, UI-03, UI-04, NAME-01, NAME-02, NAME-03, NAME-04, NAME-05]

duration: 5min
completed: 2026-03-20
---

# Phase 03 Plan 02: Popup UI Summary

**React popup with useReducer state machine, 3-column thumbnail grid, scan port wiring, parallel batch downloads via Promise.allSettled, and chrome.storage.local pre-fill**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-20T18:55:43Z
- **Completed:** 2026-03-20T18:58:16Z (tests green)
- **Tasks:** 1 (TDD: RED test file + GREEN implementation)
- **Files modified:** 2

## Accomplishments
- Full popup UI replaces Phase 1 stub — all 9 requirements (UI-01 through NAME-05) implemented
- 35 reducer unit tests covering every action type and state transition
- All 121 tests across the full suite pass green

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement popup reducer and test state transitions** - `c012962` (feat)

**Plan metadata:** (added with this summary)

## Files Created/Modified
- `entrypoints/popup/App.tsx` - Complete popup UI: useReducer, 7 inline components, scan port wiring, download wiring, pre-fill on mount
- `tests/unit/popup-reducer.test.ts` - 35 unit tests for all reducer state transitions

## Decisions Made
- Bottom section (selection bar + naming form + download button) is only shown when `scanStatus === 'done'` and `images.length > 0`. When scanning, empty, or timed out, only the header and thumbnail grid region show.
- `runDownloads` persists to `chrome.storage.local` only when `saved > 0`. If all downloads failed, last-used values are not overwritten.
- Image load errors handled inline: `onError` hides the `<img>` and shows a sibling `<div>` placeholder with "?" text — avoids the broken image icon without complex state.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The test setup already had `chrome.storage.local` mocked (added in Plan 01), so no mock gap was hit. All 35 reducer tests passed after initial App.tsx implementation.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Popup UI complete. Phase 3 has one remaining plan (03-03).
- All 9 Phase 3 requirements implemented in this plan.
- Full test suite green (121 tests).
- The popup can be loaded in Chrome dev mode for manual end-to-end verification.

---
*Phase: 03-popup-and-naming*
*Completed: 2026-03-20*
