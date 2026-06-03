---
name: sleuth-security
description: Security-focused drive of your own running web app. Authorized defensive testing only. Trigger on "is my app secure", "security check", "pentest my app", "check auth", "find vulnerabilities", "pre-launch security". Requires a running app URL.
---

# Sleuth Security — Authorized Defensive Testing

Security-focused drive of the developer's own app. Tests auth, authorization,
role escalation, IDOR, and missing headers. Authorized use only.

**Inputs:** path to the app's repo + running URL (default `http://localhost:3000`).
`run-id` = `YYYYMMDD-HHMMSS`.

## Phase 0 — Scope gate (STRICT)
Read `references/safety-roe.md`. Emphasize default-deny. Confirm:
- Target is `localhost` OR user has explicitly approved the external host in writing.
- User confirms they own or are authorized to test this app.
- Stop and ask if either is unclear. Write `.sleuth/runs/<run-id>/roe.json`.

## Pre-check — Product Contract
Ensure `.sleuth/product-contract.json` exists with `forbidden` + `roles` populated.
If missing, run:
```bash
node scripts/scaffold.mjs init <repo-path>
node scripts/detect-stack.mjs <repo-path>
```
Then draft + validate per `references/product-contract.md` before proceeding.

## Phase 1 — Security drive
Read `references/driving.md` (security subset — pushing-to-limits checklist).
Use a developer/adversarial persona. Drive these checks:

1. **Direct navigation to guarded routes** — routes listed in Product Contract `forbidden` + apiRoutes from detect-stack output; attempt access while logged out.
2. **Logged-out access to protected routes** — systematically try every route that requires auth.
3. **Low-privilege → admin role escalation** — log in as lowest-privilege role; attempt to access admin-only functionality.
4. **Cross-account / IDOR probe** — use two separate test accounts; attempt to access each other's resources via ID manipulation.
5. **Missing security headers** — check for `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`.

Capture screenshots + notes to `.sleuth/runs/<run-id>/`.

## Phase 2 — Judge + brief (CWE-tagged)
Read `references/judging.md` then `references/briefs.md`. Classify findings with CWE mapping:

| Finding type | CWE |
|---|---|
| Missing auth check | CWE-862 |
| Incorrect authorization | CWE-863 |
| IDOR / insecure direct object reference | CWE-639 |
| Sensitive data exposure | CWE-200 |
| Missing security controls / headers | CWE-693 |

Write validated findings to `.sleuth/findings/F-*.json` (include `cwe` field) and render
`F-*.md` briefs + `SUMMARY.md`.

## Phase 3 — Regression memory
```bash
node -e "const fs=require('fs'),d='.sleuth/findings';const a=fs.readdirSync(d).filter(f=>/^F-.*\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(d+'/'+f,'utf8')));fs.writeFileSync(d+'/_all.json',JSON.stringify(a,null,2))"
node scripts/regression.mjs record .sleuth/regression-memory.json <run-id> .sleuth/findings/_all.json
```
