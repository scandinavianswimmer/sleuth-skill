# Accessibility (WCAG 2.2 AA) Reference Playbook

This playbook drives the accessibility pillar of `$sleuth-design`. It tells you which criteria to check, exactly how to check each one, and how to write a well-formed finding when a check fails. All checks target **WCAG 2.2 Level AA**. AA is the legal bar in many jurisdictions — it is the standard referenced by the ADA, Section 508, EN 301 549 (EU), and equivalent national laws. Level AAA is advisory; flag AAA gaps as `low` or `info`, never `high`.

---

## POUR: The Four Principles

WCAG organizes every success criterion under four principles. Understanding which principle an issue lives under helps you explain the impact quickly and group related findings in the summary.

**Perceivable** — Information and user interface components must be presentable to users in ways they can perceive. A user who cannot see the screen must receive equivalent information through text alternatives, captions, or structural markup. A user who cannot distinguish colors must receive information through means other than color alone.

**Operable** — User interface components and navigation must be operable. A user who cannot use a mouse must be able to reach and activate every interactive element via keyboard. Animations that cannot be paused can trigger vestibular disorders. Interactive targets too small for a motor-impaired user's pointer are effectively inaccessible.

**Understandable** — Information and the operation of the user interface must be understandable. Labels, instructions, and error messages must be clear enough that users know what the interface does and how to recover from mistakes.

**Robust** — Content must be robust enough that it can be interpreted reliably by a wide variety of user agents, including assistive technologies. An unlabeled button works visually but is invisible to a screen reader. Invalid ARIA can actively mislead AT.

---

## Checklist by POUR

Each item lists: the WCAG 2.2 success-criterion ID (used verbatim as the `wcag` field on findings), the check method label (**deterministic** or **visual/interaction**), and the specific tool or technique to use.

### Perceivable

#### 1.1.1 — Non-text Content

Every `<img>`, icon, button icon, CAPTCHA, and decorative image must carry a programmatic text alternative. Meaningful images need descriptive `alt` text. Purely decorative images must carry `alt=""` (empty, not absent) so assistive technology ignores them.

**How to check:** Run `node scripts/design-scan.mjs <app-root>` and inspect the `missingAlt` field in the JSON output. Any value greater than 0 is a violation. This is **deterministic** via `design-scan.mjs` on the source. If the app generates `<img>` elements dynamically (e.g., server-rendered HTML, React hydration) and `design-scan.mjs` is scanning source files that do not reflect runtime output, supplement with an axe snapshot: call `chrome-devtools__lighthouse_audit` or inject axe via `chrome-devtools__evaluate_script` and check for rule `image-alt`. The axe check is **deterministic** when a browser surface is available.

#### 1.4.1 — Use of Color

Color must not be the sole means of conveying information, indicating an action, prompting a response, or distinguishing a visual element. For example: a form field that turns red to indicate an error but carries no other cue (icon, text, label change) fails this criterion. A chart that distinguishes data series by color only fails for colorblind users.

**How to check:** This is a **visual/interaction** check. Navigate to every state that communicates meaning — error states, success states, required-field indicators, active/inactive toggle states, chart legends, link text within body text. Observe whether the information is available without relying on color. There is no automated tool that reliably catches this; manual inspection is required.

#### 1.4.3 — Contrast Minimum

Normal text requires a contrast ratio of at least **4.5:1** against its background. Large text — defined as at least 18 pt (≈ 24 CSS px) regular weight, or 14 pt (≈ 18.67 CSS px) bold — requires at least **3:1**. These thresholds apply to all text that conveys information, including text in form fields, buttons, placeholder text, and UI labels. Purely decorative text and logotype text are exempt.

**How to check — deterministic:** Do not eyeball ratios. Pass the foreground and background color pair to `contrast.mjs`:

```
node scripts/contrast.mjs <fg> <bg>
node scripts/contrast.mjs <fg> <bg> --large
```

