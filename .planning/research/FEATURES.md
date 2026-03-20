# Feature Research

**Domain:** Chrome browser extension — image/photo extraction tool
**Researched:** 2026-03-19
**Confidence:** MEDIUM (competitor feature analysis from web search; no direct user interviews)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that every credible image downloader has. Missing any of these and the tool feels broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Extract all `<img>` tag images from current page | Core function — every competitor does this | LOW | Standard DOM query, well-understood |
| Visual gallery/grid preview before downloading | Users need to see what they're getting before committing | LOW | Render thumbnails in popup |
| Filter by minimum dimensions (width/height) | Pages are full of icons, logos, 1px trackers — users only want real photos | LOW | Filter on image naturalWidth/naturalHeight |
| Single-click download for selected images | Users expect it to be fast — clicking per image is friction | LOW | chrome.downloads API |
| Save to a local folder | Why the tool exists — competitors all do this | LOW | chrome.downloads with filename/subfolder param |
| Show image count and dimensions in gallery | Users want to know what they're selecting | LOW | Read from img element attributes |
| Detect CSS background images | Many travel sites use background-image for hero shots and property photos | MEDIUM | Computed style scan on all elements |
| Detect lazy-loaded images | Modern sites defer loading until scroll — missing these means missing the best photos | MEDIUM | Must scroll page or use IntersectionObserver; users should scroll before triggering |

### Differentiators (Competitive Advantage)

These are not expected, but they directly solve Jennifer's workflow. This is where this tool wins.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Structured naming form: destination + vendor + category | Competitors generate garbage filenames (uuid, "image001"). This produces searchable files that still make sense months later | LOW | Simple form in popup; naming pattern: `destination_vendor_category_index` |
| Pre-fill / remember last-used destination + vendor | Jennifer visits multiple pages for the same hotel — retyping every time is friction | LOW | localStorage or chrome.storage.local |
| Per-session naming persistence | Open extension 10 times on the same hotel — keep the form values until she explicitly changes them | LOW | Same as above |
| Right-click protection bypass | Many travel sites (hotel booking platforms, tour operators) use JS/CSS to block right-click save | MEDIUM | Content script removes `oncontextmenu` handlers and pointer-events:none CSS; also extracts src from DOM directly so right-click isn't needed at all |
| Detect srcset / `<picture>` elements and download highest-res version | Travel sites serve responsive images — the visible thumbnail is often 400px; the actual file is 2000px | MEDIUM | Parse srcset, select max-width descriptor or largest URL |
| Category picker (dropdown, not freetext) | Consistent categories (hotel-exterior, room, pool, food, activity) make filtering in tern.travel faster | LOW | Hardcoded or configurable dropdown; freetext risks typos that break search |
| Index numbering within a batch | Multiple photos of same hotel room need distinct names without overwriting | LOW | Auto-increment within session |

### Anti-Features (Commonly Requested, Often Problematic)

Features to deliberately exclude from v1, with rationale.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-detect destination/vendor from page title or URL | Reduces typing | Unreliable — hotel booking pages have messy titles, affiliate URLs, or third-party domains. A wrong auto-fill trains bad filename habits. Garbage in, garbage out. | Manual form with persistent memory (last-used values) reduces typing without sacrificing accuracy |
| Bulk ZIP download | Faster for large batches | Requires unzipping locally, loses the structured filename approach since the zip contents still need to be organized. Also complicates the chrome.downloads flow. | Download files individually to a named subfolder — same end state, no extra steps |
| Cloud sync / remote storage | Photos available anywhere | Requires auth, backend, accounts — out of scope for v1 and adds privacy risk for client photos | Local folder only; Jennifer's existing workflow is local-to-tern.travel import |
| Image format conversion (WebP → JPG) | WebP not always usable in other tools | Adds dependency (Canvas API or server-side processing), fails on cross-origin images, and tern.travel likely accepts WebP anyway | Download in native format; convert separately if needed |
| Automatic deduplication | Avoid saving the same image twice | Requires hashing or URL comparison across sessions, adds storage overhead, high complexity for modest benefit | Overwrite by filename is sufficient — if Jennifer grabs the same hotel twice, same filename = natural dedup |
| Deep/multi-page crawl | Grab all images from an entire website | Scope creep; this is scraping, not extraction. Creates legal ambiguity. Dramatically increases complexity. | One page at a time is the right mental model for a curating workflow |
| Browser history integration | Auto-suggest destinations from past visits | Privacy concern; not useful given how travel sites are structured | Persistent form memory (last session values) is sufficient |

