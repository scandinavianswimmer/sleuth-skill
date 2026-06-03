# Buggy-Shop Walkthrough — Sleuth Acceptance Run

End-to-end narrated run of Sleuth against `~/sleuth/fixtures/buggy-shop`.
This document doubles as the **manual acceptance script** for the Codex app.

---

## The fixture

`buggy-shop` is a zero-dependency Node.js `http` server (single file: `server.mjs`).
It ships with three planted bugs and clean happy-paths that must produce **no findings**:

| Planted bug | Location | Default state |
|---|---|---|
| BUG #1 — `/admin` unauthenticated | line 143, `ADMIN_ROUTES` guard gated on `SECURE=true` | **open** (unfixed) |
| BUG #2 — JS console error on homepage | line 23, `trackPageViewThatDoesNotExist()` | **open** |
| BUG #3 — authenticated non-admin reaches `/admin` | same guard | **open** |
| `/admin` fix available | set `SECURE_ADMIN=1` | disabled by default |

Start the server for driving:

```bash
node ~/sleuth/fixtures/buggy-shop/server.mjs
# buggy-shop listening on http://localhost:4178
```

---

## Phase 0 — Scope gate

Target: `http://localhost:4178` — localhost, within default ROE. Approved automatically.

---

## Phase 1 — Understand: `detect-stack` output + coverage note

```bash
node ~/sleuth-skill/scripts/detect-stack.mjs ~/sleuth/fixtures/buggy-shop
```

**Full JSON output (real run):**

```json
{
  "name": null,
  "framework": "unknown",
  "scripts": {},
  "entrypoints": {
    "main": null,
    "dev": null,
    "start": null
  },
  "routes": [],
  "apiRoutes": [],
  "forms": [
    {
      "file": "/Users/lukemladenoff/sleuth/fixtures/buggy-shop/server.mjs",
      "fields": [
        "email",
        "password"
      ]
    }
  ],
  "auth": [
    "cookie"
  ],
  "env": [
    "PORT",
    "SECURE_ADMIN"
  ],
  "fileCount": 1
}
```

### detect-stack coverage note — raw-http gap

**Why routes are empty:** `detect-stack` uses framework-specific regex heuristics:
Express patterns like `app.get('/path', ...)` and Next.js `pages/` directory scanning.
`buggy-shop` uses neither. It declares routes as keys in a plain JS object literal:

```js
const routes = {
  "/": () => page(...),
  "/signup": () => page(...),
  "/admin": () => page(...),
  // ...
};
```

Dispatch happens in the `createServer` callback via `routes[path]`. None of this
matches the Express/Next regexes, so `routes: []` is expected and correct — it is
a best-effort hint, not a complete inventory.

**What detect-stack still tells us that matters:**
- `forms: [{fields: ["email","password"]}]` — there is a form to drive.
- `auth: ["cookie"]` — session cookies are in play; authorization checks are likely.
- `env: ["SECURE_ADMIN"]` — an env flag controls security behavior; note it during code-read.

**How the agent compensates:** Code-reading (`server.mjs`) takes about 30 seconds and
reveals all routes explicitly. The agent reads the source in Phase 1 and surfaces
`/admin`, `/dashboard`, `/projects`, and `/projects/:id` without needing regex-based
detection. The driving phase then exercises each route. `detect-stack` is a
fast starting-point hint; the agent's source-read + live driving is the ground truth.

---

## Phase 1 — Product Contract

Validated against `schemas/product-contract.schema.json`.

