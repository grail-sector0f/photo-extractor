# Phase 02: Image Extraction - Research

**Researched:** 2026-03-19
**Domain:** Chrome MV3 content scripts, DOM image extraction, MutationObserver, srcset parsing, CSS background-image, extension message passing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Scan trigger**: Popup sends a `SCAN_PAGE` message to the content script when Jennifer clicks a Scan button. Content script responds with the initial image list. No auto-scan on popup open.
- **Image filtering**: Skip images smaller than 100x100 pixels (width or height). Skip SVG files entirely. WebP, PNG, JPEG, AVIF all pass through.
- **Blob URLs**: Detect and exclude from results. Log detected blob URLs to the console for DevTools audit. Phase 3 UI surfaces a count of uncaptured blob images.
- **MutationObserver lifetime**: Observer starts on Scan click and runs until the popup closes. New images discovered after initial scan are added to the result set dynamically. No fixed time window, no manual re-scan.
- **srcset resolution selection**: Parse all candidates in the srcset attribute and select the highest-resolution URL (largest `w` descriptor, or highest pixel density `x` descriptor). Fall back to `src` if parsing fails or produces no valid candidates.

### Claude's Discretion

- Exact message type names (e.g., `SCAN_PAGE`, `IMAGE_FOUND`) and payload shape
- Whether initial results are sent as one batch or streamed as images are found
- How dimensions are checked (natural dimensions from Image objects, or from the element's rendered size)
- Content script internal module structure

### Deferred Ideas (OUT OF SCOPE)

- Blob URL capture via fetch/XHR interception — v2 after auditing how common they are
- UX-02 min-dimension filter (200x200) — v2, already in REQUIREMENTS.md
- `<picture>` element / `<video poster>` attribute extraction — not in scope for v1
- Auto-scan on popup open — rejected
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXTR-01 | Extension extracts all images from standard `img` tags on the active tab | `document.querySelectorAll('img')` in content script; use `naturalWidth`/`naturalHeight` for dimension filtering; `img.complete` guards against zero-value reads on still-loading images |
| EXTR-02 | Extension extracts images from CSS `background-image` properties on elements | `document.querySelectorAll('*')` + `window.getComputedStyle(el).backgroundImage`; parse `url()` values with regex; handle multi-layer comma-separated values |
| EXTR-03 | Extension detects lazy-loaded images as the user scrolls (via MutationObserver) | `MutationObserver` on `document.body` with `{ childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset'] }`; long-lived port connection signals popup-close for observer cleanup |
| EXTR-04 | Extension selects the highest-resolution version when `srcset` provides multiple sizes | Hand-written srcset parser (no library needed — format is simple); pick candidate with largest `w` value or highest `x` value; fall back to `src` on empty/failed parse |
</phase_requirements>

---

## Summary

Phase 2 fills the content script stub with four interconnected extraction behaviors: `<img>` tag scanning, CSS background-image extraction, lazy-load detection via MutationObserver, and srcset resolution selection. All four run inside `entrypoints/content.ts` with no changes to `wxt.config.ts` or the manifest — the stub from Phase 1 already registers the content script for `<all_urls>`.

The most architecturally important decision in this phase is how the MutationObserver stays alive "until the popup closes." A one-time `sendMessage` cannot signal popup closure — but a long-lived `chrome.runtime.connect()` port can. When the popup closes, the port fires `onDisconnect` in the content script, which is the signal to call `observer.disconnect()`. The popup initiates the scan by opening a port AND sending the initial SCAN_PAGE trigger; the content script holds the port open and streams new images back as the observer fires.

srcset parsing does not require a library. The HTML spec's srcset format is a comma-separated list of `url descriptor` pairs where the descriptor is either a `w` (width in pixels) or `x` (device pixel ratio) suffix. A 10-line hand-written parser handles all real-world cases reliably. `currentSrc` (the browser's already-selected URL) is NOT the right property to read — the browser picks based on the current viewport, not maximum resolution. We must parse the `srcset` attribute ourselves.

