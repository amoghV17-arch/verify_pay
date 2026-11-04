# GEMINI.md (Antigravity)

Read and follow `AGENTS.md` in this repository first. It is the master instruction file, including the RUN_MODE setting (`auto` or `milestone`).

Antigravity-specific notes:
- Use **Planning mode** for milestones M3, M4, M5, M6, M8 and M10. Use Fast mode only for small fixes.
- Your implementation plan should restate the milestone checklist from `docs/MILESTONES.md`. Do not invent a different plan.
- Use the task list artifact to mirror the milestone checklist, and the walkthrough artifact as the end-of-milestone summary, in addition to the status report format in `AGENTS.md`.
- Use the browser tool for UI verification (screenshots at 1440, 1024 and 390 px) and for the hosted-app smoke test. Use only sandbox accounts in the browser, never real credentials, and never type secrets into a page.
- Never print or open `.env` contents in chat or artifacts.
- Slash workflows live in `.agent/workflows/`: `/next`, `/status`, `/learn`, `/review`, `/handoff`, `/demo-check`.
