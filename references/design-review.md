# Design Review Reference Playbook

This playbook is the orchestrator for `$sleuth-design`. It defines the end-to-end procedure for auditing a running app's UI quality, AI-slop signals, and accessibility; the 8-pillar rubric used to score those audits; the scoring arithmetic; the exact layout of the two output artifacts; and the one-shot-fix standard that every finding must meet before it is committed.

Read this document before a design run. The playbook points outward to existing references (listed below) rather than duplicating their content.

**Upstream references this document depends on:**

| Reference | Role in the design audit |
|---|---|
| `references/ai-slop-tells.md` | Catalog of screams-AI signals, one per tell, with correctives |
| `references/accessibility-wcag.md` | WCAG 2.2 AA checklist — drives the `accessibility` pillar |
| `references/browser-tooling.md` | Driving surface detection and evidence capture |
| `references/product-contract.md` | Source reconciliation; what the app is supposed to do |
| `references/judging.md` | Finding classification, severity, visibility, false-positive gate |
| `references/briefs.md` | Per-finding brief and HANDOFF format |

**Scripts used in this run:**

| Script | What it does |
|---|---|
| `scripts/design-scan.mjs <repo>` | Static analysis: emits `fontFamilies`, `fontFamilyCount`, `colorCount`, `zIndexMagic`, `importantCount`, `missingAlt`, `allCapsCandidates`, `glassmorphism`, `aiPurpleGradient`, `missingLang`, `fileCount` |
| `scripts/contrast.mjs <fg> <bg> [--large]` | WCAG contrast math: emits JSON `{ ratio, aa, aaa }` |
| `scripts/scaffold.mjs validate finding <file>` | Validates a finding JSON against the schema |
| `scripts/regression.mjs` | Records / diffs findings across runs |

---

## Procedure

The design audit runs as a single ordered pass. Each step number below corresponds to a discrete decision gate; do not skip steps or reorder them.

**Step 1 — Confirm the running URL and driving surface.**

Before touching the source tree, verify the target URL is reachable. Make a lightweight HEAD request or navigate to the base URL and confirm the page loads. If the URL is unreachable, stop immediately and ask the user to start the app and provide the port — do not assume localhost:3000. Once the URL responds, consult `references/browser-tooling.md` to select the highest-ranked available driving surface (Codex computer-use → Codex in-app browser → Chrome DevTools MCP → Playwright). Record which surface you are using in the run's scaffold; every evidence capture call in later steps uses that surface's tool names.

**Step 2 — Locate the real source tree and load the Product Contract.**

Design analysis requires knowing what the app is actually supposed to look like, not what a QA fixtures folder looks like. Follow `references/product-contract.md`'s mismatch-detection checklist: run `node scripts/detect-stack.mjs <repo>` and compare its reported routes and files against the files loaded by the live app in DevTools → Sources. If the paths diverge, ask the user for the actual served-app source path before proceeding. The Product Contract's `app.sourceNote` field must record which path was used. Once the contract is validated, note the `app.name`, `audience.icp`, and any existing `capabilities` that have UX implications — these inform whether a bold design choice is intentional vs. defaulted.

**Step 3 — Run `node scripts/design-scan.mjs <repo>` for static tells.**

Pass the confirmed source path (not the QA harness path). The scanner walks every `.css`, `.scss`, `.js`, `.ts`, `.tsx`, `.jsx`, `.html`, `.vue`, `.svelte`, and `.astro` file excluding `node_modules`, `dist`, `build`, `.next`, and `.sleuth`. Capture the full JSON output and note the following fields for later pillar judgments:

- `fontFamilyCount > 3` → flag candidate for `typography` pillar
- `colorCount > 12` → flag candidate for `color-contrast` / `design-system` pallette-sprawl check
- `zIndexMagic` (any value ≥ 100) → layout-stacking smell
- `importantCount` (high values, e.g. > 15) → CSS specificity war, design-system coherence signal
- `missingAlt > 0` → hard WCAG 1.1.1 failure, `accessibility` pillar
- `allCapsCandidates > 0` → all-caps body text candidate, `typography` pillar
- `glassmorphism > 0` → backdrop-filter usage, `ai-slop` pillar candidate
- `aiPurpleGradient > 0` → purple/violet/indigo gradient, `ai-slop` pillar candidate
- `missingLang: true` → missing `lang` attribute on `<html>`, `accessibility` pillar (WCAG 3.1.1)