**Primary recommendation:** Use a long-lived port (connect/disconnect) for the scan session lifecycle. Send the initial image batch in a single `PORT_MESSAGE` after the first synchronous scan, then send incremental `IMAGE_FOUND` messages as the MutationObserver fires. The observer disconnects when the port fires `onDisconnect`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wxt | 0.20.20 (installed) | Build framework; content script auto-registration | Already installed; no changes needed |
| @types/chrome | latest (installed) | TypeScript types for chrome.runtime, chrome.tabs | Already installed |
| vitest | 3.2.4 (installed) | Unit test runner | Already installed and configured |

### No New Libraries Needed

Phase 2 uses only browser built-in APIs:
- `document.querySelectorAll` — DOM traversal
- `window.getComputedStyle` — CSS property reading
- `MutationObserver` — DOM change detection
- `chrome.runtime.connect` / `chrome.runtime.onConnect` — long-lived port for scan session
- `chrome.runtime.onMessage` / `chrome.tabs.sendMessage` — used from background for relay if needed

srcset parsing is hand-written (see Code Examples). The format is simple enough that a library adds dependency weight without meaningful benefit.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written srcset parser | `srcset` npm package (v5.0.3) or `parse-srcset` (v1.0.2) | Both are tiny and spec-compliant, but add a dependency for ~10 lines of logic. Hand-written is fine at this scale. |
| Long-lived port for observer lifetime | Fixed timeout (e.g., 60s) | Timeout is arbitrary and wrong. Port disconnects exactly when the popup closes — correct by design. |
| `naturalWidth`/`naturalHeight` for dimensions | Rendered `getBoundingClientRect()` size | Natural dimensions reflect the actual image file resolution (correct for filtering real photos). Rendered size reflects CSS layout and could be small even for a large image. Use natural dimensions. |

---

## Architecture Patterns

### Recommended File Structure

```
entrypoints/
├── content.ts              # Main entry — defineContentScript wrapper only
├── background.ts           # Add SCAN_PAGE relay + connect forwarding
lib/
├── keepalive.ts            # Existing — unchanged
├── download.ts             # Existing — unchanged
├── extract/
│   ├── imgTags.ts          # EXTR-01: scan <img> elements
│   ├── cssBackgrounds.ts   # EXTR-02: scan CSS background-image
│   ├── srcsetParser.ts     # EXTR-04: parse srcset, return highest-res URL
│   └── types.ts            # Shared ImageResult type
tests/unit/
├── download.test.ts        # Existing
├── naming.test.ts          # Existing
├── imgTags.test.ts         # New — Wave 0 gap
├── cssBackgrounds.test.ts  # New — Wave 0 gap
└── srcsetParser.test.ts    # New — Wave 0 gap
```

The content script itself stays thin — it wires together the extraction modules and handles the port lifecycle. Business logic lives in `lib/extract/`.

### Pattern 1: Long-Lived Port for Scan Session

**What:** Popup opens a named port to the content script when Jennifer clicks Scan. Content script holds the port and uses `port.onDisconnect` to stop the MutationObserver when the popup closes.

**When to use:** Any time a content script needs to run continuously and stop on popup close.

```typescript
// Source: https://developer.chrome.com/docs/extensions/develop/concepts/messaging

// --- Popup side (App.tsx) ---
const port = chrome.runtime.connect({ name: 'scan-session' });
port.postMessage({ type: 'SCAN_PAGE' });
port.onMessage.addListener((msg) => {
  if (msg.type === 'SCAN_RESULT') {
    // msg.payload.images: ImageResult[]  (initial batch)
  }
  if (msg.type === 'IMAGE_FOUND') {
    // msg.payload: ImageResult  (incremental, from MutationObserver)
  }
});
// When popup component unmounts, port auto-disconnects (popup frame unloads)

// --- Content script side (content.ts) ---
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'scan-session') return;

  const observer = new MutationObserver(handleMutations);

  port.onMessage.addListener((msg) => {
    if (msg.type === 'SCAN_PAGE') {
      const images = scanPage(); // initial full scan
      port.postMessage({ type: 'SCAN_RESULT', payload: { images } });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'srcset', 'style'],
      });
    }
  });

  port.onDisconnect.addListener(() => {
    observer.disconnect(); // popup closed — stop watching
  });
});
```

