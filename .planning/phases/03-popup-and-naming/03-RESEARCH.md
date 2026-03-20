# Phase 3: Popup and Naming - Research

**Researched:** 2026-03-20
**Domain:** Chrome Extension Popup UI (React 18 + Tailwind CSS 3.x) + Chrome Storage API
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Scan trigger:** Manual "Scan Page" button. Popup opens idle (no skeleton, no scan) until Jennifer clicks Scan. After clicking: show loading skeleton grid ("Scanning page..." header) while waiting for SCAN_RESULT. UI-SPEC auto-scan-on-open description is overridden by this decision. The Scan button is authoritative.
- **Category field:** Plain `<input type="text">` with HTML `<datalist>`. Presets: room, pool, lobby, exterior, food, excursion, beach, spa, activities. Free text always accepted. No dropdown locking.
- **Batch download feedback:** Parallel downloads preferred. Button shows "Downloading..." during operation. Progress shows "Saving X of N..." count. On success: "Saved N photos to Downloads/travel-photos/". On partial failure: "Saved X of N — Y failed to download." On full failure: "Download failed. Check your internet connection and try again."
- **Notes field:** Optional, labeled "Notes (optional)". Filename format: `destination_vendor_category_index.ext` (notes omitted when empty). When filled: `destination_vendor_category_notes_index.ext`.
- **Character normalization:** lowercase, spaces to hyphens, strip any character that is not alphanumeric or hyphen. Conservative — Tern Travel character limits unknown.
- **Last-used pre-fill:** `chrome.storage.local` — persist destination/vendor/category on each download, restore on popup mount. Notes field NOT persisted.
- **Design system:** Plain Tailwind CSS 3.x. No component library. No icon font. Unicode symbols and text labels only. system-ui font.
- **Popup width:** 360px fixed (`w-[360px]`).

### Claude's Discretion

- Parallel vs. sequential download order (parallel preferred per decisions)
- Exact character normalization regex (strip non-alphanumeric/hyphen/underscore)
- Whether to show a per-image progress indicator or only overall count (overall count is minimum)
- Blob count display location within the UI (header or helper text)
- Internal React state management approach (useState/useReducer — no external state library)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Extension popup displays extracted images as a visual thumbnail grid | ThumbnailGrid component: 3-col CSS grid, ThumbnailCard per image |
| UI-02 | User can click individual thumbnails to select or deselect them | ThumbnailCard selection toggle with `aria-pressed`, blue ring + checkmark overlay |
| UI-03 | User can select all or deselect all images with a single action | SelectionBar component with "Select All" / "Clear All" toggle |
| UI-04 | Download button saves only the selected images | Filter selected IDs, call triggerDownload via background DOWNLOAD_FILE message for each |
| NAME-01 | User fills in a destination field before downloading | Destination `<input type="text">` in NamingForm, required, validated before download enabled |
| NAME-02 | User fills in a property/vendor field before downloading | Vendor `<input type="text">` in NamingForm, required |
| NAME-03 | User selects or types a category before downloading | Category `<input type="text">` with `<datalist>` of presets — free text accepted |
| NAME-04 | User can add an optional notes/tags field | Notes `<input type="text">` labeled "Notes (optional)" — not required |
| NAME-05 | Files named `destination_vendor_category_[notes_]index.ext` | `normalizeField()` + `buildBasename()` in `lib/naming.ts`, passed to `triggerDownload()` |
</phase_requirements>

---

## Summary

Phase 3 replaces the Phase 1 stub `App.tsx` with a complete popup UI. The work has three distinct sub-problems: (1) building the visual layer — thumbnail grid, selection controls, naming form; (2) wiring the existing Phase 2 scan port protocol into the UI; and (3) wiring the existing Phase 1 download pipeline into the naming form. All infrastructure exists. This phase is purely integration and UI work.

The popup is a React 18 component tree with local state only (no Redux, no Zustand). The most complex state management challenge is tracking scan status, image list, selection set, form values, download progress, and error state simultaneously — this is a good candidate for `useReducer` rather than many disconnected `useState` calls. Everything else is straightforward: the Chrome APIs are already mocked in tests, the port protocol is documented, and the download function signature is fixed.

