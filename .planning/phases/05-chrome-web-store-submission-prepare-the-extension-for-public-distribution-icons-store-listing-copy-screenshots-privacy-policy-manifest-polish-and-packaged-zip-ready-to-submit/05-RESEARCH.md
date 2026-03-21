# Phase 5: Chrome Web Store Submission - Research

**Researched:** 2026-03-20
**Domain:** Chrome extension distribution, WXT packaging, GitHub Pages
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Icon: camera/photo symbol, blue (#2563EB), white foreground, sizes 16/32/48/128px PNG
- Store name: "Photo Extractor"
- Short description (132 chars max): "Save travel site photos with structured filenames. Extracts images that block right-click saving. For travel advisors and researchers."
- Long description: core workflow, mention Booking.com / Airbnb / Viator / GetYourGuide support
- Category: Productivity, Language: English (US)
- Privacy policy: hosted on GitHub Pages at /docs/privacy-policy.html in the repo
- Privacy policy URL format: `https://{github-username}.github.io/photo-extractor/privacy-policy.html`
- Privacy policy content: disclose tabs, downloads, storage permissions; no data leaves device
- GitHub Pages enabled: Settings > Pages > source: main branch /docs folder
- Version bump: 1.0.0 in package.json (WXT reads it from there)
- Description in manifest: same 132-char string as store listing
- Distribution: public listing (not unlisted)
- Screenshots: at least 1 at 1280x800, show popup on real travel site with images scanned and form filled

### Claude's Discretion
- Exact icon SVG/canvas implementation approach
- Screenshot tooling (can use Chrome DevTools device emulation at 1280x800)
- Exact wording of the long store description beyond the key points
- ZIP packaging command

### Deferred Ideas (OUT OF SCOPE)
- Promotional tile (440x280 store graphic) — FLAGGED: see Open Questions below
- Localization of store listing into other languages
- Post-submission version update workflow
</user_constraints>

---

## Summary

Phase 5 packages a finished, tested WXT extension for public distribution on the Chrome Web Store. The work divides into five independent tracks: icon creation, manifest polish, privacy policy hosting, store listing copy, and ZIP packaging. None of these tracks depend on each other, so they can be done in parallel or in any order.

WXT 0.20.x makes packaging easy. A single `wxt zip` command builds the extension and outputs a ready-to-submit ZIP to `.output/photo-extractor-1.0.0-chrome.zip`. No manual ZIP creation or folder manipulation needed.

The one important finding that contradicts CONTEXT.md: Google's official docs state the 440x280 promotional tile is **required**, not optional. It is listed alongside the extension icon and screenshot as the three mandatory assets. This needs a decision before submission.

**Primary recommendation:** Work the five tracks in this order — (1) bump version + manifest, (2) generate icons, (3) privacy policy on GitHub Pages, (4) write store listing copy and promotional tile, (5) screenshots, (6) zip and submit.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wxt | 0.20.20 (installed) | Build + zip packaging | Already in project; `wxt zip` produces store-ready ZIP |
| @wxt-dev/auto-icons | latest | Generate all 4 icon sizes from one source image | Eliminates manual resizing; integrates with WXT build |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sharp | auto-installed by auto-icons | PNG resizing backend | Installed as dependency of auto-icons, not directly used |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @wxt-dev/auto-icons | Manual PNG files in public/ | Manual approach requires separate resize step (online tool or canvas script). Auto-icons is cleaner if you have an SVG or master PNG. Either works — see Architecture Patterns for both paths. |
| `wxt zip` | Manually ZIP `.output/chrome-mv3/` | Manual ZIP works but `wxt zip` is the official method and names the file consistently |

**Installation (auto-icons path only):**
```bash
npm install --save-dev @wxt-dev/auto-icons
```

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
photo-extractor/
├── assets/
│   └── icon.png          # 512x512 master icon (if using auto-icons)
├── public/
│   └── icon-16.png       # 16px PNG  (if doing manual icons)
│   └── icon-32.png       # 32px PNG
│   └── icon-48.png       # 48px PNG
│   └── icon-128.png      # 128px PNG
├── docs/
│   └── privacy-policy.html   # Served via GitHub Pages
├── package.json          # version bumped to 1.0.0
└── wxt.config.ts         # icons + description added to manifest block
```

### Pattern 1: Icon Auto-Generation via @wxt-dev/auto-icons

**What:** Provide one master PNG (512x512 recommended), let WXT generate all four sizes at build time.
**When to use:** If creating the master icon as a PNG or SVG. Simplest path.

```typescript
// wxt.config.ts — Source: https://wxt.dev/auto-icons
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  autoIcons: {
    sizes: [128, 48, 32, 16],
    // developmentIndicator: 'grayscale' is the default — shows grey icon in dev mode
  },
  manifest: {
    name: 'Photo Extractor',
    description: 'Save travel site photos with structured filenames. Extracts images that block right-click saving. For travel advisors and researchers.',
    permissions: ['downloads', 'storage'],
  },
});
```

Source file goes at: `<srcDir>/assets/icon.png` (i.e., `./assets/icon.png` at project root).

### Pattern 2: Manual PNG Icons in public/

**What:** Place four pre-sized PNGs in `public/`, declare in manifest, skip auto-icons module.
**When to use:** If generating icons with an external tool or canvas script and don't want the extra dependency.

WXT auto-discovers icons that match naming conventions including `icon-16.png`, `icons/16.png`, `icon-16x16.png` etc. in the `public/` directory. Or declare explicitly:

```typescript
// wxt.config.ts — Source: WXT docs / manifest config
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Photo Extractor',
    description: 'Save travel site photos with structured filenames. Extracts images that block right-click saving. For travel advisors and researchers.',
    permissions: ['downloads', 'storage'],
    icons: {
      16: '/icon-16.png',
      32: '/icon-32.png',
      48: '/icon-48.png',
      128: '/icon-128.png',
    },
  },
});
```

Files live in `public/` and are copied to `.output/chrome-mv3/` by WXT unchanged.

### Pattern 3: Icon Creation via Node Canvas Script

**What:** Write a small Node.js script that draws the icon with the Canvas API and saves PNGs at all four sizes. No extra npm packages if using the `canvas` package, or pure browser-based if drawn in a standalone HTML file opened in Chrome.

**Simplest approach — standalone HTML file:**
Create `scripts/generate-icons.html`, open in Chrome, click button to download PNGs:

```html
<!-- scripts/generate-icons.html -->
<script>
const sizes = [16, 32, 48, 128];
sizes.forEach(size => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  // Blue fill
  ctx.fillStyle = '#2563EB';
  ctx.fillRect(0, 0, size, size);
  // White camera icon scaled to size
  // ... drawing code ...
  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `icon-${size}.png`;
    a.click();
  });
});
</script>
```

**When to use:** When you want full control over the icon design without installing auto-icons. Good for the camera symbol design.

### Pattern 4: Version Bump

Version lives in `package.json`. WXT reads it automatically.

```json
// package.json
{
  "version": "1.0.0"
}
```

Do NOT edit version in `wxt.config.ts`. The manifest `version` field is injected from `package.json`.

### Pattern 5: ZIP Packaging

```bash
# Add to package.json scripts
"zip": "wxt zip"

