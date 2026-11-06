# DEMO_AND_SUBMISSION.md

## 1. What separates a winner from the pack

Judges see hundreds of entries. These are the things that make Milestone stand out, and each must be real and visible:

1. **The Gantt is the contract.** Schedule, money, and verification live on the same bars. Nobody else will tie Bryntum progress to payment release.
2. **The AI does real work and is bounded.** Planning and a tool-calling reviewer, with schema validation, tool caps, an SSRF guard, and server-side verdict recomputation.
3. **It survives an attack.** The injection demo (deliverable text begging for approval) is flagged and not paid. Show it briefly.
4. **Money safety is engineered.** Webhook verification, dedupe, idempotency keys, row locks, an append-only ledger, a reconciler. Mention the concurrency test.
5. **Honesty.** "Milestone holding balance, not escrow", real eval numbers, clear limitations. Technical judges reward this.
6. **One unforgettable moment.** The settle animation at the payout.
7. **Complete product feel.** Empty states, errors, keyboard access, audit trail export, a receipt.
8. **Works for judges.** Hosted URL, one-click demo login, mock mode in the README, CI badge, clean repo.

## 2. Demo data

`pnpm demo:reset` creates:
- Project "Brand site rebuild" ($600), client Maya, freelancer Arjun, autonomy mode assisted with a 20-second window.
- A sample brief the Start screen can fill in with one click.
- Three prepared deliverables: a **good** one (passes), a **weak** one (fails one criterion), and an **injection** one.
- Pre-warmed: Render instance awake, browser profile logged into the sandbox buyer, recording resolution fixed at 1920x1080 with a clean desktop.

## 3. Video script (target 2:30, hard limit under 3:00)

Speak in plain, confident sentences. Show the real app, not slides. Subtitles on.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00 to 0:12 | Black frame, then a message thread: "Final payment?" "Soon!" | "Freelancers get ghosted at the final payment. Clients fear paying for work they can't see yet." |
| 0:12 to 0:20 | Milestone logo and the empty Start screen | "Milestone makes the plan, the money, and the proof one thing." |
| 0:20 to 0:40 | Click the sample brief, press Create plan; the Gantt fills in with tasks, dependencies, and four milestone diamonds with amounts | "I paste a brief. The AI planner turns it into a real Bryntum Gantt with dependencies, and four milestones, each with a payment and checkable acceptance criteria." |
| 0:40 to 0:52 | Edit a percentage, the total stays at 100; open the assumptions list | "Everything is editable, and the AI shows its assumptions." |
| 0:52 to 1:10 | Fund screen, PayPal sandbox checkout, bars turn funded, the funds meter updates live | "Maya funds the project through PayPal. The money is held for the project, and the freelancer can see every milestone is funded before starting." |
| 1:10 to 1:22 | Switch persona to Arjun; drag a task, progress moves | "Arjun does the work on the same Gantt. Schedule changes update dependencies." |
| 1:22 to 1:55 | Submit the good deliverable (a GitHub repo link); Trust Panel shows live steps ("Reading the repo tree", "Checking the README setup section"); per-criterion marks appear with evidence and confidence | "He submits a repo. The AI reviewer doesn't just read his description. It calls tools, reads the repo, and checks each criterion with evidence and a confidence score." |
| 1:55 to 2:08 | Quick cut: submit the injection deliverable; the panel shows the warning "The AI found instructions inside the deliverable and ignored them" and escalates | "If someone tries to talk the AI into approving, it's flagged and a human decides. The server never lets the AI move money by itself." |
| 2:08 to 2:25 | Back to the good milestone: countdown ring "Releases in 14 seconds unless you object", then the settle moment: bar fills, coin flies to Arjun's balance, ledger entry appears with the PayPal reference; cut to the PayPal sandbox account showing the payout | "Assisted mode gives Maya a window to object. Then Payouts releases the money, and it lands in Arjun's sandbox account." |
| 2:25 to 2:35 | Trust Panel ledger and audit export; end card with the hosted URL and repo | "Every decision is auditable. Milestone: work is done when the bar turns green, and the money moves when it does." |

Notes:
- If running long, trim the injection cut to 8 seconds and the edit step to 6 seconds.
- Record voice separately if needed and sync it. Clear audio matters more than fancy visuals.
- The final PayPal sandbox payout must be visible on screen (the rules reward a payment completing).

## 4. Rehearsal and readiness checklist (`/demo-check` runs this)

- [ ] Render instance awake; `/healthz` OK
- [ ] `pnpm demo:reset` clean in under 10 seconds
- [ ] Sandbox buyer logged in; business account has payout balance
- [ ] Webhook delivery verified within the last hour
- [ ] Planner returns a valid plan from the sample brief on the first try (three times in a row)
- [ ] Reviewer passes the good deliverable, fails the weak one, and flags the injection one (three times in a row)
- [ ] Payout lands and the settle animation plays without stutter
- [ ] Browser zoom and font sizes readable at 1080p
- [ ] Notifications off, clean desktop, no personal data visible
- [ ] Fallback ready: a recorded clip of the sandbox payout in case the sandbox is slow on the day

## 5. Submission checklist

