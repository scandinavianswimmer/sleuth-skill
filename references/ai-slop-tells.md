# AI-Slop Tells Catalog

> **IMPORTANT — contextual signals, not automatic failures.** Every tell below is a
> signal that *might* indicate a thoughtless, AI-generated default. A tell becomes a
> finding **only when it actually hurts the design for this app's specific audience**.
> Do not flag intentional, well-executed bold choices. Avoid false positives: a purple
> gradient brand identity built by a deliberate designer is not a finding; a purple
> gradient that appeared because the AI picked the most common Tailwind gradient is.
> Before raising any finding, ask: "Does this hurt trust, readability, or conversion
> for the real users of this product?" If the answer is no, log it as `info` or skip it.

---

## The Catalog

Each entry follows the same structure: **what it is**, **why it reads as AI**, **how to
detect it**, the **pillar** it maps to, and a concrete **corrective** (before → after).

---

### 1. Violet/Purple/Indigo Gradient as the Default Brand Move

**Why it reads as AI.** Purple-to-indigo is the single most frequent gradient in
AI-generated UI because it appears by default in most LLM code completions and Tailwind
starter templates. When every SaaS landing page uses it, it signals the creator reached
for the first option rather than building a visual identity.

**How to detect.**
- Scanner field: `aiPurpleGradient > 0` — the scanner matches `linear-gradient` /
  `radial-gradient` containing any of `#8b5cf6`, `#7c3aed`, `#a855f7`, `#6366f1`,
  `violet`, `purple`, `indigo`, `fuchsia`, or Tailwind gradient classes with
  `from-/via-/to-purple|violet|indigo|fuchsia-{n}`.
- Visually: hero section or CTA button uses a purple/indigo gradient with no other
  brand-color anchor in the palette.

**Pillar.** `ai-slop` / `color-contrast`

**Corrective.**
> Before: `background: linear-gradient(135deg, #7c3aed, #6366f1)` on every primary
> surface.
>
> After: Extract a brand-specific primary hue from the product's visual identity (or
> brief the designer/stakeholder). Replace the blanket gradient with a purposeful
> choice — a single brand color for buttons, a subtle tint for sections, or a gradient
> that uses the brand's own hue range (e.g., teal-to-cyan for a fintech product). If
> purple is intentional, pair it with a distinct secondary hue and document the palette
> decision.

---

### 2. Centered Hero Over a Dark Mesh / Grid / Aurora Background

**Why it reads as AI.** The "dark glowing mesh" or "aurora blobs on near-black" hero is
the de-facto output of tools like v0, Midjourney UI prompts, and GitHub Copilot Chat for
landing-page scaffolding. It is visually striking in isolation but has saturated the
software design landscape to the point of invisibility, and it communicates nothing
specific about the product.

**How to detect.**
- Visual inspection: full-width hero with `background-color: near-black` plus any of —
  a radial-gradient blob cluster, an SVG/canvas mesh pattern, or a blurred aurora-style
  gradient overlay. Combined with `text-align: center` and a headline + subhead + CTA
  layout with no editorial image.
- No scanner field; flag visually during the screenshot review pass.

**Pillar.** `ai-slop` / `layout`

**Corrective.**
> Before: `<section style="background: #0a0a0f; text-align: center">` + SVG mesh
> decoration + "Transform your workflow" H1.
>
> After: Replace the background with a purposeful surface that communicates the product
> category (a real product screenshot, a domain-specific illustration, an editorial photo,
> or a clean light background that lets typography lead). If dark mode is intentional,
> use a real color from the brand palette rather than near-black, and break the full
> center-align with a split or asymmetric layout.

---

### 3. Three Equal Feature Cards in a Row / Card Overuse / Nested Cards

**Why it reads as AI.** Three equal-width cards with icon + headline + body text is the
most common AI scaffold for "show features." It signals no layout thinking: no visual
hierarchy between features, no sense of which capability is most important, no
spatial rhythm. Card overuse (cards inside cards, cards for everything) adds visual
weight with no navigational payoff.

**How to detect.**
- Visual inspection: a section where exactly three `<div class="card">` (or equivalent)
  share equal width, equal padding, and equal visual weight in a row.
- Also look for cards nested inside cards (a `card` class or `rounded` + `shadow` block
  appearing as a direct child of another such block) and for cards used where prose,
  a table, or a list would be lighter.
- No single scanner field; flag during screenshot review.

**Pillar.** `layout`