Do not raise findings yet — the scanner output is evidence to feed pillar judging in Step 6.

**Step 4 — Run Lighthouse + axe and pull computed styles where chrome-devtools-mcp is available.**

If `chrome-devtools__lighthouse_audit` is present in the tool list, run a Lighthouse audit against the target URL and capture the JSON output — extract Performance score (LCP, INP, CLS), Accessibility score, and the full list of axe rule violations. If Lighthouse is unavailable, note "Lighthouse unavailable — performance pillar scores are visual estimates only" in the run scaffold.

Separately, inject axe via `chrome-devtools__evaluate_script` and run `axe.run()` to get a deterministic accessibility violation list. Capture the violations array.

Use `chrome-devtools__evaluate_script` to pull computed styles for a representative set of text nodes — hero headline, body paragraph, caption/label — and record: `font-family`, `font-size`, `line-height`, `letter-spacing`, and the actual background/foreground color pair as resolved by the browser. These values feed the `typography` and `color-contrast` pillars with real computed data rather than source-only approximations.

If no browser surface is available at all, note reduced coverage for every pillar that relies on runtime data (color-contrast, accessibility, performance) and fall back to source analysis only.

**Step 5 — Capture screenshots of each key screen.**

Navigate to every distinct screen in the app using the selected driving surface. At minimum cover: the landing/home screen, the primary authenticated view, any form or modal, and any error/empty state. After each navigation, capture a screenshot and save it to `.sleuth/runs/<run-id>/`, where `run-id` is the timestamp string `YYYYMMDD-HHMMSS` formatted at the moment the run begins. Use descriptive filenames: `home-hero.png`, `dashboard-cards.png`, `login-form.png`, `empty-state.png`. These screenshots are the visual evidence for the `ai-slop`, `typography`, `layout`, `design-system`, and `motion` pillars, which cannot be fully assessed from source alone.

**Step 6 — Judge each pillar.**

With the scanner output, Lighthouse/axe data, computed styles, and screenshots in hand, evaluate each of the 8 pillars in sequence using the rules in the next section. For each pillar, produce a score (0–100) and a one-line verdict. Mark each pillar as `deterministic` (signal came from a script or tool output with no visual judgment required) or `visual` (signal required screenshot or manual inspection) — this distinction appears in the scorecard's determinism note.

**Step 7 — Write the scorecard and findings.**

Once all pillars are scored, compute the overall score as the equal-weight mean of the 8 pillar scores. Write the scorecard to `.sleuth/design/DESIGN-REVIEW.md` following the exact layout in the Output 1 section below. Write each actionable finding as a JSON file to `.sleuth/findings/F-NNN-<slug>.json` following the schema, with `type: "design"`, and render a per-finding brief per `references/briefs.md`. Every finding must satisfy the one-shot-fix rule before it is committed.

---

## The 8 Pillars

### 1. `ai-slop`

**What to check.** Consult `references/ai-slop-tells.md` for the full catalog. The tells most reliably detected in this run are:

- `aiPurpleGradient > 0` from the scanner: look for the violet/indigo/purple linear-gradient that appears as the default brand move in AI-scaffolded UIs. Flag if the gradient is applied broadly (hero, primary button, section backgrounds) with no other brand-color anchor in the palette.
- `glassmorphism > 0`: backdrop-filter + semi-transparent panels on a blurred or gradient background. Flag when used pervasively or when the contrast between the glass surface and its text is borderline.
- Visually: centered hero over a dark mesh/grid/aurora background; three equal feature cards in a row; nested cards; "floating" everything (excessive box shadows creating a UI that looks like it is levitating three inches off the page); gradient text on body copy; wavy/blob SVG section dividers; full-bleed dark overlays with centered white text for every section.
- `missingLang` and `importantCount` are indirect tells (carelessness signals), but route them to `accessibility` and `design-system` respectively.

**False-positive rule.** An intentional, well-executed bold choice is not a tell. If the product's brand identity clearly embraces purple/indigo (documented palette, consistent use across all surfaces, not just the AI-default gradient on the primary button), do not flag it. Before raising any `ai-slop` finding, ask: does this hurt trust, readability, or conversion for this app's real audience? If no, log as `info` or skip.