# Run
npm run zip
```

Output: `.output/photo-extractor-1.0.0-chrome.zip`

This ZIP is what you upload to the Chrome Web Store developer dashboard. It contains the full contents of `.output/chrome-mv3/`.

### Pattern 6: GitHub Pages for Privacy Policy

```
repo/docs/privacy-policy.html
```

Enable in GitHub repo: Settings > Pages > Build and deployment > Source: Deploy from a branch > Branch: main > Folder: /docs > Save.

Published URL: `https://{github-username}.github.io/photo-extractor/privacy-policy.html`

**Note:** GitHub Pages can take 1-10 minutes to publish after enabling. Test the URL before submitting to the store.

### Anti-Patterns to Avoid

- **Editing manifest.json directly:** WXT regenerates it on every build. Changes are lost. Always use `wxt.config.ts`.
- **Zipping `.output/chrome-mv3/` manually:** Works but produces non-standard filename. Use `wxt zip` instead.
- **Adding `tabs` permission to manifest:** Photo Extractor does NOT currently request the `tabs` permission. The content script uses `chrome.tabs.connect()` (established in Phase 03), but the `tabs` permission itself is NOT declared and is NOT needed for that API. Do not add it to avoid unnecessary permission prompts and CWS scrutiny.
- **Version in wxt.config.ts:** Don't set `manifest.version` in the config — WXT takes it from `package.json`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icon resizing to 4 sizes | Custom resize loop | @wxt-dev/auto-icons OR online tool | Edge cases: padding, alpha channel, color profiles |
| ZIP packaging | `zip -r` shell command | `wxt zip` | WXT zip excludes source maps and dev artifacts correctly |
| Privacy policy text | Write from scratch | Template from research section below | CWS requires specific disclosures — template ensures compliance |

