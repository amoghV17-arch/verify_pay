# UI_IMPLEMENTATION.md: Milestone product redesign (final specification)

Place this file at `docs/UI_IMPLEMENTATION.md`. It **supersedes** `docs/DESIGN.md` and `docs/UI_REDESIGN.md`. Where it conflicts with `AGENTS.md` safety rules, `AGENTS.md` wins. Money logic, the milestone state machine, the ledger, and webhook handling are preserved; the only backend changes allowed are those in section 10.

---

## 0. How to use this document

**Role:** you are a principal product designer and senior full-stack engineer redesigning an existing, working, deployed application. This is not a rewrite.

**Repository and live app:** https://github.com/amoghV17-arch/verify_pay and https://verify-pay.onrender.com (use the browser tool on the live app to see the current behavior).

**Operating rules**
1. Follow `RUN_MODE` in `AGENTS.md`. Work **one phase at a time** (section 14). After each phase: run `pnpm verify`, take screenshots, commit, merge, tag, push, print the status report, and stop for review. The UI needs a human eye between phases.
2. Do not ask about small design decisions. Use professional judgment and record the important ones in `docs/DECISIONS.md`.
3. Ask before: adding any dependency not named here, changing the database schema beyond section 10, touching payment logic, or changing deployment configuration.
4. **No inert UI.** Do not ship controls that do nothing (search boxes, notification bells, "coming soon" buttons, fake settings).
5. **Data truth.** Every number comes from the API or the ledger. Remove default project ids and fallback sample data from the frontend. If there is no data, show an empty state. Demo data exists only as seeded database rows flagged `is_demo`, always labeled "Demo project".
6. **Honest wording.** Never use "escrow", "guarantee", "protected", "insured", or "secure payments". Use "held for this project". Always say PayPal Sandbox where payments are shown. No invented social proof, ratings, testimonials, customer counts, or certifications. No links to pages that do not exist (no fake Privacy or Terms pages).
7. Never let the LLM execute or trigger a payment. The reviewer produces a verdict; deterministic server code applies policy.
8. Never commit secrets, `.env`, or private Bryntum files. Keep the Bryntum trial package pinned.
9. Preserve: Bryntum Gantt, AI Planner and Reviewer, PayPal sandbox funding and payouts, milestone lifecycle, ledger, audit trail, SSE updates, idempotency, webhook verification, CSRF protections, and the settle moment.

**Kickoff prompt (paste once per conversation, change the phase)**
> Read AGENTS.md, docs/PROGRESS.md, docs/DECISIONS.md, and docs/UI_IMPLEMENTATION.md fully. RUN_MODE is milestone. Work on ONLY phase <P#> from section 14. Restate the goal and checklist in 5 lines, show your plan and the files you will touch, then build it. Use the browser tool to screenshot every new page at 1440, 1024, 768 and 390 px and critique the screenshots against this document before reporting. When done and pnpm verify passes: commit, merge, tag ui-<p#>-done, push, write the handoff note, print the status report with screenshots, and STOP.

---

## 1. Product truth

Milestone connects four things in one workflow: **AI planning, a shared agreement, evidence-based AI verification, and PayPal sandbox funding and payout.**

The differentiator is that **the schedule, the agreed proof of work, and the payment are the same object.** It is not a freelance marketplace, a generic project tool, or a chatbot.

Plain description (use in the hero, the README and the video): *Milestone holds a project's budget, checks each delivery against criteria both sides agreed to, and releases payment when it passes.*

**Prototype disclosure (always visible in the footer and demo bar):** *Sandbox prototype. No real money moves.*

---

## 2. What the redesign must fix

From the current UI: default serif font fallback on the plan screen; mismatched amounts (list versus header); a Fund button on an already funded project; a paid milestone showing "no AI reviews"; an oversized unstyled legend; truncated dates; payment chips on non-milestone tasks; duplicated actions; all-caps labels; "protected by PayPal Sandbox" and "Guarantee & Allocation" wording; held funds drawn in the "needs a decision" color; a persona switch in the header; oversized zoom buttons; the whole product on one screen.

Code-level things to **verify and fix** in Phase 0 (reported as likely but unconfirmed): default `projectId` and sample-data fallbacks in `App.tsx`; demo-oriented fallback identities in auth; persona switching via a cookie endpoint instead of project membership.

---

## 3. Design direction: editorial fintech, precision SaaS

A warm, calm, credible financial collaboration product. Not a purple gradient AI dashboard, not a dark developer console, not a card-in-a-card admin template.

