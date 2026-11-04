# ANTIGRAVITY_GUIDE.md: using this kit in the Antigravity IDE

Antigravity changes quickly, and some details (folder names, setting labels, quotas) differ between versions and write-ups. Where this guide says "check", look in the IDE's own settings or docs and trust what it shows.

## 1. One-time setup

1. **Update the IDE.** Recent versions read `AGENTS.md` automatically. Older ones only read `GEMINI.md`. The kit includes both: `GEMINI.md` is short and tells the agent to read `AGENTS.md` first, so it works either way.
2. **Open the repo root** as the workspace (not a parent folder), so rules and workflows load.
3. **Check the Customizations or Rules panel.** Confirm that `AGENTS.md` (and `GEMINI.md`) show up as active rules.
4. **Check the slash workflows.** In the agent chat type `/`. You should see `next`, `status`, `learn`, `review`, `handoff`, and `demo-check`. If not, the IDE version may use `.agents/workflows/` instead of `.agent/workflows/`. Rename the folder, reopen the workspace, and try again. Delete the old folder after confirming.
5. **Pick the model** in the model selector. Use the strongest available model for M3, M4, M5, M6, M8 and M10 (the money, AI and design milestones), and a faster one for small fixes. Quotas apply on free access, so keep an eye on usage and switch models if you hit a limit.
6. **Install what the milestones need** before starting: Node 20+, pnpm, Docker (for local Postgres), and Git with your GitHub login working in the terminal (`git push` must work without prompts).
7. **Browser tool.** If you want the agent to verify UI, install and allow the browser extension when asked. Use it only with sandbox accounts and local or hosted demo URLs.

## 2. Autonomy and review settings (the important part)

Antigravity asks how much autonomy to give agents. The labels vary, but the choices are along these lines:

| Setting | Auto mode (RUN_MODE: auto) | Milestone mode (RUN_MODE: milestone) |
|---|---|---|
| Review policy (when it pauses for your review of plans and artifacts) | "Agent decides" | "Request review" or "Agent decides" |
| Terminal execution | Start with approval required. Move to auto-run with an **allow list** (`pnpm`, `node`, `git`, `docker compose`, `npx`) once you trust the flow | Approval required, or the same allow list |
| Deny list (if available) | `rm -rf`, `git push --force`, `git reset --hard`, anything with `api-m.paypal.com` (live PayPal), `curl` to unknown hosts | same |

Why: the agent's own rules say to stop at gates, but IDE-level approvals are a second, independent safety net. Do **not** choose "always proceed" for everything. The risky commands in this project are force pushes, deleting files, and anything that could touch live PayPal or expose `.env`.

Also: keep `.env` out of the chat. If the IDE offers a file-access or secrets restriction, use it for `.env*`.

## 3. Modes and views

- **Planning mode vs Fast mode.** Use **Planning** for milestones M3, M4, M5, M6, M8 and M10. The implementation plan artifact is your "approve the plan" gate: check it against the milestone checklist in `docs/MILESTONES.md`, leave comments on anything wrong, and approve. Use Fast mode for small fixes.
- **Agent Manager vs Editor view.** Run the milestone as a conversation in the Agent Manager. Switch to the Editor view to read diffs and run things yourself.
- **Artifacts** (task list, implementation plan, walkthrough, screenshots, recordings): treat them as the review surface. The task list should mirror the milestone checkboxes. The walkthrough is the end-of-milestone summary. The status report in `AGENTS.md` still gets printed too, so progress is in the chat log and in `docs/PROGRESS.md`.
- **Mention files in prompts** with `@` (for example `@docs/PAYPAL_INTEGRATION.md`) when you want to be sure the agent reads a specific doc.

## 4. Running the kit

### Auto mode (RUN_MODE: auto)

1. Do the early human tasks first: H2 and H3 (PayPal sandbox), H4 (Bryntum), H5 (LLM key). Put values in `.env`.
2. Fill `START_DATE` and `DEADLINE` in `docs/PROGRESS.md`.
3. In the Agent Manager, start a conversation in Planning mode and paste the **auto** kickoff prompt from `AGENTS.md`.
4. When it stops at a gate, do the step and reply "done".
5. Use `/status` any time. Use `/next` after you interrupt it, or when you start a fresh conversation.

