# Pitfalls Research

**Domain:** Chrome extension for image extraction and local file saving
**Researched:** 2026-03-19
**Confidence:** HIGH (most findings backed by official Chrome documentation and verified across multiple sources)

---

## Critical Pitfalls

### Pitfall 1: Building on Manifest V2 (Already Deprecated)

**What goes wrong:**
You start development using V2 patterns — persistent background page, `background.scripts`, `blocking` webRequest — and everything works locally. Then you go to publish or update and Chrome refuses, or existing users start getting warnings that the extension is deprecated.

**Why it happens:**
Most tutorials, Stack Overflow answers, and blog posts are written for V2. The top search results for "Chrome extension background page" still return V2 examples. Developers copy these examples without checking the manifest version.

**How to avoid:**
Start with `"manifest_version": 3` from day one. Replace background page with `"background": { "service_worker": "background.js" }`. Never use `persistent: true` — it is not valid in MV3. MV2 extensions were disabled for regular users starting June 2024 and all MV2 extensions are being phased out through 2025.

**Warning signs:**
- `manifest.json` contains `"manifest_version": 2`
- `background.scripts` array instead of `service_worker`
- `persistent: true` in background config
- Using `chrome.webRequest` with `blocking` mode

**Phase to address:**
Phase 1 (Extension scaffold and manifest setup) — get this right before writing any functional code.

---

### Pitfall 2: Service Worker State Loss Between Events

**What goes wrong:**
The extension popup opens, user fills in destination/vendor/category, closes the popup to look at the page, then clicks Extract. By the time the extract runs, the service worker has been terminated and all in-memory state (the form values) is gone.

**Why it happens:**
MV3 service workers are non-persistent. Chrome terminates them after ~30 seconds of inactivity. Any global variables in `background.js` are wiped when this happens. V2 background pages stayed alive — V3 service workers do not.

**How to avoid:**
Never store state in service worker global variables. Use `chrome.storage.session` (cleared on browser restart, survives service worker termination within a session) or `chrome.storage.local` (persists across restarts) for anything that needs to survive between events. Form values the user enters should be written to storage immediately on change, not held in memory.

**Warning signs:**
- Global `let formData = {}` in background.js
- State passed only via message and not persisted
- Works in testing, fails after leaving extension idle for 30+ seconds

**Phase to address:**
Phase 1 (Extension scaffold) — establish the storage pattern before building any UI that holds state.

---

### Pitfall 3: Content Script CORS Blocks on Image Fetch

**What goes wrong:**
Content script tries to `fetch()` an image URL to download it. The request is treated as a cross-origin request from the page's origin, and the server's CORS headers block it. The image is visible on screen but cannot be fetched.

**Why it happens:**
Content scripts run in the context of the web page (for DOM access) but fetch requests from content scripts carry the page's origin as the requester. Many image CDNs and hotel/travel sites don't set permissive CORS headers because they don't expect cross-origin image fetching.

**How to avoid:**
Do not fetch images from content scripts. Instead, send the image URL to the background service worker via `chrome.runtime.sendMessage`, and fetch from the service worker. Extension service workers are not subject to the same CORS restrictions — they operate outside the page origin context. Then use `chrome.downloads.download()` from the service worker to trigger the actual save.

**Warning signs:**
- `fetch()` calls inside `content.js` or content script files
- Console errors: `Access to fetch at '...' from origin '...' has been blocked by CORS policy`
- Works on some sites, fails on others (inconsistent = CORS)

**Phase to address:**
Phase 2 (Image extraction core) — establish the content script -> background worker message pattern before implementing any download logic.

---

### Pitfall 4: Lazy-Loaded Images Missing from Initial DOM Scan

**What goes wrong:**
The extension scans `document.querySelectorAll('img')` and returns 4 images on a hotel page that clearly shows 40+. The rest haven't loaded yet because the page uses lazy loading — images are only inserted into the DOM (or have their `src` set) as the user scrolls.

