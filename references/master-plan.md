# Sleuth Master Plan — Phase-Aware Routing

This table is the authoritative decision guide for the `$sleuth` master router.
Check `.sleuth/` state first, then consult what the user asked.

---

## State detection

| Artifact | Check |
|---|---|
| Product Contract | `test -f .sleuth/product-contract.json` |
| Personas | `test -d .sleuth/personas && ls .sleuth/personas/*.json 2>/dev/null` |
| Findings | `test -d .sleuth/findings && ls .sleuth/findings/F-*.json 2>/dev/null` |
| Regression memory | `test -f .sleuth/regression-memory.json` |

---

## Routing decision table

| Project state / signal | Phase | Command(s) to run | Why |
|---|---|---|---|
| No `.sleuth/` at all (greenfield, never tested) | 0 → 1 → 2 → 3 → 4 → 5 | `sleuth-scan` then `sleuth-test` | Must understand the app before testing it |
| Contract + personas exist; code changed or new features shipped | 2 → 3 → 4 → 5 | `sleuth-test` | Prior understanding is still valid; re-drive with updated code |
| Findings exist, user says "did my fix work" / "retest" / "regression" | 5 (diff pass) | `sleuth-retest` | Re-drive only the open/regressed findings; flip resolved ones green |
| User says "is it secure" / "pentest" / "check auth" / "find vulnerabilities" | 3 (security subset) → 4 → 5 | `sleuth-security` | Security-focused drive: guarded routes, role escalation, IDOR, missing headers |
| User says "what is this app" / "who is it for" / "map my app" / understand only | 0 → 1 | `sleuth-scan` | Read-only understanding pass; does NOT drive the app |

---

## Scenario walkthroughs

### A. Greenfield — never tested

**Signals:** No `.sleuth/` directory, or only an empty one.

**Steps:**
1. Run `sleuth-scan` → builds `.sleuth/product-contract.json` and ICP summary.
2. Run `sleuth-test` → creates personas, drives, judges, writes findings + regression memory.

**Outcome:** Full `.sleuth/` state; findings in `.sleuth/findings/`; regression baseline in `.sleuth/regression-memory.json`.

---

### B. Contract exists, code changed / new features

**Signals:** `.sleuth/product-contract.json` exists. User says "test again", "I added a feature", "re-run Sleuth".

**Steps:**
1. Check whether the Product Contract is still accurate — if routes or roles changed significantly, run `sleuth-scan` to refresh it.
2. Run `sleuth-test` — it will re-create or reuse personas, then drive and judge.

**Outcome:** Fresh findings; regression diff against the prior baseline.

---

### C. After a fix — "did it work?"

**Signals:** `.sleuth/regression-memory.json` exists. User says "I fixed it", "check the fix", "retest", "regression".

**Steps:**
1. Run `sleuth-retest` — lists open/regressed findings from regression memory, re-drives each, then runs `regression.mjs diff`.

**Outcome:** Fixed findings flip from `open` → `resolved` (red→green); regressions flagged.

---

### D. Pre-launch security hardening

**Signals:** User says "is my app secure", "pentest", "check auth / authorization", "find vulnerabilities", "pre-launch security check".

**Steps:**
1. Ensure `.sleuth/product-contract.json` has `forbidden` + `roles` populated; if missing, run `sleuth-scan` first.
2. Run `sleuth-security` — adversarial persona, security subset of the driving checklist, CWE-tagged findings.

**Outcome:** Security findings with CWE codes; regression memory updated.

---

### E. Understand only — "just tell me about this app"

**Signals:** User says "what is this app", "who is it for", "explain the app to me", "map the product".

**Steps:**
1. Run `sleuth-scan` only. Does NOT open a browser or drive the app.

**Outcome:** `.sleuth/product-contract.json` + a human-readable summary of the app's purpose, audience, critical capabilities, and forbidden invariants.

---

## Artifact quick-reference

```
.sleuth/
  product-contract.json     ← app purpose, roles, forbidden invariants
  personas/                 ← developer + ICP persona JSON files
  findings/
    F-001.json / F-001.md   ← individual finding + brief
    SUMMARY.md              ← run summary
    _all.json               ← assembled array for regression.mjs
  runs/<run-id>/            ← screenshots, notes, roe.json per run
  regression-memory.json    ← cross-run fingerprint store
```

`run-id` format: `YYYYMMDD-HHMMSS`.