### 3.1 Color tokens (contrast checked; re-verify with an automated checker)

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#F5F2EA` | App and marketing background |
| `--surface` | `#FFFFFF` | Panels, inputs, slide-overs |
| `--forest` | `#202722` | Dark sections, primary buttons, strong text on light |
| `--ink` | `#252922` | Primary text |
| `--ink-2` | `#5F645C` | Secondary text (about 5.4:1 on paper) |
| `--line` | `#E6E3DA` | Hairlines and borders |
| `--teal` | `#337D70` | Fills, primary action fill with white text (about 4.9:1 on white) |
| `--teal-ink` | `#2B6B60` | Teal **text** on paper or white (about 5.5:1) |
| `--teal-wash` | `#E3EFEC` | Teal tints |
| `--amber` | `#D7A65A` | Fills, borders, icons only (fails as text) |
| `--amber-ink` | `#8A5A0B` | Amber **text** (about 5.3:1 on paper) |
| `--amber-wash` | `#F6EBD6` | Amber tints |
| `--red` | `#B3392B` | Errors and failed criteria (about 5.3:1 on paper) |
| `--red-wash` | `#F7E3DF` | Red tints |
| `--focus` | `#2F5FD0` | Focus ring |
| `--teal-on-dark` | `#7CC4B4` | Teal accents on `--forest` |
| `--paper-on-dark` | `#F5F2EA` | Text on `--forest` |

Rules:
- The original secondary text `#777B73` fails contrast on paper; use `--ink-2`.
- Teal is for primary actions and completed or held states. Amber is only for "a person must act or wait". Red only for real failures. Never use all three decoratively.
- Money states (never color alone; always glyph plus word):

| State | Treatment |
|---|---|
| Agreed, not funded | Dashed neutral outline, empty circle |
| Funded (held) | Teal outline, teal wash, filled dot |
| Submitted / in review | Amber wash, clock glyph |
| Needs your decision | Amber solid border, flag glyph |
| Changes requested | Red outline, return glyph |
| Releasing | Amber with spinner |
| Paid | Solid teal, check glyph |

### 3.2 Typography
- **Editorial display:** DM Serif Display (regular only, never faux-bold), used only for the landing headlines, role selection headline, receipt title, and large empty-state headings. Use italic for one emphasized phrase in the hero.
- **UI:** Geist (variable). If unavailable in `@fontsource`, use Inter. Chain: `Geist, Inter, system-ui, sans-serif`.
- **Numbers:** UI font with `font-variant-numeric: tabular-nums`. Never a serif for money.
- Self-host with `@fontsource` packages (no external font requests). Preload the two critical weights. `font-display: swap`. Verify in the **production build** that fonts apply on every page.
- Scale (px): 12, 13, 14, 16, 18, 20, 24, 32, 44, 64 (desktop hero up to 72, mobile 40). Body 15 to 16, line height 1.5. Display line height 1.05 to 1.1, letter spacing -0.02em, `text-wrap: balance`.
- Sentence case everywhere. No all-caps labels, no letter-spaced eyebrow text.

### 3.3 Shape, spacing, elevation
- 4 px grid; steps 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- Radius: cards 12, panels and slide-overs 14, inputs and buttons 8, chips 999, avatars full. Not everything is a pill.
- Fine 1 px `--line` borders; prefer hairline dividers and whitespace to boxes. Shadows only for overlays and one subtle lift on hover for interactive cards.
- Icons: Lucide (`lucide-react`, tree-shaken). Stroke 1.5.
- Content widths: marketing 1200, app content 1120, reading 680.

### 3.4 Motion tokens
- Easing: `--ease-out: cubic-bezier(0.2, 0.7, 0.2, 1)`.
- Durations: fast 120 ms, base 200 ms, slow 480 ms, scene 700 ms.
- Animate only `transform` and `opacity`. No layout-animating properties. No scroll hijacking, snapping, or blocking default scroll.
- Everything respects `prefers-reduced-motion: reduce` (static final states, no transforms, no looping).

### 3.5 Components (build once, reuse)
Button (primary forest, secondary outline, quiet text, destructive; one primary per view), IconButton, Input, Textarea, Select, Field (label, hint, error with `aria-describedby`), Badge/StatusBadge (glyph plus word), Tabs, Dialog, SlideOver (focus trapped, Escape closes), Tooltip, Toast (rare), Skeleton, EmptyState (one sentence, one action), FinancialFigure (large tabular numeral with label), ProjectRow, MilestoneRow, EvidenceChip, Timeline (vertical event list), LifecycleProgress (section 8.1), InspectorPanel, DemoBar, Avatar.

