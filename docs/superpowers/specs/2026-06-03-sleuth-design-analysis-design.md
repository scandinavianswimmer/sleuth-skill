# Sleuth UI/Design Analysis — Design

**Date:** 2026-06-03
**Status:** Draft (awaiting user review)
**Repo:** `~/sleuth-skill` (the Sleuth Codex Agent Skill bundle)

## 1. Summary

Add a **UI / design-quality + accessibility analysis dimension** to Sleuth. A new
command **`$sleuth-design`** deeply audits the *running* app's visual design and
accessibility; a trimmed sweep is folded into **`$sleuth-test`** so every run catches
the worst offenders. It finds "things that scream AI made this," judges craft
(typography, color, layout, motion, consistency), and checks **WCAG 2.2 AA / ADA** —
then emits **fix-ready design findings** whose briefs carry a concrete **before→after
value**, precise enough for a coding agent to **one-shot the fix**, plus a graded
**DESIGN-REVIEW scorecard**.

It reuses Sleuth's existing spine end-to-end: the finding → brief → SUMMARY → HANDOFF
→ regression pipeline, browser-surface-agnostic driving, source reconciliation, the
`visibility` severity model, and backend/source correlation.

**Decisions locked in brainstorming:**
- Packaging: **dedicated `$sleuth-design` command + lightweight pass in `$sleuth-test`** (packaging was "open" → recommended shape taken).
- Fix ambition: **one-shot-ready briefs + scorecard now**; the tool-wide auto-apply+re-verify `$sleuth-fix` heal loop is a **separate follow-on spec**.
- Coverage: **full suite** (all 8 pillars, incl. motion + Lighthouse perf/CWV).

## 2. Goals & non-goals

### Goals
- A dedicated deep design/a11y audit command and a baseline sweep in the test command.
- Detect "screams-AI" design tells, judge craft across 8 pillars, and check WCAG 2.2 AA.
- Hybrid evaluation: **deterministic signals under visual taste judgment**.
- Output a graded **DESIGN-REVIEW.md** scorecard + **fix-ready design findings** with a
  before→after value and a paste-ready coding-agent prompt (the one-shot-fix payload).
- Reuse the existing Sleuth pipeline (findings/briefs/SUMMARY/HANDOFF/regression).

### Non-goals (this spec)
- **No auto-apply/heal loop** (`$sleuth-fix`) — that is the next spec.
- No new visual *design generation* (Sleuth critiques; it does not redesign).
- No dependency on Claude-only skills at runtime — their knowledge is **distilled** into
  Sleuth's own self-contained references.
- No bespoke pixel-diff/screenshot-regression engine in v1 (regression memory tracks
  findings by fingerprint, as today).

## 3. The 8 pillars (full suite)

1. **AI-slop tells** — violet/purple gradients, centered hero on dark mesh, three equal
   feature cards, blanket glassmorphism, Inter + slate-900 default, emoji bullets,
   perfectly-even spacing everywhere, reflexive infinite micro-animation, generic hero
   iconography, lorem-ish filler.
2. **Typography & readability** — ≤3 font families, type-scale ratio ≥1.25, body line
   length 65–75ch, no all-caps body, hero clamp() max ≤6rem, display letter-spacing
   ≥ −0.04em, sane line-height, weight contrast for hierarchy.
3. **Color, contrast & palette** — WCAG contrast (computed), the "muted-gray-on-tint"
   readability tell, palette coherence (too many hues / muddy), semantic color use.
4. **Layout, spacing & hierarchy** — spacing rhythm, alignment, card overuse / nested
   cards, grid-vs-flex misuse, cramped vs loose, clear focal hierarchy.
5. **Accessibility / ADA (WCAG 2.2 AA)** — text alternatives, form labels, contrast,
   keyboard operability, visible focus, landmarks/headings order, `lang`, ARIA validity,
   target size (2.2). The legal/ADA pillar.
6. **Design-system consistency** — icon-set coherence (one family/weight/grid),
   component consistency, and **interactive-state coverage** (hover / focus / disabled /
   error / loading / empty).
7. **Motion & micro-interactions** — `prefers-reduced-motion` support, ease-out curves,
   no distracting infinite loops, intentional vs reflexive reveal.
8. **Performance / Core Web Vitals** — Lighthouse LCP/INP/CLS + obvious smells
   (unoptimized images, layout shift, render-blocking).

## 4. How it evaluates — hybrid (deterministic under taste)