---

## Common Pitfalls

### Pitfall 1: Missing 440x280 Promotional Tile

**What goes wrong:** Extension gets blocked at submission — dashboard won't let you publish without the small promo image.
**Why it happens:** CONTEXT.md notes it as optional, but Google's official docs list it as one of three mandatory assets alongside the icon and screenshot.
**How to avoid:** Create the 440x280 tile before attempting submission. Can be a simple branded image (extension icon + name on colored background). Tools: Canva, Figma, or a canvas script.
**Warning signs:** Dashboard shows a validation error or the Publish button stays disabled.

### Pitfall 2: Privacy Policy URL Not Live Before Submission

**What goes wrong:** You submit with a privacy policy URL, but GitHub Pages hasn't published yet (or the URL returns 404). CWS reviewer hits a dead link and rejects.
**Why it happens:** GitHub Pages takes minutes to publish after you enable it. First publish can take up to 10 minutes.
**How to avoid:** Enable GitHub Pages and verify the URL returns the page BEFORE submitting the extension.

### Pitfall 3: Wrong Permissions in Privacy Policy

**What goes wrong:** Policy is rejected because it doesn't match the permissions declared in the manifest.
**Why it happens:** This extension requests `downloads` and `storage`. The tabs permission is NOT in the manifest. Privacy policy must match what's actually declared.
**How to avoid:** Cross-check the policy disclosure list against the manifest `permissions` array before submitting.

### Pitfall 4: Icon Not Declared / Not Found by WXT

**What goes wrong:** Build succeeds but extension shows a default puzzle-piece icon in Chrome toolbar.
**Why it happens:** Icons were placed in the wrong directory or named wrong.
**How to avoid:** If using manual icons, either use WXT's auto-discovery naming (`icon-16.png`, `icon-32.png`, etc.) in `public/`, OR declare them explicitly in `manifest.icons` in `wxt.config.ts`. Verify after build that `.output/chrome-mv3/` contains the PNG files.

### Pitfall 5: Description Over 132 Characters

**What goes wrong:** CWS dashboard rejects the short description.
**Why it happens:** Easy to go slightly over when editing.
**How to avoid:** Count characters before finalizing. The approved short description is 134 chars — it needs 2 chars trimmed before submission (see Open Questions).

### Pitfall 6: `tabs` Permission Added by Mistake

**What goes wrong:** Chrome prompts users with "Read your browsing history" permission warning, which is alarming for a photo tool and may cause rejection.
**Why it happens:** Content script uses `chrome.tabs.connect()`, which can lead developers to assume `tabs` permission is needed. It isn't.
**How to avoid:** Leave `tabs` out of `permissions` in `wxt.config.ts`. Content script messaging works without it.

---

## Code Examples

