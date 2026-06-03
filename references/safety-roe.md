# Safety and Rules of Engagement (ROE) Reference Playbook

This playbook defines what Sleuth is and is not allowed to do before any browser driving begins. It is **Phase 0** of the skill — the scope gate runs before Phase 1 (detect-stack), before Phase 2 (planning), and before Phase 3 (driving). Nothing else executes until this gate clears.

---

## Framing

All security probing in Sleuth is authorized defensive validation of the user's own application. The goal is to find real vulnerabilities before real attackers do, using the same techniques, but within an explicit, agreed-upon scope. This is not penetration testing of third-party systems. It is not fuzzing production infrastructure with real users on it. If you are ever uncertain whether an action falls inside the authorized scope, **stop and ask the user** rather than proceeding.

The rules below are defaults. The user can expand them by giving explicit confirmation in the session. They cannot be contracted — if the user asks you to perform a forbidden action, decline and explain why.

---

## Phase 0 — Scope Gate

Run this gate at the very start of every session, before any other action.

### Step 0a — Identify the Target

Read the target URL or host from however the user specified it (command-line argument, skill invocation argument, or a `.sleuth/config.json` if present). If no target is specified, ask for one before proceeding.

### Step 0b — Apply the Default-Deny Rule

**Allowed by default (no confirmation needed):**

- `localhost`
- `127.0.0.1`
- Any host matching `*.local` (e.g., `myapp.local`, `dev.local`)
- Any host matching `*.localhost`
- Any host matching `*.test`

These are universally understood as developer-local environments. Sleuth is designed to run here.

**Requires explicit user confirmation before proceeding:**

Any host that does not match the allowed-by-default list above — including but not limited to:

- Deployed staging URLs (e.g., `staging.myapp.com`, `app-staging.vercel.app`)
- Preview deployment URLs (e.g., `pr-42.myapp.vercel.app`)
- Internal corporate URLs on a company domain
- Any URL on a custom domain, even if the user describes it as "my dev environment"
- Any URL containing a live TLD (`.com`, `.io`, `.co`, `.app`, `.net`, `.org`, etc.)

If the target requires confirmation, pause and present the user with this message before doing anything else:

> **Scope confirmation required.** The target `{{target}}` is not a localhost or `.local` address. Sleuth is about to drive a browser against this host. Please confirm:
>
> 1. You own or are authorized to test this application.
> 2. The environment has no real users active during this session (or you accept the risk of testing with real users present).
> 3. The actions Sleuth takes (form submission, direct URL navigation, account creation, IDOR probes) are approved against this environment.
>
> Reply "confirmed" to proceed, or specify any restrictions.

Do not proceed until the user explicitly confirms. If the user adds restrictions (e.g., "don't create new accounts" or "read-only only"), record those restrictions in `roe.json` and honor them throughout the session.

### Step 0c — Apply the Forbidden-Actions List

The following actions are forbidden without explicit per-session confirmation, regardless of target:

| Forbidden Action | Why |
|---|---|
| Submitting a real payment (entering live card credentials and completing a charge) | Causes real financial transactions that cannot be universally reversed. |
| Sending real outbound email or SMS (triggering transactional messages to real addresses) | Spams real users and may violate anti-spam laws. |
| Deleting non-test data (records not created by this Sleuth run) | Irreversible data loss. |
| Any action against an environment with known active real users unless the user has explicitly acknowledged the risk | Disrupts live users. |
| Credential brute-forcing (automated rapid-fire authentication attempts) | Locks accounts, triggers security alerts, may violate law. |
| Network-level attacks (port scanning, SYN flooding, DNS manipulation, ARP spoofing) | Outside the authorized scope of application-layer QA and AppSec. |
| Exploiting a found vulnerability to escalate further (e.g., using admin access to exfiltrate all data) | Sleuth confirms the vulnerability exists; it does not weaponize it. |

