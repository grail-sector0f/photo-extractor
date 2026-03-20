# Phase 01: Foundation - Research

**Researched:** 2026-03-19
**Domain:** Chrome MV3 extension scaffolding, WXT framework, Chrome Downloads API, service worker state
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All implementation decisions were deferred to Claude. The following were captured as canonical choices for downstream agents:

- **Popup scaffold**: Wire up the full React popup shell in Phase 1 (WXT entry point, React 18 render, Tailwind CSS configured) — even if the popup only shows a "Test Download" button. Phase 3 adds components to an existing shell rather than scaffolding from scratch.
- **Collision counter format**: Use a custom counter with zero-padded two-digit suffix (`_01`, `_02`, ...) rather than Chrome's native `conflictAction: 'uniquify'` (which produces `photo (1).jpg`). Counter increments by checking existing files via `chrome.downloads.search()` or retrying on conflict.
- **Service worker state scope**: Phase 1 only needs a wakeup mechanism — read/write a small key to `chrome.storage.session` on each action so the service worker does not go dormant mid-operation. No download queue yet.
- **Content script stub**: Phase 1 scaffolds an empty content script entry point (registered in the manifest, WXT entry file created, no logic yet) so Phase 2 has a clean slot to fill without touching the manifest.

### Claude's Discretion

All decisions above were made at Claude's discretion. No locked user preferences exist beyond the project stack:
- Stack: WXT 0.20.x + React 18 + TypeScript + Tailwind CSS 3.x on Manifest V3

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STOR-01 | Files are saved to a `travel-photos/` subfolder inside the user's Downloads folder | Chrome Downloads API `filename` parameter supports relative subfolder paths — `"travel-photos/filename.jpg"` resolves under Downloads automatically |
| STOR-02 | Filename collisions are handled automatically by appending an index (no silent overwrites) | Custom counter strategy using `chrome.downloads.search()` to check history before issuing download; fall back to incrementing suffix if result exists |
</phase_requirements>

---

## Summary

Phase 1 builds the scaffold everything else depends on: a loadable WXT-based Chrome MV3 extension with a React popup, a background service worker, a stub content script, and a verified download pipeline into `Downloads/travel-photos/`. No real image extraction yet — just the architecture and the one hard technical problem (collision-safe naming) resolved correctly before Phase 3 depends on it.

The two requirements in scope (STOR-01, STOR-02) map entirely to the Chrome Downloads API. `chrome.downloads.download()` accepts a `filename` parameter that is a path relative to the Downloads folder, so `"travel-photos/photo.jpg"` is the correct pattern. Chrome creates the subfolder automatically if it does not exist. For collision safety, the custom `_01/_02` pattern requires checking for existing filenames before issuing a download; `chrome.downloads.search()` can query download history by filename, but is not a reliable filesystem check. The more robust approach is to attempt the download with `conflictAction: 'overwrite'` disabled (use `'prompt'` to fail cleanly in dev) or to probe via search and increment a counter before the first download attempt.

WXT 0.20.x is confirmed current (0.20.20 as of March 2026). It generates the manifest from `wxt.config.ts`, auto-registers entrypoints based on file naming conventions, and supports HMR for service workers. React 18 and Tailwind CSS 3.x integrate via `@wxt-dev/module-react` and standard PostCSS setup respectively.

**Primary recommendation:** Scaffold with `npx wxt@latest init` (React template), then layer in Tailwind, configure the manifest with `downloads` permission, implement the download utility with a `chrome.downloads.search()`-based counter, and touch `chrome.storage.session` on every download action to keep the service worker alive.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wxt | 0.20.20 | Build framework — generates manifest, HMR, entrypoint routing | De-facto standard for MV3 extensions in 2025; active maintenance, official React/Vue/Svelte modules |
| @wxt-dev/module-react | 1.2.2 | Wires React 18 into WXT build pipeline | Official WXT module; replaces manual Vite React plugin config |
| react + react-dom | 19.2.4 | UI rendering in popup | Project decision; version locked to 18.x in decisions but 19.x is current |
| typescript | 5.9.3 | Type safety across all entrypoints | WXT scaffolds TypeScript by default; required for type-safe Chrome API usage |
| tailwindcss | 4.2.2 | Utility CSS in popup | Project decision; version 3.x was specified in decisions but 4.x is current |

