# Personas Reference Playbook

Personas are the simulated actors Sleuth uses to drive the app. Each persona gets its own browser session, its own goal, and its own behavioral quirks. The quality of the bugs Sleuth surfaces is directly proportional to how realistically the personas behave — a generic "user clicks around" session misses most real-world failure modes. Write personas that reflect the actual diversity of people who use the app.

---

## Step 1 — Inputs

Personas are derived from the Product Contract. Read these two sections before writing anything:

- **`audience`**: The `icp` string tells you who the real users are. The `signals` array tells you why you believe that — use the signals to sharpen each persona's profile (e.g., a signal about a "Solo Instructor" tier means some users run the app alone without technical support).
- **`capabilities`**: The list of capabilities — especially those marked `critical: true` — tells you what each persona should try to accomplish. Every ICP persona's `goal` must tie to at least one real capability from the contract, preferably a critical one.

---

## Step 2 — Default persona set

Unless override flags are passed, Sleuth generates exactly **4 personas by default**: 1 developer persona and 3 ICP personas.

### The developer persona (always 1, always first)

The developer persona probes the app's technical limits rather than its intended happy path. It is always present unless `--no-dev-pass` is passed.

- **`kind`**: `"developer"`
- **`techSavvy`**: always `"high"`
- **`patience`**: always `"high"` — developers methodically work through edge cases
- **`goal`**: Frame around technical validation: "Verify that all authenticated endpoints reject unauthenticated requests, forms handle malformed input gracefully, and no server errors leak stack traces to the browser."
- **`edgeBehaviors`**: Focus on adversarial and boundary probes: accessing protected routes directly without logging in, submitting forms with missing required fields, pasting extremely long strings into text inputs, injecting special characters (`<script>`, `'`, `--`) into fields, calling API endpoints out of order, refreshing mid-flow, opening the same authenticated page in two tabs simultaneously.

The developer persona runs first in every session. Its findings often surface auth bypasses and unhandled server errors before the ICP personas ever start.

### ICP personas (default 3)

ICP personas simulate real users from the product's target audience. Each should have a distinct combination of `techSavvy`, `patience`, and `device` so that the set collectively covers the realistic user population, not just the happy-path power user.

A useful default spread for 3 ICP personas:

1. **Comfortable user** — `techSavvy: "medium"`, `patience: "medium"`, desktop browser. This is the modal user. They know how to use web apps but don't think about tech. They follow instructions, occasionally misread them, and give up if something confuses them for more than a minute.
2. **Low-tech user** — `techSavvy: "low"`, `patience: "low"`, mobile device. They have minimal web literacy. They use their phone. They tap quickly, misread labels, get frustrated fast, and abandon flows that feel broken.
3. **Power user** — `techSavvy: "high"`, `patience: "medium"`, desktop browser. They're experienced with web apps and have high expectations. They use keyboard shortcuts, open multiple tabs, and immediately notice inconsistent UI or slow responses.

### Override flags

- **`--personas N`**: Generate N total personas (still 1 developer + N-1 ICP, or all ICP if `--no-dev-pass` is also set). Minimum 1.
- **`--no-dev-pass`**: Skip the developer persona entirely. Use this when the repo has already been audited for technical issues and you only want user-experience coverage.

---

## Step 3 — Auto-scaling heuristic

This is a heuristic, not a hard rule. Use it to decide whether to add extra ICP personas beyond the default 3 when the app has a large capability surface.

**Formula**: Start with 3 ICP personas. Count the capabilities marked `critical: true` in the Product Contract. For every 3 critical capabilities beyond the first 3, add one extra ICP persona. Cap at 6 ICP personas total.

**Example**: 9 critical capabilities → (9 − 3) / 3 = 2 extra personas → 3 + 2 = 5 ICP personas.

**Why this helps**: Critical capabilities are the flows where a bug has the highest user impact. More personas means more independent attempts at those flows, which surfaces more edge cases. But beyond 6 ICP personas the marginal gain drops sharply and cost rises; the cap keeps sessions practical.

Adjust the formula down if the critical capabilities heavily overlap (e.g., 6 critical capabilities that all funnel through the same checkout form). Use judgment — the formula is a starting point, not a constraint.

---

## Step 4 — Each persona field

### `id` (required, string)

A short slug used in filenames and logs. Use lowercase letters, digits, and hyphens only. The developer persona is always `developer`. ICP personas get descriptive IDs tied to their archetype: `studio-owner`, `new-client`, `power-booker`. Keep IDs unique within the run.

### `kind` (required, enum: `"developer"` | `"icp"`)

Use `"developer"` for the technical probing persona, `"icp"` for all others.

### `name` (required, string)

A human name that matches the persona archetype. The developer persona can just be `"Dev"` or a real name like `"Alex"`. ICP personas benefit from names that carry demographic signal: "Maria (studio owner)", "Priya", "Jordan". The name is used in bug report attribution ("Jordan (low-tech mobile user) could not complete the booking flow because…").

### `goal` (required, string)

A single sentence describing what this persona is trying to accomplish during the session. The goal must tie to a specific capability from the Product Contract. Good goals are observable — you can tell at the end of the session whether they were achieved.

- Good: "Book a spot in the Tuesday 6pm yoga class and receive a confirmation email."
- Bad: "Use the app."

For the developer persona, the goal describes the technical surface to probe rather than a user outcome.

### `techSavvy` (required, enum: `"low"` | `"medium"` | `"high"`)

How much this persona knows about using web apps.

- `"low"`: Struggles with multi-step flows, may not understand form validation messages, uses a mobile device by default, may mistype URLs.
- `"medium"`: Comfortable with standard web patterns (login, checkout, settings). Notices obvious broken UI. Does not inspect network requests.
- `"high"`: Fluent with web apps. Uses keyboard navigation, opens dev tools, expects fast responses, tests edge cases out of curiosity.