**Why long-lived port over sendMessage:** `chrome.runtime.sendMessage` is fire-and-forget with a one-time response. There's no mechanism to know when the popup closes after the response. A port's `onDisconnect` event fires exactly when the other end (the popup frame) unloads, making it the correct signal for observer teardown.

### Pattern 2: img Tag Extraction (EXTR-01)

**What:** Query all `<img>` elements, filter by size and type, resolve srcset for best URL.

```typescript
// lib/extract/imgTags.ts
import { parseSrcset } from './srcsetParser';
import type { ImageResult } from './types';

const MIN_DIMENSION = 100; // px — locked in CONTEXT.md

export function extractImgTags(): ImageResult[] {
  const results: ImageResult[] = [];

  document.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    // Skip SVGs
    const src = img.getAttribute('src') ?? '';
    if (src.endsWith('.svg') || img.getAttribute('type') === 'image/svg+xml') return;

    // Dimension check — use natural dimensions (actual file size, not rendered size)
    // naturalWidth/naturalHeight are 0 if image hasn't loaded yet
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w < MIN_DIMENSION || h < MIN_DIMENSION) return;

    // Resolve best URL: parse srcset if present, fall back to src
    const srcsetAttr = img.getAttribute('srcset') ?? '';
    const url = srcsetAttr ? (parseSrcset(srcsetAttr) ?? src) : src;

    if (!url || url.startsWith('blob:')) {
      if (url?.startsWith('blob:')) console.log('[photo-extractor] blob URL skipped:', url);
      return;
    }

    results.push({ url, sourceType: 'img', naturalWidth: w, naturalHeight: h });
  });

  return results;
}
```

### Pattern 3: CSS Background-Image Extraction (EXTR-02)

**What:** Walk all DOM elements, read `getComputedStyle().backgroundImage`, parse `url()` values.

**Key nuance:** `backgroundImage` can contain multiple layers separated by commas (e.g., `url("a.jpg"), url("b.jpg")`). Must split and parse each.

```typescript
// lib/extract/cssBackgrounds.ts
import type { ImageResult } from './types';

// Matches url("..."), url('...'), url(...) — handles all quote variations
const URL_REGEX = /url\(["']?([^"')]+)["']?\)/g;
const MIN_DIMENSION = 100;

export function extractCssBackgrounds(): ImageResult[] {
  const results: ImageResult[] = [];
  const seen = new Set<string>();

  document.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const style = window.getComputedStyle(el);
    const bgImage = style.backgroundImage;

    if (!bgImage || bgImage === 'none') return;

    // Reset regex state between elements (stateful lastIndex)
    URL_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = URL_REGEX.exec(bgImage)) !== null) {
      const url = match[1];
      if (!url || seen.has(url)) continue;
      if (url.startsWith('blob:')) {
        console.log('[photo-extractor] blob CSS background skipped:', url);
        continue;
      }
      if (url.endsWith('.svg')) continue;

      // CSS backgrounds have no naturalWidth — use element rendered size as proxy
      const rect = el.getBoundingClientRect();
      if (rect.width < MIN_DIMENSION || rect.height < MIN_DIMENSION) continue;

      seen.add(url);
      results.push({ url, sourceType: 'css-background' });
    }
  });

  return results;
}
```

**Note:** CSS background elements don't expose `naturalWidth`/`naturalHeight`. Use `getBoundingClientRect()` as a proxy filter — if the rendered element is smaller than 100px in either dimension, it's likely a UI decoration, not a photo.

### Pattern 4: srcset Parser (EXTR-04)

**What:** Parse a `srcset` attribute string and return the highest-resolution URL. No library needed.

