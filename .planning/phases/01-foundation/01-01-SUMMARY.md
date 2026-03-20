---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [wxt, react, tailwind, typescript, vitest, chrome-extension, mv3, downloads-api]

requires: []

provides:
  - WXT project scaffold with React 18 + Tailwind 3.x + TypeScript
  - lib/download.ts: buildSafeFilename (collision-safe _01/_02 counter) and triggerDownload
  - lib/keepalive.ts: service worker keepalive via chrome.storage.session
  - entrypoints/background.ts: DOWNLOAD_FILE message handler
  - entrypoints/content.ts: stub content script (Phase 2 fills in)
  - entrypoints/popup/: React popup with Test Download button
  - Vitest test suite: 14 unit tests covering naming and download pipeline
  - .output/chrome-mv3/manifest.json: MV3-compliant, loads in Chrome developer mode

affects: [02-image-extraction, 03-popup-naming]

tech-stack:
  added:
    - wxt@0.20.20 (build framework, manifest generation, HMR)
    - "@wxt-dev/module-react@^1.2.0" (React 18 integration)
    - react@18.x + react-dom@18.x
    - tailwindcss@3.x + postcss + autoprefixer
    - typescript@5.x
    - "@types/chrome" (Chrome extension API types)
    - vitest@3.x (unit test runner)
  patterns:
    - All background runtime code inside defineBackground main() (avoids build-time chrome errors)
    - chrome.downloads.search() history check before download to build collision-safe filenames
    - _lastActive touch on chrome.storage.session as SW keepalive pattern
    - @/ alias resolves from project root (vitest.config.ts + tsconfig)

key-files:
  created:
    - lib/download.ts
    - lib/keepalive.ts
    - entrypoints/background.ts
    - entrypoints/content.ts
    - entrypoints/popup/App.tsx
    - entrypoints/popup/main.tsx
    - entrypoints/popup/index.html
    - entrypoints/popup/style.css
    - tests/unit/naming.test.ts
    - tests/unit/download.test.ts
    - tests/setup.ts
    - vitest.config.ts
    - wxt.config.ts
    - tailwind.config.js
    - postcss.config.js
    - package.json
    - .gitignore
  modified: []

key-decisions:
  - "Pin React to 18.x and Tailwind to 3.x per STATE.md decisions, not current 19.x/4.x"
  - "Use chrome.downloads.search() history check for collision avoidance — not conflictAction: uniquify (would produce photo (1).jpg format)"
  - "chrome.storage.session for SW keepalive (ephemeral, session-scoped) not chrome.storage.local"
  - "All background logic inside defineBackground main() to avoid WXT build-time Node.js context errors"
  - ".output/ added to .gitignore on first build"

patterns-established:
  - "Pattern: chrome keepalive — call keepAlive() before any async download to reset SW idle timer"
  - "Pattern: collision-safe naming — search history, build Set of taken names, increment _01/_02 counter"
  - "Pattern: message passing — popup sends chrome.runtime.sendMessage, background returns true for async response"

requirements-completed: [STOR-01, STOR-02]

duration: 10min
completed: 2026-03-20
---

# Phase 01 Plan 01: Foundation Summary

**WXT 0.20 Chrome MV3 extension scaffold with collision-safe download pipeline (_01/_02 counter via downloads history), React 18 popup, and 14 passing Vitest unit tests**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-20T04:42:07Z
- **Completed:** 2026-03-20T04:52:09Z
- **Tasks:** 2 of 2
- **Files modified:** 18 created

## Accomplishments
- WXT project scaffolded from scratch with correct MV3 architecture — loads in Chrome developer mode
- Collision-safe naming logic implemented and tested: clean name → _01 → _02 up to _99 using chrome.downloads.search history
- Service worker keepalive via chrome.storage.session established as the SW persistence pattern for all phases
- 14 unit tests written TDD-style (RED then GREEN): 7 naming collision tests, 7 download pipeline tests — all green
- WXT build succeeds in 578ms, manifest.json is MV3-compliant with downloads+storage permissions

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold WXT project, implement download utility and tests** - `0518b0b` (feat)
2. **Task 2: Verify WXT build produces loadable MV3 extension** - `0c094be` (chore)

## Files Created/Modified
- `lib/download.ts` - buildSafeFilename (collision counter) and triggerDownload functions
- `lib/keepalive.ts` - chrome.storage.session SW keepalive utility
- `entrypoints/background.ts` - Service worker with DOWNLOAD_FILE message listener
- `entrypoints/content.ts` - Stub content script (Phase 2 fills in)
- `entrypoints/popup/App.tsx` - React popup with Test Download button
- `entrypoints/popup/main.tsx` - React 18 root mount
- `entrypoints/popup/index.html` - WXT popup entry HTML
- `entrypoints/popup/style.css` - Tailwind @tailwind base/components/utilities
- `tests/unit/naming.test.ts` - 7 tests for buildSafeFilename collision logic
- `tests/unit/download.test.ts` - 7 tests for triggerDownload pipeline
- `tests/setup.ts` - Chrome API mocks (downloads.search, downloads.download, storage.session)
- `vitest.config.ts` - Vitest config with globals, setupFiles, @ alias
- `wxt.config.ts` - WXT config with React module and manifest permissions
- `tailwind.config.js` - Tailwind 3.x with entrypoints content paths
- `postcss.config.js` - PostCSS with tailwindcss + autoprefixer
- `package.json` - Dependencies: WXT 0.20, React 18, Tailwind 3, Vitest 3
- `.gitignore` - Excludes .output/, node_modules/, .wxt/

## Decisions Made
- Pinned React to 18.x and Tailwind to 3.x as specified in STATE.md, even though 19.x and 4.x are current npm versions. Avoids breaking API changes.
- Used history-based collision check (chrome.downloads.search) rather than chrome's native `uniquify` — `uniquify` produces `photo (1).jpg` format which conflicts with the required `_01` naming convention.
- Added `.gitignore` on first build because the project had none and `.output/` would have been untracked after Task 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Created .gitignore before first build**
- **Found during:** Task 2 (WXT build verification)
- **Issue:** No .gitignore existed. After `npx wxt build`, `.output/` would have been an untracked directory in git
- **Fix:** Created `.gitignore` with `.output/`, `node_modules/`, `.wxt/` before running the build
- **Files modified:** `.gitignore`
- **Verification:** `git status` shows `.output/` is not tracked after build
- **Committed in:** `0518b0b` (Task 1 commit, staged alongside other scaffold files)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary housekeeping — no scope creep.

## Issues Encountered
None — plan executed without errors. WXT build succeeded first attempt.

## User Setup Required
None - no external service configuration required. Extension is ready to load unpacked in Chrome developer mode from `.output/chrome-mv3/`.

## Next Phase Readiness
- Phase 01-02 can run the end-to-end download test (load the extension in Chrome, click Test Download, verify file in Downloads/travel-photos/)
- Phase 02 (image extraction) has a registered content script stub in entrypoints/content.ts — ready to fill in without touching wxt.config.ts
- Download utility (buildSafeFilename, triggerDownload) is proven and tested — Phase 3 calls it directly with real naming data

---
*Phase: 01-foundation*
*Completed: 2026-03-20*

## Self-Check: PASSED

All files verified present. Both commits (0518b0b, 0c094be) confirmed in git log.