The one non-obvious technical constraint is that the popup talks to the background service worker for downloads (via `DOWNLOAD_FILE` message), not directly to `triggerDownload` — this is because `chrome.downloads` is only available in the service worker context. The Phase 2 content script is reached via a long-lived port (`chrome.runtime.connect({ name: 'scan-session' })`). Both paths are already working from Phase 1 and Phase 2.

**Primary recommendation:** Build bottom-up — `lib/naming.ts` first (pure function, fully testable), then individual UI components (ThumbnailCard, ThumbnailGrid, NamingForm, etc.), then assemble in App.tsx with `useReducer` for unified state, then wire scan port and download message calls last.

---

## Standard Stack

### Core (all pinned in package.json — no installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3.x | Component tree, state management | Already installed; pinned to 18.x per Phase 1 decision |
| Tailwind CSS | 3.4.x | All visual styling | Already installed; pinned to 3.x per Phase 1 decision |
| TypeScript | 5.x | Type safety | Already installed |
| WXT | 0.20.x | Extension build, popup entrypoint | Already installed |
| Vitest | 3.x | Unit tests | Already installed |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsdom | 29.x | Test environment | Already in setup; needed for component tests that touch DOM |
| chrome (types) | @types/chrome | TypeScript types for Chrome APIs | Already installed |

**No new installs required for Phase 3.** All dependencies are already present.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useReducer` | Multiple `useState` calls | useReducer wins when 5+ related state fields update together — avoids stale closure bugs during async download |
| `<datalist>` for category | Custom dropdown | datalist is native HTML, zero JS overhead, free-text allowed — perfect for this case |
| `chrome.storage.local` for pre-fill | `chrome.storage.sync` | local is correct — sync would push data to Jennifer's other devices; not wanted |
| Parallel downloads via `Promise.all` | Sequential loop | Parallel is faster; Chrome handles download concurrency natively; each download is independent |

---

## Architecture Patterns

### Recommended Project Structure

New files Phase 3 creates:

```
lib/
└── naming.ts              # Pure function: normalizeField(), buildBasename()

entrypoints/popup/
└── App.tsx                # Full replacement — useReducer + all wiring
                           # (main.tsx and style.css are untouched)

tests/unit/
├── naming.test.ts         # Already exists (empty or stub) — fill out
└── popup/
    ├── App.test.tsx        # New — scan state machine, download dispatch
    ├── ThumbnailCard.test.tsx
    └── NamingForm.test.tsx
```

Components live inline in `App.tsx` or as sibling files in `entrypoints/popup/` — no separate `components/` folder needed at this scale.

### Pattern 1: useReducer for Popup State

**What:** Single reducer handles all popup state transitions. Avoids stale closure bugs that occur when multiple `useState` setters are called inside async callbacks.

**When to use:** Any time 4+ related state fields update in response to the same event (scan complete, download started, download progress tick, download done).

**Recommended state shape:**
```typescript
type ScanStatus = 'idle' | 'scanning' | 'done' | 'timeout';
type DownloadStatus = 'idle' | 'downloading' | 'success' | 'partial' | 'error';

interface PopupState {
  scanStatus: ScanStatus;
  images: ImageResult[];       // populated by SCAN_RESULT + IMAGE_FOUND
  blobCount: number;           // from SCAN_RESULT payload
  selected: Set<string>;       // image URLs of selected thumbnails
  destination: string;
  vendor: string;
  category: string;
  notes: string;
  downloadStatus: DownloadStatus;
  downloadProgress: { done: number; total: number };
  errorMessage: string;
}
```

**Action types:**
```typescript
type Action =
  | { type: 'SCAN_STARTED' }
  | { type: 'SCAN_RESULT'; payload: { images: ImageResult[]; blobCount: number } }
  | { type: 'IMAGE_FOUND'; payload: ImageResult }
  | { type: 'SCAN_TIMEOUT' }
  | { type: 'TOGGLE_SELECT'; url: string }
  | { type: 'SELECT_ALL' }
  | { type: 'CLEAR_ALL' }
  | { type: 'FIELD_CHANGE'; field: 'destination' | 'vendor' | 'category' | 'notes'; value: string }
  | { type: 'DOWNLOAD_STARTED'; total: number }
  | { type: 'DOWNLOAD_PROGRESS'; done: number }
  | { type: 'DOWNLOAD_DONE'; saved: number; failed: number }
  | { type: 'PREFILL_LOADED'; destination: string; vendor: string; category: string };