```typescript
// lib/extract/srcsetParser.ts
// Srcset format: "url1 1x, url2 2x" or "url1 320w, url2 800w, url3 1600w"
// Returns the URL of the highest-resolution candidate.
// Returns null if srcset is empty, malformed, or has no valid candidates.

export function parseSrcset(srcset: string): string | null {
  if (!srcset.trim()) return null;

  // Split on commas, but not commas inside url() — a simple split is safe here
  // because HTML srcset URLs cannot contain literal commas (they must be encoded as %2C)
  const candidates = srcset
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  type Candidate = { url: string; w?: number; x?: number };
  const parsed: Candidate[] = [];

  for (const candidate of candidates) {
    // Split into tokens: url is always first, descriptor is optional last token
    const parts = candidate.split(/\s+/);
    if (parts.length === 0 || !parts[0]) continue;

    const url = parts[0];
    const descriptor = parts[1] ?? '';

    if (descriptor.endsWith('w')) {
      const w = parseFloat(descriptor);
      if (!isNaN(w)) parsed.push({ url, w });
    } else if (descriptor.endsWith('x')) {
      const x = parseFloat(descriptor);
      if (!isNaN(x)) parsed.push({ url, x });
    } else {
      // No descriptor — treated as 1x implicitly
      parsed.push({ url, x: 1 });
    }
  }

  if (parsed.length === 0) return null;

  // Prefer w-descriptor candidates (absolute pixel width)
  const wCandidates = parsed.filter((c) => c.w !== undefined);
  if (wCandidates.length > 0) {
    return wCandidates.reduce((best, c) => (c.w! > best.w! ? c : best)).url;
  }

  // Fall back to x-descriptor (pixel density)
  const xCandidates = parsed.filter((c) => c.x !== undefined);
  if (xCandidates.length > 0) {
    return xCandidates.reduce((best, c) => (c.x! > best.x! ? c : best)).url;
  }

  return null;
}
```

### Pattern 5: MutationObserver Config for Lazy Images (EXTR-03)

**What:** Observe the full DOM for new `<img>` elements being added (childList) and for `src`/`srcset` attribute updates on existing elements.

```typescript
// Inside the content script's port.onMessage handler for SCAN_PAGE
const observer = new MutationObserver((mutations) => {
  const newImages: ImageResult[] = [];

  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      // New nodes added to DOM (lazy-loaded images appearing)
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as Element;

        // Check if the added node itself is an img
        if (el.tagName === 'IMG') {
          processImg(el as HTMLImageElement, newImages);
        }

        // Check for img descendants in newly-added subtrees (e.g., card components)
        el.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
          processImg(img, newImages);
        });
      });
    }

    if (mutation.type === 'attributes') {
      // src or srcset updated on an existing img (lazy loaders often set src after scroll)
      const el = mutation.target as HTMLElement;
      if (el.tagName === 'IMG') {
        processImg(el as HTMLImageElement, newImages);
      }
    }
  }

  // Send each new image back to popup incrementally
  newImages.forEach((img) => port.postMessage({ type: 'IMAGE_FOUND', payload: img }));
});

observer.observe(document.body, {
  childList: true,
  subtree: true,           // catch images nested inside new elements
  attributes: true,
  attributeFilter: ['src', 'srcset'],  // only fire on src/srcset changes, not all attrs
});
```

### Pattern 6: Shared ImageResult Type

```typescript
// lib/extract/types.ts
export interface ImageResult {
  url: string;
  sourceType: 'img' | 'css-background';
  naturalWidth?: number;   // present for <img> tags, absent for CSS backgrounds
  naturalHeight?: number;
}
```

### Pattern 7: background.ts — No Relay Needed

The CONTEXT.md describes two possible architectures: popup → background → content, or popup → content directly. Since popup can open ports directly to content scripts with `chrome.runtime.connect()` (not via background), the simpler direct path works. Background.ts does NOT need to relay SCAN_PAGE.

The existing `DOWNLOAD_FILE` handler in `background.ts` is unchanged.

### Anti-Patterns to Avoid

