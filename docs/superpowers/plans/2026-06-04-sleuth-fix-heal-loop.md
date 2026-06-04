# Sleuth `$sleuth-fix` Heal Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `$sleuth-fix` command that applies fixes for prior findings on a reversible git safety branch, verifies each via repo build/test + re-drive, and flips verified findings red→green — leaving the user's original branch untouched.

**Architecture:** Reuse the spine (`regression.mjs` plan/diff = the same red→green as `$sleuth-retest`, the re-drive in `references/driving.md`, source reconciliation, findings/briefs). Add ONE tested zero-dep script (`verify-commands.mjs`) so the agent runs the right verify commands, plus a `references/fixing.md` playbook and the `commands/sleuth-fix/` skill. No schema change.

**Tech Stack:** Node ≥20 (ESM `.mjs`, built-in `node:test`, zero third-party deps, no build). Markdown skill/reference docs. Git (safety branch + atomic commits) executed by the agent in the target app's repo.

**Spec:** `~/sleuth-skill/docs/superpowers/specs/2026-06-04-sleuth-fix-heal-loop-design.md`

---

## File Structure

```
~/sleuth-skill/
├── scripts/verify-commands.mjs          # CREATE: classify build/test/typecheck/lint from package.json (Task 1)
├── test/verify-commands.test.mjs        # CREATE (Task 1)
├── references/fixing.md                 # CREATE: heal-loop playbook + FIX-REPORT format (Task 2)
├── commands/sleuth-fix/SKILL.md         # CREATE (Task 3)
├── commands/sleuth-fix/agents/openai.yaml  # CREATE (Task 3)
├── SKILL.md                             # MODIFY: master router routes "fix it" → $sleuth-fix (Task 4)
├── references/master-plan.md            # MODIFY: add "Heal" routing row (Task 4)
├── references/briefs.md                 # MODIFY: HANDOFF Coverage notes fix branch + FIX-REPORT (Task 4)
├── README.md                            # MODIFY: document $sleuth-fix (Task 4)
└── examples/fix-report-example.md       # CREATE: worked FIX-REPORT (Task 5)
```

**Note on prose tasks (2–4):** reference/command/wiring files are agent-facing. Each task lists **mandatory content** (the acceptance checklist). Write full prose satisfying every bullet.

---

### Task 1: `verify-commands.mjs` — classify the repo's verify commands

**Files:**
- Create: `scripts/verify-commands.mjs`
- Test: `test/verify-commands.test.mjs`

- [ ] **Step 1: Write the failing test** — `test/verify-commands.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyScripts } from '../scripts/verify-commands.mjs';

test('classifies standard build/test/typecheck/lint by name', () => {
  assert.deepEqual(
    classifyScripts({ build: 'next build', test: 'vitest run', typecheck: 'tsc --noEmit', lint: 'eslint .' }),
    { build: 'build', test: 'test', typecheck: 'typecheck', lint: 'lint' },
  );
});

test('classifies by command content when names are nonstandard', () => {
  assert.deepEqual(
    classifyScripts({ compile: 'tsc --noEmit', check: 'eslint src', spec: 'jest' }),
    { build: null, test: 'spec', typecheck: 'compile', lint: 'check' },
  );
});

test('only a test script → others null', () => {
  assert.deepEqual(
    classifyScripts({ test: 'node --test' }),
    { build: null, test: 'test', typecheck: null, lint: null },
  );
});

test('does not pick watch or auto-fix variants', () => {
  const r = classifyScripts({ 'test:watch': 'vitest', 'lint:fix': 'eslint . --fix' });
  assert.equal(r.test, null);
  assert.equal(r.lint, null);
});

test('empty / missing scripts → all null', () => {
  assert.deepEqual(classifyScripts({}), { build: null, test: null, typecheck: null, lint: null });
  assert.deepEqual(classifyScripts(), { build: null, test: null, typecheck: null, lint: null });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/sleuth-skill && node --test test/verify-commands.test.mjs`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `scripts/verify-commands.mjs`**