---

## 4. Information architecture

### 4.1 Routes (use React Router; confirm it is already in `package.json`, otherwise ask before adding)

```
Public
/                         Landing (scrollable, animated)
/get-started              Role selection
/join                     Freelancer enters an invite code or link
/join/:token              Invite preview and accept (token or code resolves server-side)
/safety                   Safety and limits (plain, honest)
/receipt/:shareId         Shared receipt (read-only, only if the client created a share link)
/demo                     Demo guide entry (only when DEMO_MODE=true)
/demo/split               Client and freelancer side by side (DEMO_MODE only)

Client (requires client session)
/client                                              Projects
/client/new                                          Wizard: brief, plan, invite, fund
/client/projects/:id                                 Overview
/client/projects/:id/schedule                        Gantt
/client/projects/:id/deliverables                    Deliverables list
/client/projects/:id/deliverables/:milestoneId       Review
/client/projects/:id/payments                        Payments
/client/projects/:id/activity                        Activity

Freelancer (requires freelancer session)
/freelancer                                          Projects
/freelancer/projects/:id                             Overview
/freelancer/projects/:id/deliverables                My deliverables
/freelancer/projects/:id/deliverables/:milestoneId   Milestone and review
/freelancer/projects/:id/schedule                    Schedule
/freelancer/projects/:id/payments                    Payments
```

Fastify must serve `index.html` for every non-`/api` route (SPA fallback) and keep relative `/api` calls. Unauthenticated access to `/client/*` or `/freelancer/*` redirects to `/get-started?role=...`. Unknown routes show a branded not-found page.

### 4.2 Session model
- Two signed, httpOnly, sameSite=lax, secure-in-production cookies: `ms_client` and `ms_freelancer`.
- The web app sends `X-Persona: client|freelancer` from the route prefix; the server reads only the matching cookie. Both roles can therefore be signed in at once (needed for `/demo/split` and for recording).
- The product navigation has **no** persona switch. Switching exists only in the demo bar, only when `DEMO_MODE=true`.
- Authorization is membership based: every project route checks that the session user is the project's client or freelancer.

---

## 5. Public site

### 5.1 Landing page `/` (scrollable, animated, minimal)

The landing is a **vertical story** of about seven screens. Warm paper background alternating with white and one dark forest section. Header sticky: wordmark, "How it works", "For clients", "For freelancers", "Safety", then **Start a project** (primary) and **Join a project** (quiet). The header gains a hairline after the first 8 px of scroll. Footer links only to real pages.

**Section 1: Hero (above the fold)**
- Headline (DM Serif Display, up to 72 px, balanced): *Good work deserves a clear agreement.* with *clear agreement* in italic `--teal-ink`.
- Subheading: *Plan the work, agree the proof, and connect every milestone to its payment.*
- One plain sentence under it (section 1 description) and the line *Sandbox prototype. No real money moves.*
- CTAs: **Start a project** (primary), **Join a project** (secondary).
- Right: `ProductPreview`, a layered, built-in-CSS illustration of the product (not Bryntum; no charts library): a timeline strip with four diamond milestones; one milestone card (name, amount in tabular numerals, mini lifecycle); an acceptance checklist; a payment state. Labeled "Sample project". It loops gently through Funded, Submitted, Verified, Paid (2.4 s per state, holds the final state 3 s, then restarts), pauses on hover or focus, and shows the final state statically under reduced motion. `aria-hidden` with a visually hidden text description.
- Entrance: left column fades up in a 60 ms stagger; preview rises 16 px and fades over 700 ms. No parallax.

**Section 2: One agreement, every milestone**
- Short copy: the plan is the shared reference for both people.
- Visual: an SVG timeline that draws left to right as it scrolls into view (stroke-dashoffset), with milestone diamonds popping in and each amount counting up once. Triggered once by IntersectionObserver.

**Section 3: Proof to payment (the signature scroll scene, dark forest section)**
- A pinned scene: a tall container (about 500 vh) with a sticky inner viewport. Scroll progress selects one of five stages: **Agreed, Funded, Submitted, Verified, Paid**.
- Left: the stage name, one sentence, and two small lines ("The client sees..." and "The freelancer sees...").
- Right: one milestone card that morphs per stage (criteria appear, funded balance counts up, evidence chips attach, criteria tick one by one, the coin travels to the recipient with the receipt lines in the final stage).
- The five-step LifecycleProgress is shown across the top and advances with the scroll.
- Implementation: a small `useScrollProgress` hook (passive scroll listener with `requestAnimationFrame`, or IntersectionObserver sentinels), no animation library. Under reduced motion or on small screens, render the five stages as a normal stacked list with static cards.
- No scroll snapping, no scroll locking. The page height is real so the scrollbar behaves normally.