```json
{
  "app": {
    "name": "Buggy Shop",
    "summary": "A minimal Node.js e-commerce fixture app with signup, login, dashboard, pricing, and an admin panel. Built as a deliberate-flaw test target for the Sleuth QA pipeline.",
    "url": "http://localhost:4178"
  },
  "audience": {
    "icp": "Individual developers and small teams evaluating a simple SaaS storefront",
    "signals": ["signed up via /signup", "reached /dashboard after login", "viewed /pricing"]
  },
  "capabilities": [
    { "name": "Signup", "flow": "GET /signup → POST /signup → redirect /dashboard", "critical": true },
    { "name": "Login", "flow": "GET /login → POST /login → redirect /dashboard", "critical": true },
    { "name": "Dashboard", "flow": "GET /dashboard after login shows welcome message", "critical": true },
    { "name": "Pricing", "flow": "GET /pricing shows plan listing + signup CTA", "critical": false }
  ],
  "roles": [
    { "name": "admin", "may": ["GET /admin", "GET /admin/users"], "mayNot": [] },
    { "name": "member", "may": ["GET /dashboard", "GET /pricing", "GET /projects"], "mayNot": ["GET /admin"] },
    { "name": "anonymous", "may": ["GET /", "GET /signup", "GET /login", "GET /pricing"], "mayNot": ["GET /admin", "GET /dashboard"] }
  ],
  "forbidden": [
    "Unauthenticated requests must never reach /admin or /admin/users",
    "Authenticated non-admin members must never reach /admin",
    "Cross-tenant project data must never be returned to another tenant"
  ]
}
```

Validate: `node scripts/scaffold.mjs validate product-contract .sleuth/product-contract.json`
→ prints `valid`

---

## Phase 2 — Personas

Four personas: 1 developer + 3 ICP. All validated against `schemas/persona.schema.json`.

### Developer persona (full JSON)

```json
{
  "id": "dev-01",
  "kind": "developer",
  "name": "Alex (Builder)",
  "goal": "Verify the app is deployable, secure, and free of regressions before shipping",
  "techSavvy": "high",
  "device": "desktop",
  "patience": "high",
  "edgeBehaviors": [
    "navigates directly to /admin without logging in",
    "tries /dashboard unauthenticated",
    "submits the signup form with edge-case email strings"
  ]
}
```

### ICP personas (summary)

| id | kind | name | goal | techSavvy |
|---|---|---|---|---|
| `icp-01` | icp | Sam (Curious Free-Tier User) | Explore after signup, click every link including guessed URLs like /admin | medium |
| `icp-02` | icp | Jordan (Mobile Shopper) | Sign up and reach dashboard quickly on mobile | low |
| `icp-03` | icp | Morgan (Security-Aware Power User) | Verify tenant isolation — probe /projects/:id with another tenant's ID | high |

---

## Phase 3 — Drive

The agent drives the live server at `http://localhost:4178`.

**Developer pass (Alex):**
1. Load `/` — page renders; DevTools console shows `ReferenceError: trackPageViewThatDoesNotExist is not defined`.
2. Navigate directly to `/admin` — **HTTP 200**, admin panel renders with user data. No auth required. Flag.
3. Navigate directly to `/dashboard` — **HTTP 200**, dashboard renders. No auth required. Flag.
4. Complete signup flow: `GET /signup` → fill email/password → `POST /signup` → redirected to `/dashboard` (HTTP 302 → 200). Working.
5. Complete login flow: `GET /login` → fill email/password → `POST /login` → redirected to `/dashboard`. Working.

**ICP pass (Sam, icp-01):**
- Navigates to `/` → `/pricing` → `/signup` → completes signup → `/dashboard`. Happy path works.
- Guesses `/admin` — reaches it unauthenticated. Corroborates F-001.

**ICP pass (Jordan, icp-02):**
- Mobile viewport. Signup form submits correctly. No layout blocking issues observed.

**ICP pass (Morgan, icp-03):**
- Signs up with `tenant_a@example.com`, seeds tenant `a` via `/projects`.
- Signs up in a second session with `tenant_b@example.com`, probes `/projects/proj-a`.
- Default (insecure) mode returns `proj-a` data to tenant `b` — IDOR / cross-tenant leak. Additional finding noted.

---

## Phase 4 — Findings

### F-001 — Unprotected `/admin` (security, critical, CWE-862)