- [ ] Public GitHub repo with LICENSE (MIT), clear README, CI badge
- [ ] Hosted demo URL working for logged-out viewers, with a one-click demo login
- [ ] "Run locally" instructions that work in mock mode without any credentials
- [ ] YouTube video under 3 minutes, correct visibility, captions on
- [ ] Text description (section 6)
- [ ] AI tools explanation (section 7)
- [ ] All links tested in a private window
- [ ] Submitted at least 24 hours early
- [ ] Prize category selection (if the form asks): the Bryntum prize, plus the general categories the form allows

## 6. Text description template

> **Milestone** is a project workspace where the project plan, milestone money, and proof of work live on a single interactive Bryntum Gantt chart.
>
> **The problem.** Freelancers, especially those working across borders for small businesses, are routinely ghosted at final payment, while clients hesitate to pay upfront for work they cannot yet inspect. Traditional marketplace escrow is expensive (charging up to 20% platform fees) and slow, while informal contracts rely entirely on unenforceable trust.
>
> **What it does.** A client pastes a brief. An AI planner turns it into a live Bryntum Gantt schedule with dependencies, milestone deliverables, payment amounts, and observable acceptance criteria. The client funds the project via PayPal Sandbox Checkout. As the freelancer delivers work, an AI reviewer inspects deliverables using bounded tools (reading GitHub repos and web pages) and returns criterion-by-criterion evidence and confidence scores. If criteria pass, PayPal Payouts releases the milestone payment directly to the freelancer's account. The client selects how much autonomy the AI gets: manual approval, a time-window objection period (assisted mode), or automated release.
>
> **How it is built.** 
> - **Frontend:** React 18, Bryntum Gantt Pro, Tailwind CSS, Lucide icons, Canvas Confetti.
> - **Backend & DB:** Fastify single deployable serving both API and SPA, Neon PostgreSQL with Drizzle ORM, row locking, and local PGlite fallback.
> - **PayPal Integration:** Orders v2 Checkout (funding capture), Payouts v1 (milestone release), and Webhooks v1 with cryptographic signature verification, event deduplication, and an append-only financial ledger.
> - **AI Layer:** Multi-model `LlmPort` (Google Gemini, Anthropic Claude, OpenAI-compatible, and hermetic Fixtures), two-stage planner repair loop, tool-calling reviewer with SSRF guards and 200 KB caps, and server-side verdict recomputation.
>
> **Why it matters.** It provides freelancers certainty of funds and clients objective verification of deliverables, without marketplace fee overhead. It is a working blueprint of an AI agent that safely coordinates real money under strict human guardrails.
>
> **Honest limits.** This is an engineered hackathon prototype operating in the PayPal Sandbox environment. A production deployment requires regulated money-transmission licensing or custodial escrow partnerships, KYC/AML identity verification, legal terms of service, dispute arbitration, and platform fee economics. See the README.

## 7. AI tools explanation template

> **Models and providers:** Google Gemini (`gemini-2.5-flash`), Anthropic Claude (`claude-3-5-sonnet`), and OpenAI-compatible models supported via a modular `LlmPort` interface. Continuous integration and hermetic offline runs use recorded benchmark fixtures (`FixtureAdapter`).
>
> **Planner:** Converts a freeform brief into a topologically ordered Gantt schedule with finish-to-start dependencies, milestone percentage allocations, and observable criteria. Output is validated with Zod, DAG cycle detection, graph reachability, and a vague-word heuristic scanner. A two-stage automated self-repair loop provides up to two repair attempts with structured feedback.
>
> **Reviewer:** An autonomous tool-calling agent with two constrained tools: `fetch_url` (retrieving public URLs) and `read_file` (reading repository contents via the GitHub REST API). It assesses each agreed criterion independently with an evidence excerpt and confidence score. The reviewer is strictly bounded: max 8 tool calls, 10-second timeout, 200 KB streaming body cap, and an SSRF pre-flight DNS resolver blocking private, loopback, link-local, and cloud metadata IP ranges (AWS/GCP/Alibaba).
>
> **Safety:** Deliverable text and repository URLs are treated as untrusted input, enclosed in XML delimiters, and scanned for prompt injection markers prior to LLM execution. The server independently recomputes the final verdict from individual criterion evaluations, enforcing `release < request_changes < escalate_to_human`. If prompt injection is detected, any criterion is unmet, or confidence is low, the server forces human escalation. The LLM has no payment tool and can never move money autonomously.
>
> **Evaluation:** `pnpm eval` runs automated benchmarks against 6 diverse planner briefs (100% pass rate, 100% first-attempt valid, 100% valid after repair, unsafe brief correctly refused) and 7 reviewer cases (100% pass rate, 100% injection detection accuracy, adversarial prompt injection correctly escalated to human).
>
> **Development tooling:** Built with Google Antigravity (Gemini) agentic coding assistant guided by the architectural specs and protocols in `/docs`. Human decisions: product concept, core state machines, financial invariants, security boundaries, honesty review, Render hosting, and PayPal Sandbox account configuration.

Fill in only what is true. Declare AI-assisted development honestly if the rules ask about it.

## 8. After submission

- Keep the hosted app, database, and webhook healthy until judging ends. Do not redeploy unless fixing something critical, and test after any change.
- Pin a short "How to try it" note in the repo README: demo login, sample brief, what to click.