> **Version note:** The STATE.md and CONTEXT.md specify "React 18" and "Tailwind 3.x". At time of research, React 19.x and Tailwind 4.x are current on npm. The planner should confirm with the user whether to pin to the specified versions or use current. If pinning: `react@18`, `tailwindcss@3`.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/chrome | latest | TypeScript types for Chrome extension APIs | Always — enables type checking on chrome.downloads, chrome.storage, etc. |
| postcss + autoprefixer | latest | Required for Tailwind CSS compilation | Always with Tailwind |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `chrome.downloads.search()` for collision check | `conflictAction: 'uniquify'` | uniquify produces `photo (1).jpg` format — inconsistent with NAME-05 pattern `_01` suffix; custom search approach required |
| `chrome.storage.session` for SW keepalive | `chrome.storage.local` | session is scoped to browser session (cleared on restart), which is correct for ephemeral SW state; local persists longer than needed |
| WXT | Plasmo or bare Vite | WXT is more actively maintained and has better MV3 service worker HMR; Plasmo has known sluggishness in complex builds |

**Installation:**
```bash
# Bootstrap (interactive, choose React template)
npx wxt@latest init photo-extractor

# Add React module (may already be included by template)
npm install @wxt-dev/module-react

# Add Tailwind (Tailwind 3.x if pinning to project spec)
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p

# Chrome types
npm install -D @types/chrome
```

---

## Architecture Patterns

### Recommended Project Structure

```
photo-extractor/
├── wxt.config.ts          # manifest config, permissions, modules
├── tailwind.config.js     # content paths for purging
├── postcss.config.js      # tailwind + autoprefixer
├── tsconfig.json          # auto-generated by WXT
├── package.json
└── entrypoints/
    ├── background.ts      # service worker — download logic + SW keepalive
    ├── popup/
    │   ├── index.html     # WXT popup entrypoint
    │   ├── App.tsx        # React root — "Test Download" button only in Phase 1
    │   └── main.tsx       # ReactDOM.createRoot mount
    └── content.ts         # stub — empty defineContentScript, no logic yet
```

### Pattern 1: WXT Background Service Worker

**What:** Export `defineBackground()` from `entrypoints/background.ts`. All chrome API listeners and the download utility live here.
**When to use:** Any logic that runs outside a UI page (message handling, download triggering).

```typescript
// Source: https://wxt.dev/guide/essentials/entrypoints.html
// entrypoints/background.ts
export default defineBackground({
  main() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'DOWNLOAD_FILE') {
        handleDownload(message.payload).then(sendResponse);
        return true; // keep port open for async response
      }
    });
  },
});
```

### Pattern 2: WXT Popup with React

**What:** `entrypoints/popup/` directory with `index.html` and a React mount. WXT auto-wires it as the extension popup.
**When to use:** All popup UI. Phase 1 is minimal — just a "Test Download" button.

```typescript
// entrypoints/popup/App.tsx
import { useState } from 'react';

export default function App() {
  const [status, setStatus] = useState('');

  const handleTestDownload = () => {
    chrome.runtime.sendMessage({ type: 'DOWNLOAD_FILE', payload: { /* test data */ } }, (res) => {
      setStatus(res?.ok ? 'Saved!' : 'Failed');
    });
  };

  return (
    <div className="p-4 w-64">
      <button onClick={handleTestDownload} className="btn">
        Test Download
      </button>
      <p>{status}</p>
    </div>
  );
}
```

### Pattern 3: Collision-Safe Filename with Custom Counter

**What:** Before calling `chrome.downloads.download()`, query `chrome.downloads.search()` for any existing downloads with the same base filename. Build a padded counter suffix if a match exists.
**When to use:** Every download call. Enforces the `_01/_02` format required by NAME-05.

```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/downloads
async function buildSafeFilename(base: string, ext: string, subfolder: string): Promise<string> {
  // base = 'bali_four-seasons_pool', ext = 'jpg', subfolder = 'travel-photos'
  const pattern = `${subfolder}/${base}`;
  const existing = await chrome.downloads.search({ filenameContains: base, limit: 100 });

  // Filter to exact basename matches (search is a substring match)
  const taken = new Set(
    existing
      .filter((d) => d.filename?.includes(`${pattern}_`) || d.filename?.endsWith(`${pattern}.${ext}`))
      .map((d) => d.filename)
  );

  if (!taken.has(`${pattern}.${ext}`)) {
    return `${pattern}.${ext}`; // no collision, use clean name
  }

  // Find next available counter
  for (let i = 1; i <= 99; i++) {
    const candidate = `${pattern}_${String(i).padStart(2, '0')}.${ext}`;
    if (!taken.has(candidate)) return candidate;
  }

  throw new Error('Too many collisions — counter exhausted at 99');
}
```

