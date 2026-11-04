# Milestone build kit

A set of guide files for building the **Milestone** hackathon project one milestone at a time, with an AI assistant (Claude Code or any assistant that can read `AGENTS.md`), or by yourself using the docs as the spec.

**Milestone:** a Bryntum Gantt where every milestone has PayPal sandbox money attached, an AI reviewer checks each deliverable against agreed criteria, and a payout is released when it passes.

**Working mode:** set by `RUN_MODE` in `AGENTS.md`. `auto` runs milestone after milestone until a gate. `milestone` stops after each milestone for you to review.

## Start here

1. Using the Antigravity IDE? Read `docs/ANTIGRAVITY_GUIDE.md` first. Then read `docs/WORKFLOW_GUIDE.md`. It has the loop, the session prompts, the git routine, and a cheat sheet of which docs to load and what to test for each milestone.
2. Create a public GitHub repo with an MIT license (task H1 in `docs/HUMAN_TASKS.md`), copy this kit in, commit, and push.
3. Fill in `START_DATE` and `DEADLINE` in `docs/PROGRESS.md`.
4. Start milestone M0 with the session prompt from the guide.

## What is in the kit

| File | Purpose |
|---|---|
| `docs/ANTIGRAVITY_GUIDE.md` | Setup and settings for the Antigravity IDE, workflows, and the two-conversation learning setup |
| `docs/WORKFLOW_GUIDE.md` | Milestone-by-milestone routine, prompts, git steps, and a cheat sheet per milestone |
| `AGENTS.md` | Instructions the assistant follows (work loop, quality bar, safety rules, stop after each milestone) |
| `GEMINI.md` and `.agent/workflows/` | Antigravity setup and slash workflows (`/next`, `/status`, `/learn`, `/review`, `/handoff`, `/demo-check`) |
| `CLAUDE.md` and `.claude/commands/` | The same for Claude Code |
| `docs/MILESTONES.md` | The plan: M0 to M13 plus stretch items, with checklists, acceptance checks, and a schedule |
| `docs/ARCHITECTURE.md` | Components, data model, state machine, sequences, failure handling |
| `docs/TECH_STACK.md` | Chosen stack, reasons, fallbacks, dev commands |
| `docs/PAYPAL_INTEGRATION.md` | PayPal flows, webhook rules, idempotency, mock adapter |
| `docs/PROMPTS.md` | Planner, Reviewer, and Appeal prompts, schemas, validators, evals |
| `docs/DESIGN.md` | Design system, screens, the payout "settle" moment, copy, accessibility |
| `docs/DEMO_AND_SUBMISSION.md` | Video script, readiness and submission checklists, text templates |
| `docs/HUMAN_TASKS.md` | Tasks only you can do (accounts, keys, deploy, video), with exact steps |
| `docs/LEARNING_MODE.md` | How the assistant quizzes you; questions are generated from your code, not pre-written |
| `docs/PROGRESS.md` | Dashboard, blockers, and log |
| `scripts/progress.mjs` | Computes progress from the milestone checkboxes |

The assistant also creates `docs/DECISIONS.md` and `docs/LEARNING_LOG.md` as you go.

## Ground rules

- Sandbox only. Never use live PayPal credentials or endpoints.
- Never commit secrets or proprietary Bryntum files.
- Claims in the README and video must be true. Eval numbers come from real runs.
- Call the money flow a **milestone holding balance**, not escrow.
- Verify PayPal and Bryntum details against their official docs before relying on them.
- Check each sponsor prize's exact eligibility and technical requirements on the hackathon page before you build and again before you submit.
