---
name: sleuth-scan
description: Understand a web app without driving it. Builds the Product Contract and ICP summary. Trigger on "what is this app", "who is it for", "map my app", "build the product contract", "understand my app", "explain the app". Does NOT open a browser or test anything.
---

# Sleuth Scan — Understand Only

Read the repo and produce a Product Contract + ICP summary. No browser, no driving.

**Inputs:** path to the app's repo (URL not required for this phase).

## Phase 0 — Scope gate
Read `references/safety-roe.md`. Confirm intended use is read-only analysis of the user's own repo.

## Phase 1 — Initialize + detect
```bash
node scripts/scaffold.mjs init <repo-path>
node scripts/detect-stack.mjs <repo-path>
```

## Phase 2 — Product Contract
Read `references/product-contract.md`. **Locate the real running source first** — the target dir may differ from the served app; record the discrepancy in `app.sourceNote`. Draft `.sleuth/product-contract.json` covering: what the app does, who it's for, roles, forbidden invariants. Validate:
```bash
node scripts/scaffold.mjs validate product-contract .sleuth/product-contract.json
```

## Phase 3 — ICP derivation (no driving personas)
Read `references/personas.md` for ICP signals only. Derive the Ideal Customer Profile
from the Product Contract WITHOUT creating full driving personas. Do not launch a browser.

## Output
Write a short human-readable summary to `.sleuth/scan-summary.md`:
- What the app is and does
- Who it's for (ICP)
- Critical capabilities
- Forbidden invariants
- Recommended next step (`$sleuth-test` to start full beta testing)
