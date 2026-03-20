# Stack Research

**Domain:** Chrome browser extension — image extraction tool
**Researched:** 2026-03-19
**Confidence:** MEDIUM-HIGH (Manifest V3 API details from official docs; framework comparisons from multiple 2025 sources)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| WXT | 0.20.x (latest) | Extension framework (scaffolding, builds, HMR, manifest generation) | Most actively maintained framework in 2025; Vite-based; framework-agnostic; bundles ~43% smaller than Plasmo; file-based entrypoint system similar to Next.js |
| TypeScript | 5.x (via WXT default) | Language | Chrome's `chrome.*` APIs have complex typings — TypeScript catches errors before you load the extension; WXT scaffolds TS by default |
| React | 18.x | Popup UI | The popup needs a small form (destination, vendor, category inputs + image grid). React is the right fit when you have more than 2-3 interactive fields. WXT has a first-class `@wxt-dev/module-react` integration |
| Tailwind CSS | 3.x | Styling | CSS purging keeps bundle size small inside the popup. No runtime overhead. Works cleanly with Vite |
| Manifest V3 | — | Extension manifest format | Required for Chrome Web Store submissions as of June 2025; all new extensions must use V3 |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@wxt-dev/module-react` | latest | WXT's React integration module | Use this instead of manually configuring React with WXT |
| `@types/chrome` | latest | TypeScript types for all Chrome extension APIs | Required — gives you autocomplete and type-checking on `chrome.downloads`, `chrome.runtime`, etc. |
| `webextension-polyfill` | latest | Promise-based wrapper over Chrome callback APIs | Optional but useful if you find callback-style `chrome.*` APIs verbose; WXT includes its own `browser` wrapper which covers this |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| WXT CLI (`npx wxt@latest init`) | Scaffolds project, runs dev server, builds and zips extension | Use `--template react-ts` for this project |
| Vite (bundled into WXT) | Build tool — fast HMR in dev, Rollup-based production builds | You do not install Vite separately; WXT manages it |
| Chrome DevTools (Extensions panel) | Inspect service worker, content scripts, and popup separately | Each context has its own DevTools pane — this is how you debug |

---

## Manifest V3 Constraints (Critical)

These are not optional — they affect architecture directly.

**Service worker replaces background page.**
The background script is now a service worker (`background.service_worker` in manifest). It has no access to the DOM, no `window` object, and no `XMLHttpRequest`. Use `fetch()` instead of XHR. The worker also terminates when idle — do not store state in memory between user actions. Use `chrome.storage.local` or `chrome.storage.session` instead.

**No remote code execution.**
You cannot load JavaScript from a URL at runtime. All logic must be bundled into the extension.

**Content Security Policy is stricter.**
The default CSP blocks inline scripts and remote resources. If you fetch image blobs in the background/service worker, configure `connect-src` in the manifest's `content_security_policy`.

**DOM access from the service worker requires an Offscreen Document.**
If you need to decode image data or draw to a canvas in the background, use the Chrome Offscreen API (`chrome.offscreen`). The service worker itself cannot touch the DOM at all. This is relevant if you need to process image bytes before saving — for simple URL-based saving, the offscreen document is not needed.

**Content scripts can read the full page DOM.**
This is where image extraction happens. Content scripts run in the page's context, can traverse the DOM, and can access computed styles. They communicate with the service worker via `chrome.runtime.sendMessage`.

---

## File Saving: Downloads API (Recommended)

**Use `chrome.downloads.download()`. Do not use the File System Access API.**

Here is why:

The **File System Access API** (`showSaveFilePicker`, `showDirectoryPicker`) is a browser web API, not a Chrome Extension API. It requires a user gesture on every call, shows a native file picker dialog each time, and is designed for browser tabs — not extension service workers. It does not work reliably from a popup or service worker context.

The **Chrome Downloads API** (`chrome.downloads`) is designed for extensions. It:
- Works from the service worker and popup contexts
- Accepts a `filename` parameter that can include subdirectory paths relative to the user's default Downloads folder (e.g., `"Photos/destination_vendor_category_01.jpg"`)
- Can show the system "save as" dialog if `saveAs: true` is passed
- Supports programmatic saves with no dialog when `saveAs: false`

**Limitation:** The Downloads API saves relative to the user's default Downloads folder only. You cannot save to an arbitrary path like `/Users/jennifer/Desktop/travel-photos`. Jennifer will need to set her default Downloads folder (in Chrome settings) to her preferred travel photos folder, or the extension can save to a subfolder inside Downloads like `Downloads/travel-photos/`.

**Manifest permission required:**
```json
"permissions": ["downloads"]
```

---

## Image Extraction Approach

This is the core technical problem: getting image URLs from pages that block right-click saving.

Right-click protection is implemented in JavaScript (event listeners blocking `contextmenu`) or CSS (`pointer-events: none` on overlays). Neither prevents a **content script** from reading the DOM directly — content scripts bypass JavaScript event restrictions because they execute independently.

**Extraction targets in priority order:**

1. `<img src>` and `<img srcset>` — use `img.currentSrc` to get the best-resolution URL the browser actually loaded
2. CSS `background-image` — use `window.getComputedStyle(element).backgroundImage` and extract the URL with a regex
3. `<picture>` / `<source srcset>` — walk the sources and pick the highest-resolution match
4. Lazy-loaded images — some sites use `data-src` or `data-lazy` attributes; query for these as fallback

**Communication pattern:**
- Popup sends a `GET_IMAGES` message to the content script via `chrome.tabs.sendMessage`
- Content script traverses DOM, collects all image URLs, sends them back
- Popup displays thumbnails for user to select
- On save, popup sends selected URL + naming metadata to service worker
- Service worker calls `chrome.downloads.download()` with constructed filename

---

## Installation

```bash
# Scaffold the project
npx wxt@latest init photo-extractor
# Choose: React, TypeScript

