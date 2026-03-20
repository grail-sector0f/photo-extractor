---
phase: 03-popup-and-naming
verified: 2026-03-20T16:30:00Z
status: human_needed
score: 20/20 must-haves verified
re_verification: false
human_verification:
  - test: "Open popup on a travel site, click Scan Page, confirm thumbnail grid appears with blue rings on all images"
    expected: "Skeleton loading briefly, then 3-column thumbnail grid with all images auto-selected (blue ring + checkmark on each)"
    why_human: "Visual render and Chrome port wiring cannot be confirmed by static analysis — only live Chrome execution reveals whether chrome.tabs.connect reaches the content script"
  - test: "Click thumbnails to deselect and reselect individually; test Clear All and Select All"
    expected: "Blue rings appear/disappear correctly; count in selection bar updates; Select All/Clear All toggle labels correctly"
    why_human: "React state binding to visual selection state requires a real browser render"
  - test: "Fill Destination, Vendor, Category; click category input and verify datalist dropdown appears with presets"
    expected: "Dropdown shows: room, pool, lobby, exterior, food, excursion, beach, spa, activities"
    why_human: "HTML datalist behavior is browser-rendered and cannot be verified in jsdom"
  - test: "Download N images with naming fields filled; check Downloads/travel-photos/ folder"
    expected: "Files named bali_four-seasons_pool_01.jpg, _02.jpg... or bali_four-seasons_pool.jpg for a single file"
    why_human: "chrome.downloads API and actual file system writes require a live extension environment"
  - test: "Close and reopen the popup after a successful download"
    expected: "Destination, Vendor, Category fields pre-filled with last-used values; Notes field is empty"
    why_human: "chrome.storage.local persistence across popup sessions requires a real Chrome environment"
---

# Phase 3: Popup and Naming Verification Report

**Phase Goal:** Deliver the complete popup UI and naming pipeline so Jennifer can scan a travel page, select photos, name them, and download them into a structured folder — all without leaving the browser.
**Verified:** 2026-03-20T16:30:00Z
**Status:** human_needed — all automated checks pass, 5 items require live Chrome confirmation
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | normalizeField lowercases, converts spaces to hyphens, strips non-alphanumeric/hyphen | VERIFIED | `lib/naming.ts` lines 35-41 implement all 4 pipeline steps; 8 tests in `naming.test.ts` cover every case |
| 2 | buildBasename joins destination_vendor_category with underscores | VERIFIED | `lib/naming.ts` lines 67-83; test at line 127 confirms `bali_four-seasons_pool` output |
| 3 | buildBasename includes notes segment when notes is non-empty | VERIFIED | `lib/naming.ts` line 78; test at line 134 confirms |
| 4 | buildBasename omits notes segment when notes is empty or whitespace-only | VERIFIED | `lib/naming.ts` line 78 (`notes.trim()` check); tests at lines 140-149 cover empty string, whitespace, and undefined |
| 5 | deriveExt extracts known image extensions from URL pathname and falls back to jpg | VERIFIED | `lib/naming.ts` lines 109-132; 10 tests cover jpg, png, webp, gif, avif, jpeg, fallback cases |
| 6 | Popup opens to idle state with Scan Page button — no auto-scan on open | VERIFIED | `App.tsx` line 87: `initialState.scanStatus = 'idle'`; `startScan` is called only via `handleScan` button click (line 778), not in any `useEffect` |
| 7 | Clicking Scan Page shows skeleton loading grid and connects to scan-session port | VERIFIED | `App.tsx` lines 224, 242: dispatches SCAN_STARTED then calls `chrome.tabs.connect(tab.id, { name: 'scan-session' })`; skeleton rendered at lines 399-414 |
| 8 | After SCAN_RESULT, thumbnail grid displays all extracted images in a 3-column layout | VERIFIED | Reducer line 110 populates `images`; `ThumbnailGrid` renders `grid grid-cols-3 gap-1` at line 453 |
| 9 | Clicking a thumbnail toggles its selection (blue ring + checkmark when selected) | VERIFIED | `ThumbnailCard` at lines 341-382: `ring-2 ring-blue-600` class applied conditionally, checkmark overlay at line 373 |
| 10 | Select All selects all images; Clear All deselects all | VERIFIED | Reducer cases at lines 134-140; `SelectionBar` at lines 479-492 wires both handlers |
| 11 | Naming form has Destination, Vendor, Category (required) and Notes (optional) fields | VERIFIED | `NamingForm` at lines 508-588 renders all 4 inputs with proper labels |
| 12 | Category input has datalist with presets: room, pool, lobby, exterior, food, excursion, beach, spa, activities | VERIFIED | `App.tsx` lines 560-570: all 9 preset options present in datalist `category-presets` |
| 13 | Download button disabled until at least 1 image selected AND all required fields non-empty | VERIFIED | `DownloadButton` lines 622-627: `isEnabled = count > 0 && fieldsValid && ...` using `.trim().length > 0` |
| 14 | Download button shows count: Download N Photos (singular for 1) | VERIFIED | Lines 631-639: singular "Download 1 Photo" vs plural "Download N Photos" |
| 15 | Downloading shows progress: Saving X of N... | VERIFIED | `StatusMessage` line 685: `Saving ${downloadProgress.done} of ${downloadProgress.total}...` |
| 16 | Success shows: Saved N photos to Downloads/travel-photos/ | VERIFIED | `StatusMessage` lines 687-691: correct copy with singular/plural |
| 17 | Partial failure shows: Saved X of N — Y failed to download. | VERIFIED | `StatusMessage` line 694: uses `\u2014` (em dash) as specified |
| 18 | Last-used destination, vendor, category pre-filled from chrome.storage.local on mount | VERIFIED | `App.tsx` lines 766-775: `useEffect` with empty deps calls `chrome.storage.local.get` and dispatches PREFILL_LOADED |
| 19 | Blob count from scan is surfaced in the UI | VERIFIED | `PopupHeader` lines 733-738: blob count shown when `blobCount > 0` |
| 20 | Extension builds without errors via npm run build | VERIFIED | `.output/chrome-mv3/` directory exists with manifest.json, popup.html, background.js, content-scripts |

