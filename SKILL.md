---
name: sleuth
description: Master entry for Sleuth — test/QA/beta-test/security-check a running web app. Routes to the right Sleuth command based on phase. Trigger on "test my app", "QA this", "beta test", "find bugs", "is my app secure", "what is this app", "check my fix", "fix it", "heal my app".
---

# Sleuth — Master Router

Drive a running app like a developer and its real ICP users, find what breaks,
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
| Findings exist AND user asks "fix it" / "apply the fixes" / "heal my app" / "auto-fix" / "one-shot the fixes" | `sleuth-fix` |
| User asks to review/audit design, "does it look AI-made", a11y/WCAG/ADA, accessibility feedback | `sleuth-design` |
| Contract + personas exist; user wants a test pass ("test my app", "test again", "new features shipped", or any test request not matching the rows above) | `sleuth-test` |

Read `references/master-plan.md` for the full routing decision table.

## The seven commands

- **`$sleuth`** — this router; auto-detects phase and delegates.
- **`$sleuth-scan`** — understand the app only (no driving). Builds Product Contract + ICP summary.
- **`$sleuth-test`** — full beta test: personas → drive → judge → briefs → regression record.
- **`$sleuth-security`** — security-focused drive: auth, IDOR, role escalation, missing headers.
- **`$sleuth-retest`** — regression retest: re-drive prior findings, flip fixed ones green.
- **`$sleuth-design`** — 8-pillar UI/design + WCAG 2.2 AA audit; AI-slop tells + fix briefs → `.sleuth/design/DESIGN-REVIEW.md`.
- **`$sleuth-fix`** — applies + verifies fixes on a reversible `sleuth/fix-<run-id>` branch; produces `.sleuth/fixes/FIX-REPORT.md`; flips findings red→green.

## Full loop (first-ever run, no `.sleuth/` state)

Run phases in order; load the named reference before each reasoning-heavy phase.

### Phase 0 — Scope gate
Read `references/safety-roe.md`. Confirm `localhost` (or get explicit approval). Write `.sleuth/runs/<run-id>/roe.json`. `run-id` = `YYYYMMDD-HHMMSS`.

### Phase 1 — Understand
`node scripts/scaffold.mjs init <repo-path>` + `node scripts/detect-stack.mjs <repo-path>`. Locate real source (see references/product-contract.md). Draft + validate `.sleuth/product-contract.json`.

### Phase 2 — Profiles
Read `references/personas.md`. Create 1 developer + 3 ICP personas in `.sleuth/personas/`. Validate with `scaffold.mjs validate persona`.

### Phase 3 — Drive
Read `references/driving.md` + `references/browser-tooling.md`. Developer pass first, then one ICP pass each. Capture screenshots + notes to `.sleuth/runs/<run-id>/`. For AI grading apps apply `references/recipes/prompt-injection-grading.md`.

### Phase 4 — Judge + brief
Read `references/judging.md` + `references/briefs.md`. Kill false positives, write `.sleuth/findings/F-*.json`, render `F-*.md` briefs + `SUMMARY.md`. Write `.sleuth/HANDOFF.md`.

### Phase 5 — Regression memory
Assemble findings into `_all.json`:
```bash
node -e "const fs=require('fs'),d='.sleuth/findings';const a=fs.readdirSync(d).filter(f=>/^F-.*\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(d+'/'+f,'utf8')));fs.writeFileSync(d+'/_all.json',JSON.stringify(a,null,2))"
node scripts/regression.mjs record .sleuth/regression-memory.json <run-id> .sleuth/findings/_all.json
```
After fixes: invoke **$sleuth-retest** to re-drive.
