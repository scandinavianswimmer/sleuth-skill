# Fixing Reference Playbook

This playbook is the authoritative procedure for `$sleuth-fix`. The command applies targeted source-code fixes for prior open findings, verifies each fix statically and dynamically, commits passing fixes to a dedicated branch, and flips them red→green in the regression memory. Read this document in full before taking any action.

---

## Step 0 — Git Safety (Non-Negotiable, Run First)

Before touching the target repo in any way, confirm the working tree is clean:

```bash
git -C /path/to/target-repo status --porcelain
```

If the output is non-empty, **STOP**. Do not proceed. Tell the user:

> The target repo has uncommitted or unstaged changes. Please commit or stash them before running `$sleuth-fix`, then try again.

Only when the working tree is clean, capture the run ID and create the fix branch:

```bash
RUN_ID=$(date -u '+%Y%m%d-%H%M%S')
git -C /path/to/target-repo checkout -b "sleuth/fix-${RUN_ID}"
```

All subsequent work in this session happens on `sleuth/fix-${RUN_ID}`. Never apply edits, stage files, or commit on the user's original branch or `main`/`master`.

`.sleuth/` must never be staged. Ensure the target repo's `.gitignore` includes `.sleuth/` (add it silently if absent — do not commit that `.gitignore` change separately; include it in the first finding commit only if `.sleuth/` was not already ignored). When staging and committing, name only the actual source files changed. Never run `git add -A` or `git add .`.

---

## Step 1 — Build the Fix Queue

List open and regressed findings that have prior recorded repro steps:

```bash
node scripts/regression.mjs plan .sleuth/regression-memory.json
```

The output is the set of findings whose `status` is `open` or `regressed`. From this set, keep only findings that carry at least one concrete fix payload:

- `codingAgentPrompt` — prose instructions for a coding agent.
- `suggestedFix` — a human-readable description of the required change.
- For design findings: a before→after value pair plus either a `selector` or a `route` + `file`.

Findings that have none of these fields cannot be automatically fixed. Record them immediately as **skipped** with reason `"no concrete fix payload"`.

### Ordering

Sort the remaining findings in severity order before processing: `critical` → `high` → `medium` → `low`. Process them in that order so the most impactful fixes land first and, if the session is interrupted, the most important work is already committed.

### CLI Flags

| Flag | Meaning |
|---|---|
| `--review` | After applying a fix but before committing, show the diff and wait for the user's explicit OK. Apply on approval; discard on rejection. |
| `--severity <min>` | Only process findings at or above the given severity. `--severity high` keeps `critical` and `high`; findings below the threshold are recorded as skipped. |
| `--only <finding-id>` | Process exactly one finding, identified by its `id` field (e.g., `F-007`). All others are skipped for this run. |

---

## Step 2 — Baseline Verification

Before applying any fix, establish which verify commands currently pass:

```bash
node scripts/verify-commands.mjs /path/to/target-repo
```

The output is a JSON object with keys `build`, `test`, `typecheck`, and `lint`. Each value is either a package.json script name (a string) or `null` (meaning no matching script was found).

For each non-null key, detect the repo's package manager by checking for `pnpm-lock.yaml`, `yarn.lock`, or `package-lock.json` in that order; fall back to `npm`. Then run the script once:

```bash
# npm
npm run <name>        # for build, typecheck, lint
npm test              # for the test script (use this exact invocation)

# pnpm
pnpm run <name>
pnpm test

# yarn
yarn <name>
yarn test
```

Record which commands **pass at baseline** and which **fail at baseline**. Pre-existing failures are noted in the FIX-REPORT and are not charged to the fixer. A fix is only required to not regress a command that passed at baseline. A command that was already red before the fix remains that command's own pre-existing problem.

---

## Step 3 — Per-Finding Heal Loop

Process each finding in the fix queue one at a time in severity order. The loop has four stages: apply, static verify, dynamic verify, decide.

### 3a — Apply

Locate the real source file to edit. The running app may be served from a different directory than the target dir passed to Sleuth. Apply source reconciliation per `references/product-contract.md`: look for signals of a mismatch (e.g., `detect-stack` reports zero routes, browser DevTools Sources shows files that do not exist in the target directory, network calls reference tables the target directory never mentions). If there is a mismatch, use the actual served-app source path. If the user is present, ask. If not, reconstruct from the running app as the product-contract playbook describes.

With the correct source file in hand, apply the **minimal change** that addresses the finding. The priority order for fix payload:

1. `codingAgentPrompt` — follow its instructions precisely.
2. `suggestedFix` — implement the described change; do not gold-plate.
3. Design finding before→after — locate the element via `selector` and/or `route` + `file`, and change only the value from the `before` to the `after`.

Minimal means minimal. Do not refactor unrelated code, rename variables, or add unrelated features while a finding is in progress.

### 3b — Static Verify

Re-run every baseline-green verify command:

```bash
npm run build      # if build was green at baseline
npm test           # if test was green at baseline
npm run typecheck  # if typecheck was green at baseline
npm run lint       # if lint was green at baseline
```

If any baseline-green command now fails, the fix has introduced a regression. Treat this as a fail and proceed to the decide stage with the build/lint error text as the failure reason.

### 3c — Dynamic Verify

Re-drive the finding's recorded `repro` steps exactly, following the procedure in `references/driving.md`. The repro steps are the canonical reproduction sequence captured when the finding was first filed. Your goal is to confirm the symptom no longer appears.

For cost-sensitive scenarios (finding involves a paid AI endpoint), follow `references/safety-roe.md` Cost & side-effects: one re-drive is the ceiling. Do not repeat paid or record-creating actions across multiple passes.

If the symptom is gone, the dynamic verify passes. If the symptom still appears, it fails.

### 3d — Decide

**Both static and dynamic pass:**