```

### Pattern 2: Scan Port Wiring (useEffect)

**What:** Open the scan port inside a `useEffect` that fires when the user clicks Scan. Tear it down via the port's `onDisconnect` — but the popup also needs to handle teardown when the React component unmounts (rare, but correct).

**Correct pattern:**
```typescript
// Source: content.ts scan protocol (Phase 2)
function startScan(dispatch: React.Dispatch<Action>) {
  dispatch({ type: 'SCAN_STARTED' });

  const port = chrome.runtime.connect({ name: 'scan-session' });

  port.onMessage.addListener((msg: { type: string; payload: unknown }) => {
    if (msg.type === 'SCAN_RESULT') {
      const { images, blobCount } = msg.payload as { images: ImageResult[]; blobCount: number };
      dispatch({ type: 'SCAN_RESULT', payload: { images, blobCount } });
    }
    if (msg.type === 'IMAGE_FOUND') {
      dispatch({ type: 'IMAGE_FOUND', payload: msg.payload as ImageResult });
    }
  });

  port.postMessage({ type: 'SCAN_PAGE' });

  // 5-second timeout — if no SCAN_RESULT arrives, show empty state
  const timer = setTimeout(() => dispatch({ type: 'SCAN_TIMEOUT' }), 5000);

  return () => {
    clearTimeout(timer);
    port.disconnect();
  };
}
```

### Pattern 3: Batch Download with Progress

**What:** Parallel downloads via `Promise.allSettled` (not `Promise.all` — `allSettled` continues even if some fail, enabling partial-failure reporting).

```typescript
async function runDownloads(
  selected: string[],
  basename: string,
  dispatch: React.Dispatch<Action>
) {
  dispatch({ type: 'DOWNLOAD_STARTED', total: selected.length });
  let done = 0;

  const results = await Promise.allSettled(
    selected.map(async (url) => {
      const ext = deriveExt(url);  // see Pattern 4
      await sendDownloadMessage(url, basename, ext);
      dispatch({ type: 'DOWNLOAD_PROGRESS', done: ++done });
    })
  );

  const failed = results.filter(r => r.status === 'rejected').length;
  dispatch({ type: 'DOWNLOAD_DONE', saved: selected.length - failed, failed });
}
```

**Why `Promise.allSettled` not `Promise.all`:** `Promise.all` rejects immediately on first failure, giving no partial-success information. `Promise.allSettled` always resolves with a status per promise — enables "Saved X of N — Y failed" copy.

### Pattern 4: Extension Derivation from URL

The `triggerDownload` function requires an `ext` parameter. Images from the scan have URLs like `https://example.com/photo.jpg?w=800` — extract the extension from the path component, not the full URL.

```typescript
function deriveExt(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const dot = pathname.lastIndexOf('.');
    if (dot === -1) return 'jpg';  // fallback for extensionless URLs
    const raw = pathname.slice(dot + 1).toLowerCase();
    // Accept only known image extensions; fall back to jpg for anything else
    return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(raw) ? raw : 'jpg';
  } catch {
    return 'jpg';
  }
}
```

### Pattern 5: chrome.storage.local Pre-fill

```typescript
// On mount — load persisted values
useEffect(() => {
  chrome.storage.local.get(['destination', 'vendor', 'category']).then((data) => {
    dispatch({
      type: 'PREFILL_LOADED',
      destination: data.destination ?? '',
      vendor: data.vendor ?? '',
      category: data.category ?? '',
    });
  });
}, []);

// After successful download — persist values
chrome.storage.local.set({ destination, vendor, category });
```

Note: `chrome.storage.local` is available in popup context (unlike `chrome.downloads`, which requires the background). The existing `tests/setup.ts` mock only has `chrome.storage.session` — the mock needs `chrome.storage.local` added for Phase 3 tests.

### Pattern 6: Field Normalization (lib/naming.ts)

```typescript
// Source: CONTEXT.md character normalization decision
export function normalizeField(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')           // spaces to hyphens
    .replace(/[^a-z0-9\-]/g, '');  // strip anything not alphanumeric or hyphen
}

export function buildBasename(
  destination: string,
  vendor: string,
  category: string,
  notes?: string
): string {
  const parts = [destination, vendor, category].map(normalizeField);
  if (notes && notes.trim()) {
    parts.push(normalizeField(notes));
  }
  return parts.join('_');
}
```

