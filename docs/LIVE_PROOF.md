# LIVE_PROOF.md: remove hardcoded data, make the demo live, prove money moves

Place at `docs/LIVE_PROOF.md`. It adds to `docs/UI_IMPLEMENTATION.md` and `AGENTS.md`. Payment logic, the state machine, and webhook handling are not changed except where section 3 adds read-only logging.

**Goal:** a judge (or you) can run the whole flow with real inputs, and **see, at the same moment, that our app, the PayPal sandbox API, and the PayPal sandbox accounts all agree.** Nothing the user sees is a literal in the code.

## 0. Operating rules

1. Same phase routine as before: one phase at a time, `pnpm verify`, screenshots, commit, tag, push, handoff note, status report, stop.
2. Every number, name, date, status, and ID shown in the app must come from the database, the PayPal API, or the LLM response. No fallbacks that invent data.
3. Proof screens never show a green check they did not earn. A check passes only when a real call or query returned the expected evidence. If something cannot be verified, show "Not verified" (neutral), never a pass.
4. Proof and status endpoints never return secrets, tokens, request bodies with credentials, or full email addresses (mask them).
5. All PayPal activity stays in the **sandbox**. If `PAYPAL_ENV` is not `sandbox`, the proof panel shows a red banner and money-moving routes stay disabled.
6. Do not ask about small decisions. Ask before adding dependencies or schema changes beyond section 3.

**Kickoff prompt (change the phase)**
> Read AGENTS.md, docs/PROGRESS.md, docs/DECISIONS.md, docs/UI_IMPLEMENTATION.md and docs/LIVE_PROOF.md fully. RUN_MODE is milestone. Work on ONLY phase <L#> from section 9. Restate the goal and checklist in 5 lines, show your plan and files, then build it. Finish with `pnpm verify`, screenshots, commit, merge, tag live-<l#>-done, push, handoff note, status report, and STOP.

---

## 1. Hardcode purge

### 1.1 What counts as hardcoded
- Currency amounts, percentages, dates, counts, or balances typed into components, hooks, or constants.
- Sample project, person, or company names used outside the seed script and tests (for example the demo project title, client company name, freelancer first name).
- Fallback objects or arrays used when an API call returns nothing (`?? sampleProject`, `|| DEMO`, default ids).
- Status labels, progress bars, or lifecycle stages derived from constants instead of backend state.
- Any runtime path that uses the mock PayPal adapter or the fixture LLM adapter while the app claims to be live.
- Seed data inserted directly into tables with invented ledger rows or reviews that never passed through the real services.

### 1.2 Allowed exceptions (must be labeled)
- Marketing illustrations in `components/marketing/*`, always labeled "Sample project" and never styled as live data.
- Copy such as "Use sample brief" text that fills a form field (it is user input, not data).
- Test fixtures and the seed script.

### 1.3 Audit (Phase L0)
Run and report the results. Use PowerShell-safe commands (or the editor search):

```powershell
Select-String -Path apps\web\src\**\*.ts*,apps\api\src\**\*.ts -Pattern '\$\s?\d[\d,]*(\.\d\d)?|\b\d{1,3}(,\d{3})+\b' 
Select-String -Path apps\web\src\**\*.ts* -Pattern 'Brand-site|Acme|Arjun|Maya|sample|demo|mock|fallback|default(Project|Persona|Id)'
Select-String -Path apps\web\src\**\*.ts* -Pattern '\?\?\s*[\[\{"'']|\|\|\s*[\[\{"'']'
Select-String -Path apps\api\src\**\*.ts -Pattern 'fixture|mock'
```

For each hit the agent must classify: allowed (labeled), test-only, or **remove**. Produce a table in `docs/DECISIONS.md`.

### 1.4 Replace with
- Typed hooks that fetch from the API with loading, error, and empty states (a skeleton, a calm error with retry, and an empty state with one action).
- Derived values computed from ledger entries on the server and returned in DTOs (the UI does not do money math beyond formatting).
- One formatting layer (`Intl.NumberFormat`, one date formatter).
- Lifecycle stages computed from the backend milestone status via the mapping in `UI_IMPLEMENTATION.md` section 8.1.

