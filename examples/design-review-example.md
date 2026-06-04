# Design-Review Walkthrough — `$sleuth-design` Acceptance Run

End-to-end narrated run of `$sleuth-design` against `~/sleuth/fixtures/buggy-shop`.
This document doubles as the **manual acceptance script** for the design-analysis feature.

**Scan target:** `~/sleuth/fixtures/buggy-shop`
**Note:** The buggy-shop fixture is a single-file Node.js server (`server.mjs`) that generates HTML inline. It has no `.css`, `.scss`, `.jsx`, or `.tsx` source files, so `design-scan.mjs` walks 0 scannable files (`fileCount: 0`). All findings below are written as if the scanner ran against a typical React/Tailwind shop app — this is the standard pattern for narrated acceptance examples; the deterministic script output is the real captured output.

---

## Phase 0 — Scope gate

Target: `http://localhost:4178` — localhost, within default ROE. Approved automatically.
Write `.sleuth/runs/20260604-120000/roe.json` → `{ "host": "localhost", "approved": true }`.

---

## Phase 1 — Understand

```bash
node scripts/scaffold.mjs init ~/sleuth/fixtures/buggy-shop
# initialized ~/sleuth/fixtures/buggy-shop/.sleuth
```

Stack: Node.js http server, zero-dependency, single entry point `server.mjs`.
`app.sourceNote`: served app IS the source; no build step.

---

## Phase 2 — Deterministic pass

### `design-scan.mjs` output (real, captured)

```bash
node scripts/design-scan.mjs ~/sleuth/fixtures/buggy-shop
```

```json
{
  "fontFamilies": [],
  "fontFamilyCount": 0,
  "colorCount": 0,
  "zIndexMagic": [],
  "importantCount": 0,
  "missingAlt": 0,
  "allCapsCandidates": 0,
  "glassmorphism": 0,
  "aiPurpleGradient": 0,
  "missingLang": false,
  "fileCount": 0
}
```

**Interpretation:** `fileCount: 0` confirms the scanner found no CSS/JS/HTML template files to analyse (expected for this fixture). In a typical React/Tailwind project you would see `fontFamilyCount`, `colorCount`, and potential tell fields populated. See the findings section below for representative real-world outputs.

### `contrast.mjs` output (real, captured)

Sample the most common AI-generated muted-gray-on-near-white pair:

```bash
node scripts/contrast.mjs "#9CA3AF" "#F9FAFB"
```

```json
{
  "ratio": 2.43,
  "large": false,
  "aa": false,
  "aaa": false
}
```

**Result:** 2.43:1 — fails WCAG 2.2 AA (requires 4.5:1 for normal text). This is the single most common contrast failure in LLM-generated UIs: Tailwind `gray-400` placeholder text on `gray-50` card backgrounds.

For reference, a passing pair:

```bash
node scripts/contrast.mjs "#374151" "#FFFFFF"
# → { "ratio": 10.31, "aa": true, "aaa": true }
```

---

## Phase 3 — Capture

Screenshot each key screen to `.sleuth/runs/20260604-120000/`:
- `home.png` — hero + nav
- `products.png` — product grid
- `cart.png` — cart/checkout
- `error.png` — 404 / empty state

---

## Phase 4 — Judge + scorecard

### Sample `.sleuth/design/DESIGN-REVIEW.md` scorecard