This is a pure function with no side effects — write and test it first, before any UI work.

### Anti-Patterns to Avoid

- **Calling `triggerDownload` directly from the popup:** `triggerDownload` calls `chrome.downloads.download`, which is only available in the service worker. The popup MUST go through the `DOWNLOAD_FILE` message to the background. (Phase 1 App.tsx already demonstrates this pattern correctly.)
- **Using `Promise.all` for batch downloads:** Fails the whole batch on first error. Use `Promise.allSettled`.
- **useState for inter-related scan/download state:** When async callbacks update multiple fields, stale closures cause bugs. Use `useReducer`.
- **Calling `chrome.runtime.connect` outside of a user gesture or useEffect:** Port connections made before the content script is ready will silently fail or produce empty results.
- **Storing image data (blobs) in state:** ImageResult contains URLs, not binary data. Download the URL via the background at download time. Do not attempt to cache or convert images in the popup.
- **Relying on `chrome.storage.sync` for form pre-fill:** `sync` propagates across devices — wrong for Jennifer's case. Use `local`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collision-safe filenames | Custom counter logic | `buildSafeFilename` in `lib/download.ts` | Already handles Chrome history search, edge cases, and the `_01/_02` format required by NAME-05 |
| Service worker keepalive | Manual `chrome.storage` writes | `keepAlive()` in `lib/keepalive.ts` | Called automatically by `triggerDownload` — no manual call needed |
| Download execution | Direct `chrome.downloads.download` calls | `DOWNLOAD_FILE` message to background | Downloads API is service-worker-only; popup context cannot call it directly |
| Image extraction | DOM scanning | Phase 2 content script via `scan-session` port | Already implemented, tested, and handles lazy-loading via MutationObserver |
| Category autocomplete | Custom dropdown component | HTML `<datalist>` on `<input>` | Native browser feature, zero JS, free text permitted, no accessibility overhead |

---

## Common Pitfalls

### Pitfall 1: chrome.storage.local not mocked in test setup

**What goes wrong:** Tests for `PREFILL_LOADED` action or `chrome.storage.local.set()` calls throw "chrome.storage.local is not a function" because `tests/setup.ts` only mocks `chrome.storage.session`.

**Why it happens:** `chrome.storage.session` was all Phase 1-2 needed. Phase 3 is the first to use `chrome.storage.local`.

**How to avoid:** Add `chrome.storage.local` mock to `tests/setup.ts` before writing any popup tests that touch pre-fill. Pattern matches the existing session mock.

**Warning signs:** Test suite passes individually but fails when importing App.tsx with useEffect that calls `chrome.storage.local.get`.

### Pitfall 2: Scan port opened before content script is ready

**What goes wrong:** `chrome.runtime.connect({ name: 'scan-session' })` succeeds (returns a port object) even if the content script hasn't loaded yet. The `SCAN_PAGE` message is dropped silently. No error, no result — popup hangs.

**Why it happens:** Content scripts load asynchronously when a tab navigates. If the user opens the popup immediately after loading a page, the content script may not be registered yet.

**How to avoid:** The 5-second timeout in the scan logic handles this gracefully — after timeout, dispatch `SCAN_TIMEOUT` and show empty state. Alternatively, query the active tab before connecting to verify the content script is present.

**Warning signs:** Popup shows "Scanning page..." indefinitely on freshly loaded tabs.

### Pitfall 3: URL.pathname extension extraction fails for CDN URLs

**What goes wrong:** CDN image URLs often look like `https://cdn.example.com/image/upload/v123/photo` (no extension in pathname) or `https://example.com/image.jpg?format=webp` (extension in query string). The naive `url.split('.').pop()` approach produces wrong results.

**Why it happens:** Modern image CDNs serve images via content negotiation (the extension is in the Accept header, not the URL). The URL may have no extension, or have a misleading one.

**How to avoid:** Use the `deriveExt` pattern above — parse the URL properly, fall back to `'jpg'` for unrecognized or absent extensions. This is safe because Chrome and Tern Travel both handle .jpg files regardless of the actual content-type.

**Warning signs:** Downloaded files have wrong extensions (e.g., `.undefined`) or download failures for CDN-hosted images.