### Complete wxt.config.ts (manual icons path)
```typescript
// Source: WXT docs + project conventions
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Photo Extractor',
    description: 'Save travel site photos with structured filenames. Extracts images that block right-click saving. For travel advisors and researchers.',
    permissions: ['downloads', 'storage'],
    icons: {
      16: '/icon-16.png',
      32: '/icon-32.png',
      48: '/icon-48.png',
      128: '/icon-128.png',
    },
  },
});
```

### package.json version bump
```json
{
  "name": "photo-extractor",
  "version": "1.0.0"
}
```

### Privacy policy minimum required content

The policy must disclose: what data is accessed, how it is used, and confirm no data is shared externally. For this extension:

```
Permissions used:
- downloads: to save selected images to your Downloads folder
- storage: to remember your last-used destination, vendor, and category fields between sessions

No data is transmitted off your device. No personal information is collected or stored outside your local browser.
```

### Privacy policy HTML structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Privacy Policy — Photo Extractor</title>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p>Last updated: [date]</p>

  <h2>What this extension does</h2>
  <p>Photo Extractor extracts images from web pages you visit and saves selected images
  to your Downloads folder with structured filenames.</p>

  <h2>Permissions and data use</h2>
  <ul>
    <li><strong>downloads</strong> — used to save selected images to your local Downloads folder.</li>
    <li><strong>storage</strong> — used to remember your last-used destination, vendor, and category
    fields so you don't have to retype them each session.</li>
  </ul>

  <h2>Data collection</h2>
  <p>No data is collected, transmitted, or shared. All processing happens locally in your browser.
  No analytics, no tracking, no third-party services.</p>

  <h2>Contact</h2>
  <p>Questions: [your email or GitHub Issues URL]</p>
</body>
</html>
```

### ZIP and verify
```bash
# Bump version first
# Edit package.json: "version": "1.0.0"

# Build and zip
npm run zip
# Output: .output/photo-extractor-1.0.0-chrome.zip

# Verify contents
unzip -l .output/photo-extractor-1.0.0-chrome.zip
# Should show: manifest.json, popup HTML/JS/CSS, background SW, content script, icon PNGs
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manifest V2 background pages | MV3 service workers | 2023 (Chrome 112+) | Already done — project uses MV3 |
| Manual ZIP of build output | `wxt zip` command | WXT 0.16+ | One command, correct output format |
| Separate icon resize tooling | @wxt-dev/auto-icons module | WXT 0.18+ | Optional but cleaner |

---

## Open Questions

1. **440x280 Promotional Tile — is it actually required?**
   - What we know: Google's official image requirements page ([developer.chrome.com/docs/webstore/images](https://developer.chrome.com/docs/webstore/images)) explicitly states "Only the extension icon, a small promotional image, and a screenshot are mandatory." The 440x280 tile IS listed as one of the three required assets.
   - What's unclear: CONTEXT.md marked it as optional/deferred. This contradicts the official docs.
   - Recommendation: Include the 440x280 tile in Phase 5 scope. It's simple to create (icon + name on a blue background). The risk of omitting it is a blocked submission.

2. **Short description character count**
   - What we know: The approved short description in CONTEXT.md is: "Save travel site photos with structured filenames. Extracts images that block right-click saving. For travel advisors and researchers." This is 134 characters. CWS limit is 132.
   - What's unclear: Which 2 characters to trim.
   - Recommendation: Planner should include a task to count and trim. Options: "For travel advisors and researchers" → "For travel advisors" (saves 15), or "structured filenames" → "structured names" (saves 4, gets to 130).

3. **GitHub username for privacy policy URL**
   - What we know: URL format will be `https://{github-username}.github.io/photo-extractor/privacy-policy.html`
   - What's unclear: The actual GitHub username has not been confirmed in context.
   - Recommendation: Planner should leave a placeholder `[GITHUB_USERNAME]` and note it must be filled in before submitting.

