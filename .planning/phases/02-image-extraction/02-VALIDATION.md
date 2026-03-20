---
phase: 2
slug: image-extraction
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | EXTR-01 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | EXTR-02 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | EXTR-03 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | EXTR-04 | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/content-script.test.ts` — stubs for EXTR-01 through EXTR-04
- [ ] `tests/setup.ts` — extend existing chrome mock with port/message stubs

*Existing vitest infrastructure covers framework setup — only test file stubs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lazy-loaded images captured on real Viator page | EXTR-02 | Requires live browser with real scroll events | Load a Viator activity page, click Scan, scroll down, confirm new images appear in popup |
| CSS background images on real hotel site | EXTR-03 | Requires real site with CSS background photos | Load a hotel booking page, click Scan, verify background images appear in results |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