**Section 4: Two roles, one agreement**
- A segmented toggle (Client, Freelancer) swaps between two real-component previews (project overview versus delivery workspace) with the same demo data. Below: three short lines for each role. Shows that they are different experiences.

**Section 5: Proof before payment**
- A review replay card: criteria tick off one by one as it enters view, each with a small evidence chip and a confidence word. A smaller side card: "Instructions found inside a delivery were ignored" to show the injection defense in plain language.
- One honest paragraph: AI recommends; fixed rules decide whether money moves; people can object. Link "How review works" to `/safety`.

**Section 6: Built for trust**
- Four plain facts as a quiet grid, no fake metrics: money held for the project and released one milestone at a time; every check shows its evidence; every payment is recorded in an audit ledger; the client chooses how much autonomy the AI gets. Beside it, a small real-looking ledger snippet built from sample data labeled "Sample ledger".

**Section 7: Final call to action**
- *Make every milestone count.* Two buttons. Under: *Sandbox prototype. No real money moves.*
- Footer: wordmark; Product (How it works, For clients, For freelancers); Safety and limits; GitHub; Demo (when enabled). No Privacy or Terms unless real pages exist.

**Animation rules for the landing**
- Reveal: `opacity 0 to 1` and `translateY(14px) to 0`, 480 ms, `--ease-out`, stagger 60 to 80 ms, once per element (IntersectionObserver with `threshold ~0.2`, `rootMargin` of -10% at the bottom).
- Anchors scroll smoothly only when reduced motion is not requested; `scroll-margin-top` accounts for the sticky header.
- Performance: below-the-fold images lazy-loaded (WebP/AVIF, explicit width and height), no layout shift, Largest Contentful Paint under 2.5 s on a mid-range laptop, Lighthouse accessibility 95 or higher, no animation work when the tab is hidden.
- The page must still read well with all animation disabled.

### 5.2 Role selection `/get-started`
- Split layout on desktop. Left (forest background, no stock photo): a compact looping LifecycleProgress and the line *Plan the work. Agree the proof. Settle the milestone.* Right (paper): headline in DM Serif Display, *How will you use Milestone?*
- Two large selectable cards with **different** copy:
  - **I'm hiring.** Turn a brief into a structured plan. Invite your freelancer. Fund and review each milestone. CTA: *Create a project*.
  - **I'm delivering work.** Join a project with an invite. Know exactly what is expected. Submit proof and track your payouts. CTA: *Join with an invite*.
- Link: "Have an invite code?" opens `/join`.
- On mobile the left panel collapses to a short header.

### 5.3 Join `/join` and `/join/:token`
- `/join`: one input for a code or full link, button **Find project**, calm error: *This invitation is no longer valid.* (same message for not found, revoked, expired, or used, to prevent probing).
- `/join/:token`: **project preview** (title, client name, description, duration, milestones with amounts and **full acceptance criteria**, total where permitted), a plain line *The client funds the project after you accept*, fields for name, email, and PayPal sandbox email (with a short reason), and **Accept invitation**. After acceptance redirect to the freelancer overview.
- Honest note: *Prototype: email addresses are not verified.*

### 5.4 Safety and limits `/safety`
A short, plain page: how money is held (PayPal sandbox balance, released one milestone at a time), what the AI does and does not do, how prompt injection is handled, the approval modes, what the audit trail records, and the prototype limitations (sandbox only, USD only, email not verified, no regulated escrow, no dispute resolution beyond the appeal step). This page is part of the honesty story judges will read.

---

## 6. Client area

**Shell:** left sidebar on desktop (Overview, Schedule, Deliverables, Payments, Activity), collapsible on tablet, a compact top bar plus a bottom navigation on mobile. Top bar: wordmark, project switcher, project status, a user menu. No search box or notification bell unless they work. An activity popover is acceptable if it reads the real activity feed.

### 6.1 Projects `/client`
A calm list. Each row: title, one state sentence (for example "Waiting for the freelancer to accept", "Milestone 2 needs you"), held amount, paid amount, and **one next-action button** (the strongest idea from the Mesyk reference). Primary button: **New project**. Empty state: *No projects yet. Start with a brief.*

