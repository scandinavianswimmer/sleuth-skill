# Product Contract Reference Playbook

A Product Contract is the ground-truth document that tells the Sleuth agent what the app is supposed to do, who it serves, and what invariants must never be violated. Every downstream decision — which personas to create, which flows to drive, what counts as a bug — traces back to this file. Write it once at the start of a Sleuth session, validate it, and treat it as read-only for the rest of the run.

---

## Step 1 — Gather raw signals

Before writing a single line of JSON, collect evidence from two sources:

**1a. Run `detect-stack.mjs` on the target repo.**

```bash
node scripts/detect-stack.mjs /path/to/target-repo
```

The output is a JSON object. Read every field:

- `name` — the npm package name; use it as the contract's `app.name` if no friendlier name is available.
- `framework` — tells you how to navigate routes (Next.js page tree vs Express endpoints).
- `routes` — page routes. Each route is a candidate capability surface.
- `apiRoutes` — backend endpoints. POST/PUT/PATCH routes are almost always capability entry points; GET routes often back a capability.
- `forms` — detected `<form>` elements with their named fields. Every form is a capability the user can exercise.
- `auth` — auth hints (`next-auth`, `jwt`, `session`, `bcrypt`, etc.). Any auth hint means you need at minimum one role and several `forbidden` entries.
- `env` — environment variable names. Variables like `STRIPE_SECRET_KEY`, `DATABASE_URL`, `S3_BUCKET` surface integrations that imply critical capabilities (payments, persistence, file upload).
- `scripts` — the `dev` and `start` scripts tell you how to start the app for later driving.

**1b. Read the repo's human-facing text.**

Open these files/pages in order, stopping when you have enough signal:

1. `README.md` — elevator pitch, feature list, setup instructions.
2. Landing or marketing page copy (e.g., `app/page.tsx`, `pages/index.tsx`, `public/index.html`) — value propositions, call-to-action text, tagline.
3. Pricing or plans page — tier names and feature gates reveal which capabilities are premium, which implies criticality.
4. Onboarding screens or copy — what the app walks a new user through tells you the core job-to-be-done.
5. Domain language in the code itself — model names (e.g., `Booking`, `Appointment`, `Invoice`), route segments (e.g., `/checkout`, `/dashboard/reports`), and API endpoint names carry semantic weight when prose docs are thin.

---

## Step 2 — Fill the four required sections

### `app`

- **`name`** (required, string): The product's human-readable name. Prefer the landing-page headline or README title over the raw npm package name when they differ.
- **`summary`** (required, string): One or two sentences describing what the app does and for whom. Write it as if explaining to a new QA engineer on their first day — concrete and jargon-free.
- **`url`** (optional, string): The running app's base URL. This is the URL Sleuth's browser driver will open. Set it when you know it (e.g., `http://localhost:3000`); leave it out if the app is not yet running.

### `audience`

The `audience` block answers: who is the primary user, and how do we know?

- **`icp`** (required, string): A single sentence naming the Ideal Customer Profile. Be specific. "Small yoga studios with 1–3 instructors who need online class booking" is better than "fitness businesses." The ICP drives persona creation downstream — vague ICPs produce useless personas.

- **`signals`** (required, array of strings): Evidence that supports the ICP statement. Each entry is one piece of evidence with its source. Mine signals from these locations:

  - **README**: Look for phrases like "designed for," "built for," "helps X do Y," target audience callouts.
  - **Landing/marketing copy**: Hero text, subheadings, testimonials, and benefit statements name the customer implicitly or explicitly.
  - **Pricing tiers**: Tier names ("Solo", "Studio", "Enterprise") and per-seat vs per-location pricing models reveal business size and type.
  - **Onboarding copy**: Setup wizards that ask "How many employees?" or "What kind of business?" are direct ICP signals.
  - **Domain language in the code**: Model names (`class Instructor`, `type Booking`, `interface TenantConfig`), route names (`/admin/studio`, `/client/dashboard`), and database table names all carry implicit ICP signal.
  - **Env variables**: `STRIPE_SECRET_KEY` signals paid transactions; `TWILIO_` signals SMS; `SENDGRID_` signals email marketing — all imply something about the business model and user sophistication.

  Each signal string should be phrased as a short claim with a parenthetical source: e.g., `"README describes the product as 'class booking for independent yoga studios'"`.

### `capabilities`

Capabilities are the discrete things a user can accomplish with the app. Each capability maps to one or more routes/forms/API calls but is described in user-facing language, not technical terms.

For each capability:

- **`name`** (required, string): A short noun phrase from the user's perspective. "Book a class", "Manage instructors", "Process checkout" — not "POST /api/bookings".
- **`flow`** (required, string): A brief prose description of the happy-path sequence. Write it as numbered steps or a short sentence. Include the starting URL, key user actions, and the success state. This is what the browser-driving agent will attempt to replicate.
- **`critical`** (optional, boolean): Set to `true` if failing this capability blocks the app's core job-to-be-done. A yoga booking app's "Book a class" capability is critical; "Export class roster as CSV" probably is not. When in doubt, ask: "If this broke silently on launch day, would a user immediately leave?" If yes, mark it critical.

To find capabilities, scan: every distinct page route, every form detected by `detect-stack.mjs`, every POST/PUT/PATCH API route, and any feature described in the README or landing copy that a user would directly exercise.

### `forbidden`

Forbidden entries are invariants whose violation constitutes a bug or security issue. Write them as declarative sentences in the present tense, phrased as what must never happen.