- **Reading `img.currentSrc` instead of parsing `srcset`:** `currentSrc` returns the URL the browser chose for the current viewport size and pixel density — NOT the highest resolution. On a 1x monitor it may pick the low-res version. Always parse the `srcset` attribute directly (EXTR-04).
- **Using `naturalWidth` without checking `img.complete`:** If the image is still loading, `naturalWidth` returns `0`. This would incorrectly filter out large images that haven't finished loading. Check `img.complete` first or use `img.width` as fallback.
- **Observing `document.documentElement` instead of `document.body`:** Head mutations are almost never image additions and add noise. Observe `document.body` with `subtree: true`.
- **Splitting srcset on all commas:** Commas in srcset are safe to split on because spec-compliant URLs use `%2C` for literal commas — but only true for well-formed srcset strings. Our parser splits safely.
- **One big scan on sendMessage, then stopping:** Does not handle lazy-loaded images. The observer must stay alive after the initial scan.
- **Forgetting `attributeFilter` on MutationObserver:** Without it, every attribute change on every element fires the callback, which is extremely expensive on busy pages. Always specify `attributeFilter: ['src', 'srcset']`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Observer cleanup on extension update | Manual flag checking | WXT `ctx` object passed to `main()` — wraps async primitives to auto-clean on context invalidation | WXT's ContentScriptContext handles "extension context invalidated" errors automatically |
| srcset library | External package | 10-line hand-written parser (see Code Examples) | srcset format is simple; no library justified |
| DOM polling for lazy images | `setInterval` checking DOM | `MutationObserver` | MutationObserver is synchronous with DOM changes; polling is slow and misses fast-appearing images |

**Key insight:** The hardest problem here is not extraction logic — it's lifecycle. The MutationObserver must be connected exactly to the popup's open/close lifecycle, and the long-lived port is the correct primitive for that.

---

## Common Pitfalls

### Pitfall 1: naturalWidth Returns 0 for Unloaded Images

**What goes wrong:** Images that are in the DOM but still downloading return `naturalWidth === 0`. If you filter on `< 100`, these valid large photos get dropped.
**Why it happens:** `naturalWidth` is only valid after the image loads. It's `0` during or before loading.
**How to avoid:** Check `img.complete` before reading `naturalWidth`. If `!img.complete`, fall back to `img.width` (rendered CSS size) or skip and rely on MutationObserver to catch the image once loaded. Alternatively, use an `onload` listener for images that are incomplete at scan time.
**Warning signs:** Real hotel photos missing from results on first scan, but appearing on a second manual scan.

### Pitfall 2: MutationObserver Fires for Every Attribute Change

**What goes wrong:** Without `attributeFilter`, observing `attributes: true` fires on every attribute change — `class`, `data-*`, `aria-*`, etc. On pages with animated UIs (Viator, GetYourGuide), this can fire hundreds of times per second.
**Why it happens:** The default behavior monitors all attribute mutations.
**How to avoid:** Always set `attributeFilter: ['src', 'srcset']`. Only `src`/`srcset` changes are relevant for new image URLs.
**Warning signs:** High CPU usage when the popup is open and the user scrolls.

### Pitfall 3: CSS backgroundImage URL Parsing Fails with Quotes

**What goes wrong:** `getComputedStyle` returns `background-image` values in several formats: `url("https://...")`, `url('https://...')`, or `url(https://...)` (no quotes). A regex that doesn't handle all three will silently drop images.
**Why it happens:** Browsers normalize background-image strings differently, and site authors write them differently.
**How to avoid:** Use `url\(["']?([^"')]+)["']?\)` as the regex pattern. This handles all three quote variants.
**Warning signs:** Hotel background images missing from results; CSS backgrounds always showing zero results.

### Pitfall 4: Port Disconnects Mid-Scan

**What goes wrong:** If Jennifer opens the popup, starts a scan, and the popup auto-closes (or Chrome garbage-collects it after inactivity), the port disconnects and the observer stops — but no error appears in the UI. New lazy-loaded images stop being captured silently.
**Why it happens:** Port disconnection is the correct behavior. The problem is it's invisible.
**How to avoid:** This is acceptable behavior per CONTEXT.md — the observer runs until the popup closes by design. No fix needed. Document it so Phase 3 UI can surface "Scan paused — reopen popup to resume" if needed.
**Warning signs:** No warning signs — this is correct behavior.

