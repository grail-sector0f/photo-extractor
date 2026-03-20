# Architecture Research

**Domain:** Chrome browser extension — image extraction tool
**Researched:** 2026-03-19
**Confidence:** HIGH (based on official Chrome developer docs and verified patterns)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chrome Extension (MV3)                        │
├──────────────────┬──────────────────────┬───────────────────────┤
│   popup.html     │   content_script.js  │  service_worker.js    │
│   (UI layer)     │   (DOM access layer) │  (privileged layer)   │
│                  │                      │                        │
│  - Name form     │  - Scan <img> tags   │  - Receive image URLs  │
│  - Image grid    │  - Read data-src,    │  - Call downloads API  │
│  - Download btn  │    srcset, bg-img    │  - Build filename      │
│                  │  - Strip CSS blocks  │  - Save to local disk  │
│                  │  - Intercept events  │                        │
└────────┬─────────┴──────────┬───────────┴────────────┬──────────┘
         │                    │                         │
         │  chrome.runtime    │  chrome.runtime         │
         │  .sendMessage()    │  .sendMessage()         │
         │  (popup→SW)        │  (CS→SW)                │
         └────────────────────┴────────────────────────-┘
                                        │
                              chrome.downloads.download()
                                        │
                                  Local filesystem
                              (~/Downloads/photos/)
```

### Component Responsibilities

| Component | Responsibility | What it CAN access |
|-----------|---------------|---------------------|
| **Popup** (popup.html + popup.js) | User input form (destination, vendor, category), display extracted images, trigger download | Chrome APIs, no DOM of active tab |
| **Content Script** (content_script.js) | Injected into the active tab, reads the page DOM, finds image URLs, strips right-click protection | Page DOM only, no privileged Chrome APIs |
| **Service Worker** (service_worker.js) | Background coordinator, receives messages from popup and content script, calls `chrome.downloads` API | All Chrome APIs, no DOM |

The critical constraint: **content scripts cannot call `chrome.downloads`**. They can touch the DOM but not the filesystem. Service workers can call `chrome.downloads` but cannot touch the DOM. The message-passing bridge between them is mandatory, not optional.

---

## Recommended Project Structure

```
photo-extractor/
├── manifest.json             # Extension config, permissions, entry points
├── popup/
│   ├── popup.html            # The UI shown when clicking the extension icon
│   ├── popup.js              # Handles form input, displays images, sends download request
│   └── popup.css             # Styles for the popup panel
├── content/
│   └── content_script.js     # Injected into active tab — finds images, bypasses protections
├── background/
│   └── service_worker.js     # Receives messages, calls chrome.downloads API
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Structure Rationale

- **popup/:** Kept separate because popup runs in its own sandboxed page context, not the tab DOM.
- **content/:** Content scripts are injected into tabs. Isolating them makes the security boundary explicit.
- **background/:** Service worker runs independently of both popup and tab. Treating it as its own layer prevents confusion about what it can and can't do.

---

## Architectural Patterns

### Pattern 1: Two-Phase Image Extraction

**What:** Content script does a broad DOM scan on demand (when popup requests it), returns all candidate image URLs to the popup for the user to review before any download happens.

**When to use:** Always — downloading without user review is a bad UX pattern for this use case, and Chrome may also flag extensions that auto-download without user action.

**Trade-offs:** Adds a review step, but gives Jennifer control over which images she actually wants. Avoids saving 80 images when she wanted 3.

**Message flow:**
```
popup.js sends:   { action: "scanImages" }
                  → content_script.js
content_script returns: { images: ["https://...", "https://..."] }
                  → popup.js displays image grid
user selects images + fills form fields
popup.js sends:   { action: "download", urls: [...], meta: { dest, vendor, cat } }
                  → service_worker.js calls chrome.downloads.download() for each
```

### Pattern 2: Capture-Phase Event Override for Right-Click Bypass

**What:** Content script overrides the page's contextmenu and selectstart event listeners by adding its own listener in the capture phase (`useCapture: true`) with higher priority. It also resets CSS `pointer-events` on blocked elements.

**When to use:** Any time the target site blocks right-click. Sites use two main techniques — the content script needs to address both:

1. **JavaScript contextmenu block** — site calls `event.preventDefault()` on the contextmenu event. Counter: add a capture-phase listener that calls `event.stopImmediatePropagation()` before the site's handler fires, then re-dispatches or simply proceeds.

2. **CSS pointer-events: none** — applied to `<img>` or a parent wrapper element, making it unclickable. Counter: content script iterates all images and their ancestors, resets `pointer-events` to `''` (browser default).

**Trade-offs:** This does not require any special permission beyond `activeTab` + `scripting`. It works on most travel sites. Sites using server-rendered watermarked images or Canvas-drawn images are not bypassed this way (those are a separate problem).

