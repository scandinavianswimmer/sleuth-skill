# Browser Tooling Reference Playbook

Sleuth describes **what** to test — the flows to drive, the probes to run, the evidence to capture. It does not mandate **how** the browser is controlled. Use whatever driving surface Codex has available in the current environment and proceed. The method is surface-agnostic; the instructions in `driving.md`, `judging.md`, and every recipe file apply equally regardless of which surface is active.

---

## Confirm the App Is Running First

Before selecting a surface, verify the target URL is reachable. Sleuth does **not** start the app unless explicitly told to. Make a lightweight check — a `HEAD` request, a quick `fetch`, or simply navigating to the base URL and confirming the page loads. If the URL returns a connection-refused error, a DNS failure, or a blank timeout, stop immediately and ask the user to start the app and tell you which port it is on. Do not assume a default port and proceed; an unreachable target wastes the entire session and produces no valid findings.

---

## Surface Preference and Detection Order

Evaluate surfaces from top to bottom and use the first one that is available. Do not try to use a lower-ranked surface if a higher-ranked one works.

### 1. Codex Computer-Use (OS-level)

**What it is:** Codex app's OS-level computer-use capability — full desktop control via screenshots, mouse, and keyboard at the operating-system layer. This is only available inside the Codex desktop application; it is geo-restricted and must be explicitly enabled by the user.

**How to tell if it is available:** The `computer_use` tool (or equivalent OS-control action) is present in your tool list and returns a valid screenshot when called.

**How to use it:** Open the browser application (Chrome, Firefox, Safari) using computer-use actions. Navigate to the target URL by clicking the address bar and typing. Drive the app by clicking, typing, and scrolling via OS-level mouse and keyboard actions.

**Evidence capture:**
- **Screenshots:** Issue a screenshot action after each significant step. Save the image to `.sleuth/runs/<run-id>/`. Name files descriptively (e.g., `dev-checkout-submit.png`).
- **Console logs:** Open DevTools (F12 or Cmd+Option+I) using computer-use actions. Switch to the Console tab before a step you want to observe; read visible console output after the action. If the console is too large to read in a single screenshot, scroll and capture multiple frames.
- **Network activity:** Switch to the Network tab in DevTools before initiating a request. After the action, read the relevant request rows. Record method, URL, status code, and any notable response headers or payload fragments.

### 2. Codex In-App Browser

**What it is:** The purpose-built browser surface embedded in the Codex app, designed specifically for local web app testing. It provides direct navigation, click, type, and screenshot primitives without requiring OS-level control.

**How to tell if it is available:** Browser navigation and interaction tools (e.g., `browser_navigate`, `browser_click`, `browser_type`, `browser_screenshot`, or their equivalents in your tool list) are present and responsive.

**How to use it:** Call the navigation tool with the target URL. Interact with page elements using the provided click/type tools. No external process needs to be launched.

**Evidence capture:**
- **Screenshots:** Call the screenshot tool after each significant step. Save to `.sleuth/runs/<run-id>/`.
- **Console logs:** Use `browser_console_messages` (or equivalent) to retrieve console output after each action. Record errors, warnings, and unexpected log lines verbatim.
- **Network activity:** Use `browser_network_requests` (or equivalent) to inspect outgoing requests. Record method, URL, status code, and any anomalies (unexpected 4xx/5xx, requests to third-party hosts that should not be called, missing requests that should have fired).

### 3. Chrome Extension Mode

**What it is:** Sleuth driving a real Chrome browser profile via a Chrome DevTools extension or MCP bridge, giving access to the user's real browser state including cookies, local storage, and installed extensions.

**How to tell if it is available:** Chrome DevTools MCP tools (e.g., `chrome-devtools__navigate_page`, `chrome-devtools__click`, `chrome-devtools__take_screenshot`) are present in your tool list.

**How to use it:** Use `chrome-devtools__navigate_page` to open the target URL. Drive the app with `chrome-devtools__click`, `chrome-devtools__fill`, and `chrome-devtools__type_text`. Take screenshots with `chrome-devtools__take_screenshot`.

**Evidence capture:**
- **Screenshots:** Call `chrome-devtools__take_screenshot` after each significant step. Save to `.sleuth/runs/<run-id>/`.
- **Console logs:** Call `chrome-devtools__list_console_messages` (or `get_console_message`) after actions that might produce errors. Record errors and warnings verbatim.
- **Network activity:** Call `chrome-devtools__list_network_requests` after form submissions and navigation. Record status codes and response bodies for requests that look anomalous.

### 4. Playwright

**What it is:** A browser automation library that controls Chromium, Firefox, or WebKit. It can be invoked either via a Playwright MCP server (if one is configured) or directly via a local `@playwright/test` installation. Playwright is the standard fallback when no higher-ranked surface is available.

**How to tell if it is available:**
- **Playwright MCP:** Tools named `playwright__browser_navigate`, `playwright__browser_click`, `playwright__browser_screenshot`, etc. are present in your tool list.
- **Local Playwright:** Run `npx playwright --version` in the repo directory. If it exits with a version string, Playwright is installed. If it exits with an error, it is not installed.