**Scoring.** Start at 100. Each confirmed tell docks points proportionally to its impact: pervasive purple gradient + dark mesh hero + three-card layout = 3 major tells = start at 40; one isolated glassmorphism usage = minor tell = dock 10.

---

### 2. `typography`

**Concrete rules to apply:**

- **Font family count:** `fontFamilyCount` from the scanner. Three or fewer families is clean; four is borderline; five or more is a problem. Note: the scanner counts families declared in CSS — a design token `var(--font-heading)` that resolves to a system font stack will not inflate the count. When in doubt, cross-check with the computed `font-family` values pulled in Step 4.
- **Type-scale ratio:** Measure the declared or computed font sizes for at least three levels (body, h3/label, h1/display). The ratio between adjacent levels should be ≥ 1.25 (minor third) for a coherent scale. A ratio below 1.2 produces a "flat" scale where sizes are indistinguishable; a ratio above 2.0 at body-to-display is unusual but may be intentional for editorial designs.
- **Body line length:** Body text paragraphs should fall in the 65–75 ch range for comfortable reading. Check this visually on the main content screen — use `chrome-devtools__evaluate_script` to measure `element.getBoundingClientRect().width / parseFloat(getComputedStyle(element).fontSize)` on the main paragraph. Values below 50 ch feel cramped; above 90 ch produces eye-tracking fatigue on desktop.
- **All-caps body text:** `allCapsCandidates > 0` from the scanner signals `text-transform: uppercase` or the Tailwind `uppercase` class. Review the flagged elements visually. All-caps is acceptable for short labels, navigation items, and eyebrow headings; it is a hard problem for body copy and long button labels, where it destroys readability and creates accessibility friction for users with dyslexia.
- **Hero headline size:** Any clamp()-based or responsive headline should max out at ≤ 6 rem at the widest viewport. A hero headline above 6 rem breaks the visual hierarchy at large screen widths and typically signals the developer scaled up past the designer's intent.
- **Display letter-spacing:** Large headings (display / hero sizes) should carry negative letter-spacing, ≥ −0.04 em (i.e., `letter-spacing: -0.04em` or tighter). Headings at 0 or positive letter-spacing at large sizes look spaced-out and read as a default CSS reset, not a typographic choice.
- **Line-height:** Body text line-height should sit between 1.4 and 1.8. Headlines may go as low as 1.1. A line-height of exactly 1 (or inherited as 1) on multi-line body text produces overlapping descenders; a line-height above 2 on body feels double-spaced and unfocused.

---

### 3. `color-contrast`

**Concrete rules to apply:**

Use `scripts/contrast.mjs` to get exact ratios. Do not eyeball. The script accepts `#rrggbb`, `#rgb`, and `rgb(r,g,b)` inputs.

```
node scripts/contrast.mjs <fg> <bg>         # normal text (≥4.5:1 required for AA)
node scripts/contrast.mjs <fg> <bg> --large # large text ≥18pt or ≥14pt bold (≥3:1 required)
```

The JSON output is `{ ratio, large, aa, aaa }`. A finding is raised when `aa: false`.

**Pairs to check:**
- Body text on body background (the most common case)
- Card/panel text on the card background (especially tinted card backgrounds like the muted-violet-on-tint pattern common in AI-generated dashboards)
- Button label on button background (hover and default states)
- Placeholder text in form fields on the field background — `#9ca3af` (gray-400) on white is only 2.85:1 and fails AA; this is one of the most common misses
- Disabled text on disabled button/input background
- Link text in body paragraphs against the paragraph background

**Special flags:**
- **Muted-gray-on-tint:** The `gray-400`/`gray-500` + light-tinted-background pattern is the single most common contrast failure in AI-scaffolded UIs. The designer chose a tint for brand feel; the text color was never revisited. Always check this pair when the scanner shows `aiPurpleGradient > 0` or a high `colorCount`.
- **Palette coherence / too-many-hues:** When `colorCount > 12`, inspect the palette visually. More than 5–6 distinct hues in a single-product UI signals palette sprawl — the app looks like it cannot decide what its brand color is. This is a design-system concern, not a contrast failure, so route a palette-sprawl finding to `pillar: "design-system"` with `severity: "low"`.

---

### 4. `layout`

**Concrete rules to apply:**

