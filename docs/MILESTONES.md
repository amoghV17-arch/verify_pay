# MILESTONES.md

The agent executes these in order. Tick boxes as items are verified (not merely written). `node scripts/progress.mjs` reads this file: keep the heading format (`## Mxx Name`), the `Estimate: N h` line, and the `- [ ]` checkbox lines.

Legend: **Gate** means the agent must stop and ask the owner (see `HUMAN_TASKS.md`). **Learning checkpoint** means follow `LEARNING_MODE.md` at the end of the milestone (never blocking).

**Feature freeze: end of M9.** After that only fixes, polish, tests, docs, and the demo.

## Suggested schedule (14 days, adjust to the real deadline)

| Day | Milestones |
|---|---|
| 1 | M0, start M1 |
| 2 | M1, M2 |
| 3 | M2, start M3 |
| 4 | M3 |
| 5 | M4, start M5 |
| 6 | M5 |
| 7 | M6 |
| 8 | M6, M7 |
| 9 | M8 |
| 10 | M8, M9 (freeze) |
| 11 | M10 |
| 12 | M11 (deploy), stretch if green |
| 13 | M12 |
| 14 | M13 (video, submit early), buffer |

**Compressed 7-day mode:** merge M0 with M1, M2 with M3, M4 with M5, M7 with M6, M9 with M8, drop all stretch items, and start M11 by day 5.

**Rule:** deploy by the middle of the schedule, not at the end. A deployed, slightly rough app beats a perfect local one.

## M0 Foundation and automation
Estimate: 3 h
Goal: a repo where the agent can work safely and fast.
- [x] Gate H1: repo exists with MIT license; kit files committed
- [x] pnpm workspace with `apps/web`, `apps/api`, `packages/shared`, `evals`, `scripts`
- [x] TypeScript strict, ESLint, Prettier, shared tsconfig
- [x] Vitest and Playwright configured with one passing test each
- [x] `docker-compose.yml` for Postgres; `pnpm db:up` works
- [x] zod-validated config loader with unsafe-combination guard (`PAYPAL_ENV`)
- [x] `.env.example` complete; secret-scan check in `pnpm verify`
- [x] GitHub Actions CI runs `pnpm verify`
- [x] `pnpm verify` green on a clean clone
- [x] `docs/DECISIONS.md` created with stack versions recorded
Acceptance: fresh clone, `pnpm install && pnpm db:up && pnpm verify` passes.
Learning checkpoint: yes

## M1 Bryntum Gantt spike
Estimate: 4 h
Goal: kill the biggest risk early. A themed Gantt renders in the SPA.
- [x] Gate H4: Bryntum access decision recorded (trial package for the public repo)
- [x] Gantt component renders a hardcoded 12-task project with dependencies and 4 milestones
- [x] Custom task fields: `milestoneId`, `amountCents`, `paymentStatus`, `acceptanceCriteria`, `deliverableType`
- [x] Milestone renderer shows the state glyph and amount; state classes for all 6 fill treatments
- [x] Theme tokens from `DESIGN.md` applied (colors, fonts)
- [x] Drag to reschedule and dependency creation work
- [x] Screenshot saved to `docs/screens/m1-gantt.png`
Acceptance: the Gantt looks intentional (not default), and renders with the trial package from a clean clone.
Learning checkpoint: yes

## M2 Data layer and Gantt sync
Estimate: 4 h
Goal: the Gantt reads and writes real data.
- [x] Drizzle schema and migrations for all tables in `ARCHITECTURE.md`
- [x] Constraints: unique idempotency key, partial unique index for one `released` per milestone
- [x] Seed script with demo personas and a sample project
- [x] Projects, tasks, dependencies, milestones CRUD with role checks
- [x] Bryntum load/sync endpoints; server ignores client changes to money and status fields
- [x] Demo auth: persona switch with signed cookie sessions
- [x] Integration tests for sync rules and role checks
Acceptance: reload the page, edits persist; a crafted sync request cannot change `amountCents` or status (test proves it).
Learning checkpoint: yes

