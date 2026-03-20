---
phase: 03-popup-and-naming
plan: "03"
subsystem: ui
tags: [chrome-extension, react, wxt, popup, content-script, download]

# Dependency graph
requires:
  - phase: 03-02
    provides: popup UI with reducer, scan wiring, download pipeline

provides:
  - Verified end-to-end working extension: scan, select, name, download
  - Five integration bug fixes found during live Chrome testing

affects: [04-cdn-url-upscaling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Use chrome.tabs.connect(tabId) to open a port to the content script — not chrome.runtime.connect() which targets the background service worker"
    - "Pre-number basenames before launching parallel downloads to avoid race conditions on filename collision checks"
    - "Read data-src/data-srcset/data-lazy attributes as fallbacks for lazy-load images before falling back to img.src"
    - "Use img.src (DOM property, always absolute) rather than getAttribute('src') (raw, may be relative) when building ImageResult.url"
    - "Clear all scan result state (images, selection, downloadStatus) on SCAN_STARTED so stale state cannot bleed into a fresh scan"

key-files:
  created: []
  modified:
    - entrypoints/popup/App.tsx
    - entrypoints/content.ts
    - lib/extract/imgTags.ts
    - tests/unit/imgTags.test.ts
    - tests/unit/mutationObserver.test.ts

key-decisions:
  - "chrome.tabs.connect(tabId) required — chrome.runtime.connect() only reaches background, not content script"
  - "Pre-number all basenames before Promise.allSettled to prevent parallel download race condition"
  - "Lazy-load fallback order: srcset > data-srcset > img.src > data-src/data-lazy — covers booking.com and Next.js sites"

patterns-established:
  - "Integration bugs are best caught in live Chrome testing — unit tests verify logic isolation, not wiring"

requirements-completed: [UI-01, UI-02, UI-03, UI-04, NAME-01, NAME-02, NAME-03, NAME-04, NAME-05]

# Metrics
duration: 45min
completed: 2026-03-20
---

# Phase 3 Plan 03: E2E Verification Summary

**End-to-end Chrome verification confirmed full popup-to-download pipeline working, uncovering and fixing five integration wiring bugs that unit tests could not catch.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-20
- **Completed:** 2026-03-20
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 5

## Accomplishments

- Extension builds cleanly and loads in Chrome developer mode
- Human verified full workflow on booking.com and foratravel.com: scan, thumbnail grid, selection, naming form, download, pre-fill
- Five integration bugs found during verification and fixed — all 121 tests still passing after fixes

## Task Commits

1. **Task 1: Build extension** — `26d1c46` (prior session — build was clean, no new commit needed)
2. **Task 2: E2E verification in Chrome** — `86c4b18` (fix: 5 integration bugs found during Chrome e2e verification)

## Files Created/Modified

- `entrypoints/popup/App.tsx` — Fixed chrome.tabs.connect wiring, pre-numbered basenames, SCAN_STARTED state reset
- `entrypoints/content.ts` — Added data-src/data-srcset fallbacks, updated MutationObserver attributeFilter
- `lib/extract/imgTags.ts` — Added data-src/data-srcset lazy-load fallbacks, use img.src for absolute URL resolution
- `tests/unit/imgTags.test.ts` — Updated tests for new URL resolution behavior
- `tests/unit/mutationObserver.test.ts` — Updated tests for new attributeFilter list

## Decisions Made

- `chrome.tabs.connect(tabId)` is the correct API for popup-to-content-script communication. `chrome.runtime.connect()` only reaches the background service worker. This distinction was not caught in unit tests because the popup and content script were tested in isolation.
- Basenames must be assigned before `Promise.allSettled` — not inside each async download callback — to guarantee each file gets a unique sequential number without relying on Chrome download history.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] chrome.runtime.connect() → chrome.tabs.connect(tabId)**
- **Found during:** Task 2 (E2E Chrome verification)
- **Issue:** Popup was connecting to the background service worker instead of the content script. Scan button did nothing — no messages ever reached the content script.
- **Fix:** Query active tab with `chrome.tabs.query({ active: true, currentWindow: true })`, then call `chrome.tabs.connect(tab.id, { name: 'scan-session' })`.
- **Files modified:** `entrypoints/popup/App.tsx`
- **Verification:** Scan button triggers image extraction on booking.com and foratravel.com
- **Committed in:** `86c4b18`

