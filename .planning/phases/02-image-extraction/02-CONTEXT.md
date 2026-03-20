# Phase 2: Image Extraction - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Fill in the content script stub (`entrypoints/content.ts`) so it discovers all meaningful images on the active tab — `<img>` tags, CSS `background-image`, lazy-loaded images via MutationObserver, and srcset best-resolution selection — and surfaces them to the extension popup via message passing. No UI in this phase; Phase 3 renders the results.

Requirements in scope: EXTR-01, EXTR-02, EXTR-03, EXTR-04

</domain>

<decisions>
## Implementation Decisions

### Scan trigger
- Scan is initiated when Jennifer clicks a "Scan" button in the popup — not on popup open
- The popup sends a message to the content script to start the scan (e.g., `SCAN_PAGE`)
- The content script responds with the initial image list
- Auto-scanning on popup open is not used: it fires before the page is ready and runs even when Jennifer just opens the popup to check something

### Image filtering
- Skip images smaller than 100×100 pixels (width or height) — conservative threshold that filters tracker pixels, favicons, and spacers without dropping real photos
- Skip SVG files entirely — SVGs are almost always logos, icons, or UI elements, not photographs
- No other format filtering: WebP, PNG, JPEG, AVIF all pass through
- Note: UX-02 (v2 min-dimension preference, e.g. 200×200) is not implemented in Phase 2 — the 100×100 baseline is Phase 2's filter

### Blob URL handling
- Blob URLs (`blob:` scheme) are detected but excluded from results
- Log detected blob URLs to the console for DevTools audit (as flagged in STATE.md: "Blob URL frequency on Viator/GetYourGuide unknown")
- Phase 3 UI should surface a count of uncaptured blob images (e.g. "3 images not captured — blob URLs")
- Full blob URL capture (fetch interception) deferred to v2

### MutationObserver lifetime
- MutationObserver starts when Jennifer clicks Scan and runs until the popup closes
- New images discovered after the initial scan are added to the result set dynamically
- This handles lazy-loaded images naturally: scroll → images appear in DOM → observer picks them up → popup updates
- No fixed time window, no manual re-scan needed

### srcset resolution selection (EXTR-04)
- When a `srcset` attribute is present, parse all candidates and select the highest-resolution URL (largest `w` descriptor, or highest pixel density `x` descriptor)
- Fall back to `src` if srcset parsing fails or produces no valid candidates

### Claude's Discretion
- Exact message type names (e.g., `SCAN_PAGE`, `IMAGE_FOUND`) and payload shape
- Whether initial results are sent as one batch or streamed as images are found
- How dimensions are checked (natural dimensions from Image objects, or from the element's rendered size)
- Content script internal module structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements and state
- `.planning/REQUIREMENTS.md` — EXTR-01 through EXTR-04 (full requirement text)
- `.planning/ROADMAP.md` — Phase 2 success criteria (§ Phase 2: Image Extraction)
- `.planning/STATE.md` — Stack decision (WXT 0.20.x + React 18 + TypeScript + Tailwind CSS 3.x, Manifest V3), blob URL audit flag

### Phase 1 context (integration points)
- `.planning/phases/01-foundation/01-CONTEXT.md` — Message protocol pattern (DOWNLOAD_FILE), SW keepalive pattern, content script stub location

### Existing code (MUST READ before writing)
- `entrypoints/content.ts` — Stub to fill in; current structure and exports
- `entrypoints/background.ts` — Existing message listener; Phase 2 adds a new message type here
- `entrypoints/popup/App.tsx` — Current popup; Phase 3 replaces it but Phase 2 message protocol must be compatible

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/keepalive.ts` — SW keepalive utility; call before any async operation in the background worker
- `lib/download.ts` — Download pipeline; Phase 2 does not extend this, but Phase 3 will wire image URLs through it
- `entrypoints/background.ts` — Message listener already in place; Phase 2 adds a handler for the new SCAN_PAGE message type

### Established Patterns
- **Message protocol**: popup → `chrome.runtime.sendMessage` → background → `chrome.tabs.sendMessage` → content script (or direct popup→content if simpler for scan)
- **Background message listener**: `chrome.runtime.onMessage.addListener` with `return true` for async responses — Phase 2 follows the same pattern
- **WXT entry points**: content script registered via `defineContentScript`, matches `<all_urls>` — no wxt.config.ts changes needed

### Integration Points
- `entrypoints/content.ts` — Phase 2 replaces the stub body with image extraction logic
- `entrypoints/background.ts` — Add a `SCAN_PAGE` message handler that relays to the content script and returns results to popup
- `entrypoints/popup/App.tsx` — Phase 3 replaces this; Phase 2 only needs to define the message contract the popup will use

</code_context>

<specifics>
## Specific Ideas

- STATE.md flags blob URL frequency on Viator/GetYourGuide as unknown — Phase 2 should log blob URLs to console so a DevTools audit can quantify the problem before v2 decides whether to handle them
- The 100×100 pixel filter is intentionally conservative; if Jennifer finds real photos getting cut, the threshold is easy to lower in a future phase

</specifics>

<deferred>
## Deferred Ideas

- Blob URL capture via fetch/XHR interception — v2 after auditing how common they are
- UX-02 min-dimension filter (200×200) — v2, already in REQUIREMENTS.md
- `<picture>` element / `<video poster>` attribute extraction — not in scope for v1
- Auto-scan on popup open — rejected; Scan button is the right UX

</deferred>

---

*Phase: 02-image-extraction*
*Context gathered: 2026-03-19*
