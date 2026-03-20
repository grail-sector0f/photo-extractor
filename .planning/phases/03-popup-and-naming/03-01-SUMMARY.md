---
phase: 03-popup-and-naming
plan: 01
subsystem: testing
tags: [typescript, vitest, naming, filename, chrome-storage]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: triggerDownload(url, basename, ext) signature that naming output feeds into
  - phase: 02-image-extraction
    provides: ImageResult type with url field that deriveExt receives
provides:
  - normalizeField, buildBasename, deriveExt pure functions in lib/naming.ts
  - chrome.storage.local mock in tests/setup.ts for Phase 3 popup tests
  - defineBackground global stub in tests/setup.ts
affects: [03-02-popup-ui, 03-03-download-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Filename segment normalization: trim → lowercase → spaces-to-hyphens → strip-non-alphanum → collapse-double-hyphens"
    - "Extension derivation: parse URL.pathname, extract last dot segment, allowlist known extensions, fall back to jpg"
    - "TDD: tests written first (RED), then implementation (GREEN), then fix applied"

key-files:
  created:
    - lib/naming.ts
    - (tests/unit/naming.test.ts extended — was existing buildSafeFilename tests)
  modified:
    - tests/unit/naming.test.ts
    - tests/setup.ts

key-decisions:
  - "normalizeField collapses consecutive hyphens (e.g. from '& ' → '--') to a single hyphen for cleaner slugs"
  - "deriveExt allowlists only jpg/jpeg/png/webp/gif/avif — all other extensions fall back to jpg"
  - "chrome.storage.local mock resets in beforeEach to prevent test bleed between popup tests"
  - "defineBackground global stub added alongside defineContentScript for completeness"

patterns-established:
  - "Pattern: normalizeField pipeline — trim, lowercase, spaces→hyphens, strip specials, collapse double-hyphens"
  - "Pattern: deriveExt — URL.pathname + lastIndexOf('.') + allowlist check + try/catch fallback"

requirements-completed: [NAME-01, NAME-02, NAME-03, NAME-04, NAME-05]

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 3 Plan 01: Naming Utilities Summary

**Three pure naming functions (normalizeField, buildBasename, deriveExt) in lib/naming.ts with 31 tests, plus chrome.storage.local mock unblocking Phase 3 popup tests**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-20T18:50:42Z
- **Completed:** 2026-03-20T18:52:40Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `lib/naming.ts` with three exported pure functions covering the full NAME-01 through NAME-05 filename format
- Extended `tests/unit/naming.test.ts` with 24 new test cases (8 for normalizeField, 6 for buildBasename, 10 for deriveExt) — all pass
- Updated `tests/setup.ts` to add `chrome.storage.local` mock and `defineBackground` stub, unblocking Plan 02 popup tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/naming.ts with normalizeField, buildBasename, and deriveExt** - `ad79c70` (feat)
2. **Task 2: Add chrome.storage.local mock to test setup** - `f0c0a7c` (chore)

## Files Created/Modified

- `lib/naming.ts` — Three exported pure functions: normalizeField (field slug normalization), buildBasename (joins destination/vendor/category/notes with underscores), deriveExt (URL pathname extension extraction with jpg fallback)
- `tests/unit/naming.test.ts` — Extended with describe blocks for normalizeField, buildBasename, and deriveExt; original buildSafeFilename tests preserved unchanged
- `tests/setup.ts` — Added chrome.storage.local mock (get + set) with beforeEach resets; added defineBackground global stub

## Decisions Made

- normalizeField collapses consecutive hyphens as a final step. Without this, "café & résumé" produces "caf--rsum" (double hyphen from the space before "&"). The fix makes the output clean: "caf-rsum".
- deriveExt uses an explicit allowlist rather than a denylist — safer for an unknown target environment (Tern Travel).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Collapsed consecutive hyphens in normalizeField**
- **Found during:** Task 1 (GREEN phase — first test run)
- **Issue:** "café & résumé" produced "caf--rsum" instead of "caf-rsum". The ampersand is stripped but the surrounding spaces had already been converted to hyphens, leaving a double-hyphen.
- **Fix:** Added `.replace(/-{2,}/g, '-')` as a final step in the normalizeField pipeline
- **Files modified:** lib/naming.ts
- **Verification:** Test `normalizeField('café & résumé')` now returns 'caf-rsum', all 31 tests pass
- **Committed in:** ad79c70 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 bug)
**Impact on plan:** Fix was necessary for correct behavior per spec. No scope creep.

## Issues Encountered

None beyond the auto-fixed bug above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `lib/naming.ts` is ready for Plan 02 to import and call `buildBasename` and `deriveExt`
- `tests/setup.ts` has `chrome.storage.local` mock in place — Plan 02 popup tests can use `chrome.storage.local.get/set` without "is not a function" errors
- `defineBackground` stub is in place for any tests that transitively import background.ts
- Full test suite green: 86 tests pass across all files

---
*Phase: 03-popup-and-naming*
*Completed: 2026-03-20*

## Self-Check: PASSED

- lib/naming.ts: FOUND
- tests/unit/naming.test.ts: FOUND
- tests/setup.ts: FOUND
- 03-01-SUMMARY.md: FOUND
- Commit ad79c70: FOUND
- Commit f0c0a7c: FOUND
- Tests: 86 passed (0 failed)