> **Caveat:** `chrome.downloads.search()` queries download *history*, not the actual filesystem. If the user has manually renamed or deleted files, history and disk may diverge. For Phase 1, history-based collision avoidance is sufficient. A more robust approach (probing with `conflictAction: 'overwrite'` and detecting conflicts) could be added later.

### Pattern 4: Service Worker Keepalive via chrome.storage.session

**What:** Touch `chrome.storage.session` at the start of every meaningful operation. This resets the 30-second idle timer, preventing Chrome from terminating the SW mid-download.
**When to use:** Wrap any async operation that could exceed 30 seconds.

```typescript
// Call this before any async download operation
async function keepAlive(): Promise<void> {
  await chrome.storage.session.set({ _lastActive: Date.now() });
}
```

### Pattern 5: Content Script Stub

**What:** An empty `defineContentScript` that WXT registers in the manifest. Phase 2 fills in the extraction logic without touching manifest or wxt.config.ts.
**When to use:** Scaffold in Phase 1, implement in Phase 2.

```typescript
// entrypoints/content.ts
export default defineContentScript({
  matches: ['<all_urls>'],
  main(_ctx) {
    // Phase 2 fills this in
  },
});
```

### WXT Manifest Configuration

```typescript
// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Photo Extractor',
    description: 'Save travel photos with structured naming',
    permissions: ['downloads', 'storage'],
    // host_permissions added in Phase 2 when content script needs page access
  },
});
```

### Anti-Patterns to Avoid

- **Global variables in background.ts outside `main()`**: WXT imports background files in Node.js during build; any runtime code outside `main()` will crash the build. All listeners and state must be inside `main()`.
- **Relying on in-memory state in the service worker**: Chrome can terminate the SW at any time. Any state that needs to survive (counters, download queues) must be in `chrome.storage`, not a module-level variable.
- **Using `conflictAction: 'uniquify'` for final filenames**: Chrome appends `(1)` format, which is inconsistent with the `_01` naming convention required by NAME-05 and expected by the user.
- **Absolute paths in `chrome.downloads.download({ filename })`**: Chrome rejects absolute paths silently. Always use relative paths from the Downloads root — `"travel-photos/file.jpg"` not `"/Users/.../travel-photos/file.jpg"`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Manifest generation | Hand-written manifest.json | WXT auto-generation from wxt.config.ts | WXT handles MV3/MV2 differences, dev vs prod modes, HMR injection |
| Vite + Chrome types setup | Manual tsconfig + vite.config | WXT scaffold | WXT generates correct tsconfig with Chrome types path, handles code splitting for extension contexts |
| Popup HTML boilerplate | Custom HTML template | WXT entrypoints/popup/ convention | WXT injects correct CSP headers and links built JS automatically |
| Tailwind class purging across entrypoints | Custom PurgeCSS config | tailwind.config.js `content` pointing at entrypoints/ | Multiple popup + content script files need a shared purge config |

**Key insight:** The main risk area is service worker state. The instinct to use a module-level variable for "current download counter" will cause subtle bugs where the counter resets to 0 mid-session. Everything persistent goes through `chrome.storage`.

---

## Common Pitfalls

### Pitfall 1: Service Worker Termination During Download

**What goes wrong:** The SW starts a download, goes idle for 30 seconds (e.g., user stops interacting), Chrome terminates it. Any in-progress logic or pending state is lost.
**Why it happens:** MV3 service workers are not persistent by design. Chrome treats them like fetch handlers — event in, event out, sleep.
**How to avoid:** Call `chrome.storage.session.set({ _lastActive: Date.now() })` before any async download operation. Any Chrome API call resets the idle timer.
**Warning signs:** Downloads that work for the first few files then silently fail or produce empty results.

### Pitfall 2: Manifest Permission Missing for downloads

**What goes wrong:** `chrome.downloads.download()` silently fails or throws "Could not call downloads.download" if the `"downloads"` permission is not in the manifest.
**Why it happens:** Permission is not auto-added by WXT — it must be declared manually in `wxt.config.ts` under `manifest.permissions`.
**How to avoid:** Add `permissions: ['downloads', 'storage']` to the manifest config before writing any download code.
**Warning signs:** `chrome.downloads` is undefined in the service worker, or download calls produce no file and no error.

### Pitfall 3: Runtime Code Outside defineBackground main()

