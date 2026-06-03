# Driving Reference Playbook

Sleuth drives the application using whatever computer-use surface Codex has available: OS-level computer use, the Codex in-app browser, or Chrome extension mode. The methodology is surface-agnostic — the instructions in this playbook apply equally to all three modes. You do not need to change your approach based on which surface is active; use whatever is accessible to you and proceed.

Pick your driving surface per `references/browser-tooling.md` (computer-use / in-app browser / Chrome / Playwright). Confirm the app's URL responds before driving.

---

## Run ID

Before doing anything else, record the current time as your run ID. The format is `YYYYMMDD-HHMMSS` using UTC or local time consistently. Example: `20240612-143022`. Every screenshot, note, and finding reference in this run uses this ID. The same run ID is passed to `regression.mjs` at the end of the session.

---

## Test Accounts

Use run-scoped test accounts for every session. Generate a unique email address for each run using the pattern:

```
sleuth+<run-id>@example.test
```

For example: `sleuth+20240612-143022@example.test`. Register all accounts under this email pattern during the session. Never reuse real user credentials. Never reuse an email from a previous run. If the app requires multiple accounts for cross-account testing (see below), append a suffix: `sleuth+20240612-143022-a@example.test` and `sleuth+20240612-143022-b@example.test`.

Before taking any destructive or irreversible action in the app, check `references/safety-roe.md` for prohibited actions. Never perform actions that file bars, regardless of what a test scenario might suggest.

### Budget-Aware Driving

Do not repeat paid or record-creating actions more than needed. Run each such scenario once for the primary observation and once for the false-positive re-drive — that's the ceiling. See `references/safety-roe.md` Cost & side-effects for the full posture, including how to record `costlyActions` and `createsRecords` in `roe.json`. If the app involves AI grading, also read `references/recipes/prompt-injection-grading.md` before driving those flows.

---

## Evidence Capture

For every observation worth recording — whether or not it becomes a finding — save a screenshot and a brief note. Screenshots go to:

```
.sleuth/runs/<run-id>/
```

Name screenshots descriptively, for example `dev-admin-unauthed-redirect.png` or `persona-1-checkout-spinner-hang.png`. For each screenshot, write a companion note that records: which persona was active, which step in the flow you were on, what you expected to see, what you actually saw, and any visible console or network anomalies. These paths are referenced in a finding's `evidence` array later.

---

## Order of Operations

Run passes in this exact order: the developer/power pass first, then one pass per ICP persona. Do not interleave passes.

### Pass 1 — Developer / Power Pass

The developer persona is a technical actor whose job is to exercise every critical capability listed in the Product Contract and then deliberately stress the app. Complete two sub-phases in order:

**Sub-phase A — Happy path coverage**: Work through each capability marked `critical: true` in `.sleuth/product-contract.json`. Use the detect-stack output (routes, apiRoutes, forms) to ensure you reach every significant surface. Your goal here is to confirm the core functionality works before probing its limits.

**Sub-phase B — Pushing to limits**: After completing the happy paths, run the following checklist against every form, route, and API endpoint you discovered. Work through it methodically; do not skip items.

- [ ] **Invalid inputs**: Submit forms with missing required fields, wrong data types, invalid formats (e.g., letters in a numeric field, malformed email, special characters `<script>`, `'`, `--`, `\x00`).
- [ ] **Boundary inputs**: Submit values at and just beyond length limits — a 0-character input where 1 is minimum, a 256-character string where 255 is maximum, a negative number where positive is required, and an extremely long string (1000+ characters) in every free-text field.
- [ ] **Empty and oversized inputs**: Submit completely blank forms. Paste a multi-kilobyte payload into a single text input.
- [ ] **Double-submit and rapid re-click**: Submit a form twice in rapid succession (click the submit button twice before the response arrives). Click action buttons multiple times quickly. Check for duplicate records, double charges, or conflicting state.
- [ ] **Browser back and refresh mid-flow**: Use the browser back button during a multi-step flow (e.g., partway through checkout or onboarding). Reload the page mid-flow. Confirm the app recovers gracefully and does not lose or corrupt data.
- [ ] **Direct navigation to guarded routes**: Using the `forbidden` array from `.sleuth/product-contract.json` and the `routes` and `apiRoutes` from detect-stack output, navigate directly to every route that should be protected. Do this while unauthenticated. Do this while authenticated as a low-privilege role. Record what the app returns.
- [ ] **Auth and role boundaries**: Log out and then attempt to reach every route that requires authentication by navigating directly to its URL. If the app has multiple roles, log in as the lowest-privilege role and attempt to reach routes and API endpoints that require a higher-privilege role.
- [ ] **Cross-account / IDOR probe**: Register two separate accounts using the `-a` and `-b` suffixed run-scoped emails. As account A, create a resource (a post, a project, a record — whatever the app supports). Note the resource's ID in the URL or API response. Log in as account B and attempt to read, edit, or delete account A's resource by using that ID directly in the URL or an API call.
- [ ] **Broken and abandoned flows**: Start a multi-step flow and abandon it at each step (close the tab, navigate away, let a session expire if feasible). Return and observe whether the app handles the interrupted state cleanly — no stuck UI, no orphaned data, no error on re-entry.