- **Spacing rhythm:** The app should use a consistent spacing scale (typically 4 px, 8 px, 16 px, 24 px, 32 px, 48 px, 64 px). Inspect the computed margins and paddings on key elements using `chrome-devtools__evaluate_script`. Irregular or one-off spacing values (e.g., `margin: 13px`, `padding: 22px`) indicate the designer or AI was eyeballing rather than following a system.
- **Alignment:** All elements within a section should share clear vertical and horizontal alignment anchors. Look for elements that are slightly misaligned — a heading that starts 2 px to the left of the paragraph below it, or a button that is not flush with the card edge. This is a visual check.
- **Cards-are-lazy:** A layout built entirely of cards — every piece of content wrapped in a rounded, shadowed box — signals the AI defaulted to "card everything" rather than making a layout decision. Cards are appropriate for item collections (e.g., a product grid, a user list). They are inappropriate as the structural primitive for a hierarchy page, a detail view, or a dashboard summary where a table or prose layout would serve better.
- **Nested cards:** Cards inside cards are almost always wrong. They create visual depth without semantic meaning and make the content hierarchy harder to parse. Flag nested cards when they appear.
- **Grid vs. flex:** Horizontal lists of equal-priority items (navigation, feature columns, icon+label pairs) should use CSS Grid or Flexbox with consistent gap. A layout achieving column behavior via `float` or `display: inline-block` is a maintenance and alignment smell.
- **Clear focal hierarchy:** Each screen should have exactly one primary focal point — the thing a new visitor's eye should land on first. If every element competes for attention at equal visual weight (all bold, all large, all colorful), there is no hierarchy. This is a visual check; look at the screenshot from a distance.

---

### 5. `accessibility`

**Concrete rules to apply.**

Consult `references/accessibility-wcag.md` for the full WCAG 2.2 AA checklist. The highest-coverage checks to run in a design-audit pass are:

- **WCAG 1.1.1 Non-text Content:** `missingAlt` from scanner. Any value > 0 is a finding. Supplement with axe rule `image-alt` when a browser surface is available.
- **WCAG 1.4.3 Contrast Minimum:** Covered under the `color-contrast` pillar above. Cross-list any failures here with `wcag: "1.4.3"` on the finding.
- **WCAG 2.1.1 Keyboard:** Tab through every interactive element using the browser surface. Every action available via click must be reachable and activatable via keyboard. This is a visual/interaction check.
- **WCAG 2.4.2 Page Titled:** Evaluate `document.title` for every route. SPAs that do not update the title on route change fail this criterion on every screen after the home page.
- **WCAG 2.4.7 Focus Visible:** Tab through the UI and confirm that the focused element is always visually distinguishable. Removing the browser's default `:focus` outline without replacing it with a visible custom indicator is a common and hard-failing miss.
- **WCAG 3.1.1 Language of Page:** `missingLang: true` from the scanner is a hard failure — the `<html>` element lacks a `lang` attribute. Screen readers cannot infer the correct pronunciation model without it.
- **WCAG 4.1.2 Name, Role, Value:** Check all custom interactive widgets (dropdowns, modals, sliders, tab panels) for ARIA role and label. Run axe rules `aria-required-attr`, `aria-valid-attr-value`, and `button-name` to catch the most common violations.

Level AAA gaps (e.g., WCAG 1.4.6 Enhanced Contrast at 7:1) should be noted as `severity: "low"` or `"info"`, never `"high"`.

---

### 6. `design-system`

**Concrete rules to apply:**

- **Icon coherence:** Visually inspect the icons across the app. All icons in a single app should come from the same icon family (or be custom-designed in a consistent style). Mixing Heroicons solid with Lucide outline with Phosphor thin is a common AI-scaffolding artifact — the AI pulled whatever icon name was closest without checking the family. Flag mixed icon families as a finding.
- **Interactive state coverage:** Every interactive element must have a visually distinct state for each of the following: `default`, `hover`, `focus`, `disabled`, `error`, `loading`, `empty`. Inspect the primary button, the text input, and any data-loading panel. Use the browser's element hover and `:focus` pseudo-state emulation in DevTools to force states. Missing `disabled` styling (disabled button looks identical to active button) is a common miss. Missing `error` and `empty` states for data containers mean the UI has no design for failure.
- **`importantCount` from the scanner:** A high value (> 15 `!important` declarations) signals a CSS specificity war — tokens are being overridden ad-hoc rather than the design system maintaining control. This is a maintainability concern, scored under `design-system`.

