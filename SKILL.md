---
name: sleuth
description: Master entry for Sleuth — test/QA/beta-test/security-check a running web app. Routes to the right Sleuth command (scan, test, security, retest) based on the project's phase, or runs the full loop. Trigger on "test my app", "QA this", "beta test", "find bugs", "is my app secure", "what is this app", "check my fix".
---

# Sleuth — Master Router

Drive a running app like a developer and like its real ICP users, find what breaks,
and return fix-ready developer briefs with regression memory.

**Inputs:** path to the app's repo + the URL it's running at (default `http://localhost:3000`).

## Phase detection

Check which `.sleuth/` artifacts exist, then route:

| Condition | Route to |
|---|---|
| No `.sleuth/product-contract.json` | Run full loop: scan → test |
| Contract + personas exist, no `.sleuth/findings/` | `sleuth-test` |
| Findings exist, user asks "did my fix work" / retest | `sleuth-retest` |
| User asks "is it secure" / pentest / auth check | `sleuth-security` |
| User asks "what is this app" / understand only | `sleuth-scan` |

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
Read `references/safety-roe.md`. Confirm the target is `localhost` (or get explicit
approval for another host). Refuse forbidden actions. Write `.sleuth/runs/<run-id>/roe.json`.
`run-id` = `YYYYMMDD-HHMMSS`.

### Phase 1 — Understand
First initialize the workspace: `node scripts/scaffold.mjs init <repo-path>`.
Run `node scripts/detect-stack.mjs <repo-path>` for deterministic structure. Then read
`references/product-contract.md` and draft `.sleuth/product-contract.json`
(what the app does, who it's for, roles, forbidden invariants). Validate:
`node scripts/scaffold.mjs validate product-contract .sleuth/product-contract.json`.

### Phase 2 — Profiles
Read `references/personas.md`. Create 1 developer persona + 3 ICP personas (default)
in `.sleuth/personas/`. Validate each with `scaffold.mjs validate persona`.

### Phase 3 — Drive
Read `references/driving.md`. Developer pass first (exercise + push to limits), then one
pass per ICP persona. Capture screenshots + notes to `.sleuth/runs/<run-id>/`.

### Phase 4 — Judge + brief
Read `references/judging.md` then `references/briefs.md`. Classify + verify each
observation (kill false positives), write validated findings to `.sleuth/findings/F-*.json`,
render `F-*.md` briefs + `SUMMARY.md`.

### Phase 5 — Regression memory
First assemble all confirmed findings into one array file (the regression store reads an array, not the individual `F-*.json` files):
```bash
node -e "const fs=require('fs'),d='.sleuth/findings';const a=fs.readdirSync(d).filter(f=>/^F-.*\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(d+'/'+f,'utf8')));fs.writeFileSync(d+'/_all.json',JSON.stringify(a,null,2))"
node scripts/regression.mjs record .sleuth/regression-memory.json <run-id> .sleuth/findings/_all.json
```
On a re-run, use `regression.mjs plan .sleuth/regression-memory.json` to list prior findings to re-drive, and `node scripts/regression.mjs diff .sleuth/regression-memory.json <run-id> .sleuth/findings/_all.json` to flip fixed ones red→green.
