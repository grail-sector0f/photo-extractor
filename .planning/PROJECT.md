# Photo Extractor

## What This Is

A Chrome browser extension that lets Jennifer (Travel Out of Office) extract photos from any travel website — including sites that block right-click saving — and save them locally with consistent, searchable filenames. Photos are organized by destination, property/vendor, and category so they can be easily found and reused across future client itineraries in tern.travel.

## Core Value

Jennifer can grab any photo she sees while browsing travel sites and have it saved, named, and ready to drop into a tern.travel itinerary without friction.

## Requirements

### Validated

- [x] Extract images from any webpage, including right-click protected ones — Validated in Phase 02: image-extraction (srcset, img tags, CSS backgrounds)
- [x] Works as a Chrome browser extension (no terminal required) — Validated in Phase 02: content script port messaging wired

### Active

- [ ] Extract images from any webpage, including right-click protected ones
- [ ] Works as a Chrome browser extension (no terminal required)
- [ ] User fills in destination, property/vendor, and category before saving
- [ ] Files are named consistently: `destination_vendor_category_[index]` format
- [ ] Photos saved to a local folder on Jennifer's machine
- [ ] Handles major travel site types: hotels, tour operators, travel blogs, booking platforms (Viator, GetYourGuide, Airbnb)

### Out of Scope

- Safari support — Chrome only for v1
- Auto-detecting destination/vendor from page — manual input keeps it accurate
- Direct tern.travel integration — local folder + manual import is the workflow
- Cloud storage / sync — local files only for now

## Context

- End user is Jennifer Lin, a non-technical travel advisor who builds custom client itineraries using tern.travel
- Jennifer browses hotel sites, tour operator sites, travel blogs, and booking platforms (Viator, GetYourGuide, Airbnb) to curate photos
- Many of these sites block right-click saving via CSS or JavaScript — the extension needs to bypass this at the DOM/network level
- Photos end up in a local folder, then manually imported into tern.travel for client itinerary documents
- Searchability is a key workflow need: Jennifer reuses photos across multiple client itineraries, so filenames that include destination + vendor + category make them findable months later

## Constraints

- **Platform**: Chrome extension only — Jennifer uses Chrome
- **User skill**: Extension must be usable by a non-technical user; no terminal interaction after initial setup
- **Distribution**: Can be loaded as an unpacked extension (developer mode) or published to Chrome Web Store
- **Storage**: Photos saved to local filesystem — no backend, no accounts, no cloud

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Chrome extension (not desktop app) | Zero context-switching — extract while browsing, not after | — Pending |
| Manual naming form (not auto-detect) | Auto-detection is unreliable across different site structures | — Pending |
| Local folder storage (not cloud) | Simpler, no auth required, matches Jennifer's existing tern.travel import workflow | — Pending |

---
*Last updated: 2026-03-20 — Phase 02 complete: image extraction layer fully built and tested (62 tests green)*