### 6.2 New project `/client/new`
A four-step flow with a thin progress indicator: **Brief, Plan, Invite, Fund**.
1. **Brief:** brief, budget, optional duration, "Use sample brief".
2. **Plan:** milestones on the left as editable cards (name, amount and percent with the total always shown and required to equal 100, 2 to 5 criteria, deliverable type); a Bryntum preview on the right (adjust durations by dragging); an assumptions note. **Approve plan.**
3. **Invite:** heading *Your project agreement is ready.* Summary (name, budget, milestones, duration, invitation status). **Invite freelancer** opens the invitation panel: code (`MILE-` plus 10 characters, see 10.1), **Copy link**, **Copy code**, expiry text, **Revoke**. Live waiting state; on acceptance show *{name} accepted.*
4. **Fund:** summary and PayPal buttons, available only after acceptance. Sandbox label.

### 6.3 Overview `/client/projects/:id`
Answers: *How is my project going, and what do I need to do next?*
- Header: title, description, freelancer and invitation status.
- **Next action** card (one at a time, always first): for example *Milestone 3 passed review. Releases in 14 seconds.* with **Release now** and **Object**; or *Waiting for the freelancer to accept*; or *Fund the project to start*.
- **Financial hierarchy:** one large figure, **Held for this project**, with a segmented bar (Paid, Held, Not yet funded). A quiet row of four small figures underneath (Budget, Funded, Paid, Remaining). Not four equal cards.
- **Current milestone:** its LifecycleProgress and a link to review.
- **Milestone list:** compact rows (state, name, amount, due date).
- **Recent activity:** the last five real events.
- Autonomy setting: a collapsed row ("You approve each payment", "Paid in {n} seconds unless you object", "Paid immediately when the AI is confident").
- Not shown here: the Gantt, the ledger, AI traces.

### 6.4 Schedule: see section 9.

### 6.5 Deliverables `/client/projects/:id/deliverables`
A list: milestone, submitted date, review status, evidence available, AI recommendation, required client action. Row opens the Review page.

### 6.6 Payments `/client/projects/:id/payments`
The proof for PayPal judges. Totals (Budget, Funded, Released, Remaining), a per-milestone breakdown, **every ledger entry** (type, amount, time, PayPal sandbox reference), settlement history, and **Export audit JSON**. The PayPal Sandbox label is visible. Create/revoke **share receipt link** per paid milestone.

### 6.7 Activity
A vertical Timeline of real events with actor (client, freelancer, AI, system), expandable details.

---

## 7. Freelancer area

Separate shell: Overview, My deliverables, Schedule, Payments. **No** funding, autonomy, invitation, or client notes controls anywhere, enforced by role-scoped API responses.

### 7.1 Projects `/freelancer`
Rows with the next action per project. Entry points: "Join a project" input. Empty state: *No projects yet. Join one with an invite.*

### 7.2 Overview `/freelancer/projects/:id`
Answers: *What do I need to deliver next, and when am I paid?*
- **Next up** card: the current milestone, due date, payment attached, acceptance criteria, state, and one primary button (**Submit deliverable**, **Resubmit**, or disabled with the reason, such as *Not funded yet. Wait for the client before you start*). When funded show *Funded and locked. You can start.*
- LifecycleProgress for the current milestone.
- Financial hierarchy: large **Locked for you** (funded and waiting) and **Earned**, small row for the rest.
- Upcoming milestones beneath.

### 7.3 My deliverables
Cards per milestone: required outcome, criteria, due date, payment, state, action. The existing submit dialog is kept and restyled as a slide-over. After submission, a timeline: **Submitted, AI reviewing, Client review (when applicable), Settled or Changes requested.** Never display an invented result.

### 7.4 Schedule: section 9 (read-mostly).

### 7.5 Payments
Earned, paid, pending eligible payouts, per-milestone history, PayPal sandbox references. No client settings.

---

## 8. Shared experience

### 8.1 LifecycleProgress (the signature component)

Five stages: **Agreed, Funded, Submitted, Verified, Paid.** Completed stages are solid teal with a check; the current stage is outlined with its sub-status written out; future stages are quiet. Reused on both overviews, milestone rows (compact variant), the Review page, and the landing scene.

Mapping from backend states (confirm exact names in `packages/shared`):

| Backend state | Active stage | Sub-status text |
|---|---|---|
| project not yet accepted | none | Waiting for the freelancer to accept |
| unfunded (accepted) | Agreed | Waiting for funding |
| funded | Funded | Ready for work |
| submitted, in_review | Submitted | AI reviewing |
| changes_requested | Submitted | Changes requested (problem tone) |
| awaiting_client | Verified | Waiting for the client |
| appealed | Submitted | Appeal under review |
| approved | Verified | Releases in {n}s, or Ready to release |
| releasing | Verified | Releasing |
| paid | Paid | Settled |

