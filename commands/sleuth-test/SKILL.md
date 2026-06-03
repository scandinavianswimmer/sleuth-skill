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
Then draft + validate `.sleuth/product-contract.json` per `references/product-contract.md`.

## Phase 0 — Scope gate
Read `references/safety-roe.md`. Confirm target is `localhost` (or get explicit approval).
Write `.sleuth/runs/<run-id>/roe.json`.

## Phase 1 — Profiles
Read `references/personas.md`. Create 1 developer persona + 3 ICP personas in
`.sleuth/personas/`. Validate each:
```bash
node scripts/scaffold.mjs validate persona .sleuth/personas/<name>.json
```

## Phase 2 — Drive
Read `references/driving.md`. Developer pass first (full exercise + push-to-limits
checklist), then one pass per ICP persona. Capture screenshots + notes to
`.sleuth/runs/<run-id>/`.

## Phase 3 — Judge + brief
Read `references/judging.md` then `references/briefs.md`. Classify each observation,
kill false positives, write validated findings to `.sleuth/findings/F-*.json` and
render `F-*.md` briefs + `SUMMARY.md`.

## Phase 4 — Regression memory
Assemble all confirmed findings, then record:
```bash
node -e "const fs=require('fs'),d='.sleuth/findings';const a=fs.readdirSync(d).filter(f=>/^F-.*\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(d+'/'+f,'utf8')));fs.writeFileSync(d+'/_all.json',JSON.stringify(a,null,2))"
node scripts/regression.mjs record .sleuth/regression-memory.json <run-id> .sleuth/findings/_all.json
```
