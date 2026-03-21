---
phase: 4
slug: cdn-url-upscaling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 4 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (or package.json scripts) |
| **Quick run command** | `npx vitest run tests/unit/cdnRewrite.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/cdnRewrite.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 0 | CDN-01 | unit stub | `npx vitest run tests/unit/cdnRewrite.test.ts` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | CDN-01 | unit | `npx vitest run tests/unit/cdnRewrite.test.ts` | ✅ W0 | ⬜ pending |
| 4-01-03 | 01 | 1 | CDN-02 | unit | `npx vitest run tests/unit/cdnRewrite.test.ts` | ✅ W0 | ⬜ pending |
| 4-01-04 | 01 | 1 | CDN-03 | unit | `npx vitest run tests/unit/cdnRewrite.test.ts` | ✅ W0 | ⬜ pending |
| 4-01-05 | 01 | 1 | CDN-04 | unit | `npx vitest run tests/unit/cdnRewrite.test.ts` | ✅ W0 | ⬜ pending |
| 4-02-01 | 02 | 2 | CDN-08 | unit | `npx vitest run tests/unit/cdnRewrite.test.ts` | ✅ W0 | ⬜ pending |
| 4-02-02 | 02 | 2 | CDN-09 | integration | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/cdnRewrite.test.ts` -- test stubs for all CDN rewriter functions (Booking.com, Airbnb, Cloudinary, Imgix, Viator, GetYourGuide)
- [ ] `lib/cdnRewrite.ts` -- module file (can be empty/stub) so imports don't break
- [ ] vitest installed -- check package.json; install if missing (`npm install -D vitest`)

*Wave 0 creates the test file with failing stubs before any CDN logic is written.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GetYourGuide URL upscaling | CDN-06 | CDN resize params unknown -- stub only in v1 | Open DevTools on getyourguide.com, inspect image URLs, confirm `cdn.getyourguide.com` domain, document resize params |
| Fallback to original URL on 404 | CDN-08 | Requires live network or mock server | Manually test with a corrupted/nonexistent rewritten URL; confirm original URL downloads instead |
| Airbnb aki_policy top tier | CDN-02 | Policy names undocumented officially | Browse Airbnb listing, inspect image URLs, confirm `xx_large` is the largest policy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