### Pitfall 4: React key on thumbnail causes full re-render when new images arrive

**What goes wrong:** If ThumbnailCard is keyed by array index instead of image URL, every `IMAGE_FOUND` message causes all existing thumbnails to re-render and re-load their images.

**Why it happens:** `key={index}` changes the relationship between index and component when a new item is inserted. `key={image.url}` keeps each component stable.

**How to avoid:** Always use `image.url` as the React key for ThumbnailCard. This is a standard React pattern.

**Warning signs:** Thumbnails flicker or reload during scanning.

### Pitfall 5: Download button enabled before required fields have actual content

**What goes wrong:** A field with only whitespace (e.g., "   ") passes a `.length > 0` check but produces an empty normalized basename (""), which creates a malformed filename.

**Why it happens:** `value.trim().length === 0` is the correct check; `value.length > 0` is not.

**How to avoid:** The Download button enabled check must use `field.trim().length > 0` for all three required fields. `normalizeField` will collapse whitespace-only strings to empty strings, which will produce malformed filenames if not caught earlier.

**Warning signs:** Files saved as `___01.jpg` (triple underscore, no field values).

---

## Code Examples

### DOWNLOAD_FILE message (established pattern from background.ts)

```typescript
// Source: entrypoints/background.ts + entrypoints/popup/App.tsx (Phase 1)
function sendDownloadMessage(url: string, basename: string, ext: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'DOWNLOAD_FILE', payload: { url, basename, ext } },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response?.ok) {
          resolve();
        } else {
          reject(new Error(response?.error ?? 'unknown error'));
        }
      }
    );
  });
}
```

### ThumbnailCard selection state (UI-02)

```typescript
// Blue ring + checkmark on selected; aria-pressed for accessibility (UI-SPEC)
function ThumbnailCard({ image, selected, onToggle }: ThumbnailCardProps) {
  return (
    <button
      onClick={() => onToggle(image.url)}
      aria-pressed={selected}
      className={[
        'relative rounded overflow-hidden bg-gray-100',
        'focus:outline-none focus:ring-2 focus:ring-blue-500',
        selected ? 'ring-2 ring-blue-600' : '',
      ].join(' ')}
    >
      <img src={image.url} alt="" className="w-full h-20 object-cover" />
      {selected && (
        <span className="absolute inset-0 flex items-center justify-center
                         bg-blue-600/20 text-blue-600 text-lg font-bold">
          ✓
        </span>
      )}
    </button>
  );
}
```

### chrome.storage.local mock addition needed in tests/setup.ts

```typescript
// Add to chromeMock in tests/setup.ts:
local: {
  get: vi.fn().mockResolvedValue({}),
  set: vi.fn().mockResolvedValue(undefined),
},
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Promise.all` for batch async | `Promise.allSettled` | ES2020 | Enables partial-failure reporting without try/catch per item |
| Multiple `useState` for complex forms | `useReducer` | React 16.8 hooks era | Single dispatch function, no stale closure bugs in async callbacks |
| HTML `<select>` for category | `<input>` + `<datalist>` | HTML5 | Free text + suggestions without custom JS |
| `chrome.storage.sync` for user prefs | `chrome.storage.local` | n/a — design choice | Local only; no cross-device sync; correct for single-user extension |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAME-01/02/03/04/05 | `normalizeField` lowercases, strips specials, spaces-to-hyphens | unit | `npm test -- naming` | Partial — `tests/unit/naming.test.ts` exists for `buildSafeFilename`; needs `normalizeField`/`buildBasename` tests added |
| NAME-05 | `buildBasename` omits notes when empty, includes when filled | unit | `npm test -- naming` | ❌ Wave 0 — add to naming.test.ts |
| UI-01 | ThumbnailGrid renders correct count of images | unit | `npm test -- ThumbnailCard` | ❌ Wave 0 |
| UI-02 | Clicking a thumbnail toggles selection state | unit | `npm test -- ThumbnailCard` | ❌ Wave 0 |
| UI-03 | Select All selects all; Clear All deselects all | unit | `npm test -- App` | ❌ Wave 0 |
| UI-04 | Download only dispatches messages for selected images | unit | `npm test -- App` | ❌ Wave 0 |
| Pre-fill | `chrome.storage.local.get` values pre-populate fields on mount | unit | `npm test -- App` | ❌ Wave 0 |
| Download feedback | Progress counter increments; success/partial/error messages correct | unit | `npm test -- App` | ❌ Wave 0 |

