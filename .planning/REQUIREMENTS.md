# Requirements: Photo Extractor

**Defined:** 2026-03-19
**Core Value:** Jennifer can grab any photo she sees while browsing travel sites and have it saved, named, and ready to drop into a tern.travel itinerary without friction.

## v1 Requirements

### Image Extraction

- [x] **EXTR-01**: Extension extracts all images from standard `img` tags on the active tab
- [x] **EXTR-02**: Extension extracts images from CSS `background-image` properties on elements
- [x] **EXTR-03**: Extension detects lazy-loaded images as the user scrolls (via MutationObserver)
- [x] **EXTR-04**: Extension selects the highest-resolution version when `srcset` provides multiple sizes

### Naming

- [x] **NAME-01**: User fills in a destination field before downloading (e.g. "bali", "paris")
- [x] **NAME-02**: User fills in a property/vendor field before downloading (e.g. "four-seasons", "viator")
- [x] **NAME-03**: User selects or types a category before downloading (e.g. "room", "pool", "excursion")
- [x] **NAME-04**: User can add an optional notes/tags field for anything else
- [x] **NAME-05**: Files are named using the pattern: `destination_vendor_category_notes_index.ext` (e.g. `bali_four-seasons_pool_01.jpg`)

### Selection UI

- [x] **UI-01**: Extension popup displays extracted images as a visual thumbnail grid
- [x] **UI-02**: User can click individual thumbnails to select or deselect them
- [x] **UI-03**: User can select all or deselect all images with a single action
- [x] **UI-04**: Download button saves only the selected images (not all extracted)

### Storage

- [x] **STOR-01**: Files are saved to a `travel-photos/` subfolder inside the user's Downloads folder
- [x] **STOR-02**: Filename collisions are handled automatically by appending an index (no silent overwrites)

## v2 Requirements

### Right-Click Bypass

- **RCB-01**: Extension overrides JavaScript `contextmenu` event blocks so Jennifer can right-click normally on protected sites
- **RCB-02**: Extension overrides CSS `pointer-events: none` blocking on image overlays

### UX Improvements

- **UX-01**: Extension remembers the last-used destination, vendor, and category to speed up repeat sessions
- **UX-02**: Minimum image dimension filter — skip images below a threshold (e.g. smaller than 200x200) to ignore icons and logos

### Settings (Phase 999.2)

- **SETT-01**: Settings module with types, defaults, and chrome.storage.local persistence
- **SETT-02**: loadSettings returns defaults on first install, merges partial stored settings over defaults
- **SETT-03**: Minimum resolution threshold is user-configurable via preset buttons (Small 50px, Medium 150px, Large 300px), default Medium
- **SETT-04**: CDN upscaling can be toggled on/off (default on), disabling skips URL rewriting at download
- **SETT-05**: minDimension setting is passed to content script via SCAN_PAGE message (no hardcoded constants)
- **SETT-06**: Settings panel accessible inside popup via gear icon in header, with back navigation
- **SETT-07**: Skip GIFs toggle (default off) filters .gif URLs from scan results
- **SETT-08**: Settings persist to chrome.storage.local and survive popup close/reopen

## Out of Scope

| Feature | Reason |
|---------|--------|
| Safari support | Chrome only for v1 — Safari extension model is different and adds significant complexity |
| Auto-detect destination/vendor from page | Unreliable across different site structures; manual input keeps naming accurate |
| Direct tern.travel integration | Local folder + manual import matches Jennifer's existing workflow |
| Cloud storage / sync | No backend, no accounts — local files only |
| Format conversion (WebP -> JPG) | tern.travel supports WebP natively; adds complexity for no clear gain |
| Saving to arbitrary folders | Hard Chrome platform constraint — Downloads folder only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXTR-01 | Phase 2 | Complete |
| EXTR-02 | Phase 2 | Complete |
| EXTR-03 | Phase 2 | Complete |
| EXTR-04 | Phase 2 | Complete |
| NAME-01 | Phase 3 | Complete |
| NAME-02 | Phase 3 | Complete |
| NAME-03 | Phase 3 | Complete |
| NAME-04 | Phase 3 | Complete |
| NAME-05 | Phase 3 | Complete |
| UI-01 | Phase 3 | Complete |
| UI-02 | Phase 3 | Complete |
| UI-03 | Phase 3 | Complete |
| UI-04 | Phase 3 | Complete |
| STOR-01 | Phase 1 | Complete |
| STOR-02 | Phase 1 | Complete |
| SETT-01 | Phase 999.2 | Planned |
| SETT-02 | Phase 999.2 | Planned |
| SETT-03 | Phase 999.2 | Planned |
| SETT-04 | Phase 999.2 | Planned |
| SETT-05 | Phase 999.2 | Planned |
| SETT-06 | Phase 999.2 | Planned |
| SETT-07 | Phase 999.2 | Planned |
| SETT-08 | Phase 999.2 | Planned |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

- Settings requirements: 8 total
- Mapped to phase 999.2: 8
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-21 after Phase 999.2 planning*
