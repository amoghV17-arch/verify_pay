# ARCHITECTURE.md

## 1. Goals that shape the architecture

1. **Money safety first.** No double payouts, no payouts without funding, no payouts the LLM can trigger by itself.
2. **One shared truth.** The Gantt, the ledger, and the review trace all describe the same milestone state.
3. **Live and legible.** Every state change appears in the UI within a second (SSE), and every decision is explainable (Trust Panel).
4. **Demoable anywhere.** A `mock` PayPal adapter and a recorded-fixture LLM mode let CI and the owner run the whole flow offline; `sandbox` mode uses the real PayPal sandbox.
5. **Small enough to finish solo,** deep enough to impress: webhooks, idempotency, a state machine, a tool-calling agent, a real Gantt.

## 2. System context

```mermaid
flowchart LR
  Client([Client]) --> Web
  Freelancer([Freelancer]) --> Web
  subgraph App[Milestone app on Render]
    Web[React SPA + Bryntum Gantt] -->|REST + SSE| API[Fastify API]
    API --> DB[(Postgres)]
    API --> Worker[In-process worker]
  end
  API -->|Orders, Payouts, Refunds| PP[PayPal sandbox]
  PP -->|Webhooks| API
  API -->|structured output + tools| LLM[LLM provider]
  API -->|fetch public deliverables| Ext[GitHub / public URLs]
```

Single deployable: the API also serves the built SPA, so there is one Render service and one webhook URL.

## 3. Repo layout

```
/apps/web            React + Vite + Bryntum Gantt
/apps/api            Fastify API, worker, adapters
/packages/shared     zod schemas, types, money helpers, state machine
/evals               fixtures, runner, results
/scripts             progress.mjs, demo-reset, smoke tests
/docs                this documentation set
/render.yaml  /docker-compose.yml  /.github/workflows/ci.yml
```

## 4. Backend modules (`apps/api/src`)

| Module | Responsibility |
|---|---|
| `http/` | Fastify routes, zod validation, auth hooks, error mapper |
| `auth/` | Demo personas, signed cookie sessions, per-project role checks |
| `projects/` | CRUD, invites, plan application |
| `gantt/` | Bryntum load/sync endpoints and mapping between Bryntum data and DB rows |
| `milestones/` | State machine, deliverable submission, release policy |
| `money/` | Ledger, funding service, release service, reconciler |
| `paypal/` | `PayPalPort` interface plus `sandboxAdapter` and `mockAdapter`; webhook verification |
| `ai/` | `LlmPort` interface and provider adapters, planner, reviewer, tools, validators, prompt files |
| `events/` | Activity log, SSE hub (per-project channels) |
| `worker/` | Polling worker: auto-release timers, payout reconciliation, stuck-state watchdog |
| `config/` | Env validation (zod), feature flags, modes |

**Ports and adapters.** `PayPalPort` and `LlmPort` are interfaces. Production code never imports a provider directly. This is what makes automation, tests, and offline demos possible.

## 5. Data model

All money columns are integer cents. All ids are UUIDv7 (time-sortable). All tables have `created_at`; mutable tables have `updated_at` and `version` (optimistic concurrency).

| Table | Key columns |
|---|---|
| `users` | id, name, email, avatar |
| `projects` | id, title, brief, currency (`USD`), total_cents, status (`draft, planned, funded, active, closed, cancelled`), autonomy_mode (`manual, assisted, auto`), release_window_seconds, client_id, freelancer_id, freelancer_paypal_email, plan_json, plan_prompt_version |
| `tasks` | id, project_id, parent_id, name, start_date, duration_days, percent_done, milestone_id (nullable), sort_order, bryntum_ext (jsonb for fields Bryntum needs) |
| `dependencies` | id, project_id, from_task_id, to_task_id, type, lag |
| `milestones` | id, project_id, task_id, name, amount_cents, percent, criteria (jsonb array), deliverable_type, status, release_at, approved_by (`ai, client`), version |
| `deliverables` | id, milestone_id, kind (`text, repo, url, image, document`), payload (jsonb), submitted_by, submitted_at |
| `reviews` | id, milestone_id, deliverable_id, kind (`initial, appeal`), model, prompt_version, trace (jsonb), criteria_results (jsonb), verdict, min_confidence, injection_suspected, latency_ms, tokens |
| `ledger_entries` | id, project_id, milestone_id (nullable), type (`funded, release_pending, released, release_failed, refunded`), amount_cents, paypal_ref, idempotency_key (**unique**), meta |
| `payout_batches` | id, milestone_id, sender_batch_id (**unique**), paypal_batch_id, status, raw (jsonb) |
| `paypal_events` | id, paypal_event_id (**unique**), type, payload, processed_at, error |
| `activity` | id, project_id, actor (`client, freelancer, ai, system`), kind, text, meta, ts |