The script accepts hex (`#112233`, `#abc`), `rgb(r,g,b)`, and `rgba(r,g,b,a)` values. It prints a JSON object with `ratio`, `aa` (boolean), and `aaa` (boolean). The `--large` flag adjusts the threshold to 3:1 / 4.5:1 for large text. A ratio below the threshold is a hard failure.

When a browser surface is available, also run Lighthouse via `chrome-devtools__lighthouse_audit` or run axe (rule `color-contrast`) via `chrome-devtools__evaluate_script`. These are **deterministic** when the browser surface is available. Lighthouse and axe can catch contrast failures that `contrast.mjs` alone cannot find because they have access to the computed CSS styles applied by the browser. Use both: axe/Lighthouse first for coverage, then `contrast.mjs` to confirm specific color pairs with exact ratio values to include in the finding.

**How to check — when no browser surface is available:** Rely on `contrast.mjs` alone. Extract color values from the app's CSS, design tokens, or Tailwind config. Check all foreground/background pairs that appear in body text, UI labels, and interactive elements. This approach has reduced coverage because it requires manually identifying color pairs — note "determinism reduced: no browser surface" in the finding's scorecard note.

#### 1.4.11 — Non-text Contrast (informational — not in the mandatory set but common)

UI components (form inputs, focus indicators, icons used as controls) require a 3:1 contrast ratio for the visual boundary or indicator that identifies the component. Check with `contrast.mjs` using the component boundary color vs. its adjacent background. This criterion is Level AA.

---

### Operable

#### 2.1.1 — Keyboard

Every functionality available via pointer (mouse, touch) must be achievable via keyboard alone. This includes activating links, buttons, and menu items; opening and closing modals; using date pickers; and submitting forms.

**How to check:** This is a **visual/interaction** check. With the browser surface active, tab through the entire page from the beginning. Press Enter or Space on every interactive element. Open every modal, dropdown, and overlay using only the keyboard. Verify that every action possible with a mouse can also be performed without it. No automated tool reliably covers this in full — Lighthouse and axe can flag elements that are invisible to AT (no role, no label), but they cannot verify that all pointer-only widgets have a keyboard equivalent.

#### 2.1.2 — No Keyboard Trap

Once a user moves keyboard focus into a component, they must be able to move focus out using standard keys (Tab, Shift+Tab, Escape) without requiring a mouse. Modal dialogs are exempt from this criterion only if focus is intentionally constrained within the modal while it is open and the Escape key closes it and restores focus to the trigger.

**How to check:** This is a **visual/interaction** check. Tab into every focusable component — especially modals, custom dropdowns, carousels, and embedded widgets — and verify that Tab, Shift+Tab, and Escape allow the user to exit and continue navigating the rest of the page. An unresolvable trap (focus stuck, no key exits) is a `critical` or `high` finding because it locks keyboard-only users out of the rest of the page.

#### 2.4.2 — Page Titled

Every page (every distinct URL) must have a `<title>` element that describes its topic or purpose. Generic titles like "Untitled" or "Home" that do not differentiate pages in a multi-page app are failures. Single-page apps that change routes without updating `document.title` fail this criterion on every screen that lacks a distinct title.

**How to check:** **Deterministic** when a browser surface is available — call `chrome-devtools__evaluate_script` with `document.title` and verify the value is non-empty and descriptive for each route visited. Lighthouse rule `document-title` also checks this. In the absence of a browser surface, grep the source for `<title>` and check that it is populated dynamically for each route.

#### 2.4.3 — Focus Order

When users tab through the page, focus must move in an order that preserves meaning and operability. Focus order should match the visual reading order (top-to-bottom, left-to-right for LTR layouts). DOM order drives tab order for most elements; `tabindex` values above 0 can disrupt the natural order and should be treated as a red flag.

