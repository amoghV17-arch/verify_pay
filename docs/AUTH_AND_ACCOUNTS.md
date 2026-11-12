# AUTH_AND_ACCOUNTS.md: accounts, sign up, log in, and the professional site shell

Place at `docs/AUTH_AND_ACCOUNTS.md`. It extends `docs/UI_IMPLEMENTATION.md` and `docs/LIVE_PROOF.md`. Where it conflicts with them, this file wins for accounts, sessions, onboarding, and the public/professional pages. `AGENTS.md` safety rules always win.

**Role:** principal full-stack engineer and product designer adding real accounts to an existing, working, deployed application. The visual style (warm paper, forest, teal, DM Serif Display headlines, Geist UI) is approved. Do not redesign it; extend it.

## 0. Operating rules

1. **Verification policy for this work:** do **not** write tests, run `pnpm verify`, Playwright, audits, or screenshot reviews during phases A0 to A6. After each phase only make sure the code compiles and the dev server starts. All tests, security review, accessibility checks, screenshots and regression runs happen **once, in phase A7**.
2. Each phase still ends with: commit, merge, tag `acct-<a#>-done`, push, short handoff note, status report, and **stop**.
3. Preserve everything that works: PayPal sandbox funding and payouts, planner, reviewer, ledger, Gantt, SSE, proof and status pages, invites, receipts, demo mode.
4. No inert UI, no fake social proof, no invented compliance claims. Never use "escrow", "guarantee", "protected", "insured", "secure payments", or "secure sandbox".
5. Never commit secrets. Never log passwords, tokens, or session ids.
6. Pre-approved dependencies (ask before anything else): `@node-rs/argon2` (or Node's built-in `crypto.scrypt` if the native build is a problem on Windows or Render), `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cookie` (if not present), `resend` (or plain SMTP via `nodemailer`), `lucide-react` (already used). Record the choices in `docs/DECISIONS.md`.
7. Ask me only for things in section 7 (human tasks) or real product decisions not covered here.

**Kickoff prompt (change the phase)**
> Read AGENTS.md, docs/PROGRESS.md, docs/DECISIONS.md, docs/UI_IMPLEMENTATION.md, docs/LIVE_PROOF.md and docs/AUTH_AND_ACCOUNTS.md fully. RUN_MODE is milestone. Work on ONLY phase <A#> from section 10. Do not run tests, pnpm verify, Playwright or screenshot reviews in this phase (they happen in A7); just make sure the code compiles and the dev server starts. Restate the goal and checklist in 5 lines, show your plan and the files you will touch, then build it. Finish with commit, merge, tag acct-<a#>-done, push, handoff note, status report, and STOP.

---

## 1. Problems visible in the current screens (fix in A1)

| # | Where | Problem | Fix |
|---|---|---|---|
| 1 | Landing hero preview | The accessibility description is displayed as visible text above the card | The text must be visually hidden (a proper `.sr-only` class), still available to screen readers |
| 2 | Hero, role page, join page, footer | All-caps labels ("SAMPLE PROJECT", "ACCEPTANCE CRITERIA", "2 OF 3 VERIFIED", "GET STARTED", "THE STANDARD FLOW", "PRODUCT", "TRUST & CODE") | Sentence case; no letter-spaced eyebrow text |
| 3 | Hero preview | Milestone named "Interactive Prototype Verified" while its state is "Under AI Review" | Name it "Interactive prototype"; the state chip carries the status |
| 4 | Role page, join page | "secure sandbox funding" and "payment protection" | "sandbox funding" and "held for this project" |
| 5 | Join page | A visible mock invite code (`MILE-MOCKINVITE`) | Remove. Replace with "Don't have a code? Ask your client to send one." and, in demo mode only, a "Try the demo" link |
| 6 | Every page | The Demo Guide pill overlaps content (hero, role page text, the sidebar bottom) | Move to a small, collapsible pill at the bottom right with safe margins, below dialogs in z-order, hidden when the viewport is narrow; never over the account menu |
| 7 | Role page | Two logos (header and dark panel); the card column leaves a large empty area on the right | Remove the duplicate logo; center or rebalance the layout |
| 8 | Workspace shell | No account menu; breadcrumb reads "Projects / Workspace" | Add the account menu (section 4.6); breadcrumb shows the real project or page name |
| 9 | Left panel on role page | A static "Ready to release" progress strip that looks live | Use the real looping lifecycle illustration labeled "Sample", or remove it |

---

## 2. Product decisions

1. **One account per person.** Roles are not account types. A person can be a client on some projects and a freelancer on others. The workspace (client or freelancer) is chosen by route and by project membership.
2. **Sign up and log in are required** to create a project, accept an invite, fund, submit, or review. Public pages stay open: landing, safety, help, terms, privacy, status, join preview.
3. **Intent carries through sign up.** Clicking "I'm hiring" or "I'm delivering work" on the role page goes to `/signup?intent=client` or `/signup?intent=freelancer`. The intent decides the first workspace and the onboarding steps, but can be changed any time from the account menu.
4. **Demo accounts remain.** `/demo` and the demo bar create throwaway accounts (flagged `is_demo`, address `demo-<random>@demo.milestone.invalid`) and sign the visitor in automatically. They use the same account system, so authorization is identical. Cleaned up after 24 hours.
5. **Sessions:** one opaque, server-side session. In demo mode only, named session slots allow two accounts to be signed in at the same time (for `/demo/split`).
6. **Email:** real delivery only if a provider is configured. Otherwise emails are stored and shown honestly (section 5.4).
7. **Prototype honesty:** accounts are real, but the product is a sandbox prototype. State that in the footer, in the signup form, and in the privacy notice.

---

## 3. Routes

```
Public
/                            Landing (header shows Log in and Get started, or Open workspace when signed in)
/get-started                 Role selection (sends to /signup with intent)
/signup                      Create account
/login                       Log in
/forgot-password             Request reset (only when real email is configured)
/reset-password/:token       Set a new password
/verify-email/:token         Confirm email
/check-email                 "We sent you a link" screen
/join, /join/:token          Invite entry and preview (preview public, accepting needs sign in)
/help                        Help and FAQ
/terms                       Prototype terms
/privacy                     Privacy notice
/safety, /status             Existing
/demo, /demo/split, /demo/proof, /demo/mailbox   Demo mode only
/404 and an error page       Branded

Signed in
/onboarding                  Steps after signup (profile, payout details for freelancers)
/client/*                    Client workspace (existing)
/freelancer/*                Freelancer workspace (existing)
/settings                    Redirects to /settings/profile
/settings/profile
/settings/security
/settings/notifications
/settings/payouts            Freelancer payout details
/settings/account            Data export and delete account
/notifications               Full notification list
```

Route guards redirect signed-out visitors to `/login?next=<path>` and return them to `next` after login. A signed-in visitor on `/login` or `/signup` is redirected to their workspace. Workspace routes check membership server-side as before.

---

## 4. Screens

All use the existing tokens. Forms are single-column, 8 px radius, labels above fields, inline validation on blur, clear error text tied to inputs, a visible focus ring, a show or hide password toggle, and one primary button per page.

### 4.1 Auth layout
Split layout like the role page. Left (forest, desktop only): one short line (*Plan the work. Agree the proof. Settle the milestone.*), the real sample lifecycle illustration labeled "Sample", and the footer line *Sandbox prototype. No real money moves.* Right (paper): the form. Mobile: left panel collapses to the wordmark.

### 4.2 Sign up `/signup`
Fields: full name, email, password (with a live strength hint and "at least 10 characters"), a checkbox *I agree to the prototype terms and privacy notice* (links to `/terms` and `/privacy`). Optional *Continue with Google* only when configured (section 7). Under the button: *Already have an account? Log in*. A note: *Use a throwaway password. This is a sandbox prototype.* On success: if email verification is on, go to `/check-email`, otherwise straight to onboarding.
If the intent is `freelancer` or `client`, show a small line *Signing up to hire* or *Signing up to deliver work* with a "Change" link to the role page.

### 4.3 Log in `/login`
Email, password, **Log in**, *Forgot password?* (shown only when reset is available), Continue with Google (only when configured), *New here? Create an account*. Generic failure message: *Email or password is incorrect.* After repeated failures show *Too many attempts. Try again in a few minutes.* Respect `next`.

### 4.4 Forgot and reset password
- Available only when a real email provider is configured. Otherwise the page explains: *Password reset needs email delivery, which is turned off in this prototype. Create a new account or use the demo instead.*
- Request screen: email field; always shows *If an account exists for that email, we sent a link.*
- Reset screen: new password and confirm; on success all other sessions are revoked, and the user is signed in or sent to login.

### 4.5 Verify email
- A link in the email goes to `/verify-email/:token`, which confirms and redirects with a success message. An expired or used link offers *Send a new link*.
- Verification mode (`EMAIL_VERIFICATION`): `off` (no banner), `soft` (a dismissible banner; everything works), `required` (cannot create invites or fund until verified). Default `soft`.

### 4.6 Onboarding `/onboarding`
Short, skippable where possible, with a thin step indicator.
1. **Profile:** display name (prefilled), company or team (optional), avatar color.
2. **Freelancer path only:** payout details, the PayPal **sandbox** email that receives payouts, with a plain explanation *Use your PayPal sandbox personal account email. No real money is sent.* Required before accepting an invite, optional until then.
3. **Finish:** a clear next step: clients see *Start your first project*, freelancers see *Join with an invite code* (plus the demo link in demo mode).

### 4.7 Account menu and workspace switcher
In every signed-in shell (replace the empty bottom of the sidebar and the top bar): avatar with initials, name, email, a **workspace switcher** (Client workspace, Freelancer workspace, each showing a count of active projects; a workspace with no projects offers "Start a project" or "Join a project"), **Settings**, **Help**, **Log out**. A small *Sandbox* badge sits next to the wordmark, not as a separate floating element.

### 4.8 Settings
- **Profile:** name, company, avatar color, email (read-only after verification; changing email is out of scope).
- **Security:** change password (current password required), list of active sessions with device summary and last used time, **Log out of other sessions**, a short security activity list (logins, password changes, failed attempts), and a notice that this is a prototype.
- **Notifications:** per-event toggles for email (only meaningful when a provider is configured, otherwise labeled *In-app only in this prototype*).
- **Payouts (freelancer):** PayPal sandbox email with a clear label, last changed date. Changing it while a payout is pending is blocked with an explanation.
- **Account:** **Export my data** (JSON download of profile, memberships, and activity), **Delete account** (confirm with password and a typed word). Deletion is refused with an explanation while the user is on a project with funded, unreleased milestones; otherwise it removes personal data and anonymizes references so ledgers stay intact.

### 4.9 Notifications
A bell with an unread count, a popover with the latest items, and `/notifications` for the full list with filters (all, unread). Backed by a real table, updated live by the existing event stream. Items: invite accepted, project funded, deliverable submitted, review finished, needs your decision, objection window started and ending, changes requested, appeal result, payment sent or received. Each links to the right page. No bell appears for signed-out visitors.

### 4.10 Landing header states
- Signed out: **Log in** (quiet) and **Get started** (primary, goes to `/get-started`). Keep "Join a project" in the role page and as a footer link.
- Signed in: **Open workspace** (primary) and the avatar menu.
The existing "Start a project" and "Join a project" buttons in the hero keep working: signed out they lead to the role page or signup with intent; signed in they go straight to `/client/new` or `/join`.

### 4.11 Other professional pages
- **Help `/help`:** a real FAQ, grouped (Getting started, Invites, Funding and payouts, AI review, Accounts, Sandbox and limits). Answers must be accurate to the implementation. Include a "Report a problem" link to the GitHub issues page and, only if `SUPPORT_EMAIL` is set, a mailto link.
- **Prototype terms `/terms` and privacy notice `/privacy`:** short, plain, honest, written from the real implementation. Terms: sandbox only, no real money, no warranty, do not upload confidential or personal data, demo data may be deleted, rate limits apply. Privacy: what is collected (name, email, password hash, optional company, sandbox PayPal email, project data, activity logs, IP address for rate limiting), why, where it is stored, retention (demo accounts removed after 24 hours), no selling of data, essential cookies only, how to export or delete. Both pages state at the top: *Prototype notice. Not legal advice.* Do not claim any compliance or certification.
- **404 and error pages:** branded, with a way home and to help.
- **Footer:** Product (How it works, For clients, For freelancers), Trust (Safety and limits, Status, Help), Legal (Prototype terms, Privacy notice), GitHub, and the line *Sandbox prototype. No real money moves.*

---

## 5. Backend

### 5.1 Schema (add migrations; inspect existing `users` and session code first and extend rather than duplicate)
- `users`: add `email` unique (stored lowercase), `email_verified_at`, `password_hash`, `display_name`, `company`, `avatar_color`, `last_workspace`, `last_login_at`, `is_demo`, `deleted_at`, `payout_paypal_email`.
- `sessions`: `id`, `user_id`, `token_hash`, `created_at`, `last_seen_at`, `expires_at`, `ip_hash`, `user_agent_summary`, `slot`, `revoked_at`.
- `email_tokens`: `id`, `user_id`, `type` (`verify` or `reset`), `token_hash`, `expires_at`, `used_at`.
- `auth_events`: `id`, `user_id` (nullable), `type`, `at`, `ip_hash`, `meta`.
- `notifications`: `id`, `user_id`, `type`, `project_id`, `milestone_id`, `payload`, `read_at`, `created_at`.
- `notification_prefs`: `user_id`, per-type email flags.
- `email_outbox`: `id`, `to_hash_or_address`, `template`, `subject`, `body_text`, `body_html`, `status`, `provider_id`, `created_at`, `delivered_via` (`outbox` | `resend` | `smtp`).
- `oauth_identities` (only if OAuth is built): `user_id`, `provider`, `subject`.

Hash tokens and session ids with SHA-256 before storing (they are high entropy). Hash passwords with argon2id (or scrypt) with documented parameters and a unique salt.

### 5.2 Endpoints (prefix `/api/auth` and `/api/me`)
`POST /signup`, `POST /login`, `POST /logout`, `POST /logout-others`, `POST /forgot`, `POST /reset`, `POST /verify`, `POST /resend-verification`, `GET /me`, `PATCH /me`, `POST /me/password`, `GET /me/sessions`, `GET /me/security-events`, `PUT /me/payout`, `GET /me/export`, `DELETE /me`, notifications (`GET`, `POST /read`, `POST /read-all`), notification prefs, and (optional) `GET /oauth/google/start` and `/callback`.

### 5.3 Security requirements
- New session id on every login (prevents fixation); cookie `ms_session` (or `ms_session__<slot>` in demo slots): httpOnly, sameSite lax, secure in production, path `/`. Sliding idle timeout of 14 days and an absolute maximum of 30 days.
- Constant-time comparisons; generic errors for login and reset (no account enumeration); signup responds the same whether or not the email exists when verification is on.
- Rate limits: login per IP and per email with progressive delay, signup, forgot, resend, invite lookups. Return `429` with `Retry-After`.
- Password rules: at least 10 characters, a maximum length (for example 128), reject a small list of very common passwords, no forced composition rules.
- Changing or resetting a password revokes all other sessions. Logout revokes the current one.
- CSRF protection stays on for every state-changing route; check `Origin` on auth endpoints.
- Security headers with `@fastify/helmet`: HSTS in production, `X-Content-Type-Options`, `Referrer-Policy`, frame protection, and a Content Security Policy that allows the PayPal sandbox SDK and checkout frames, self-hosted fonts, and Bryntum. Start the CSP in **report-only** mode, confirm the PayPal popup and Gantt work, then enforce.
- `trustProxy` enabled for Render. Log auth events (success and failure) without sensitive data.
- Demo slots (`X-Session-Slot`) are honored **only** when `DEMO_MODE=true`.
- OAuth (if built): authorization code flow with PKCE, `state` and `nonce`, ID-token verification with `jose` against the provider's keys, link to an existing account only when the provider reports a verified email.

### 5.4 Email system
`EmailPort` with three adapters: `outbox` (stores the message), `resend`, `smtp`. Branded HTML plus plain-text templates (consistent header, one button, a plain footer saying *Sandbox prototype*). Templates: verify email, reset password, invitation to join a project (when the client enters the freelancer's email), invite accepted, funded, deliverable submitted, review finished, needs your decision, paid, changes requested.
- Real providers send real email (note: many free providers only deliver to verified addresses or domains).
- `outbox` mode: messages are stored. Demo accounts can read their own messages at `/demo/mailbox` (scoped to the signed-in demo account). A development-only endpoint lists messages for local work. Non-demo accounts do not get a mailbox, so password reset stays disabled in `outbox` mode.
- Never put tokens in logs. Links use `APP_BASE_URL`.

### 5.5 Migration from persona authentication
Inspect the existing persona cookie logic. Replace it with real account sessions. Keep the existing project membership authorization (`client_id`, `freelancer_id`) and the authorization matrix. Remove any remaining default identities, `/api/auth/persona` style switching, and fallback users from product routes. Seeded demo users become real demo accounts created through the same signup service.

---

## 6. Integration with existing features

- **Invites:** previewing a project by code or link stays public. Accepting requires a signed-in account and a saved payout email. If the visitor is signed out, send them through login or signup and return to the invite afterwards (the token travels in `next`). The server refuses accepting your own project's invite, and, if the invite was created for a specific email, enforces a match. A client can optionally enter the freelancer's email to send the invite by email.
- **Roles:** project routes and APIs keep checking membership. A user's workspace switcher is derived from their memberships.
- **Payouts:** the project's payout destination is read from the freelancer's profile at release time; changing it is blocked while a release is in progress.
- **Demo mode:** one-click demo accounts for client and freelancer; session slots for the split view; the sandbox buyer card; cleanup of expired demo accounts; no mock invite codes anywhere.
- **Proof and status pages:** unchanged, but protected by membership (or demo mode for demo projects).
- **Landing live feed and receipts:** unchanged, anonymous data only.
- **Notifications:** generated from the existing event stream so no feature has to be rewritten.

---

## 7. Configuration and human tasks

### Environment variables
```
SESSION_SECRET=              # long random value
APP_BASE_URL=                # the deployed URL, used in email links
EMAIL_PROVIDER=outbox        # outbox | resend | smtp
EMAIL_FROM=
RESEND_API_KEY=              # only if EMAIL_PROVIDER=resend
SMTP_HOST= SMTP_PORT= SMTP_USER= SMTP_PASS=   # only if smtp
EMAIL_VERIFICATION=soft      # off | soft | required
GOOGLE_CLIENT_ID=            # optional
GOOGLE_CLIENT_SECRET=        # optional
SUPPORT_EMAIL=               # optional
DEMO_MODE=true               # hosted judging site only
```
Update `.env.example` and the Render settings list. Never commit values.

### Human tasks (only you can do these)
- **H11 Email provider (optional, recommended):** create a free account with an email provider (for example Resend) and get an API key. Free tiers usually deliver only to your own verified address until you verify a domain. Use it to receive real verification and reset emails yourself; judges use demo accounts and the mailbox. Tell the agent the provider so it can adapt the adapter.
- **H12 Google sign-in (optional):** in Google Cloud Console create an OAuth client, add the deployed callback URL and the local one, and put the client id and secret in the environment. If you skip this, the Google button simply does not appear.
- **H13 Render environment:** add the variables above, redeploy, and confirm the site loads over https so secure cookies work.

---

## 8. SEO, metadata, and assets

Page titles and descriptions per route; Open Graph and Twitter card images (generated from the brand, not stock); favicon set (SVG plus PNG sizes) and a web manifest; `robots.txt` (allow public pages, disallow `/client`, `/freelancer`, `/settings`, `/api`) and a simple `sitemap.xml` of public routes; `lang` attribute; canonical URLs; a theme color. Signed-in pages get `noindex`.

---

## 9. Quality rules for every screen in this work

- Sentence case; one primary action per page; clear empty, loading, and error states.
- Keyboard operable; visible focus; labeled inputs; `aria-live` for form errors and notifications; dialogs trap focus.
- No layout shift when forms show errors; buttons show progress and disable during submission.
- Copy is plain and honest; sandbox is stated where money or accounts are mentioned.

---

## 10. Phases

Add to `docs/MILESTONES.md` as `M8r` to `M8y`, each with an `Estimate:` line and checkboxes. No tests or full verification until A7.

### A0 Audit and plan (read-only)
Inspect the existing auth, personas, cookies, sessions, `users` table, invites, demo mode, route guards, and the frontend shells. List every place that assumes a persona. Produce the plan, schema migration list, route map, and risks in `docs/DECISIONS.md`.
Done when: plan written and approved by me.

### A1 Screen fixes
Section 1, all nine items, plus the auth layout component and the sentence-case sweep.

### A2 Accounts backend
Schema, password hashing, sessions, auth endpoints, rate limits, security headers (CSP report-only), email system with the three adapters and templates, migration away from persona authentication, demo session slots, `.env.example`.

### A3 Auth UI
Signup, login, forgot and reset, verify and check-email screens, route guards with `next`, landing header states, role page connected to signup with intent, logout.

### A4 Account area
Onboarding, account menu and workspace switcher, settings (profile, security, notifications, payouts, account with export and delete), notifications bell, popover, and page, notification generation and email triggers.

### A5 Invites, demo accounts, mailbox
Invite flow requiring sign in with return-to-invite, invite by email, own-invite and email-match rules, one-click demo accounts, `/demo/mailbox`, split-view slots, removal of the mock invite code, cleanup job for demo accounts.

### A6 Professional pages and polish
Help and FAQ, prototype terms, privacy notice, 404 and error pages, footer, SEO and metadata, favicons, manifest, robots, sitemap, empty states, loading skeletons, copy pass, README and docs updates.

### A7 Verification and release (the only phase with tests)
1. Write and run tests: password hashing and verification, session lifecycle (fixation, idle and absolute expiry, revoke on password change), rate limits, enumeration resistance, token expiry and single use, signup and login flows, verification modes, reset (including disabled mode), invite accept requiring sign in, own-invite and email-match rejection, the full authorization matrix after migration, delete and export, notification generation, demo slot isolation (only when `DEMO_MODE=true`), cookie flags.
2. E2E (Playwright): signup to onboarding to first project; freelancer signup via invite to accept; login and logout; guarded routes with `next`; both demo accounts at once.
3. Security review: CSP enforcement (switch from report-only after checking PayPal popup and Gantt), headers, secrets scan, dependency audit, no sensitive logging.
4. Accessibility checks (axe) and keyboard paths on all new pages.
5. Screenshots at 1440, 1024, 768 and 390 px for each new screen, reviewed critically.
6. Honesty lint: no forbidden words in user-facing strings.
7. Regression: existing tests, a real sandbox funding and payout, planner and reviewer, proof and status pages, the live acceptance run from `LIVE_PROOF.md`.
8. Production build, deploy, smoke test from a private window including signup, login, logout, invite accept, and a payout.
Done when: all green and the checklist below is complete.

---

## 11. Final checklist (A7)

- [ ] Sign up, log in, log out, session expiry, and route guards work with `next` redirects
- [ ] Passwords hashed with argon2id or scrypt; tokens and session ids stored hashed
- [ ] No account enumeration; rate limits active; headers and enforced CSP in place without breaking PayPal or the Gantt
- [ ] Verification modes work; reset works with a real provider and is honestly disabled without one
- [ ] Onboarding, workspace switcher, settings, notifications, export, and delete work
- [ ] Invites require sign in, prevent self-accept, and optionally match the invited email
- [ ] Demo accounts and the demo mailbox work; split view runs two sessions at once; slots are impossible when demo mode is off
- [ ] No mock invite code or persona switching anywhere in product routes
- [ ] Help, prototype terms, privacy notice, 404, footer, and metadata are complete and truthful
- [ ] Payment, AI, ledger, proof, and status behavior unchanged and re-verified
- [ ] No secrets committed; Render environment updated; deployed smoke test passed
