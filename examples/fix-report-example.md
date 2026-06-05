# Fix Report Example — `$sleuth-fix` Heal-Loop Acceptance Walkthrough

End-to-end narrated run of `$sleuth-fix` against `~/sleuth/fixtures/buggy-shop`.
This document doubles as the **manual acceptance script** for the heal-loop feature.

The buggy-shop fixture ships with three planted bugs from the earlier `$sleuth-test` run:

| Finding | Severity | Default state |
|---|---|---|
| F-001 — `/admin` unauthenticated access | critical | open (unfixed) |
| F-002 — `/dashboard` unauthenticated access | critical | open (unfixed) |
| F-003 — Homepage JS console error | medium | open (unfixed) |

---

## Pre-flight: Trigger conditions

`$sleuth` routes to `$sleuth-fix` when:
- `.sleuth/regression-memory.json` exists with at least one `open` or `regressed` finding
- The user says "fix it", "apply the fixes", "heal my app", or "auto-fix the findings"

---

## Phase 0 — Safety preamble: clean-tree check + branch creation

Before touching a single file, the agent confirms the target repo has no uncommitted changes:

```bash
git -C ~/sleuth/fixtures/buggy-shop status --porcelain
```

**Output (clean):**

```
(empty)
```

Working tree is clean. The agent captures the run ID and creates the fix branch:

```bash
RUN_ID=$(date -u '+%Y%m%d-%H%M%S')
# → RUN_ID=20260604-091532

git -C ~/sleuth/fixtures/buggy-shop checkout -b "sleuth/fix-20260604-091532"
```

**Output:**

```
Switched to a new branch 'sleuth/fix-20260604-091532'
```

All work stays on `sleuth/fix-20260604-091532`. The agent writes `.sleuth/runs/20260604-091532/roe.json`:

```json
{
  "runId": "20260604-091532",
  "scope": "localhost",
  "approvedBy": "auto",
  "appliesCodeChanges": true,
  "baseBranch": "main",
  "fixBranch": "sleuth/fix-20260604-091532"
}
```

**If the tree had been dirty** the agent would have stopped here and said:

> The target repo has uncommitted or unstaged changes. Please commit or stash them before running `$sleuth-fix`, then try again.

---

## Phase 1 — Queue + baseline

### Step 1a — Plan: list open/regressed findings

```bash
node scripts/regression.mjs plan .sleuth/regression-memory.json
```

**Output:**

```json
[
  { "id": "F-001-admin-route-unprotected", "title": "Unprotected /admin — unauthenticated access to admin panel", "severity": "critical", "status": "open" },
  { "id": "F-002-dashboard-route-unprotected", "title": "Unprotected /dashboard — unauthenticated access to post-login page", "severity": "critical", "status": "open" },
  { "id": "F-003-homepage-js-console-error", "title": "Homepage throws JS console error — trackPageViewThatDoesNotExist is not defined", "severity": "medium", "status": "open" }
]
```

All three carry a `codingAgentPrompt` — none are skipped. Sort order: F-001 (critical) → F-002 (critical) → F-003 (medium).

### Step 1b — Verify-commands: classify the repo's scripts

```bash
node scripts/verify-commands.mjs ~/sleuth/fixtures/buggy-shop
```

**Output:**

```json
{
  "build": null,
  "test": "test",
  "typecheck": null,
  "lint": null
}
```

`buggy-shop` is a zero-dependency Node.js server with no build or typecheck step. Only `test` is non-null.

### Step 1c — Baseline run

```bash
node --test ~/sleuth/fixtures/buggy-shop/test/*.mjs
```

**Baseline: PASS** (8/8 tests green — pre-existing state is clean). The agent records this:

```
Baseline: test ✓ (8 pass, 0 fail)
No baseline failures. All subsequent regressions charged to the fix.
```

---

## Phase 2 — Heal loop (3 findings, severity order)

---

### Finding F-001 — Unprotected `/admin` (critical) → **fixed**

**codingAgentPrompt:**

> In server.mjs, change the ADMIN_ROUTES guard so it always enforces role === 'admin' regardless of the SECURE flag. Remove the SECURE_ADMIN env-var opt-in from production code. Add a test that GET /admin without a session cookie returns HTTP 403.

**3a — Apply**

Source file: `~/sleuth/fixtures/buggy-shop/server.mjs` line 143.

**Before (lines 140–148):**

```js
const SECURE = process.env.SECURE_ADMIN === '1';

function checkAdmin(req, res) {
  if (SECURE && req.session?.role !== 'admin') {
    res.writeHead(403); res.end('Forbidden'); return false;
  }
  return true;
}
```

**After (minimal change — remove SECURE opt-in, make guard unconditional):**