---

### 7. `motion`

**Concrete rules to apply:**

- **`prefers-reduced-motion`:** Search the source for `prefers-reduced-motion: reduce` in CSS media queries. When a browser surface is available, emulate the preference via DevTools and navigate through the app — confirm that all animations either stop or simplify. Any animation that continues at full speed when reduced-motion is requested is a finding. WCAG 2.3.3 (AAA) covers this; treat it as `severity: "medium"` because the population of users with vestibular disorders who rely on this preference is significant even if the criterion is technically AAA.
- **Ease-out curves:** Transitions should use `ease-out` or a cubic-bezier that decelerates toward rest (`cubic-bezier(0, 0, 0.2, 1)` is the Material Design standard). Linear transitions on UI elements feel mechanical. `ease-in` (accelerating into rest) feels unnatural for UI feedback. Check the `transition` and `animation` declarations in the scanner's source files or via computed style.
- **No infinite distractions:** Animated backgrounds, looping spinner-like decorations, auto-scrolling testimonial carousels, and pulsing blob shapes that run indefinitely distract from content. Any animation that loops without user action and carries no informational value should either stop or offer a pause control. Flag as `severity: "low"` unless it affects a critical path.

---

### 8. `performance`

**Concrete rules to apply.**

The performance pillar is primarily driven by Lighthouse Core Web Vitals. Thresholds:

| Metric | Good | Needs Improvement | Poor |
|---|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5 s | 2.5–4.0 s | > 4.0 s |
| INP (Interaction to Next Paint) | < 200 ms | 200–500 ms | > 500 ms |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.1–0.25 | > 0.25 |

Run `chrome-devtools__lighthouse_audit` if the surface supports it. Capture the numeric scores for LCP, INP, and CLS. If Lighthouse is not available, note the pillar as `"visual estimate only"` in the determinism note and score conservatively.

Score mapping: all three metrics in the "Good" band = 90–100; any metric in "Needs Improvement" = cap at 75; any metric in "Poor" = cap at 50.

---

## Scoring

Each pillar receives a score from 0 to 100 and a letter grade derived from that score:

| Grade | Score band | Meaning |
|---|---|---|
| A | 90–100 | Clean — no significant issues |
| B | 80–89 | Minor issues; shippable |
| C | 70–79 | Noticeable issues; fix before launch |
| D | 60–69 | Multiple issues hurting quality |
| F | < 60 | Serious problems; blocks a professional release |

**Overall score** is the equal-weight arithmetic mean of all 8 pillar scores. In v1, every pillar carries equal weight (12.5% each). The weights are stored in the run scaffold and can be tuned per-project in a future version by editing the scaffold's `weights` object.

**Score → severity mapping.** Use pillar scores to calibrate finding severity when the direct severity rubric (from `references/judging.md`) is ambiguous:

| Pillar score | Finding severity guidance |
|---|---|
| 0–59 (F) | Multiple `high` findings expected; at least one `high` per pillar this low |
| 60–79 (D/C) | Expect `medium` findings; escalate to `high` if a critical-path flow is affected |
| 80–89 (B) | `low` findings; `medium` if the issue affects a very common screen |
| 90–100 (A) | `info` only, or no findings |

A pillar can score A and still produce a `high` finding if a single serious issue (e.g., a complete contrast failure on a primary CTA) is isolated — the score reflects the pillar's overall health, but each finding is independently severity-rated.

---

## Output 1 — Scorecard at `.sleuth/design/DESIGN-REVIEW.md`

The scorecard is a single Markdown file written after all 8 pillars are judged. It is the human-readable summary for a founder, designer, or PM. Render it with the following section layout, in this order:

### Section layout (exact)