### Deterministic layer (use when the surface allows it)
- **Lighthouse** (perf / a11y / best-practices) and **axe a11y snapshot** via the
  `chrome-devtools-mcp` tools (`lighthouse_audit`, `take_snapshot`, `evaluate_script`,
  `list_console_messages`). → pillars 5, 8 and the measurable parts of 2, 3.
- **`scripts/contrast.mjs`** (NEW, zero-dep) — WCAG contrast-ratio math (relative
  luminance per WCAG 2.x) from two colors, with an AA/AAA pass/fail verdict for
  normal/large text. So the agent never miscomputes a ratio.
- **`scripts/design-scan.mjs`** (NEW, zero-dep) — static source tells from the repo:
  font-family count, distinct hardcoded-color sprawl, z-index magic numbers
  (e.g. 999/9999), `!important` density, missing `alt=`/`<html lang>`, ALL-CAPS body
  candidates, blanket `backdrop-filter`. A cheap pre-pass that seeds findings before
  driving. → pillars 1, 2, 3, 5, 6.

### Visual taste layer
- The agent reads screenshots of each key screen (reusing the run's captured shots plus
  fresh per-screen shots) and judges pillars **1, 4, 6, 7** and the subjective parts of
  2/3 against the distilled rules in the references. This is where "screams AI" lives.

### Graceful degradation
- Per `references/browser-tooling.md`: if Lighthouse/axe (chrome-devtools-mcp) aren't
  available (e.g., OS computer-use only), fall back to visual judgment + `design-scan.mjs`
  + `contrast.mjs` on sampled colors, and **note reduced determinism** in the scorecard.

## 5. Output — built for one-shot fixes

### Scorecard: `.sleuth/design/DESIGN-REVIEW.md`
- Each pillar **scored 0–100 + letter grade**, plus an **overall grade**.
- A prominent **"AI-tells detected"** list (which tells, where, screenshot ref).
- Per-pillar evidence (screenshot paths) and the **top fixes ranked by impact**.
- Determinism note (which pillars were measured vs visually judged).

### Fix-ready design findings (the one-shot payload)
- Written as normal findings JSON (`.sleuth/findings/F-*.json`) with `type: design`,
  plus `visibility`, `severity`, and new optional fields `pillar`, `wcag`, `selector`.
- Each brief states: the exact **element/component + file** (via source reconciliation +
  reading `/src`), the **rule violated**, and a concrete **before→after value**:
  - *"body `#9CA3AF` on `#F9FAFB` = 2.8:1 (fails AA) → `#374151` = 7.4:1 (AA pass)."*
  - *"hero `clamp(3rem, 8vw, 11rem)` → cap at `6rem`."*
  - *"font families: 4 (Inter, Roboto, Poppins, Lato) → consolidate to ≤2."*
- Plus a paste-ready **coding-agent prompt** that names the file(s), the wrong value, the
  target value, and asks for the change + a check.
- Findings flow into `SUMMARY.md`, `HANDOFF.md` (the scorecard is linked under Coverage),
  and regression memory like every other finding.

### Severity mapping (reuse `judging.md` + visibility)
- WCAG **A/AA** violation (ADA/legal exposure) → high (user-visible if it blocks AT users).
- "Screams-AI" tell that materially hurts trust/conversion → medium; cosmetic-only → low.
- Contrast failure on body text → high (readability + ADA). Decorative-only → low.

## 6. Schema, scripts, references, wiring

### Schema (`schemas/finding.schema.json` + `test/schemas.test.mjs`)
- Add `design` to the `type` enum: `[bug, security, ux-friction, design, expected]`.
- Add optional `pillar` (enum of the 8 pillar keys), optional `wcag` (string, e.g.
  `"1.4.3"`), optional `selector` (string). All optional → existing findings still valid.
- Extend the schema test to assert the new enum value + the optional fields' presence.

