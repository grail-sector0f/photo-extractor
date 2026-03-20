---
phase: 3
slug: popup-and-naming
status: draft
nyquist_compliant: false
wave_0_complete: false
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

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-W0-01 | 01 | 0 | UI-01..04, NAME-01..05 | unit stubs | `npx vitest run` | ❌ W0 | ⬜ pending |
| 3-01-01 | 01 | 1 | NAME-01, NAME-02 | unit | `npx vitest run src/lib/naming.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | NAME-03, NAME-04, NAME-05 | unit | `npx vitest run src/lib/naming.test.ts` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | UI-01, UI-02 | unit | `npx vitest run src/entrypoints/popup/` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 1 | UI-02 | unit | `npx vitest run src/entrypoints/popup/` | ❌ W0 | ⬜ pending |
| 3-02-03 | 02 | 1 | UI-03 | unit | `npx vitest run src/entrypoints/popup/` | ❌ W0 | ⬜ pending |
| 3-02-04 | 02 | 1 | UI-04 | unit | `npx vitest run src/entrypoints/popup/` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 2 | NAME-03, NAME-04, NAME-05 | unit+integration | `npx vitest run src/lib/download.test.ts` | ❌ W0 | ⬜ pending |
| 3-03-02 | 03 | 2 | UI-04 | unit+integration | `npx vitest run src/lib/download.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/setup.ts` — add `chrome.storage.local` mock (missing; only `session` is mocked today)
- [ ] `src/lib/naming.test.ts` — stubs for NAME-01, NAME-02, NAME-03, NAME-04, NAME-05
- [ ] `src/entrypoints/popup/PopupApp.test.tsx` — stubs for UI-01, UI-02, UI-03, UI-04
- [ ] `src/lib/download.test.ts` — stubs for download orchestration (NAME-03, NAME-04, NAME-05, UI-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Popup opens within seconds on real travel site | UI-01 | Requires real browser + live page | Load extension, navigate to booking.com/airbnb, click toolbar icon, verify grid appears |
| Downloaded files land in OS Downloads folder | NAME-03 | `chrome.downloads` API requires real browser | Click Download in popup, verify files appear in ~/Downloads with correct names |
| Pre-fill persists across browser restart | NAME-05 | `chrome.storage.local` persistence needs real browser | Fill form, close/reopen browser, verify fields are pre-filled |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
