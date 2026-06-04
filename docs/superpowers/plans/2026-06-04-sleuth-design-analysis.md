# Sleuth UI/Design Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `$sleuth-design` command (plus a light design/a11y sweep in `$sleuth-test`) that audits a running app across 8 design/accessibility pillars and emits a graded DESIGN-REVIEW scorecard + fix-ready `type: design` findings with before→after values.

**Architecture:** Reuse Sleuth's existing spine (findings/briefs/SUMMARY/HANDOFF/regression, source reconciliation, browser-tooling). Two new zero-dep Node scripts (`contrast.mjs`, `design-scan.mjs`) supply deterministic signals; three new references distil the design skills' knowledge; one new command skill orchestrates the audit. The finding schema gains a `design` type + optional `pillar`/`wcag`/`selector`.

**Tech Stack:** Node ≥20 (ESM `.mjs`, built-in `node:test`, zero third-party deps, no build). Markdown skill/reference docs. JSON Schema (supported subset). Lighthouse/axe via `chrome-devtools-mcp` are consumed at *runtime by the agent*, not built here.

**Spec:** `~/sleuth-skill/docs/superpowers/specs/2026-06-03-sleuth-design-analysis-design.md`

**Pillar keys (canonical, used by schema + references):** `ai-slop`, `typography`, `color-contrast`, `layout`, `accessibility`, `design-system`, `motion`, `performance`.

---

## File Structure

```
~/sleuth-skill/
├── schemas/finding.schema.json          # MODIFY: + "design" type, + pillar/wcag/selector (Task 1)
├── scripts/
│   ├── contrast.mjs                      # CREATE: WCAG contrast math (Task 2)
│   └── design-scan.mjs                   # CREATE: static design tells (Task 3)
├── test/
│   ├── schemas.test.mjs                  # MODIFY: assert design type + pillar enum (Task 1)
│   ├── contrast.test.mjs                 # CREATE (Task 2)
│   └── design-scan.test.mjs              # CREATE (Task 3)
├── references/
│   ├── ai-slop-tells.md                  # CREATE: the "screams AI" catalog (Task 4)
│   ├── accessibility-wcag.md             # CREATE: WCAG 2.2 AA checklist (Task 5)
│   ├── design-review.md                  # CREATE: 8-pillar orchestrator + scorecard + brief format (Task 6)
│   ├── briefs.md                         # MODIFY: HANDOFF Coverage links DESIGN-REVIEW.md (Task 9)
│   └── master-plan.md                    # MODIFY: route design/a11y → $sleuth-design (Task 9)
├── commands/
│   ├── sleuth-design/SKILL.md            # CREATE (Task 7)
│   ├── sleuth-design/agents/openai.yaml  # CREATE (Task 7)
│   └── sleuth-test/SKILL.md              # MODIFY: light design sweep (Task 8)
├── SKILL.md                              # MODIFY: master router routes design asks (Task 9)
├── README.md                            # MODIFY: document $sleuth-design (Task 9)
└── examples/design-review-example.md     # CREATE: worked scorecard (Task 10)
```

**Note on prose tasks (4–9):** reference/command files are agent-facing playbooks. Each task lists **mandatory content** (the acceptance checklist). Write full prose satisfying every bullet. Any JSON example included MUST validate against the schema (the task says how to verify).

---

### Task 1: Schema — add `design` type + optional pillar/wcag/selector

**Files:**
- Modify: `schemas/finding.schema.json`
- Modify: `test/schemas.test.mjs`

- [ ] **Step 1: Write the failing test** — append to `test/schemas.test.mjs`:

```js
test('finding schema allows the design type and pillar/wcag/selector', () => {
  const s = load('finding');
  assert.ok(s.properties.type.enum.includes('design'));
  assert.deepEqual(s.properties.pillar.enum, [
    'ai-slop', 'typography', 'color-contrast', 'layout',
    'accessibility', 'design-system', 'motion', 'performance',
  ]);
  assert.equal(s.properties.wcag.type, 'string');
  assert.equal(s.properties.selector.type, 'string');
  // new fields are optional
  assert.ok(!s.required.includes('pillar'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/sleuth-skill && node --test test/schemas.test.mjs`
Expected: FAIL (`type.enum` lacks `design`; `pillar` undefined).

- [ ] **Step 3: Edit `schemas/finding.schema.json`**