---

## Feature Dependencies

```
Structured naming form (destination + vendor + category)
    └──requires──> chrome.downloads API with filename parameter
                       └──requires──> "downloads" permission in manifest

Visual gallery preview
    └──requires──> Image detection (img tags + CSS backgrounds + srcset)
                       └──requires──> Content script with DOM access

Right-click protection bypass
    └──requires──> Content script (injected into page)
    └──enhances──> Image detection (extracts src without needing right-click at all)

Lazy-loaded image detection
    └──enhances──> Image detection
    └──requires──> User has scrolled page (or extension triggers scroll)

Category dropdown
    └──enhances──> Structured naming form
    └──requires──> Structured naming form

Session memory (pre-fill last values)
    └──enhances──> Structured naming form
    └──requires──> chrome.storage.local
```

### Dependency Notes

- **Naming form requires downloads API:** The filename parameter in `chrome.downloads.download()` is how custom filenames are set. Without it, browsers use the original filename from the server.
- **Right-click bypass enhances image detection:** When the extension reads `img.src` directly from the DOM, right-click protection is irrelevant — the extension never uses the browser's right-click menu.
- **Lazy-loaded images require user action:** Extensions cannot force a full page load without scrolling. The simplest solution is instructing the user to scroll before activating the extension.
- **Category dropdown requires naming form:** The dropdown is only meaningful if there's a naming system to feed it into.

---

## MVP Definition

### Launch With (v1)

Minimum to validate the concept with Jennifer as the sole user.

- [ ] Detect all images on current page: `<img>` tags, srcset (highest-res), CSS background-image — because travel sites use all three
- [ ] Visual thumbnail gallery in popup with checkboxes to select/deselect
- [ ] Filter by minimum dimensions (default: 400px wide) — screens out icons and thumbnails
- [ ] Naming form: destination, vendor, category (dropdown), before download
- [ ] Files saved to local Downloads folder with pattern `destination_vendor_category_index.ext`
- [ ] Session memory: last-used destination + vendor pre-filled on next open
- [ ] Right-click protection bypass via content script (removes JS handlers, reads src directly)
- [ ] Works on target sites: hotel booking platforms, Viator, GetYourGuide, Airbnb, travel blogs

### Add After Validation (v1.x)

Add once v1 is confirmed useful.

- [ ] Configurable category list — Jennifer may want to add/remove categories without a code change
- [ ] Subfolder per destination — group all Kyoto images under `/Kyoto/` rather than flat Downloads
- [ ] Scroll-to-load helper — button in popup that triggers auto-scroll to capture lazy images before scan

### Future Consideration (v2+)

Defer until there's evidence the workflow needs it.

- [ ] Multiple user support or profiles — single user for now (Jennifer)
- [ ] tern.travel direct integration — once the local workflow is validated, reducing the manual import step could be high value
- [ ] Custom naming template editor — power feature; not needed if the fixed pattern works

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| img tag detection | HIGH | LOW | P1 |
| CSS background image detection | HIGH | MEDIUM | P1 |
| srcset highest-res detection | HIGH | MEDIUM | P1 |
| Visual gallery preview | HIGH | LOW | P1 |
| Naming form (destination/vendor/category) | HIGH | LOW | P1 |
| Right-click protection bypass | HIGH | MEDIUM | P1 |
| Session memory (pre-fill) | MEDIUM | LOW | P1 |
| Dimension filter | MEDIUM | LOW | P1 |
| Category dropdown | MEDIUM | LOW | P1 |
| Subfolder per destination | MEDIUM | LOW | P2 |
| Scroll-to-load helper | MEDIUM | LOW | P2 |
| Configurable category list | LOW | LOW | P2 |
| tern.travel integration | HIGH | HIGH | P3 |
| Custom naming template editor | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Image Downloader (PactInteractive) | Imageye | Download All Images | Our Approach |
|---------|-----------------------------------|---------|---------------------|--------------|
| Bulk img detection | Yes | Yes | Yes | Yes |
| CSS background detection | Partial | Yes | Yes | Yes — required for travel sites |
| Lazy-load handling | Manual scroll | Manual scroll | Yes (with scroll) | Manual scroll + instruction |
| Size/dimension filter | Yes | Yes | Yes | Yes (default 400px min) |
| Custom filename | Yes (limited) | No | No | Yes — structured naming is the core differentiator |
| Gallery preview | Yes | Yes | Yes | Yes |
| Right-click bypass | No (separate extension) | No | No | Yes — built in |
| Subfolder save | Yes | No | No | Yes |
| Named categories | No | No | No | Yes |
| Session memory | No | No | No | Yes |