### Pitfall 5: Duplicate Images in Results

**What goes wrong:** The same image URL appears multiple times — once from `<img>` scan, once from CSS background scan, and again from MutationObserver picking up an attribute change on an already-scanned element.
**Why it happens:** The three extraction paths are independent and don't share deduplication state.
**How to avoid:** Maintain a `Set<string>` of seen URLs inside the content script, checked before adding any result to the results list or sending it over the port.
**Warning signs:** Popup (Phase 3) shows duplicate thumbnails for the same image.

### Pitfall 6: chrome.runtime.connect Requires No Special Permissions

**What goes wrong:** Developer adds unnecessary permissions to manifest thinking connect/sendMessage needs them.
**Why it happens:** Confusion between tabs API permissions and messaging permissions.
**How to avoid:** `chrome.runtime.connect()` and `chrome.runtime.onConnect` require NO special permissions. The `activeTab` permission is already sufficient for the current use case. Do not add `"tabs"` permission just for messaging.

---

## Code Examples

Verified patterns from official sources and browser APIs:

### Opening a Long-Lived Port from Popup

```typescript
// Source: https://developer.chrome.com/docs/extensions/develop/concepts/messaging
// In App.tsx — fired when Jennifer clicks the Scan button
const port = chrome.runtime.connect({ name: 'scan-session' });
port.postMessage({ type: 'SCAN_PAGE' });

port.onMessage.addListener((msg: { type: string; payload: unknown }) => {
  if (msg.type === 'SCAN_RESULT') {
    // Initial batch — replace results state
    setImages((msg.payload as { images: ImageResult[] }).images);
  }
  if (msg.type === 'IMAGE_FOUND') {
    // Incremental — append to results
    setImages((prev) => [...prev, msg.payload as ImageResult]);
  }
});

// No explicit port.disconnect() needed — fires automatically when popup unloads
```

### Receiving Port in Content Script

```typescript
// Source: https://developer.chrome.com/docs/extensions/develop/concepts/messaging
// In entrypoints/content.ts main()
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'scan-session') return;

  let observer: MutationObserver | null = null;

  port.onMessage.addListener((msg) => {
    if (msg.type !== 'SCAN_PAGE') return;
    const images = scanPage();         // runs extractImgTags() + extractCssBackgrounds()
    port.postMessage({ type: 'SCAN_RESULT', payload: { images } });
    observer = startObserver(port);    // MutationObserver that sends IMAGE_FOUND
  });

  port.onDisconnect.addListener(() => {
    observer?.disconnect();
  });
});
```

### Parsing getComputedStyle backgroundImage

```typescript
// Handles: url("..."), url('...'), url(...)
// Handles: multiple layers — url("a.jpg"), linear-gradient(...), url("b.jpg")
const URL_REGEX = /url\(["']?([^"')]+)["']?\)/g;

function extractUrlsFromBackground(bgImage: string): string[] {
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0; // always reset before reuse
  while ((match = URL_REGEX.exec(bgImage)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}
```

### Safe naturalWidth Check

