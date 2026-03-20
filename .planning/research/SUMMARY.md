# Project Research Summary

**Project:** Photo Extractor — Chrome Extension for Travel Advisor Workflow
**Domain:** Chrome browser extension (image extraction + structured local file saving)
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

Photo Extractor is a purpose-built Chrome extension that solves a specific workflow problem: Jennifer Lin, a travel advisor, visits hotel and activity sites to curate photos for her tern.travel workflow, but those sites block right-click saving and produce files with garbage names. The tool extracts images from any web page via DOM scanning, presents a visual gallery for selection, and saves files to the local filesystem with structured names (destination_vendor_category_index). This is a well-understood extension pattern with clear technical constraints — the main risks are in the Chrome MV3 migration quirks and the complexity of image extraction on modern travel sites.

The recommended approach is WXT + React + TypeScript + Tailwind, built on Manifest V3. WXT is the most actively maintained extension framework in 2025, produces the smallest bundles, and handles the scaffolding complexity (manifest generation, HMR, build pipeline). The core technical challenge is not the UI — it is reliable image extraction across lazy-loaded, JS-heavy travel sites like Viator, GetYourGuide, and Airbnb. Those sites use CSS backgrounds, srcset responsive images, and lazy-load patterns that defeat a naive `querySelectorAll('img')` scan. The content script must check six image sources and use a MutationObserver.

The top risk is building on incorrect MV3 patterns. Most tutorials are still V2. Specific traps: service worker state is wiped after 30 seconds of idle (never store form data in global variables), content scripts cannot call `chrome.downloads` (must message the service worker), and the content script's contextmenu override must use the capture phase or the site's block fires first. These are all avoidable if the architecture is established correctly before any feature code is written.

---

## Key Findings

### Recommended Stack

WXT provides the right foundation for this project. It is Vite-based, generates MV3-compliant manifests automatically, includes HMR for faster iteration, and produces ~43% smaller bundles than Plasmo (the other popular option). React 18 is appropriate for the popup UI given the interactive form plus image grid. TypeScript catches the most common MV3 API misuse errors before they cause silent failures. Tailwind keeps the popup bundle small via CSS purging.

The Downloads API (`chrome.downloads`) is the only viable path for saving files from an extension. The File System Access API does not work from a service worker or popup. Downloads are constrained to the user's Downloads folder, but subdirectory paths via the `filename` parameter (e.g., `"TravelPhotos/Japan/park-hyatt-tokyo/file.jpg"`) give sufficient organization. This is a design constraint that needs to be communicated to Jennifer before build, not discovered after.

**Core technologies:**
- WXT 0.20.x: extension framework — Vite-based, MV3-native, smallest bundles, most maintained
- TypeScript 5.x: language — Chrome API typings catch errors at write time, not runtime
- React 18: popup UI — right choice for multi-field interactive form with image grid
- Tailwind CSS 3.x: styling — CSS purging keeps popup bundle small; do not use Tailwind 4 yet
- Manifest V3: required — Chrome Web Store stopped accepting MV2 extensions June 2025

### Expected Features

The key differentiator is structured naming. All existing image downloader extensions (Image Downloader, Imageye, Download All Images) are generic bulk tools with no naming system. None combine right-click bypass + structured naming + category tagging in one tool. That gap is the entire value proposition.

**Must have (table stakes):**
- Image detection: `<img>` tags, CSS background-image, srcset/picture highest-res — travel sites use all three
- Visual thumbnail gallery with checkboxes before any download happens
- Dimension filter (default 400px minimum) — removes icons and UI chrome from results
- Naming form: destination, vendor, category dropdown — the core differentiator
- Download to local folder with pattern `destination_vendor_category_index.ext`
- Session memory (pre-fill last-used values) — critical for multi-page hotel research sessions
- Right-click protection bypass via capture-phase event override + CSS pointer-events reset

**Should have (v1.x after validation):**
- Subfolder per destination — group all Kyoto images under `/Kyoto/`
- Configurable category list — Jennifer can add categories without a code change
- Scroll-to-load helper — trigger auto-scroll before scan to capture lazy-loaded images

