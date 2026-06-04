# Sleuth — Codex QA + AppSec Skill

Point Codex at your running app. Sleuth drives it like a developer and like your
ICP beta-testers, then returns fix-ready bug, security, and UX briefs — with
regression memory that tracks findings across runs.

---

## What it does

Sleuth closes the loop between "I think it works" and "I have verified evidence":

```
bug found → fix brief with repro + code prompt → developer fixes → Sleuth re-drives → regression memory flips red→green
```

Six phases, fully automated inside the Codex app:

1. **Scope gate** — confirms the target is localhost (or gets explicit approval); writes ROE.
2. **Understand** — reads the repo, runs `detect-stack`, drafts a Product Contract (what the app does, who it's for, what's forbidden).
3. **Profiles** — creates 1 developer persona + 3 ICP personas calibrated to the app's audience.
4. **Drive** — computer-use drives the live app as each persona; captures screenshots + notes.
5. **Judge + brief** — classifies each observation, kills false positives, writes `F-*.json` findings and rendered `F-*.md` briefs.
6. **Regression memory** — records findings with fingerprints; on re-runs, re-drives prior findings and flips fixed ones to `resolved`.

---

## Install

```bash
git clone https://github.com/scandinavianswimmer/sleuth-skill
cd sleuth-skill
./install.sh
```

This installs **5 skills** into `~/.agents/skills/` (default). To install elsewhere:

```bash
./install.sh /path/to/skills-dir
```

No build step. Node.js 20+ required for the helper scripts.

To uninstall:
```bash
./uninstall.sh
```

---

## Commands

| Command | When to use |
|---|---|
| `$sleuth` | Master router — auto-detects phase from `.sleuth/` state and delegates to the right command. Start here when unsure. |
| `$sleuth-scan` | Understand the app only (no driving). Builds a Product Contract + ICP summary from the repo. Use for "what is this app / who is it for". |
| `$sleuth-test` | Full beta test: personas → drive as dev + ICP → judge findings → write briefs → record regression memory. Use for "test my app / find bugs / QA this". |
| `$sleuth-security` | Security-focused drive: guarded routes, role escalation, IDOR, missing headers. Authorized defensive testing only. Use for "is my app secure / pentest". |
| `$sleuth-retest` | Regression retest: re-drives prior open findings, flips fixed ones green, flags regressions. Use for "did my fix work / check the fix". |
| `$sleuth-design` | Audit UI/design + accessibility — AI-slop tells + WCAG 2.2 AA with one-shot fix briefs. Produces `.sleuth/design/DESIGN-REVIEW.md` scorecard. |

`$sleuth` auto-routes by phase — see [`references/master-plan.md`](references/master-plan.md) for the full decision table.

---

## Usage in the Codex app

**Requirements:** Codex app with computer-use enabled. Point it at this skill repo.

1. Start your app locally (e.g. `npm run dev` — it should be reachable at a URL).
2. Open the Codex app, attach the `sleuth` skill.
3. Invoke:

```
$sleuth path/to/your-repo http://localhost:3000
```

Sleuth will run all six phases and write artifacts under `.sleuth/` in your repo:
- `.sleuth/product-contract.json`
- `.sleuth/personas/`
- `.sleuth/findings/F-*.json` and `F-*.md`
- `.sleuth/runs/<run-id>/`
- `.sleuth/regression-memory.json`

On subsequent runs, it picks up `regression-memory.json` and re-verifies prior findings automatically.

---

## Computer-use caveat

Computer-use runs inside the **Codex app**, not the CLI. It is geo-restricted at
launch: not available in EEA, UK, or Switzerland. The skill installs and the helper
scripts run everywhere; only the driving phase requires the app.

The driving methodology is surface-agnostic — it works across OS computer-use,
in-app browser mode, and Chrome mode. The output format (briefs, regression memory)
is the same regardless of surface.

---

## Safety

Sleuth's default rules of engagement (ROE) restrict it to `localhost` targets.
It will refuse to drive an external URL unless you explicitly approve it in the
scope-gate phase. It never submits destructive actions (deletes, payment flows,
account termination) without explicit ROE expansion.

ROE is written to `.sleuth/runs/<run-id>/roe.json` at the start of every run
for audit purposes.

---

## How it works

| Phase | What happens |
|---|---|
| 0 — Scope gate | Reads `references/safety-roe.md`; confirms target host; writes `roe.json` |
| 1 — Understand | `detect-stack` for structure hints; code-read for routes; Product Contract drafted + validated |
| 2 — Profiles | Developer persona + ICP personas created + validated against `schemas/persona.schema.json` |
| 3 — Drive | Computer-use drives the live app; developer pass first, then one pass per ICP persona |
| 4 — Judge + brief | Findings classified, false positives killed, `F-*.json` + `F-*.md` written |
| 5 — Regression | `regression.mjs record` on first run; `regression.mjs diff` on re-runs; resolved findings flip green |

Schemas (`schemas/`) and references (`references/`) are the ground truth for all
validation and reasoning. Findings, personas, and the Product Contract are all
validated by `scripts/scaffold.mjs validate` before being written.

**What the run produces:**
- The standard `F-*.json` / `F-*.md` findings and `SUMMARY.md` in `.sleuth/findings/`
- A master `.sleuth/HANDOFF.md` artifact (the single hand-off document, updated after retest passes)
- `roe.json` per run for audit purposes

**Additional references worth knowing:**
- `references/recipes/` — task-specific test recipes. `prompt-injection-grading.md` covers prompt-injection testing for AI grading and eval apps.
- `references/browser-tooling.md` — driving surface selection (OS computer-use vs. in-app browser vs. Chrome/Playwright); consult this before the drive phase.
- `references/safety-roe.md` — now includes a Cost & side-effects section covering paid AI calls and `costlyActions`/`createsRecords` fields in `roe.json`; be cost-aware when testing AI-powered apps.
- `references/product-contract.md` — includes "Locate the real source first" guidance: Sleuth reconciles the running app's real source when the target directory isn't the served app (records discrepancy in `app.sourceNote`).
- `references/design-review.md` — 8-pillar design scoring rubric used by `$sleuth-design`.
- `references/ai-slop-tells.md` — catalogue of AI-generated UI patterns (gradient overuse, generic hero copy, symmetry locks, etc.) checked by `$sleuth-design`.
- `references/accessibility-wcag.md` — WCAG 2.2 AA criterion checklist driving the a11y audit in `$sleuth-design`.
- `scripts/contrast.mjs` — colour-contrast ratio calculator (WCAG 1.4.3/1.4.11) used during the design audit.
- `scripts/design-scan.mjs` — orchestrates the full design pass; runs Lighthouse/axe when the chrome-devtools surface is available, falls back to static analysis otherwise.

---

## Example

See [`examples/buggy-shop-walkthrough.md`](examples/buggy-shop-walkthrough.md) for a
narrated end-to-end run against a deliberately-buggy fixture app, including:

- Real `detect-stack` output + coverage note on the raw-http gap
- Product Contract, developer persona, and 3 ICP personas (all validated)
- Three findings (2 critical security, 1 UX friction) with full repro + briefs
- Red→green regression proof (open → resolved)