```
# Design Review — <app-name> — <run-id>

**Overall grade: <letter> (<score>/100)**
Run completed: <date and time>
Driving surface: <surface used>
Source path: <confirmed source path>

---

## Pillar Scorecard

| Pillar | Score | Grade | Verdict |
|---|---|---|---|
| ai-slop | ... | ... | one-line summary |
| typography | ... | ... | one-line summary |
| color-contrast | ... | ... | one-line summary |
| layout | ... | ... | one-line summary |
| accessibility | ... | ... | one-line summary |
| design-system | ... | ... | one-line summary |
| motion | ... | ... | one-line summary |
| performance | ... | ... | one-line summary |

---

## AI-Tells Detected

_(List only confirmed tells, not scanner noise. If none, write "None detected.")_

- **<Tell name>:** <one-sentence description of where it appears and why it hurts>
- ...

---

## Top Fixes Ranked by Impact

1. **<Finding ID> — <title>** (pillar: ..., severity: ...) — <one-sentence reason it matters most>
2. ...
_(List up to 5; link to the per-finding brief at `.sleuth/findings/F-NNN-<slug>.md`)_

---

## Determinism Note

Pillars with deterministic scores (backed by script or tool output):
- color-contrast: contrast.mjs + axe
- accessibility: axe, Lighthouse, design-scan missingAlt/missingLang
- performance: Lighthouse LCP/INP/CLS
- ai-slop (partial): design-scan aiPurpleGradient, glassmorphism

Pillars requiring visual judgment (reviewer-assessed from screenshots):
- ai-slop (visual tells): centered-hero, card overuse, nested cards, gradient text
- typography: line length, scale ratio, letter-spacing
- layout: focal hierarchy, alignment, spacing rhythm
- design-system: icon coherence, interactive states
- motion: ease curves, infinite animations

---

## Screenshot Index

| File | Screen |
|---|---|
| `.sleuth/runs/<run-id>/home-hero.png` | Landing / home screen |
| `.sleuth/runs/<run-id>/dashboard-cards.png` | Primary authenticated view |
| ... | ... |
```

### Worked example scorecard (sample app: "Orbita" — a SaaS project-management dashboard)

