---
phase: 5
slug: chrome-web-store-submission
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run -q` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run -q`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | Manifest icons | file-check | `ls public/icon-*.png \| wc -l` outputs 4 | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | Version bump | file-check | `node -p "require('./package.json').version"` outputs `1.0.0` | ✅ | ⬜ pending |
| 05-01-03 | 01 | 1 | Manifest description | file-check | `grep -c "structured names" .output/chrome-mv3/manifest.json` outputs 1 | ✅ build | ⬜ pending |
| 05-02-01 | 02 | 1 | Privacy policy file | file-check | `ls docs/privacy-policy.html` exits 0 | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | Store listing copy | file-check | `ls docs/store-listing.md` exits 0 | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 1 | Promotional tile | file-check | `ls docs/store-assets/promo-tile-440x280.png` exits 0 | ❌ W0 | ⬜ pending |
| 05-02-04 | 02 | 1 | ZIP package | file-check | `ls .output/*.zip` exits 0 | ✅ build | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `public/` directory exists (WXT copies to build output) — already exists
- [ ] `docs/` directory created for GitHub Pages assets

*Existing test infrastructure (vitest + 143 tests) covers all existing code. Phase 5 adds no new TypeScript — all verification is file-check based.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Icon appears in Chrome toolbar | CWS icon requirement | Requires Chrome browser | Load unpacked from `.output/chrome-mv3/`, verify icon visible in toolbar |
| Screenshot looks correct | CWS screenshot requirement | Visual check | Open screenshot file, confirm popup visible on travel site background |
| Privacy policy URL resolves | GitHub Pages deployment | Requires live GitHub Pages | Visit `https://{username}.github.io/photo-extractor/privacy-policy.html` |
| Promotional tile displays | CWS store listing | Requires CWS dashboard | Upload ZIP, preview listing in CWS developer console |

---

## Validation Sign-Off

- [ ] All tasks have file-check verify or manual verification documented
- [ ] Sampling continuity: full test suite still passes after each wave
- [ ] Wave 0 covers all MISSING file references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