**Corrective.**
> Before: Three 1/3-width cards, identical shadow, identical padding, no visual
> distinction between primary and secondary features.
>
> After: Establish hierarchy — lead with the top one or two features using a larger
> layout block (full-width feature row, large card, or editorial treatment), then
> support with a secondary grid. Or eliminate cards entirely and use a two-column
> feature list with a real product screenshot on one side.

---

### 4. Blanket Glassmorphism / `backdrop-filter` on Everything

**Why it reads as AI.** Glassmorphism (frosted-glass `backdrop-filter: blur(…)` cards
over gradient backgrounds) became popular circa 2021 and has since been default-pasted
into AI output regardless of context. Applied to every panel, modal, nav, and card, it
creates visual noise, renders content less legible (especially at smaller text sizes or
on non-gradient backgrounds), and hits compositing performance on lower-end devices.

**How to detect.**
- Scanner field: `glassmorphism > 3` (the scanner counts `backdrop-filter` and
  `backdrop-blur` matches). A count above 3 on a site with a modest component count
  suggests blanket application.
- Visually: every floating element — navbar, cards, modals, tooltips — has the
  frosted-glass treatment simultaneously.

**Pillar.** `ai-slop`

**Corrective.**
> Before: `backdrop-filter: blur(12px); background: rgba(255,255,255,0.08)` applied to
> `nav`, every `.card`, and all modals.
>
> After: Reserve `backdrop-filter` for a single focal surface that sits above a dynamic
> background (e.g., a sticky nav over a hero video). Give other surfaces opaque or
> solid-tint backgrounds. Check legibility at WCAG AA contrast ratios after removing blur.

---

### 5. Inter + Slate-900 as the Unconsidered Default Pairing

**Why it reads as AI.** Inter is the system-font fallback in virtually every Tailwind and
shadcn/ui starter. Slate-900 body on white is the analogous color default. When they
appear together with no secondary typeface and no design rationale, it signals the
project never made a typography decision — it just shipped the scaffolding defaults.
This is not a bug in Inter (it is an excellent typeface); it is a signal that no
editorial voice was established.

**How to detect.**
- Scanner field: `fontFamilies` array contains `inter` (case-insensitive) and
  `fontFamilyCount === 1` — Inter is the only declared family, meaning no secondary
  display or mono face was added.
- Additional signal: `colorCount` is low (< 10 hex values) and the values cluster around
  the Tailwind slate scale (`#0f172a`, `#1e293b`, `#334155`, `#94a3b8`, `#f1f5f9`).
- Visually: headline and body text are typographically indistinguishable apart from size
  and weight; no display font, no editorial personality.

**Pillar.** `typography`

**Corrective.**
> Before: `font-family: 'Inter', sans-serif` for all text; headline 2rem/700 vs. body
> 1rem/400 — the only differentiation is size and weight.
>
> After: Introduce at minimum a display/heading pairing that carries brand personality
> (could still be Inter for the body, but pair it with a distinct display weight or a
> second family for headings). Set a type scale (use `clamp()` for fluid sizing).
> Establish named text-color tokens instead of raw Tailwind slate values so the palette
> is intentional.

---

### 6. Emoji Used as Bullets or Feature Icons

**Why it reads as AI.** Emoji bullets (`✅ Fast`, `🚀 Scalable`, `💡 Intuitive`) are a
common AI writing shorthand that migrates directly into AI-generated UI. They carry no
visual system: they are variable-width, render differently across OS/browser, and cannot
be styled with CSS. They signal content that was generated rather than designed.

**How to detect.**
- Visual inspection: list items, feature rows, or card bodies where the leading character
  is a Unicode emoji rather than an SVG icon component or CSS-styled pseudo-element.
- You can also grep the source for common feature emoji patterns:
  `✅|🚀|💡|⚡|🎯|🔒|📊|🌟|💪|✨` in JSX/HTML strings.
- No scanner field; flag during screenshot and source review.

**Pillar.** `design-system`

**Corrective.**
> Before: `<li>✅ Zero setup required</li>` repeated across a feature list.
>
> After: Replace with SVG icon components from a single icon set (Lucide, Heroicons, or
> Phosphor — one family, one weight, one grid). Render them at a consistent size
> (`16px` or `20px`) with explicit `aria-hidden="true"` and align them to a consistent
> baseline.

---

### 7. Perfectly Uniform Spacing Everywhere / Everything Centered

**Why it reads as AI.** AI-generated layouts tend to apply `gap-6`, `p-6`, and
`text-center` uniformly because these are safe, neutral defaults. The result is a page
with no spatial rhythm — no "breath" before a key section, no tighter grouping to signal
related content, no visual tension that draws the eye. Good layouts use spacing
deliberately to create hierarchy and guide reading order.

