---
name: sleuth-retest
description: Regression retest — re-drives prior open findings to check if fixes worked. Trigger on "retest", "did my fix work", "regression check", "check the fix", "verify the fix". Requires prior regression memory from a previous Sleuth run.
---

# Sleuth Retest — Regression Check

Re-drive prior open findings and flip fixed ones from red to green.
This command is RUN-SCOPED: it does NOT touch `.sleuth/findings/`; it writes
still-reproducing findings into `.sleuth/runs/<run-id>/findings/` and diffs
that run-scoped array so absent (fixed) findings correctly flip red→green.

**Inputs:** path to the app's repo + running URL (default `http://localhost:3000`).
`run-id` = `YYYYMMDD-HHMMSS`.

## Pre-check — Regression memory
Confirm `.sleuth/regression-memory.json` exists. If missing, there is no prior state
to retest — direct the user to run `$sleuth-test` first.

## Phase 0 — Scope gate
Read `references/safety-roe.md`. Confirm target is `localhost` (or get explicit approval).
Write `.sleuth/runs/<run-id>/roe.json`.

## Phase 1 — Plan
List prior open and regressed findings:
```bash
node scripts/regression.mjs plan .sleuth/regression-memory.json
```
This outputs each finding with its recorded repro steps. Re-drive only these findings.

## Phase 2 — Re-drive
Read `references/driving.md`. For each finding from the plan:
1. Follow the recorded repro steps exactly.
2. Note whether the issue still reproduces or is fixed.
3. Capture screenshots + notes to `.sleuth/runs/<run-id>/`.

## Phase 3 — Assemble run-scoped findings
For each finding that still reproduces, write its JSON to
`.sleuth/runs/<run-id>/findings/F-*.json` (NOT the global `.sleuth/findings/` dir).
Do NOT create or modify any files under `.sleuth/findings/`.

Then assemble a run-scoped array (if no findings still reproduce, this yields `[]`):
```bash
node -e "const fs=require('fs'),d='.sleuth/runs/<run-id>/findings';if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});const a=fs.readdirSync(d).filter(f=>/^F-.*\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(d+'/'+f,'utf8')));fs.writeFileSync('.sleuth/runs/<run-id>/_all.json',JSON.stringify(a,null,2))"
```

## Phase 4 — Diff and flip
```bash
node scripts/regression.mjs diff .sleuth/regression-memory.json <run-id> .sleuth/runs/<run-id>/_all.json
```
Fixed findings flip `open` → `resolved` (red→green). New regressions are flagged.
Because the run-scoped array contains ONLY still-reproducing findings, any finding
absent from the array is correctly treated as resolved.

## Phase 5 — Summary
Update `.sleuth/findings/SUMMARY.md` with:
- Red→green (fixed) findings
- Still-open findings
- Any new regressions introduced

Update `.sleuth/HANDOFF.md` with the red→green retest results.