**How to check:** This is a **visual/interaction** check, though it has a deterministic supplement. Tab through the entire page in sequence and observe whether focus moves in a logical order matching the visual layout. Independently, search the source for `tabindex` values greater than 0 (`tabindex="1"`, `tabindex="2"`, etc.) — these override natural order and are almost always wrong. Axe rule `tabindex` flags positive `tabindex` values and is **deterministic** when the browser surface is available.

#### 2.4.4 — Link Purpose (In Context)

The purpose of each link must be determinable from the link text alone, or from the link text together with its programmatically determined context (the surrounding sentence, list item, table cell, or heading). Links labeled only "click here", "read more", or "learn more" fail if multiple such links appear on the page pointing to different destinations.

**How to check:** This is a **visual/interaction** check. Scan the page for links (and buttons that navigate). Read each link's accessible name in isolation. If the purpose is ambiguous without context, check whether the surrounding programmatic context (the containing sentence or landmark) provides disambiguating information. Axe rule `link-name` catches links with no accessible name at all, which is **deterministic**; but ambiguous-yet-named links require manual review.

#### 2.4.6 — Headings and Labels

Headings and labels must be descriptive. A heading like "Section 1" or a label like "Field" provides no information. This criterion does not require headings or labels to exist (other criteria cover that) — it requires that the ones that do exist are informative.

**How to check:** This is a **visual/interaction** check. Review every heading in the page's outline and every form label. Ask: would a user who could only read this heading or label know what the section contains or what to enter in the field?

#### 2.4.7 — Focus Visible

Keyboard focus must be visible. When an element receives focus via Tab or Shift+Tab, there must be a clear visual focus indicator — a visible ring, outline, or other distinguishable state change. CSS that sets `outline: none` or `outline: 0` on focused elements without a replacement indicator is a failure.

**How to check:** This is a **visual/interaction** check. Tab through the page and observe whether focus is visible at every interactive element. Also search the source for `outline: none`, `outline: 0`, and `:focus { outline: none }` — these are deterministic red flags. Note that `:focus-visible` is acceptable if a visible style is provided; `:focus { outline: none }` with no `:focus-visible` replacement is a failure. Axe does not reliably catch this; manual inspection is required.

#### 2.4.11 — Focus Not Obscured (Minimum) — New in WCAG 2.2

When a UI component receives keyboard focus, it must not be entirely hidden by author-created content. Sticky headers, cookie banners, chat widgets, and floating toolbars commonly obscure focused elements that scroll beneath them. This criterion is satisfied if the focused component is at least partially visible; complete obscuration is the failure.

**How to check:** This is a **visual/interaction** check. With sticky elements present (fixed headers, floating banners), tab through all interactive elements below the fold or near the bottom of the sticky zone. Confirm that the focused element is at least partially visible in the viewport. No automated tool reliably catches this — it requires a real browser and manual observation.

#### 2.5.8 — Target Size (Minimum) — New in WCAG 2.2

Interactive targets (buttons, links, form controls) must be at least **24 × 24 CSS pixels** in size, or the spacing around the target must bring the total clickable area to 24 × 24 px. This applies to all pointer inputs. Inline text links are exempt. Targets that are part of a native control styled by the user agent are also exempt.

**How to check:** This is primarily a **visual/interaction** check. In the browser surface, open DevTools (or call `chrome-devtools__evaluate_script` with `document.querySelectorAll('button, a, [role=button], input[type=checkbox], input[type=radio]')`) and inspect computed size for small targets — particularly icon-only buttons, checkboxes, radio buttons, close icons, and navigation links. Any target whose bounding box is smaller than 24 × 24 px with no compensating spacing is a candidate failure. Verify in context that the surrounding layout does not provide the required 24 px of clearance before filing.

---

### Understandable

#### 3.1.1 — Language of Page

The `<html>` element must carry a `lang` attribute that correctly identifies the primary human language of the page (e.g., `lang="en"`, `lang="fr"`). Assistive technologies use this to select the correct pronunciation engine and dictionary. A missing or incorrect `lang` attribute causes screen readers to mispronounce content.

