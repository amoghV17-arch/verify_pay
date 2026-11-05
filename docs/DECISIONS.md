# DECISIONS.md

Architectural and technical decisions recorded during the build.
Format for judgment calls: Context, Decision, Why.

## M0 Foundation decisions and pinned stack versions

### Node and Package Manager
- **Context:** Monorepo package management and runtime baseline for CI and developer machines.
- **Decision:** Node v20+ (using Node 24 runtime locally) with pnpm workspaces.
- **Why:** Fast installation, strict dependency isolation, and native monorepo workspace protocol (`workspace:*`).

### TypeScript and Compilers
- **Context:** Project requires strict type safety across packages and shared schemas.
- **Decision:** TypeScript 5.4.5 with strict mode, `NodeNext` for Node packages (`api`, `shared`, `evals`) and `Bundler` for React Vite SPA (`web`).
- **Why:** Provides maximum type safety, catches bugs at compile time, and supports modern ESM import conventions.

### Testing Strategy
- **Context:** Need fast unit and integration tests as well as end-to-end browser/API test framework.
- **Decision:** Vitest 1.6.0 for unit and integration testing; Playwright 1.44.1 for E2E tests in mock mode.
- **Why:** Vitest is native ESM with rapid execution; Playwright provides reliable E2E browser and API testing.

### Local Database and Docker Fallback
- **Context:** Local machine runs Windows with PowerShell 5.1 without Docker daemon installed.
- **Decision:** Provide standard `docker-compose.yml` for environments with Docker, and add an intelligent `pnpm db:up` fallback script that detects Docker absence and directs connection to hosted PostgreSQL via `DATABASE_URL`.
- **Why:** Complies with project requirements while ensuring developers without local Docker can immediately develop against hosted Postgres.

### PayPal Safety and Environment Guards
- **Context:** Hackathon rules and money safety mandate that live endpoints or credentials must never be accessed.
- **Decision:** Enforce `PAYPAL_ENV` to strictly `'mock' | 'sandbox'` via Zod schema with `.superRefine` throwing fatal configuration errors on `'live'`, verified by unit tests and an automated secret scanner in `pnpm verify`.
- **Why:** Completely prevents accidental live PayPal transactions or credential leaks.

### Stack Version Records
- Node: `v24.15.0`
- pnpm: `12.16.1`
- TypeScript: `5.4.5`
- Fastify: `4.28.1`
- React: `18.3.1`
- Vite: `5.3.1`
- Vitest: `1.6.0`
- Playwright: `1.44.1`
- Zod: `3.23.8`
- ESLint: `9.5.0`
- Prettier: `3.3.2`

## M1 Bryntum Gantt Spike decisions

### Bryntum Access and Packaging (Gate H4)
- **Context:** Milestone uses Bryntum Gantt for the interactive timeline and milestone financial status. Anyone cloning the public GitHub repository must be able to run the application without proprietary license keys or gated registry credentials.
- **Decision:** Use `@bryntum/gantt-trial` aliased as `@bryntum/gantt: "npm:@bryntum/gantt-trial@latest"` with `allowBuilds` enabled in `pnpm-workspace.yaml`.
- **Why:** Complies with Gate H4, ensures the repository remains open and cloneable by hackathon judges, while providing the full Bryntum Gantt Pro API, timeline rendering, dependency tracking, and theme customization.



## M2 Data Layer and Gantt Sync decisions

### Database Engine and In-Memory PGlite Testing
- **Context:** Local developer machines and CI pipelines may lack active Docker daemons, but all integration tests and financial invariants require real PostgreSQL relational semantics, constraints, and partial indexes.
- **Decision:** Use Drizzle ORM with node-postgres (`Pool`) when `DATABASE_URL` is set, and `@electric-sql/pglite` in-memory for Vitest and local fallbacks without Docker.
- **Why:** Enables hermetic, sub-second test runs that execute real PostgreSQL SQL migrations, constraints, and partial indexes without external infrastructure.

### Partial Unique Index on Milestone Releases
- **Context:** Invariant 2 mandates that at most one `released` ledger entry can ever exist per milestone, preventing double payouts.
- **Decision:** Implemented database-level partial unique index: `CREATE UNIQUE INDEX "one_released_per_milestone" ON "ledger_entries" ("milestone_id") WHERE type = 'released'`.
- **Why:** Guarantees concurrency safety at the PostgreSQL engine level regardless of API retry storms or race conditions.