**Technique:**
```javascript
// In content_script.js — injected at document_start so it runs before site JS

// 1. Override CSS pointer-events block
document.querySelectorAll('img, [style*="pointer-events"]').forEach(el => {
  el.style.pointerEvents = '';
});

// 2. Add high-priority capture listener to neutralize contextmenu block
document.addEventListener('contextmenu', function(e) {
  e.stopImmediatePropagation(); // fires before site's own listener
}, true); // true = capture phase, higher priority than bubble-phase listeners

// Note: stopImmediatePropagation prevents site's handler from ever seeing the event
```

### Pattern 3: Multi-Source Image Discovery

**What:** Content script checks multiple sources per element, not just `img.src`, because travel sites frequently use lazy loading, responsive images, and CSS backgrounds.

**When to use:** Always for travel sites (Viator, GetYourGuide, Airbnb, hotel sites all use lazy loading).

**Sources to check, in priority order:**
```
1. img[src]           — standard loaded image
2. img[data-src]      — lazy-load placeholder (lazySizes, lazyload libraries)
3. img[data-lazy-src] — another common lazy-load attribute
4. img[srcset]        — responsive image set, take the largest candidate
5. source[srcset]     — inside <picture> elements
6. window.getComputedStyle(el).backgroundImage  — CSS background images
   (parse with regex: /url\(["']?(.+?)["']?\)/ )
```

**Important:** For lazy-loaded images using `data-src`, the actual high-res URL is in the attribute, not `src` (which may be a placeholder or blank). Always check `data-src` first.

---

## Data Flow

### Full Flow: User Opens Popup to File Saved

```
1. Jennifer clicks extension icon
   → popup.html renders, popup.js runs

2. popup.js sends { action: "scanImages" } via chrome.tabs.sendMessage()
   → content_script.js already injected in active tab

3. content_script.js scans DOM:
   - querySelectorAll('img, [style*="background-image"]')
   - checks src, data-src, data-lazy-src, srcset, computed background-image
   - strips pointer-events CSS from blocked elements
   - adds capture-phase contextmenu override
   - returns array of { url, width, height, sourceType } objects

4. popup.js receives image list
   → renders thumbnail grid in popup panel

5. Jennifer selects images, fills form:
   destination: "Japan"
   vendor: "Park Hyatt Tokyo"
   category: "exterior"

6. popup.js sends to service_worker.js:
   {
     action: "download",
     urls: ["https://...", "https://..."],
     meta: { destination: "Japan", vendor: "park-hyatt-tokyo", category: "exterior" }
   }

7. service_worker.js iterates urls, calls for each:
   chrome.downloads.download({
     url: "https://...",
     filename: "Japan/park-hyatt-tokyo/japan_park-hyatt-tokyo_exterior_001.jpg",
     conflictAction: "uniquify"
   })

8. Chrome saves file to:
   ~/Downloads/Japan/park-hyatt-tokyo/japan_park-hyatt-tokyo_exterior_001.jpg
```

### Naming Convention

Filename template: `{destination}_{vendor}_{category}_{index}.{ext}`

- Spaces replaced with hyphens, lowercased
- Index is zero-padded (001, 002...) to keep alphabetical sort order
- Extension derived from URL path or Content-Type header
- Folder path uses `filename` parameter with slashes: `"Japan/park-hyatt-tokyo/filename.jpg"` — Chrome creates subdirectories automatically

---

## Build Order (Phase Dependency Map)

Build in this order. Each phase depends on the previous one being stable.

```
Phase 1: Shell + manifest
  manifest.json, icons, empty popup.html, empty content_script.js, empty service_worker.js
  → Extension loads in Chrome without errors. No functionality yet.

Phase 2: Content script image scan
  content_script.js scans DOM and returns image URLs
  → Testable: inject script manually in DevTools console to verify URL extraction

Phase 3: Popup UI (scan + display)
  popup.html form + grid, popup.js sends scanImages message, displays results
  → Extension now shows images in the popup panel

Phase 4: Right-click bypass
  Add pointer-events reset and capture-phase contextmenu override to content_script.js
  → Test on a site with right-click protection (e.g., 500px, some hotel sites)

Phase 5: Download pipeline
  service_worker.js receives download request, builds filename, calls chrome.downloads
  → Files appear in ~/Downloads with correct names

Phase 6: Polish
  Lazy-load handling (data-src, srcset), error states, loading indicators, image deduplication
```

**Why this order:** The content script image scan is the core technical risk. Validate it works before building UI around it. The download pipeline is straightforward once URLs are confirmed correct.

---

## Manifest V3 Permissions Required

```json
{
  "manifest_version": 3,
  "permissions": [
    "activeTab",    // Access to the currently focused tab (granted on user action)
    "scripting",    // Required in MV3 to inject content scripts programmatically
    "downloads"     // Required to call chrome.downloads.download()
  ],
  "host_permissions": [
    "<all_urls>"    // Needed to inject content scripts on any travel site
  ],
  "background": {
    "service_worker": "background/service_worker.js"
  },
  "action": {
    "default_popup": "popup/popup.html"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content_script.js"],
      "run_at": "document_start"   // Inject before page JS runs — critical for event override
    }
  ]
}
```