**Invariants (enforced in code and tests, and by constraints where possible):**
1. `sum(released) + sum(refunded) <= sum(funded)` per project.
2. At most one `released` ledger entry per milestone (partial unique index).
3. `milestones.amount_cents` sums to `projects.total_cents` (largest-remainder rounding on percentages).
4. A milestone can only be paid from state `approved`.
5. Ledger entries are append-only. Corrections are new entries, never updates.

## 6. Milestone state machine

```mermaid
stateDiagram-v2
  [*] --> unfunded
  unfunded --> funded: capture confirmed (webhook)
  funded --> submitted: freelancer submits deliverable
  submitted --> in_review: review job starts
  in_review --> changes_requested: verdict request_changes
  in_review --> awaiting_client: verdict escalate_to_human
  in_review --> approved: verdict release (policy ok)
  changes_requested --> submitted: freelancer resubmits
  awaiting_client --> approved: client approves
  awaiting_client --> changes_requested: client rejects
  approved --> releasing: release started
  releasing --> paid: payout item succeeded
  releasing --> approved: payout failed (alert, retry allowed)
  changes_requested --> appealed: freelancer appeals
  appealed --> approved: second review releases
  appealed --> awaiting_client: second review disagrees
```

Transitions live in one function in `packages/shared/stateMachine.ts` and are the only way status changes. Each transition writes an `activity` row and emits an SSE event.

**Autonomy modes** decide what happens after a `release` verdict:
| Mode | Behavior |
|---|---|
| `manual` | status becomes `awaiting_client`; client clicks Release |
| `assisted` | status becomes `approved` with `release_at = now + window`; worker releases unless the client objects or overrides in the window |
| `auto` | releases immediately if policy passes (min confidence at or above the threshold, no injection flag, funded) |

## 7. Key sequences

### 7.1 Funding

```mermaid
sequenceDiagram
  participant C as Client browser
  participant API
  participant PP as PayPal
  C->>API: POST /projects/:id/fund/order
  API->>PP: Create order (intent CAPTURE, custom_id=projectId)
  PP-->>API: orderId
  API-->>C: orderId
  C->>PP: Approve in PayPal buttons
  C->>API: POST /projects/:id/fund/capture {orderId}
  API->>PP: Capture order (PayPal-Request-Id)
  PP-->>API: capture COMPLETED
  PP->>API: Webhook PAYMENT.CAPTURE.COMPLETED
  API->>API: verify signature, dedupe, ledger funded, milestones funded
  API-->>C: SSE project.funded
```

The browser's capture response is **not** the source of truth. The ledger is written from the verified webhook (or from the capture response if the webhook is late, using the same idempotency key so it is applied once).

### 7.2 Review and release

```mermaid
sequenceDiagram
  participant F as Freelancer
  participant API
  participant AI as Reviewer agent
  participant Pol as Release policy
  participant PP as PayPal
  F->>API: Submit deliverable
  API->>AI: review(criteria, deliverable)
  AI->>AI: tool calls (fetch url, read repo file, ...)
  AI-->>API: submit_verdict (per-criterion results)
  API->>Pol: recompute verdict from results + thresholds
  Pol-->>API: release | request_changes | escalate
  API-->>F: SSE review.completed
  alt release and mode allows
    API->>PP: Payout (idempotent)
    PP->>API: Webhook payout item SUCCEEDED
    API-->>F: SSE milestone.paid
  end
```

### 7.3 Release service (pseudocode)

```
release(milestoneId, actor):
  tx:
    m = SELECT ... FOR UPDATE milestone
    assert m.status == 'approved'
    assert projectFunded(m.project) - projectReleased(m.project) >= m.amount
    key = 'release:' + m.id
    insert ledger(release_pending, key) ON CONFLICT (idempotency_key) DO NOTHING
    if conflict: return existing result
    m.status = 'releasing'
  call PayPal Payouts with:
      sender_batch_id = 'ms_' + m.id        # unique per milestone
      header PayPal-Request-Id = key
  on 2xx: store payout_batches row
  # completion arrives by webhook PAYMENT.PAYOUTS-ITEM.SUCCEEDED
  # reconciler (worker, every 30s): for releasing > 20s with no webhook, GET batch and apply result
  on failure/denied/returned: ledger(release_failed), m.status = 'approved', activity alert
```

## 8. Idempotency and failure handling