**What goes wrong:** WXT build fails with a Node.js-context error, or Chrome logs "Cannot read properties of undefined (reading 'addListener')".
**Why it happens:** WXT imports all entrypoint files during the Vite build in a Node.js context (for analysis), where Chrome APIs do not exist.
**How to avoid:** All runtime logic — event listeners, API calls, imports that reference `chrome` — must be inside the `main()` function body.
**Warning signs:** Build errors referencing "chrome is not defined" or "Cannot read properties of undefined".

### Pitfall 4: chrome.downloads.search() Returns History, Not Filesystem

**What goes wrong:** A user downloads `travel-photos/bali_pool.jpg`, then deletes it from disk. The next download checks history, sees the filename, and increments to `_01` unnecessarily. More critically: history only tracks downloads initiated *by this browser session* — files from another browser or manually copied files are invisible.
**Why it happens:** `chrome.downloads.search()` queries Chrome's internal download database, not the filesystem.
**How to avoid:** For Phase 1 this is acceptable — document the limitation. A production fix would use the Native Messaging API or an Offscreen Document to check the actual filesystem, which is out of Phase 1 scope.
**Warning signs:** Files named `_01` when no collision exists on disk, or collisions missed for files not in Chrome's history.

### Pitfall 5: Tailwind Classes Not Appearing in Popup

**What goes wrong:** Popup renders but all Tailwind classes are stripped out — blank, unstyled UI.
**Why it happens:** Tailwind's purge step removes unused classes. If the `content` array in `tailwind.config.js` does not include the popup's `.tsx` files, all classes are pruned as "unused".
**How to avoid:** Set `content: ['./entrypoints/**/*.{html,ts,tsx}']` in `tailwind.config.js`. Import the CSS file in the popup's `index.html` or `main.tsx`.
**Warning signs:** Extension popup loads but shows unstyled raw HTML; no Tailwind utilities applied.

---

## Code Examples

Verified patterns from official sources:

### Initiating a Download with Subfolder

```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/downloads
// filename is relative to the user's Downloads directory
// Chrome creates the subfolder automatically if it does not exist
await chrome.downloads.download({
  url: 'https://example.com/photo.jpg',
  filename: 'travel-photos/bali_four-seasons_pool_01.jpg',
  conflictAction: 'overwrite', // we handle collisions ourselves before this call
  saveAs: false,
});
```

### Querying Download History

```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/downloads
const results = await chrome.downloads.search({
  filenameContains: 'travel-photos/bali',
  limit: 100,
  orderBy: ['-startTime'],
});
// results[].filename is the absolute on-disk path, e.g. /Users/jennifer/Downloads/travel-photos/bali_pool_01.jpg
```

### chrome.storage.session Read/Write

```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/storage
// session storage is cleared when the browser session ends (browser close)
// Appropriate for ephemeral SW state
await chrome.storage.session.set({ _lastActive: Date.now() });
const data = await chrome.storage.session.get('_lastActive');
```

### WXT Background Entrypoint Pattern