Derive forbidden entries from:

- **Auth hints**: If `auth` is non-empty, write access-control invariants for every protected route detected. Standard entries: "A logged-out user must not reach any route under /dashboard", "A logged-out user must not be able to call any authenticated API endpoint."
- **Multi-tenant signals**: If the code has tenant IDs, organization IDs, or workspace IDs in its data models, add: "Tenant A must not read or write Tenant B's data."
- **Role-gated features**: If there are admin routes (e.g., `/admin`, `/settings/users`), add: "A user with the `client` role must not access admin-only pages or API endpoints."
- **Payment/financial flows**: If Stripe or payment env vars are present, add: "A booking must not be confirmed without successful payment authorization."
- **Data integrity**: "Deleting a user must not silently orphan their active bookings" — model-level constraints that, if violated, corrupt the app's data.
- **Double-submit / idempotency**: "Submitting the booking form twice must not create duplicate bookings."

---

## Step 3 — Write and validate

Write the completed contract to `.sleuth/product-contract.json`. If the `.sleuth/` directory does not exist yet, initialize it first:

```bash
node scripts/scaffold.mjs init /path/to/target-repo
```

Then write the contract file and run the validator:

```bash
node scripts/scaffold.mjs validate product-contract .sleuth/product-contract.json
```

The validator prints `valid` on success. If it prints errors, read each error message, locate the offending field, and fix it before continuing. Common mistakes:

- `capabilities` must be an array even if you have only one capability.
- `signals` must be an array even if you have only one signal.
- `forbidden` must be an array.
- `critical` is optional — omitting it is fine; including it requires a boolean value, not a string.
- `url` is optional — omit it rather than setting it to `null` or an empty string.

Do not proceed to persona creation until the validator outputs `valid`.

---

## Worked example — YogaBook

Below is a complete, valid Product Contract for a small yoga-class booking app called YogaBook. The `detect-stack.mjs` output for this hypothetical repo would show: framework `next`, routes including `/`, `/classes`, `/book/[id]`, `/dashboard`, `/admin/classes`, auth hints `['next-auth', 'bcrypt']`, and a Stripe env variable.

```json
{
  "app": {
    "name": "YogaBook",
    "summary": "YogaBook lets independent yoga studios publish their weekly class schedule and accept online bookings from clients. Studio owners manage their timetable and roster through an admin dashboard.",
    "url": "http://localhost:3000"
  },
  "audience": {
    "icp": "Independent yoga studio owners with 1–5 instructors who want to replace manual booking spreadsheets with online self-service registration.",
    "signals": [
      "README describes the product as 'online class booking for independent yoga studios'",
      "Landing page hero text reads 'Run your studio from one simple dashboard'",
      "Pricing page has a 'Solo Instructor' tier and a 'Studio' tier — implies small business scale",
      "Onboarding wizard asks 'How many instructors are in your studio?' — confirms small-team ICP",
      "Data model contains Instructor, Class, and Booking entities — domain language matches studio operations",
      "STRIPE_SECRET_KEY env variable indicates paid transactions, implying a revenue-generating business"
    ]
  },
  "capabilities": [
    {
      "name": "Browse class schedule",
      "flow": "User opens /classes. The page lists upcoming classes with name, instructor, date/time, and spots remaining. No login required.",
      "critical": false
    },
    {
      "name": "Book a class",
      "flow": "User clicks a class on /classes, lands on /book/[id]. They fill in name and email, select a time slot, enter payment details, and submit. On success they see a confirmation page with a booking reference number.",
      "critical": true
    },
    {
      "name": "Client account: view my bookings",
      "flow": "Logged-in client navigates to /dashboard. The page lists their upcoming and past bookings with date, class name, and cancellation option.",
      "critical": true
    },
    {
      "name": "Cancel a booking",
      "flow": "From /dashboard, client clicks Cancel on a future booking. A confirmation modal appears. On confirm, the booking is removed and the spot is freed. Client receives a cancellation email.",
      "critical": false
    },
    {
      "name": "Admin: manage class schedule",
      "flow": "Admin logs in and navigates to /admin/classes. They can add a new class (name, instructor, date/time, capacity), edit an existing class, or delete a class. Changes appear immediately on the public /classes page.",
      "critical": true
    },
    {
      "name": "Admin: view roster",
      "flow": "Admin navigates to /admin/classes/[id]/roster. The page lists all booked clients with name and email. Admin can export the list as CSV.",
      "critical": false
    }
  ],
  "roles": [
    {
      "name": "guest",
      "may": ["browse class schedule", "book a class"],
      "mayNot": ["access /dashboard", "access any /admin route"]
    },
    {
      "name": "client",
      "may": ["browse class schedule", "book a class", "view my bookings", "cancel a booking"],
      "mayNot": ["access any /admin route"]
    },
    {
      "name": "admin",
      "may": ["all capabilities"],
      "mayNot": []
    }
  ],
  "forbidden": [
    "A logged-out user must not reach /dashboard or any route under /admin",
    "A client must not access any route under /admin",
    "Submitting the booking form twice must not create duplicate bookings",
    "A booking must not be confirmed without successful payment authorization from Stripe",
    "Cancelling a booking must not leave the class spot count inconsistent",
    "Deleting a class must not silently orphan existing confirmed bookings without notifying the clients"
  ]
}
```

Save this to `.sleuth/product-contract.json` and run:

```bash
node scripts/scaffold.mjs validate product-contract .sleuth/product-contract.json
# → valid
```
