# Roadmap: Photo Extractor

## Overview

Three phases that build the extension bottom-up: scaffold and storage first (the foundation that everything depends on), image extraction second (the highest-risk technical component, validated in isolation), then the popup UI and naming workflow last (once we know the URLs it will receive are correct). Each phase is independently verifiable before the next begins.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - MV3-compliant scaffold with service worker, permissions, and file-saving pipeline (completed 2026-03-20)
- [x] **Phase 2: Image Extraction** - Content script that reliably finds all images on real travel sites (completed 2026-03-20)
- [x] **Phase 3: Popup and Naming** - Full popup UI with image grid, naming form, and end-to-end download (completed 2026-03-20)

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
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — Create extraction modules (srcset parser, img tag scanner, CSS background scanner) with types and tests
- [ ] 02-02-PLAN.md — Wire extractors into content script with long-lived port messaging and MutationObserver

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
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Create naming utility (normalizeField, buildBasename, deriveExt) with tests and update test setup mocks
- [x] 03-02-PLAN.md — Build complete popup UI with thumbnail grid, selection, naming form, scan wiring, and download pipeline
- [x] 03-03-PLAN.md — Build extension and verify end-to-end in Chrome

### Phase 4: CDN URL Upscaling
**Goal**: When Jennifer downloads photos, the extension detects known CDN URL patterns (Booking.com, Airbnb, Cloudinary, Imgix, Viator/TripAdvisor) and rewrites URLs to request the highest available resolution — so she gets full-quality images instead of thumbnail-sized versions
**Depends on:** Phase 3
**Requirements**: CDN-01, CDN-02, CDN-03, CDN-04, CDN-05, CDN-06, CDN-08, CDN-09
**Success Criteria** (what must be TRUE):
  1. Downloading from Booking.com produces higher-resolution images than the page thumbnails
  2. Downloading from Airbnb produces higher-resolution images than the page thumbnails
  3. URLs from unknown CDNs download normally (no breakage)
  4. If a rewritten URL fails, the original URL downloads successfully as fallback
  5. No changes to scan or thumbnail display — rewrite happens only at download time
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — Create CDN URL rewrite module (rewriteUrlForMaxResolution) with TDD for 6 CDN providers
- [ ] 04-02-PLAN.md — Integrate rewriter into download pipeline with fallback, build and verify in Chrome

### Phase 5: Chrome Web Store Submission
**Goal**: All CWS submission assets are ready: icons, polished manifest (v1.0.0), privacy policy on GitHub Pages, store listing copy, 440x280 promotional tile, and packaged ZIP -- so the extension can be uploaded to the Chrome Web Store for public distribution
**Depends on:** Phase 4
**Requirements**: CWS-ICONS, CWS-MANIFEST, CWS-PRIVACY, CWS-LISTING, CWS-PROMO, CWS-ZIP
**Success Criteria** (what must be TRUE):
  1. Extension has blue camera icons at 16, 32, 48, 128px declared in manifest
  2. manifest.json version is 1.0.0 with 130-char description (under CWS 132 limit)
  3. Privacy policy HTML exists at docs/privacy-policy.html disclosing downloads and storage permissions
  4. Store listing copy is finalized with name, short description, long description, and category
  5. 440x280 promotional tile PNG exists
  6. ZIP package contains all extension files with correct manifest
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — Generate icon PNGs, update manifest and package.json, create privacy policy HTML
- [ ] 05-02-PLAN.md — Create store listing copy, promotional tile, build ZIP package, user review checkpoint

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete   | 2026-03-20 |
| 2. Image Extraction | 2/2 | Complete   | 2026-03-20 |
| 3. Popup and Naming | 3/3 | Complete   | 2026-03-20 |
| 4. CDN URL Upscaling | 2/2 | Complete   | 2026-03-21 |
| 5. CWS Submission | 2/2 | Complete   | 2026-03-21 |