**How to check:** Run `node scripts/design-scan.mjs <app-root>` and inspect the `missingLang` field. `true` means a `<html>` element was found without a `lang` attribute — this is a **deterministic** failure. When a browser surface is available, Lighthouse rule `html-has-lang` also catches this. For server-rendered or SPA apps where the `lang` attribute is set dynamically, verify via `chrome-devtools__evaluate_script` with `document.documentElement.lang`.

#### 3.3.1 — Error Identification

If an input error is automatically detected, the item in error must be identified and the error described to the user in text. It is not sufficient to show a red border or an icon; the error message must be text that describes what went wrong and, where possible, how to fix it. The message must also be programmatically associated with the field (e.g., via `aria-describedby` or `aria-errormessage`) so that screen readers announce it when focus moves to the field.

**How to check:** This is a **visual/interaction** check with a deterministic supplement. Submit forms with invalid inputs and observe whether: (a) an error message appears as visible text, (b) the message describes the specific error, and (c) the message is programmatically linked to the field. For (c), call `chrome-devtools__evaluate_script` to check `aria-describedby`, `aria-errormessage`, or `role="alert"` on the error container. Axe rule `aria-required-attr` and `label` may surface related issues and are **deterministic** when the browser is available.

#### 3.3.2 — Labels or Instructions

Where user input is required, labels or instructions must be provided. Every form field must have a visible label (or an equivalent accessible name delivered via `aria-label`, `aria-labelledby`, or `title`). Fields with format requirements (e.g., "MM/DD/YYYY", "10-digit phone number") need instructions before or within the field.

**How to check:** Run axe (rule `label`) via `chrome-devtools__evaluate_script` or Lighthouse — **deterministic** when the browser surface is available. This catches fields with no programmatic label at all. Visually inspect format instructions: are they present before the field? Are they still present after the field receives focus? Instructions that disappear on focus (e.g., placeholder-only labels) fail this criterion because placeholder text disappears when the user begins typing.

---

### Robust

#### 4.1.2 — Name, Role, Value

Every user interface component must have: an accessible **name** (what it is called), a **role** (what kind of control it is), and a **value** (its current state or content, where applicable). Custom widgets — divs or spans styled as buttons, custom dropdowns, toggles, sliders — must carry explicit ARIA attributes (`role`, `aria-label` or `aria-labelledby`, `aria-checked`, `aria-expanded`, etc.) to expose their semantics to assistive technology. Using a `<div>` with `onclick` and no `role="button"` or `tabindex` is a failure of both this criterion and 2.1.1.

**How to check:** Run axe via `chrome-devtools__evaluate_script` — the rules `button-name`, `link-name`, `aria-required-attr`, `aria-valid-attr-value`, `aria-roles`, and `aria-hidden-focus` all map to this criterion and are **deterministic** when the browser surface is available. Lighthouse also covers a subset. Supplement with a **visual/interaction** tab-through: call `chrome-devtools__evaluate_script` with `document.activeElement` after each Tab press and confirm the focused element has a role and an accessible name visible in the accessibility tree. On the Chrome surface, `chrome-devtools__take_snapshot` returns the accessibility tree and is particularly useful for auditing ARIA state.

---

## Graceful Degradation When Lighthouse/axe Are Unavailable

When no browser surface is available (e.g., the agent is running in an OS computer-use only environment without Chrome DevTools MCP tools or Playwright), the deterministic checks fall back to static analysis alone:

1. Run `node scripts/design-scan.mjs <app-root>` for `missingAlt` and `missingLang`.
2. Run `node scripts/contrast.mjs <fg> <bg>` for each color pair you can identify from CSS, design tokens, or the app's Tailwind config.
3. Conduct a manual keyboard tab-through in whatever browser surface is accessible (OS-level computer use can still drive a visible browser via keyboard).
4. In the finding's evidence and in `SUMMARY.md`, include the note: **"Determinism reduced: no browser surface — axe/Lighthouse checks skipped; static scan only."** This signals to the reader that the coverage is incomplete and a follow-up run with a full browser surface should re-verify the automated criteria.