```typescript
function getImageDimensions(img: HTMLImageElement): { w: number; h: number } {
  if (img.complete && img.naturalWidth > 0) {
    return { w: img.naturalWidth, h: img.naturalHeight };
  }
  // Image not yet loaded — use rendered dimensions as conservative estimate
  return { w: img.width, h: img.height };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling DOM with `setInterval` for new images | `MutationObserver` | ~2014, widely supported now | Zero CPU overhead when nothing changes; immediate detection |
| `img.src` only for URL | `srcset` + `currentSrc` | HTML5 responsive images (~2014) | Must parse `srcset` attribute to find highest-res, not `currentSrc` |
| Persistent background page relaying messages | Direct popup-to-content port | MV3 (2020) | Popup can open ports directly to content scripts without background relay |

**Deprecated/outdated:**
- `MutationEvent` (`DOMNodeInserted`, `DOMAttrModified`): Deprecated in 2011, removed in Chrome 127. Always use `MutationObserver`.
- `img.getAttribute('width')` for dimension checking: Returns CSS attribute, not actual image dimensions. Use `naturalWidth` instead.

---

## Open Questions

1. **naturalWidth for images not yet loaded at scan time**
   - What we know: `naturalWidth` returns `0` if the image hasn't finished loading. Using `img.width` as fallback can return the CSS-rendered size which may be scaled down.
   - What's unclear: What fraction of images on Viator/GetYourGuide are still loading when the user clicks Scan?
   - Recommendation: Use `naturalWidth` when `img.complete === true`. For incomplete images, attach a one-time `load` event listener that re-evaluates and sends `IMAGE_FOUND` if dimensions pass. This ensures no valid photos are lost.

2. **CSS background-image dimensions via getBoundingClientRect**
   - What we know: CSS background elements don't expose the image's intrinsic dimensions — only the element's rendered size is available. An element that's 50x200px and has a large background photo would pass the height check (200 >= 100) but fail the width check (50 < 100).
   - What's unclear: Whether this dimension proxy causes real-world false negatives (genuine photos dropped) or false positives (small UI elements passed through).
   - Recommendation: Accept this limitation for Phase 2. The 100px threshold is intentionally conservative. If Jennifer reports missed background photos, the threshold can be lowered or removed for CSS backgrounds specifically.

3. **Viator/GetYourGuide blob URL frequency**
   - What we know: STATE.md flags this as unknown. Phase 2 logs blob URLs to console.
   - What's unclear: Whether these sites use blob URLs heavily enough to be a real problem for Jennifer.
   - Recommendation: Log per CONTEXT.md. After Phase 2 ships, Jennifer audits with DevTools open and reports the console count. Phase 3 UI surfaces the count in the popup.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 (installed) |
| Config file | `vitest.config.ts` (exists — Phase 1 created it) |
| Setup file | `tests/setup.ts` (exists — Chrome API mocks) |
| Quick run command | `npx vitest run tests/unit/srcsetParser.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXTR-01 | `extractImgTags()` returns URLs from `<img>` elements above 100x100 | unit | `npx vitest run tests/unit/imgTags.test.ts` | Wave 0 gap |
| EXTR-01 | `extractImgTags()` skips SVG images | unit | `npx vitest run tests/unit/imgTags.test.ts` | Wave 0 gap |
| EXTR-01 | `extractImgTags()` skips images below 100x100 | unit | `npx vitest run tests/unit/imgTags.test.ts` | Wave 0 gap |
| EXTR-01 | `extractImgTags()` logs blob URLs and excludes them | unit | `npx vitest run tests/unit/imgTags.test.ts` | Wave 0 gap |
| EXTR-02 | `extractCssBackgrounds()` returns URLs from `background-image: url(...)` | unit | `npx vitest run tests/unit/cssBackgrounds.test.ts` | Wave 0 gap |
| EXTR-02 | `extractCssBackgrounds()` handles multi-layer backgrounds (comma-separated) | unit | `npx vitest run tests/unit/cssBackgrounds.test.ts` | Wave 0 gap |
| EXTR-02 | `extractCssBackgrounds()` handles quoted and unquoted `url()` values | unit | `npx vitest run tests/unit/cssBackgrounds.test.ts` | Wave 0 gap |
| EXTR-03 | MutationObserver fires when a new `<img>` is added to DOM | integration (jsdom) | `npx vitest run tests/unit/mutationObserver.test.ts` | Wave 0 gap |
| EXTR-03 | MutationObserver fires when `src` attribute changes on existing img | integration (jsdom) | `npx vitest run tests/unit/mutationObserver.test.ts` | Wave 0 gap |
| EXTR-04 | `parseSrcset()` returns highest-`w` URL from width-descriptor srcset | unit | `npx vitest run tests/unit/srcsetParser.test.ts` | Wave 0 gap |
| EXTR-04 | `parseSrcset()` returns highest-`x` URL from density-descriptor srcset | unit | `npx vitest run tests/unit/srcsetParser.test.ts` | Wave 0 gap |
| EXTR-04 | `parseSrcset()` returns null on empty or malformed input | unit | `npx vitest run tests/unit/srcsetParser.test.ts` | Wave 0 gap |
| EXTR-04 | `parseSrcset()` falls back correctly when `w` descriptors are absent | unit | `npx vitest run tests/unit/srcsetParser.test.ts` | Wave 0 gap |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/unit/srcsetParser.test.ts tests/unit/imgTags.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/srcsetParser.test.ts` — covers EXTR-04 (pure function, no DOM needed — easiest to write first)
- [ ] `tests/unit/imgTags.test.ts` — covers EXTR-01 (requires jsdom DOM setup with mock img elements)
- [ ] `tests/unit/cssBackgrounds.test.ts` — covers EXTR-02 (requires jsdom with `getComputedStyle` mock)
- [ ] `tests/unit/mutationObserver.test.ts` — covers EXTR-03 (jsdom supports MutationObserver natively)
- [ ] `lib/extract/types.ts` — shared `ImageResult` interface
- [ ] `lib/extract/srcsetParser.ts` — pure parser function
- [ ] `lib/extract/imgTags.ts` — img tag extractor
- [ ] `lib/extract/cssBackgrounds.ts` — CSS background extractor

**Note:** Vitest uses jsdom by default (or `happy-dom`). MutationObserver is supported in jsdom, so EXTR-03 integration tests can run without a real browser. The existing `tests/setup.ts` chrome mock already handles `chrome.runtime` — extend it to add `chrome.runtime.connect` and `chrome.runtime.onConnect` mocks for port testing.

---

## Sources

### Primary (HIGH confidence)

- `https://developer.chrome.com/docs/extensions/develop/concepts/messaging` — Port/sendMessage patterns, popup→content messaging, onDisconnect behavior
- `https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts` — Isolated world constraints, DOM access, allowed APIs
- `https://developer.chrome.com/docs/extensions/reference/api/tabs` — tabs.sendMessage permissions clarification (no special permission needed for messaging)
- `https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/naturalWidth` — naturalWidth behavior during load, `complete` property
- `https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/currentSrc` — Why currentSrc is NOT suitable for highest-res extraction
- `https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/disconnect` — Observer cleanup API
- `https://wxt.dev/guide/essentials/content-scripts` — ctx lifecycle, context invalidation cleanup helpers
- npm registry: `srcset@5.0.3`, `parse-srcset@1.0.2` — verified current versions (neither installed; hand-written parser preferred)