**How to detect.**
- Visual inspection: scroll the page and ask whether spacing between sections, between
  a header and its supporting copy, and between a CTA and the section above it all look
  identical. Also look for every section being `text-align: center` regardless of
  content type (prose reads poorly centered).
- No scanner field; judgment-based during screenshot review.

**Pillar.** `layout`

**Corrective.**
> Before: Every section has `padding: 4rem 0`, every text block is `text-align: center`,
> and every grid gap is `1.5rem` regardless of content relationship.
>
> After: Establish a spacing scale (e.g., 4 / 8 / 16 / 32 / 64px steps). Apply tighter
> spacing within a content group and more generous spacing between groups. Left-align
> body copy and feature descriptions; reserve centered alignment for hero headlines and
> short CTAs. Use whitespace deliberately to create visual weight on the most important
> elements.

---

### 8. Reflexive Identical Entrance Animation on Every Section / Infinite Looping Micro-Animations

**Why it reads as AI.** The reflexive "fade-up on scroll" applied to every `<section>`
is a Framer Motion / AOS default. When every element animates identically on entry,
animation loses meaning — it provides no information about hierarchy or relationships.
Infinite looping micro-animations (spinning icons, pulsing badges, looping gradients) on
ambient UI elements distract from the content and interfere with `prefers-reduced-motion`
users.

**How to detect.**
- Visual inspection: scroll from the top and count how many sections trigger a slide/fade
  animation. If all of them do, it is reflexive. Also look for any always-on looping
  animation on non-interactive, non-progress-indicator elements.
- Source signal: grep for `animate-spin`, `animate-pulse`, `animate-bounce` on elements
  that are not loading spinners or explicit status indicators; or for
  `transition: all 0.3s` applied globally.
- Check whether the site respects `@media (prefers-reduced-motion: reduce)` — absence is
  always a finding under the `motion` pillar.

**Pillar.** `motion`

**Corrective.**
> Before: `<section className="animate-fade-up">` on every section; a decorative
> `animate-spin` icon in the hero.
>
> After: Reserve reveal animations for two or three high-priority elements (the hero
> headline, the first CTA, a key data visualization). Remove or replace infinite loops
> with a single-play animation or a static treatment. Add `@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }`
> (or a scoped equivalent) so users who opt out get an immediate, static layout.

---

### 9. Generic Stock Iconography with Inconsistent Weights or Sizes

**Why it reads as AI.** Icons sourced from multiple families, at inconsistent stroke
widths (some 1.5px, some 2px, some filled), or rendered at inconsistent sizes (16px next
to 24px next to 32px in the same context) signal no design-system discipline. AI-generated
code often pulls icons from whatever is easiest to import, mixing Heroicons, FontAwesome,
and Material Icons in the same component tree.

**How to detect.**
- Visual inspection: open the app and scan a section that uses multiple icons. Do they
  look like they belong to the same family? Are they the same stroke weight? Are their
  bounding boxes consistent?
- Source signal: look for mixed icon-library imports (e.g., `from '@heroicons/react'`
  alongside `from 'react-icons/fa'` in the same codebase).
- No scanner field; flag during code and visual review.

**Pillar.** `design-system`

**Corrective.**
> Before: `<FaBolt>` (FontAwesome, filled, 16px) next to `<ArrowRight>` (Heroicons,
> outline, 24px) in the same feature row.
>
> After: Pick one icon family and one style (e.g., Lucide at 20px / 1.5px stroke
> everywhere). Replace all icon imports with that single source. If a needed icon is
> missing from the chosen set, use a simple SVG custom addition in the same visual style
> rather than importing a second library.

---

### 10. Lorem-ish Filler Copy and Vague "Empower Your Workflow" Headlines

**Why it reads as AI.** Headlines like "Empower Your Workflow," "Unlock Your Potential,"
"Streamline Everything," and "Built for Teams Who Move Fast" say nothing specific about
the product. They are the most common output of LLMs given "write a hero headline" with
no product context. They destroy conversion because visitors cannot determine what the
product actually does from the headline alone.

**How to detect.**
- Visual inspection: read the hero headline, subheadline, and feature card headlines.
  Ask: "Could this headline appear, unchanged, on a competitor's site?" If yes, it is
  generic filler.
- Source signal: grep for common filler phrases: `empower|streamline|unlock|harness|
  supercharge|next-level|game-changing|cutting-edge|revolutionize|transform your`.
- No scanner field; flag during content review.

**Pillar.** `ai-slop`