```js
function checkAdmin(req, res) {
  if (req.session?.role !== 'admin') {
    res.writeHead(403); res.end('Forbidden'); return false;
  }
  return true;
}
```

**3b — Static verify**

```bash
node --test ~/sleuth/fixtures/buggy-shop/test/*.mjs
```

**Output:** 9/9 pass (the new admin-guard test added per the prompt). Build still green.

**3c — Dynamic verify**

Re-drive repro steps:
1. `GET http://localhost:4178/admin` (no cookies)
2. Observe: HTTP 403, `Forbidden` body — admin panel no longer exposed. Symptom gone.

**3d — Decide: both pass → commit**

```bash
git -C ~/sleuth/fixtures/buggy-shop add server.mjs test/admin-guard.test.mjs
git -C ~/sleuth/fixtures/buggy-shop commit -m "fix(sleuth): Unprotected /admin — unauthenticated access to admin panel [F-001-admin-route-unprotected]"
```

**Commit SHA:** `a3f92c1`

**Status: fixed**

---

### Finding F-002 — Unprotected `/dashboard` (critical) → **needs-human** (regression)

**codingAgentPrompt:**

> In server.mjs, make the /dashboard authentication check unconditional (remove the SECURE guard). Verify with a test that GET /dashboard without a session returns HTTP 403 or redirects to /login.

**3a — Apply**

Source file: `~/sleuth/fixtures/buggy-shop/server.mjs` line 150.

**Before (lines 150–156):**

```js
function checkAuth(req, res) {
  if (SECURE && !req.session?.userId) {
    res.writeHead(302, { Location: '/login' }); res.end(); return false;
  }
  return true;
}
```

The agent attempts to make the guard unconditional — but `SECURE` was already removed from the top of the file by the F-001 fix (the variable no longer exists). The minimal patch uses a stale reference and introduces a `ReferenceError`:

**Attempted after:**

```js
function checkAuth(req, res) {
  if (SECURE && !req.session?.userId) {   // ← still references removed variable
    res.writeHead(302, { Location: '/login' }); res.end(); return false;
  }
  return true;
}
```

**3b — Static verify (first attempt)**

```bash
node --test ~/sleuth/fixtures/buggy-shop/test/*.mjs
```

**Output (FAIL — regression):**

```
▶ dashboard auth check
  ✖ returns 302 for unauthenticated request
    ReferenceError: SECURE is not defined
        at checkAuth (server.mjs:150:7)
```

Tests that were green at baseline are now red. **Static fail.**

**One retry allowed.** The agent feeds back the error text and re-applies. Correct fix:

**After (retry — correct):**

```js
function checkAuth(req, res) {
  if (!req.session?.userId) {
    res.writeHead(302, { Location: '/login' }); res.end(); return false;
  }
  return true;
}
```

**3b — Static verify (retry)**

```bash
node --test ~/sleuth/fixtures/buggy-shop/test/*.mjs
```

**Output:** 10/10 pass. Build green.

**3c — Dynamic verify (retry)**

Re-drive repro steps for F-002:
1. `GET http://localhost:4178/dashboard` (no cookies)
2. Observe: HTTP 302 redirect to `/login`. Symptom gone.

**Wait — the dynamic verify passes on the retry.** Both pass on retry. Commit:

```bash
git -C ~/sleuth/fixtures/buggy-shop add server.mjs
git -C ~/sleuth/fixtures/buggy-shop commit -m "fix(sleuth): Unprotected /dashboard — unauthenticated access to post-login page [F-002-dashboard-route-unprotected]"
```

**Commit SHA:** `b81e04d`

**Status: fixed** (fixed on retry — the red→green flip is shown below in the regression diff)

> **Note for this walkthrough:** The first attempt shows the regression red→green flip that `$sleuth-fix` is designed to handle. The retry mechanism fed back the full `ReferenceError` stack, and the second apply correctly scoped the change. This is the canonical "build went red, retry went green" scenario.

---

### Finding F-003 — Homepage JS console error (medium) → **needs-human**

**codingAgentPrompt:**

> In server.mjs, remove or replace the call to `trackPageViewThatDoesNotExist()` in the homepage inline script. If there is a real analytics function, call it. If not, remove the call entirely.

**3a — Apply**

Source file: `~/sleuth/fixtures/buggy-shop/server.mjs` line 23.

**Before:**

```js
<script>
  trackPageViewThatDoesNotExist();
</script>
```

**After (minimal — remove undefined call):**

```js
<script>
  /* analytics placeholder removed — no real tracker defined */
</script>
```

**3b — Static verify**

```bash
node --test ~/sleuth/fixtures/buggy-shop/test/*.mjs
```

**Output:** 10/10 pass. Build green.

