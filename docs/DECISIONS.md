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