### New scripts (zero-dep Node ESM, TDD, like the others)
- `scripts/contrast.mjs` — `ratio(c1, c2)` + `verdict(ratio, {large})` (AA/AAA pass/fail),
  parsing hex and `rgb()`/`rgba()`. Unit-tested against known pairs (e.g. #000/#fff = 21:1).
- `scripts/design-scan.mjs` — `scanDesign(root)` → static tells JSON (fontFamilies[],
  colorCount, zIndexMagic[], importantCount, missingAlt, missingLang, allCapsBody,
  glassmorphismCount). Unit-tested against synthetic fixtures, like `detect-stack`.

### New references (self-contained, distilled from the design skills)
- `references/design-review.md` — orchestrator: the 8-pillar procedure, how to score each,
  when to use deterministic vs visual, how to write the scorecard, the one-shot brief format.
- `references/ai-slop-tells.md` — the catalog of "screams AI" patterns, each with the tell,
  why it reads as AI, and the corrective (the before→after).
- `references/accessibility-wcag.md` — WCAG 2.2 AA checklist (POUR), which checks are
  deterministic (Lighthouse/axe/contrast.mjs) vs visual, and how to write a11y findings
  (with `wcag` success-criterion ids + CWE where relevant).

### Commands
- **NEW `commands/sleuth-design/SKILL.md`** (`name: sleuth-design`, own `agents/openai.yaml`):
  scope-gate → confirm running URL + surface (browser-tooling) → ensure/locate source +
  Product Contract → run `design-scan.mjs` + Lighthouse/axe where available → drive the
  key screens capturing screenshots → judge the 8 pillars (deterministic + visual) →
  write `DESIGN-REVIEW.md` + `type: design` findings + briefs → SUMMARY/HANDOFF →
  regression record. Trigger description: "review my design / does this look AI-made /
  a11y audit / is it accessible / WCAG / ADA / design feedback / make it not look AI."
- **EDIT `commands/sleuth-test/SKILL.md`**: add a **lightweight design/a11y sweep** — run
  `design-scan.mjs` + a contrast check on primary text + the top AI-tells + critical WCAG
  fails (one screen pass), surfacing the worst offenders as `design` findings without the
  full 8-pillar depth.

### Router & docs
- **`SKILL.md` (master)** + **`references/master-plan.md`**: route design/a11y asks to
  `$sleuth-design`; add the phase row ("user wants design/a11y review" → `$sleuth-design`).
- **`references/briefs.md`**: HANDOFF "Coverage" links `DESIGN-REVIEW.md` when present.
- **`README.md`**: document `$sleuth-design`, the scorecard artifact, the new refs/scripts,
  and the Lighthouse/axe-when-available note.
- **`install.sh`**: no change expected (`cp -R scripts references` already fan out the new
  files); verify the new command folder + scripts install self-contained.

## 7. Success criteria

1. `$sleuth-design` on a vibe-coded app produces `.sleuth/design/DESIGN-REVIEW.md` with
   per-pillar scores + overall grade and a populated "AI-tells detected" list.
2. Deterministic WCAG **contrast** results appear (via `contrast.mjs` / Lighthouse) with
   real ratios, and at least one **a11y finding** carries a `wcag` success-criterion id.
3. ≥3 **fix-ready `type: design` findings**, each with a concrete **before→after value** +
   coding-agent prompt — precise enough to one-shot the CSS/component change.
4. **No false AI-tell positives** on a genuinely well-designed control page.
5. The light sweep in `$sleuth-test` surfaces the worst design/a11y offenders on a normal
   test run without running the full 8-pillar audit.
6. `contrast.mjs` and `design-scan.mjs` are unit-tested; full suite stays green; all
   SKILL.md files stay within budget (desc < 500, file < 4000); installer self-contained.

## 8. Testing approach

- **`contrast.mjs`**: node:test against known pairs — #000/#fff = 21:1; a failing
  gray-on-tint pair < 4.5:1; large-text 3:1 boundary; rgb()/hex parsing.
- **`design-scan.mjs`**: node:test against synthetic repos (a CSS with 4 font families +
  z-index 9999 + `!important` spam; JSX with a missing `alt`; HTML missing `lang`) → assert
  each tell is reported; a clean fixture → assert no false tells.
- **Schema**: validate a `type: design` finding with `pillar`/`wcag`/`selector` → valid;
  an invalid `pillar`/`type` enum → fails.
- **References/commands**: validated via a worked `DESIGN-REVIEW.md` example + the existing
  installer dry-run + budget checks. A worked design finding JSON must validate.

## 9. Open questions / deferred

- The tool-wide **`$sleuth-fix` auto-apply+re-verify heal loop** (one-shotting fixes
  end-to-end) — its own spec next.
- Screenshot/pixel **visual-regression** across runs — deferred (regression memory tracks
  findings by fingerprint for now).
- Exact pillar **weighting** for the overall grade — start equal-weight, documented in
  `design-review.md`, tune later.
- Framework-specific component audits (e.g., deep shadcn/Radix state checks) — v1 uses the
  generic state-coverage checklist; framework-specific recipes can follow.
