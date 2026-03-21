---
phase: 05-chrome-web-store-submission-prepare-the-extension-for-public-distribution-icons-store-listing-copy-screenshots-privacy-policy-manifest-polish-and-packaged-zip-ready-to-submit
plan: 01
subsystem: infra
tags: [chrome-extension, icons, png, manifest, wxt, privacy-policy, cws]

# Dependency graph
requires:
  - phase: 03-popup-and-naming
    provides: final permissions list (downloads, storage only) used in privacy policy
  - phase: 04
    provides: completed extension feature set that this plan is packaging for submission
provides:
  - Four PNG icons (16, 32, 48, 128px) with blue camera design for Chrome toolbar and CWS listing
  - wxt.config.ts with CWS-compliant description and manifest icons declaration
  - package.json at version 1.0.0 with zip script
  - docs/privacy-policy.html disclosing downloads and storage permissions only
affects: [05-02-packaging, cws-submission]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Node.js-only PNG generation using zlib.deflateSync + manual PNG chunk encoding — no canvas or image library needed"
    - "icons declared in wxt.config.ts manifest block; WXT reads version from package.json automatically"
    - "docs/ folder used for GitHub Pages hosting of privacy policy"

key-files:
  created:
    - scripts/generate-icons.js
    - scripts/generate-icons.html
    - public/icon-16.png
    - public/icon-32.png
    - public/icon-48.png
    - public/icon-128.png
    - docs/privacy-policy.html
  modified:
    - wxt.config.ts
    - package.json

key-decisions:
  - "PNG icons generated via Node.js-only script (zlib + manual chunk encoding) rather than Canvas API or npm dependency — zero new runtime deps"
  - "Description set to 'Save photos with structured names.' (34 chars) — user-approved CWS copy, well within 132-char limit"
  - "privacy-policy.html uses [GITHUB_USERNAME] placeholder — must be replaced before enabling GitHub Pages"
  - "No tabs permission added to manifest — policy and manifest are consistent"

patterns-established:
  - "Icon generation: scripts/ contains Node.js generator; public/ holds compiled PNGs; both committed together"
  - "Privacy policy lives in docs/ so GitHub Pages can serve it at /privacy-policy.html without extra config"

requirements-completed: [CWS-ICONS, CWS-MANIFEST, CWS-PRIVACY]

# Metrics
duration: 10min
completed: 2026-03-20
---

# Phase 05 Plan 01: Icons, Manifest Polish, and Privacy Policy Summary

**Blue camera PNG icons at 16/32/48/128px, CWS-compliant manifest description and icons block, version bumped to 1.0.0, and privacy policy HTML ready for GitHub Pages**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-20T21:35:00Z
- **Completed:** 2026-03-20T21:38:30Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Generated four PNG icons using a dependency-free Node.js script (zlib-based PNG encoding); all confirmed valid by `file` command with correct dimensions
- Updated `wxt.config.ts` with 34-char CWS description and `manifest.icons` block pointing to all four sizes; no `tabs` permission added
- Bumped `package.json` version to 1.0.0 and added `wxt zip` script
- Created `docs/privacy-policy.html` disclosing only `downloads` and `storage` permissions; no analytics, no third-party services mentioned; ready for GitHub Pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate icon PNGs, update manifest and package.json** - `b615bed` (feat)
2. **Task 2: Create privacy policy HTML for GitHub Pages** - `1a39bb2` (feat)

**Plan metadata:** (docs commit — see final_commit below)

## Files Created/Modified

- `scripts/generate-icons.js` - Node.js PNG generator using only zlib and fs; writes blue camera icon at all four sizes
- `scripts/generate-icons.html` - Browser-based canvas version for visual preview / manual regeneration
- `public/icon-16.png` - 16x16 RGBA PNG icon
- `public/icon-32.png` - 32x32 RGBA PNG icon
- `public/icon-48.png` - 48x48 RGBA PNG icon
- `public/icon-128.png` - 128x128 RGBA PNG icon
- `wxt.config.ts` - Updated description (34 chars) and added manifest.icons block; no tabs permission
- `package.json` - Version 1.0.0, added zip script
- `docs/privacy-policy.html` - CWS-required privacy policy; discloses only downloads and storage permissions

## Decisions Made

- Used Node.js-only PNG encoding (zlib.deflateSync + manual chunk/CRC assembly) instead of npm libraries like `canvas` or `sharp` — keeps zero new runtime dependencies and works reliably without build tools
- Icon generator script committed alongside PNGs so icons can be regenerated in future without external tooling
- `[GITHUB_USERNAME]` left as placeholder in privacy policy contact link — flagged for user to replace before enabling GitHub Pages

## Deviations from Plan

The plan's Task 1 proposed creating `scripts/generate-icons.html` and manually downloading PNGs via a browser. Since this executor runs automated (no interactive browser), the approach was changed to a Node.js script that generates identical PNG binary data programmatically. The visual design is the same; the generation method differs.

This is a **Rule 3 (blocking)** auto-adaptation — the manual browser step would have required a checkpoint/human-action gate, but the fully automated Node.js approach produces the same artifacts with verified dimensions.

**Total deviations:** 1 (approach substitution for icon generation — equivalent output)
**Impact on plan:** No scope change. All artifacts match plan spec exactly. All acceptance criteria pass.

## Issues Encountered

None — all verification commands passed on first attempt.

## User Setup Required

Before the privacy policy URL is live, you need to:

1. Replace `[GITHUB_USERNAME]` in `docs/privacy-policy.html` with your actual GitHub username
2. In your GitHub repo Settings, go to Pages and set source to main branch, /docs folder
3. The policy will then be available at `https://[your-username].github.io/photo-extractor/privacy-policy.html`

This URL is what you'll enter in the Chrome Web Store submission form.

## Next Phase Readiness

- All CWS-required icon assets are in place and referenced in the manifest
- Extension is at version 1.0.0 — correct for initial store submission
- Privacy policy is written; just needs GitHub username and Pages enabled
- Ready for Phase 05-02: package the ZIP and prepare the store listing

---
*Phase: 05-chrome-web-store-submission*
*Completed: 2026-03-20*