### Bryntum Sync Monetary Tamper Guard
- **Context:** Bryntum Gantt allows users to edit timeline records. A client payload could maliciously attempt to modify `amountCents` or set status to `paid`.
- **Decision:** Server-side sync endpoint strictly whitelists schedule mutations (`name`, `startDate`, `durationDays`, `percentDone`, `parentId`, `sortOrder`) and completely strips and ignores `amountCents` and `paymentStatus`.
- **Why:** Preserves the core security invariant that LLM review policies and PayPal transactions alone control financial status.

## M3 PayPal Adapter, Mock, and Funding decisions

### Fastify Raw-Body Preservation for Cryptographic Webhook Verification
- **Context:** PayPal webhook signatures require validating the raw unparsed JSON byte sequence against headers (`paypal-transmission-sig`, `paypal-cert-url`, etc.). Fastify standard JSON body parsers decode into JavaScript objects before route handlers execute.
- **Decision:** Implemented a native Fastify buffer parser (`parseAs: 'buffer'`) that attaches `req.rawBody` while handling empty and standard JSON bodies without introducing external or unmaintained dependencies.
- **Why:** Guarantees cryptographically exact verification against PayPal's verification endpoint while maintaining clean native Fastify routing and request parsing.

### OAuth Token In-Memory Caching and Transparent 401 Refresh
- **Context:** PayPal Orders v2 endpoints require OAuth2 Bearer tokens (`/v1/oauth2/token`). Fetching a new token per request adds 300-600ms network latency.
- **Decision:** Cached the access token in memory with an expiration timestamp and a 60-second safety buffer; on any 401 Unauthorized response, invalidates cache and attempts a single retry.
- **Why:** Reduces API latency for order creation and capture while safely recovering from token invalidation.

### Atomic Ledger Funding and Invariant Verification
- **Context:** When a client funds a project, the ledger entry, project status update, and unfunded milestone status transitions must happen atomically and idempotently.
- **Decision:** Wrapped all funding writes in a database transaction with idempotency key `fund:${projectId}:${captureId}`, recomputed `holdingBalanceCents = fundedCents - releasedCents - refundedCents`, and enforced invariant `holdingBalanceCents >= 0`.
- **Why:** Guarantees money is never duplicated across retried capture requests or delayed webhooks, and upholds project financial invariants.

## M4 Payout Release decisions

### Dual Concurrency & Idempotency Guards for Payouts
- **Context:** Payouts release real funds from the business account. Parallel requests (e.g. rapid double-clicks or concurrent automated triggers) could risk double payouts.
- **Decision:** Combined database-level row locking (`SELECT ... FOR UPDATE`), transaction-level status check (`assert m.status === 'approved'`), unique idempotency keys (`release:${milestoneId}` and `release_complete:${milestoneId}`), and PostgreSQL partial unique index (`one_released_per_milestone`).
- **Why:** Proven by the concurrency test (10 parallel release requests produce exactly 1 payout batch and 1 released ledger entry).

### Safe Reversion of Failed Payout Batches to Approved
- **Context:** If PayPal rejects a payout batch (due to insufficient sandbox balance or policy restriction), the milestone should not be left permanently stuck in `releasing` or marked `paid`.
- **Decision:** Recorded `release_failed` in the append-only ledger and reverted the milestone status from `releasing` back to `approved`.
- **Why:** Preserves auditability in the ledger while allowing the client or reconciler to retry after fixing account balance or permissions.

### Transactional Executor Injection in Ledger Service
- **Context:** Computing project holding balances inside an open transaction caused lock contention and timeouts in single-connection/in-memory PostgreSQL runtimes (PGlite WASM).
- **Decision:** Extended `LedgerService.getProjectLedgerSummary` to accept an optional transaction executor parameter `tx`.
- **Why:** Eliminates transaction deadlocks and ensures holding balance checks see uncommitted transaction state when needed.

## M5 AI Layer and Planner decisions