In `--review` mode: show the diff of all changed source files and wait for the user's explicit OK before committing. On approval, proceed. On rejection, revert (`git checkout -- .` scoped to the changed files) and mark the finding **needs-human** with reason `"user rejected diff"`.

Otherwise, commit:

```bash
git -C /path/to/target-repo add <changed-source-files>
git -C /path/to/target-repo commit -m "fix(sleuth): <title> [<id>]"
```

Record the finding as **fixed** and capture the commit SHA.

**Either stage fails:**

Allow exactly **one retry**. Feed the failure back to the application of the fix:

- If static verify failed: pass the full build/lint/typecheck error text as additional context and re-apply.
- If dynamic verify failed: pass `"symptom still reproduces after fix"` as context and re-apply.

Re-run both verify stages for the retry. If the retry also fails, revert all uncommitted changes for this finding:

```bash
git -C /path/to/target-repo checkout -- .
```

Mark the finding **needs-human** and record the failure reason verbatim (the error text or "still reproduces after one retry").

---

## Step 4 — Record Red→Green

After the heal loop completes, assemble the still-broken findings (everything NOT marked **fixed**) into a run-scoped array. This uses the same one-liner pattern as `$sleuth-retest`:

```bash
node -e "const fs=require('fs'),d='.sleuth/runs/<run-id>/findings';if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});const a=fs.readdirSync(d).filter(f=>/^F-.*\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(d+'/'+f,'utf8')));fs.writeFileSync('.sleuth/runs/<run-id>/_all.json',JSON.stringify(a,null,2))"
```

Write to `.sleuth/runs/<run-id>/findings/F-*.json` only the findings that were NOT fixed (still-broken: `needs-human` or `skipped` findings that were open/regressed in regression-memory). Findings marked **fixed** must be absent from this array — their absence is what causes `regression.mjs diff` to flip them `open`→`resolved`.

Then run the diff:

```bash
node scripts/regression.mjs diff .sleuth/regression-memory.json <run-id> .sleuth/runs/<run-id>/_all.json
```

Any finding absent from the run-scoped array and previously `open` or `regressed` flips to `resolved`. Findings present in the array remain `open` or `regressed`. The regression memory is updated in place.

---

## Step 5 — FIX-REPORT

Write the report to `.sleuth/fixes/FIX-REPORT.md` (create the `fixes/` directory if it does not exist).

### Required sections

**Summary**

A single line counts table:

```
Fixed: 3 | Needs-human: 1 | Skipped: 2
```

**Per-Finding Table**

| id | title | severity | status | commit SHA | verify result |
|---|---|---|---|---|---|

`status` values: `fixed`, `needs-human`, `skipped`. For `fixed` rows, the commit SHA is the short hash. For `needs-human` rows, the verify result column contains the failure reason (e.g., "lint regression: 2 errors in auth.ts" or "still reproduces after retry"). For `skipped` rows, the verify result column contains the skip reason (e.g., "no concrete fix payload" or "below --severity threshold").

**Review This Fix Branch**

Exact git commands for the user to inspect, merge, or discard the branch:

```bash
# Inspect all changes on the fix branch
git diff <base-branch>...sleuth/fix-<run-id>

# Merge the fix branch into your working branch
git checkout <base-branch> && git merge sleuth/fix-<run-id>

# Discard the fix branch entirely
git branch -D sleuth/fix-<run-id>
```

Replace `<base-branch>` with the branch that was checked out before `$sleuth-fix` ran (recorded in Step 0 as the branch from which `sleuth/fix-<run-id>` was created).

---

### Worked Example FIX-REPORT

The following is a filled-in example for a run against the YogaBook app. Run ID: `20240612-143022`. Base branch: `main`.

---

**`.sleuth/fixes/FIX-REPORT.md`**

```
# Sleuth Fix Report — 20240612-143022

## Summary

Fixed: 2 | Needs-human: 1 | Skipped: 1

## Per-Finding Table

| id    | title                                         | severity | status       | commit SHA | verify result                                                        |
|-------|-----------------------------------------------|----------|--------------|------------|----------------------------------------------------------------------|
| F-003 | Booking form allows double-submit             | high     | fixed        | a3f92c1    | build ✓, test ✓, typecheck ✓, lint ✓; symptom gone on re-drive      |
| F-007 | Admin /roster route accessible while logged out | critical | fixed      | b81e04d    | build ✓, test ✓, typecheck ✓, lint ✓; redirect confirmed on re-drive |
| F-011 | Class capacity goes negative on concurrent bookings | high | needs-human | —        | retry: still reproduces — race condition requires server-side locking beyond suggestedFix scope |
| F-014 | Export CSV button label is ambiguous          | low      | skipped      | —          | below --severity high threshold                                      |

## Review This Fix Branch

# Inspect all changes on the fix branch
git diff main...sleuth/fix-20240612-143022

# Merge the fix branch into your working branch
git checkout main && git merge sleuth/fix-20240612-143022

# Discard the fix branch entirely
git branch -D sleuth/fix-20240612-143022
```

---

## Remote Actions — Consent Required

Do NOT push the fix branch to the remote or open a pull request unless the user explicitly confirms. When the user asks, use:

```bash
git push -u origin sleuth/fix-<run-id>
gh pr create --title "fix(sleuth): apply verified fixes [<run-id>]" --body "..."
```

Volunteering a push or PR creation without a user prompt is a violation of this rule.

---

## Cost Posture

Re-driving findings and applying fixes may touch paid AI endpoints in the target app. Follow `references/safety-roe.md` Cost & side-effects throughout: one dynamic re-drive per finding is the ceiling for confirmation; do not repeat paid or record-creating actions across multiple passes. If a scenario would incur significant cost (many paid API calls), stop and ask the user before proceeding.
