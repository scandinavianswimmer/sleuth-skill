# Judging Reference Playbook

After driving is complete, you have a set of observations backed by screenshots and notes. This playbook tells you how to turn those observations into validated findings and write them to disk.

---

## Step 1 — Classify Every Observation

Every observation must be classified into exactly one `type`. Use the Product Contract (`.sleuth/product-contract.json`) as the reference for what the app is supposed to do.

| Type | When to use |
|---|---|
| `bug` | The app behaves in a way that violates its intended behavior — an error is thrown, a value is wrong, a flow fails to complete, an expected side effect does not happen. The Product Contract's `capabilities` array is the authority on intended behavior. |
| `security` | The observation violates a `forbidden` invariant in the Product Contract, exposes data that should be private, breaks an authentication or authorization boundary, or violates a tenant isolation rule. Security findings are always promoted above bug findings of the same surface because their impact extends to other users and systems, not just the actor who triggered them. |
| `ux-friction` | The app works correctly — it does what it is supposed to do — but the flow confuses, slows, or blocks the persona from achieving their goal. Friction includes misleading labels, missing error messages, unclear recovery paths, slow feedback, and UI states that leave the user uncertain about what happened. Friction that causes a critical-path user to abandon a flow can be `medium` or `high` severity, but it is never `critical`. |
| `expected` | The behavior is correct. Record it anyway when it was a probe that could plausibly have been a bug (e.g., you attempted an IDOR and were correctly denied). Expected records prove coverage and prevent the same probe from being re-flagged in a regression run. |

A single observation maps to exactly one type. If an observation is both a bug and a security issue, classify it as `security` — the more severe class wins.

---

## Step 2 — Classify Visibility

Every finding must also have a `visibility` field set to one of two values:

| Value | Meaning |
|---|---|
| `user-visible` | The persona is blocked or sees a broken or incorrect state in the UI — the problem is directly observable without opening devtools. |
| `hidden` | The problem appears only in the console, network panel, or server logs (e.g., a background 403 on a secondary request) while the UI continues to work and the persona can complete their task. |

Set this field on the finding JSON alongside `type` and `severity`.

---

## Step 3 — Assign Severity

Use the following rubric. Apply it to the worst-case realistic impact, not the happy-path impact.

| Severity | Meaning |
|---|---|
| `critical` | Data loss, authentication bypass, cross-tenant data leak, or a core flow that is completely broken for all users. Any finding where an unauthenticated or unauthorized actor can access, modify, or destroy data belonging to another user or to the system is automatically `critical`. |
| `high` | A security misconfiguration that does not yet leak data but creates an exploitable condition (e.g., a missing security header that enables a known attack class), or a critical capability from the Product Contract that is broken for a meaningful subset of inputs or users. |
| `medium` | A non-critical bug that causes incorrect behavior under specific conditions, or significant friction on a critical path that would cause a real user to struggle or abandon the flow. |
| `low` | A minor bug with low impact, minor friction that affects edge cases, or a cosmetic issue that could reasonably confuse users. |
| `info` | An `expected` finding, or an observation that is purely informational — no defect, no friction, no security issue. |

When in doubt between two adjacent levels, consider: would a reasonable product manager block a release on this? If yes, go higher.

### Severity calibration with visibility

Visibility modifies severity in these specific ways — apply these rules after the base rubric above:

- A `user-visible` failure of a CRITICAL capability (per the Product Contract's `capabilities` array) → `high` or `critical`. Do not downgrade based on frequency.
- A `hidden` issue with **no** user-facing, data, or security impact → cap at `low` or `medium`; record it but do not over-escalate. These are often noisy background errors that a real user never notices.
- **EXCEPTION — hidden issues with security or data risk stay elevated:** A `hidden` issue that implies an auth bypass, data leak, or cross-tenant access is `high` or `critical` regardless of visibility. Visibility lowers severity only for benign hidden noise, never for security-relevant issues.
- **Noisy-but-non-functional vs. functional break:** Explicitly distinguish these two cases. Example: if all reads return 200 and only a redundant or vestigial write call returns 403 while the app continues to work normally, that is "noisy but non-functional" — classify as `low` or `medium` with `visibility: "hidden"` and note in the brief that the real fix may be removing the dead call rather than patching a deep bug. Do not escalate this to `high` or `critical`.

---

## Step 4 — CWE Guidance for Security Findings

Security findings must include a `cwe` field. Use the following mappings as your starting point:

- Accessing a route without authentication because no server-side guard exists → **CWE-862** (Missing Authorization)
- Performing an action (create, update, delete) without the required permission → **CWE-863** (Incorrect Authorization)
- Accessing or modifying another user's resource by guessing or manipulating an ID → **CWE-639** (Authorization Bypass Through User-Controlled Key)
- Sensitive data (PII, tokens, credentials, internal IDs) exposed in a response, URL, or page that should not contain it → **CWE-200** (Exposure of Sensitive Information to an Unauthorized Actor)
- Missing or misconfigured security headers (Content-Security-Policy, X-Frame-Options, Strict-Transport-Security, etc.) → **CWE-693** (Protection Mechanism Failure)

If the finding maps to a more specific CWE not listed above, use it. These are defaults, not an exhaustive list.

---

## Step 5 — False-Positive Gate (REQUIRED)

Before committing any finding, you must re-drive the exact reproduction steps one more time from scratch. This is not optional.

Reset to the pre-condition state — log out, clear session state, return to the starting URL — and execute every step in the `repro` array exactly as written. Only commit the finding if the issue reproduces on this second attempt.

Apply extra scrutiny to the following cases, which are common false-positive sources:

- **Working authentication flows**: A login page that renders for an unauthenticated user is correct behavior. Do not flag it as an unprotected route. Confirm that after a successful login, the protected content becomes accessible and, conversely, that logging out removes access.
- **Expected redirect chains**: Some apps redirect `/admin` to `/admin/dashboard` before a further redirect to `/login`. Confirm the final response is a denial (redirect to login, HTTP 401, or HTTP 403), not a 200 with protected content.
- **Transient errors**: A 500 that appeared once during a boundary-input test may be a transient condition. Reproduce it deliberately using the exact same input before classifying it as a bug.

If the issue does not reproduce on the second attempt, discard the observation. Do not file it as `low` or `info` — discard it entirely.

---

## Step 6 — Symptom vs. Root Cause

Classify a finding by the **observed symptom** (what the browser/app actually did wrong). Then attempt root cause via backend correlation: read dev-server output, server logs, or source code (see `references/driving.md` for how to inspect backend output during a run).

- If you can trace the symptom to a specific code path or configuration gap, state the root cause in the finding brief.
- If the backend is not inspectable (no logs accessible, no source access), the brief's **Root cause / limitations** line must say: "Symptom only — needs backend access." Do NOT assert a code defect when a config/env cause (missing env key, undeployed function, rate limit, external service outage) is equally likely.

---

## Step 7 — UNVERIFIED Capabilities

If a finding **blocks the testing** of a critical capability (from the Product Contract's `capabilities` array) or a `forbidden` invariant — for example, a grading endpoint returning 503 prevents you from testing prompt-injection resistance — then that capability is **UNVERIFIED** for this run.

Record it explicitly:

1. Note the UNVERIFIED capability in the finding's brief under a "⚠️ Unverified" callout.
2. Surface it in `SUMMARY.md` and `HANDOFF.md` (see `references/briefs.md`).

An UNVERIFIED capability is **not a pass**. Do not record it as `expected` and do not omit it from the summary. The next run should prioritize verifying it once the blocker is resolved.

---

## Step 8 — Write the Finding

Write one JSON finding per confirmed issue to:

```
.sleuth/findings/F-NNN-<slug>.json
```

`NNN` is a zero-padded sequence number starting at 001, incrementing per run. The slug is a short hyphen-separated description of the issue, for example `admin-route-unprotected` or `checkout-double-submit-duplicate-order`.

After writing the file, validate it:

```bash
node scripts/scaffold.mjs validate finding .sleuth/findings/F-NNN-<slug>.json
```

The command must print `valid`. If it prints errors, fix the JSON and re-validate before proceeding to the next finding.

Required fields: `id`, `title`, `type`, `severity`, `visibility`, `repro` (array of strings), `evidence` (array of strings).

Optional but strongly recommended fields: `route`, `flow`, `persona`, `cwe` (required for all `security` findings), `suggestedFix`, `codingAgentPrompt`.

The `codingAgentPrompt` field, when present, is a self-contained prompt a coding agent can use to fix the issue without any other context. Write it as if the coding agent has never seen this session — include the route, the symptom, and the expected behavior after the fix.

---

## Worked Example

The following is a complete, validated finding for an unprotected `/admin` route. The JSON is identical to what was validated by `node scripts/scaffold.mjs validate finding` and can be used as a template.

```json
{
  "id": "F-001-admin-route-unprotected",
  "title": "Unauthenticated access to /admin route returns 200 and renders admin UI",
  "type": "security",
  "severity": "critical",
  "visibility": "user-visible",
  "route": "/admin",
  "flow": "direct-navigation",
  "persona": "developer",
  "cwe": "CWE-862",
  "repro": [
    "Ensure you are fully logged out (clear cookies and local storage or use a private window).",
    "Navigate directly to /admin in the browser address bar.",
    "Observe that the server returns HTTP 200 and renders the admin dashboard without prompting for authentication."
  ],
  "evidence": [
    ".sleuth/runs/20240612-143022/dev-admin-unauthed-200.png — screenshot showing the admin dashboard rendered in an unauthenticated browser session; address bar shows /admin, no login prompt visible.",
    "Network panel note: GET /admin → 200 OK, Content-Type: text/html; no redirect to /login or /auth."
  ],
  "suggestedFix": "Add a server-side authentication guard to the /admin route handler. The guard should verify that a valid, authenticated session exists before rendering the response; if not, redirect to /login with a 302. Do not rely solely on client-side route guards, as they can be bypassed by direct URL navigation.",
  "codingAgentPrompt": "The /admin route is accessible without authentication. Add a server-side middleware guard that checks for a valid authenticated session on every request to /admin (and any sub-routes under /admin). If the session is missing or invalid, redirect the request to /login with HTTP 302. Verify the fix by navigating to /admin in a logged-out browser and confirming you are redirected rather than shown the admin UI."
}
```

This finding uses `type: "security"` because it violates the authorization boundary (the `forbidden` array in the Product Contract should list unauthenticated admin access as prohibited). The severity is `critical` because an unauthenticated actor can access the full admin interface, which typically allows reading and modifying all user data. The `visibility` is `user-visible` because the persona directly observes the broken state (the admin dashboard renders in a logged-out browser) — no devtools inspection is required to notice the problem. The CWE is CWE-862 because there is no server-side authorization check at all — the missing check, not an incorrect one, is the root cause. The `repro` array is written so that a developer who was not present during the session can reproduce the issue in under two minutes. The `evidence` array references the exact screenshot path under the run directory and includes the raw network observation that corroborates the screenshot.

After all confirmed findings are written as individual `F-NNN-<slug>.json` files, Phase 5 assembles them into `.sleuth/findings/_all.json` (an array) for the regression store — see SKILL.md Phase 5.