```js
#!/usr/bin/env node
// Classify a repo's package.json scripts into {build, test, typecheck, lint}
// so the heal loop runs the right verify commands. Zero dependencies. Best-effort.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CATEGORIES = {
  build: {
    names: [/^build$/, /(^|[:_-])build([:_-]|$)/],
    cmds: [],
    exclude: [/^pre/, /^post/],
  },
  test: {
    names: [/^test$/, /(^|[:_-])test([:_-]|$)/],
    cmds: [/\bvitest\b/, /\bjest\b/, /\bmocha\b/, /node\s+--test/, /playwright\s+test/],
    exclude: [/watch/, /ui\b/],
  },
  typecheck: {
    names: [/^type-?check$/, /(^|[:_-])type-?check([:_-]|$)/, /^tsc$/],
    cmds: [/tsc\s+--noemit/, /tsc\s+-p\b/, /tsc\s+--project/, /vue-tsc/],
    exclude: [],
  },
  lint: {
    names: [/^lint$/, /(^|[:_-])lint([:_-]|$)/],
    cmds: [/\beslint\b/, /biome\s+(lint|check)/, /\bstylelint\b/],
    exclude: [/fix/],
  },
};

function isExcluded(name, scripts, def) {
  const cmd = (scripts[name] || '').toLowerCase();
  return (def.exclude || []).some((re) => re.test(name) || re.test(cmd));
}

function pickScript(names, scripts, def) {
  for (const re of def.names) {
    const hit = names.find((n) => re.test(n) && !isExcluded(n, scripts, def));
    if (hit) return hit;
  }
  for (const re of def.cmds) {
    const hit = names.find((n) => re.test((scripts[n] || '').toLowerCase()) && !isExcluded(n, scripts, def));
    if (hit) return hit;
  }
  return null;
}

export function classifyScripts(scripts = {}) {
  const safe = scripts || {};
  const names = Object.keys(safe);
  const out = {};
  for (const [cat, def] of Object.entries(CATEGORIES)) {
    out[cat] = pickScript(names, safe, def);
  }
  return out;
}

export function classifyRepo(root) {
  let pkg;
  try { pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')); }
  catch { return { build: null, test: null, typecheck: null, lint: null }; }
  return classifyScripts(pkg.scripts || {});
}

function main() {
  const root = process.argv[2] || process.cwd();
  process.stdout.write(JSON.stringify(classifyRepo(root), null, 2) + '\n');
}
if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/sleuth-skill && node --test test/verify-commands.test.mjs`
Expected: PASS (5 tests). (If `node --test` errors with a "nested session" message, prefix with `env -u CLAUDECODE `.)

- [ ] **Step 5: Smoke the CLI against this repo (it has a `test` script)**

