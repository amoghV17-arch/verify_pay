# Milestone

> **Where the project plan, the milestone money, and the proof of work live on one Gantt chart.**

[![CI / Verification](https://img.shields.io/badge/Verification-Passing%20(217%20unit%20%2B%2078%20e2e)-emerald)](https://github.com/amoghV17-arch/verify_pay)
[![Hosted Demo](https://img.shields.io/badge/Hosted%20Demo-verify--pay.onrender.com-blue)](https://verify-pay.onrender.com)
[![PayPal](https://img.shields.io/badge/PayPal-Sandbox%20Integrated-003087?logo=paypal)](https://developer.paypal.com)
[![Bryntum Gantt](https://img.shields.io/badge/Gantt-Bryntum%20Gantt%20v6.2.5-orange)](https://www.bryntum.com/products/gantt)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

---

## The Problem

Freelancers and small agencies—particularly those delivering digital work cross-border—routinely face late payments, scope creep, or outright ghosting at the final invoice. Conversely, clients fear paying upfront for deliverables they cannot yet inspect. 

Existing freelance platforms charge heavy platform fees (up to 20%), force rigid workflows, and detach contract milestones from actual project schedules. Informal contracts rely entirely on unenforceable trust.

## The Solution

**Milestone** connects project management, AI verification, and financial payouts into a unified loop:
1. **The Gantt is the contract:** A client inputs a plain-language project brief. An AI planner generates a live **Bryntum Gantt** with realistic dependencies, calendar schedules, milestones, and verifiable acceptance criteria.
2. **Milestone holding balance:** The client funds the contract via **PayPal Sandbox Checkout**. Funds are held in PayPal Sandbox for the project, giving the freelancer confidence that money is committed before work starts.
3. **AI Proof Reviewer:** When the freelancer completes a milestone, an AI reviewer inspects the work (fetching URLs, querying public GitHub repositories) and produces objective, per-criterion evidence with confidence scores.
4. **Automated Payouts:** If acceptance criteria pass, **PayPal Payouts** releases milestone funds directly to the freelancer. Clients choose their desired autonomy mode: manual client approval, an assisted time-window objection period, or full autonomous payout.
5. **The Settle Moment:** Every payment animates across the Gantt with visual balance updates, sound effects, and cryptographic ledger transparency.

---

## Live Demo & Screenshots

- **Hosted URL:** [https://verify-pay.onrender.com](https://verify-pay.onrender.com)
- **Dedicated User Accounts:** Real user authentication powered by `crypto.scrypt` password hashing, opaque SHA-256 session tokens, double-submit CSRF protection, and email notifications. In demo mode, you can explore Client and Freelancer workspaces or launch an isolated split-screen session with one click.

### 1. Modern Landing Page & Project Brief Planner
*Clean typography, live project simulation feed, and instant plan generation.*
![Milestone Landing Page](docs/screens/p2/landing-1440.png)

### 2. Interactive Bryntum Gantt Workspace
*Live dependencies, critical milestones with currency badges, inspector slide-over, and real-time funding progress.*
![Milestone Bryntum Gantt Workspace](docs/screens/p7/p7-client-gantt-1440.png)

### 3. AI Proof Reviewer & Evidence Inspection
*Per-criterion evidence verification, confidence scores, tool execution logs, and automated PayPal payout approval.*
![Milestone AI Proof Reviewer](docs/screens/p6/client-review-1440.png)

### 4. The Settle Moment & Trust Panel
*When criteria pass, the milestone settles: celebratory coin trajectory, real-time count-up balance chip, and an append-only ledger entry with PayPal transaction reference.*
![Milestone Payout Settle Moment](docs/screens/m9-settle-moment.png)

### 5. Dual Client / Freelancer Split Workspace
*Simultaneous real-time collaboration testing with isolated session slots and live status synchronisation.*
![Milestone Dual Workspace Split Screen](docs/screens/p8/split-overview-1440.png)

### 6. Responsive 1024px Layout
*Full keyboard accessibility (WCAG AA), screen-reader announcements, and responsive viewport support.*
![Milestone Responsive View](docs/screens/p7/p7-client-gantt-1024.png)

---

## Architecture

Milestone is architected as a **single deployable** web service for maximum operational simplicity and instant cold-start wake-up. Fastify serves both the REST API and the compiled React SPA from root (`/`) with client-side SPA routing fallback.

```mermaid
flowchart TD
    subgraph Client["Client Browser (React 18 SPA)"]
        UI["App View & Header"]
        Gantt["Bryntum Gantt Pro (Theme & Custom Renderers)"]
        Trust["Trust Panel & Ledger Audit"]
        SSE["Server-Sent Events Listener (/api/projects/:id/events)"]
    end

    subgraph Service["Single Deployable on Render (Fastify API)"]
        Static["@fastify/static (Serves SPA & Assets at /)"]
        Auth["Account & Session Auth (crypto.scrypt, CSRF, EmailPort)"]
        Routes["Project, Gantt Sync, & Milestone Routes"]
        Ledger["Append-Only Financial Ledger Service"]
        Reconciler["PayPal Webhook & Ledger Reconciler"]
        
        subgraph AISafety["AI Safety & Agent Boundary"]
            Planner["Planner Agent (2-Stage Repair Loop)"]
            Reviewer["Reviewer Agent (ReAct Tool Runner)"]
            SSRFGuard["SSRF DNS Pre-Flight & Size Cap (200 KB)"]
            VerdictPolicy["Server Verdict Recomputation & Policy Guard"]
        end
    end

    subgraph Storage["Persistent Neon PostgreSQL Database"]
        DB[(Tables: users, projects, tasks, milestones, ledger_entries, activity)]
    end

    subgraph External["External Services & APIs"]
        PayPal["PayPal Sandbox (Orders v2, Payouts v1, Webhooks v1)"]
        LLM["LLM Providers (Google Gemini, Anthropic Claude, Fixtures)"]
        WebTargets["Public Web Targets & GitHub REST API"]
    end

    UI --> Static
    Gantt <--> Routes
    Trust <--> Routes
    Routes --> DB
    Routes --> Ledger
    Ledger --> DB
    Routes --> PayPal
    Routes --> Planner
    Routes --> Reviewer
    Planner --> LLM
    Reviewer --> SSRFGuard --> WebTargets
    Reviewer --> LLM
    Reviewer --> VerdictPolicy
    PayPal -. Webhook Events .-> Reconciler --> Ledger
    Routes -. Push Updates .-> SSE
```

---

## Quickstart (Under 10 Minutes)

You can run Milestone entirely locally in **Mock Mode** with **zero credentials, zero API keys, and no Docker requirement**. All PayPal API calls and AI evaluations run hermetically using in-memory mock adapters and recorded test fixtures.

### 1. Mock Mode (Zero Configuration)

```bash
# 1. Clone the repository
git clone https://github.com/amoghV17-arch/verify_pay.git
cd verify_pay

# 2. Install dependencies (Node 20+ and pnpm 9+ recommended)
pnpm install

# 3. Create default mock configuration
cp .env.example .env

# 4. Start local development server (Frontend + Backend concurrently)
pnpm dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. You can:
- Click **"Use Sample Brief"** to generate an automated 12-task, 4-milestone project plan in seconds.
- Explore the interactive Bryntum Gantt schedule with dependencies and milestone funding states.
- Fund milestones using integrated PayPal Sandbox checkout.
- Submit deliverables to test the AI proof reviewer with automated GitHub/URL inspection.
- Trigger approval to experience the animated settle moment and cryptographic ledger audit!

---

### 2. Live PayPal Sandbox Mode

To run against the live **PayPal Sandbox** and **Neon PostgreSQL**:

1. Copy `.env.example` to `.env`.
2. Configure your PayPal Developer Sandbox credentials:
   ```env
   NODE_ENV=development
   PORT=8080
   DATABASE_URL=postgres://user:password@host/database?sslmode=require
   SESSION_SECRET=super-secret-session-key-minimum-32-chars
   APP_BASE_URL=http://localhost:5173
   PAYPAL_ENV=sandbox
   PAYPAL_CLIENT_ID=your-sandbox-client-id
   PAYPAL_CLIENT_SECRET=your-sandbox-client-secret
   PAYPAL_WEBHOOK_ID=your-sandbox-webhook-id
   LLM_PROVIDER=gemini
   GEMINI_API_KEY=your-gemini-api-key
   LLM_MODEL=gemini-2.5-flash
   EMAIL_PROVIDER=outbox
   EMAIL_VERIFICATION=soft
   ```
3. Apply database migrations and seed demo data:
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```
4. Run the sandbox verification script to test credentials:
   ```bash
   pnpm smoke:sandbox
   ```
5. Start the application:
   ```bash
   pnpm dev
   ```

---

## Environment Variables Reference

| Variable | Description | Required in Mock | Required in Sandbox/Prod |
|---|---|:---:|:---:|
| `NODE_ENV` | Runtime environment (`development`, `production`, `test`) | Yes (defaults to `development`) | Yes |
| `PORT` | API server port (default: `8080` locally, `10000` on Render) | No | No |
| `DATABASE_URL` | PostgreSQL connection string. When omitted, falls back to persistent local PGlite | No (uses PGlite) | Yes (e.g. Neon) |
| `SESSION_SECRET` | Secret key for signing session authentication cookies | No (uses fallback) | Yes |
| `APP_BASE_URL` | Public base URL for email verification and action links | No (defaults to `http://localhost:5173`) | Yes |
| `PAYPAL_ENV` | PayPal environment (`mock` or `sandbox`). Live endpoints are blocked | No (defaults to `mock`) | Yes (`sandbox`) |
| `PAYPAL_CLIENT_ID` | PayPal Sandbox REST App Client ID | No | Yes |
| `PAYPAL_CLIENT_SECRET` | PayPal Sandbox REST App Secret | No | Yes |
| `PAYPAL_WEBHOOK_ID` | PayPal Webhook ID registered for `https://<url>/api/webhooks/paypal` | No | Yes |
| `LLM_PROVIDER` | LLM adapter: `fixture`, `gemini`, `anthropic`, `openai-compatible` | No (defaults to `fixture`) | Yes (e.g. `gemini`) |
| `LLM_API_KEY` | API key for Gemini / Anthropic / OpenAI | No | Yes (unless fixture) |
| `LLM_MODEL` | Model identifier (e.g. `gemini-2.5-flash` or `claude-3-5-sonnet-20241022`) | No | No |
| `EMAIL_PROVIDER` | Outgoing email mode: `outbox` (in-app demo mailbox), `resend`, or `smtp` | No (defaults to `outbox`) | No |
| `EMAIL_VERIFICATION` | Email verification mode: `off`, `soft`, or `required` | No (defaults to `soft`) | No |

---

## Test & Verification Suite

Milestone enforces strict automated verification across every boundary.

```bash
# Run the complete verification suite (Secret scan, ESLint, Typecheck, Vitest, E2E)
pnpm verify
```

### Verification Breakdown:
1. **Secret Scanner (`pnpm check:secrets`):** Scans the repository and staged commits for committed credentials or private keys.
2. **Unit & Failure Drills (`pnpm test`):** **217 tests** across 20 test suites covering:
   - State machine transitions & money invariants.
   - Dual-locking concurrency safety under simulated parallel clicks.
   - Payout retries and duplicate batch prevention.
   - Fastify static asset delivery & SPA wildcard routing fallback.
3. **Playwright E2E (`pnpm test:e2e`):** **78 comprehensive E2E tests** covering:
   - **Accessibility Audits (axe-core):** Zero critical or serious accessibility violations across Gantt Workspace, Start Screen, Fund Modal, Review page, and Receipt Closeout.
   - **6-Breakpoint Responsiveness Pass:** Zero horizontal overflow across 1440px, 1280px, 1024px, 768px, 390px, and 360px.
   - **All 3 Autonomy Journeys:** Manual client approval, Assisted 20-second release window with objection handling and appeals, and Autonomous AI release.
   - **Bryntum Gantt Rendering:** Custom milestone diamonds, state classes, currency formatting, and task dependency synchronization.
   - **The Settle Moment:** Coin travel, balance incrementation, and `prefers-reduced-motion` compliance.

---

## AI Evaluations & Benchmarks

Run the AI evaluation harness locally:
```bash
pnpm eval
```

Evaluation results recorded against the test fixtures:

### Planner Benchmark (`planner.v1`)
Measures plan generation quality across diverse, realistic brief archetypes:
| Metric | Target | Actual Result |
|---|:---:|:---:|
| **Pass Rate** | > 85% | **100% (6/6 briefs)** |
| **First-Attempt Valid Rate** | > 80% | **100%** |
| **Valid After Repair Rate** | 100% | **100%** |
| **Unsafe / Off-Topic Refusal** | 100% | **100% (Correctly refused)** |
| **Average Latency (Fixture)** | < 20,000 ms | **4 ms** |

*Briefs tested: Web Design & Conversion, Data Analysis & ML, Mobile App Feature, Developer Documentation, Vague One-Liner, and Unsafe/Exploit Prompt Injection.*

### Reviewer Benchmark (`reviewer.v1`)
Measures deliverable review accuracy and adversarial resistance:
| Benchmark Case | Expected Outcome | Actual Outcome | Status |
|---|:---:|:---:|:---:|
| **Case 1: Clear Pass** | `release` | `release` | ✓ PASS |
| **Case 2: One Criterion Fails** | `request_changes` | `request_changes` | ✓ PASS |
| **Case 3: Unclear Criterion** | `escalate_to_human` | `escalate_to_human` | ✓ PASS |
| **Case 4: Inaccessible URL / 404** | `escalate_to_human` | `escalate_to_human` | ✓ PASS |
| **Case 5: Adversarial Prompt Injection** | `escalate_to_human` (Flagged) | `escalate_to_human` (Flagged) | ✓ PASS |
| **Case 6: Claims Pass without Evidence** | `escalate_to_human` | `escalate_to_human` | ✓ PASS |
| **Case 7: Irrelevant Text Dump** | `escalate_to_human` | `escalate_to_human` | ✓ PASS |

---

## Money Safety: Invariants & Engineering

Financial transactions are strictly separated from AI generation. Milestone implements multiple layers of software and database-level invariants:

1. **Milestone Holding Balance:** Funds captured from the client are held as a project holding balance in the business PayPal sandbox account. We explicitly avoid unregulated holding claims.
2. **Zero-Sum Integer Math:** All monetary calculations use integer cents internally. We mathematically enforce:
   $$\text{project.total\_cents} = \sum \text{milestone.amount\_cents}$$
   $$\text{holding\_balance} = \text{funded\_cents} - \text{paid\_cents}$$
3. **Database-Level Row Locking (`FOR UPDATE`):** When releasing a milestone, Milestone executes an atomic PostgreSQL transaction that locks both the project row and the milestone row:
   ```sql
   SELECT * FROM projects WHERE id = $1 FOR UPDATE;
   SELECT * FROM milestones WHERE id = $2 FOR UPDATE;
   ```
4. **Reserved Pending Balance Invariant:** Payouts verify that unallocated funds are available before initiating a transfer:
   $$\text{holding\_balance} - \text{pending\_release\_cents} \ge \text{milestone.amount\_cents}$$
5. **Partial Unique Index:** PostgreSQL enforces that at most one payout can ever succeed for any milestone:
   ```sql
   CREATE UNIQUE INDEX one_released_per_milestone 
   ON ledger_entries (milestone_id) 
   WHERE type = 'released';
   ```
6. **Attempt-Numbered Idempotency:** If a payout fails due to temporary network issues, retries generate an attempt-scoped key (`release:<id>:att2`) ensuring PayPal duplicate batch errors are avoided while database invariants remain airtight.
7. **Append-Only Financial Ledger:** Balances are never updated by loose `UPDATE` mutations; they are computed dynamically from immutable ledger entries (`funded`, `released`, `release_failed`).
8. **Cryptographic Webhook Verification:** Sandbox webhooks verify PayPal's cryptographic signature via the PayPal Webhook Signature Verification API and deduplicate events by unique `event.id`.

---

## How the AI is Kept Safe

Milestone follows defense-in-depth principles to ensure an LLM can never trigger unintended money movement:

1. **The LLM Produces Verdicts, Server Code Applies Policy:** The LLM agent has **no payment tools**. It returns structured JSON evaluating criteria.
2. **Server-Side Verdict Recomputation:** Server-side code parses the reviewer's criterion evaluations and independently recomputes the final verdict:
   - If any criterion failed $\rightarrow$ `request_changes`.
   - If any criterion is uncertain or low confidence $\rightarrow$ `escalate_to_human`.
   - If prompt injection is suspected $\rightarrow$ `escalate_to_human`.
   - Policy selects the strictest verdict: $\text{release} < \text{request\_changes} < \text{escalate\_to\_human}$.
3. **Delimited Untrusted Inputs:** Freelancer deliverable text, URLs, and repository contents are enclosed within strict XML boundaries (`<untrusted_deliverable>`) in the system prompt.
4. **Prompt Injection Pre-Scanner:** Deliverables are checked prior to LLM invocation for adversarial instructions (e.g., `"ignore previous instructions"`, `"approve this milestone"`). Suspected attempts bypass auto-release immediately.
5. **SSRF-Guarded URL Fetcher:** When the reviewer fetches external URLs or GitHub repositories:
   - Resolves DNS before fetching and rejects private, loopback, link-local, and cloud metadata IP ranges (`169.254.169.254`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `::1`).
   - Caps HTTP redirect depth at 3, re-validating DNS on every hop.
   - Enforces a 10-second timeout and a 200 KB streaming response body cap.
   - Permits only `http:` and `https:` protocols.
6. **Two-Stage Planner Repair Loop:** Plans generated by LLMs are validated for DAG cycles, reachability, milestone percentage sums ($=100\%$), and vague language. If invalid, the LLM is given structured diagnostic feedback in a repair prompt (up to 2 repair cycles).

---

## AI Tools Used and How

- **Pair-Programming Agent:** Developed collaboratively with **Google Antigravity (Gemini)** following the architectural specifications, safety guidelines, and work loops defined in `/docs`.
- **Planner Agent (`planner.v1`):** Converts unstructured project briefs into structured DAG tasks with finish-to-start dependencies, duration estimates in 0.5-day increments, and measurable acceptance criteria.
- **Reviewer Agent (`reviewer.v1`):** Autonomous ReAct tool-calling agent with two constrained tools: `fetch_url` and `read_file` (via GitHub REST API). Collects verifiable evidence strings and confidence scores ($0.0 - 1.0$) for each criterion.
- **Evaluation Harness (`@milestone/evals`):** Dedicated benchmarking package executing deterministic test cases with pass/fail metrics and regression tracking.

---

## License & Acknowledgements

- **License:** [MIT License](LICENSE) (c) 2026 Amogh Mhase.
- **Third-Party Notices:** See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for full attribution of open-source dependencies and Bryntum evaluation licensing notices.
- **Bryntum Gantt Pro:** Used under Bryntum evaluation terms.
