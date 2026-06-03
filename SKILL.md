---
name: sleuth
description: Use when a developer wants to test, QA, beta-test, or security-check a running web app they built. Drives the app with computer-use as a developer and as ICP beta-testers, then returns fix-ready bug/security/UX briefs. Trigger on "test my app", "find bugs", "beta test", "is my app secure", "QA this". Requires a locally running app (or an explicitly approved URL).
---

# Sleuth

Drive a running app like a developer and like its real ICP users, find what breaks,
and return fix-ready developer briefs with regression memory.

**Inputs:** path to the app's repo + the URL it's running at (default `http://localhost:3000`).

Run these phases in order. Load the named reference file before each reasoning-heavy phase.

## Phase 0 — Scope gate (safety)
Read `references/safety-roe.md`. Confirm the target is `localhost` (or get explicit
approval for another host). Refuse forbidden actions. Write `.sleuth/runs/<run-id>/roe.json`.
`run-id` = `YYYYMMDD-HHMMSS`.

## Phase 1 — Understand
First initialize the workspace: `node scripts/scaffold.mjs init <repo-path>`.
Run `node scripts/detect-stack.mjs <repo-path>` for deterministic structure. Then read
`references/product-contract.md` and draft `.sleuth/product-contract.json`
(what the app does, who it's for, roles, forbidden invariants). Validate:
`node scripts/scaffold.mjs validate product-contract .sleuth/product-contract.json`.

## Phase 2 — Profiles
Read `references/personas.md`. Create 1 developer persona + 3 ICP personas (default)
in `.sleuth/personas/`. Validate each with `scaffold.mjs validate persona`.

## Phase 3 — Drive
Read `references/driving.md`. Developer pass first (exercise + push to limits), then one
pass per ICP persona. Capture screenshots + notes to `.sleuth/runs/<run-id>/`.

## Phase 4 — Judge + brief
Read `references/judging.md` then `references/briefs.md`. Classify + verify each
observation (kill false positives), write validated findings to `.sleuth/findings/F-*.json`,
render `F-*.md` briefs + `SUMMARY.md`.

## Phase 5 — Regression memory
`node scripts/regression.mjs record .sleuth/regression-memory.json <run-id> <findings.json>`.
On a re-run, use `regression.mjs plan` to re-drive prior findings and `regression.mjs diff`
to flip fixed ones red→green.