### Pass 2+ — ICP Persona Passes (one pass per persona)

After the developer pass is complete, run one pass for each ICP persona defined in `.sleuth/personas/`. For each persona:

1. Open a fresh browser session (clear cookies and local storage, or use a private/incognito window) so the session is fully isolated from the developer pass and from prior persona passes.
2. Register a new account using the run-scoped email pattern for this persona, or use an existing account if the persona file specifies one.
3. Read the persona's `goal` field. Drive the app as that persona pursuing that goal — not as a tester looking for bugs. Behave as that person would: follow the UI labels literally, read the copy, make the choices the persona would make.
4. Execute each behavior listed in the persona's `edgeBehaviors` naturally within the flow of pursuing the goal. Do not perform them as a checklist divorced from the goal — weave them in as the persona would realistically encounter them.
5. Capture evidence for every friction point, unexpected result, or failure, even if you are not certain it is a bug. Judge later; observe now.

#### Friction Hunting Checklist (ICP passes)

For each persona pass, record not only hard failures but also confusion and friction. Specifically look for:

- [ ] Unclear or missing error messages — the persona sees a dead end with no explanation.
- [ ] Ambiguous calls to action — two or more options that look equivalent; the right next step isn't obvious.
- [ ] No feedback after an action — form submits, nothing changes, no confirmation, no error.
- [ ] Surprising or empty states — a dashboard with no data and no onboarding prompt; a search with no results and no guidance.
- [ ] Slow or multi-step flows that should be simple — tasks the persona would expect in one click that require three screens.
- [ ] Things the persona has to guess — labels that use internal jargon, tooltips that don't exist, help text that's missing.

Tag findings of this type as `ux-friction`. Note: **a clean run with zero friction findings across three personas is a signal you may not have probed hard enough.** A real, hurried user of this type would hesitate or give up somewhere — actively look for where.

---

## Notes on Evidence Quality

A screenshot without context is nearly useless. Every screenshot must have a companion note. The note must answer: who (persona kind), where (route and step), what was expected, what was seen. If the browser console or network panel shows an error, 4xx/5xx response, or unexpected request, include that in the note verbatim. These details are what allow the judging phase to assign severity correctly and allow a coding agent to reproduce the issue without your session.

### Correlating Failures with the Backend (Root Cause, Not Just Symptom)

When you observe a failed request (4xx/5xx) or unexpected behavior in the browser, do not stop at the browser surface. Use your non-browser tools to go deeper before judging the finding:

1. **Read the dev-server terminal output** — look for stack traces, middleware errors, or startup warnings printed when the request hit.
2. **Check platform or function logs** — for Supabase: `supabase functions logs <function-name>`; for containerized apps: the container's stdout; for Node servers: the terminal where `npm run dev` is running.
3. **Read the relevant source file** — find the handler or route that should have responded and check whether the logic is correct.

From this, determine whether the root cause is:

- **CONFIG/ENV**: a missing or wrong environment variable, a function not deployed, an API key revoked, a rate limit hit — the code is fine but the environment isn't wired up.
- **CODE DEFECT**: the logic itself is wrong, regardless of environment.

Record the cause when known. If the backend isn't inspectable (e.g., production black-box), note "symptom only — needs backend access" in the finding rather than guessing the cause.