### Secondary (MEDIUM confidence)

- `https://wxt.dev/api/reference/wxt/interfaces/isolatedworldcontentscriptdefinition` — ContentScriptContext API (ctx parameter)
- WebSearch cross-verified: CSS `backgroundImage` multi-layer parsing regex pattern — confirmed by multiple developer sources

### Tertiary (LOW confidence — marked for validation)

- MutationObserver `attributeFilter` performance claim — based on MDN docs behavior description and developer consensus; not benchmarked on Viator/GetYourGuide specifically

---

## Metadata

**Confidence breakdown:**
- Standard stack (no new packages): HIGH — Phase 1 stack is already installed; browser APIs are stable
- Architecture (long-lived port pattern): HIGH — Verified directly from Chrome official messaging docs
- srcset parser: HIGH — Format is fully specified in HTML Living Standard; hand-written parser handles all real cases
- CSS background extraction: HIGH — `getComputedStyle` is a standard browser API; regex pattern verified against multiple sources
- MutationObserver lifetime: HIGH — Port `onDisconnect` behavior verified from official Chrome docs
- Blob URL handling: MEDIUM — Detection is straightforward; frequency on target sites is unknown (per STATE.md)
- Dimension checking for CSS backgrounds: MEDIUM — `getBoundingClientRect()` as proxy acknowledged as imperfect

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable browser APIs; WXT patch versions move quickly but these patterns are version-stable)