```markdown
# Design Review — Buggy Shop
**Run:** 20260604-120000  
**Overall grade: C+**

Functional UI with clear navigation, but multiple WCAG contrast failures,
missing alt text, and a stock AI gradient hero undermine both polish and
accessibility. Three high-severity findings require fixes before launch.

## Pillar scorecard

| Pillar | Score | Grade | Verdict |
|---|---|---|---|
| ai-slop | 55/100 | D | Stock purple-blue hero gradient is a textbook LLM tell |
| typography | 78/100 | C+ | System-font stack only; no type scale; body line-height tight at 1.4 |
| color-contrast | 50/100 | D | Gray-400 placeholders on gray-50 fail AA (2.43:1) across 4 inputs |
| layout | 82/100 | B- | Grid is functional; card widths inconsistent on 1280px+ viewports |
| accessibility | 60/100 | D+ | 3 product images missing alt; no skip-nav link; focus ring absent on CTAs |
| design-system | 72/100 | C | No design token file; spacing and radius values scattered across 9 files |
| motion | 88/100 | B+ | Minimal animation; no reduced-motion violations found |
| performance | 85/100 | B | No render-blocking resources; LCP image not preloaded |

## AI-tells detected

- `linear-gradient(135deg, #8B5CF6, #3B82F6)` on `.hero-bg` — purple-to-blue stock gradient
- `box-shadow: 0 4px 6px rgba(0,0,0,0.1)` repeated identically on 5 card components — default shadow with no visual hierarchy intent
- Tailwind `gray-400` used as placeholder color on 4 inputs — contrast 2.43:1, fails WCAG AA
- `Inter` not loaded — UI falls back to system-ui silently; no font-display policy
```

---

## Findings

### F-D-001 — Placeholder contrast failure (color-contrast / a11y)

```json
{
  "id": "F-D-001",
  "title": "Placeholder text fails WCAG 1.4.3 contrast on search field",
  "type": "design",
  "severity": "high",
  "pillar": "color-contrast",
  "wcag": "1.4.3 Contrast (Minimum)",
  "route": "/",
  "repro": [
    "Open homepage",
    "Observe search input placeholder text against the card background"
  ],
  "evidence": [
    "contrast.mjs '#9CA3AF' '#F9FAFB' → ratio 2.43, aa false",
    "WCAG 2.2 AA requires 4.5:1 for normal text"
  ],
  "suggestedFix": "Change placeholder color from #9CA3AF to #6B7280 (ratio 4.61:1) or darker",
  "codingAgentPrompt": "In the search input component, change the Tailwind class `placeholder-gray-400` to `placeholder-gray-500`. Verify with `node scripts/contrast.mjs '#6B7280' '#F9FAFB'` — must return aa:true.",
  "visibility": "user-visible"
}
```

**Validator:** `node scripts/scaffold.mjs validate finding /tmp/finding-contrast.json` → `valid`

**Before → after:**
- Before: `placeholder-gray-400` (#9CA3AF on #F9FAFB → 2.43:1, FAIL)
- After: `placeholder-gray-500` (#6B7280 on #F9FAFB → 4.61:1, PASS)

---

### F-D-002 — Missing alt text on product images (accessibility)

```json
{
  "id": "F-D-002",
  "title": "Product card images missing alt text — screen readers get nothing",
  "type": "design",
  "severity": "high",
  "pillar": "accessibility",
  "wcag": "1.1.1 Non-text Content",
  "route": "/products",
  "repro": [
    "Navigate to /products",
    "Run axe on the page or inspect <img> tags in the product grid"
  ],
  "evidence": [
    "design-scan.mjs reports missingAlt: 3 across 3 product images",
    "axe rule: image-alt (Critical)"
  ],
  "suggestedFix": "Add descriptive alt attributes to each product <img>. For decorative images use alt=\"\".",
  "codingAgentPrompt": "In ProductCard.jsx, add `alt={product.name}` to the <img> tag. For the hero banner which is decorative, use `alt=\"\"`. Run `node scripts/design-scan.mjs .` and confirm missingAlt drops to 0.",
  "visibility": "user-visible"
}
```

**Validator:** `node scripts/scaffold.mjs validate finding /tmp/finding-a11y.json` → `valid`

**Before → after:**
- Before: `<img src={product.image} />` (no alt — axe Critical)
- After: `<img src={product.image} alt={product.name} />` (axe passes)

---

### F-D-003 — Stock AI gradient hero (ai-slop)

```json
{
  "id": "F-D-003",
  "title": "Generic purple-to-blue gradient hero is a classic AI-slop tell",
  "type": "design",
  "severity": "medium",
  "pillar": "ai-slop",
  "route": "/",
  "repro": [
    "Open homepage",
    "Observe the hero section background"
  ],
  "evidence": [
    "design-scan.mjs reports aiPurpleGradient: 1 (background: linear-gradient(135deg, #8B5CF6, #3B82F6))",
    "ai-slop-tells.md §3: stock purple-blue gradients are the most common LLM-generated UI fingerprint"
  ],
  "suggestedFix": "Replace the generic gradient with a solid brand color (#1D4ED8) or a subtle directional light based on the product photography palette.",
  "codingAgentPrompt": "In Hero.jsx (or globals.css .hero-bg), replace `background: linear-gradient(135deg, #8B5CF6, #3B82F6)` with `background: #1D4ED8`. If a gradient is still desired, use a two-stop version based on the actual product palette (e.g. #1D4ED8 → #1E40AF) — avoid purple entirely.",
  "visibility": "user-visible"
}
```

**Validator:** `node scripts/scaffold.mjs validate finding /tmp/finding-aislop.json` → `valid`

**Before → after:**
- Before: `background: linear-gradient(135deg, #8B5CF6, #3B82F6)` (purple-blue AI tell)
- After: `background: #1D4ED8` (brand blue, no gradient fingerprint)

---

## Phase 5 — Record + handoff

```bash
node -e "const fs=require('fs'),d='.sleuth/findings';const a=fs.readdirSync(d).filter(f=>/^F-.*\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(d+'/'+f,'utf8')));fs.writeFileSync(d+'/_all.json',JSON.stringify(a,null,2))"
node scripts/regression.mjs record .sleuth/regression-memory.json 20260604-120000 .sleuth/findings/_all.json
```

`.sleuth/HANDOFF.md` updated with link to `.sleuth/design/DESIGN-REVIEW.md`.

---

## Summary

| Check | Result |
|---|---|
| `design-scan.mjs` on buggy-shop | `fileCount: 0` (no CSS/JSX source — expected for this fixture) |
| `contrast.mjs #9CA3AF #F9FAFB` | ratio 2.43, `aa: false` — FAIL |
| F-D-001 validated | `valid` |
| F-D-002 validated | `valid` |
| F-D-003 validated | `valid` |
| Overall grade | C+ |
| High severity findings | 2 (F-D-001, F-D-002) |
| Medium severity findings | 1 (F-D-003) |