Do not pretend that static analysis alone constitutes a full accessibility audit. It catches some failures (missing `alt`, missing `lang`, identifiable contrast pairs) but will miss ARIA labeling gaps, focus order issues, keyboard traps, and dynamic-state violations that only appear at runtime.

---

## Contrast: Always Compute, Never Eyeball

Human perception of contrast is unreliable, especially for mid-range grays, near-white backgrounds, and low-saturation colors. Do not make a judgment call on whether a color pair "looks like enough contrast." Always pass the actual hex or RGB values to `contrast.mjs` and record the numeric ratio.

```
node scripts/contrast.mjs "#334155" "#f8fafc"
# → { ratio: 12.25, large: false, aa: true, aaa: true }

node scripts/contrast.mjs "#94a3b8" "#f8fafc"
# → { ratio: 2.95, large: false, aa: false, aaa: false }

node scripts/contrast.mjs "#94a3b8" "#f8fafc" --large
# → { ratio: 2.95, large: true, aa: false, aaa: false }
```

The `--large` flag should be passed when the text meets the large-text definition: at least 18 pt (24 px) at normal weight, or at least 14 pt (18.67 px) bold. When in doubt, omit `--large` — the stricter 4.5:1 threshold applies and a pass under the stricter threshold is always acceptable.

---

## How to Write an Accessibility Finding

Accessibility findings use the same JSON schema as all other findings. Set `type: "design"` and `pillar: "accessibility"`. Add a `wcag` field containing the success-criterion ID (e.g., `"1.4.3"`). All other required fields from `references/judging.md` apply — `id`, `title`, `type`, `severity`, `repro`, `evidence`.

### Type and Pillar

```json
"type": "design",
"pillar": "accessibility"
```

### Severity

Follow the standard severity rubric in `references/judging.md`. The accessibility-specific calibration is:

- **An AA violation** is `high`. AA is the legal bar; a confirmed AA failure exposes the product to accessibility complaints and litigation.
- **An advisory or AAA item** is `low` or `medium` — valuable to surface but not a release blocker.
- Increase to `critical` only when the issue completely blocks a core capability from the Product Contract for AT users (e.g., a keyboard trap that prevents form submission, a missing login button label that makes sign-in impossible with a screen reader).

### Visibility

The `visibility` field requires care for accessibility findings because the impact profile differs from bugs:

- A **contrast failure** is `user-visible` — it directly affects how all sighted users perceive text, including those with low vision, color-blindness, or who are using their device in bright sunlight.
- A **missing `alt` attribute** or **missing ARIA label** is `hidden` from sighted users browsing normally — the UI appears complete. But it is high-impact for blind users relying on a screen reader, who receive nothing where content should be. Do not downgrade the severity of AT-invisible failures just because they are `hidden` to sighted users. A blind user who cannot read an unlabeled image or interact with an unlabeled button is fully blocked, not merely inconvenienced.
- A **missing `lang` attribute** is `hidden` to visual users but causes mispronunciation across the entire page for screen-reader users.
- A **keyboard trap** is `user-visible` in the sense that any keyboard-only user immediately encounters it.

Set `visibility` accurately and note the AT impact explicitly in the finding brief so that the reader understands why a `hidden` finding is rated `high`.

### Before → After

Every accessibility finding must include a concrete before/after that a developer can act on immediately, either in `suggestedFix` or `codingAgentPrompt`.

**Contrast failure (1.4.3):**
- Before: `color: #94a3b8` on `background: #f8fafc` → `contrast.mjs` reports ratio 2.95:1, aa: false.
- After: change to `color: #475569` on `background: #f8fafc` → `contrast.mjs` reports ratio 6.84:1, aa: true. Cite the exact ratio in the fix so the developer can verify without re-running the tool.

