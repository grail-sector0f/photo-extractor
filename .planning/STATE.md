---
gsd_state_version: 1.0
milestone: v1.0.0
milestone_name: milestone
status: unknown
stopped_at: Completed 999.1-01-PLAN.md
last_updated: "2026-03-21T16:45:38.137Z"
progress:
  total_phases: 8
  completed_phases: 5
  total_plans: 14
  completed_plans: 12
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** Jennifer can grab any photo she sees while browsing travel sites and have it saved, named, and ready to drop into a tern.travel itinerary without friction.
**Current focus:** Phase 999.1 — ui-modernization-year-field

## Current Position

Phase: 999.1 (ui-modernization-year-field) — EXECUTING
Plan: 2 of 3

## Performance Metrics

**Velocity:**

- Total plans completed: 1
- Average duration: ~10 min
- Total execution time: ~10 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 1 | ~10 min | ~10 min |

**Recent Trend:**

- Last 5 plans: 01-01 (~10 min)
- Trend: Baseline set

*Updated after each plan completion*
| Phase 01 P02 | 5min | 2 tasks | 1 files |
| Phase 02 P01 | 5min | 3 tasks | 7 files |
| Phase 02-image-extraction P02 | 3 | 3 tasks | 4 files |
| Phase 03-popup-and-naming P01 | 2 | 2 tasks | 3 files |
| Phase 03-popup-and-naming P02 | 5 | 1 task | 2 files |
| Phase 03-popup-and-naming P03 | 45 | 2 tasks | 5 files |
| Phase 04 P01 | 3 | 1 tasks | 2 files |
| Phase 04 P02 | 8 | 2 tasks | 2 files |
| Phase 04 P02 | 8 | 3 tasks | 2 files |
| Phase 05 P01 | 10 | 2 tasks | 9 files |
| Phase 05 P02 | 15 | 3 tasks | 4 files |
| Phase 05 P02 | 20 | 4 tasks | 5 files |
| Phase 999.1 P01 | 5 | 1 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Stack: WXT 0.20.x + React 18 + TypeScript + Tailwind CSS 3.x on Manifest V3 (from research)
- Storage: Downloads API only — saves to Downloads/travel-photos/ subfolder, no arbitrary folder choice
- Distribution: Chrome developer mode (unpacked) or Web Store — confirm with Jennifer before Phase 1 ships (affects optional permissions pattern in manifest)
- [01-01] Pin React to 18.x and Tailwind to 3.x, not current 19.x/4.x — avoids breaking API changes
- [01-01] Collision avoidance via chrome.downloads.search history check, not conflictAction: uniquify — preserves _01/_02 naming format required by NAME-05
- [01-01] SW keepalive pattern: write _lastActive to chrome.storage.session before every async download operation
- [Phase 01-02]: Popup shows download ID and click count in status message — confirms each click reaches background worker with a real download response
- [02-01] jsdom installed as dev dep — vitest 3.x requires it at startup even for non-jsdom test files
- [02-01] parseSrcset prefers w-descriptors over x-descriptors when both appear in same srcset string
- [02-01] extractImgTags falls back to img.width/height when img.complete is false
- [02-01] extractCssBackgrounds uses getBoundingClientRect as dimension proxy for CSS background elements
- [Phase 02-02]: defineContentScript global stub added to tests/setup.ts so content.ts loads in jsdom without WXT runtime
- [Phase 02-02]: handleScanSession and processImg exported from content.ts for direct testing without WXT wrapper
- [Phase 03-01]: normalizeField collapses consecutive hyphens to prevent double-hyphens from stripped chars adjacent to spaces
- [Phase 03-01]: deriveExt uses allowlist (jpg/jpeg/png/webp/gif/avif) — unknown extensions fall back to jpg for Tern Travel compatibility
- [Phase 03-01]: chrome.storage.local mock added to tests/setup.ts with beforeEach resets — defineBackground stub also added
- [Phase 03-02]: Bottom section (selection bar + form + download) only shown when scanStatus=done AND images.length > 0
- [Phase 03-02]: runDownloads only persists to chrome.storage.local when at least 1 download succeeded
- [Phase 03-02]: export reducer + initialState as named exports for direct unit testing without React rendering
- [Phase 03-03]: chrome.tabs.connect(tabId) required — chrome.runtime.connect() only reaches background, not content script
- [Phase 03-03]: Pre-number all basenames before Promise.allSettled to prevent parallel download race condition
- [Phase 03-03]: Lazy-load fallback order: srcset > data-srcset > img.src > data-src/data-lazy — covers booking.com and Next.js sites
- [Phase 03-03]: Use img.src (DOM property, absolute) not getAttribute('src') (raw, may be relative)
- [Phase 04-01]: Imgix guard uses .endsWith('.imgix.net') with leading dot to prevent notimgix.net false-positive
- [Phase 04-01]: Viator h=-1 is intentional per Viator Partner API (unconstrained height), not a bug
- [Phase 04-01]: GetYourGuide is pass-through stub — resize params unconfirmed, TODO left for DevTools audit
- [Phase 04-01]: Fastly IO omitted — no unique domain pattern, generic w/h params create false-positive risk
- [Phase 04]: Use upscaledUrl === url identity check as fast path in runDownloads — avoids try/catch overhead for non-CDN images
- [Phase 04]: CDN rewrite applied at download time only — thumbnails in popup grid remain at original extracted URLs
- [Phase 05]: PNG icons generated via Node.js-only script (zlib + manual chunk encoding) — zero new runtime deps
- [Phase 05]: Description set to 'Save photos with structured names.' (34 chars) — user-approved CWS copy
- [Phase 05]: privacy-policy.html uses [GITHUB_USERNAME] placeholder — must be replaced before enabling GitHub Pages
- [Phase 05-02]: Screenshot saved as .jpg by user (plan specified .png) — CWS accepts both, no action needed
- [Phase 05-02]: ZIP excluded from git (.output/ gitignored) — reproducible via npm run zip
- [Phase 05-02]: [GITHUB_USERNAME] placeholder retained in store-listing.md and privacy-policy.html — must be replaced before CWS submission
- [Phase 05-02]: Brand names (Booking.com, Airbnb, Viator) replaced with generic descriptions in store-listing.md per user request during Task 4 review
- [Phase 05-02]: Promo tile regenerated with Inter font (Google Fonts) for correct text rendering — original used system font stack which rendered differently across machines
- [Phase 999.1-01]: year inserted as 4th parameter in buildBasename between category and notes; App.tsx call site left unchanged until Plan 03

### Roadmap Evolution

- Phase 4 added: CDN URL upscaling — detect CDN image URL patterns (booking.com, Airbnb/Cloudinary, etc.) and rewrite URLs to request the highest available resolution before downloading
- Phase 5 added: Chrome Web Store Submission — prepare the extension for public distribution: icons, store listing copy, screenshots, privacy policy, manifest polish, and packaged ZIP ready to submit

### Pending Todos

None yet.

### Blockers/Concerns

- Confirm distribution path (unpacked vs. Web Store) before Phase 1 manifest is finalized
- Blob URL frequency on Viator/GetYourGuide unknown — needs DevTools audit during Phase 2
- Jennifer's category list and naming convention not yet validated with her — review before Phase 3 hardcodes them

## Session Continuity

Last session: 2026-03-21T16:45:38.135Z
Stopped at: Completed 999.1-01-PLAN.md
Resume file: None
