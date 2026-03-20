# Phase 1: Foundation - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a loadable Chrome MV3 extension with correct architecture, a working download pipeline (Chrome Downloads API → Downloads/travel-photos/), and collision-safe file naming. No real UI beyond what's needed to verify the pipeline works. Every subsequent phase builds on this scaffold.

Requirements in scope: STOR-01, STOR-02

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
User deferred all implementation decisions to Claude. Decisions captured here for downstream agents:

- **Popup scaffold**: Wire up the full React popup shell in Phase 1 (WXT entry point, React 18 render, Tailwind CSS configured) — even if the popup only shows a "Test Download" button. This means Phase 3 adds components to an existing shell rather than scaffolding from scratch.

- **Collision counter format**: Use a custom counter with zero-padded two-digit suffix (`_01`, `_02`, ...) rather than Chrome's native `conflictAction: 'uniquify'` (which produces `photo (1).jpg`). The custom format matches the NAME-05 naming pattern that Phase 3 will use end-to-end. Counter increments by checking existing files via chrome.downloads history or retrying on conflict.

- **Service worker state scope**: Phase 1 only needs a wakeup mechanism — read/write a small key to chrome.storage.session on each action so the service worker doesn't go dormant mid-operation. No download queue needed yet; that becomes relevant in Phase 3 when batches exist.

- **Content script stub**: Phase 1 scaffolds an empty content script entry point (registered in the manifest, WXT entry file created, no logic yet) so Phase 2 has a clean slot to fill in without touching the manifest.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements are fully captured in decisions above and in:
- `.planning/REQUIREMENTS.md` — STOR-01, STOR-02 requirements
- `.planning/ROADMAP.md` — Phase 1 success criteria (§ Phase 1: Foundation)
- `.planning/STATE.md` — Stack decision: WXT 0.20.x + React 18 + TypeScript + Tailwind CSS 3.x on Manifest V3

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — fresh project, no existing code.

### Established Patterns
- None yet — Phase 1 establishes the patterns that Phases 2 and 3 follow.

### Integration Points
- Chrome Downloads API — the single output path for all file saves
- chrome.storage.session — service worker wakeup persistence
- WXT manifest config — where content script and popup entry points are registered

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-19*
