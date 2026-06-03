# Briefs Reference Playbook

After judging is complete and all confirmed findings have been written as JSON to `.sleuth/findings/`, this playbook tells you how to render those findings into human-readable briefs and a founder-facing run summary. Run this phase after `judging.md` but before any regression work.

---

## Overview

Two artifact types are produced:

1. **Per-finding brief** — one Markdown file per confirmed finding, at `.sleuth/findings/F-NNN-<slug>.md`. Human-readable. A developer should be able to open this file, reproduce the issue, and paste the coding-agent prompt into Codex or Claude without ever opening the JSON.
2. **Run summary** — one Markdown file at `.sleuth/findings/SUMMARY.md`. Founder-readable. Gives a quick picture of run health, what broke, what must ship before launch, and whether regressions are trending green.

Generate these files after every run that produces at least one confirmed finding. If the run produced no findings (all observations classified as `expected`), still write a `SUMMARY.md` — it proves the coverage happened.

---

## Step 1 — Render Per-Finding Briefs

For each JSON file at `.sleuth/findings/F-NNN-<slug>.json`, write a corresponding `.sleuth/findings/F-NNN-<slug>.md`. The two files share the same base name; only the extension differs.

### Brief Structure

Every brief contains these sections in this order:

#### 1. Title + Severity Badge

The first line is an H1 with the finding's `title` field. Immediately below it, on its own line, render a severity badge using the following emoji-free inline format:

```
**Severity:** CRITICAL | HIGH | MEDIUM | LOW | INFO   **Type:** security | bug | ux-friction | expected
```

Use all-caps for the severity word. Use the raw enum value (lowercase) for the type.

#### 2. Context

A short paragraph (2–4 sentences) summarizing what was found and why it matters. This is not copied from the JSON — synthesize it from `type`, `severity`, `route`, `flow`, `persona`, and `suggestedFix`. If the finding is `security`, state the worst-case realistic impact in plain language (e.g., "An unauthenticated visitor can access the full admin interface and read or modify every user's data.").

Then render the structured metadata as a small table or labeled list:

```
- **Route:** {{finding.route or "—"}}
- **Flow:** {{finding.flow or "—"}}
- **Persona:** {{finding.persona or "—"}}
- **CWE:** {{finding.cwe or "—"}} (security findings only; omit row for non-security)
- **Visibility:** User-visible | Hidden
- **Root cause / limitations:** {{state the determined root cause if confirmed via backend correlation (logs, source, dev-server output); otherwise write "Symptom only — needs backend access"}}
```

#### 3. Repro Steps

An H2 `## Repro Steps` section. Render the `repro` array as a numbered list, one array item per step, exactly as written in the JSON. Do not paraphrase. If a step refers to a persona or test account, note the run-scoped email pattern (`sleuth+<run-id>@example.test`) in a parenthetical after the step.

#### 4. Evidence

An H2 `## Evidence` section. Render the `evidence` array as a bulleted list. Each item is a screenshot path or network note directly from the JSON. For items that are filesystem paths (i.e., they start with `.sleuth/runs/`), wrap the path in a Markdown code span so it is clearly machine-readable:

```
- `.sleuth/runs/20240612-143022/dev-admin-unauthed-200.png` — screenshot showing the admin dashboard rendered in an unauthenticated browser session; address bar shows /admin, no login prompt visible.
```

If the evidence item is a prose network observation rather than a path, render it as plain text within the bullet.

#### 5. Suggested Fix

An H2 `## Suggested Fix` section. Copy the `suggestedFix` field verbatim. If `suggestedFix` is absent from the JSON (it is optional), write "No suggested fix recorded." Do not invent a fix.

#### 6. Coding-Agent Prompt

An H2 `## Coding-Agent Prompt` section. This is the paste-ready instruction for Codex or Claude to implement the fix. Copy the `codingAgentPrompt` field from the JSON verbatim, inside a fenced code block with no language tag:

````
```
{{codingAgentPrompt field value, verbatim}}
```
````

If `codingAgentPrompt` is absent from the JSON, use the template described in the next section to generate it on the fly from the other fields, then include the result in the brief and also write it back into the JSON file so the record is complete.

---

## Coding-Agent Prompt Template

When you need to generate a `codingAgentPrompt` from scratch (because the field was not written during judging), use this template literally. Replace every `{{placeholder}}` with the actual value from the finding. Do not omit any sentence.

