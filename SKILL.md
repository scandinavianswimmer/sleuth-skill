---
name: sleuth
description: Master entry for Sleuth — test/QA/beta-test/security-check a running web app. Routes to the right Sleuth command (scan, test, security, retest) based on the project's phase, or runs the full loop. Trigger on "test my app", "QA this", "beta test", "find bugs", "is my app secure", "what is this app", "check my fix".
---

# Sleuth — Master Router

Drive a running app like a developer and like its real ICP users, find what breaks,
and return fix-ready developer briefs with regression memory.

**Inputs:** path to the app's repo + the URL it's running at (default `http://localhost:3000`).

## Phase detection

Check which `.sleuth/` artifacts exist, then route (evaluate top-to-bottom; first match wins):

| Condition | Route to |
|---|---|
| No `.sleuth/product-contract.json` (never tested) | Run full loop: scan → test |
| User asks "is it secure" / security / vuln / auth check (any time) | `sleuth-security` |
| User asks "what is this app" / understand only | `sleuth-scan` |
| Findings exist AND user asks "did my fix work" / "verify the fix" / "check the fix" | `sleuth-retest` |
| Contract + personas exist; user wants a test pass ("test my app", "test again", "new features shipped", or any test request not matching the fix-check row above) | `sleuth-test` |

Read `references/master-plan.md` for the full routing decision table.

## The five commands

- **`$sleuth`** — this router; auto-detects phase and delegates.
- **`$sleuth-scan`** — understand the app only (no driving). Builds Product Contract + ICP summary.
- **`$sleuth-test`** — full beta test: personas → drive → judge → briefs → regression record.
- **`$sleuth-security`** — security-focused drive: auth, IDOR, role escalation, missing headers.
- **`$sleuth-retest`** — regression retest: re-drive prior findings, flip fixed ones green.

## Full loop (first-ever run, no `.sleuth/` state)

Run these phases in order. Load the named reference file before each reasoning-heavy phase.

### Phase 0 — Scope gate (safety)
Read `references/safety-roe.md` (see Cost & side-effects section). Confirm the target is `localhost` (or get explicit approval). Refuse forbidden actions. Write `.sleuth/runs/<run-id>/roe.json`. `run-id` = `YYYYMMDD-HHMMSS`.

### Phase 1 — Understand
Initialize: `node scripts/scaffold.mjs init <repo-path>`. Run `node scripts/detect-stack.mjs <repo-path>`. Locate the real running source first (references/product-contract.md — handles target dir ≠ served app; records `app.sourceNote`). Draft + validate `.sleuth/product-contract.json`.

### Phase 2 — Profiles
Read `references/personas.md`. Create 1 developer persona + 3 ICP personas (default)
in `.sleuth/personas/`. Validate each with `scaffold.mjs validate persona`.

### Phase 3 — Drive
Read `references/driving.md`. Pick driving surface per `references/browser-tooling.md`. Developer pass first (exercise + push to limits), then one pass per ICP persona. Correlate failures with backend logs/source. Capture screenshots + notes to `.sleuth/runs/<run-id>/`. For AI grading/eval apps, apply `references/recipes/prompt-injection-grading.md`.

### Phase 4 — Judge + brief
Read `references/judging.md` then `references/briefs.md`. Set each finding's `visibility`; surface UNVERIFIED capabilities. Kill false positives, write findings to `.sleuth/findings/F-*.json`, render `F-*.md` briefs + `SUMMARY.md`. Write `.sleuth/HANDOFF.md`.

### Phase 5 — Regression memory
Assemble findings into `_all.json` (regression store reads an array):
```bash
node -e "const fs=require('fs'),d='.sleuth/findings';const a=fs.readdirSync(d).filter(f=>/^F-.*\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(d+'/'+f,'utf8')));fs.writeFileSync(d+'/_all.json',JSON.stringify(a,null,2))"
node scripts/regression.mjs record .sleuth/regression-memory.json <run-id> .sleuth/findings/_all.json
```
After fixes: invoke **$sleuth-retest** to re-drive and flip fixed findings red→green.