### 1.5 Canary test (proves nothing is hardcoded)
Playwright test that creates a project with deliberately unusual inputs and asserts every page reflects them:
- Brief about an unrelated topic, budget `1337.42`, client display name `Zebra Co`, freelancer name `Quill`.
- After planning, invite, accept, fund, submit, release: on each client and freelancer page assert the amounts, names, milestone names, and statuses match the API response exactly.
- Assert that none of the old literals (the previous demo title, company, person names, and amounts) appear anywhere in the DOM.
- Assert total, funded, held, paid, and per-milestone amounts add up exactly (cents).
Run this test in CI (mock mode) and in the live acceptance run (sandbox mode).

### 1.6 CI guard
A test (or lint rule) that fails the build if `apps/web/src` outside `components/marketing`, tests, and stories contains: currency literals, the known demo names, `fixture`, or `mock` identifiers. Keep the allow-list in one file with a comment per entry.

### 1.7 Manual check (you can do this in 2 minutes)
Create a project with budget `777.77`, three milestones, and unusual names. Visit every page. Any page that shows a different number or old name is still hardcoded.

---

## 2. Live demo design

- **Per-visitor demo sessions:** `/demo` creates a fresh demo client, a fresh demo freelancer, and an empty project space for that visitor, so two judges never collide. Everything after that goes through the real services: the real planner, a real invite, real PayPal sandbox funding, a real review, a real payout.
- **Sandbox buyer for judges:** the PayPal popup needs a sandbox buyer login. Show the sandbox buyer email and password (read from `DEMO_SANDBOX_BUYER_EMAIL` and `DEMO_SANDBOX_BUYER_PASSWORD`, sandbox only) in a small card on `/demo` and in the demo bar, with the note *Sandbox test account. No real money.* Also put them in the submission's testing instructions.
- **Freelancer payout account:** the demo freelancer's PayPal email is the personal sandbox account you control (`DEMO_FREELANCER_PAYPAL_EMAIL`), so you can see the money arrive.
- **Prepared deliverables:** three downloadable or copyable examples (good, weak, injection) in the demo guide so judges do not have to invent a deliverable.
- **Abuse guards (the app is public):** rate limits per IP on planner, reviewer and invite endpoints; maximum brief length; a daily cap on LLM calls (configurable) with a calm message when reached; budget cap in demo mode (for example up to 500 USD); automatic cleanup of demo sessions older than 24 hours; no email sending.
- **Cold start:** a `/healthz` plus a "Wake the app" note in the demo guide, since free instances sleep.
- **Landing live feed (optional):** on the landing, replace "Sample ledger" with the last five settlements from demo projects (read-only endpoint, IDs and amounts only, no names), labeled "Live from the sandbox". If there are none, show the labeled sample.

---

## 3. Instrumentation (read-only logging; no payment logic changes)

### 3.1 Outbound call log
Table `external_calls`: `id`, `at`, `service` (`paypal` | `llm` | `github`), `method`, `endpoint_template` (for example `/v2/checkout/orders/{id}/capture`), `status`, `duration_ms`, `request_id` (our `PayPal-Request-Id` or idempotency key), `provider_debug_id` (the `PayPal-Debug-Id` response header when present), `project_id`, `milestone_id`, `ok`, `error_code`, `meta` (for LLM: model, input and output token counts; never prompts or secrets).
- Wrap the PayPal adapter and the LLM port so every call is recorded. Keep bodies out of the log.
- Keep 30 days or the last 5,000 rows.

### 3.2 Mode truth
`GET /api/system/mode` returns `{ paypal: 'sandbox' | 'mock', llm: { provider, model, live: boolean }, demoMode, webhookConfigured, version, commit }`. The UI shows it in the demo bar and on the proof page. If PayPal is `mock` or the LLM is `fixture` while demo mode is on, show a red banner: *Not live: this demo is using simulated payments or AI.*

### 3.3 Webhook receipt log
Use the existing `paypal_events` table. Expose (read-only) `received_at`, `type`, `paypal_event_id`, `verified` (signature result), `processed_at`, `error`, linked project and milestone when known.

