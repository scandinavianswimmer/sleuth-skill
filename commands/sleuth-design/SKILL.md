---
name: sleuth-design
description: Full 8-pillar UI/design audit of your running app. Flags AI-slop tells, WCAG/ADA fails, and visual regressions; delivers one-shot fix briefs. Trigger on "review my design", "does this look AI-made", "make it not look AI", "a11y audit", "is it accessible", "WCAG", "ADA", "design feedback", "audit my UI".
---

# Sleuth Design — 8-Pillar UI + Accessibility Audit

Full design audit: AI-slop tells, WCAG accessibility, visual polish, and UX consistency. Each finding carries a before→after fix payload.

**Inputs:** repo path + running URL (default `http://localhost:3000`).
`run-id` = `YYYYMMDD-HHMMSS`.

## Phase 0 — Scope gate

Read `references/safety-roe.md` (incl. Cost & side-effects). Confirm target is `localhost` OR user has explicitly approved the host in writing. Stop and ask if unclear. Write `.sleuth/runs/<run-id>/roe.json`.

## Phase 1 — Understand

Confirm driving surface per `references/browser-tooling.md`. Run:
```bash
node scripts/scaffold.mjs init <repo-path>
```
Locate the real running source (may differ from served app; record `app.sourceNote`). Draft + validate the Product Contract per `references/product-contract.md` before proceeding.

## Phase 2 — Deterministic pass

```bash
node scripts/design-scan.mjs <repo-path>
```
Static analysis for AI-slop tells (per `references/ai-slop-tells.md`): generic shadows, default border-radii, stock gradients, identical component clones, filler placeholder text.

Then, where the chrome-devtools surface is available:
- Run Lighthouse (performance + accessibility categories).
- Run axe a11y snapshot and capture violations.

```bash
node scripts/contrast.mjs <fg> <bg>          # WCAG AA check (normal text)
node scripts/contrast.mjs <fg> <bg> --large  # WCAG AA large text
```
Sample at least 3 representative text/background pairs from the live UI.

## Phase 3 — Capture

Screenshot each key screen (home, primary flow, empty state, error state) to `.sleuth/runs/<run-id>/`. Use the chrome-devtools or playwright surface per `references/browser-tooling.md`.

## Phase 4 — Judge + scorecard

Read `references/design-review.md` (8-pillar orchestrator + scorecard format).
Read `references/ai-slop-tells.md`, `references/accessibility-wcag.md`, `references/judging.md`, `references/briefs.md`.

Score all 8 pillars. For each failing pillar write findings to `.sleuth/findings/F-*.json` with `type: design` and a before→after value (the one-shot fix payload). Render `F-*.md` briefs.

Write `.sleuth/design/DESIGN-REVIEW.md` with the full scorecard table + per-pillar narrative.

Accessibility findings must cite the WCAG success criterion (e.g. `1.4.3 Contrast (Minimum)`).

## Phase 5 — Record + handoff

Assemble `_all.json`:
```bash
node -e "const fs=require('fs'),d='.sleuth/findings';const a=fs.readdirSync(d).filter(f=>/^F-.*\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(d+'/'+f,'utf8')));fs.writeFileSync(d+'/_all.json',JSON.stringify(a,null,2))"
node scripts/regression.mjs record .sleuth/regression-memory.json <run-id> .sleuth/findings/_all.json
```

Write/update `.sleuth/HANDOFF.md` linking the DESIGN-REVIEW.md scorecard per `references/briefs.md`.

---

> For a quick design check during a functional run, `$sleuth-test` does a light sweep; this command is the full 8-pillar audit.
