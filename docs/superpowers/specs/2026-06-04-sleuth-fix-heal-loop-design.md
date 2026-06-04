# Sleuth `$sleuth-fix` — Heal Loop Design

**Date:** 2026-06-04
**Status:** Draft (awaiting user review)
**Repo:** `~/sleuth-skill` (the Sleuth Codex Agent Skill bundle)

## 1. Summary

Add **`$sleuth-fix`** (the 7th command) — the heal loop that closes Sleuth's
find → fix → verify cycle. Sleuth already *finds* issues and writes one-shot-ready
briefs; `$sleuth-fix` *applies* the fix in the target app's repo and *re-verifies*
(re-drive + repo build/test) to confirm **red → green**, autonomously and reversibly.

It is built to be **non-destructive**: it works on a fresh git branch in the target
app's repo, commits one verified fix at a time, reverts fixes that fail verification,
and never pushes or opens a PR without explicit confirmation.

It reuses the existing spine: `regression.mjs` (the red→green flip is the *same*
mechanism as `$sleuth-retest`), the re-drive procedure from `references/driving.md`,
source reconciliation, and the findings/briefs format (findings already carry
`suggestedFix`, `codingAgentPrompt`, and for design the before→after value + `selector`).

**Decisions locked in brainstorming:**
- Autonomy: **autonomous on a safety branch**, with a `--review` flag to confirm each diff.
- Verify bar: a fix counts only if **the repo's build/test/typecheck still pass (no
  regression vs baseline) AND the finding's repro no longer reproduces**.
- Scope: **all open/regressed findings with a concrete fix, high-severity first**; on
  failure, **one retry with feedback, then revert that finding's change + flag needs-human**.
- Deferred (v1): NO `fixStatus` field added to regression memory — fix outcomes live in
  `FIX-REPORT.md`; regression's existing `open`/`resolved` status covers fixed-vs-not.

## 2. Goals & non-goals

### Goals
- A `$sleuth-fix` command that applies + verifies fixes for prior findings, autonomously.
- **Reversible & reviewable:** dedicated git branch, atomic per-fix commits, clean reverts.
- **Verified:** every committed fix passes repo build/test/typecheck (no baseline
  regression) AND its symptom no longer reproduces on re-drive.
- **Honest reporting:** a `FIX-REPORT.md` of fixed ✅ / needs-human ⚠️ / skipped, with
  commit SHAs, and regression memory flipped red→green for verified fixes.
- Reuse the spine (regression.mjs, driving re-drive, source reconciliation, findings).

### Non-goals (this spec)
- No pushing / PR creation without explicit user confirmation (outward-facing).
- No editing on the user's working branch or `main` directly — always a safety branch.
- No `fixStatus` field in regression memory (deferred; FIX-REPORT covers it).
- No fixing of findings without a concrete fix payload (those are reported as skipped).
- Not a replacement for human review — it produces a reviewable branch, not a merge.

## 3. Safety model (the spine of this feature)

Applying code changes is more invasive than testing, so safety is first-class:
- **Clean-tree precondition.** The target repo's working tree must be clean (no
  uncommitted user work). If dirty → stop and ask the user to commit/stash first.
- **Safety branch.** Create + checkout `sleuth/fix-<run-id>` (run-id = `YYYYMMDD-HHMMSS`)
  off the current branch. All changes land here; the user's original branch is untouched.
- **Atomic commits, source only.** One commit per verified fix
  (`fix(sleuth): <title> [F-xxx]`), staging only the changed **source** files — never the
  `.sleuth/` working-dir artifacts (ensure `.sleuth/` is git-ignored in the target, or
  never stage it).
- **Revert-on-fail.** A fix that fails verification is reverted with `git checkout -- .`
  (uncommitted), leaving the tree clean before the next finding.
- **No remote actions without consent.** Pushing / `gh pr create` only on explicit
  user confirmation at the end.
- **Cost-aware.** Re-driving and fixes that hit paid AI endpoints follow the Cost &
  side-effects rules in `references/safety-roe.md` (minimize calls).
- **Real source.** Edits target the *running* app's actual source (source reconciliation
  per `references/product-contract.md`), not necessarily the directory passed in.