**Defer (v2+):**
- tern.travel direct integration — high value once local workflow is validated
- Multiple user profiles — not needed for single-user tool
- Custom naming template editor — fixed pattern is sufficient for v1

### Architecture Approach

The extension has three hard-separated contexts with explicit communication boundaries. The content script runs inside the page's DOM and collects image URLs — it cannot call Chrome privileged APIs. The service worker runs in the background, can call Chrome APIs including `chrome.downloads`, but has no DOM access and is non-persistent. The popup handles the UI, talks to both via message passing. This separation is not a design choice — it is a hard MV3 constraint that cannot be worked around.

**Major components:**
1. Popup (popup.html + popup.js) — naming form, image grid UI, triggers scan and download
2. Content Script (content_script.js) — injected at document_start, multi-source image scan, right-click bypass
3. Service Worker (service_worker.js) — receives download requests, builds filenames, calls chrome.downloads API

### Critical Pitfalls

1. **MV2 patterns** — tutorials are still V2; start with `"manifest_version": 3` and service worker from day one or the whole foundation is wrong
2. **Service worker state loss** — global variables in background.js are wiped after 30 seconds idle; store all form state in `chrome.storage.session` or `chrome.storage.local`, never in memory
3. **Content script CORS on fetch** — fetching image URLs from the content script fails on ~50% of travel sites due to CDN CORS headers; send URLs to service worker and let it handle downloads
4. **Lazy-loaded images missed** — `querySelectorAll('img')` returns placeholder GIFs on Viator and Airbnb; check `data-src`, `data-lazy-src`, `srcset`, and computed `background-image` plus wire a MutationObserver
5. **Async listener registration in service worker** — registering `chrome.runtime.onMessage` inside a `.then()` or after an `await` causes missed events; all listeners must be synchronous at the top level of service_worker.js

---

## Implications for Roadmap

### Phase 1: Scaffold and Architecture Foundation
**Rationale:** Architecture mistakes (MV2 patterns, wrong state management, wrong permission model) are expensive to fix mid-build. Every pitfall flagged as "Phase 1" converges here. Get the skeleton right before any feature code is written.
**Delivers:** Loadable extension in Chrome with correct MV3 manifest, no errors, correct permission model, storage pattern established
**Addresses:** Manifest setup, permissions model (`activeTab` not `<all_urls>`), service worker listener registration pattern, Downloads folder constraint documented for Jennifer
**Avoids:** MV2 pattern trap, service worker state loss, async listener registration bug, Web Store permissions rejection

### Phase 2: Image Extraction Core
**Rationale:** This is the highest technical risk in the project. Validate the extraction logic before building UI around it — a broken extractor makes the popup useless. Test on actual target sites (Viator, GetYourGuide, Airbnb) early.
**Delivers:** Content script that reliably extracts images from real travel sites including lazy-loaded, CSS background, and srcset images
**Uses:** Content script with multi-source scanner (img src, data-src, data-lazy-src, srcset, background-image), MutationObserver for dynamic content, capture-phase contextmenu override
**Implements:** Content script component; establishes content-script-to-service-worker message pattern
**Avoids:** Lazy-load miss, CSS background miss, srcset low-res problem, blob URL failures, CORS failures from content script fetch

### Phase 3: Popup UI and Naming Workflow
**Rationale:** Build the UI layer once image URLs are confirmed correct. The form + gallery is straightforward React work with low technical risk.
**Delivers:** Working popup with image grid, naming form (destination/vendor/category dropdown), select/deselect, session memory, download trigger
**Uses:** React 18, Tailwind CSS, chrome.storage.local for session memory
**Implements:** Popup component; service worker download pipeline
**Avoids:** Form state lost on service worker restart (solved in Phase 1 storage pattern)

### Phase 4: Polish and Edge Cases
**Rationale:** After core flow works end-to-end, address the failure modes that will show up on real sites.
**Delivers:** Robust experience — download feedback, filename collision handling, image count badge, dimension filter UI, error states for failed downloads
**Addresses:** UX pitfalls (no feedback, icon pollution, filename collisions), blob URL edge case, subfolder organization
**Note:** This is where the "Looks Done But Isn't" checklist from PITFALLS.md gets run against real target sites

