# Phase 3: Popup and Naming - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the Phase 1 stub `App.tsx` with a complete popup UI: thumbnail grid showing all images extracted by Phase 2, selection controls, a naming form (destination / vendor / category / notes), and a Download button that saves only selected images with correctly formatted filenames. Wire the Phase 2 scan port protocol to the visual interface and the Phase 1 download pipeline to the naming form.

Requirements in scope: UI-01, UI-02, UI-03, UI-04, NAME-01, NAME-02, NAME-03, NAME-04, NAME-05

</domain>

<decisions>
## Implementation Decisions

### Scan trigger
- Scanning is initiated manually via a "Scan Page" button in the popup header
- Popup opens to an idle state (no skeleton, no scan) until Jennifer clicks Scan
- After clicking Scan: show the loading skeleton grid ("Scanning page..." header) while waiting for SCAN_RESULT from the content script
- This is consistent with Phase 2's explicit decision: scan is user-initiated, not automatic
- Note: UI-SPEC currently describes an auto-scan-on-open loading state — executor must reconcile this with the manual scan button. The Scan button is the authoritative decision.

### Category presets (NAME-03)
- Category field is a plain `<input type="text">` with an HTML `<datalist>` providing suggestions
- Preset suggestions: room, pool, lobby, exterior, food, excursion, beach, spa, activities
- Jennifer can type any value — the datalist is non-binding
- No dropdown locking — free text is always accepted

### Batch download mechanics
- Claude's discretion on parallel vs. sequential — rationale: prefer parallel (faster, Chrome handles concurrency natively via chrome.downloads, and each download is independent)
- Visual feedback is required during the download operation:
  - Button shows "Downloading..." during operation
  - A progress indicator must show how many have completed out of total (e.g. "Saving 3 of 12...")
  - On completion: "Saved N photos to Downloads/travel-photos/"
  - On partial failure: "Saved X of N — Y failed to download." with individual error context if available
  - On full failure: "Download failed. Check your internet connection and try again."
- StatusMessage component (from UI-SPEC) handles post-download feedback

### Notes field and filename format (NAME-04, NAME-05)
- Notes field is optional — shown below the three required fields, labeled "Notes (optional)"
- Filename format: `destination_vendor_category_index.ext` (notes omitted when empty)
- When notes is filled: `destination_vendor_category_notes_index.ext`
- Character normalization for all fields: lowercase, spaces → hyphens, strip any character that is not alphanumeric or hyphen (conservative, for Tern Travel compatibility — exact limitations unknown)
- Index: handled by `buildSafeFilename` in `lib/download.ts` — uses Chrome's download history to find the next available `_01`, `_02` slot

### Last-used field pre-fill (UX-01 / Phase 3 success criterion 5)
- Reopening the popup pre-fills the last-used destination, vendor, and category values
- Implementation: `chrome.storage.local` — persist field values on each download, restore on popup mount
- This is confirmed in-scope for Phase 3 (ROADMAP.md success criterion 5), even though REQUIREMENTS.md lists UX-01 under v2. ROADMAP wins.
- Notes field is NOT persisted — it's intentionally ephemeral

### Claude's Discretion
- Parallel vs. sequential download order (parallel preferred per above)
- Exact character normalization regex (strip non-alphanumeric/hyphen/underscore)
- Whether to show a per-image progress indicator or only the overall count (overall count is the minimum; per-image is nice-to-have)
- Blob count display location within the UI (per UI-SPEC: shown in header or as helper text)
- Internal React state management approach (useState/useReducer — no external state library needed)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Visual and interaction contract
- `.planning/phases/03-popup-and-naming/03-UI-SPEC.md` — Full UI design contract: layout, components, colors, typography, spacing, interaction contract, copywriting, states. Read this before writing any UI code.

### Project requirements
- `.planning/REQUIREMENTS.md` — UI-01 through UI-04 (selection UI), NAME-01 through NAME-05 (naming), STOR-01/STOR-02 (download path)
- `.planning/ROADMAP.md` — Phase 3 goal and success criteria (§ Phase 3: Popup and Naming)

### Existing implementation (MUST READ before modifying)
- `entrypoints/popup/App.tsx` — Current stub being replaced; read current structure
- `entrypoints/content.ts` — Scan port protocol: `chrome.runtime.connect()` → port named 'scan-session' → `SCAN_PAGE` → `SCAN_RESULT` / `IMAGE_FOUND`
- `entrypoints/background.ts` — DOWNLOAD_FILE message handler; still used for downloads
- `lib/download.ts` — `triggerDownload(url, basename, ext)` and `buildSafeFilename` — Phase 3 calls these directly
- `lib/keepalive.ts` — SW keepalive utility; called by triggerDownload automatically

### Prior phase context
- `.planning/phases/01-foundation/01-CONTEXT.md` — Collision counter format (`_01/_02`), service worker keepalive pattern
- `.planning/phases/02-image-extraction/02-CONTEXT.md` — Scan protocol decisions, ImageResult type shape, blob URL handling

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/download.ts` — `triggerDownload(url, basename, ext): Promise<number>` handles the full download pipeline including keepalive and collision-safe naming. Phase 3 calls this for each selected image.
- `lib/download.ts` — `buildSafeFilename(basename, ext, subfolder)` if lower-level control is needed
- `lib/keepalive.ts` — SW keepalive; called automatically by triggerDownload, no manual call needed

### Established Patterns
- **Download message**: popup calls `triggerDownload` (or via background DOWNLOAD_FILE message) — both paths work; direct call from background is more reliable
- **Scan protocol**: `chrome.runtime.connect({ name: 'scan-session' })` → send `{ type: 'SCAN_PAGE' }` → receive `{ type: 'SCAN_RESULT', payload: { images: ImageResult[], blobCount: number } }` → stream `{ type: 'IMAGE_FOUND', payload: ImageResult }` for lazy-loaded images
- **ImageResult type**: `{ url: string, sourceType: 'img' | 'css', naturalWidth: number, naturalHeight: number }`
- **Tailwind only**: no component library — hand-rolled Tailwind components per UI-SPEC
- **Popup width**: expanding from Phase 1's `w-72` (288px) to `w-[360px]` per UI-SPEC for 3-column grid

### Integration Points
- `entrypoints/popup/App.tsx` — Phase 3 replaces this file entirely; all existing code can be discarded
- `entrypoints/background.ts` — DOWNLOAD_FILE handler stays; Phase 3 calls it for batch downloads
- `chrome.storage.local` — new usage in Phase 3 for persisting last-used form field values

</code_context>

<specifics>
## Specific Ideas

- STATE.md note: "Jennifer's category list and naming convention not yet validated with her — review before Phase 3 hardcodes them" — addressed by using a datalist (non-binding suggestions) rather than a locked dropdown
- Blob count from SCAN_RESULT should be surfaced in the UI per Phase 2 CONTEXT decision ("Phase 3 UI should surface a count of uncaptured blob images")
- Filename normalization should be conservative (strip specials, spaces to hyphens) because Tern Travel character limitations are unknown

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-popup-and-naming*
*Context gathered: 2026-03-20*