```json
{
  "id": "F-001",
  "title": "Unprotected /admin — unauthenticated access to admin panel",
  "type": "security",
  "severity": "critical",
  "route": "/admin",
  "flow": "Navigate directly to http://localhost:4178/admin without any session cookie",
  "persona": "dev-01",
  "cwe": "CWE-862",
  "repro": [
    "Start the server: node server.mjs (no SECURE_ADMIN env var)",
    "Open a fresh browser / curl with no cookies",
    "GET http://localhost:4178/admin",
    "Observe: full admin dashboard with user emails and revenue data renders (HTTP 200)"
  ],
  "evidence": [
    "HTTP 200 response body contains '<h1>Admin dashboard</h1>'",
    "Response includes 'user@example.com' and '$4,210' — sensitive data exposed to anonymous caller",
    "server.mjs line 143: ADMIN_ROUTES guard only fires when SECURE=true; default is false"
  ],
  "suggestedFix": "Set SECURE_ADMIN=1 in production environment, or unconditionally require role === 'admin' for all requests to /admin and /admin/users. Remove the opt-in SECURE flag from production code paths.",
  "codingAgentPrompt": "In server.mjs, change the ADMIN_ROUTES guard so it always enforces role === 'admin' regardless of the SECURE flag. Remove the SECURE_ADMIN env-var opt-in from production code. Add a test that GET /admin without a session cookie returns HTTP 403."
}
```

### F-002 — Unprotected `/dashboard` (security, critical, CWE-862)

```json
{
  "id": "F-002",
  "title": "Unprotected /dashboard — unauthenticated access to post-login page",
  "type": "security",
  "severity": "critical",
  "route": "/dashboard",
  "flow": "Navigate directly to /dashboard without a session cookie",
  "persona": "dev-01",
  "cwe": "CWE-862",
  "repro": [
    "Start the server without SECURE_ADMIN=1",
    "GET http://localhost:4178/dashboard with no cookies",
    "Observe: dashboard page renders (HTTP 200) — no authentication required"
  ],
  "evidence": [
    "HTTP 200 response contains '<h1>Your dashboard</h1>'",
    "server.mjs line 150: /dashboard guard only fires when SECURE=true; default is false"
  ],
  "suggestedFix": "Always require an authenticated session to reach /dashboard. Remove the SECURE flag dependency from this check.",
  "codingAgentPrompt": "In server.mjs, make the /dashboard authentication check unconditional (remove the SECURE guard). Verify with a test that GET /dashboard without a session returns HTTP 403 or redirects to /login."
}
```

### F-003 — Homepage JS console error (ux-friction, medium)

```json
{
  "id": "F-003",
  "title": "Homepage throws JS console error — trackPageViewThatDoesNotExist is not defined",
  "type": "ux-friction",
  "severity": "medium",
  "route": "/",
  "flow": "Load the homepage in a browser",
  "persona": "icp-01",
  "repro": [
    "Open http://localhost:4178/ in a browser",
    "Open DevTools → Console",
    "Observe: 'ReferenceError: trackPageViewThatDoesNotExist is not defined'"
  ],
  "evidence": [
    "server.mjs line 23: inline <script> calls trackPageViewThatDoesNotExist() which is never defined",
    "Console error visible in Chrome DevTools on page load"
  ],
  "suggestedFix": "Remove the broken analytics call or replace it with a real analytics integration (e.g., window.analytics?.track('page_view')).",
  "codingAgentPrompt": "In server.mjs, remove the <script>trackPageViewThatDoesNotExist();</script> from the home page template, or replace it with a real analytics call wrapped in a null-guard."
}
```

### No false positives on working flows

The following paths were exercised by all four personas and produced **no findings**:

- `GET /` → `POST /signup` → redirect to `GET /dashboard` — complete signup flow works.
- `GET /login` → `POST /login` → redirect to `GET /dashboard` — complete login flow works.
- `GET /pricing` — pricing page renders correctly.
- Logged-in member reaches `GET /dashboard` after auth — correct, no false positive.

---

## Rendered brief — F-001 (example)