## M3 PayPal adapter, mock, and funding
Estimate: 6 h
Goal: a client can fund a project and the ledger reflects it, in mock and sandbox modes.
- [x] `PayPalPort` interface, `mockAdapter`, `sandboxAdapter`
- [x] Each endpoint used is verified against official docs and marked in `PAYPAL_INTEGRATION.md`
- [x] OAuth token caching with a single refresh on 401
- [x] Fund order create and capture routes with request ids
- [x] Webhook endpoint: raw body, signature verification (sandbox) or HMAC (mock), event dedupe
- [x] Ledger service with `funded` entries and invariants
- [x] SSE hub and `project.funded` event; UI shows the funded state on the Gantt and the funds meter
- [x] Gate H2 and H3: sandbox credentials and accounts provided
- [x] Tests: duplicate webhook, webhook before capture response, capture failure
- [x] `pnpm smoke:sandbox` funds a real sandbox order (needs a prepared buyer session or a documented manual approval step)
Acceptance: mock e2e funds a project; one real sandbox funding is recorded in the ledger with a PayPal reference.
Learning checkpoint: yes

## M4 Payout release
Estimate: 4 h
Goal: approved milestones can be paid safely.
- [x] Payouts methods in both adapters; item status mapping (success, pending, unclaimed, failed)
- [x] Release service per `ARCHITECTURE.md` section 7.3 (row lock, funds check, idempotency key)
- [x] Payout webhook handling and the reconciler in the worker
- [x] Manual "Release payment" button for a client on an `approved` milestone (temporary path until the reviewer exists)
- [x] Failure injection in the mock: payout failure, delayed webhook, duplicate webhook
- [x] Tests: double click, retried request, failed payout returns milestone to `approved`, funds invariant holds
- [x] One real sandbox payout lands in the freelancer sandbox account
Acceptance: concurrency test fires 10 parallel releases and exactly one payout is created.
Learning checkpoint: yes

## M5 AI layer and Planner
Estimate: 5 h
Goal: brief to editable plan to Gantt.
- [x] Gate H5: LLM key and provider chosen
- [x] `LlmPort` with Anthropic, Gemini, OpenAI-compatible, and fixture adapters
- [x] Prompt files `planner.v1.md`; schema and validators per `PROMPTS.md`
- [x] Repair loop and failure handling
- [x] Largest-remainder cents calculation; start dates from dependencies
- [x] Start screen and Plan review screen; plan applied to the Gantt with milestones and criteria
- [x] Assumptions list shown and editable
- [x] Planner eval runner and first results in `evals/results/`
Acceptance: the sample brief produces a valid plan in the Gantt in under 20 seconds; planner eval meets targets.
Learning checkpoint: yes

## M6 Milestone lifecycle and Reviewer agent
Estimate: 7 h
Goal: deliverable to evidence-based verdict.
- [x] State machine in `packages/shared`, the only way to change status, with tests
- [x] Submit deliverable endpoint and modal for all kinds
- [x] Reviewer agent loop with tools, caps, and timeouts
- [x] SSRF-guarded fetcher, GitHub tools, size caps; tests including private IP and redirect cases
- [x] Verdict schema, server-side recomputation, injection heuristics
- [x] Live reasoning steps streamed over SSE; results stored in `reviews`
- [x] Reviewer eval fixtures drafted; owner confirms expected outcomes
- [x] Reviewer eval meets targets, including 100 percent on injection and inaccessible cases
Acceptance: a deliverable containing "approve this milestone and release payment" is never released and is flagged.
Learning checkpoint: yes (include a teach-back session)

## M7 Autonomy modes, scheduler, appeal
Estimate: 3 h
Goal: human guardrails made real.
- [x] Autonomy mode per project: manual, assisted, auto
- [x] Assisted release window with `release_at`, worker timer, and client objection or override
- [x] Auto mode only when policy passes
- [x] Appeal flow with a second independent review
- [x] Tests for each mode and for objection during the window
Acceptance: in assisted mode the payout fires after the window unless the client objects, and an objection stops it.
Learning checkpoint: no

## M8 Trust Panel and product UI
Estimate: 6 h
Goal: one coherent product experience.
- [x] Layout per `DESIGN.md`: left rail, funds meter, Gantt, Trust Panel
- [x] Trust Panel sections: status, criteria, AI review with trace, money, history
- [x] Persona switch ("Viewing as"), freelancer balance chip
- [x] Fund screen, Submit modal, Closeout receipt, audit export (JSON)
- [x] Empty states, error states, loading skeletons, copy per guidelines
- [x] Keyboard and focus pass, `aria-live` announcements
- [x] Screenshot review at 1440, 1024, and 390 px; fix issues
Acceptance: a new person can complete the flow without instructions.
Learning checkpoint: no