**Key gap in all competitors:** None combine structured naming + right-click bypass + category tagging in a single tool. All competitors are general-purpose bulk downloaders. This tool is purpose-built for a curation workflow.

---

## Right-Click Protection: What to Expect on Travel Sites

This is the highest-risk technical feature. Here is what the extension will encounter:

| Protection Type | How It Works | Bypass Approach | Confidence |
|----------------|--------------|-----------------|------------|
| JavaScript `oncontextmenu` handler | JS captures right-click event and calls `preventDefault()` | Content script removes the handler: `document.oncontextmenu = null` | HIGH — well-documented |
| CSS `pointer-events: none` overlay | Invisible div layered over image blocks mouse events | Extension reads img src directly — pointer events are irrelevant when extension queries DOM | HIGH |
| `user-select: none` CSS | Prevents text/image selection | Same as above — extension reads DOM, not user selection | HIGH |
| `draggable="false"` attribute | Blocks drag-to-desktop | Irrelevant — extension uses downloads API, not drag | HIGH |
| Dynamic JS rendering (React/Vue/Next.js) | Images injected after page load | Content script runs after DOMContentLoaded; mutation observer can catch late additions | MEDIUM — needs testing on specific SPAs |
| Hotlink protection (server-side) | Server checks Referer header and rejects external requests | Extension downloads with page context, Referer is preserved — usually works | MEDIUM — site-specific; some CDNs may block |
| CDN signed URLs with expiry | Image URL is time-limited | Download immediately on trigger — not a problem in normal usage | MEDIUM — not commonly used on travel content sites |

**Bottom line:** CSS and JS-based protection is fully bypassable by reading the DOM directly. Server-side protection (hotlink blocking, signed URLs) is harder and may cause some images to fail silently. Build error handling for failed downloads.

---

## Sources

- [Top 10 Best Image Downloader Chrome Extensions 2026 — Tenorshare](https://4ddig.tenorshare.com/photo-tips/image-downloader-chrome-extension.html)
- [Best Image Downloader Extensions 2026 — Frontend Hero](https://frontend-hero.com/best-image-downloader-chrome-extensions)
- [Image Downloader — PactInteractive GitHub](https://github.com/PactInteractive/image-downloader)
- [Pic-Grabber (protected + dynamic images) — GitHub](https://github.com/venopyX/pic-grabber)
- [Download All Images — Chrome Web Store](https://chromewebstore.google.com/detail/download-all-images/nnffbdeachhbpfapjklmpnmjcgamcdmm)
- [chrome.downloads API — Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/downloads)
- [Smart Image Downloader (rename + convert) — Chrome Web Store](https://chromewebstore.google.com/detail/smart-image-downloader-bu/ihohiaohhigepockkflmahbhcomjganm)
- [Allow Right-Click bypass techniques — Beebom](https://beebom.com/ways-to-enable-right-click-on-websites/)
- [Lazy Load Background Images — DebugBear](https://www.debugbear.com/blog/lazy-load-background-images-intersection-observer)
- [Image Downloader Continued — user reviews](https://chrome-stats.com/d/jfkjbfhcfaoldhgbnkekkoheganchiea/reviews?hl=en)

---
*Feature research for: Chrome extension — photo extraction tool for travel advisor workflow*
*Researched: 2026-03-19*