Note: The popup (App.tsx) is a React component. Vitest + jsdom can test it, but React Testing Library (`@testing-library/react`) is not installed. Options:
1. Test the reducer and business logic (naming, download dispatch) as pure unit tests — no component rendering needed.
2. Add `@testing-library/react` to test the rendered component tree.

Recommendation: Test the reducer and `lib/naming.ts` as pure unit tests (no new deps). For component-level tests, test the reducer directly — the UI correctness is implicitly validated by the download and selection logic tests.

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `lib/naming.ts` — does not exist yet; must be created before any tests run against it
- [ ] `tests/unit/naming.test.ts` — extend to cover `normalizeField` and `buildBasename` (currently only covers `buildSafeFilename` from `lib/download.ts`)
- [ ] `tests/setup.ts` — add `chrome.storage.local` mock (get + set) before any App.tsx tests
- [ ] `tests/unit/popup/App.test.tsx` or `tests/unit/App.test.tsx` — new file for reducer and download dispatch tests
- [ ] Decision needed: add `@testing-library/react` for component rendering tests, or test reducer only. Planner should include this as a Wave 0 task.

---

## Open Questions

1. **React Testing Library for component tests**
   - What we know: Vitest + jsdom is installed. No testing library for React components exists.
   - What's unclear: Whether the planner should add `@testing-library/react` to test rendered output, or whether pure reducer tests are sufficient for this phase.
   - Recommendation: Add `@testing-library/react` — it's the standard for React component testing and makes UI-01/UI-02/UI-03 tests meaningful. Cost is one `npm install`.

2. **Image load error handling in ThumbnailCard**
   - What we know: UI-SPEC lists a `load-error` state for ThumbnailCard.
   - What's unclear: What should the card show when `<img>` fires `onerror`? (broken image icon, gray placeholder?)
   - Recommendation: Show a gray placeholder tile with a neutral label. The image is still selectable/deselectable by URL — downloading will likely also fail, which is handled by the partial-failure path.

3. **defineBackground stub for popup tests**
   - What we know: `tests/setup.ts` has `defineContentScript` stubbed for content.ts tests.
   - What's unclear: If any popup test imports background.ts (unlikely but possible via shared lib), `defineBackground` would also need a stub.
   - Recommendation: Keep popup tests isolated to `App.tsx` and `lib/naming.ts`. Do not import `background.ts` from popup tests.

---

## Sources

### Primary (HIGH confidence)

- `entrypoints/content.ts` — Scan port protocol: connect → SCAN_PAGE → SCAN_RESULT / IMAGE_FOUND
- `lib/download.ts` — `triggerDownload` and `buildSafeFilename` signatures, STOR-01/STOR-02 implementation
- `lib/keepalive.ts` — SW keepalive pattern
- `entrypoints/background.ts` — DOWNLOAD_FILE message handler; the only way popup can trigger downloads
- `tests/setup.ts` — Chrome mock structure; gap identified (missing `chrome.storage.local`)
- `.planning/phases/03-popup-and-naming/03-UI-SPEC.md` — Full visual contract, components, copy, states
- `.planning/phases/03-popup-and-naming/03-CONTEXT.md` — All locked decisions

### Secondary (MEDIUM confidence)

- React 18 `useReducer` docs pattern — standard React documentation
- `Promise.allSettled` — MDN standard, ES2020 baseline
- HTML `<datalist>` — MDN standard, all modern browsers

### Tertiary (LOW confidence)

- Chrome extension popup max height (600px) — documented in UI-SPEC from Phase 1 research; assumed still accurate for Chrome MV3
- Tern Travel filename character limitations — explicitly unknown per CONTEXT.md; normalization is conservative by design

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages pinned in package.json; no new dependencies required
- Architecture: HIGH — port protocol and download pipeline fully implemented in prior phases; patterns are verified against existing code
- Pitfalls: HIGH — identified from actual code inspection of tests/setup.ts, background.ts, and content.ts
- Test gaps: HIGH — inspected all existing test files; gaps are known and enumerated

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable stack — 30-day window is conservative)