### Milestone mode (RUN_MODE: milestone)

1. Change the `RUN_MODE` line in `AGENTS.md` to `milestone`, or say "switch to milestone mode" in chat.
2. Start a **fresh conversation per milestone** and paste the **milestone** kickoff prompt with the milestone number.
3. The agent stops after commit, push, and the status report. Say `next` or start a new conversation with `/next`.

## 5. Learning side by side (two conversations)

Antigravity lets you run several conversations, so use that instead of letting questions interrupt the builder.

- **Builder conversation:** follows `AGENTS.md` and does the milestone. In `LEARNING_MODE`, questions asked here are non-blocking, so you can answer during waits, or say `learn batch` or `learn off` to silence them.
- **Tutor conversation (recommended):** a second conversation that never edits code. Start it with:

  > You are my tutor for the Milestone project. Do not edit any files. Read docs/LEARNING_MODE.md, docs/LEARNING_LOG.md, and the recent git diff. Ask me one question at a time, grounded in real files, following the rules in LEARNING_MODE.md. After each answer, give feedback and log the result in docs/LEARNING_LOG.md (that is the only file you may write). Keep going until I say stop.

  Why it helps: the builder's context stays clean and focused, and you can quiz yourself while the builder is working in the background. Re-start the tutor after each milestone so it sees the new diff.
- Use `/learn` in the builder conversation for a single quick question while tests run.
- Ask "explain this diff" in the Editor view on any file you don't understand, then ask the tutor to test you on it.
- Before the video: run the teach-back and judge-mode sessions from `LEARNING_MODE.md` in the tutor conversation.

## 6. Using the browser tool well

- **M1 and M8 and M9 (design):** ask the agent to open the local app, capture screenshots at 1440, 1024 and 390 px widths, and critique them against `docs/DESIGN.md`. Review the screenshots yourself too.
- **M9:** ask for a recording of the payout moment to check the animation.
- **M11 (deploy):** ask it to run the hosted-app smoke test with the sandbox buyer.
- **Safety:** use sandbox accounts only. Never let it log into real PayPal, GitHub, or cloud accounts with real credentials. Watch what it types into pages.
- For the final video, record yourself with a normal screen recorder, not the agent's recording.

## 7. Efficient habits in Antigravity

- **Fresh conversation for each milestone** (and in auto mode, when a conversation gets long or confused). `/status` then `/next` restores context from the repo.
- **Keep one writer per branch.** Do not run two agents that edit the same milestone. You can run a second agent in parallel only on separate files (for example docs or evals) on its own branch.
- **Interrupt early** when the plan or the first diff looks wrong. Correct the plan artifact with comments instead of restarting.
- **Check what matters yourself:** idempotency test, injection test, real sandbox payout, and the UI.
- **Commit often.** The agent commits per milestone, but you can ask for intermediate commits on the big ones.
- **Rules stay lean.** `AGENTS.md` is loaded for every task, so keep it as it is and put detail in `docs/`. The agent reads docs on demand.
- **Use `/review` before merging** milestones M3, M4 and M6. Money and security code deserve a second pass.
- **Use `/handoff`** before closing the IDE for the day.

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `/` shows no workflows | Rename `.agent/` to `.agents/` (or the reverse), reopen the workspace |
| Agent ignores AGENTS.md | Update the IDE, or confirm `GEMINI.md` is present and active in the Rules panel |
| Agent keeps stopping for approvals | Add safe commands to the allow list; keep the deny list |
| Agent runs past a gate | Interrupt, point at the gate rule in `AGENTS.md`, and tighten the review policy |
| Model quota reached | Switch model, reduce parallel agents, or pause until quota resets |
| `git push` fails | Fix Git credentials in the terminal first, outside the agent |
| Webhooks do not arrive locally | They need the deployed URL (M11) or a tunnel; use the mock adapter until then |
