# Driving Reference Playbook

Sleuth drives the application using whatever computer-use surface Codex has available: OS-level computer use, the Codex in-app browser, or Chrome extension mode. The methodology is surface-agnostic — the instructions in this playbook apply equally to all three modes. You do not need to change your approach based on which surface is active; use whatever is accessible to you and proceed.

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

---

## Notes on Evidence Quality

A screenshot without context is nearly useless. Every screenshot must have a companion note. The note must answer: who (persona kind), where (route and step), what was expected, what was seen. If the browser console or network panel shows an error, 4xx/5xx response, or unexpected request, include that in the note verbatim. These details are what allow the judging phase to assign severity correctly and allow a coding agent to reproduce the issue without your session.