Run: `cd ~/sleuth-skill && node scripts/verify-commands.mjs .`
Expected: JSON with `"test": "test"` (this repo's package.json defines `"test": "node --test"`); build/typecheck/lint likely null.

- [ ] **Step 6: Run the full suite**

Run: `cd ~/sleuth-skill && node --test 2>&1 | grep -iE 'pass|fail'`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
cd ~/sleuth-skill && git add scripts/verify-commands.mjs test/verify-commands.test.mjs && git commit -q -m "feat: verify-commands.mjs — classify repo build/test/typecheck/lint scripts"
```

---

### Task 2: `references/fixing.md` — the heal-loop playbook

**Files:**
- Create: `references/fixing.md`

- [ ] **Step 1: Write `references/fixing.md`**

Mandatory content (agent-facing; concrete + skimmable):
- **Git safety (non-negotiable, run first):** require a **clean working tree** in the target repo (if dirty, stop and ask the user to commit/stash). Create + checkout `sleuth/fix-<run-id>` (run-id `YYYYMMDD-HHMMSS`) off the current branch. NEVER edit the user's original branch / main directly. Ensure `.sleuth/` is git-ignored (or never stage it) — commits contain SOURCE ONLY.
- **Build the queue:** `node scripts/regression.mjs plan .sleuth/regression-memory.json` → open/regressed findings; keep only those with a concrete fix (`codingAgentPrompt` or `suggestedFix` or a design before→after); order critical→high→medium→low. Note flags: `--review` (confirm each diff before applying), `--severity <min>` (e.g. high), `--only <finding-id>`. Findings with no concrete fix → recorded **skipped**.
- **Baseline:** `node scripts/verify-commands.mjs <repo>` → `{build, test, typecheck, lint}` (each a script name or null). Run each non-null one ONCE via the repo's package manager (`npm run <name>`, or `npm test` for the `test` script; use pnpm/yarn if that's what the repo uses) and record which **pass at baseline**. Fixes must not regress a baseline-green command; pre-existing failures are noted, not charged to the fixer.
- **Per-finding loop:** (1) **apply** — edit the REAL source (source reconciliation per `references/product-contract.md`) using the finding's fix payload (`codingAgentPrompt`/`suggestedFix`/before→after + `selector`/`route`/`file`); make the MINIMAL change. (2) **static verify** — re-run the baseline-green verify commands; if any regressed → fail. (3) **dynamic verify** — re-drive the finding's recorded repro (`references/driving.md`); symptom gone → pass. (4) **decide** — both pass → `git add <changed source files>` + commit `fix(sleuth): <title> [F-xxx]`, mark **fixed** (record SHA); in `--review` mode show the diff and apply on user OK. Fail → ONE retry feeding the failure (build error text / "still reproduces") back, re-apply; still failing → `git checkout -- .` (revert), mark **needs-human** with the reason.
- **Record red→green:** assemble still-broken findings (everything not **fixed**) into `.sleuth/runs/<run-id>/_all.json` (same one-liner the other commands use, reading `.sleuth/runs/<run-id>/findings/F-*.json`), then `node scripts/regression.mjs diff .sleuth/regression-memory.json <run-id> .sleuth/runs/<run-id>/_all.json` — verified-fixed findings flip `open`→`resolved`.
- **FIX-REPORT format:** write `.sleuth/fixes/FIX-REPORT.md` with: a summary count (fixed / needs-human / skipped); a per-finding table (id | title | severity | status | commit SHA | verify result); and a **"Review this fix branch"** section with exact commands — inspect (`git diff <base>...sleuth/fix-<run-id>`), merge (`git checkout <base> && git merge sleuth/fix-<run-id>`), or discard (`git branch -D sleuth/fix-<run-id>`). Include a SHORT worked example FIX-REPORT.
- **No remote actions without consent:** only push / `gh pr create` if the user explicitly confirms.
- **Cost-aware:** re-driving + fixes touching paid AI endpoints follow `references/safety-roe.md` Cost & side-effects (minimize calls).

- [ ] **Step 2: Commit**

```bash
cd ~/sleuth-skill && git add references/fixing.md && git commit -q -m "docs: fixing.md — heal-loop playbook (git safety, baseline verify, FIX-REPORT)"
```

---

### Task 3: `commands/sleuth-fix/SKILL.md` + openai.yaml

**Files:**
- Create: `commands/sleuth-fix/SKILL.md`
- Create: `commands/sleuth-fix/agents/openai.yaml`

- [ ] **Step 1: Read an existing command for the register**

Run: `cat ~/sleuth-skill/commands/sleuth-retest/SKILL.md`
(Use the same structure/voice; `$sleuth-fix` is essentially retest + an apply step on a safety branch.)

- [ ] **Step 2: Write `commands/sleuth-fix/SKILL.md`** — lean (desc < 500 chars, file < 4000 chars). Mandatory content:
- Frontmatter `name: sleuth-fix`; `description` triggers on: "fix it", "apply the fixes", "heal my app", "one-shot the fixes", "make Sleuth fix it", "auto-fix the findings". Note it edits code on a safety branch and needs prior findings.
- **Pre-check:** `.sleuth/regression-memory.json` must exist with open/regressed findings (else direct the user to `$sleuth-test`/`$sleuth-design`/`$sleuth-security` first). The target must be a git repo with a clean working tree.
- Body (terse phase pointers; full procedure in `references/fixing.md`):
  - **Phase 0 — Scope gate + git safety:** read `references/safety-roe.md`; confirm localhost/approved; verify clean tree; create `sleuth/fix-<run-id>`; write `.sleuth/runs/<run-id>/roe.json` with `appliesCodeChanges: true`. run-id = `YYYYMMDD-HHMMSS`.
  - **Phase 1 — Queue + baseline:** `node scripts/regression.mjs plan ...`; filter to concrete-fix findings, severity order; `node scripts/verify-commands.mjs <repo>` + run the detected commands once for the baseline. (Flags: `--review`, `--severity`, `--only`.)
  - **Phase 2 — Heal loop:** per finding, apply → static verify → re-drive verify → commit-or-revert with one retry, per `references/fixing.md` + `references/driving.md`. Edit the real source (`references/product-contract.md`).
  - **Phase 3 — Diff:** assemble `.sleuth/runs/<run-id>/_all.json` of still-broken findings + `node scripts/regression.mjs diff ...` to flip fixed ones red→green.
  - **Phase 4 — Report:** write `.sleuth/fixes/FIX-REPORT.md` (+ update SUMMARY.md, HANDOFF.md). Offer a PR ONLY on explicit confirm.
  - One line: "After review, merge `sleuth/fix-<run-id>` yourself, or run `$sleuth-retest` to re-confirm."

- [ ] **Step 3: Write `commands/sleuth-fix/agents/openai.yaml`**

```yaml
interface:
  display_name: "Sleuth Fix"
  short_description: "Applies + verifies fixes for prior findings on a reversible git safety branch — the red→green heal loop."
  brand_color: "#1f6feb"
policy:
  allow_implicit_invocation: true
```

- [ ] **Step 4: Verify budget + frontmatter + paths**

Run:
```bash
cd ~/sleuth-skill && node -e "const fs=require('fs');const s=fs.readFileSync('commands/sleuth-fix/SKILL.md','utf8');const d=s.match(/description:\s*(.*)/)[1];console.log('desc',d.length,'file',s.length)"
ls references/fixing.md scripts/verify-commands.mjs scripts/regression.mjs references/driving.md references/safety-roe.md references/product-contract.md
```
Expected: desc < 500, file < 4000; all paths exist. Confirm SKILL.md starts with `---`, has `name: sleuth-fix` + `description:`. (If `node -e` errors with a nested-session message, use `wc -c commands/sleuth-fix/SKILL.md`.)

- [ ] **Step 5: Commit**

```bash
cd ~/sleuth-skill && git add commands/sleuth-fix && git commit -q -m "feat: \$sleuth-fix command — apply + verify fixes on a safety branch"
```

---

### Task 4: Wiring — router, master-plan, HANDOFF, README

**Files:**
- Modify: `SKILL.md`
- Modify: `references/master-plan.md`
- Modify: `references/briefs.md`
- Modify: `README.md`

- [ ] **Step 1: Route fix asks in master `SKILL.md`** — add a phase-detection line: user asks "fix it / apply the fixes / heal my app / one-shot the fixes / make Sleuth fix it" → run `$sleuth-fix` (precondition: a prior run produced findings). Add `$sleuth-fix` to the command list. ⚠️ BUDGET: root SKILL.md is ~3963 bytes and MUST stay < 4000 — TRIM wording to fit (net ~0). Verify `wc -c SKILL.md` < 4000 and the description frontmatter stays < 500 chars.

- [ ] **Step 2: Add the "Heal" row to `references/master-plan.md`** — a table row consistent with existing rows: signal "user wants Sleuth to FIX / apply / heal / auto-fix the findings (after a prior run)" → Phase "Heal" → Command `$sleuth-fix` → Why "applies + verifies fixes on a reversible safety branch; flips findings red→green".

- [ ] **Step 3: HANDOFF Coverage in `references/briefs.md`** — add a line to the HANDOFF.md spec's Coverage section: "If a heal run (`$sleuth-fix`) ran, note the `sleuth/fix-<run-id>` branch and link `.sleuth/fixes/FIX-REPORT.md` (fixed / needs-human counts)."

- [ ] **Step 4: README** — add `$sleuth-fix` to the commands table ("Apply + verify fixes for prior findings on a safety branch — the red→green heal loop"); document the `sleuth/fix-<run-id>` branch model + atomic commits + revert-on-fail, the `.sleuth/fixes/FIX-REPORT.md` artifact, the `--review`/`--severity`/`--only` flags, and the no-push/PR-without-confirm safety.

- [ ] **Step 5: Commit**

```bash
cd ~/sleuth-skill && git add SKILL.md references/master-plan.md references/briefs.md README.md && git commit -q -m "feat: wire \$sleuth-fix into router, master-plan, HANDOFF, README"
```

---

### Task 5: Acceptance + worked FIX-REPORT example

**Files:**
- Create: `examples/fix-report-example.md`

- [ ] **Step 1: Full suite + budgets + installer self-containment (7 skills)**

Run:
```bash
cd ~/sleuth-skill && node --test 2>&1 | grep -iE 'pass|fail'
for f in SKILL.md commands/*/SKILL.md; do node -e "const s=require('fs').readFileSync('$f','utf8');const d=(s.match(/description:\s*(.*)/)||[])[1]||'';console.log('$f','desc',d.length,'file',s.length)"; done
rm -rf /tmp/skilltest && bash install.sh /tmp/skilltest >/dev/null && for s in sleuth sleuth-scan sleuth-test sleuth-security sleuth-retest sleuth-design sleuth-fix; do test -f /tmp/skilltest/$s/SKILL.md && test -f /tmp/skilltest/$s/scripts/verify-commands.mjs && test -f /tmp/skilltest/$s/references/fixing.md && echo "ok $s" || echo "BROKEN $s"; done; rm -rf /tmp/skilltest
```
Expected: all tests pass; every SKILL.md desc<500 & file<4000; all SEVEN skills (including `sleuth-fix`) print `ok` (confirms `install.sh`'s `cp -R scripts references` carries `verify-commands.mjs` + `fixing.md` and the `commands/*/` loop picks up the new command). If `node --test`/`node -e` hit a nested-session error, prefix with `env -u CLAUDECODE ` (or use `wc -c` for sizes). If `sleuth-fix` is BROKEN, fix `install.sh` (commit the fix here).

- [ ] **Step 2: Verify the install.sh completion message lists sleuth-fix**

Run: `grep -n "sleuth-fix\|/skills" install.sh`
If the final echo enumerates the skills "you should see", add `sleuth-fix` to it (and commit in Step 4). If it's generic, no change needed.

- [ ] **Step 3: Write `examples/fix-report-example.md`**

Mandatory content: a narrated `$sleuth-fix` run that includes: the safety preamble (clean-tree check + `sleuth/fix-20260604-...` branch); a sample `verify-commands.mjs` output (`{build, test, typecheck, lint}`) + baseline result; 2–3 findings walked through the loop — at least one **fixed** (with an atomic commit SHA + before→after of the change + "build still green, repro gone"), and one **needs-human** (a fix that regressed the build → reverted, flagged); the regression red→green flip for the fixed ones; and the full rendered `.sleuth/fixes/FIX-REPORT.md` (summary counts + per-finding table + the "Review this fix branch" git commands). This doubles as the manual acceptance script.

- [ ] **Step 4: Commit**

```bash
cd ~/sleuth-skill && git add -A && git commit -q -m "docs: worked \$sleuth-fix FIX-REPORT walkthrough; heal-loop acceptance green"
```

---

## Self-Review

**Spec coverage:**
- `$sleuth-fix` command (apply + verify) → Task 3. ✅
- Autonomous on a safety branch + `--review` → Tasks 2/3 (fixing.md git-safety + command flags). ✅
- Verify = re-drive + repo build/test/typecheck (no baseline regression) → Task 2 (baseline + static/dynamic verify) + Task 1 (`verify-commands.mjs` to find the commands). ✅
- Scope = all open, high-confidence first, retry-once-then-revert → Task 2 (queue + per-finding loop). ✅
- Clean-tree precondition, atomic source-only commits, revert-on-fail, no push without consent → Task 2/3. ✅
- Red→green via existing `regression.mjs diff` (reused, not reimplemented) → Tasks 2/3 Phase 3. ✅
- `FIX-REPORT.md` output → Tasks 2 (format) + 5 (worked example). ✅
- Wiring (router, master-plan, HANDOFF, README) → Task 4. ✅
- No schema change; no `fixStatus` field → honored (no schema task). ✅
- Tested `verify-commands.mjs`; full suite green; budgets; installer 7 skills → Tasks 1/5. ✅

**Placeholder scan:** Prose tasks (2–4) specify mandatory content (documented at top); all code/test steps carry complete content; no "TBD/TODO" in logic. ✅

**Type consistency:** `classifyScripts(scripts)` / `classifyRepo(root)` names + the `{build, test, typecheck, lint}` shape match across Task 1 impl, test, command, and fixing.md. Artifact paths (`.sleuth/fixes/FIX-REPORT.md`, `.sleuth/runs/<run-id>/_all.json`, `sleuth/fix-<run-id>` branch, `.sleuth/regression-memory.json`) and the `regression.mjs plan/diff` invocations are consistent across spec, fixing.md, and the command. run-id format `YYYYMMDD-HHMMSS` consistent throughout. ✅