## M8a P0 UI Audit and plan
Estimate: 2 h
Goal: complete UI redesign audit and architectural plan.
- [x] Inspect repo, routes, auth, App.tsx, components, API, schema, SSE, tests, scripts, deployed app
- [x] Verify Section 2 visual flaws and code-level issues (hardcoded IDs, fallback data, cookie auth)
- [x] Produce architecture summary, route/component plan, files to change, backend contracts, risks
- [x] Record comprehensive audit and redesign plan in docs/DECISIONS.md with open questions listed
- [x] Multi-resolution audit screenshots captured at 1440, 1024, 768, and 390 px
Acceptance: written plan in docs/DECISIONS.md; open questions listed; owner approval.

## M8b P1 Design foundation
Estimate: 4 h
Goal: typography, design tokens, component library, router foundation, and honesty lint.
- [x] Install and configure Geist and DM Serif Display self-hosted fonts
- [x] Implement design tokens CSS (paper, surface, forest, ink, line, teal, amber, red)
- [x] Build reusable component library (Button, Field, StatusBadge, Dialog, SlideOver, etc.)
- [x] Configure React Router with route shells, guards, and SPA fallback
- [x] Add honesty lint test for user-facing copy
- [x] Build dev-only /styleguide catalog with zero axe accessibility violations
Acceptance: every page uses correct fonts in the production build; components documented on a dev-only /styleguide; axe clean.

## M8c P2 Public landing and entry
Estimate: 5 h
Goal: editorial landing story, role selection, safety page.
- [x] Build minimal, animated landing page (Hero with ProductPreview, Agreement, Proof scene, etc.)
- [x] Implement pinned 5-stage proof-to-payment scene with scroll progress
- [x] Build role selection screen (/get-started) with two distinct paths
- [x] Build honest /safety and prototype limits page
- [x] Verify accessibility, performance (LCP < 2.5s), and reduced-motion fallback
Acceptance: scroll through at six breakpoints; reduced-motion version reads well; Lighthouse accessibility 95+; LCP under 2.5s.

## M8d P3 Backend: invites, sessions, roles
Estimate: 4 h
Goal: HMAC invites, dual session cookies, role authorization matrix.
- [x] Create invites table with token_hash and code_hash HMAC verification
- [x] Implement rate-limited invite creation, preview, and acceptance endpoints
- [x] Implement dual cookies (ms_client, ms_freelancer) and X-Persona header validation
- [x] Add projects.is_demo column and enforce server-side role authorization matrix
- [x] Add unit and integration tests for all authorization matrix cells
Acceptance: authorization matrix tests green; invite flow works through the API; no payment logic changes.

## M8e P4 Client area
Estimate: 5 h
Goal: client shell, projects overview, 4-step wizard, deliverables, payments.
- [x] Build client application shell with persistent left sidebar
- [x] Build client projects list (/client) with next-action buttons
- [x] Build 4-step project creation wizard (/client/new: Brief, Plan, Invite, Fund)
- [x] Build client project overview (/client/projects/:id) with financial hierarchy and next action
- [x] Build client deliverables list, payments view with audit export, and activity log
Acceptance: a new person creates a plan, invites, and funds without instructions; all figures match the ledger.

## M8f P5 Freelancer area
Estimate: 4 h
Goal: invite join, freelancer shell, deliverables with restyled slide-over, payments.
- [x] Build join project screens (/join and /join/:token) with invite acceptance
- [x] Build freelancer application shell and projects list (/freelancer)
- [x] Build freelancer project overview with "Locked for you" financial cards and Next Up action
- [x] Build freelancer deliverables view with restyled submission slide-over
- [x] Build freelancer payments view with PayPal payout references
Acceptance: freelancer accepts, sees funding status, submits, and watches the review with no client-only controls reachable.