A stage is shown complete **only** when the backend confirms it. Paid is never shown early.

### 8.2 Review page (the signature screen)
Routes: client and freelancer deliverable detail. Three zones on desktop (stack on screens under 1280 px):
- **Left, Deliverable:** milestone name, submission details, the submitted text or link, submitted time, supporting evidence, and a vertical **event Timeline** (submitted, AI review, changes requested, resubmitted, approved, paid) in the style of the review-history reference, with human comments in a bordered card.
- **Center, AI verification:** each criterion with Pass, Fail or Unclear, the evidence, a short explanation, and confidence (as words plus a meter; only if provided). Overall recommendation. An expandable **"How the AI checked this"** trace of tool steps in plain language. If injection was suspected: *The reviewer found instructions inside the delivery and ignored them. A person needs to decide.* Never fabricate evidence or confidence.
- **Right (sticky), Payment and next action:** amount, funding status, lifecycle, approval policy, and role-specific actions.
  - Client: **Release payment**, **Request changes**, **Object** (as the state allows).
  - Freelancer: **See what to fix**, **Resubmit**, **Appeal**, and payment status.
- Role rules are enforced on the server; hiding buttons is not enough.

### 8.3 Settlement moment and receipt
Keep and refine the existing coin animation. On payout success show a **receipt card**: *Deliverable verified*; milestone; amount; recipient; PayPal sandbox payout reference; timestamp; ledger entry id; a link to the receipt. Reduced motion: no travel, just the card with a brief highlight. The balance numeral counts up once.
Receipts are **private by default**. A client can create a revocable share link, which exposes `/receipt/:shareId` with names, milestone, amount, and the sandbox reference only.

---

## 9. Schedule (Bryntum)

- Full-width page, **Bryntum Gantt is the visual centerpiece**. Preserve dependencies, milestone diamonds with amount badges, payment status, zoom, fit timeline, the existing custom task model, and the existing sync protocol.
- Remove the permanent legend. Add a one-line key under the chart (the LifecycleProgress stage names with their glyphs).
- A slim **context bar** above the chart: project, view toggle (Gantt, List), zoom out, zoom in, fit, a "Details" toggle that adds start and duration columns.
- Default columns: name and status. No truncated text or dates. Payment chips only on milestones.
- Selecting a task or milestone opens an **inspector panel** (right side) with its details, criteria, and state. Closed by default.
- Restyle Bryntum with CSS variables from the tokens (verify variable names in the docs for the installed version). Hide the default toolbar.
- Client: tasks editable, money and status fields read-only (existing tamper guard remains). Freelancer: only progress editable. Enforced server-side.
- Under 768 px show a **List view** by default with a note that the Gantt is best on a larger screen, and a button to open it.
- Lazy-load Bryntum only on schedule routes to keep the rest of the app fast.
- The landing page does **not** use Bryntum; at most it may use a static screenshot of the real schedule page (confirm the trial license permits it).

---

## 10. Backend changes (only these)

### 10.1 Invitations
Table `invites`: `id`, `project_id`, `created_by`, `token_hash`, `code_hash`, `expires_at`, `max_uses` (default 1), `used_count`, `accepted_by`, `accepted_at`, `revoked_at`, `created_at`.
- Link token: 128 bits from a CSPRNG, base64url. Short code: `MILE-` plus 10 characters from Crockford base32 (about 50 bits). Store only HMAC-SHA-256 hashes using a server secret; compare in constant time; show the plaintext once at creation.
- Expiry default 7 days. Single use by default. Client can revoke.
- Rate limit lookups and accept attempts per IP (for example 10 per 10 minutes) with exponential back-off. Return the same generic message for every invalid state.
- Preview endpoint (no auth) returns only what section 5.3 lists. Accept endpoint creates or updates the freelancer user (name, email, PayPal sandbox email), sets `projects.freelancer_id` (or membership row, whichever the schema already uses), marks the invite used, issues the `ms_freelancer` session, and records an audit event.
- Funding endpoints reject unless the project has an accepted freelancer.

### 10.2 Sessions and roles
- Dual cookies and `X-Persona` handling (section 4.2). Remove cookie-only persona authorization from product routes.
- Role-scoped response shapes: freelancer endpoints never include autonomy settings, client notes, or invite data.
- Server-side authorization matrix, with tests for each cell:

| Action | Client | Freelancer |
|---|---|---|
| Create project, approve plan, edit criteria (before funding) | yes | no |
| Create or revoke invite, fund, set autonomy | yes | no |
| Accept invite, submit deliverable, appeal, update progress | no | yes |
| Release, request changes, object | yes | no |
| Read project, milestones, ledger, reviews | yes | yes (scoped) |