---

## 4. Proof API

`GET /api/proof/projects/:id` (client or freelancer member of the project, or demo mode for demo projects). Returns a list of checks plus raw evidence. Every check: `{ id, label, status: 'pass' | 'fail' | 'unverified', evidence, checkedAt }`.

### 4.1 Environment checks
| Check | How | Pass when |
|---|---|---|
| PayPal API reachable | Obtain an OAuth token (cached or fresh) | HTTP 200 and token received (never returned) |
| Mode is sandbox | Config | `PAYPAL_ENV=sandbox` |
| Webhook configured | Config | `PAYPAL_WEBHOOK_ID` set |
| Last webhook | `paypal_events` | An event verified within an expected window, or `unverified` if none yet |
| LLM live | Mode truth and recent `external_calls` | Provider is not `fixture`, and the last call succeeded |
| Database | Simple query | OK |
| Worker heartbeat | Worker table or timestamp | Recent |
| SSE | Connected client count | At least one when someone is viewing |

### 4.2 Money reconciliation (project level)
For the project, compare our ledger against PayPal **by asking PayPal**:

| Check | Source of truth from PayPal | Pass when |
|---|---|---|
| Funding capture exists | `GET /v2/checkout/orders/{orderId}` and capture details `GET /v2/payments/captures/{captureId}` | Status completed; amount and currency equal the ledger `funded` entry |
| Funding amount matches | Same | Sum of completed captures equals ledger funded total |
| Each released milestone has a successful payout item | `GET /v1/payments/payouts/{batchId}` (and item details if needed) | Item status is success, amount equals the ledger release amount, receiver (masked) equals the freelancer email on the project |
| No ledger release without a PayPal item | Ledger versus batches | Every `released` entry has a stored batch id that PayPal confirms |
| No duplicate payouts | Our `payout_batches` | At most one successful batch per milestone |
| Milestone amounts add up | Ledger | Sum of milestone amounts equals project total; held plus paid plus refunded equals funded |
| Held balance is consistent | Ledger | Never negative |
| Webhook coverage | `paypal_events` | Each funding and payout event was received and verified, or flagged "settled by reconciler" |

Fees: sandbox captures and payouts may show fees or net amounts. Compare **gross** amounts and show any fee PayPal reports as a separate line.

### 4.3 Optional enhanced proof (degrade gracefully)
- **Account balance and transactions:** PayPal's reporting endpoints (balances and transaction search) may be available in the sandbox if enabled on the app, and may lag. Verify availability in the PayPal docs. If unavailable or empty, the check shows `unverified` with the reason, never `fail`.
- **Webhook delivery list from PayPal's side:** PayPal offers a way to list webhook event notifications. If used, compare against `paypal_events`.

### 4.4 Evidence shown to the user (per check)
Status, one plain sentence, the IDs involved (order id, capture id, payout batch id and item id, PayPal debug id), amounts, timestamps, and masked emails (first letter and domain only).

---

## 5. Proof UI

### 5.1 `/demo/proof` (and a "Proof" tab for clients)
- Header: mode truth banner (green only when PayPal is sandbox, the LLM is live, and webhooks are configured).
- **Reconciliation table:** left column "Our ledger", right column "PayPal says", a status per row (match, mismatch, unverified), IDs as copyable chips.
- **Call tape:** the last 25 `external_calls` for the project in time order (PayPal and LLM), each row: time, service, method and endpoint template, status, duration, request id, PayPal debug id. New rows slide in as they happen (SSE).
- **Webhook tape:** received events with signature verified yes or no, processing result, and linked milestone.
- **Checks list:** section 4.1 results.
- **Run live self-test** button (demo mode only): creates a PayPal order without capturing it (no money moves), pings the LLM with a tiny prompt, round-trips the database and SSE, and shows each result with evidence. Rate limited.
- Everything refreshes live; manual refresh button; "Last checked" timestamp.