## M8g P6 Lifecycle, review, settlement
Estimate: 5 h
Goal: LifecycleProgress, 3-zone review, settlement receipt, share links.
- [x] Build signature LifecycleProgress component mapping all backend states cleanly
- [x] Build 3-zone Review screen (Deliverable, AI Verification, Payment/Action)
- [x] Implement injection warnings and expandable AI reasoning tool trace
- [x] Build settlement receipt card and private-by-default share links (/receipt/:shareId)
- [x] Verify settlement animation and count-up chip with reduced-motion support
Acceptance: all backend states map correctly; Paid never shows early; injection state displayed correctly; receipts private by default.

## M8h P7 Schedule (Bryntum Gantt)
Estimate: 3 h
Goal: visual centerpiece schedule page, inspector panel, mobile List view.
- [x] Dedicated full-width schedule page with context bar (zoom, fit, view toggle)
- [x] Restyle Bryntum Gantt with editorial fintech CSS tokens
- [x] Build slide-over task inspector panel
- [x] Implement responsive mobile fallback (List view below 768px)
- [x] Implement code-splitting and lazy-loading for Bryntum bundle
Acceptance: Gantt fully functional; role restrictions enforced server-side; no truncated text.

## M8i P8 Demo mode, split view, seeds
Estimate: 3 h
Goal: guided demo walkthrough, /demo/split dual-iframe view, prepared deliverables.
- [x] Build dismissible DemoBar with step-by-step guided walkthrough
- [x] Build /demo/split dual-iframe view synchronizing client and freelancer over SSE
- [x] Update seed scripts and pnpm demo:reset with is_demo flag and prepared deliverables
- [x] Verify complete demo path in under 3 minutes
Acceptance: complete demo path in about three minutes; /demo/split updates both sides live.

## M8j P9 Polish and quality pass
Estimate: 3 h
Goal: micro-interactions, responsive pass across 6 breakpoints, copy review.
- [x] Polish micro-interactions, loading skeletons, and empty states
- [x] Comprehensive responsiveness pass at 1440, 1280, 1024, 768, 390, 360 px
- [x] Accessibility pass with axe-core and keyboard navigation verification
- [x] Copy and honesty audit across all screens
- [x] Update README and docs/DEMO_AND_SUBMISSION.md with new screenshots and script
Acceptance: three clean runs of the demo path; every item in section 15 checked.

## M8k P10 Regression and deployment
Estimate: 3 h
Goal: full regression, sandbox verification, production deploy to Render.
- [x] Run full verification suite (lint, typecheck, unit, failure drills, E2E)
- [x] Execute real sandbox funding and payout smoke test
- [x] Deploy updated build to Render and run health checks
- [x] Verify production webhook delivery and private-window demo flow
Acceptance: all green; deployed app passes the demo path; webhook verified.

## M8l L0 Hardcode audit and plan
Estimate: 2 h
Goal: audit hardcoded literals, classify hits, verify Render environment, list affected tables/endpoints, and establish proof plan.
- [x] Run section 1.3 audit commands across web and api
- [x] Classify every hit as allowed (labeled), test-only, or remove
- [x] Check Render environment variables against section 8
- [x] Verify whether deployed app is using mock or fixture
- [x] List all database tables and API endpoints affected
- [x] Record classified hit table and proof plan in docs/DECISIONS.md
Acceptance: complete classified list; owner approval.

## M8m L1 Purge hardcoded data
Estimate: 5 h
Goal: typed hooks, loading/error/empty states, server-derived money values, canary test, CI guard, removal of fallbacks.
- [x] Remove all fallbackData and sampleProject references from frontend
- [x] Replace hardcoded IDs, names, and amounts with typed API hooks and empty states
- [x] Implement server-derived money values in DTOs
- [x] Build automated Canary test (unusual inputs: 1337.42, Zebra Co, Quill)
- [x] Implement CI guard banning currency literals and demo names in apps/web/src
Acceptance: canary test passes in mock mode; CI guard is green; manual check in 1.7 passes.

## M8n L2 Live demo sessions and abuse guards
Estimate: 4 h
Goal: isolated visitor demo sessions, sandbox buyer card, rate limits, daily caps, demo cleanup.
- [x] Per-visitor isolated demo sessions on /demo
- [x] Sandbox buyer login credentials card on /demo and DemoBar
- [x] Configure freelancer payout recipient to personal sandbox account
- [x] Implement rate limiting, daily LLM cap, demo budget cap, and 24h session cleanup
- [x] Prepared deliverables (good, weak, injection) in demo guide
Acceptance: two browsers run two independent demo projects at once without interfering.