### 10.3 Data truth
- Remove frontend default ids and sample fallbacks.
- Add `projects.is_demo` (seeded true for demo rows). The UI shows a **Demo project** badge on those.
- Add receipt share links: `receipt_shares (id, milestone_id or project_id, share_id_hash, created_by, revoked_at, created_at)`.

### 10.4 Demo mode
- `DEMO_MODE=true` enables `/api/demo/login-as`, `/api/demo/reset`, and the demo bar. Default **false** locally unless set; set true on the hosted hackathon deployment. Demo accounts are real seeded users with real membership, so authorization still applies.

Document every schema change in `docs/ARCHITECTURE.md` and `docs/DECISIONS.md`, with migrations and tests. Do not change payment logic.

---

## 11. Demo mode and judge experience

- **Demo bar** (bottom left, dismissible, only when `DEMO_MODE=true`): *Demo mode: sandbox, no real money moves.* with a step guide: 1 Create a plan, 2 Create an invite, 3 Accept as the freelancer, 4 Fund, 5 Submit a good delivery, 6 Watch review and payout, 7 Try the injection delivery, 8 Open the receipt and audit.
- **`/demo/split`:** client on the left, freelancer on the right (two same-origin iframes using the dual cookies), updating live via SSE. Used for judging and the video.
- `pnpm demo:reset` seeds the demo project (flagged `is_demo`, with real review records for any paid milestone), a sample brief, and three prepared deliverables (good, weak, injection).
- The live demo path must complete in about three minutes.

---

## 12. Responsive, accessibility, performance

**Breakpoints tested:** 1440, 1280, 1024, 768, 390, 360.
- Desktop: full sidebar, comfortable widths, a Gantt with room.
- Tablet: collapsible sidebar, reflowed figures, scrollable schedule.
- Mobile: compact top bar with a bottom navigation, single-column overviews, stacked milestone rows, schedule defaults to List, review page zones stack, no clipped text or buttons, no permanently open side panel. Mobile is designed, not just compressed.

**Accessibility:** semantic landmarks and a skip link; keyboard-operable everything including the lifecycle and slide-overs; visible focus; labeled forms; accessible dialogs with focus trap and return; `aria-live="polite"` for status changes and the settlement; decorative animations `aria-hidden` with text equivalents; no color-only status; contrast verified; reduced motion honored; touch targets 44 px.

**Performance:** route-level code splitting; Bryntum and animation code loaded only where used; fonts self-hosted and preloaded; no layout shift; landing LCP under 2.5 s.

---

## 13. Testing

Existing tests must keep passing. Add:
- **Unit and integration:** invite creation, hashing, expiry, single use, revoke, rate limiting, generic error responses, accept creating membership, funding blocked before acceptance, every cell of the authorization matrix (403 tests), role-scoped DTOs, share-link create and revoke.
- **E2E (Playwright, mock mode):** homepage to role selection; client creates project, approves plan, invites; freelancer accepts via code and via link; fund; submit; review; release; receipt; freelancer cannot reach client routes; client cannot reach freelancer actions; expired and invalid codes; both sessions at once.
- **Accessibility:** axe checks on each major page; keyboard path tests for the invite and review flows.
- **Visual checks:** screenshots at the six breakpoints for landing, role selection, client overview, freelancer overview, schedule, review, payments, and receipt (kept in `docs/screens/`).
- **Honesty lint:** a simple test that fails if the source contains "escrow", "guarantee", or "protected" in user-facing strings.

---

## 14. Phases

Each phase ends with: `pnpm verify`, screenshots, commit, merge, tag, push, handoff note, status report, and stop. Add them to `docs/MILESTONES.md` as sections `M8a` to `M8k` (so `scripts/progress.mjs` counts them), each with an `Estimate:` line and checkboxes.

### P0 Audit and plan (no feature code)
Inspect repo, routes, auth, `App.tsx`, components, API, schema, SSE, tests, scripts, the deployed app. Produce: architecture summary, route and component plan, files to change, backend changes (section 10), risks, and the phase checklist. Verify the likely issues in section 2.
Acceptance: written plan in `docs/DECISIONS.md`; open questions listed; owner approval.

### P1 Design foundation
Fonts, tokens, base CSS, component library (3.5), router and route shells with guards and SPA fallback, honesty lint test, remove header persona switch.
Acceptance: every page uses correct fonts in the production build; components documented on a dev-only `/styleguide`; axe clean.