```
You are fixing a confirmed {{type}} finding in this codebase.

Route: {{route}}
File(s) to change: {{file}} (identify the route handler or middleware that serves {{route}})

Current behavior: {{current_behavior}}

Required behavior: {{required_behavior}}

Instructions:
1. Locate the server-side handler or middleware responsible for {{route}}.
2. Implement the fix described under "Required behavior" above.
3. Do not rely on client-side guards — the fix must be enforced on the server.
4. Write or update a test that:
   a. Reproduces the current wrong behavior (the test should fail before your fix).
   b. Passes after your fix is applied.
5. Run the test suite and confirm the new test passes and no existing tests regress.
6. Summarize the change in one sentence as a commit message suggestion.
```

**Placeholders:**

| Placeholder | Source |
|---|---|
| `{{type}}` | `finding.type` (security, bug, ux-friction) |
| `{{route}}` | `finding.route` |
| `{{file}}` | Infer from the route and codebase structure; if unknown, write "the file that handles {{route}}" |
| `{{current_behavior}}` | Condensed prose from `finding.repro` — what the app does wrong |
| `{{required_behavior}}` | `finding.suggestedFix` condensed to one sentence, or a direct statement of correct behavior |

---

## Step 2 — Write the Run Summary

Write `.sleuth/findings/SUMMARY.md` after all per-finding briefs are written. The summary is not a technical document — it is written for a founder or PM who needs to understand run health in under two minutes.

### Summary Structure

#### 1. Run Header

```
# Sleuth Run Summary — <run-id>
```

Below the H1, include a one-line timestamp: `**Run completed:** <date and time in local time>`.

#### 2. Counts Table

A Markdown table with findings broken down by type (columns) and severity (rows). Count only confirmed findings — exclude `expected` type from severity rows but include it as its own row at the bottom labeled "Expected (coverage probes)".

```
| Severity | Security | Bug | UX Friction | Total |
|----------|----------|-----|-------------|-------|
| Critical |          |     |             |       |
| High     |          |     |             |       |
| Medium   |          |     |             |       |
| Low      |          |     |             |       |
| Info     |          |     |             |       |
| Expected |    —     |  —  |      —      |       |
| **Total**|          |     |             |       |
```

Fill in every cell. Use `0` for cells with no findings; do not leave cells empty.

#### 3. ⚠️ Unverified Capabilities

An H2 `## ⚠️ Unverified Capabilities` section placed **immediately after the Counts Table** — before Top 3 Must-Fix Items — so it cannot be missed.