**Why it happens:**
Modern travel sites — Viator, GetYourGuide, Airbnb, hotel booking engines — almost universally use lazy loading for performance. Images use `data-src`, `data-lazy`, or have no `src` at all until they enter the viewport. A one-time DOM scan at popup open misses everything below the fold.

**How to avoid:**
Two-part approach: (1) Use `MutationObserver` in the content script to watch for new images added to the DOM or `src` attribute changes on existing images. (2) Provide a way for the user to scroll the page (which triggers lazy loading) before extracting. Also check `data-src`, `data-original`, `data-lazy-src`, and `data-srcset` attributes, not just `src`. For `<picture>` elements, check all `<source>` srcset values.

**Warning signs:**
- Image count in extension popup is far lower than visible on page
- Refreshing the popup after scrolling shows more images
- Site uses `loading="lazy"` attribute on img tags

**Phase to address:**
Phase 2 (Image extraction core) — the MutationObserver pattern needs to be built into the initial image discovery logic, not retrofitted later.

---

### Pitfall 5: Missing Images from CSS Backgrounds, srcset, and Non-img Elements

**What goes wrong:**
`querySelectorAll('img')` only catches `<img>` tags. Many hotel and travel sites use CSS `background-image` for hero images, `<picture>` elements with multiple `<source>` tags for responsive images, and `srcset` attributes that point to higher-resolution versions than `src`. The extension extracts low-res thumbnails or misses primary images entirely.

**Why it happens:**
Developers assume all images are `<img>` tags. Travel sites are visually image-heavy and use every available pattern for performance and responsiveness. Viator and GetYourGuide in particular use CSS backgrounds for category imagery.

**How to avoid:**
Build a multi-source image collector:
- `document.querySelectorAll('img')` — check both `src` and `srcset`, take the highest-resolution candidate from srcset
- `document.querySelectorAll('picture source')` — check `srcset`
- CSS background images — use `getComputedStyle(el).backgroundImage` on key container elements
- `<meta property="og:image">` — often the canonical, full-resolution version of the hero image

For srcset, parse the descriptor and pick the largest width or highest density option.

**Warning signs:**
- Hero images on pages aren't appearing in extracted list
- Only small thumbnails extracted, not full-size versions
- Extension misses images on Viator/GetYourGuide category pages

**Phase to address:**
Phase 2 (Image extraction core) — needs to be part of the image discovery spec from the start, not a later enhancement.

---

### Pitfall 6: Blob URLs and Canvas-Rendered Images Are Not Downloadable via URL

**What goes wrong:**
Some images show up in extraction with URLs like `blob:https://www.viator.com/abc123-...` or are rendered via `<canvas>`. Passing a blob URL to `chrome.downloads.download()` fails — blob URLs are scoped to the tab that created them and are revoked when the tab navigates or the creating context is gone.

**Why it happens:**
Sites use blob URLs for images loaded via JavaScript (XHR/fetch then converted to object URLs) to prevent direct linking. Canvas rendering is used for watermarked images or custom map tiles. Neither produces a stable URL you can simply download.

**How to avoid:**
For blob URLs: detect them in the content script (URL starts with `blob:`), then use `fetch()` on the blob URL from within the content script (where the blob is still valid), convert to an ArrayBuffer, send to the background service worker via messaging, then construct a new data URL or use the downloads API with a data: URI. Note: This only works for blobs that haven't been revoked.

For canvas images: use `canvas.toBlob()` or `canvas.toDataURL()` in the content script to extract the pixel data, then send to background for download.

**Warning signs:**
- Image URLs in the DOM start with `blob:`
- `chrome.downloads.download()` fails with "Invalid URL"
- Page uses `URL.createObjectURL()` calls visible in DevTools

**Phase to address:**
Phase 2 (Image extraction core) — blob URL handling needs explicit detection and a separate code path.