If a test scenario naturally leads toward one of these actions, stop, note the finding with the evidence you have, and record in the finding's `repro` array: "Further exploitation was halted per safety ROE — the existence of the vulnerability was confirmed without completing the forbidden action."

---

## Step 0d — Record the ROE File

Before Phase 3 (driving) begins, write the approved scope to disk at:

```
.sleuth/runs/<run-id>/roe.json
```

This file is the authoritative record of what was approved for this run. It is written once, before driving, and not modified afterward. Any action taken during driving must be traceable to a permission recorded here.

### `roe.json` Shape

```json
{
  "runId": "20240612-143022",
  "target": "http://localhost:3000",
  "host": "localhost",
  "environment": "local-dev",
  "allowedActions": [
    "form-submission",
    "account-creation",
    "direct-url-navigation",
    "idor-probe",
    "browser-back-and-refresh",
    "double-submit-probe",
    "unauthenticated-route-probe"
  ],
  "forbiddenActions": [
    "real-payment-submission",
    "outbound-email-or-sms",
    "delete-non-test-data",
    "credential-brute-force",
    "network-level-attack",
    "post-exploitation-escalation"
  ],
  "userRestrictions": [],
  "approvedBy": "user-confirmed-in-session",
  "approvedAt": "2024-06-12T14:30:22Z",
  "notes": ""
}
```

**Field definitions:**

| Field | Type | Description |
|---|---|---|
| `runId` | string | The run ID for this session (format `YYYYMMDD-HHMMSS`). |
| `target` | string | The full base URL being tested (e.g., `http://localhost:3000`). |
| `host` | string | Just the hostname portion (e.g., `localhost`). |
| `environment` | string | Short label: `local-dev`, `staging`, `preview`, `production`, or a user-provided label. |
| `allowedActions` | string[] | Actions explicitly within scope for this run. Use the values from the table below. |
| `forbiddenActions` | string[] | The baseline forbidden list, always present. Extended by user restrictions if any. |
| `userRestrictions` | string[] | Any additional constraints the user stated during confirmation (e.g., `"no-account-creation"`, `"read-only"`). Empty array for local-dev runs with no restrictions. |
| `approvedBy` | string | For local-dev targets (no confirmation needed): `"default-allowed"`. For all other targets: `"user-confirmed-in-session"`. |
| `approvedAt` | string | ISO 8601 UTC timestamp of when Phase 0 completed and driving was authorized. |
| `notes` | string | Any free-form notes from the confirmation exchange. Empty string if none. |

**Standard `allowedActions` values:**

| Value | Meaning |
|---|---|
| `form-submission` | Submitting forms with test data, including boundary and invalid inputs. |
| `account-creation` | Registering new accounts using run-scoped test emails. |
| `direct-url-navigation` | Navigating directly to routes by typing URLs into the address bar. |
| `idor-probe` | Attempting to access another account's resources by ID manipulation. |
| `browser-back-and-refresh` | Using the browser back button and page refresh during multi-step flows. |
| `double-submit-probe` | Clicking submit buttons rapidly to test for duplicate-action handling. |
| `unauthenticated-route-probe` | Navigating to protected routes while logged out. |

Use only values from this table in `allowedActions`. If the user grants an unusual permission, add a human-readable description to `notes` rather than inventing a new enum value.

---

## What to Do If Scope Is Unclear

If at any point during driving you encounter an action that is not clearly covered by the `allowedActions` in `roe.json`, **stop driving, do not perform the action, and ask the user**. Record the question and the user's answer in `.sleuth/runs/<run-id>/roe-addendum.md` (plain text, timestamped). Do not modify `roe.json` after it has been written — the addendum file is the record of in-session scope expansions.

Scope ambiguity is not a reason to guess. The cost of asking is a short delay. The cost of a false assumption is a real-world consequence — a charge, a deleted record, a locked account, a spammed user — that cannot always be undone.