Change the `type` enum to include `design`:
```json
"type": { "type": "string", "enum": ["bug", "security", "ux-friction", "design", "expected"] },
```
Add these three optional properties inside `properties` (e.g. after `cwe`):
```json
"pillar": { "type": "string", "enum": ["ai-slop", "typography", "color-contrast", "layout", "accessibility", "design-system", "motion", "performance"] },
"wcag": { "type": "string" },
"selector": { "type": "string" },
```
(Do NOT add any of them to `required`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/sleuth-skill && node --test test/schemas.test.mjs`
Expected: PASS.

- [ ] **Step 5: Verify a design finding validates**

Run:
```bash
cd ~/sleuth-skill && node scripts/scaffold.mjs validate finding /dev/stdin <<<'{"id":"D-001","title":"Body text fails AA contrast","type":"design","severity":"high","visibility":"user-visible","pillar":"color-contrast","wcag":"1.4.3","selector":"p.muted","repro":["open /"],"evidence":["shot.png"]}'
```
Expected: prints `valid`. Also confirm a bad pillar fails:
```bash
node scripts/scaffold.mjs validate finding /dev/stdin <<<'{"id":"x","title":"t","type":"design","severity":"low","pillar":"bogus","repro":["a"],"evidence":["b"]}'
```
Expected: error mentioning `pillar` + exit non-zero.

- [ ] **Step 6: Commit**

```bash
cd ~/sleuth-skill && git add schemas/finding.schema.json test/schemas.test.mjs && git commit -q -m "feat: finding schema gains design type + pillar/wcag/selector"
```

---

### Task 2: `contrast.mjs` — WCAG contrast math

**Files:**
- Create: `scripts/contrast.mjs`
- Test: `test/contrast.test.mjs`

- [ ] **Step 1: Write the failing test** — `test/contrast.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, ratio, verdict } from '../scripts/contrast.mjs';

test('parseColor handles #rgb, #rrggbb, rgb(), rgba()', () => {
  assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseColor('#000000'), { r: 0, g: 0, b: 0 });
  assert.deepEqual(parseColor('rgb(10, 20, 30)'), { r: 10, g: 20, b: 30 });
  assert.deepEqual(parseColor('rgba(10,20,30,0.5)'), { r: 10, g: 20, b: 30 });
  assert.equal(parseColor('not-a-color'), null);
});

test('ratio: black on white is 21:1', () => {
  assert.ok(Math.abs(ratio('#000000', '#ffffff') - 21) < 0.01);
});

test('ratio: identical colors is 1:1', () => {
  assert.ok(Math.abs(ratio('#777777', '#777777') - 1) < 0.001);
});

test('ratio: muted gray on near-white fails AA (the classic AI tell)', () => {
  const r = ratio('#9CA3AF', '#F9FAFB');
  assert.ok(r < 4.5, `expected <4.5 got ${r}`);
});