# Add Tailwind (manual setup after init)
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Types for Chrome APIs (WXT includes these, but verify)
npm install -D @types/chrome
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| WXT | Plasmo | Plasmo is fine for React-only teams who want more opinionated scaffolding; avoid it for new projects — the bundler (Parcel-based) is not actively maintained and produces larger bundles |
| WXT | Raw Vite + CRXJS plugin | Use this if you want more manual control and WXT feels too magic; CRXJS is a Vite plugin without a full framework layer |
| WXT | No build tool (vanilla HTML/JS) | Only viable for trivially simple extensions with no UI framework; the lack of TypeScript and HMR becomes painful quickly |
| React (18) | Preact | Use Preact if bundle size is critical (Preact is ~3KB vs React's ~130KB gzipped); for this project the form UI is complex enough that React's ecosystem (hooks, devtools) outweighs the size difference |
| chrome.downloads API | File System Access API | File System Access API is appropriate for full web apps (not extensions) that need persistent directory handles across sessions |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Manifest V2 | Deprecated; Chrome Web Store stopped accepting new MV2 extensions; existing ones disabled June 2025 | Manifest V3 |
| Plasmo | Parcel-based bundler is not actively maintained; produces 2x larger bundles than WXT; community reports maintenance concerns | WXT |
| XMLHttpRequest in service worker | Not available in MV3 service workers — will throw a ReferenceError | `fetch()` |
| `background.scripts` in manifest | MV2 syntax; causes manifest parse error in MV3 | `background.service_worker` |
| `chrome.fileSystem` API | This is a Chrome Apps API (deprecated product line, not extensions); Chrome Apps are dead | `chrome.downloads` |
| jQuery in content scripts | Adds unnecessary weight inside a content script that runs on every matched page | Vanilla DOM APIs (`querySelectorAll`, `getComputedStyle`) |

---

## Stack Patterns by Variant

**If distributing via Chrome Web Store:**
- All of the above applies
- Add a privacy policy (required if extension handles any user data)
- WXT's `wxt zip` command produces the store-ready package

**If distributing as an unpacked extension (developer mode only):**
- No store review process; Jennifer loads the `dist/` folder directly
- This is the fastest path for v1 — no review wait, no policy requirements
- Run `wxt build` and share the `dist/` folder

**If images need to be fetched as blobs (not just URL-saved):**
- The service worker can `fetch()` an image URL and convert it to a blob
- To convert blob to a downloadable file, write it to an object URL: `URL.createObjectURL(blob)` — but this requires a document context
- Use an Offscreen Document (`chrome.offscreen.createDocument`) for blob-to-objectURL conversion
- For most travel site images (standard `<img>` URLs), direct URL downloading via `chrome.downloads` is sufficient and avoids this complexity entirely

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| WXT 0.20.x | React 18, TypeScript 5, Vite 5 | WXT 0.20 is a pre-1.0 release candidate with breaking changes from 0.19; check WXT changelog before upgrading mid-project |
| Tailwind 3.x | Vite 5 (PostCSS plugin) | Tailwind 4 uses a different config system — stick with 3.x for now unless you want to deal with migration |
| @types/chrome | Chrome MV3 APIs | These are maintained by DefinitelyTyped; updated regularly; install `@types/chrome@latest` |

---

## Sources

- [The 2025 State of Browser Extension Frameworks](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/) — WXT vs Plasmo vs CRXJS comparison; MEDIUM confidence (community analysis, not official)
- [WXT Official Site](https://wxt.dev/) — Framework overview and getting started; HIGH confidence
- [WXT on GitHub](https://github.com/wxt-dev/wxt) — Version info (0.20.x); HIGH confidence
- [WXT npm package](https://www.npmjs.com/package/wxt/v/0.15.1?activeTab=versions) — Version history; HIGH confidence
- [Chrome Downloads API reference](https://developer.chrome.com/docs/extensions/reference/api/downloads) — filename path behavior, permissions; HIGH confidence
- [Migrate to service workers (MV3)](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers) — MV3 service worker constraints; HIGH confidence
- [Build Chrome Extensions with React and Vite 2025](https://arg-software.medium.com/building-a-chrome-extension-with-react-and-vite-a-modern-developers-guide-83f98ee937ed) — Ecosystem patterns; LOW confidence (Medium article, unverified)
- [Chrome Extension Framework Comparison 2025](https://www.devkit.best/blog/mdx/chrome-extension-framework-comparison-2025) — Framework comparison; MEDIUM confidence

---

*Stack research for: Chrome extension image extraction tool (Photo Extractor)*
*Researched: 2026-03-19*