```
# Design Review — Orbita — 20260604-141500

**Overall grade: C (71/100)**
Run completed: 2026-06-04 14:15:00 PDT
Driving surface: Chrome DevTools MCP (chrome-devtools__navigate_page)
Source path: /Users/dev/orbita/app (confirmed via DevTools → Sources cross-check)

---

## Pillar Scorecard

| Pillar | Score | Grade | Verdict |
|---|---|---|---|
| ai-slop | 55 | F | Purple-to-indigo gradient on every CTA + dark-mesh hero; 2 major tells |
| typography | 78 | C | 5 font families; hero clamp() peaks 7 rem; body line-length 88 ch on 1440 |
| color-contrast | 62 | D | 6 contrast failures; gray-500 on violet-tint card is 3.09:1 — hard WCAG fail |
| layout | 80 | B | Consistent 8px grid; some nested cards on detail view |
| accessibility | 68 | D | 4 missing alt attrs; no lang on <html>; focus ring removed globally |
| design-system | 85 | B | Mixed Heroicons + Lucide; disabled button indistinguishable from active |
| motion | 88 | B | No reduced-motion query; one looping gradient animation in hero |
| performance | 82 | B | LCP 2.1 s; INP 140 ms; CLS 0.08 — all Good except LCP close to threshold |

---

## AI-Tells Detected

- **Purple-to-indigo gradient (primary):** `linear-gradient(135deg, #7c3aed, #6366f1)` applied to every primary button and the hero section background. No other brand hue anchors the palette — this is the AI default, not a deliberate brand choice.
- **Dark-mesh hero:** Full-width hero with `background: #0a0a0f` + SVG radial-gradient blobs, centered text, generic "Supercharge your workflow" H1.

---

## Top Fixes Ranked by Impact

1. **F-042 — Body copy contrast 3.09:1 on violet-tint card** (color-contrast, high) — Fails WCAG 1.4.3 AA; affects every metric card on the primary dashboard screen.
2. **F-039 — Missing lang attribute on <html>** (accessibility, high) — Screen readers cannot infer pronunciation; WCAG 3.1.1 hard failure.
3. **F-035 — Purple-to-indigo gradient as sole brand expression** (ai-slop, medium) — Signals AI-default identity; replace with a purposeful brand hue.
4. **F-044 — Focus ring removed globally** (accessibility, medium) — Keyboard-only users lose all spatial context; WCAG 2.4.7.
5. **F-038 — 5 font families** (typography, low) — Consolidate to ≤ 3; the extra two appear in third-party widget imports.

---

## Determinism Note

Deterministic pillars: color-contrast (contrast.mjs + axe), accessibility (axe + design-scan), performance (Lighthouse).
Visual pillars: ai-slop, typography (scale ratio, line length), layout (focal hierarchy), design-system (icon mix, state coverage), motion (ease curves).

---

## Screenshot Index

| File | Screen |
|---|---|
| `.sleuth/runs/20260604-141500/home-hero.png` | Landing hero — dark mesh background |
| `.sleuth/runs/20260604-141500/dashboard-cards.png` | Dashboard — violet-tint metric cards |
| `.sleuth/runs/20260604-141500/project-detail.png` | Project detail — nested cards visible |
| `.sleuth/runs/20260604-141500/login-form.png` | Login form — placeholder contrast |
```

---

## Output 2 — Fix-Ready Findings

Every design finding written to `.sleuth/findings/F-NNN-<slug>.json` must conform to the finding schema (`schemas/finding.schema.json`). The required fields are `id`, `title`, `type`, `severity`, `repro` (array), and `evidence` (array). Design findings set `type: "design"` and MUST also set `pillar` (one of the 8 enum values). When the finding maps to a WCAG criterion, set `wcag` to the criterion ID string (e.g., `"1.4.3"`). When a specific CSS selector is known, set `selector`.

**Field checklist for design findings:**

| Field | Required? | Notes |
|---|---|---|
| `id` | yes | `F-NNN-<kebab-slug>` |
| `title` | yes | Specific: name the element, the color pair, the exact value |
| `type` | yes | `"design"` |
| `pillar` | yes | One of the 8 enum values |
| `severity` | yes | Per judging rubric + score-band table above |
| `visibility` | yes | `"user-visible"` or `"hidden"` |
| `wcag` | when applicable | WCAG criterion ID — required for all `accessibility` pillar findings |
| `selector` | when known | CSS selector of the violating element |
| `repro` | yes | Ordered steps; each step is a string |
| `evidence` | yes | Screenshot paths + script output; each item is a string |
| `suggestedFix` | yes | Must carry a before→after value (see one-shot-fix rule) |
| `codingAgentPrompt` | yes | Paste-ready prompt for a coding agent |

**The before→after value requirement.** The `suggestedFix` field must express the change as a concrete before→after pair specifying the exact token, color hex, size value, or file change needed. "Improve the contrast" is not a before→after value. "Before: `color: #6b7280` on `background: #f3f0ff` (ratio 3.09). After: `color: #4b5563` on `background: #f3f0ff` (ratio 4.68, AA pass)" is. The coding-agent prompt must be self-contained enough that a fresh agent instance could apply the fix with no further investigation.

---

## One-Shot-Fix Rule

A design finding is considered "done" (ready to commit to `.sleuth/findings/`) only when its `suggestedFix` and `codingAgentPrompt` together are specific enough that a coding agent could apply the fix cold — without opening the browser, without reading the codebase from scratch, and without asking clarifying questions. Concretely:

- The exact color hex, size value, spacing token, or filename is stated.
- The before-state and after-state are both written as literal values, not descriptions.
- The WCAG pass/fail verification step is included (e.g., the `contrast.mjs` command to run and its expected output).
- For multi-file changes, each file is named or the search string to locate it is given.

If the fix cannot yet be made this specific — for example, a layout judgment that requires a designer decision before a dev change — record the finding at `severity: "info"` with a note that it requires designer input, and omit `codingAgentPrompt` until the decision is made.

---

## Avoiding False Positives

The false-positive gate from `references/judging.md` applies to design findings exactly as it does to functional findings. Before committing any design finding, re-examine it against this question: **"Does this genuinely hurt trust, readability, or conversion for the real users of this product?"**

An intentional, well-executed bold choice is not a finding. A purple gradient that is documented as the product's brand color, appears consistently across all surfaces, and is paired with a distinct secondary hue and a clear palette rationale is not an `ai-slop` tell — it is a design decision. A purple gradient that appears because it was the first line Copilot autocompleted for a `bg-gradient` class, appears only on the primary button and the hero, clashes with no other brand hue in the palette, and is identical to the Tailwind starter-template default is a tell.

Apply the same contextual check to typography, layout, and motion findings. A 7-rem hero on a cinematic editorial site is intentional. A 7-rem hero on a B2B project-management dashboard used primarily on laptop screens is a default that was never reconsidered.

Log borderline cases as `severity: "info"` or omit them entirely. Do not inflate the finding count to appear thorough — a short list of high-confidence, actionable findings is more useful than a long list padded with noise.

---

## Worked Example Finding (Complete)

The following JSON was validated with `node scripts/scaffold.mjs validate finding /tmp/df.json` and printed `valid`. The JSON in this document is identical to what was validated.

```json
{
  "id": "F-042-body-copy-contrast-failure",
  "title": "Body copy contrast ratio 3.1:1 fails WCAG 1.4.3 AA on tinted card background",
  "type": "design",
  "pillar": "color-contrast",
  "severity": "high",
  "wcag": "1.4.3",
  "selector": ".card-body p",
  "visibility": "user-visible",
  "repro": [
    "Navigate to the app's dashboard screen at /dashboard.",
    "Locate any metric card in the main grid (e.g., 'Total Revenue').",
    "Inspect the paragraph text inside the card — the label text below the large number.",
    "Note the text color (#6b7280, Tailwind gray-500) and card background (#f3f0ff, a light violet tint).",
    "Run: node scripts/contrast.mjs '#6b7280' '#f3f0ff' — observe ratio 3.09, aa: false."
  ],
  "evidence": [
    ".sleuth/runs/20260604-141500/dashboard-card-contrast.png — screenshot showing metric cards; label text visually washes out against the violet-tinted card surface.",
    "node scripts/contrast.mjs '#6b7280' '#f3f0ff' → {\"ratio\": 3.09, \"large\": false, \"aa\": false, \"aaa\": false} — hard failure at normal text size (14px/400 weight).",
    "axe rule color-contrast flagged 6 instances of .card-body p across the dashboard grid."
  ],
  "suggestedFix": "Before: color: #6b7280 on background: #f3f0ff (ratio 3.09 — fails AA). After: change label text color to #4b5563 (Tailwind gray-600); node scripts/contrast.mjs '#4b5563' '#f3f0ff' → ratio 4.68, aa: true. Alternatively, change the card background to #ffffff; node scripts/contrast.mjs '#6b7280' '#ffffff' → ratio 4.62, aa: true.",
  "codingAgentPrompt": "You are fixing a confirmed design finding (color-contrast, WCAG 1.4.3) in this codebase.\n\nAffected selector: .card-body p\nFile(s) to change: the global stylesheet or Tailwind component that sets .card-body p's color and/or the card background.\n\nCurrent behavior: label text inside metric cards uses color #6b7280 (Tailwind gray-500) on a #f3f0ff violet-tinted card background, producing a contrast ratio of 3.09:1. WCAG 1.4.3 AA requires 4.5:1 for normal-weight text below 18pt.\n\nRequired behavior: label text must achieve at least 4.5:1 against its card background. Two compliant options:\n  Option A — change label text color: replace `color: #6b7280` with `color: #4b5563` (gray-600) → ratio 4.68:1 on #f3f0ff.\n  Option B — change card background: replace `background: #f3f0ff` with `background: #ffffff` (white) → ratio 4.62:1 with gray-500.\nPrefer Option A to preserve the card tint brand choice.\n\nInstructions:\n1. Locate .card-body p in the stylesheet or Tailwind config (search for 'gray-500' or '#6b7280' in card-related components).\n2. Apply Option A: change the text color to #4b5563 (Tailwind: text-gray-600).\n3. Run node scripts/contrast.mjs '#4b5563' '#f3f0ff' and confirm aa: true in the output.\n4. Verify there are no other .card-body variants that inherit gray-500 — check .card-body span and .card-body label as well.\n5. Commit with message: fix(a11y): increase card label contrast to meet WCAG 1.4.3 AA"
}
```

**Validator output:** `valid`

**Why this finding satisfies the one-shot-fix rule:** The `suggestedFix` specifies the exact color pairs (`#6b7280` → `#4b5563`, or background `#f3f0ff` → `#ffffff`), the exact `contrast.mjs` commands to verify both options, and the resulting ratios. The `codingAgentPrompt` names the CSS selector, both candidate files, the search string to locate the declaration, the verification command, and the commit message. A fresh coding agent can apply this fix end-to-end without further investigation.