**Missing alt (1.1.1):**
- Before: `<img src="/hero.jpg">` — no `alt` attribute; `design-scan.mjs` reports `missingAlt: 1`.
- After: `<img src="/hero.jpg" alt="Sleuth dashboard showing a list of open findings with severity badges">` for meaningful images, or `alt=""` for purely decorative images.

**Missing label (4.1.2):**
- Before: `<button class="icon-close">×</button>` — screen reader announces "×" or nothing.
- After: `<button class="icon-close" aria-label="Close dialog">×</button>` — screen reader announces "Close dialog, button."

**Missing lang (3.1.1):**
- Before: `<html>` — `design-scan.mjs` reports `missingLang: true`.
- After: `<html lang="en">` — screen reader selects the correct pronunciation engine.

### Coding-Agent Prompt

Write the `codingAgentPrompt` as a self-contained instruction requiring no additional context. Include: the file or selector where the fix belongs, the exact before state, the target after state, the tool command to verify the fix (e.g., `node scripts/contrast.mjs <new-fg> <new-bg>` — expected output), and the WCAG SC being satisfied.

Example for a contrast finding:

```
The label text in the sidebar navigation (CSS class `.nav-label`) uses color #94a3b8 on background #f8fafc.
Running `node scripts/contrast.mjs "#94a3b8" "#f8fafc"` returns ratio 2.95:1, which fails WCAG 1.4.3 AA
(minimum 4.5:1 for normal text). Change the color to #475569 or darker. After the change, run
`node scripts/contrast.mjs "<new-value>" "#f8fafc"` and confirm `aa: true` in the output. The fix must
also cover the :hover and :active states if they apply a different color.
```

---

## Worked Accessibility Finding

The following is a complete, validated finding for a contrast failure. Use it as a template.

```json
{
  "id": "F-007-body-text-contrast-fail",
  "title": "Sidebar nav labels fail WCAG 1.4.3 AA contrast minimum (2.95:1, required 4.5:1)",
  "type": "design",
  "pillar": "accessibility",
  "wcag": "1.4.3",
  "severity": "high",
  "visibility": "user-visible",
  "route": "/dashboard",
  "flow": "page-render",
  "persona": "developer",
  "repro": [
    "Navigate to /dashboard.",
    "Inspect the sidebar navigation labels (e.g., 'Overview', 'Findings', 'Settings').",
    "Run: node scripts/contrast.mjs '#94a3b8' '#f8fafc'",
    "Observe: ratio 2.95:1, aa: false — below the 4.5:1 AA minimum for normal-weight body text."
  ],
  "evidence": [
    ".sleuth/runs/20240612-143022/dev-dashboard-sidebar-contrast.png — screenshot of sidebar with computed colors visible in DevTools; foreground #94a3b8, background #f8fafc.",
    "contrast.mjs output: { ratio: 2.95, large: false, aa: false, aaa: false }"
  ],
  "suggestedFix": "Change the sidebar label color from #94a3b8 to #475569 (or any color that achieves ratio ≥ 4.5:1 against #f8fafc). Verify with: node scripts/contrast.mjs '#475569' '#f8fafc' — expected output: ratio ≥ 6.8:1, aa: true.",
  "codingAgentPrompt": "The sidebar navigation labels in /dashboard use color #94a3b8 on background #f8fafc. This pair has a contrast ratio of 2.95:1, which fails WCAG 1.4.3 AA (minimum 4.5:1 for normal text). Change the label color to #475569 or a darker equivalent. After the change, run `node scripts/contrast.mjs '<new-fg>' '#f8fafc'` and confirm the output shows `aa: true`. Apply the same fix to the :hover and :active states if they use the same color. This change should affect only the sidebar nav labels — do not alter the icon colors or the active-state highlight color without separate contrast verification."
}
```

After writing the file, validate it:

```bash
node scripts/scaffold.mjs validate finding .sleuth/findings/F-007-body-text-contrast-fail.json
```

The command must print `valid` before you move on.