---

### Pitfall 7: Local File Save Path Is Locked to the Downloads Folder

**What goes wrong:**
Jennifer expects to save images directly to a specific folder like `~/Documents/Jennifer Travel Photos/`. The extension can only save to Chrome's configured Downloads folder or subdirectories within it. There is no way for an extension to write to an arbitrary path on the filesystem without user interaction.

**Why it happens:**
Chrome's security model explicitly prevents extensions from writing to arbitrary filesystem paths. `chrome.downloads.download()` only accepts paths relative to the user's Downloads directory. The old `chrome.fileSystem` API was Chrome Apps only and is deprecated. The File System Access API requires active user interaction (a file picker) and cannot be initiated programmatically by an extension.

**How to avoid:**
Accept this constraint. Design the workflow around the Downloads folder: save to `Downloads/TravelPhotos/[destination]/[vendor]/`. Document clearly for Jennifer that photos will appear in a subfolder of Downloads. If she needs them elsewhere, she moves the folder once. Optionally provide a `saveAs: true` flag on downloads so Chrome shows the Save dialog and she can choose the location manually.

**Warning signs:**
- Any plan to save to `~/Documents/` or a user-configured arbitrary path
- Designs that assume programmatic folder selection without user interaction

**Phase to address:**
Phase 1 (Project scoping/design) — this constraint should inform the UX design before any code is written, not be discovered mid-build.

---

### Pitfall 8: Chrome Web Store Rejection for Broad Permissions

**What goes wrong:**
Extension declares `"host_permissions": ["<all_urls>"]` to handle any travel site. Review rejects or flags the extension for requesting excessive permissions. Even with a valid use case, the review process scrutinizes broad host permissions heavily.

**Why it happens:**
Google's review policy requires minimum necessary permissions. Extensions requesting `<all_urls>` without a compelling justification get flagged. Over 40% of rejections involve permission scope issues.

**How to avoid:**
Use `optional_host_permissions` in MV3 for the broad site access. The extension requests access only when the user is on a tab they want to extract from — this is the intended pattern. Declare `activeTab` permission, which grants access to the current tab when the user explicitly clicks the extension icon, without requiring broad host permissions. This is the right architecture for this use case and avoids Web Store scrutiny.

**Warning signs:**
- `"host_permissions": ["<all_urls>"]` in manifest without `optional_host_permissions` alternative
- No use of `activeTab` permission

**Phase to address:**
Phase 1 (Manifest design) — choose the `activeTab` pattern upfront. Retrofitting permission architecture later is painful.

---

### Pitfall 9: Event Listeners Registered Asynchronously in Service Worker

**What goes wrong:**
Service worker starts up, does some async initialization (reads from storage, etc.), then registers its message/click listeners inside a `.then()` or after `await`. Chrome dispatches the event before the listener is registered — event is missed. This shows up as the extension not responding intermittently.

**Why it happens:**
Chrome initializes the service worker and immediately dispatches pending events. Listeners must be registered synchronously at the top level of the script, before any awaits. Any listener registered inside an async function after an await may miss events that fired during startup.

**How to avoid:**
Register all `chrome.runtime.onMessage.addListener`, `chrome.action.onClicked.addListener`, etc. at the top level of the service worker file, synchronously, before any async operations. Move async initialization logic into the handler itself, not before listener registration.

**Warning signs:**
- Event listeners inside `async function init() { await...; chrome.runtime.onMessage.addListener(...) }`
- Extension click handler works the first time, stops working after idle period