**How to use it (MCP):** Call `playwright__browser_navigate` with the target URL. Drive with `playwright__browser_click`, `playwright__browser_fill`, `playwright__browser_type`, and similar. Capture screenshots with `playwright__browser_take_screenshot`.

**How to use it (local script):** Write a short script in the target repo's test directory using `@playwright/test` or `playwright` directly. Attach event listeners before any navigation (see Evidence Capture below). Run with `npx playwright test <script>` or `node <script>`.

**Evidence capture (MCP):**
- **Screenshots:** Call `playwright__browser_take_screenshot` after each significant step. Save to `.sleuth/runs/<run-id>/`.
- **Console logs:** Call `playwright__browser_console_messages` after actions. Record errors and warnings.
- **Network activity:** Call `playwright__browser_network_requests` or `playwright__browser_network_request` to inspect specific requests.

**Evidence capture (local script):** Attach listeners before any navigation so no events are missed:

```javascript
page.on('console', msg => console.log('[console]', msg.type(), msg.text()));
page.on('response', res => {
  if (res.status() >= 400) {
    console.log('[network]', res.status(), res.url());
  }
});
```

Capture screenshots at key steps with `await page.screenshot({ path: '.sleuth/runs/<run-id>/<name>.png' })`.

**Playwright availability handling:**

If Playwright MCP tools are present, prefer them — no installation step needed.

If the local `@playwright/test` package is not installed, install it before running any test:

```bash
npm i -D @playwright/test
```

If the Playwright browser binaries are not installed (you see an error like "Executable doesn't exist" or "browserType.launch: Failed to launch"), install the Chromium binary:

```bash
npx playwright install chromium
```

Note: this downloads approximately 100–150 MB. In a constrained or offline environment where this download is not feasible, do not attempt the install silently. Instead, stop and tell the user: "Playwright browser binaries are not installed. Running `npx playwright install chromium` would download ~150 MB. Please confirm you want to proceed, or enable a different driving surface." Then wait for the user's response before continuing.

**Headed vs. headless:** Prefer headed mode (`headless: false`) for realistic rendering — some apps behave differently with a real GPU context, and headed runs catch visual regressions that headless misses. Use headless as a fallback when a display is unavailable (e.g., a remote CI machine without Xvfb). For CI environments, `chromium-headless-shell` is a lighter-weight headless binary included with Playwright; use it when full headed mode is unavailable and you want the fastest possible run.

---

## If No Browser Surface Is Available

If none of the four surfaces above is available — no computer-use, no in-app browser, no Chrome extension, no Playwright — stop immediately. Do not attempt to continue the driving phase. Tell the user exactly what to enable:

> No browser driving surface is available. To proceed, do one of the following:
>
> 1. **Enable computer-use in the Codex app** — go to Settings in the Codex desktop app and enable computer-use. Note: this feature is only available in the Codex app and may be geo-restricted.
> 2. **Install Playwright** — run `npx playwright install chromium` in the app's repo directory (requires ~150 MB download). If `@playwright/test` is not yet installed, run `npm i -D @playwright/test` first.
> 3. **Use the Codex in-app browser** — open this session inside the Codex desktop app, which includes a built-in browser surface for local web app testing.
>
> Resume this session once one of the above is available.

Do not write findings, do not capture screenshots, and do not attempt any form of headless crawling as a substitute for a real browser surface. A real browser is required to observe JavaScript rendering, dynamic state, and real-world behavior.

---

## Evidence Capture Checklist

This checklist applies regardless of which surface is active. After every observation worth recording — whether or not it becomes a finding — complete all three items before moving to the next step:

- [ ] **Screenshot saved to `.sleuth/runs/<run-id>/`** — file name is descriptive of the persona, step, and observation (e.g., `persona-2-signup-email-error.png`). File must exist on disk before moving on.
- [ ] **Companion `.md` note written alongside the screenshot** — the note records:
  - Which persona was active (developer, or the persona's `kind` field)
  - Which route or step in the flow you were on
  - What you expected to see
  - What you actually saw (including visible error messages verbatim)
  - Any console errors or warnings observed during this step (copy them verbatim)
  - Any network anomalies: unexpected status codes, missing requests, requests to unexpected hosts
- [ ] **Console and network state checked** — even if the visible UI looks correct, check the console and network layer after every form submission and every navigation that triggers a server request. Silent 4xx/5xx errors and unhandled promise rejections are bugs even when the UI does not surface them.

A screenshot without a companion note is not valid evidence. A note without the console/network check is incomplete. Both items are required before a finding can be written.

The note file lives alongside the screenshot: if the screenshot is `.sleuth/runs/<run-id>/dev-checkout-submit.png`, the note is `.sleuth/runs/<run-id>/dev-checkout-submit.md`. The note's evidence entries are what get referenced in the `evidence` array of each finding JSON; see `references/judging.md` for how to write those references.
