---
name: sleuth-fix
description: Applies + verifies source-code fixes for prior findings on a reversible git safety branch — the red→green heal loop. Trigger on "fix it", "apply the fixes", "heal my app", "one-shot the fixes", "make Sleuth fix it", "auto-fix the findings". Edits real code; requires prior regression memory from a previous Sleuth run.
---

# Sleuth Fix — Heal Loop

Apply verified fixes for open/regressed findings and flip them red→green.
This command **edits source code** on a dedicated `sleuth/fix-<run-id>` branch. Detail lives in `references/fixing.md`.

**Inputs:** path to the app's repo + running URL (default `http://localhost:3000`). `run-id` = `YYYYMMDD-HHMMSS`.

## Pre-check

1. `.sleuth/regression-memory.json` must exist with at least one `open`/`regressed` finding — else direct the user to run `$sleuth-test` / `$sleuth-design` / `$sleuth-security` first.
2. Target must be a git repo with a **clean working tree** (`git status --porcelain` empty). If dirty, stop and ask the user to commit or stash.

## Phase 0 — Scope gate + git safety

Read `references/safety-roe.md`. Confirm `localhost` or get explicit approval. Then:

```bash
RUN_ID=$(date -u '+%Y%m%d-%H%M%S')
git -C /path/to/target-repo checkout -b "sleuth/fix-${RUN_ID}"
```

Write `.sleuth/runs/<run-id>/roe.json` with `appliesCodeChanges: true`. All work stays on this branch. Never `git add -A`; name only changed source files. `.sleuth/` must never be staged. → `references/fixing.md` Step 0.

## Phase 1 — Queue + baseline

```bash
node scripts/regression.mjs plan .sleuth/regression-memory.json
node scripts/verify-commands.mjs /path/to/target-repo
```

Keep findings with a fix payload (`codingAgentPrompt`, `suggestedFix`, or design before→after); others → **skipped** (`"no concrete fix payload"`). Sort: `critical` → `high` → `medium` → `low`. Run each baseline-green verify command once; pre-existing failures are not charged to the fixer.

Flags: `--review` (show diff, wait for OK), `--severity <min>`, `--only <id>`. → `references/fixing.md` Steps 1–2.

## Phase 2 — Heal loop (per finding, severity order)

1. **Apply** — locate real source file (source reconciliation per `references/product-contract.md`). Apply minimal change: `codingAgentPrompt` › `suggestedFix` › design before→after. No unrelated edits.
2. **Static verify** — re-run baseline-green commands. New failure = static fail.
3. **Dynamic verify** — re-drive `repro` steps per `references/driving.md`. One re-drive ceiling for paid endpoints.
4. **Decide:** both pass → commit `"fix(sleuth): <title> [<id>]"`, mark **fixed**, capture SHA. Either fails → one retry; if retry fails → `git checkout -- .`, mark **needs-human**, record failure reason.

→ `references/fixing.md` Step 3.

## Phase 3 — Diff (flip red→green)

Write `F-*.json` for `needs-human`/`skipped` findings only (fixed findings must be absent to trigger the green flip). Assemble `_all.json`, then diff:

```bash
node scripts/regression.mjs diff .sleuth/regression-memory.json <run-id> .sleuth/runs/<run-id>/_all.json
```

→ `references/fixing.md` Step 4.

## Phase 4 — Report

Write `.sleuth/fixes/FIX-REPORT.md` (counts table + per-finding table + "Review This Fix Branch" git commands). Update `SUMMARY.md` and `HANDOFF.md`. Do NOT push or open a PR without explicit user confirmation. → `references/fixing.md` Step 5.

---

After review, merge `sleuth/fix-<run-id>` yourself, or run `$sleuth-retest` to re-confirm.
