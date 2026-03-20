---
phase: 3
slug: popup-and-naming
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Wave 0 Strategy

Plans 01 and 02 use `tdd="true"` tasks that write tests before implementation (RED phase first). This self-satisfies Wave 0 requirements — test stubs are created as part of each TDD task, not as a separate pre-step. No standalone Wave 0 plan is needed.

- Plan 01, Task 1: Creates `tests/unit/naming.test.ts` (RED phase writes tests first for normalizeField, buildBasename, deriveExt)
- Plan 02, Task 1: Creates `tests/unit/popup-reducer.test.ts` (RED phase writes reducer tests first)
- Plan 01, Task 2: Updates `tests/setup.ts` with chrome.storage.local mock (infrastructure for Plan 02 tests)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | NAME-01, NAME-02 | unit (TDD) | `npm test -- naming` | tests/unit/naming.test.ts (TDD-created) | ⬜ pending |
| 3-01-02 | 01 | 1 | NAME-03, NAME-04, NAME-05 | unit (TDD) | `npm test -- naming` | tests/unit/naming.test.ts (TDD-created) | ⬜ pending |
| 3-02-01 | 02 | 2 | UI-01, UI-02, UI-03, UI-04, NAME-01..05 | unit (TDD) | `npm test` | tests/unit/popup-reducer.test.ts (TDD-created) | ⬜ pending |
| 3-03-01 | 03 | 3 | UI-01..04, NAME-01..05 | build | `npm run build && npm test` | N/A (build check) | ⬜ pending |
| 3-03-02 | 03 | 3 | UI-01..04, NAME-01..05 | manual | `npm run build` | N/A (human verify) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Popup opens within seconds on real travel site | UI-01 | Requires real browser + live page | Load extension, navigate to booking.com/airbnb, click toolbar icon, verify grid appears |
| Downloaded files land in OS Downloads folder | NAME-03 | `chrome.downloads` API requires real browser | Click Download in popup, verify files appear in ~/Downloads with correct names |
| Pre-fill persists across browser restart | NAME-05 | `chrome.storage.local` persistence needs real browser | Fill form, close/reopen browser, verify fields are pre-filled |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or TDD self-satisfaction
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 self-satisfied by TDD tasks (tests written before implementation)
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