### 5.2 `/demo/split` becomes a three-pane view
Client | Freelancer | **PayPal truth** (a compact live feed: capture confirmed, payout item success, webhook received, ledger written, balance lines if available). Panes update live. Optional "Open PayPal sandbox" link in a new window for the side-by-side check in section 6.

### 5.3 `/status` (public)
A small page: API, database, PayPal API, webhook last seen, LLM provider, worker, version and commit. Real checks, cached about 10 seconds. No secrets.

### 5.4 Settlement receipt
Include: PayPal capture id (funding), payout batch id and item id, amounts, timestamps, and "Verified against PayPal at {time}" only after the reconciliation check for that payout actually passed.

---

## 6. Side-by-side verification runbook (you, by hand)

Do this on the deployed app, with real sandbox accounts, before recording the video.

### 6.1 Setup (10 minutes)
1. In developer.paypal.com, open Testing tools, Sandbox accounts. Note your **business** account (the platform), the **personal buyer** (the client's payer), and the **personal freelancer** (the payout recipient). Use "View/edit account" to see each email and password.
2. Prepare **four windows** arranged side by side (use separate browser profiles, or one normal and one private window per browser, because PayPal sessions conflict):
   - **A:** the app as client (`/client`, or the client pane of `/demo/split`)
   - **B:** the app as freelancer
   - **C:** sandbox.paypal.com logged in as the **freelancer personal** account (Activity page)
   - **D:** sandbox.paypal.com logged in as the **business** account (Activity page)
   - Optional **E:** the developer dashboard's webhook events view for your app.
3. Note the starting **balance** on the freelancer and business sandbox accounts.
4. Open `/demo/proof` in a fifth tab or the third pane of `/demo/split`.
5. Confirm the mode banner is green (sandbox, live LLM, webhook configured).

### 6.2 The run
| Step | You do | The app shows | PayPal sandbox shows | Capture as evidence |
|---|---|---|---|---|
| 1 Plan | Paste a brief and budget | Real plan from the live model; call tape shows the LLM call | n/a | Model name, call time |
| 2 Invite and accept | Invite, accept in window B | Project accepted | n/a | Invite code, accept time |
| 3 Fund | Pay with the sandbox buyer | Project funded; ledger has a funded entry with a capture id | **D:** a payment received for the same amount; the transaction details show the same id. The buyer account shows the payment sent. | Capture id on both sides; amount match |
| 4 Webhook | Wait a few seconds | Webhook tape shows capture completed, verified | **E:** the event delivered with a success status | Event id in both |
| 5 Submit | Submit the good deliverable | Live review steps; per-criterion verdict | n/a | Review trace |
| 6 Release | Release (or wait for the window) | Releasing then paid; settlement receipt | **C:** a payment received from the business account for the milestone amount. **D:** a payout sent. Balances changed by the amount (D down, C up). | Batch id, item id, amount, balance before and after |
| 7 Reconcile | Open the proof page | Every row "match" | n/a | Screenshot of the matching table |
| 8 Injection | Submit the injection deliverable | Flagged, not paid | **C and D:** no new payout | Screenshot showing no balance change |

### 6.3 If something does not match
| Symptom | Likely cause | Check |
|---|---|---|
| Funding captured in PayPal but the app shows unfunded | Webhook missing or not verified | Webhook tape; `PAYPAL_WEBHOOK_ID`; the reconciler should settle it within about 30 seconds |
| Payout pending or unclaimed | Receiver email is not an existing sandbox account | Use the freelancer personal sandbox email exactly |
| Payout failed for balance | Business sandbox balance too low | Add test funds in the sandbox dashboard |
| Balances do not move immediately | Sandbox UI lag | Refresh; use the payout item status in the proof page as the primary evidence |
| Proof page shows "unverified" for balances | Reporting API not enabled | Expected; use windows C and D for the balance evidence |
| LLM banner red | Missing or wrong key, or fixture mode | Environment variables on Render |

---

## 7. Automated live acceptance (`pnpm acceptance:live`)

A Playwright script that performs the full flow against a chosen base URL (local or deployed), using real sandbox accounts from environment variables:
1. Mode check (must be sandbox and live LLM, otherwise abort).
2. Create the canary project (unusual values from 1.5), real planner call.
3. Invite and accept with the generated code.
4. Fund: open the PayPal popup, log in as the sandbox buyer, approve. If the popup automation is unreliable, fall back to a documented manual approval pause with a clear prompt.
5. Wait for webhook-confirmed funding; assert ledger and PayPal capture agree through the proof API.
6. Submit the good deliverable; assert verdict and release; wait for payout item success; assert reconciliation passes.
7. Submit the injection deliverable on a second milestone; assert it is flagged and **no** payout was created.
8. Assert the canary values appear on every page and no old literals do.
9. Write `evals/results/acceptance-<date>.json` and screenshots to `docs/screens/acceptance/`, containing every ID, amount, and timing.

Treat a failure as a blocker for submission. Run it before each deploy that touches payments, and the day before submission.

---

## 8. Environment checklist (Render and local)

- `PAYPAL_ENV=sandbox`, with sandbox client id and secret; `PAYPAL_WEBHOOK_ID` set after registering the webhook with the deployed URL.
- `LLM_PROVIDER` set to a real provider (not `fixture`), `LLM_API_KEY`, `LLM_MODEL`.
- `DEMO_MODE=true` on the hosted judging site; `DEMO_FREELANCER_PAYPAL_EMAIL`, `DEMO_SANDBOX_BUYER_EMAIL`, `DEMO_SANDBOX_BUYER_PASSWORD` (sandbox only).
- Daily LLM call cap and rate limit values.
- Confirm none of these variables are in the repository.

---

## 9. Phases

Add as `M8l` to `M8q` in `docs/MILESTONES.md`. Each ends with the stop routine.

### L0 Audit
Run section 1.3, classify every hit, check Render environment variables against section 8, check that the deployed app is not using mock or fixture, list tables and endpoints affected. Output the plan and the hit table in `docs/DECISIONS.md`.
Acceptance: complete classified list; owner approval.

### L1 Purge hardcoded data
Section 1.4 to 1.6: typed hooks, loading, error and empty states, server-derived money values, canary test, CI guard, removal of fallbacks.
Acceptance: the canary test passes in mock mode; the CI guard is green; the manual check in 1.7 passes.

### L2 Live demo sessions and abuse guards
Section 2 (per-visitor sessions, sandbox buyer card, rate limits, caps, cleanup, optional live feed).
Acceptance: two browsers run two independent demo projects at once without interfering.

### L3 Instrumentation
Section 3 with tests (calls logged, no secrets or bodies in the log, mode truth correct, red banner when simulated).
Acceptance: after one run, the call log lists the real PayPal and LLM calls with debug ids and durations.

### L4 Proof API and UI
Sections 4 and 5, including the three-pane split view and `/status`.
Acceptance: after a sandbox run, every reconciliation row matches; an artificially introduced mismatch (a test that edits a ledger row in a test database) is detected and shown as a mismatch.

### L5 Live acceptance and runbook rehearsal
Section 7, then you perform section 6 on the deployed app.
Acceptance: `acceptance:live` passes twice in a row against the deployed app; the manual runbook matches on all steps; evidence screenshots saved.

---

## 10. Final checklist

- [ ] No literal money, names, or statuses in app code outside labeled marketing illustrations and tests
- [ ] Canary test and CI guard pass
- [ ] Each visitor gets an isolated live demo session
- [ ] The app only reports "live" when PayPal is sandbox and the LLM is a real provider
- [ ] Every PayPal and LLM call is logged with debug ids, status and duration
- [ ] The proof page reconciles ledger versus PayPal by asking PayPal, and detects mismatches
- [ ] Three-pane split view shows client, freelancer, and PayPal truth live
- [ ] `/status` reports real health
- [ ] Side-by-side runbook completed: funding and payout visible in the sandbox accounts with matching ids and balance changes
- [ ] Injection deliverable produces no payout and the sandbox balances do not change
- [ ] `acceptance:live` passes against the deployed app, twice
- [ ] Rate limits and daily caps protect the public demo
- [ ] No secrets in the repository; proof and status endpoints expose none