### Phase Ordering Rationale

- Architecture-first ordering is driven directly by the pitfall research — all 9 critical pitfalls have "Phase 1" or "Phase 2" as their prevention phase. The patterns need to be right before feature code goes in.
- Content script extraction is separated into its own phase because it is the highest-risk technical component. It must be testable independently (via DevTools console injection) before the popup is wired to it.
- The naming/UI phase comes third because it depends on confirmed-working image URLs. Building the gallery before extraction works means building against a moving target.
- Polish is last because edge cases (blob URLs, CORS failures, filename sanitization) should not block the core workflow validation.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Blob URL handling on specific travel sites — blob URL behavior is site-specific; needs testing on Viator and GetYourGuide specifically before implementation approach is locked. Also verify whether hotlink protection on hotel CDNs affects service worker fetches.
- **Phase 4:** Chrome Web Store submission process — if Jennifer wants to distribute via the store (vs. unpacked), the review timeline and policy requirements need scoping before committing to a public release.

Phases with standard patterns (skip research-phase):
- **Phase 1:** MV3 scaffold is fully documented in official Chrome docs; WXT handles most of the complexity
- **Phase 3:** React + Tailwind popup UI is standard web development; no extension-specific unknowns

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | WXT, React, MV3 all backed by official docs and active 2025 community sources; version compatibility verified |
| Features | MEDIUM | Competitor analysis from web search; no direct user interviews with Jennifer; MVP scope is opinionated but reasonable |
| Architecture | HIGH | Based entirely on official Chrome developer documentation; component boundaries and message patterns are well-documented constraints |
| Pitfalls | HIGH | Most pitfalls verified against official Chrome docs; MV3 migration guide, service worker constraints, and CORS behavior are documented facts not inferences |

**Overall confidence:** HIGH

### Gaps to Address

- **Blob URL frequency on target sites:** Research notes blob URLs as a known edge case but doesn't confirm how common they are on Viator, GetYourGuide, and Airbnb specifically. Verify in Phase 2 with a manual DevTools audit of those sites before implementing the blob handling path.
- **Hotlink protection behavior:** Server-side hotlink protection is flagged as MEDIUM confidence — some CDNs may block service worker fetches even though extension service workers bypass CORS. Test on at least one hotel booking site CDN before Phase 2 is complete.
- **Jennifer's workflow validation:** Feature decisions are based on inferred workflow (no direct user interview). The category dropdown list and naming convention should be reviewed with Jennifer before Phase 3 builds them as hardcoded values.
- **Chrome Web Store vs. unpacked distribution:** Research notes both paths but the choice affects Phase 1 manifest design (optional permissions pattern is required for store submission). Confirm distribution intent before Phase 1 ships.

---

## Sources

### Primary (HIGH confidence)
- [Chrome Extension Content Scripts — Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — component boundaries, message passing
- [Migrate to Service Workers — Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers) — MV3 service worker constraints
- [chrome.downloads API reference](https://developer.chrome.com/docs/extensions/reference/api/downloads) — download API parameters, filename behavior
- [Declare Permissions — Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) — activeTab, scripting, downloads permissions
- [WXT Official Site](https://wxt.dev/) — framework overview
- [WXT on GitHub](https://github.com/wxt-dev/wxt) — version info (0.20.x)

### Secondary (MEDIUM confidence)
- [The 2025 State of Browser Extension Frameworks](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/) — WXT vs Plasmo bundle size comparison
- [Chrome Extension Framework Comparison 2025](https://www.devkit.best/blog/mdx/chrome-extension-framework-comparison-2025) — framework tradeoffs
- [Top 10 Best Image Downloader Chrome Extensions 2026 — Tenorshare](https://4ddig.tenorshare.com/photo-tips/image-downloader-chrome-extension.html) — competitor feature analysis
- [Image Downloader — PactInteractive GitHub](https://github.com/PactInteractive/image-downloader) — reference implementation

### Tertiary (LOW confidence)
- [Build Chrome Extensions with React and Vite 2025 — Medium](https://arg-software.medium.com/building-a-chrome-extension-with-react-and-vite-a-modern-developers-guide-83f98ee937ed) — general ecosystem patterns; unverified

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