**Score:** 20/20 truths verified (automated)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/naming.ts` | normalizeField, buildBasename, deriveExt pure functions | VERIFIED | 133 lines; all 3 functions exported; substantive implementations |
| `tests/unit/naming.test.ts` | Unit tests for all 3 naming functions | VERIFIED | 193 lines; 3 describe blocks with 8+6+10 tests; all pass |
| `tests/setup.ts` | chrome.storage.local mock | VERIFIED | Contains `local:` block, get/set mocks, beforeEach resets at lines 60-61; defineBackground stub at line 50 |
| `entrypoints/popup/App.tsx` | Complete popup UI with reducer, all components, scan wiring, download wiring | VERIFIED | 858 lines; contains useReducer, all 7 components, named exports |
| `tests/unit/popup-reducer.test.ts` | Unit tests for popup reducer state transitions | VERIFIED | 346 lines; 35 tests across 11 describe blocks covering every action type; all pass |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tests/unit/naming.test.ts` | `lib/naming.ts` | `import { normalizeField, buildBasename, deriveExt }` | WIRED | Line 5: exact import pattern present and used in all 3 describe blocks |
| `entrypoints/popup/App.tsx` | `lib/naming.ts` | `import { buildBasename, deriveExt }` | WIRED | Line 23: `import { buildBasename, deriveExt } from '../../lib/naming'`; both called at lines 643 and 305 |
| `entrypoints/popup/App.tsx` | `entrypoints/background.ts` | `chrome.runtime.sendMessage DOWNLOAD_FILE` | WIRED | Lines 198-212: `sendDownloadMessage` sends `{ type: 'DOWNLOAD_FILE', payload: { url, basename, ext } }` |
| `entrypoints/popup/App.tsx` | `entrypoints/content.ts` | `chrome.tabs.connect scan-session port` | WIRED | Line 242: `chrome.tabs.connect(tab.id, { name: 'scan-session' })` — correct API (not chrome.runtime.connect) |
| `entrypoints/popup/App.tsx` | `chrome.storage.local` | get on mount, set after download | WIRED | Line 767: `chrome.storage.local.get` in useEffect; line 318: `chrome.storage.local.set` after successful download |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UI-01 | 03-02 | Extension popup displays extracted images as a visual thumbnail grid | SATISFIED | `ThumbnailGrid` component with `grid grid-cols-3` layout in App.tsx |
| UI-02 | 03-02 | User can click individual thumbnails to select or deselect them | SATISFIED | `ThumbnailCard` onClick → TOGGLE_SELECT action; blue ring toggles via `selected` Set |
| UI-03 | 03-02 | User can select all or deselect all images with a single action | SATISFIED | `SelectionBar` with SELECT_ALL / CLEAR_ALL dispatch; tested in popup-reducer.test.ts |
| UI-04 | 03-02 | Download button saves only the selected images | SATISFIED | `runDownloads` called with `Array.from(selected)` — only selected URLs are downloaded |
| NAME-01 | 03-01, 03-02 | User fills in a destination field before downloading | SATISFIED | Destination input in NamingForm; required for download button to enable |
| NAME-02 | 03-01, 03-02 | User fills in a property/vendor field before downloading | SATISFIED | Vendor input in NamingForm; required for download button to enable |
| NAME-03 | 03-01, 03-02 | User selects or types a category before downloading | SATISFIED | Category input with datalist in NamingForm; required for download button to enable |
| NAME-04 | 03-01, 03-02 | User can add an optional notes/tags field | SATISFIED | Notes input in NamingForm; optional (not required for download enable) |
| NAME-05 | 03-01, 03-02 | Files named: destination_vendor_category_notes_index.ext | SATISFIED | buildBasename constructs the slug; pre-numbered basenames (_01, _02...) assigned before Promise.allSettled |

