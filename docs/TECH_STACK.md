# TECH_STACK.md

Pin exact versions at install time and record them in `docs/DECISIONS.md`. Where a choice depends on a vendor's current docs (Bryntum, PayPal, LLM SDKs), verify against the official documentation before relying on it.

## Choices

| Area | Choice | Why | Fallback |
|---|---|---|---|
| Language | TypeScript (strict) everywhere | One language, shared schemas, fewer bugs | none |
| Package manager | pnpm workspaces | Fast, monorepo friendly | npm workspaces |
| Frontend | React 18 + Vite | Fast dev loop, Bryntum has first-class React support | none |
| Gantt | **Bryntum Gantt** (trial package for the public repo) | It is the prize target and the product's core UI | none (do not substitute) |
| UI chrome | Tailwind CSS + CSS variables for tokens, small hand-built components | Quick, themeable around Bryntum | CSS modules |
| Data fetching | TanStack Query | Caching and SSE-driven invalidation | SWR |
| Routing | React Router | Simple | none |
| Motion | CSS animations plus Web Animations API; Framer Motion only if needed | Keep the settle moment smooth and light | CSS only |
| PayPal in browser | `@paypal/react-paypal-js` (Buttons) | Official, sandbox-ready | server redirect flow |
| Backend | Node 20+ with Fastify and `fastify-type-provider-zod` | Fast, typed routes, plugin model | Express |
| Validation | zod, shared in `packages/shared` | One schema for client, server, and LLM output | valibot |
| Database | PostgreSQL, Drizzle ORM and drizzle-kit migrations | Row locks and partial unique indexes make money logic safe | SQLite (loses safety features) |
| Local DB | `docker-compose.yml` Postgres | One command | PGlite for tests |
| Realtime | Server-Sent Events | Simple, works through proxies, enough for one-way updates | WebSocket |
| Background jobs | In-process polling worker (DB-backed) | No extra infra, resumable | pg-boss |
| PayPal server | Thin typed REST client over `fetch` with OAuth token caching, behind `PayPalPort` | Full control of idempotency headers and Payouts (check whether the official SDK covers Payouts before choosing) | official PayPal server SDK for Orders |
| LLM access | `LlmPort` with adapters: Anthropic, Gemini, OpenAI-compatible, and `fixture` (recorded) | Free-tier flexibility, deterministic CI | single provider |
| LLM output | Tool-use or JSON-schema mode plus zod validation and repair loop | Reliable structured output | prompt-only JSON |
| Auth | Demo personas plus signed cookie sessions (`jose`) | Enough for the demo, no third-party dependency | Lucia / Auth.js |
| Testing | Vitest, Playwright, Testcontainers or docker Postgres | Standard and fast | Jest |
| Lint and format | ESLint, Prettier, TypeScript project references | Consistency | Biome |
| CI | GitHub Actions: install, lint, typecheck, test, e2e (mock) | Visible quality signal in the repo | none |
| Hosting | Render (web service), free Postgres provider | Render is a sponsor and judge; simple deploys | Fly.io |
| Logging | pino | Structured, fast | none |
| Docs and diagrams | Markdown plus Mermaid (renders on GitHub) | No tooling needed | none |

## Model choice guidance (LLM)

- **Planner and Reviewer** need reliable instruction following and structured output. Use the strongest model you have access to for evals and for the demo, and a cheaper one during development.
- Keep model names in env vars, never hardcoded. Record which model produced the final eval numbers in the README.
- Keep a `fixture` provider that replays recorded responses for CI and for a no-network demo fallback. Label it honestly as a fixture in dev tooling, and never show fixture output in the video as live AI.

## Why this stack wins hackathon judging

- **Technological Implementation:** ports and adapters, idempotent money flows, a verified webhook pipeline, a state machine, schema-validated tool-calling agent, evals, CI.
- **Design:** Tailwind tokens plus a themed Bryntum Gantt, one memorable animation, a consistent copy voice.
- **Presentation:** a one-command demo reset and a mock mode make recording reliable.

## Version and license checks

- Prefer MIT, Apache-2.0, BSD, ISC dependencies. Flag anything else as a gate.
- Bryntum is commercial: never copy its source into the repo, and keep the public repo runnable with the trial package.
- Add a `THIRD_PARTY_NOTICES.md` generated from dependency licenses at M12.

## Dev commands (the agent creates these in M0)

```
pnpm install
pnpm dev               # web + api with hot reload
pnpm db:up             # docker compose up postgres
pnpm db:migrate
pnpm db:seed
pnpm verify            # lint + typecheck + unit + integration + e2e (mock)
pnpm eval              # planner and reviewer evals, writes evals/results/latest.json
pnpm smoke:sandbox     # one real sandbox funding + payout (needs credentials)
pnpm demo:reset        # wipe and reseed the demo project
pnpm build && pnpm start
```