## M8o L3 Instrumentation
Estimate: 4 h
Goal: external_calls table, call logging without secrets/bodies, mode truth API, red banner on simulation.
- [x] Create external_calls table and migration
- [x] Wrap PayPal adapter and LLM port with call duration and debug ID logging
- [x] Implement GET /api/system/mode truth endpoint
- [x] Implement mode truth banner in UI (red banner when mock/fixture in demo mode)
- [x] Expose read-only webhook receipt log from paypal_events
Acceptance: after one run, call log lists real PayPal and LLM calls with debug IDs and durations.

## M8p L4 Proof API and UI
Estimate: 5 h
Goal: proof reconciliation API, three-pane split view, /status page, settlement receipt verification.
- [x] Build GET /api/proof/projects/:id with environment and money reconciliation checks
- [x] Build /demo/proof page and client Proof tab with reconciliation table and call tape
- [x] Upgrade /demo/split to three-pane view (Client | Freelancer | PayPal truth)
- [x] Build public /status health page (cached 10s, zero secrets)
- [x] Enhance settlement receipt with live PayPal reconciliation timestamp and debug IDs
Acceptance: every reconciliation row matches; artificially introduced mismatch detected.

## M8q L5 Live acceptance and runbook rehearsal
Estimate: 4 h
Goal: automated live acceptance script and manual 4-window side-by-side verification runbook.
- [x] Implement pnpm acceptance:live Playwright script
- [x] Execute 4-window side-by-side runbook (Client, Freelancer, Freelancer Sandbox, Business Sandbox)
- [x] Verify balance changes on PayPal sandbox accounts
- [x] Save acceptance run results and evidence screenshots
Acceptance: acceptance:live passes twice in a row against deployed app; manual runbook matches all steps.

## M8r A0 Audit and plan (read-only)
Estimate: 2 h
Goal: inspect auth, personas, cookies, sessions, users, invites, demo mode, guards, and frontend shells; record complete audit, schema migration list, route map, and risk plan.
- [x] Inspect existing auth, personas, cookies, sessions, users table, invites, demo mode, route guards, and frontend shells
- [x] List every place that assumes a persona across API, schema/seed, and web UI
- [x] Record A0–A7 implementation plan, schema migration list, route map, and risks in docs/DECISIONS.md
- [x] Add phases A0–A7 as M8r–M8y in docs/MILESTONES.md
Acceptance: complete inventory and plan in docs/DECISIONS.md; owner approval before A1.

## M8s A1 Screen 1 and PublicShell polish
Estimate: 3 h
Goal: fix all Screen 1 defects, add PublicShell auth-aware nav and footer links, add SEO metadata and Open Graph preview assets.
- [x] Apply all 9 Screen 1 fixes on /get-started and /join (single logo, sentence-case eyebrows/labels, compliant security copy, Sample label on progress, auth-first CTAs, .sr-only CSS, title/badge state consistency)
- [x] Update PublicShell header (Log in + Get started when signed out; Open workspace + account menu when signed in) and footer (Help, Terms, Privacy, Status)
- [x] Add favicon, apple-touch-icon, Open Graph preview PNG, and meta tags in index.html
Acceptance: Screen 1 checklist items all fixed; code compiles and dev server starts.

## M8t A2 Auth backend core, security headers, and email system
Estimate: 8 h
Goal: schema migrations for accounts/sessions/tokens/auth_events/notifications/outbox, scrypt/argon2 hashing, opaque cookie sessions, auth + account API routes, CSP/Helmet/rate limits, EmailPort.
- [x] Run additive Drizzle migrations for users (password_hash, email_verified, payout_paypal_email, headline, default_role, is_demo, deleted_at, etc.), sessions, email_tokens, auth_events, notifications, notification_prefs, email_outbox, invites.invited_email
- [x] Implement password hashing, HIBP check, timing-safe login/lockout, opaque SHA-256 session cookie (`milestone_sid`, CSRF double-submit)
- [x] Implement auth, verification, password reset, onboarding, settings, payout, and notifications endpoints
- [x] Implement EmailPort (DevOutboxAdapter + /demo/mailbox when DEMO_MODE=true, ResendAdapter, SmtpAdapter) and Security Headers / CSP
- [x] Wire optional Google/GitHub OAuth if configured via env
Acceptance: all auth and settings endpoints compile cleanly and dev server starts.