### P2 Public landing and entry
Landing (5.1) including the hero preview and the pinned proof-to-payment scene, role selection (5.2), `/safety` (5.4).
Acceptance: scroll through at six breakpoints; reduced-motion version reads well; Lighthouse accessibility 95 or more; LCP under 2.5 s; no inert links.

### P3 Backend: invites, sessions, roles
Section 10, with all tests in section 13 for those items.
Acceptance: authorization matrix tests green; invite flow works through the API; no payment logic changes.

### P4 Client area
Shell, projects, wizard (6.2) including the invite panel and funding gate, overview, deliverables, payments, activity.
Acceptance: a new person creates a plan, invites, and funds without instructions; all figures match the ledger.

### P5 Freelancer area
Join pages (5.3), shell, projects, overview, deliverables with the restyled submit slide-over, payments.
Acceptance: freelancer accepts, sees funding status, submits, and watches the review with no client-only controls reachable.

### P6 Lifecycle, review, settlement
LifecycleProgress, Review page (8.2), settlement receipt and share links (8.3).
Acceptance: all backend states map correctly; Paid never shows early; injection state displayed correctly; receipts private by default.

### P7 Schedule
Section 9 for both roles, List view for small screens, inspector panel, lazy loading.
Acceptance: Gantt fully functional; role restrictions enforced server-side; no truncated text.

### P8 Demo mode, split view, seeds
Section 11.
Acceptance: complete demo path in about three minutes; `/demo/split` updates both sides live.

### P9 Polish
Micro-interactions, empty, loading and error states, responsive pass, accessibility pass, performance pass, copy pass, README screenshots, update `docs/DEMO_AND_SUBMISSION.md` script and the video plan.
Acceptance: three clean runs of the demo path; every item in section 15 checked.

### P10 Regression and deployment
Run lint, typecheck, unit, integration, e2e, secret scan, production build, a real sandbox funding and payout, planner and reviewer evals. Review deployment configuration, then deploy and smoke-test from a private browser window.
Acceptance: all green; deployed app passes the demo path; webhook verified.

### Phase prompts (shortcuts)
> Read AGENTS.md, docs/PROGRESS.md, docs/DECISIONS.md and docs/UI_IMPLEMENTATION.md. Work on ONLY phase P<n>. Follow the operating rules in section 0 and finish with the stop routine.

---

## 15. Final acceptance checklist

- [x] Scrollable, animated, minimalist landing communicates the product in five seconds and still works with animation disabled
- [x] Role selection with two clearly different paths
- [x] Distinct client and freelancer shells, navigation and dashboards
- [x] No persona switch in normal navigation; demo switch only in demo mode
- [x] Invitations: random, hashed, expiring, single use, revocable, rate limited, membership created server-side
- [x] Funding only after acceptance
- [x] AI-generated plans editable; criteria locked after funding
- [x] Bryntum Gantt intact, on a dedicated Schedule page, with inspector and List view on mobile
- [x] Client sees funding and payment detail; freelancer sees deliverables and payout status
- [x] LifecycleProgress used consistently and never shows Paid early
- [x] Review page shows evidence per criterion, the trace, and role-specific actions enforced server-side
- [x] Settlement receipt shows the sandbox reference and ledger id; sharing is opt-in and revocable
- [x] Every figure comes from the API or ledger; no fallback sample data; demo rows labeled
- [x] No inert controls; no fake social proof; no dead links
- [x] Honest wording everywhere (no escrow, guarantee, protected); sandbox labeled
- [x] Contrast verified; keyboard, screen reader, and reduced motion supported
- [x] Mobile layouts intentionally designed and usable
- [x] All existing tests pass; new tests added; production build succeeds
- [x] No secrets committed; deployment configuration preserved
- [x] Screenshots at six breakpoints stored for the README and video

---

## 16. Final quality bar

Before declaring a phase done, look at the real UI at desktop and mobile sizes and ask:
1. Does it look like a funded product, not a template?
2. Can a first-time visitor say what Milestone does after five seconds?
3. Can a client find their next action without searching?
4. Does a freelancer know exactly what to deliver and when they are paid?
5. Is the Gantt useful without dominating?
6. Does AI verification look credible and evidence-based?
7. Are payment states instantly understandable, without relying on color?
8. Does every screen have one clear purpose and one primary action?
9. Is there any card, border, legend, or control that does not earn its place? Remove it.
10. Is the settlement moment still the most memorable thing in the app?

If a screen feels crowded, simplify it. If something important is not needed right now, move it to its own page or panel.