### Multi-Adapter LlmPort Architecture and Hermetic Testing
- **Context:** Project requires AI planning and review capabilities that can run against Anthropic, Google Gemini, OpenAI-compatible APIs, or offline in CI/eval without real tokens.
- **Decision:** Built `LlmPort` interface and `createLlmPort` factory with 4 adapters (`AnthropicAdapter`, `GeminiAdapter`, `OpenAiAdapter`, `FixtureAdapter`). `FixtureAdapter` is default when `LLM_PROVIDER=fixture` or `LLM_API_KEY` is omitted.
- **Why:** Ensures 100% hermetic CI test execution, zero test flakiness, and zero dependency on live LLM network availability for build verification, while enabling seamless switching to frontier models for live demos.

### Two-Stage Validation and Self-Repair Loop
- **Context:** LLMs may occasionally produce invalid JSON, violate topological constraints, include subjective adjectives in acceptance criteria, or propose payment splits that don't sum to 100%.
- **Decision:** Implemented a two-stage validation pipeline: Stage 1 (Zod schema) + Stage 2 (DAG cycle detection, reachability, milestone percentage bounds, and vague-word regex). On any failure, the exact validation issues are fed back to the LLM in a structured repair prompt, supporting up to 2 repair attempts (3 attempts total).
- **Why:** Catches subtle edge cases automatically before user review, guaranteeing clean DAG graphs and objective observable criteria.

### Topological Working-Day Scheduler and Hamilton Allocation
- **Context:** Plans generated from briefs specify task durations (in 0.5-day steps) and finish-to-start dependencies, but need exact calendar dates for Bryntum Gantt without scheduling work on weekends.
- **Decision:** Computed earliest task start dates by topologically traversing the DAG, skipping weekends via `addWorkingDays`, and allocated integer cents across milestones using Hamilton's largest-remainder method.
- **Why:** Eliminates rounding drift, preserves invariant `sum(milestones.amount_cents) === project.total_cents`, and creates realistic business-day Gantt schedules.

## Pre-M6 Hardening and Security Guards

### LLM Fixture Default and Fail-Fast Configuration Guard
- **Context:** Tests and offline development use recorded fixtures, but silent fallbacks could hide missing API keys or mistakenly run test fixtures in production or benchmarks.
- **Decision:** `FixtureAdapter` is strictly gated on explicit `LLM_PROVIDER=fixture`; real providers (`anthropic`, `gemini`, `openai-compatible`) fail fast with a descriptive error when `LLM_API_KEY` is missing. Production environment refuses `LLM_PROVIDER=fixture` via Zod schema guard. Plan review UI displays a prominent "Fixture Replay" badge, and eval benchmark outputs are partitioned to `latest-fixture.json` so model benchmark files (`latest.json`) never publish fixture data.
- **Why:** Eliminates silent fallback vulnerabilities, prevents deploying mock AI to production, and guarantees evaluation integrity.

### Gantt Sync Tamper Guards, Milestone Task Locking, and Role Enforcement
- **Context:** Bryntum Gantt allows client-side drag-and-drop, task creation, and deletion, which malicious or erroneous client payloads could use to add/delete milestone markers or alter acceptance criteria on funded projects.
- **Decision:** Enforced strict role checking (`client` or `freelancer`) on all sync mutations, blocked creating milestone-linked or zero-duration tasks via sync, blocked deleting milestone-linked tasks, stripped/ignored `milestoneId` on all updates, and locked acceptance criteria modifications once the project is in `funded`, `active`, or `closed` status.
- **Why:** Ensures financial milestones and verifiable criteria can only be generated and agreed through the authenticated planning and funding lifecycle, preserving core integrity against client-side tampering.

### Attempt-Numbered Idempotency Keys and Batch IDs for Payout Retries
- **Context:** When a milestone payout release fails (e.g. transient PayPal outage or insufficient account balance), the milestone is returned to `approved` to allow retries. Re-executing with identical `sender_batch_id` or `idempotencyKey` triggers PayPal duplicate batch errors and PostgreSQL unique constraint conflicts.
- **Decision:** Computed release attempt numbers dynamically from recorded `release_failed` ledger entries (`attempt = failedEntries.length + 1`), appending `:att<N>` to `idempotencyKey` and `_att<N>` to `sender_batch_id` on retries (`release:<id>:att<N>` and `ms_<id>_att<N>`). Webhook handlers and reconciler strip the retry suffix to accurately map back to the parent milestone.
- **Why:** Allows failed payouts to be retried safely and cleanly without violating PayPal duplicate batch restrictions or database unique constraints, while the database-level partial unique index (`one_released_per_milestone`) guarantees at most one payout can ever succeed.