**Why `document_start`:** If the content script injects after page JS runs, the site's contextmenu blocker is already registered. Running at `document_start` means the extension's capture-phase listener registers first.

**Why `<all_urls>` in host_permissions:** Jennifer browses dozens of different travel sites. Locking to specific domains would break on any new site she visits. Chrome will show a broad permission warning at install — acceptable for a personal-use tool.

---

## Anti-Patterns

### Anti-Pattern 1: Doing Downloads in the Content Script

**What people do:** Try to call `chrome.downloads.download()` directly from content_script.js because it already has the URLs.

**Why it's wrong:** Content scripts do not have access to privileged Chrome APIs including `chrome.downloads`. The call silently fails or throws. This is a hard architectural boundary in MV3.

**Do this instead:** Content script collects URLs, sends them to the service worker via `chrome.runtime.sendMessage()`, and the service worker calls `chrome.downloads`.

### Anti-Pattern 2: Storing State in the Service Worker

**What people do:** Set a variable like `let currentMeta = {}` in service_worker.js and expect it to persist between messages.

**Why it's wrong:** MV3 service workers are not persistent. Chrome unloads them after ~30 seconds of inactivity. Any global state is wiped. The next message arrives to a fresh service worker with no memory of prior state.

**Do this instead:** Pass all needed data in the message itself (include `meta` in the download request), or use `chrome.storage.session` for short-lived state that survives service worker restarts.

### Anti-Pattern 3: Only Checking `img.src`

**What people do:** Scan only `document.querySelectorAll('img')` and use `img.src`.

**Why it's wrong:** On lazy-loaded pages (most modern travel sites), `img.src` is a 1x1 placeholder GIF. The real URL is in `data-src` or `data-lazy-src`. This returns 0 usable images on sites like Airbnb.

**Do this instead:** Check `src`, `data-src`, `data-lazy-src`, `srcset`, and computed `background-image` for every element. Prefer the highest-resolution candidate from `srcset`.

### Anti-Pattern 4: Bubble-Phase Contextmenu Override

**What people do:** Add a contextmenu listener without the capture flag to try to re-enable right-click.

**Why it's wrong:** If the site registered its blocking listener in the bubble phase (the default), and your listener also runs in the bubble phase, execution order is non-deterministic. The site's `preventDefault()` may still fire.

**Do this instead:** Always use `addEventListener('contextmenu', handler, true)` — the `true` third argument enables capture phase, which fires before any bubble-phase handler. Then call `stopImmediatePropagation()` to prevent the site's handler from running at all.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| popup.js → content_script.js | `chrome.tabs.sendMessage(tabId, msg)` | popup must get tabId first via `chrome.tabs.query({active: true})` |
| content_script.js → service_worker.js | `chrome.runtime.sendMessage(msg)` | No tabId needed, goes to extension background |
| popup.js → service_worker.js | `chrome.runtime.sendMessage(msg)` | For triggering downloads after user confirms |
| service_worker.js → filesystem | `chrome.downloads.download({ url, filename })` | Saves relative to ~/Downloads by default |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Any travel website | Content script injection via `<all_urls>` match | No network calls from extension — images are fetched by Chrome's own downloader, not extension code |
| Local filesystem | `chrome.downloads` API | Can create subdirectories via slashes in `filename` param |

---

## Scaling Considerations

This is a single-user personal tool. Traditional scaling (users, load) is not relevant. The relevant "scale" question is how many images per page.

| Scenario | Concern | Approach |
|----------|---------|----------|
| Page with 10-50 images | Fine | Default behavior |
| Page with 200+ images (Airbnb, Getty) | Popup becomes unmanageable | Add filter: minimum width (e.g., skip images < 200px) to remove icons/thumbnails |
| Sequential download of 20 images | Rate limiting / Chrome download queue | Add small delay between `chrome.downloads.download()` calls (100-200ms) |

---

## Sources

- [Chrome Extensions: Content Scripts (official)](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — component boundaries and communication
- [Migrate to service workers (official)](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers) — MV3 service worker constraints
- [chrome.downloads API reference (official)](https://developer.chrome.com/docs/extensions/reference/api/downloads) — download API parameters
- [Declare permissions (official)](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) — permissions reference
- [Allow Right-Click extension source (GitHub)](https://github.com/lunu-bounir/allow-right-click) — reference implementation for right-click bypass technique
- [MDN: Element contextmenu event](https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event) — event behavior and capture/bubble phases
- [Get All Images in DOM including background (CRIMX)](https://blog.crimx.com/2017/03/09/get-all-images-in-dom-including-background-en/) — computed style background-image extraction

---

*Architecture research for: Chrome extension image extraction tool (Photo Extractor)*
*Researched: 2026-03-19*
