---
name: sleuth-test
description: Full beta test of a running web app. Drives the app as a developer and as ICP personas, judges findings, writes briefs, and records regression memory. Trigger on "test my app", "beta test", "find bugs", "QA this", "try to break my app". Requires a running app URL.
---

# Sleuth Test — Full Beta Test

Drive the running app as a developer and as ICP personas. Judge findings, write
fix-ready briefs, and record regression memory.

**Inputs:** path to the app's repo + running URL (default `http://localhost:3000`).
`run-id` = `YYYYMMDD-HHMMSS`.

## Pre-check — Product Contract
If `.sleuth/product-contract.json` is missing, run the scan steps first:
```bash
node scripts/scaffold.mjs init <repo-path>
node scripts/detect-stack.mjs <repo-path>
```
Then draft + validate `.sleuth/product-contract.json` per `references/product-contract.md`. **Locate the real running source first** — target dir may differ from served app; record `app.sourceNote`.

## Phase 0 — Scope gate
Read `references/safety-roe.md` (see Cost & side-effects for paid AI calls). Confirm target is `localhost` (or get explicit approval). Write `.sleuth/runs/<run-id>/roe.json`.

## Phase 1 — Profiles
Read `references/personas.md`. Create 1 developer persona + 3 ICP personas in
`.sleuth/personas/`. Validate each:
```bash
node scripts/scaffold.mjs validate persona .sleuth/personas/<name>.json
```

## Phase 2 — Drive
Read `references/driving.md`. Pick driving surface per `references/browser-tooling.md` (surface selection + Playwright availability). Developer pass first (full exercise + push-to-limits checklist including friction hunting), then one pass per ICP persona. Correlate failures with backend logs/source. Capture screenshots + notes to `.sleuth/runs/<run-id>/`. For AI grading/eval apps, run `references/recipes/prompt-injection-grading.md` during this phase.

## Phase 2b — Lightweight design/a11y sweep
After functional + ICP passes, run a quick sweep — surface worst offenders only; do NOT run the full 8-pillar audit (that's `$sleuth-design`).

1. **Static tells** — `node scripts/design-scan.mjs <repo>` (AI-slop typography, spacing, layout red flags).
2. **Contrast** — `node scripts/contrast.mjs <fg> <bg>` on the primary body-text/background pair.
3. **One-screen visual check** — scan for top AI-slop tells + any critical WCAG fail: missing `alt`/labels, unreadable contrast, tiny tap targets.
4. **Surface only the worst** — log findings as `type: design`; set `pillar` + `visibility`. Skip minor polish issues.
5. End sweep note: "For a full design + accessibility audit, run `$sleuth-design`."

## Phase 3 — Judge + brief
Read `references/judging.md` then `references/briefs.md`. Set each finding's `visibility` (user-visible vs hidden); surface UNVERIFIED capabilities. Classify each observation, kill false positives, write validated findings to `.sleuth/findings/F-*.json` and render `F-*.md` briefs + `SUMMARY.md`. Write `.sleuth/HANDOFF.md` (master artifact per `references/briefs.md`).

## Phase 4 — Regression memory
This run's findings replace the prior set — clear stale `.sleuth/findings/F-*.json`
(and `_all.json`) from any earlier run before writing this run's findings, so
`_all.json` reflects only the current run.

Assemble all confirmed findings, then record:
```bash
node -e "const fs=require('fs'),d='.sleuth/findings';const a=fs.readdirSync(d).filter(f=>/^F-.*\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(d+'/'+f,'utf8')));fs.writeFileSync(d+'/_all.json',JSON.stringify(a,null,2))"
node scripts/regression.mjs record .sleuth/regression-memory.json <run-id> .sleuth/findings/_all.json
```