**3c — Dynamic verify**

Re-drive repro steps:
1. Open `http://localhost:4178/` in browser
2. Open DevTools → Console
3. Observe: **`ReferenceError: trackPageViewThatDoesNotExist is not defined` is still present**

The inline `<script>` in the served HTML still shows the old call — the server is caching the rendered template in memory and the agent edited the wrong render path. Symptom still reproduces. **Dynamic fail.**

**One retry:** The agent re-examines the source, finds the template is assembled via a helper at line 87 and tries again. The retry still fails — the helper builds the script tag from a separate `pageScripts` map that the first edit didn't touch.

**Decision after two fails: revert + needs-human**

```bash
git -C ~/sleuth/fixtures/buggy-shop checkout -- server.mjs
```

**Status: needs-human**

Reason: `"still reproduces after one retry — inline <script> assembled from pageScripts map at line 87; fix requires updating server.mjs:87 pageScripts map, not the render helper at line 23. Source reconciliation incomplete."`

---

## Phase 3 — Diff (flip red→green)

The agent writes `.sleuth/runs/20260604-091532/findings/` with only F-003 (still broken). F-001 and F-002 are absent (fixed — their absence triggers the green flip).

```bash
node -e "
const fs=require('fs');
const d='.sleuth/runs/20260604-091532/findings';
if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});
const a=fs.readdirSync(d).filter(f=>/^F-.*\\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(d+'/'+f,'utf8')));
fs.writeFileSync('.sleuth/runs/20260604-091532/_all.json',JSON.stringify(a,null,2))
"

node scripts/regression.mjs diff .sleuth/regression-memory.json 20260604-091532 .sleuth/runs/20260604-091532/_all.json
```

**Regression diff output:**

```
F-001-admin-route-unprotected: open → resolved  ✓
F-002-dashboard-route-unprotected: open → resolved  ✓
F-003-homepage-js-console-error: open → open  (unchanged)
```

Two findings flip green. One remains open.

---

## Phase 4 — FIX-REPORT

Written to `.sleuth/fixes/FIX-REPORT.md`:

---

```markdown
# Sleuth Fix Report — 20260604-091532

## Summary

Fixed: 2 | Needs-human: 1 | Skipped: 0

## Per-Finding Table

| id | title | severity | status | commit SHA | verify result |
|---|---|---|---|---|---|
| F-001-admin-route-unprotected | Unprotected /admin — unauthenticated access to admin panel | critical | fixed | a3f92c1 | build ✓, test ✓; HTTP 403 confirmed on re-drive |
| F-002-dashboard-route-unprotected | Unprotected /dashboard — unauthenticated access to post-login page | critical | fixed | b81e04d | build ✓, test ✓ (fixed on retry); 302→/login confirmed on re-drive |
| F-003-homepage-js-console-error | Homepage throws JS console error — trackPageViewThatDoesNotExist is not defined | medium | needs-human | — | still reproduces after one retry — inline script assembled from pageScripts map at line 87; source reconciliation incomplete |

## Review This Fix Branch

```bash
# Inspect all changes on the fix branch
git diff main...sleuth/fix-20260604-091532

# Merge the fix branch into your working branch
git checkout main && git merge sleuth/fix-20260604-091532

# Discard the fix branch entirely
git branch -D sleuth/fix-20260604-091532
```
```

---

## What this walkthrough verifies

| Acceptance criterion | Result |
|---|---|
| Clean-tree check blocks a dirty repo | Shown in Phase 0 (clean path + dirty-path message) |
| `sleuth/fix-<run-id>` branch created before any edits | `sleuth/fix-20260604-091532` created at Phase 0 |
| `verify-commands.mjs` runs and classifies scripts | `{build: null, test: "test", typecheck: null, lint: null}` |
| Baseline established before any fix applied | `test ✓ (8/8)` at Phase 1 |
| Severity-order processing (critical first) | F-001 → F-002 → F-003 |
| Successful fix: atomic commit + SHA captured | F-001 `a3f92c1`, F-002 `b81e04d` |
| Before→after of a fixed change shown | F-001 `checkAdmin()` SECURE guard removed |
| Regression red→green during retry | F-002 first attempt introduced `ReferenceError`; retry corrected it |
| Build still green after each commit | `node --test` 9/9 → 10/10 passing throughout |
| Failed fix: reverted + flagged needs-human | F-003 reverted, reason recorded verbatim |
| `regression.mjs diff` flips resolved findings | F-001, F-002 → `resolved`; F-003 stays `open` |
| FIX-REPORT rendered with all required sections | Summary counts + per-finding table + git review commands |
| No push / no PR without explicit user confirmation | Not pushed; user given `git diff` + merge + `branch -D` commands |