**2. [Rule 2 - Missing Critical] Lazy-load URL fallback (data-src/data-srcset)**
- **Found during:** Task 2 (E2E Chrome verification on booking.com)
- **Issue:** booking.com uses lazy loading — `src` contains a placeholder, real URL is in `data-src` or `data-srcset`. Thumbnails appeared broken.
- **Fix:** Added fallback priority chain: srcset → data-srcset → img.src → data-src/data-lazy/data-lazy-src in both `imgTags.ts` and `content.ts`.
- **Files modified:** `lib/extract/imgTags.ts`, `entrypoints/content.ts`
- **Verification:** Thumbnails display correctly on booking.com
- **Committed in:** `86c4b18`

**3. [Rule 1 - Bug] Parallel download race condition — pre-numbered basenames**
- **Found during:** Task 2 (E2E Chrome verification)
- **Issue:** Multiple downloads running in parallel all queried Chrome history simultaneously, saw no conflicts, and all claimed the same filename. Only one file survived.
- **Fix:** Assign `_01/_02/...` suffixes to all basenames before launching `Promise.allSettled`, using index position rather than history lookup.
- **Files modified:** `entrypoints/popup/App.tsx`
- **Verification:** Multiple files download with distinct sequential names
- **Committed in:** `86c4b18`

**4. [Rule 1 - Bug] Stale scan state not cleared on re-scan**
- **Found during:** Task 2 (E2E Chrome verification)
- **Issue:** Clicking Scan Page a second time left previous thumbnails visible during the new scan, then appended new results instead of replacing them.
- **Fix:** `SCAN_STARTED` reducer now clears `images`, `selected`, `blobCount`, `downloadStatus`, and `downloadProgress`.
- **Files modified:** `entrypoints/popup/App.tsx`
- **Verification:** Re-scanning shows only fresh results from the new scan
- **Committed in:** `86c4b18`

**5. [Rule 1 - Bug] Relative URL in ImageResult.url broke thumbnail display on Next.js sites**
- **Found during:** Task 2 (E2E Chrome verification on foratravel.com)
- **Issue:** `getAttribute('src')` returns the raw attribute value, which on Next.js sites is a relative path (`/_next/image?...`). The popup cannot resolve relative URLs from the extension origin, so `<img src="/_next/image...">` in the popup renders broken.
- **Fix:** Use `img.src` (the DOM property) instead of `img.getAttribute('src')` — the browser always resolves this to an absolute URL. Also applied `resolveUrl()` to `data-*` attributes that need manual resolution.
- **Files modified:** `lib/extract/imgTags.ts`, `entrypoints/content.ts`
- **Verification:** Thumbnails display correctly on foratravel.com
- **Committed in:** `86c4b18`

---

**Total deviations:** 5 auto-fixed (4 Rule 1 bugs, 1 Rule 2 missing critical)
**Impact on plan:** All fixes essential for the extension to work on real travel sites. No scope creep.

## Issues Encountered

The plan's unit test coverage was thorough, but all five bugs were wiring-level issues that only manifest when popup, content script, and Chrome APIs interact in a real browser. This validates the purpose of this plan: end-to-end verification catches what isolation tests cannot.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 3 complete. Extension is fully functional end-to-end.
- Phase 4 (CDN URL upscaling) can begin: detect booking.com/Cloudinary URL patterns and rewrite to highest resolution before downloading.
- The lazy-load fallback infrastructure added in this plan provides a foundation for Phase 4's URL detection logic.

---
*Phase: 03-popup-and-naming*
*Completed: 2026-03-20*
