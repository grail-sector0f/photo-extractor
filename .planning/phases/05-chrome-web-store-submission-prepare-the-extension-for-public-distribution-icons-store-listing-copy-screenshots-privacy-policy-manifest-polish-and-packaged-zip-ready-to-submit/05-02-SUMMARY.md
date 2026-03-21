---
phase: 05-chrome-web-store-submission
plan: 02
subsystem: infra
tags: [chrome-web-store, zip, manifest, store-listing, screenshot, promo-tile]

requires:
  - phase: 05-01
    provides: icons (16/32/48/128 PNGs), manifest v1.0.0 with description, privacy-policy.html

provides:
  - docs/store-listing.md — finalized CWS copy (name, 34-char short desc, long desc, category)
  - scripts/generate-promo-tile.html — canvas-based 440x280 tile generator
  - docs/store-assets/promo-tile-440x280.png — 440x280 promotional tile
  - docs/store-assets/screenshot-01.jpg — popup-in-action screenshot on travel site
  - .output/photo-extractor-1.0.0-chrome.zip — store-ready extension package (59 KB, gitignored)

affects: [cws-submission-checklist, github-pages-setup]

tech-stack:
  added: []
  patterns:
    - "ZIP built by wxt zip — single command, deterministic output, gitignored"
    - "Store assets staged in docs/store-assets/ committed to git; build artifacts in .output/ are not"

key-files:
  created:
    - docs/store-listing.md
    - scripts/generate-promo-tile.html
    - docs/store-assets/promo-tile-440x280.png
    - docs/store-assets/screenshot-01.jpg
  modified: []

key-decisions:
  - "Screenshot saved as .jpg by user (plan specified .png) — functionally equivalent, CWS accepts both JPEG and PNG for screenshots"
  - "ZIP excluded from git per existing .gitignore (.output/) — reproducible on demand via npm run zip"
  - "[GITHUB_USERNAME] placeholder left in docs/store-listing.md and docs/privacy-policy.html — must be replaced before CWS submission"

patterns-established:
  - "All CWS text fields consolidated in docs/store-listing.md as single source of truth"

requirements-completed: [CWS-LISTING, CWS-PROMO, CWS-ZIP]

duration: 15min
completed: 2026-03-20
---

# Phase 5 Plan 02: Store Listing Copy, Screenshot, and ZIP Package Summary

**CWS submission assets complete: 440x280 promo tile, 1280x800 screenshot, store listing copy, and a 59 KB verified ZIP with manifest v1.0.0, correct description, four icon sizes, and no tabs permission.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-20T21:55:00Z
- **Completed:** 2026-03-20T21:57:00Z
- **Tasks:** 3 of 4 (Task 4 is a human-verify checkpoint — awaiting user review)
- **Files modified:** 4 (store-listing.md, generate-promo-tile.html, promo-tile-440x280.png, screenshot-01.jpg)

## Accomplishments

- Store listing copy finalized in `docs/store-listing.md` — name, 34-char short description, full long description mentioning all supported CDNs, Productivity category
- 440x280 promotional tile PNG generated and committed to `docs/store-assets/`
- 1280x800 screenshot captured by user and committed to `docs/store-assets/`
- ZIP built via `npm run zip` — 59 KB, contains manifest.json (v1.0.0, correct description, all four icons), background.js, popup files, content script, CSS
- All 143 vitest tests pass (no regressions)

## Task Commits

1. **Task 1: Create store listing copy and promotional tile** - `ec8318f` (feat)
2. **Task 2: Capture screenshot for CWS listing** - `a370f12` (feat — user-captured, committed by executor)
3. **Task 3: Build ZIP package and verify contents** - `50d47b3` (chore — verification record, ZIP gitignored)
4. **Task 4: Review submission assets before CWS upload** - PENDING (checkpoint:human-verify)

## Files Created/Modified

- `docs/store-listing.md` - All CWS dashboard text: name, short/long description, category, privacy policy URL placeholder
- `scripts/generate-promo-tile.html` - Canvas-based tile generator that draws the camera icon, "Photo Extractor" text, and tagline on a blue 440x280 canvas
- `docs/store-assets/promo-tile-440x280.png` - Generated 440x280 promotional tile
- `docs/store-assets/screenshot-01.jpg` - Screenshot showing popup in action on a travel site

## Decisions Made

- Screenshot saved as `.jpg` by user instead of `.png` as specified in the plan. CWS accepts both formats for screenshots, so this is functionally equivalent.
- ZIP file is excluded from git per `.gitignore` (`.output/`). It is reproducible on demand with `npm run zip` and does not need to be tracked.
- The `[GITHUB_USERNAME]` placeholder in `docs/store-listing.md` and `docs/privacy-policy.html` is intentional — it must be replaced with the actual GitHub username before CWS submission and before enabling GitHub Pages.

## Deviations from Plan

### Screenshot format

The plan specified `screenshot-01.png` but the user saved `screenshot-01.jpg`. CWS accepts JPEG for screenshots. No fix needed — noted for checklist.

---

**Total deviations:** 1 (screenshot format — .jpg vs .png, no functional impact)
**Impact on plan:** None. CWS accepts JPEG screenshots.

## Issues Encountered

None during automated tasks. ZIP built cleanly, all tests pass.

## User Setup Required

Before submitting to the Chrome Web Store, complete these steps in order:

1. **Replace GitHub username placeholder** in `docs/privacy-policy.html` and `docs/store-listing.md`:
   - Search for `[GITHUB_USERNAME]` and replace with your actual GitHub username

2. **Enable GitHub Pages** for the privacy policy URL:
   - GitHub repo Settings > Pages > Source: main branch, `/docs` folder
   - Wait 1-10 minutes for deploy
   - Verify: `https://[your-username].github.io/photo-extractor/privacy-policy.html` loads

3. **Register as CWS developer** (if not already done):
   - One-time $5 fee at https://chrome.google.com/webstore/devconsole/register

4. **Upload to CWS Developer Console:**
   - Upload `.output/photo-extractor-1.0.0-chrome.zip` (regenerate with `npm run zip` if needed)
   - Fill in store listing fields from `docs/store-listing.md`
   - Upload `docs/store-assets/promo-tile-440x280.png` as promotional tile
   - Upload `docs/store-assets/screenshot-01.jpg` as screenshot
   - Set Privacy Policy URL to your GitHub Pages URL

## Next Phase Readiness

This is the final plan in Phase 5. Once Task 4 (human-verify checkpoint) is approved:
- All CWS submission assets are ready
- Extension is ready for Chrome Web Store upload
- No further automated work required — submission is a manual process through the CWS Developer Console

---
*Phase: 05-chrome-web-store-submission*
*Completed: 2026-03-20*