**Corrective.**
> Before: `<h1>Empower Your Workflow with AI</h1>` + `<p>The all-in-one platform for
> modern teams.</p>`
>
> After: Write a specific, concrete headline that names the user's job and the product's
> primary outcome: e.g., "QA agents that find broken flows before your users do" (for
> Sleuth). Follow with a subhead that names *who* it is for and the key mechanism. The
> test: a visitor should be able to describe the product accurately after reading only
> the hero text.

---

### 11. `z-index: 9999` / Magic Stacking Values and `!important` Spam

**Why it reads as AI (and overconfident tooling in general).** Magic z-index values
(999, 9999, 99999) appear when each component is written in isolation with no shared
stacking context. `!important` declarations accumulate when specificity battles are
resolved by escalation rather than by fixing selector architecture. Both are symptoms of
code written without a coherent CSS architecture and are strong signals in AI-generated
stylesheets.

**How to detect.**
- Scanner field: `zIndexMagic` — an array of z-index values ≥ 100 found in CSS and
  Tailwind arbitrary values (e.g., `z-[9999]`). Any value above 100 that is not an
  explicit named layer (e.g., a documented modal layer) is a candidate finding.
- Scanner field: `importantCount` — total count of `!important` in all source files. A
  non-zero count warrants investigation; a count > 10 on a modest codebase is a strong
  signal.

**Pillar.** `layout` / `design-system`

**Corrective.**
> Before: `z-index: 9999` on the tooltip, `z-index: 99999` on the modal, `z-index:
> 999999` on the cookie banner; `color: #fff !important` in three places to override
> component defaults.
>
> After: Define a named z-index scale as CSS custom properties or Tailwind config
> (`--z-dropdown: 100`, `--z-modal: 200`, `--z-toast: 300`, `--z-overlay: 400`). Apply
> values from the scale, not magic numbers. Resolve `!important` conflicts by fixing
> selector specificity — move component styles to a lower-specificity layer, or use
> CSS `@layer` to enforce ordering.

---

### 12. ALL-CAPS Body Copy

**Why it reads as AI.** `text-transform: uppercase` applied to body text, paragraph
text, or multi-line descriptions is a frequent AI output because it "looks bold and
professional" in isolation. In practice, all-caps text reduces reading speed by 13–20%
for body-length text (research consistently shows saccadic cost for non-mixed-case
sequences), and it can trigger screen-reader mispronunciation as acronyms.

**How to detect.**
- Scanner field: `allCapsCandidates` — the scanner counts `text-transform: uppercase`
  declarations and Tailwind `uppercase` class applications. A non-zero count triggers
  investigation.
- Visually: look for uppercase text on elements that are longer than ~4 words (i.e.,
  not a button label, badge, or tab — those are acceptable).
- Context matters: ALL-CAPS on nav labels, buttons, or short badges is a common and
  acceptable typographic choice. The finding applies only when uppercase is used on
  descriptive copy, feature body text, or anything meant to be read in a sentence.

**Pillar.** `typography`

**Corrective.**
> Before: `<p class="uppercase text-sm text-gray-400">Automatically sync your data
> across every platform in real time.</p>`
>
> After: Remove `uppercase` from body/descriptive text. If visual distinction is needed,
> use `font-weight`, `letter-spacing`, or a smaller `font-size` with normal case instead.
> Keep `uppercase` only for short labels (buttons, badges, navigation items ≤ 4 words).

---

## How to Turn a Tell into a Finding

When a tell clears the contextual threshold ("this actually hurts the design for this
app's audience"), emit a finding with the following fields:

| Field | Value |
|---|---|
| `type` | `design` |
| `pillar` | The pillar key from the entry above (e.g., `ai-slop`, `typography`, `color-contrast`, `motion`, `layout`, `design-system`) |
| `visibility` | `user-visible` (all design tells are perceptible without devtools) |
| `severity` | **`low`** for cosmetic-only issues with no impact on trust, conversion, or readability. **`medium`** for issues that materially hurt readability, trust, or conversion for the target audience. **`high`** is reserved for accessibility violations that also constitute a design-system failure (e.g., all-caps body copy that also fails WCAG contrast). See `references/judging.md` for the full severity rubric. |

The finding's `brief` must include a **concrete before→after value** — the exact CSS
property, token, or markup pattern to change, not a general recommendation. The
before→after should be specific enough for a coding agent to apply the fix in a single
edit.

For the full evaluation procedure — how to drive the app, what screenshots to capture,
how to run `design-scan.mjs`, and how to write the DESIGN-REVIEW scorecard — see
`references/design-review.md`.