4. **Icon creation approach**
   - What we know: Two valid paths — @wxt-dev/auto-icons (needs master PNG/SVG + adds npm dependency) or manual PNGs in `public/` (more explicit, no extra dependency).
   - Recommendation: Use manual PNGs via a canvas script (no extra npm install, simpler for understanding). Create `scripts/generate-icons.html` that draws the camera icon and exports all 4 sizes. This keeps the approach transparent and dependency-free.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x |
| Config file | vitest.config.ts |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements — Test Map

Phase 5 is a distribution/packaging phase. There are no functional requirements with automated test coverage. The deliverables are files and store submissions, validated by inspection.

| Deliverable | Validation Method | Automated? |
|-------------|------------------|------------|
| Icon PNGs at correct sizes | `file icon-16.png` → confirm 16x16 PNG | Manual inspection |
| manifest.json has icons declared | `unzip -p .output/*.zip manifest.json \| jq .icons` | Manual after zip |
| manifest.json version is 1.0.0 | `unzip -p .output/*.zip manifest.json \| jq .version` | Manual after zip |
| Privacy policy URL resolves | `curl -I https://[...].github.io/photo-extractor/privacy-policy.html` | Manual |
| ZIP file under 2GB | `ls -lh .output/*.zip` | Manual |
| Short description under 132 chars | Character count in text editor | Manual |

### Wave 0 Gaps

None — no new test files needed for this phase. Existing test suite should pass before packaging.

- **Pre-packaging gate:** `npm test` must pass green before running `npm run zip`

---

## Sources

### Primary (HIGH confidence)
- [https://developer.chrome.com/docs/webstore/images](https://developer.chrome.com/docs/webstore/images) — Required image assets including 440x280 tile
- [https://developer.chrome.com/docs/webstore/publish](https://developer.chrome.com/docs/webstore/publish) — Upload requirements, ZIP format, dashboard sections
- [https://developer.chrome.com/docs/webstore/program-policies/privacy](https://developer.chrome.com/docs/webstore/program-policies/privacy) — Privacy policy requirements
- [https://wxt.dev/api/cli/wxt-zip.html](https://wxt.dev/api/cli/wxt-zip.html) — `wxt zip` command flags and output
- [https://wxt.dev/guide/essentials/publishing](https://wxt.dev/guide/essentials/publishing) — Full WXT publishing workflow
- [https://wxt.dev/guide/essentials/config/manifest](https://wxt.dev/guide/essentials/config/manifest) — WXT icon declaration syntax
- [https://wxt.dev/auto-icons](https://wxt.dev/auto-icons) — @wxt-dev/auto-icons configuration
- [https://github.com/wxt-dev/wxt/blob/main/packages/auto-icons/src/index.ts](https://github.com/wxt-dev/wxt/blob/main/packages/auto-icons/src/index.ts) — auto-icons source: sizes [128, 48, 32, 16], uses sharp internally
- [https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) — GitHub Pages /docs folder setup

### Secondary (MEDIUM confidence)
- [https://developer.chrome.com/docs/webstore/register](https://developer.chrome.com/docs/webstore/register) — $5 one-time developer registration fee confirmed
- [https://developer.chrome.com/docs/webstore/review-process](https://developer.chrome.com/docs/webstore/review-process) — Review time: typically 1-7 business days
- [https://www.npmjs.com/package/@wxt-dev/auto-icons](https://www.npmjs.com/package/@wxt-dev/auto-icons) — Package documentation

---

## Metadata

**Confidence breakdown:**
- WXT zip packaging: HIGH — verified against official WXT docs and CLI reference
- Icon declaration in wxt.config.ts: HIGH — verified against WXT manifest config docs
- CWS image requirements (including 440x280 required): HIGH — verified against developer.chrome.com/docs/webstore/images
- Privacy policy requirements: HIGH — verified against CWS program policies
- GitHub Pages /docs folder setup: HIGH — verified against GitHub Docs
- auto-icons sharp dependency: HIGH — verified against source code

**Research date:** 2026-03-20
**Valid until:** 2026-09-20 (stable domain — CWS policies change rarely)