### `device` (optional, string)

The browser viewport and input mode this persona uses. Use descriptive strings that the browser driver understands: `"desktop"`, `"mobile-ios"`, `"mobile-android"`, `"tablet"`. Omit if device variation is not relevant to the test run.

Low-tech ICP personas should almost always have `"mobile-ios"` or `"mobile-android"` — that is how low-tech users actually access web apps.

### `patience` (optional, enum: `"low"` | `"medium"` | `"high"`)

How long this persona waits before giving up or rage-clicking.

- `"low"`: Clicks again immediately if nothing happens within 1–2 seconds. Abandons a flow after one confusing step. Likely to double-submit forms.
- `"medium"`: Waits a few seconds, re-reads the page once before giving up.
- `"high"`: Methodically works through the flow, reads error messages, tries alternate approaches.

### `edgeBehaviors` (optional, array of strings)

A menu of realistic off-happy-path behaviors this persona might exhibit. Include 2–5 behaviors per persona. Choose from this list — or write your own with the same level of specificity:

| Behavior | Description |
|---|---|
| `"typos"` | Occasionally types a character wrong in form fields (e.g., email address with a transposed letter). |
| `"double-submit"` | Clicks the submit button a second time immediately if the page doesn't respond in ~1s. |
| `"browser-back-mid-flow"` | Hits the browser Back button partway through a multi-step form, then tries to continue. |
| `"paste-huge-text"` | Pastes an extremely long string (500+ characters) into a text field. |
| `"refresh-after-submit"` | Refreshes the page immediately after clicking submit, before the response arrives. |
| `"abandon-and-return"` | Navigates away mid-flow, then returns and tries to complete the flow from where they left off. |
| `"wrong-format-inputs"` | Enters data in the wrong format (phone number in an email field, letters in a number field, past date in a future-date picker). |
| `"rage-click"` | Clicks the same button repeatedly in quick succession when the page is slow to respond. |
| `"direct-url-navigation"` | Types a deep-link URL directly rather than navigating through the UI. |
| `"tab-key-navigation"` | Uses Tab key to move through form fields rather than clicking. |
| `"copy-paste-from-clipboard"` | Pastes content from an unexpected source (e.g., pasting a rich-text email excerpt into a plain-text field). |
| `"leave-required-fields-blank"` | Submits a form without filling in required fields to see what error messages appear. |

Assign behaviors that are plausible for this persona. A low-patience ICP persona should have `"double-submit"` and `"rage-click"`. A low-tech persona should have `"typos"` and `"wrong-format-inputs"`. The developer persona should have `"direct-url-navigation"`, `"paste-huge-text"`, `"leave-required-fields-blank"`, and `"browser-back-mid-flow"`.

---

## Step 5 — Write and validate

Write each persona to its own file in `.sleuth/personas/`, using zero-padded two-digit numbering followed by the persona ID:

```
.sleuth/personas/00-developer.json
.sleuth/personas/01-studio-owner.json
.sleuth/personas/02-new-client.json
.sleuth/personas/03-power-booker.json
```

The developer persona is always `00`. ICP personas are numbered `01` onward in the order they will run.

Validate each file immediately after writing it:

```bash
node scripts/scaffold.mjs validate persona .sleuth/personas/00-developer.json
node scripts/scaffold.mjs validate persona .sleuth/personas/01-studio-owner.json
# ... etc.
```

The validator prints `valid` on success. Fix any reported errors before moving on. Common mistakes:

- `kind` must be exactly `"developer"` or `"icp"` — not `"dev"`, not `"user"`.
- `techSavvy` must be exactly `"low"`, `"medium"`, or `"high"`.
- `patience` (if included) must be exactly `"low"`, `"medium"`, or `"high"`.
- `edgeBehaviors` must be an array even if it has only one entry.
- `device` is a plain string — use whatever value makes sense for the browser driver.

Do not begin driving the app with any persona that has not successfully validated.

---

## Worked example — YogaBook

The YogaBook app (defined in the Product Contract example) has 3 critical capabilities: "Book a class", "Client account: view my bookings", and "Admin: manage class schedule". Three critical capabilities at exactly the threshold, so the default 3 ICP personas is the right count. Total: 4 personas (1 developer + 3 ICP).

### `00-developer.json`

```json
{
  "id": "developer",
  "kind": "developer",
  "name": "Dev",
  "goal": "Verify that unauthenticated users cannot reach /dashboard or /admin routes, that the booking form handles malformed and duplicate submissions gracefully, and that no server errors expose stack traces to the browser.",
  "techSavvy": "high",
  "patience": "high",
  "device": "desktop",
  "edgeBehaviors": [
    "direct-url-navigation",
    "paste-huge-text",
    "leave-required-fields-blank",
    "browser-back-mid-flow",
    "double-submit"
  ]
}
```

### `01-studio-owner.json` (one full ICP example)

```json
{
  "id": "studio-owner",
  "kind": "icp",
  "name": "Maria",
  "goal": "Log in as an admin, add a new Tuesday 6pm Flow Yoga class with a capacity of 12, then verify it appears on the public class schedule.",
  "techSavvy": "medium",
  "device": "desktop",
  "patience": "medium",
  "edgeBehaviors": [
    "abandon-and-return",
    "browser-back-mid-flow",
    "typos"
  ]
}
```

Validate both:

```bash
node scripts/scaffold.mjs validate persona .sleuth/personas/00-developer.json
# → valid
node scripts/scaffold.mjs validate persona .sleuth/personas/01-studio-owner.json
# → valid
```
