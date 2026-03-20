# Roadmap: Photo Extractor

## Overview

Three phases that build the extension bottom-up: scaffold and storage first (the foundation that everything depends on), image extraction second (the highest-risk technical component, validated in isolation), then the popup UI and naming workflow last (once we know the URLs it will receive are correct). Each phase is independently verifiable before the next begins.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - MV3-compliant scaffold with service worker, permissions, and file-saving pipeline
- [ ] **Phase 2: Image Extraction** - Content script that reliably finds all images on real travel sites
- [ ] **Phase 3: Popup and Naming** - Full popup UI with image grid, naming form, and end-to-end download

## Phase Details

### Phase 1: Foundation
**Goal**: A loadable Chrome extension with correct MV3 architecture, working download pipeline, and collision-safe file naming — so every subsequent phase builds on a solid base
**Depends on**: Nothing (first phase)
**Requirements**: STOR-01, STOR-02
**Success Criteria** (what must be TRUE):
  1. Extension loads in Chrome developer mode with no manifest errors or console warnings
  2. A test download saves a file to `Downloads/travel-photos/` with the correct subfolder path
  3. Two files with the same base name save as separate files — no silent overwrite
  4. Service worker stays functional after 30+ seconds of idle (state survives in chrome.storage, not memory)
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Scaffold WXT project, implement download utility with collision-safe naming, set up tests
- [ ] 01-02-PLAN.md — Build extension and verify end-to-end download pipeline in Chrome

### Phase 2: Image Extraction
**Goal**: A content script that finds all meaningful images on any travel site page — including lazy-loaded, CSS background, and srcset images — and surfaces them to the extension
**Depends on**: Phase 1
**Requirements**: EXTR-01, EXTR-02, EXTR-03, EXTR-04
**Success Criteria** (what must be TRUE):
  1. Scanning a hotel page returns all visible `<img>` tag photos (not just the first one)
  2. Scanning a Viator or GetYourGuide page captures images loaded after scroll (lazy-loaded)
  3. Images rendered as CSS background-image properties appear in scan results
  4. When a srcset offers multiple sizes, only the highest-resolution URL is returned
**Plans**: TBD

### Phase 3: Popup and Naming
**Goal**: Jennifer can open the extension popup on any travel site, see a thumbnail grid of all extracted images, fill in destination/vendor/category, select the photos she wants, and download them with correctly formatted filenames
**Depends on**: Phase 2
**Requirements**: UI-01, UI-02, UI-03, UI-04, NAME-01, NAME-02, NAME-03, NAME-04, NAME-05
**Success Criteria** (what must be TRUE):
  1. Opening the popup on a travel site shows a thumbnail grid of all extracted images within a few seconds
  2. Jennifer can click individual thumbnails to select or deselect them, and use a single button to select or clear all
  3. Filling in destination, vendor, and category fields and clicking Download saves only the selected files — no unselected images download
  4. Downloaded files are named `destination_vendor_category_[notes_]index.ext` matching the values Jennifer typed
  5. Reopening the popup on a new page pre-fills the last-used destination, vendor, and category values
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/2 | In Progress|  |
| 2. Image Extraction | 0/TBD | Not started | - |
| 3. Popup and Naming | 0/TBD | Not started | - |