test('verdict: thresholds for normal and large text', () => {
  assert.deepEqual(verdict(4.5, { large: false }), { ratio: 4.5, large: false, aa: true, aaa: false });
  assert.equal(verdict(4.49, {}).aa, false);
  assert.equal(verdict(3.0, { large: true }).aa, true);
  assert.equal(verdict(7.0, {}).aaa, true);
  assert.equal(verdict(4.5, { large: true }).aaa, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/sleuth-skill && node --test test/contrast.test.mjs`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `scripts/contrast.mjs`**

```js
#!/usr/bin/env node
// WCAG 2.x relative-luminance contrast math. Zero dependencies.

export function parseColor(input) {
  if (input && typeof input === 'object' && 'r' in input) return input;
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  let m;
  if ((m = s.match(/^#([0-9a-f]{3})$/))) {
    const h = m[1];
    return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) };
  }
  if ((m = s.match(/^#([0-9a-f]{6})$/))) {
    const h = m[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  if ((m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/))) {
    return { r: +m[1], g: +m[2], b: +m[3] };
  }
  return null;
}

export function relativeLuminance(color) {
  const c = parseColor(color);
  if (!c) return null;
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

export function ratio(c1, c2) {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  if (l1 == null || l2 == null) return null;
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

export function verdict(r, opts = {}) {
  const large = !!opts.large;
  return { ratio: r, large, aa: r >= (large ? 3.0 : 4.5), aaa: r >= (large ? 4.5 : 7.0) };
}

function main() {
  const [a, b, flag] = process.argv.slice(2);
  if (!a || !b) { process.stderr.write('usage: contrast.mjs <color1> <color2> [--large]\n'); process.exit(2); }
  const r = ratio(a, b);
  if (r == null) { process.stderr.write('could not parse one or both colors\n'); process.exit(2); }
  const out = verdict(r, { large: flag === '--large' });
  out.ratio = Math.round(r * 100) / 100;
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}
if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/sleuth-skill && node --test test/contrast.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Smoke the CLI**

Run: `cd ~/sleuth-skill && node scripts/contrast.mjs "#9CA3AF" "#F9FAFB"`
Expected: JSON with `"aa": false` and a `ratio` near 2–2.6.

- [ ] **Step 6: Commit**

```bash
cd ~/sleuth-skill && git add scripts/contrast.mjs test/contrast.test.mjs && git commit -q -m "feat: contrast.mjs — zero-dep WCAG contrast math + AA/AAA verdict"
```

---

### Task 3: `design-scan.mjs` — static design tells

**Files:**
- Create: `scripts/design-scan.mjs`
- Test: `test/design-scan.test.mjs`

- [ ] **Step 1: Write the failing test** — `test/design-scan.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanDesign, fontFamilies, distinctHexColors, zIndexMagic } from '../scripts/design-scan.mjs';

function w(root, rel, content) {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content);
}

test('fontFamilies extracts distinct primary families', () => {
  const fams = fontFamilies(`body{font-family:Inter, sans-serif} h1{font-family:"Poppins"}`);
  assert.deepEqual(fams.sort(), ['inter', 'poppins']);
});

test('distinctHexColors collects unique hex values', () => {
  assert.deepEqual(distinctHexColors('#FFF #ffffff #abcdef #abcdef').sort(), ['#abcdef', '#fff', '#ffffff']);
});

test('zIndexMagic flags >=100 css and tailwind values', () => {
  assert.deepEqual(zIndexMagic('z-index: 9999; .x{z-index:50} z-[1000]').sort((a,b)=>a-b), [1000, 9999]);
});

test('scanDesign reports the loud tells in a messy repo', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ds-'));
  w(tmp, 'a.css', `
    body{font-family:Inter} h1{font-family:Roboto} h2{font-family:Poppins} h3{font-family:Lato}
    .modal{z-index:9999 !important} .a{color:red !important} .b{backdrop-filter:blur(8px)}
    .hero{background:linear-gradient(90deg,#7c3aed,#a855f7)} .u{text-transform:uppercase}`);
  w(tmp, 'page.html', `<html><body><img src="x.png"><img src="y.png" alt="ok"></body></html>`);
  const s = scanDesign(tmp);
  assert.equal(s.fontFamilyCount, 4);
  assert.ok(s.zIndexMagic.includes(9999));
  assert.ok(s.importantCount >= 2);
  assert.ok(s.glassmorphism >= 1);
  assert.ok(s.aiPurpleGradient >= 1);
  assert.equal(s.missingAlt, 1);
  assert.equal(s.missingLang, true);
});

test('scanDesign stays quiet on a clean repo', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ds-'));
  w(tmp, 'clean.css', `body{font-family:Inter} .ok{color:#111827}`);
  w(tmp, 'ok.html', `<html lang="en"><body><img src="a.png" alt="a"></body></html>`);
  const s = scanDesign(tmp);
  assert.equal(s.fontFamilyCount, 1);
  assert.deepEqual(s.zIndexMagic, []);
  assert.equal(s.importantCount, 0);
  assert.equal(s.aiPurpleGradient, 0);
  assert.equal(s.missingAlt, 0);
  assert.equal(s.missingLang, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/sleuth-skill && node --test test/design-scan.test.mjs`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `scripts/design-scan.mjs`**

```js
#!/usr/bin/env node
// Static "screams-AI" design tells from source. Zero dependencies. Best-effort heuristics.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.sleuth', 'coverage', '.turbo']);
const EXTS = ['.css', '.scss', '.sass', '.less', '.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.vue', '.svelte', '.astro'];

export function walk(root, exts = EXTS) {
  const out = [];
  (function rec(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) { if (IGNORE.has(e.name) || e.name.startsWith('.')) continue; rec(full); }
      else if (exts.some((x) => e.name.endsWith(x))) out.push(full);
    }
  })(root);
  return out;
}

export function fontFamilies(text) {
  const fams = new Set();
  const re = /font-family\s*:\s*([^;}{"']+)/gi;
  let m;
  while ((m = re.exec(text))) {
    const first = m[1].split(',')[0].trim().replace(/["']/g, '');
    if (first && !/^(inherit|initial|unset|var\(|--)/i.test(first)) fams.add(first.toLowerCase());
  }
  return [...fams];
}

export function distinctHexColors(text) {
  const set = new Set();
  const re = /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi;
  let m;
  while ((m = re.exec(text))) set.add(m[0].toLowerCase());
  return [...set];
}

export function zIndexMagic(text) {
  const vals = new Set();
  let m;
  const re1 = /z-index\s*:\s*(\d{3,})/gi;
  while ((m = re1.exec(text))) { const v = +m[1]; if (v >= 100) vals.add(v); }
  const re2 = /z-\[(\d{3,})\]/g;
  while ((m = re2.exec(text))) { const v = +m[1]; if (v >= 100) vals.add(v); }
  return [...vals];
}

export function scanDesign(root) {
  const files = walk(root);
  const fams = new Set(), colors = new Set(), zmagic = new Set();
  let importantCount = 0, missingAlt = 0, allCapsCandidates = 0, glassmorphism = 0, aiPurpleGradient = 0;
  let htmlSeen = false, langSeen = false;
  for (const f of files) {
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    fontFamilies(src).forEach((x) => fams.add(x));
    distinctHexColors(src).forEach((x) => colors.add(x));
    zIndexMagic(src).forEach((x) => zmagic.add(x));
    importantCount += (src.match(/!important/g) || []).length;
    allCapsCandidates += (src.match(/text-transform\s*:\s*uppercase/gi) || []).length;
    allCapsCandidates += (src.match(/class(Name)?="[^"]*\buppercase\b[^"]*"/g) || []).length;
    glassmorphism += (src.match(/backdrop-filter|backdrop-blur/gi) || []).length;
    for (const tag of (src.match(/<img\b[^>]*>/gi) || [])) if (!/\balt\s*=/.test(tag)) missingAlt++;
    if (/(linear|radial)-gradient\([^)]*(#8b5cf6|#7c3aed|#a855f7|#6366f1|rebeccapurple|\bviolet\b|\bpurple\b|\bindigo\b|\bfuchsia\b)/i.test(src)) aiPurpleGradient++;
    if (/bg-gradient-to-[a-z]+[^"']*\b(from|via|to)-(purple|violet|indigo|fuchsia)-\d/.test(src)) aiPurpleGradient++;
    for (const tag of (src.match(/<html\b[^>]*>/gi) || [])) { htmlSeen = true; if (/\blang\s*=/.test(tag)) langSeen = true; }
  }
  return {
    fontFamilies: [...fams],
    fontFamilyCount: fams.size,
    colorCount: colors.size,
    zIndexMagic: [...zmagic],
    importantCount,
    missingAlt,
    allCapsCandidates,
    glassmorphism,
    aiPurpleGradient,
    missingLang: htmlSeen ? !langSeen : false,
    fileCount: files.length,
  };
}

function main() {
  const root = process.argv[2] || process.cwd();
  process.stdout.write(JSON.stringify(scanDesign(root), null, 2) + '\n');
}
if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/sleuth-skill && node --test test/design-scan.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full suite**

Run: `cd ~/sleuth-skill && node --test 2>&1 | grep -iE 'pass|fail'`
Expected: all pass (now ~33 tests across all files).

- [ ] **Step 6: Commit**

```bash
cd ~/sleuth-skill && git add scripts/design-scan.mjs test/design-scan.test.mjs && git commit -q -m "feat: design-scan.mjs — static AI design tells (fonts, colors, z-index, contrast inputs, alt/lang)"
```

---

### Task 4: `references/ai-slop-tells.md` — the "screams AI" catalog

**Files:**
- Create: `references/ai-slop-tells.md`

- [ ] **Step 1: Write `references/ai-slop-tells.md`**

Mandatory content (each tell = name, why it reads as AI, how to detect it (visual and/or via `design-scan.mjs`), and the corrective before→after):
- Violet/purple/indigo gradients as the default brand move (detect: `aiPurpleGradient`).
- Centered hero over a dark mesh/grid/aurora background.
- Three equal feature cards in a row (and card overuse / nested cards generally).
- Blanket glassmorphism / `backdrop-filter` on everything (detect: `glassmorphism`).
- Inter + slate-900 as the unconsidered default pairing.
- Emoji used as bullet points / feature icons.
- Perfectly uniform spacing everywhere (no rhythm); everything centered.
- Reflexive identical entrance animation on every section; infinite looping micro-animations.
- Generic stock iconography with inconsistent weights/sizes.
- Lorem-ish filler copy and vague "Empower your workflow" headlines.
- `z-index: 9999` / magic stacking values (detect: `zIndexMagic`); `!important` spam (detect: `importantCount`).
- ALL-CAPS body copy (detect: `allCapsCandidates`).
State at the top: these are CONTEXTUAL signals, not automatic failures — a tell only becomes a finding when it actually hurts the design for this app's audience (avoid false positives on genuinely good, intentional choices). Map each tell to a `pillar` (mostly `ai-slop`, some `typography`/`color-contrast`/`motion`). Reference `scripts/design-scan.mjs` output fields by name.

- [ ] **Step 2: Commit**

```bash
cd ~/sleuth-skill && git add references/ai-slop-tells.md && git commit -q -m "docs: ai-slop-tells catalog reference"
```

---

### Task 5: `references/accessibility-wcag.md` — WCAG 2.2 AA checklist

**Files:**
- Create: `references/accessibility-wcag.md`

- [ ] **Step 1: Write `references/accessibility-wcag.md`**

Mandatory content:
- POUR framing; target **WCAG 2.2 level AA** (note AA is the legal/ADA bar in many jurisdictions).
- A checklist grouped by POUR, each item tagged with its **success-criterion id** (the `wcag` finding field), e.g.: text alternatives (1.1.1), contrast minimum (1.4.3 — body 4.5:1, large 3:1), use of color (1.4.1), keyboard (2.1.1) + no trap (2.1.2), focus visible (2.4.7), focus not obscured (2.4.11, new in 2.2), target size (2.5.8, new in 2.2), page titled (2.4.2), headings/labels (2.4.6), labels/instructions (3.3.2), name/role/value (4.1.2), lang of page (3.1.1).
- For EACH item state how to check it: **deterministic** (Lighthouse/axe via chrome-devtools-mcp; `scripts/contrast.mjs` for ratios; `scripts/design-scan.mjs` for missing `alt`/`lang`) vs **visual/interaction** (tab through, check focus ring, zoom to 200%).
- How to write an a11y finding: `type: design`, `pillar: accessibility`, set `wcag` to the SC id, set `visibility` (a contrast fail is user-visible; a missing ARIA label is hidden-to-sighted-users but high for AT users — note this), severity per `references/judging.md` (AA violation → high; advisory → low/medium), with a concrete before→after (e.g., add `alt="..."`, raise contrast to the value `contrast.mjs` reports as AA-passing).
- Note graceful degradation: when Lighthouse/axe aren't available, fall back to `design-scan.mjs` + `contrast.mjs` + manual tab-through and mark determinism reduced.

- [ ] **Step 2: Commit**

```bash
cd ~/sleuth-skill && git add references/accessibility-wcag.md && git commit -q -m "docs: accessibility-wcag 2.2 AA checklist reference"
```

---

### Task 6: `references/design-review.md` — 8-pillar orchestrator + scorecard

**Files:**
- Create: `references/design-review.md`

- [ ] **Step 1: Write `references/design-review.md`**

Mandatory content:
- The procedure for a full design audit: (1) confirm running URL + driving surface (`references/browser-tooling.md`); (2) ensure/locate the real source + Product Contract (`references/product-contract.md`); (3) run `node scripts/design-scan.mjs <repo>` for static tells; (4) run Lighthouse + axe a11y snapshot where available (chrome-devtools-mcp) and pull computed styles (fonts/sizes/spacing) via `evaluate_script`; (5) capture a screenshot of each key screen to `.sleuth/runs/<run-id>/`; (6) judge each pillar; (7) write the scorecard + findings.
- **The 8 pillars** with the concrete rules to apply for each (distilled): `ai-slop` (→ `references/ai-slop-tells.md`), `typography` (≤3 families, scale ratio ≥1.25, line length 65–75ch, no all-caps body, hero ≤6rem, letter-spacing ≥ −0.04em), `color-contrast` (use `scripts/contrast.mjs` for ratios; flag muted-gray-on-tint; palette coherence), `layout` (spacing rhythm, alignment, cards-are-lazy/nested-cards-wrong, grid-vs-flex, focal hierarchy), `accessibility` (→ `references/accessibility-wcag.md`), `design-system` (icon coherence; interactive-state coverage hover/focus/disabled/error/loading/empty), `motion` (prefers-reduced-motion, ease-out, no infinite distractions), `performance` (Lighthouse LCP<2.5s / INP<200ms / CLS<0.1).
- **Scoring**: each pillar 0–100 + letter grade (A ≥90, B ≥80, C ≥70, D ≥60, F <60); overall = equal-weight mean (state weighting is equal in v1 and tunable). Map score bands to severity for findings.
- **Output 1 — scorecard `.sleuth/design/DESIGN-REVIEW.md`**: give the exact section layout — overall grade; per-pillar table (pillar, score, grade, 1-line verdict); a prominent **"AI-tells detected"** list; top fixes by impact; a determinism note (measured vs visually judged); screenshot index. Include a short worked example scorecard.
- **Output 2 — fix-ready findings**: each `type: design` finding sets `pillar`, `visibility`, `severity`, and (for a11y) `wcag` + (when known) `selector`; the brief MUST carry a concrete **before→after value** and a paste-ready coding-agent prompt. Show one complete worked example finding JSON (must validate) for a contrast failure with a before→after value, and confirm it validates with `node scripts/scaffold.mjs validate finding <tmpfile>` → `valid`.
- **One-shot-fix rule**: a design finding is only "done" when its before→after value is specific enough (exact color/size/token/file) that a coding agent could apply it without further investigation.
- **Avoid false positives**: an intentional, well-executed bold choice is NOT a tell; only flag what genuinely hurts this app's audience.

- [ ] **Step 2: Validate the worked-example finding JSON**

Copy the example finding JSON to `/tmp/df.json` and run:
```bash
cd ~/sleuth-skill && node scripts/scaffold.mjs validate finding /tmp/df.json
```
Expected: `valid`. Fix the example until it validates; the JSON in the doc must match.

- [ ] **Step 3: Commit**

```bash
cd ~/sleuth-skill && git add references/design-review.md && git commit -q -m "docs: design-review 8-pillar orchestrator + scorecard + one-shot finding format"
```

---

### Task 7: `commands/sleuth-design/SKILL.md` + openai.yaml

**Files:**
- Create: `commands/sleuth-design/SKILL.md`
- Create: `commands/sleuth-design/agents/openai.yaml`

- [ ] **Step 1: Write `commands/sleuth-design/SKILL.md`** (lean; defer detail to references). Mandatory content:
- Frontmatter `name: sleuth-design`; description triggers on: "review my design", "does this look AI-made", "make it not look AI", "a11y audit", "is it accessible", "WCAG", "ADA", "design feedback", "audit my UI". Keep description < 500 chars.
- Body phases (terse pointers, file < 4000 chars): Phase 0 scope-gate (`references/safety-roe.md`, incl. Cost & side-effects); Phase 1 confirm surface (`references/browser-tooling.md`) + locate real source + Product Contract (`references/product-contract.md`); Phase 2 deterministic pass — `node scripts/scaffold.mjs init <repo>`, `node scripts/design-scan.mjs <repo>`, Lighthouse + axe where available, `node scripts/contrast.mjs` on sampled text/bg pairs; Phase 3 capture key-screen screenshots to `.sleuth/runs/<run-id>/`; Phase 4 judge all 8 pillars + write `.sleuth/design/DESIGN-REVIEW.md` and `type: design` findings/briefs (`references/design-review.md`, `references/ai-slop-tells.md`, `references/accessibility-wcag.md`, `references/judging.md`, `references/briefs.md`); Phase 5 assemble `.sleuth/findings/_all.json` + `node scripts/regression.mjs record ...`; write/update `.sleuth/HANDOFF.md` linking the scorecard. run-id = `YYYYMMDD-HHMMSS`.

- [ ] **Step 2: Write `commands/sleuth-design/agents/openai.yaml`**

```yaml
interface:
  display_name: "Sleuth Design"
  short_description: "Audits your running app's UI/design + accessibility; flags AI-slop tells and WCAG fails with one-shot fix briefs."
  brand_color: "#1f6feb"
policy:
  allow_implicit_invocation: true
```

- [ ] **Step 3: Verify budget + frontmatter**

Run:
```bash
cd ~/sleuth-skill && node -e "const fs=require('fs');const s=fs.readFileSync('commands/sleuth-design/SKILL.md','utf8');const d=s.match(/description:\s*(.*)/)[1];console.log('desc',d.length,'file',s.length)"
```
Expected: `desc` < 500 and `file` < 4000. Confirm the file starts with `---`, has `name: sleuth-design` and a `description:` line.

- [ ] **Step 4: Commit**

```bash
cd ~/sleuth-skill && git add commands/sleuth-design && git commit -q -m "feat: \$sleuth-design command — full 8-pillar UI/design + a11y audit"
```

---

### Task 8: Light design sweep in `commands/sleuth-test/SKILL.md`

**Files:**
- Modify: `commands/sleuth-test/SKILL.md`

- [ ] **Step 1: Add a "Lightweight design/a11y sweep" step** to the Drive phase of `commands/sleuth-test/SKILL.md`. Mandatory content (keep file < 4000 chars — trim wording if needed):
- After the functional/ICP passes, run a quick design sweep: `node scripts/design-scan.mjs <repo>` for static tells, `node scripts/contrast.mjs` on the primary body text/background pair, and a one-screen visual check for the top AI-slop tells + any critical WCAG fail (missing alt/labels, unreadable contrast).
- Surface only the worst offenders as `type: design` findings (set `pillar`/`visibility`); do NOT run the full 8-pillar audit — point to `$sleuth-design` for depth.
- One line: "For a full design + accessibility audit, run `$sleuth-design`."

- [ ] **Step 2: Verify budget**

Run: `cd ~/sleuth-skill && node -e "const s=require('fs').readFileSync('commands/sleuth-test/SKILL.md','utf8');console.log('file',s.length)"`
Expected: < 4000. If over, trim wording (detail lives in `references/design-review.md`).

- [ ] **Step 3: Commit**

```bash
cd ~/sleuth-skill && git add commands/sleuth-test/SKILL.md && git commit -q -m "feat: lightweight design/a11y sweep in \$sleuth-test"
```

---

### Task 9: Wiring — master router, master-plan, HANDOFF, README

**Files:**
- Modify: `SKILL.md`
- Modify: `references/master-plan.md`
- Modify: `references/briefs.md`
- Modify: `README.md`

- [ ] **Step 1: Route design asks in master `SKILL.md`** — add a phase-detection row / line: user asks "review/audit my design, does it look AI-made, a11y/WCAG/ADA, is it accessible" → run `$sleuth-design`. Add one line listing `$sleuth-design` among the commands. Keep root SKILL.md < 4000 chars (it's tight at ~3979 — trim wording elsewhere to fit; the detail lives in references).

- [ ] **Step 2: Add the routing row to `references/master-plan.md`** — a table row: signal "user wants a design / UI / accessibility / ADA review" → Phase "Design audit" → Command `$sleuth-design` → Why "deep 8-pillar UI + WCAG audit with one-shot fix briefs". Keep consistent with the root table.

- [ ] **Step 3: HANDOFF Coverage links the scorecard in `references/briefs.md`** — in the HANDOFF.md spec's Coverage section, add: "if a design audit ran, link `.sleuth/design/DESIGN-REVIEW.md` and note the overall design grade."

- [ ] **Step 4: README** — add `$sleuth-design` to the commands table ("Audit UI/design + accessibility; AI-slop tells + WCAG with one-shot fix briefs"); mention the `.sleuth/design/DESIGN-REVIEW.md` scorecard artifact, the new `references/` (design-review, ai-slop-tells, accessibility-wcag) and scripts (`contrast.mjs`, `design-scan.mjs`), and that it uses Lighthouse/axe when the chrome-devtools surface is available.

- [ ] **Step 5: Commit**

```bash
cd ~/sleuth-skill && git add SKILL.md references/master-plan.md references/briefs.md README.md && git commit -q -m "feat: wire \$sleuth-design into router, master-plan, HANDOFF, README"
```

---

### Task 10: Acceptance + worked example

**Files:**
- Create: `examples/design-review-example.md`

- [ ] **Step 1: Full suite + budgets + installer self-containment**

Run:
```bash
cd ~/sleuth-skill && node --test 2>&1 | grep -iE 'pass|fail'
for f in SKILL.md commands/*/SKILL.md; do node -e "const s=require('fs').readFileSync('$f','utf8');const d=(s.match(/description:\s*(.*)/)||[])[1]||'';console.log('$f','desc',d.length,'file',s.length)"; done
rm -rf /tmp/skilltest && bash install.sh /tmp/skilltest >/dev/null && for s in sleuth sleuth-scan sleuth-test sleuth-security sleuth-retest sleuth-design; do test -f /tmp/skilltest/$s/SKILL.md && test -f /tmp/skilltest/$s/scripts/contrast.mjs && test -f /tmp/skilltest/$s/scripts/design-scan.mjs && test -f /tmp/skilltest/$s/references/design-review.md && echo "ok $s" || echo "BROKEN $s"; done; rm -rf /tmp/skilltest
```
Expected: all tests pass; every SKILL.md desc<500 & file<4000; all SIX skills (including the new `sleuth-design`) print `ok` with the new scripts + design-review reference present (confirms `install.sh`'s `cp -R scripts references` carries them). If `sleuth-design` is BROKEN, confirm `install.sh`'s `for d in commands/*/` loop picks it up (it should automatically).

- [ ] **Step 2: Run the deterministic scripts against a real app + write `examples/design-review-example.md`**

Run `node scripts/design-scan.mjs ~/sleuth/fixtures/buggy-shop` (or another local app) and `node scripts/contrast.mjs "#9CA3AF" "#F9FAFB"`; capture the JSON. Write `examples/design-review-example.md`: a narrated `$sleuth-design` run showing the real `design-scan` output, a sample `DESIGN-REVIEW.md` scorecard (per-pillar grades + AI-tells list), and 2–3 example `type: design` findings each with a before→after value. VALIDATE every full finding JSON you include (`node scripts/scaffold.mjs validate finding <tmpfile>` → `valid`); the JSON in the doc must match.

- [ ] **Step 3: Commit**

```bash
cd ~/sleuth-skill && git add examples/design-review-example.md && git commit -q -m "docs: worked \$sleuth-design walkthrough; acceptance pass green"
```

---

## Self-Review

**Spec coverage:**
- Dedicated `$sleuth-design` command → Task 7. Light sweep in `$sleuth-test` → Task 8. ✅
- 8 pillars → `design-review.md` (Task 6) + `ai-slop-tells.md` (Task 4) + `accessibility-wcag.md` (Task 5). ✅
- Hybrid judging: deterministic scripts → Tasks 2 (`contrast.mjs`) + 3 (`design-scan.mjs`); Lighthouse/axe consumed at runtime → documented in Tasks 5/6/7; graceful fallback → Tasks 5/6. ✅
- Output: `DESIGN-REVIEW.md` scorecard + `type: design` findings with before→after → Task 6 (+ schema Task 1). ✅
- Schema: `design` type + `pillar`/`wcag`/`selector` → Task 1. ✅
- Reuse spine (findings/briefs/SUMMARY/HANDOFF/regression, source reconciliation, visibility) → Tasks 6/7/9. ✅
- Wiring (router, master-plan, HANDOFF, README) → Task 9. ✅
- Success criteria + tests (contrast/design-scan unit tests, schema validation, installer, budgets, worked example) → Tasks 2/3/1/10. ✅

**Placeholder scan:** Prose tasks (4–9) specify mandatory content (documented at top) — all code/test/schema steps carry complete content; no "TBD/TODO" in logic. ✅

**Type consistency:** Pillar keys `[ai-slop, typography, color-contrast, layout, accessibility, design-system, motion, performance]` identical across schema (Task 1), references (Tasks 4–6), and the schema test. Script exports — `parseColor/relativeLuminance/ratio/verdict` (contrast, Tasks 2) and `walk/fontFamilies/distinctHexColors/zIndexMagic/scanDesign` (design-scan, Task 3) — match between impl, tests, and the commands that call them. Finding fields (`type`,`pillar`,`wcag`,`selector`,`visibility`,`severity`) consistent across schema, judging, design-review, briefs. Artifact paths (`.sleuth/design/DESIGN-REVIEW.md`, `.sleuth/findings/F-*.json`, `_all.json`, `.sleuth/HANDOFF.md`) consistent. ✅