**Phase to address:**
Phase 1 (Extension scaffold) — establish this pattern in the initial background.js before any feature logic is added.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `<all_urls>` host permission | Works on any site immediately | Web Store rejection risk; user concern | Never — use `activeTab` instead |
| Fetch images from content script | Simpler code, no messaging | CORS failures on ~50% of travel sites | Never for downloads |
| Storing form state in global variables | Simple to read/write | State lost after 30s idle, user data loss | Never — use chrome.storage |
| One-time DOM scan on popup open | Easy to implement | Misses lazy-loaded images | Never on travel sites |
| Hardcode save path to Downloads root | Skips UX complexity | Files scattered, not organized | Only as fallback |
| Skip blob URL handling | Faster MVP | Silent failures on JS-heavy sites | Only if those sites aren't in scope |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `chrome.downloads` API | Passing absolute paths or paths with `..` | Only use relative paths within Downloads dir |
| `chrome.downloads` API | Calling from content script | Must call from service worker; content scripts cannot use downloads API |
| `chrome.storage` API | Using `chrome.storage.sync` for large image metadata | Use `chrome.storage.local`; sync has 8KB per-item limit |
| Content script to background messaging | Fire-and-forget `sendMessage` with no response handler | Use `sendMessage` with callback or `sendResponse` to confirm receipt |
| `MutationObserver` in content script | Observing the entire document body with `subtree: true` | Scope to the main content container; full-body observation is expensive on image-heavy pages |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Transferring full image data through message passing | Popup freezes, messages time out | Send URLs only; let background fetch/download | Images >1MB, or batch >10 images |
| Running MutationObserver with no disconnect | Memory leak over long browsing sessions | Disconnect observer when popup closes or extraction completes | After ~30 min on dynamic sites |
| Loading all extracted image URLs into popup DOM as `<img>` previews | Popup is slow to open, high memory use | Use virtual list or limit preview to first 20 thumbnails | Pages with 100+ images (Viator) |
| Fetching image to check dimensions before showing | Doubles network requests | Use URL patterns or server response headers to infer size | When checking every image |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Injecting content script on all pages via `matches: ["<all_urls>"]` | Over-broad access; policy violation | Use `activeTab` — inject only on demand when user activates extension |
| Storing user-entered metadata (destination, vendor) in `chrome.storage.sync` | Data synced to Google account without clear disclosure | Use `chrome.storage.local`; add privacy disclosure if sync is used |
| Using `eval()` or `innerHTML` with user-provided strings | XSS if a page injects malicious content into form fields | Never use `eval()`; use `textContent` not `innerHTML` for user-supplied text |
| Downloading to user-visible path without sanitizing filename | Path traversal or illegal filename characters crash the download | Sanitize destination/vendor/category inputs: strip `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No feedback when download starts | Jennifer doesn't know if anything happened | Show a badge count or brief notification: "3 photos saved to Downloads/TravelPhotos/" |
| Downloading all images including icons, logos, UI chrome | Downloads folder full of 16x16 favicons and navigation icons | Default minimum size filter (e.g., hide images smaller than 100x100px); let user adjust |
| No way to see what was already extracted | Jennifer re-downloads the same images across sessions | Visual "already saved" indicator in the extraction grid |
| Filename collisions silently overwrite | Previous photo gone without warning | Append index to filename if collision detected, or use `chrome.downloads` `conflictAction: "uniquify"` |
| Form requires filling in all three fields every time | Same destination used repeatedly but must re-type it | Persist last-used values in `chrome.storage.local`; pre-fill on popup open |

---

## "Looks Done But Isn't" Checklist

- [ ] **Image extraction:** Tested on Viator and GetYourGuide specifically — these use lazy loading and JS-heavy rendering. Verify count matches visible images.
- [ ] **Lazy loading:** Scroll the page fully before extracting and confirm image count increases — verify MutationObserver is firing.
- [ ] **Blob URLs:** Open DevTools Network tab on a target site, confirm whether image requests return blob: URLs — verify blob handling path exists.
- [ ] **Downloads path:** Check that saved files appear in `Downloads/TravelPhotos/` not just `Downloads/` root, and that subdirectories are created correctly.
- [ ] **Filename sanitization:** Enter a destination with slashes (e.g., "Costa Rica/Beach") and confirm it doesn't break the save path.
- [ ] **Service worker idle:** Open popup, fill form, wait 60 seconds, click extract — verify state is preserved from storage, not lost.
- [ ] **CORS:** Test on a site whose images load from a different CDN domain (most hotel sites) — verify download works via background service worker fetch.
- [ ] **Permission prompt:** Test in a fresh Chrome profile — confirm the permission model works without `<all_urls>` declared upfront.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Built on MV2, needs MV3 migration | HIGH | Rewrite background.js as service worker, move DOM-dependent code to offscreen documents, update manifest, retest all functionality |
| Service worker state loss shipped | MEDIUM | Migrate all state to `chrome.storage.session`; backwards-compatible if no stored format change |
| CORS failures in content script | MEDIUM | Refactor fetch calls from content script to background service worker via messaging; content script becomes URL collector only |
| Downloads API used from content script | LOW | Move `chrome.downloads.download()` calls to background.js and wire via messaging |
| Missing lazy-loaded images | MEDIUM | Add MutationObserver; may require UX change (explicit "refresh" button) if popup already shipped without it |
| Web Store rejected for permissions | LOW-MEDIUM | Refactor to `activeTab` + `optional_host_permissions` pattern; resubmit with updated privacy policy |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| MV2 patterns used | Phase 1: Scaffold | Manifest version check; no `persistent: true`; service_worker key present |
| Service worker state loss | Phase 1: Scaffold | Idle-then-use test (wait 60s, confirm state persists) |
| CORS blocks on content script fetch | Phase 1: Architecture | All fetch calls in background.js, not content scripts |
| Lazy-loaded images missed | Phase 2: Image extraction | Test on Viator; image count before/after scroll matches |
| CSS background / srcset images missed | Phase 2: Image extraction | Test on GetYourGuide; hero images appear in list |
| Blob URLs not downloadable | Phase 2: Image extraction | Identify a blob-URL site; verify download succeeds |
| Downloads folder constraint | Phase 1: Design/scoping | UX mockup shows Downloads subfolder path; Jennifer approves workflow |
| Web Store permissions rejection | Phase 1: Manifest design | Manifest uses `activeTab`; no `<all_urls>` in required permissions |
| Async listener registration | Phase 1: Scaffold | Background.js code review; all listeners at top level |
| Filename collision | Phase 3: Polish | Duplicate filename test; confirm `uniquify` or index suffix works |
| Missing size filter (icons/logos) | Phase 2: Image extraction | Confirm default min-size filter exists; UI shows count of filtered images |

---

## Sources

- [Migrate to Manifest V3 — Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/migrate)
- [Migrate to Service Workers — Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers)
- [Manifest V2 phase-out begins — Chromium Blog](https://blog.chromium.org/2024/05/manifest-v2-phase-out-begins.html)
- [Offscreen Documents in Manifest V3 — Chrome for Developers](https://developer.chrome.com/blog/Offscreen-Documents-in-Manifest-v3)
- [chrome.downloads API — Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/downloads)
- [Changes to Cross-Origin Requests in Chrome Extension Content Scripts — Chromium](https://www.chromium.org/Home/chromium-security/extension-content-script-fetches/)
- [Chrome Web Store Review Process — Chrome for Developers](https://developer.chrome.com/docs/webstore/review-process)
- [Chrome Web Store Program Policies — Chrome for Developers](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [Service Worker in Browser Extensions — Whatfix Engineering Blog](https://medium.com/whatfix-techblog/service-worker-in-browser-extensions-a3727cd9117a)
- [Why Chrome Extensions Get Rejected — Extension Radar](https://www.extensionradar.com/blog/chrome-extension-rejected)
- [Declare Permissions — Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)

---
*Pitfalls research for: Chrome extension, image extraction, local file saving (Photo Extractor)*
*Researched: 2026-03-19*
