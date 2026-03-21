# Phase 5: Chrome Web Store Submission - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Prepare the extension for public distribution on the Chrome Web Store: create required icons, write store listing copy, produce a privacy policy, polish the manifest, and package a ZIP ready for submission. Does NOT include post-submission review handling or version update workflows.

</domain>

<decisions>
## Implementation Decisions

### Icon design
- Camera/photo symbol (simple, universally understood for a photo tool)
- Blue fill matching popup UI (#2563EB = Tailwind blue-600) with white foreground icon
- Must read clearly at 16px (the smallest required size)
- Required sizes: 16x16, 32x32, 48x48, 128x128 PNG
- All four sizes must be declared in the WXT manifest config so they appear in the browser toolbar and extension management page

### Store listing copy
- **Name:** Photo Extractor (keep — clear, descriptive, no keyword stuffing)
- **Short description (132 chars max):** "Save travel site photos with structured filenames. Extracts images that block right-click saving. For travel advisors and researchers."
- **Long description:** Explain the core workflow — browse travel site, open extension, scan page, select photos, fill in destination/vendor/category, download with formatted filenames. Mention Booking.com, Airbnb, Viator, GetYourGuide support.
- **Category:** Productivity
- **Language:** English (US)

### Privacy policy
- Host on GitHub Pages using a `/docs/privacy-policy.html` file in the repo
- Content must disclose: tabs permission (to read active tab URL for form pre-fill logic), downloads permission (to save files), storage permission (to persist last-used form values). No data leaves the device.
- URL format will be: `https://{github-username}.github.io/photo-extractor/privacy-policy.html`
- GitHub Pages must be enabled on the repo (Settings → Pages → source: main branch /docs folder)

### Manifest polish
- Version: bump to `1.0.0` in `wxt.config.ts` (or `package.json` — WXT picks it up from there)
- Description: use the short store description (132 chars) — same string in manifest and store listing
- Icons declared in manifest config (WXT handles the manifest.json generation)

### Distribution scope
- Public listing (not unlisted) — purpose is sharing with travel advisors
- No promotional tile required for initial submission (optional 440x280 asset)
- Screenshots: at least 1 required (1280x800). Show the popup open on a real travel site with images scanned and a naming form filled in.

### Claude's Discretion
- Exact icon SVG/canvas implementation approach
- Screenshot tooling (can use Chrome DevTools device emulation at 1280x800)
- Exact wording of the long store description beyond the key points above
- ZIP packaging command

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

### Chrome Web Store requirements (public docs — agent should check these)
- Icon sizes: 16, 32, 48, 128px PNG required
- Screenshot size: 1280x800 or 640x400 (at least 1, up to 5)
- Short description: 132 character max
- Privacy policy URL: required when extension requests any permission that accesses user data

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `wxt.config.ts` — manifest config lives here; icons and version go in the `manifest:` block
- `entrypoints/popup/App.tsx` — uses Tailwind `blue-600` (#2563EB) throughout; icon should match this color
- `.output/chrome-mv3/` — build output directory; ZIP is created from this folder's contents

### Established Patterns
- WXT handles manifest.json generation — never edit manifest.json directly, only `wxt.config.ts`
- Version comes from `package.json` `version` field — WXT reads it automatically; bump there, not in config

### Integration Points
- `public/` directory — WXT copies files from `public/` into the build output unchanged; icon PNG files go here
- `docs/` directory (new) — GitHub Pages source for privacy policy; separate from extension source

</code_context>

<specifics>
## Specific Ideas

- Extension is built for Jennifer Lin (travel advisor) but the store listing should speak to all travel advisors and travel researchers — not just one user
- "Extracts images that block right-click saving" is a key differentiator worth calling out in the listing
- The form pre-fill behavior (same site restores values, new site clears) is worth mentioning as a workflow feature

</specifics>

<deferred>
## Deferred Ideas

- Promotional tile (440x280 store graphic) — optional for first submission, can add later
- Localization of store listing into other languages — future
- Post-submission version update workflow — separate phase if needed

</deferred>

---

*Phase: 05-chrome-web-store-submission*
*Context gathered: 2026-03-21*