List every critical capability (from the Product Contract's `capabilities` array) or `forbidden` invariant that could NOT be tested this run, and why. Use this format per item:

```
- **<Capability name>** — UNVERIFIED: <reason; include the blocking finding ID if applicable>
  Example: "Prompt-injection resistance — UNVERIFIED: grading call returned 503 throughout the run (F-001)."
```

If every critical capability was exercised this run, write: "All critical capabilities verified this run."

This section must never be omitted, moved to the bottom, or merged into Next Steps. An unverified capability is not a pass.

#### 4. Top 3 Must-Fix Items

An H2 `## Top 3 Must-Fix Items` section. List the three highest-severity confirmed findings (not `expected`) ordered by severity then by sequence number. For each one, write a single line in this format:

```
1. **F-NNN** — [title] (`severity`, `type`) — [one-sentence impact statement]
```

If the run has fewer than three non-`expected` findings, list however many exist. If there are no actionable findings, write "No actionable findings this run."

#### 5. Regression Status

An H2 `## Regression Status` section. Read `.sleuth/regression-memory.json` to produce this section. That file records the red→green history per finding ID: whether previously failing regression checks are now passing. Report it as follows:

- If `regression-memory.json` does not exist yet (first run), write: "No regression history — this is the first recorded run."
- Otherwise, list each finding that was in a `red` state in the prior run and state whether it is now `green` (fixed) or still `red` (still failing). Use this format per finding:

```
- F-NNN: red → green (fixed this run)
- F-NNN: red → red (still failing)
```

Then write one concluding sentence: "N of M tracked regressions are now green." where N is the count of findings that flipped to green and M is the total that were red going in.

#### 6. Next Steps

An H2 `## Next Steps` section. Three to five bullet points, each one a concrete action, not a platitude. Ground each bullet in the actual findings from this run. Examples of the right specificity: "Fix F-001 before any public launch — unauthenticated admin access is a launch blocker." or "F-003 (checkout spinner hang) affects the primary conversion flow; prioritize before the next marketing push." Do not write bullets like "address security issues" or "improve UX."

---

## Worked Example Brief

The following is the complete rendered brief for finding `F-001-admin-route-unprotected`. This is what the file `.sleuth/findings/F-001-admin-route-unprotected.md` would contain. Every section is filled in; nothing is a placeholder.

---

### `.sleuth/findings/F-001-admin-route-unprotected.md`

```markdown
# Unauthenticated access to /admin route returns 200 and renders admin UI

**Severity:** CRITICAL   **Type:** security

## Context

The `/admin` route returns HTTP 200 and renders the full admin dashboard to any visitor,
including unauthenticated users with no session. There is no server-side authentication
check — navigating to `/admin` in a logged-out browser shows the complete admin interface.
The worst-case impact is total: an unauthenticated attacker can read and modify every
user's data, revoke accounts, and access any capability the admin panel exposes.

- **Route:** /admin
- **Flow:** direct-navigation
- **Persona:** developer
- **CWE:** CWE-862 (Missing Authorization)
- **Visibility:** User-visible
- **Root cause / limitations:** No server-side authentication middleware is registered on the /admin route handler; the session guard exists only in the client-side router and is bypassed by direct URL navigation.

## Repro Steps

1. Ensure you are fully logged out (clear cookies and local storage or use a private window).
2. Navigate directly to /admin in the browser address bar.
3. Observe that the server returns HTTP 200 and renders the admin dashboard without
   prompting for authentication.

## Evidence

- `.sleuth/runs/20240612-143022/dev-admin-unauthed-200.png` — screenshot showing the
  admin dashboard rendered in an unauthenticated browser session; address bar shows
  /admin, no login prompt visible.
- Network panel note: GET /admin → 200 OK, Content-Type: text/html; no redirect to
  /login or /auth.

## Suggested Fix

Add a server-side authentication guard to the /admin route handler. The guard should
verify that a valid, authenticated session exists before rendering the response; if not,
redirect to /login with a 302. Do not rely solely on client-side route guards, as they
can be bypassed by direct URL navigation.

## Coding-Agent Prompt

```
You are fixing a confirmed security finding in this codebase.

Route: /admin
File(s) to change: the file that handles /admin (identify the route handler or
middleware that serves /admin and all sub-routes under /admin/)

Current behavior: Navigating to /admin while logged out returns HTTP 200 and renders
the full admin dashboard. There is no server-side session or authentication check on
this route.

Required behavior: Every request to /admin (and any path under /admin/) must be
checked server-side for a valid authenticated session. If the session is missing or
invalid, the server must respond with HTTP 302 and redirect to /login. The check must
happen in server-side middleware — not in client-side route guards, which can be
bypassed.

Instructions:
1. Locate the server-side handler or middleware responsible for /admin.
2. Implement the fix described under "Required behavior" above.
3. Do not rely on client-side guards — the fix must be enforced on the server.
4. Write or update a test that:
   a. Reproduces the current wrong behavior (the test should fail before your fix):
      make an unauthenticated GET /admin request and assert it does NOT return 200.
   b. Passes after your fix is applied: assert the response is a 302 redirect to /login.
5. Run the test suite and confirm the new test passes and no existing tests regress.
6. Summarize the change in one sentence as a commit message suggestion.
```
```

---

The above example is canonical. Every other brief you render should match this structure — only the content changes, not the shape.

---

## Step 3 — Write the HANDOFF.md Artifact (Default, Every Run)

In addition to per-finding briefs and `SUMMARY.md`, every run must write `.sleuth/HANDOFF.md` — a single self-contained resume/handoff document. Write it last, after all briefs and `SUMMARY.md` are complete. This is the **master handoff artifact**: someone picking up the work after this run should be able to read only this file and know exactly what was tested, what broke, and what to do next.

### HANDOFF.md Sections (in order)

#### 1. Run Header

```
# Sleuth HANDOFF — <run-id>
**App:** <app name> — <app URL>
**Environment:** <e.g., local dev / staging / production>
**Date:** <date and time>
```

#### 2. ROE Summary

Summarize the rules of engagement from `.sleuth/roe.json`: target app/URL, which actions were allowed, and which actions were explicitly flagged as costly or record-creating (e.g., "Do not submit real payment flows. Do not send emails to real addresses."). One short paragraph or a labeled list.

#### 3. What the App Is

One to two sentences from the Product Contract describing what the app does and who it is for. This gives a new reader instant orientation.

#### 4. Personas Used

List each persona that was active this run — name, role, and email pattern (e.g., `sleuth+<run-id>-admin@example.test`).

#### 5. Coverage

Bullet list of what was actually tested: routes navigated, flows exercised, security probes attempted (e.g., IDOR probes, auth boundary checks), and any named recipes run (e.g., prompt-injection resistance recipe). Be specific — "visited /dashboard, /settings, /admin; attempted unauthenticated direct navigation to /admin; attempted IDOR on /api/submissions/:id."

#### 6. Findings Table

A Markdown table listing every confirmed finding (exclude `expected`):

```
| ID | Title | Severity | Type | Visibility | Status |
|----|-------|----------|------|------------|--------|
| [F-001](findings/F-001-admin-route-unprotected.md) | Unauthenticated access to /admin | CRITICAL | security | User-visible | Open |
```

Each ID links to its `.md` brief. Status is `Open` unless already fixed this run.

#### 7. ⚠️ Unverified Capabilities

Same list as the SUMMARY.md unverified section. Do not abbreviate or omit. A new reader skimming this file must see this prominently.

#### 8. Regression Status

Same content as the SUMMARY.md Regression Status section: which findings flipped red→green, which are still red, and the summary count.

#### 9. Screenshots / Notes Location

```
**Run artifacts:** `.sleuth/runs/<run-id>/`
```

One line is sufficient. Note any non-standard artifact locations if applicable.

#### 10. Next Steps

Which `$sleuth-*` command to run next (e.g., `$sleuth-regression` to track fixes, `$sleuth-run` with the same persona to re-test unverified capabilities), and any blockers to resolve first (e.g., "Resolve the grading 503 before re-testing prompt-injection resistance").

### Worked Example Skeleton

```markdown
# Sleuth HANDOFF — 20240612-143022

**App:** GradeMirror — http://localhost:3000
**Environment:** Local dev (Next.js dev server)
**Date:** 2024-06-12 14:30

## ROE Summary

Target: http://localhost:3000. Allowed: read-only navigation, form submission with test data, network inspection.
Costly/record-creating actions to avoid: do not submit real payment flows; do not send emails to real addresses.

## What the App Is

GradeMirror is an AI-assisted grading tool for educators. Teachers upload student essays and receive
rubric-aligned scores and annotations generated by a language model.

## Personas Used

- **Teacher (admin):** `sleuth+20240612-143022-teacher@example.test` — full grading access
- **Student (read-only):** `sleuth+20240612-143022-student@example.test` — can view own submissions only

## Coverage

- Routes: /, /login, /dashboard, /submissions, /submissions/:id, /admin, /api/grade
- Flows: login → upload essay → trigger grading → view results; direct navigation to /admin while logged out
- Security probes: unauthenticated direct navigation to /admin; IDOR probe on /api/submissions/:id with another user's ID
- Recipes run: prompt-injection resistance (PARTIAL — see Unverified below)

## Findings

| ID | Title | Severity | Type | Visibility | Status |
|----|-------|----------|------|------------|--------|
| [F-001](findings/F-001-admin-route-unprotected.md) | Unauthenticated access to /admin returns 200 | CRITICAL | security | User-visible | Open |
| [F-002](findings/F-002-grading-503.md) | /api/grade returns 503 for all requests | HIGH | bug | User-visible | Open |

## ⚠️ Unverified Capabilities

- **Prompt-injection resistance** — UNVERIFIED: /api/grade returned 503 throughout the run; grading could not be triggered (F-002).

## Regression Status

No regression history — this is the first recorded run.

## Screenshots / Notes Location

**Run artifacts:** `.sleuth/runs/20240612-143022/`

## Next Steps

1. Fix F-001 (unauthenticated /admin) — launch blocker.
2. Investigate F-002 (/api/grade 503) — likely a missing env key or undeployed function; check server logs.
3. Once F-002 is resolved, re-run `$sleuth-run` targeting the grading flow to verify prompt-injection resistance.
```