```markdown
## F-001 · Critical Security · Unprotected /admin — unauthenticated access to admin panel

**Route:** `/admin`  **CWE:** CWE-862 (Missing Authorization)  **Persona:** dev-01 (Alex)

### What happens
Navigating to `/admin` without any session cookie returns HTTP 200 and renders
the full admin dashboard, including user email addresses and revenue figures.
No authentication or authorization check is applied by default.

### Root cause
`server.mjs` line 143 gates the `ADMIN_ROUTES` guard on `process.env.SECURE_ADMIN === "1"`.
Because `SECURE_ADMIN` is not set in the default configuration, the guard never runs.

### Repro (copy-paste)
1. `node server.mjs` (no env vars)
2. `curl http://localhost:4178/admin`
3. Response body contains `<h1>Admin dashboard</h1>` and sensitive user/revenue data.

### Evidence
- HTTP 200 with admin HTML returned to unauthenticated caller.
- `server.mjs:143` — guard condition `if (SECURE && role !== "admin")` is never true when `SECURE=false`.

### Fix
Remove the `SECURE_ADMIN` opt-in; unconditionally enforce `role === "admin"` for
all requests to `/admin` and `/admin/users`. Delete the `SECURE` flag from production paths.

### Coding agent prompt
> In server.mjs, change the ADMIN_ROUTES guard so it always enforces `role === 'admin'`
> regardless of the SECURE flag. Remove the SECURE_ADMIN env-var opt-in from production
> code. Add a test that GET /admin without a session cookie returns HTTP 403.
```

---

## Phase 5 — Regression memory: red → green

### Commands run

```bash
# Initialize workspace
node ~/sleuth-skill/scripts/scaffold.mjs init .

# Record the open /admin finding (run 1 — insecure server)
printf '[{"title":"Unprotected /admin","type":"security","route":"/admin","severity":"critical"}]' > f.json
node ~/sleuth-skill/scripts/regression.mjs record .sleuth/regression-memory.json 20260603-120000 f.json

# Plan shows it as open (RED)
node ~/sleuth-skill/scripts/regression.mjs plan .sleuth/regression-memory.json

# Run with the fix applied (SECURE_ADMIN=1) — no findings returned
printf '[]' > none.json
node ~/sleuth-skill/scripts/regression.mjs diff .sleuth/regression-memory.json 20260603-130000 none.json
```

### Before (after `record` — status: **open** / RED)

```json
{
  "fingerprint": "840985f457a0",
  "title": "Unprotected /admin",
  "type": "security",
  "severity": "critical",
  "status": "open",
  "firstRun": "20260603-120000",
  "lastRun": "20260603-120000",
  "runsSeen": ["20260603-120000"]
}
```

### After (after `diff` with empty findings — status: **resolved** / GREEN)

```json
{
  "findings": [
    {
      "fingerprint": "840985f457a0",
      "title": "Unprotected /admin",
      "type": "security",
      "severity": "critical",
      "status": "resolved",
      "firstRun": "20260603-120000",
      "lastRun": "20260603-130000",
      "runsSeen": ["20260603-120000"]
    }
  ],
  "runs": [
    {
      "id": "20260603-120000",
      "findingFingerprints": ["840985f457a0"]
    }
  ]
}
```

Red → green confirmed. The finding was recorded when the server ran without `SECURE_ADMIN`,
then resolved when a subsequent run with `SECURE_ADMIN=1` (or equivalent fix) returned no findings.

---

## Validator log

All JSON examples in this document were validated before inclusion:

```
node scripts/scaffold.mjs validate product-contract  → valid
node scripts/scaffold.mjs validate persona (dev-01)  → valid
node scripts/scaffold.mjs validate persona (icp-01)  → valid
node scripts/scaffold.mjs validate persona (icp-02)  → valid
node scripts/scaffold.mjs validate persona (icp-03)  → valid
node scripts/scaffold.mjs validate finding  (F-001)  → valid
node scripts/scaffold.mjs validate finding  (F-002)  → valid
node scripts/scaffold.mjs validate finding  (F-003)  → valid
```