## 4. The heal loop

run-id = `YYYYMMDD-HHMMSS`. Working dir `.sleuth/` in the target app.

### Phase 0 — Scope gate + git safety
Read `references/safety-roe.md` (incl. Cost & side-effects). Confirm localhost/approved
host. Verify the target repo is a git repo with a **clean working tree** (else stop).
Create + checkout `sleuth/fix-<run-id>`. Write `.sleuth/runs/<run-id>/roe.json` with
`appliesCodeChanges: true` and the branch name.

### Phase 1 — Build the fix queue + baseline
- `node scripts/regression.mjs plan .sleuth/regression-memory.json` → open/regressed
  findings with their recorded repro. (If no regression memory exists, direct the user to
  run `$sleuth-test`/`$sleuth-design`/`$sleuth-security` first.)
- Filter to findings with a **concrete fix** (`codingAgentPrompt` or `suggestedFix` or a
  design before→after). Findings without one are recorded as **skipped (no concrete fix)**.
- Order the queue by severity: critical → high → medium → low. (`--severity high` narrows
  it; `--only F-xxx` targets a single finding.)
- **Detect verify commands:** `node scripts/verify-commands.mjs <repo>` →
  `{build, test, typecheck, lint}` (classified from the repo's package.json scripts).
- **Baseline:** run the detected verify commands once; record which **pass** at baseline.
  Fixes must not *regress* a baseline-green command; pre-existing failures are noted, not
  charged to the fixer.

### Phase 2 — Per-finding heal loop
For each finding in the queue:
1. **Apply.** Codex edits the real source using the finding's fix payload
   (`codingAgentPrompt` / `suggestedFix` / before→after value + `selector`/`route`/`file`
   from the brief). Make the **minimal** change that addresses the finding.
2. **Static verify.** Re-run the baseline-green verify commands. If any regressed → fail.
3. **Dynamic verify.** Re-drive the finding's recorded repro per `references/driving.md`
   (the `$sleuth-retest` re-drive). Symptom gone → pass; still reproduces → fail.
4. **Decide.**
   - **Both pass** → `git add <changed source>` + atomic commit; mark **fixed**; record
     the commit SHA. (In `--review` mode, show the diff and apply on user OK.)
   - **Fail** → **one retry**: feed the failure (build error text / "still reproduces")
     back to Codex and re-apply. If it then passes → commit. If still failing →
     `git checkout -- .` (revert), mark **needs-human** with the reason.
5. **Evidence.** Save before/after screenshots + verify output to `.sleuth/runs/<run-id>/`.

### Phase 3 — Record red→green
Assemble the still-broken findings (everything not marked **fixed**) into a run-scoped
`.sleuth/runs/<run-id>/_all.json` (the same one-liner the other commands use), then:
```
node scripts/regression.mjs diff .sleuth/regression-memory.json <run-id> .sleuth/runs/<run-id>/_all.json
```
Verified-fixed findings are absent from the array → flip `open` → `resolved` (red→green).
(Identical mechanism to `$sleuth-retest`.)

### Phase 4 — Report + handoff
- Write `.sleuth/fixes/FIX-REPORT.md`: per finding — **fixed ✅** (commit SHA + what
  changed + verify result) / **needs-human ⚠️** (why it failed) / **skipped** (no concrete
  fix); a summary count; the **branch name** and explicit **review / merge / revert**
  instructions (e.g. `git diff main...sleuth/fix-<run-id>`, `git merge`, or
  `git branch -D` to discard).
- Update `.sleuth/findings/SUMMARY.md` and `.sleuth/HANDOFF.md` with the fix results.
- **Optionally** (explicit confirm only): if a git remote + `gh` exist, offer to open a PR
  from the safety branch.

## 5. What ships as code vs agent

Per "thin, deterministic where it counts":
- **Reuse (no change):** `scripts/regression.mjs` (plan/diff), `references/driving.md`
  (re-drive), `references/product-contract.md` (source reconciliation),
  `references/judging.md` / `references/briefs.md`, `references/safety-roe.md`.
- **New tested script `scripts/verify-commands.mjs`** (zero-dep, TDD):
  `classifyScripts(pkgScripts)` → `{ build, test, typecheck, lint }` (best-effort by
  conventional names — `build`, `test`/`vitest`/`jest`, `typecheck`/`tsc --noEmit`,
  `lint`/`eslint`), each value the runnable npm script name or null. `main(repo)` reads
  the repo's `package.json` and prints the classification JSON. So the agent runs the
  *right* verify commands instead of guessing.
- **New reference `references/fixing.md`** — the heal-loop playbook: git safety,
  clean-tree precondition, branch + atomic-commit discipline (source only, not `.sleuth/`),
  baseline-aware verify, the apply → static-verify → dynamic-verify → decide loop, the
  retry-once-then-revert rule, and the `FIX-REPORT.md` format with a worked example.
- **New command `commands/sleuth-fix/SKILL.md` + `agents/openai.yaml`** — lean (desc < 500,
  file < 4000), pointing to the references and scripts above.

No schema change. No `fixStatus` field (deferred).

## 6. Wiring

- **Master `SKILL.md` router** + **`references/master-plan.md`:** route "fix it / apply the
  fixes / heal my app / one-shot the fixes / make Sleuth fix it" → `$sleuth-fix`; add a
  "Heal" phase row (precondition: a prior run with findings exists). Keep root SKILL.md
  under 4000 chars (currently 3963 — trim if needed).
- **`references/briefs.md`:** HANDOFF "Coverage" notes the fix branch + FIX-REPORT when a
  heal run happened.
- **`README.md`:** add `$sleuth-fix` to the commands table ("Apply + verify fixes for prior
  findings on a safety branch — red→green heal loop"); document the `sleuth/fix-<run-id>`
  branch model, `FIX-REPORT.md`, `--review`/`--severity`/`--only` flags, and the
  no-push-without-confirm safety.
- **`install.sh`:** auto-picks up the new command folder (`commands/*/` loop) + new script
  via `cp -R scripts references`; the acceptance task verifies all **7** skills install.

## 7. Success criteria

1. On a vibe app (or `~/sleuth/fixtures/buggy-shop`) with open findings in regression
   memory, `$sleuth-fix`: verifies a clean tree, creates `sleuth/fix-<run-id>`, processes
   findings in severity order.
2. A fix that **breaks a baseline-green build/test is caught at static-verify and reverted**
   (not committed) and the finding is flagged needs-human.
3. A fix that passes static + dynamic verify is **committed atomically** (source only) and
   the finding flips `open` → `resolved` in regression memory.
4. `.sleuth/fixes/FIX-REPORT.md` is produced with per-finding status + commit SHAs + branch
   review/merge/revert instructions; SUMMARY/HANDOFF updated.
5. The user's **original branch is untouched**; nothing is pushed without explicit confirm.
6. `scripts/verify-commands.mjs` is unit-tested; full suite green; all SKILL.md within
   budget; installer self-contained across all 7 skills.

## 8. Testing approach

- **`verify-commands.mjs`:** node:test — a package.json with `{build, test, typecheck,
  lint}` → correct classification; a Vite/Next variant (`vitest`, `tsc --noEmit`) →
  classified; a repo with only `test` → others null; no package.json → all null.
- **Heal-loop procedure:** validated via `references/fixing.md`'s worked `FIX-REPORT.md`
  example + the acceptance walkthrough (manual script in the Codex app), checked against
  the success criteria. The deterministic red→green is already covered by `regression`
  tests; this feature reuses that mechanism rather than re-implementing it.
- **Budgets + installer:** every SKILL.md desc<500/file<4000; installer dry-run installs 7
  self-contained skills carrying `verify-commands.mjs` + `fixing.md`.

## 9. Open questions / deferred

- `fixStatus` / `needs-human` persisted in regression memory (so future runs skip known-
  unfixable findings) — deferred; FIX-REPORT holds it for v1.
- Auto-PR polish (labels, body templating) — v1 just offers a plain PR on confirm.
- Multi-file / cross-cutting fixes that span findings — v1 treats each finding's fix
  independently; a later version could batch related findings.
- Language/runtime coverage of `verify-commands.mjs` — v1 targets JS/TS `package.json`
  apps (the vibe-coded norm); other ecosystems (Python/Go) can follow.