## M8u A3 Ownership, membership authorization, and user_id migration
Estimate: 6 h
Goal: replace X-Persona, ms_client/ms_freelancer, and fallback user_client_01/user_freelancer_01 with strict session authentication and project membership checks.
- [x] Require session auth on protected endpoints and enforce project membership (clientId vs freelancerId) across projects, milestones, gantt, fund, proof, invites, and receipt shares
- [x] Update release.ts to read freelancer payout email from users.payout_paypal_email (fallback to project snapshot / DEMO_FREELANCER_PAYPAL_EMAIL in demo mode)
- [x] Implement one-time migration mapping user_client_01/user_freelancer_01 projects to demo/real accounts and delete /api/auth/persona + X-Persona
Acceptance: cross-account access returns 403; unauthenticated protected calls return 401; code compiles and dev server starts.

## M8v A4 Frontend auth screens, route guards, onboarding, settings
Estimate: 7 h
Goal: build public auth pages, client route guards with next redirects, onboarding wizard, and tabbed settings + notifications views.
- [x] Build /signup, /login, /check-email, /verify-email/:token, /forgot-password, /reset-password/:token, and OAuth callbacks
- [x] Build AuthContext and RequireAuth / RedirectIfAuth guards preserving ?next=
- [x] Build /onboarding (role intent, PayPal payout email verification, first project CTA)
- [x] Build /settings/* (Profile, Payouts, Security, Notifications) and /notifications inbox page
- [x] Update /get-started and /join/:token to route through real account sign-in/signup and verify invite ownership rules
Acceptance: full signup -> verify -> onboarding -> settings flow compiles cleanly and dev server starts.

## M8w A5 Shell navigation, workspace switcher, notifications, help & legal pages
Estimate: 6 h
Goal: unify WorkspaceShell with role switcher, account menu, notification bell, breadcrumbs, mobile drawer, and public support/legal pages.
- [x] Implement unified WorkspaceShell with workspace mode switcher (Client / Freelancer) backed by real user memberships
- [x] Add topbar notification bell + unread badge, user account dropdown, and project-scoped breadcrumbs
- [x] Implement responsive mobile navigation drawer
- [x] Build /help, /terms, and /privacy pages with plain-English policies and sandbox disclosure
Acceptance: signed-in and signed-out shells navigate all routes without persona cookies or hardcoded workspace labels.

## M8x A6 Demo isolation, DEMO_MODE gating, Playwright helpers, seed cleanup
Estimate: 5 h
Goal: gate demo surfaces on DEMO_MODE=true, enforce visitor-scoped demo session isolation, move DemoBar into pill/drawer, keep seed data clean.
- [x] Gate /api/demo/*, /demo*, and /demo/mailbox on DEMO_MODE=true; return 404 when false
- [x] Refactor DemoBar to compact "Demo mode" top-bar pill + drawer using isolated visitor sessions without switching real users
- [x] Isolate demo user accounts (is_demo=true, .invalid emails) and auto-expire demo workspaces after 24h
- [x] Clean seed.ts to avoid polluting real workspaces and update e2e/Playwright auth helpers for real session login
Acceptance: DEMO_MODE=false cleanly hides all demo controls and routes; code compiles and dev server starts.

## M8y A7 Full verification, E2E test suite, security checks, screenshot review
Estimate: 5 h
Goal: add unit/integration/E2E coverage for auth, ownership, invites, payouts, Screen 1, and DEMO_MODE=false; pass pnpm verify and screenshot audit.
- [x] Run pnpm test, pnpm lint, pnpm typecheck, pnpm build, and full pnpm verify
- [x] Add/pass E2E tests: full signup/verify/login/reset, cross-user 403 isolation, invite ownership rules, payout email binding, Screen 1 visual assertions, DEMO_MODE=false smoke
- [x] Run screenshot review at 1440, 1024, and 390 px across light views and verify live Render deploy / email delivery checklist
Acceptance: pnpm verify green; zero prohibited copy; owner sign-off.

## M9 The settle moment and polish (feature freeze)
Estimate: 3 h
Goal: one memorable interaction and a clean finish.
- [x] Settle animation per `DESIGN.md` with reduced-motion fallback
- [x] Count-up balance chip and ledger entry reveal
- [x] Final copy pass, favicon, page title, meta tags
- [x] Remove or hide any unfinished UI
- [x] Tag `v0.9-freeze`
Acceptance: the payout moment is satisfying in a screen recording, and nothing on screen looks unfinished.
Learning checkpoint: no

## M10 Hardening, evals, failure drills
Estimate: 5 h
Goal: it works every time, and we can prove it.
- [x] Full Playwright e2e on the mock: brief to paid, in all three autonomy modes
- [x] Failure drills automated: delayed webhook, duplicate webhook, payout failure, LLM invalid JSON, LLM timeout, tool SSRF attempt, injection
- [x] Final planner and reviewer eval runs on the demo model; results saved
- [x] Performance check: review under 40 seconds in normal cases; plan under 20 seconds
- [x] `pnpm demo:reset` restores a clean demo project and personas in under 10 seconds
- [x] Accessibility audit (axe or similar) with no serious issues
- [x] Run ledger and concurrency tests against real Postgres in CI and via DATABASE_URL_TEST
- [x] Project-row lock in the release transaction and count release_pending as reserved
- [x] Verify the webhook signature request does not re-serialize the event body
- [x] Dependency audit and upgrade decision
- [x] Persist PGlite data locally
- [x] Add missing decision records (auth and CSRF, SSE, mock adapter fidelity, secret scanner)
Acceptance: three consecutive clean runs of the full demo path.
Learning checkpoint: yes (failure drills)

## M11 Deploy
Estimate: 3 h
Goal: hosted demo URL with real sandbox payments.
- [x] Gate H6: free Postgres created
- [x] Gate H7: Render service created from `render.yaml`
- [x] Environment variables set; migrations on deploy; `/healthz`
- [x] Gate H8: PayPal webhook registered with the Render URL; `PAYPAL_WEBHOOK_ID` set
- [x] `pnpm smoke:sandbox` against the deployed URL succeeds: fund, review, payout, webhook received
- [x] Wake-up script for the sleeping free instance
- [x] Demo seed loaded in production
Acceptance: from a private browser window the hosted app completes a sandbox funding and payout.
Learning checkpoint: no

## M12 Documentation and submission assets
Estimate: 4 h
Goal: a repo and description that judges can trust.
- [x] README: pitch, screenshot or GIF, architecture diagram, run instructions (mock and sandbox), env vars, tests, evals table
- [x] README sections: Money safety (invariants and tests), How the AI is kept safe, AI tools used and how, Limitations and production path
- [x] `THIRD_PARTY_NOTICES.md`; license headers where needed
- [x] Gate H9: owner reviews the honesty text
- [x] Submission texts drafted in `DEMO_AND_SUBMISSION.md`
- [x] Judge-mode learning session completed
Acceptance: someone else can run the mock demo from the README in under 10 minutes.
Learning checkpoint: yes (judge mode)

## M13 Video and submission
Estimate: 4 h
Goal: submit early.
- [x] Rehearsal: three full read-throughs against the script
- [ ] Gate H10: record, edit, upload (under 3 minutes)
- [x] Final end-to-end check of all links in a private window
- [ ] Submit at least 24 hours before the deadline
- [x] Post-submission: leave the demo environment untouched and healthy until judging ends
Acceptance: submission confirmation received; every link opens for a logged-out viewer.
Learning checkpoint: no

## S1 Critical path and baseline overlay (stretch)
Estimate: 2 h
- [ ] Critical path highlight toggle
- [ ] Baseline versus current bars with a "what slipped" summary
Only if schedule is GREEN after M10.

## S2 Refund unreleased funds on cancellation (stretch)
Estimate: 2 h
- [ ] Cancel project flow, refund the remaining held amount through PayPal, ledger entry `refunded`
Only if schedule is GREEN after M10.

## S3 Bryntum TaskBoard for the freelancer (stretch)
Estimate: 3 h
- [ ] Task board view synced with the Gantt data
Only if schedule is GREEN after M10.

## S4 Dark theme (stretch)
Estimate: 2 h
- [ ] Dark token set and Bryntum dark theme with contrast checks
Cut first.