```typescript
// Source: https://wxt.dev/guide/essentials/entrypoints.html
// entrypoints/background.ts — ALL runtime code inside main()
export default defineBackground({
  main() {
    chrome.runtime.onInstalled.addListener(() => {
      console.log('[photo-extractor] extension installed');
    });

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.type === 'DOWNLOAD') {
        handleDownload(msg).then(sendResponse);
        return true; // async response
      }
    });
  },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manifest V2 background pages (persistent) | MV3 service workers (event-driven, terminable) | Chrome 88 / enforced 2023 | State must live in storage, not memory |
| Hand-written manifest.json | WXT/Plasmo auto-generation | 2022-2023 | Manifest generated from config + file conventions |
| Webpack-based extension bundling | Vite-based (WXT uses Vite internally) | 2022+ | Much faster dev builds and HMR |
| `conflictAction: 'uniquify'` as standard collision fix | Custom counter logic for controlled naming | Ongoing | Required when filename format must be controlled (as in NAME-05) |

**Deprecated/outdated:**
- `chrome.storage.sync` for large state: 8KB limit per item, 100KB total — too small for download queues; use `chrome.storage.local` or `session` instead.
- Persistent background pages (`"persistent": true` in MV2): Not available in MV3. Any code that depended on this needs to move state to storage.

---

## Open Questions

1. **React 18 vs 19 / Tailwind 3 vs 4**
   - What we know: STATE.md and CONTEXT.md specify React 18 and Tailwind 3.x. Current npm versions are React 19.x and Tailwind 4.x.
   - What's unclear: Whether the user intended to pin to those specific versions or used them as approximate references.
   - Recommendation: Planner should note the discrepancy and default to the locked spec (React 18, Tailwind 3.x) unless user confirms otherwise. Pinning avoids breaking API changes in React 19.

2. **Distribution path (unpacked vs. Web Store)**
   - What we know: STATE.md flags this as unresolved: "Confirm distribution path (unpacked vs. Web Store) before Phase 1 manifest is finalized."
   - What's unclear: Web Store distribution requires optional_permissions patterns instead of always-on host_permissions for some use cases.
   - Recommendation: Phase 1 can proceed with unpacked developer mode. Host permissions are not needed yet (content script stub has `<all_urls>` — acceptable for dev mode). Revisit before Phase 2 ships.

3. **chrome.downloads.search() vs actual filesystem for collision check**
   - What we know: History-based check is the only Chrome API option short of Native Messaging.
   - What's unclear: How often Jennifer will have pre-existing files from outside Chrome (e.g., manually copied photos) that would cause missed collisions.
   - Recommendation: Accept history-based check for Phase 1. Document the gap clearly. Phase 3 can add a retry-on-conflict pattern if real collisions are observed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (WXT uses Vite; Vitest is the natural unit test companion) |
| Config file | `vitest.config.ts` — does not exist yet, Wave 0 gap |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

> Chrome extension integration testing (actually loading the extension and triggering downloads) requires a tool like Playwright with extension support or puppeteer-in-extension. That level of testing is out of scope for Phase 1. Unit tests covering the collision-counter logic and filename-building utility are fully achievable without a real browser.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STOR-01 | `buildSafeFilename()` produces path with `travel-photos/` prefix | unit | `npx vitest run tests/filename.test.ts` | Wave 0 |
| STOR-01 | `chrome.downloads.download()` called with correct relative subfolder path | unit (mocked chrome API) | `npx vitest run tests/download.test.ts` | Wave 0 |
| STOR-02 | Clean filename returned when no collision in history | unit | `npx vitest run tests/filename.test.ts` | Wave 0 |
| STOR-02 | `_01` suffix appended when base filename exists in history | unit | `npx vitest run tests/filename.test.ts` | Wave 0 |
| STOR-02 | `_02` suffix appended when `_01` also exists | unit | `npx vitest run tests/filename.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/filename.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/filename.test.ts` — covers STOR-01 subfolder path format + STOR-02 collision counter logic
- [ ] `tests/download.test.ts` — covers STOR-01 chrome.downloads.download call with mocked chrome API
- [ ] `vitest.config.ts` — framework not yet installed or configured
- [ ] Framework install: `npm install -D vitest` — no test framework detected in project

---

## Sources

### Primary (HIGH confidence)

- `https://wxt.dev/guide/essentials/entrypoints.html` — Background, popup, content script entrypoint conventions
- `https://wxt.dev/guide/essentials/project-structure.html` — Directory layout and config files
- `https://wxt.dev/guide/essentials/config/manifest.html` — Manifest generation from wxt.config.ts
- `https://developer.chrome.com/docs/extensions/reference/api/downloads` — chrome.downloads API: filename, conflictAction, onDeterminingFilename
- `https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle` — Service worker lifecycle and 30-second idle termination
- npm registry: `wxt@0.20.20`, `@wxt-dev/module-react@1.2.2`, `react@19.2.4`, `tailwindcss@4.2.2`, `typescript@5.9.3` (verified via `npm view`)

### Secondary (MEDIUM confidence)

- `https://wxt.dev/guide/essentials/frontend-frameworks` — React module setup with `@wxt-dev/module-react`
- Chrome Developer Blog: "Longer extension service worker lifetimes" — API calls reset the idle timer (Chrome 116+)

### Tertiary (LOW confidence — marked for validation)

- WebSearch results on collision avoidance patterns — pattern is author reasoning based on API docs, not an official Chrome recommendation
- Vitest as test framework recommendation — reasonable given Vite/WXT stack but not an official WXT recommendation; validate before committing

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm versions verified live; WXT and Chrome API docs fetched directly
- Architecture: HIGH — WXT entrypoint conventions verified from official docs; Chrome Downloads API behavior verified from chrome.com
- Collision strategy: MEDIUM — based on documented API behavior and developer patterns; one known gap (history vs filesystem)
- Pitfalls: MEDIUM-HIGH — service worker termination and permission issues are well-documented; Tailwind purge pitfall verified via standard Tailwind docs pattern

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable APIs; WXT patch versions move fast but minor changes are unlikely to break these patterns)