All 9 Phase 3 requirements from REQUIREMENTS.md are satisfied. No orphaned requirements: REQUIREMENTS.md traceability table maps UI-01 through UI-04 and NAME-01 through NAME-05 exclusively to Phase 3. STOR-01 and STOR-02 map to Phase 1 (complete). EXTR-01 through EXTR-04 map to Phase 2 (complete). No unmapped requirements exist for this phase.

---

## Anti-Patterns Found

None. Checked App.tsx, lib/naming.ts, tests/unit/naming.test.ts, tests/unit/popup-reducer.test.ts for:

- TODO/FIXME/HACK/XXX: not found
- Stub implementations (return null, return {}, empty handlers): not found
- `placeholder` strings: all hits are legitimate HTML input `placeholder` attributes and skeleton UI comments, not stub code
- Empty onSubmit / onClick: all event handlers dispatch real actions or call real functions

---

## Human Verification Required

The extension passed all automated checks. The following 5 items require loading the extension in Chrome developer mode to verify. The build is at `.output/chrome-mv3/`.

### 1. Scan triggers thumbnail grid

**Test:** Open the extension on a travel site (e.g. booking.com or unsplash.com). Click "Scan Page".
**Expected:** Brief skeleton loading (gray pulsing tiles), then a 3-column grid of thumbnails all auto-selected (blue ring + checkmark).
**Why human:** `chrome.tabs.connect` to the content script can only be confirmed in a live browser. The integration bug from Plan 03 (runtime.connect vs tabs.connect) was a wiring issue invisible to unit tests.

### 2. Thumbnail selection toggles

**Test:** Click individual thumbnails to deselect them, click again to reselect. Click "Clear All", then "Select All".
**Expected:** Blue rings appear/disappear per click. Selection bar count updates. "Clear All" / "Select All" label toggles correctly when all-or-none are selected.
**Why human:** React state-to-visual binding requires a real browser render.

### 3. Category datalist dropdown

**Test:** Click into the Category input field.
**Expected:** A dropdown with suggestions appears: room, pool, lobby, exterior, food, excursion, beach, spa, activities.
**Why human:** HTML datalist behavior is browser-rendered; jsdom does not replicate it.

### 4. Download creates correctly named files

**Test:** Fill Destination="bali", Vendor="four-seasons", Category="pool". Select 3 images. Click Download.
**Expected:** Status shows "Saving 1 of 3..." → "Saving 2 of 3..." → "Saved 3 photos to Downloads/travel-photos/". Files bali_four-seasons_pool_01.jpg, _02.jpg, _03.jpg appear in ~/Downloads/travel-photos/.
**Why human:** chrome.downloads API and actual filesystem writes require a live extension environment.

### 5. Pre-fill persists across sessions

**Test:** After a successful download (test 4 above), close the popup and reopen it.
**Expected:** Destination, Vendor, and Category fields are pre-filled with "bali", "four-seasons", "pool". Notes field is empty.
**Why human:** chrome.storage.local persistence across popup open/close cycles requires a real Chrome context.

---

## Gaps Summary

No gaps. All automated verifications passed at all three levels (exists, substantive, wired). The 5 human verification items are not gaps — they are confirmations of already-wired code that requires a live browser to observe.

Key integration fix to note: Plan 03 caught and fixed `chrome.runtime.connect()` → `chrome.tabs.connect(tabId)` during live Chrome testing. The corrected code is present in the current codebase at App.tsx line 242. This is the most critical wiring path in the extension.

---

_Verified: 2026-03-20T16:30:00Z_
_Verifier: Claude (gsd-verifier)_