| Failure | Handling |
|---|---|
| Double-click Release | DB unique key plus status check; second call returns the first result |
| Retried or duplicate webhook | `paypal_events.paypal_event_id` unique; handler is a no-op on repeat |
| Webhook arrives before capture response | Both paths use the same ledger idempotency key |
| Webhook never arrives | Reconciler polls PayPal (orders, payout batch) for stale states |
| PayPal 5xx or timeout on payout | Retry with the same `PayPal-Request-Id` and `sender_batch_id` (safe to repeat) |
| LLM returns invalid JSON | zod validation, up to 2 repair attempts, then `escalate_to_human` |
| LLM or tool timeout | Review marked `escalate_to_human` with reason, never `release` |
| Server restart mid-flow | State is in the DB; worker resumes `releasing` and `in_review` items |

## 9. Real-time updates

Server-Sent Events at `GET /api/projects/:id/events`. Events: `project.funded`, `milestone.status`, `review.progress` (tool call steps, for the live reasoning trace), `review.completed`, `ledger.entry`, `activity`. Client uses `EventSource` with automatic reconnect and refetches on reconnect (`Last-Event-ID` is supported but the client also does a full refresh).

## 10. Bryntum Gantt integration

- Use the Bryntum project model with a load/sync protocol: `GET /api/gantt/:projectId/load` and `POST /api/gantt/:projectId/sync`, following Bryntum's documented request and response shapes.
- Extend the task model with custom fields: `milestoneId`, `amountCents`, `paymentStatus`, `acceptanceCriteria`, `deliverableType`.
- Milestones are Gantt tasks with `duration = 0` and `milestone = true`, with dependencies from the tasks that must finish first.
- **Server rules protect money:** sync requests may change schedule fields but never `amountCents`, `paymentStatus`, or milestone status. Those fields are read-only on the client and ignored on the server.
- Custom renderers draw the payment badge on milestone diamonds. A `settle` animation class is applied when the SSE event `milestone.status = paid` arrives.

## 11. Security model

- Roles are per project (`client`, `freelancer`). Every route checks the role and the project membership.
- Cookies are signed, httpOnly, sameSite=lax. CSRF protection on state-changing routes (double-submit token or sameSite plus origin check).
- Rate limits on AI endpoints and funding endpoints.
- LLM safety: untrusted text delimited and labeled, tool allow-list, SSRF-guarded fetcher, per-review limits (tool calls, tokens, wall time), server-side verdict recomputation (see `PROMPTS.md`).
- Secrets only in environment variables. `config/` refuses to boot in an unsafe combination (for example `PAYPAL_ENV=live`).

## 12. Configuration (`.env.example`)

```
NODE_ENV=development
PORT=8080
APP_BASE_URL=http://localhost:5173
DATABASE_URL=postgres://milestone:milestone@localhost:5432/milestone
SESSION_SECRET=change-me
PAYPAL_ENV=mock            # mock | sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
DEMO_FREELANCER_PAYPAL_EMAIL=
LLM_PROVIDER=anthropic     # anthropic | gemini | openai-compatible | fixture
LLM_API_KEY=
LLM_MODEL=
LLM_BASE_URL=
REVIEW_MIN_CONFIDENCE=0.75
ASSISTED_RELEASE_WINDOW_SECONDS=20   # demo-friendly; production would be hours
BRYNTUM_PACKAGE=trial
```

## 13. Deployment

- **Render** web service built from the repo (`pnpm build`, `pnpm start`), health check at `/healthz`.
- **Postgres** on a free provider whose free tier does not expire; run migrations on deploy.
- **Webhook** URL is the Render URL plus `/api/webhooks/paypal`.
- Free Render services sleep when idle: the smoke script wakes the service and the owner pings it before recording.
- `pnpm demo:reset` wipes and reseeds the demo project, personas, and ledger for a clean recording.

## 14. Observability

- pino JSON logs with request id, project id, milestone id.
- `/api/admin/health` (dev only) shows adapter modes, last webhook time, worker heartbeat.
- The in-app **Trust Panel** is the user-facing audit trail: ledger entries with PayPal ids, review trace, state history.

## 15. Testing strategy

| Layer | Tool | What |
|---|---|---|
| Unit | Vitest | state machine, money rounding, validators, policy |
| Integration | Vitest + test Postgres | release service idempotency, webhook dedupe, ledger invariants |
| Contract | recorded PayPal fixtures | adapter parsing and error mapping |
| AI evals | `pnpm eval` | planner validity, reviewer accuracy, injection resistance |
| E2E | Playwright (mock mode) | the full flow from brief to paid |
| Smoke | `pnpm smoke:sandbox` | one real sandbox fund and payout (owner credentials) |
