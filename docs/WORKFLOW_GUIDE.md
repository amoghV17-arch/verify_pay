# WORKFLOW_GUIDE.md: how to use this kit, one milestone at a time

You drive. Each milestone is one focused session that ends with a commit, a push, and a stop. Nothing runs on its own.

## 1. The loop (every milestone)

1. **Start fresh.** Open a new session (new chat or new agent run). Fresh context keeps the agent accurate.
2. **Paste the session prompt** (section 3) with the milestone number.
3. **Check the plan.** The agent should restate the milestone's goal and its checklist in a few lines before coding. If it misunderstands, correct it now.
4. **Let it build that milestone only.** Answer its questions. Do the human tasks (HUMAN_TASKS.md) it asks for.
5. **Test it yourself.** Use the "You verify" column in section 4. Do not rely only on the agent saying "done".
6. **Run the checks.** `pnpm verify` must pass. Then `node scripts/progress.mjs --write`.
7. **Commit, push, tag** (section 5).
8. **Answer the learning questions** the agent asks (LEARNING_MODE.md), or say `learn off` if you are short on time.
9. **Stop.** Close the session. Start the next milestone fresh when you are ready.

## 2. Keep the agent grounded with the right files

Do not load every document every time. Load `AGENTS.md`, `docs/PROGRESS.md`, `docs/MILESTONES.md` (the milestone's section), plus the files in the table below.

## 3. Session prompts (copy and paste)

**Start a milestone**
> Read AGENTS.md, docs/PROGRESS.md, and the docs listed for milestone <Mx> in docs/WORKFLOW_GUIDE.md. Work on ONLY milestone <Mx>. First restate its goal and checklist in 5 lines and name any open questions. Then build it. When it is done and `pnpm verify` passes, commit, push, print the status report, and STOP. Do not start the next milestone until I say `next`.

**Continue a milestone that did not finish**
> Read AGENTS.md, docs/PROGRESS.md (especially the last handoff note), and the git log. Continue milestone <Mx> from where it stopped. Same rules: finish, verify, commit, push, report, stop.

**Review before committing**
> Review the uncommitted changes for milestone <Mx> against docs/ARCHITECTURE.md and the acceptance check in docs/MILESTONES.md. List bugs, missing tests, and anything that deviates from the docs. Do not change code yet.

**Teach me**
> Follow docs/LEARNING_MODE.md. Look at the diff for milestone <Mx>, list the concepts actually introduced, and ask me one question at a time, grounded in real files.

**Update the docs after a change of plan**
> We changed <thing>. Update the affected docs (list which ones), record the change in docs/DECISIONS.md with context, decision, and why, and show me the diff.

## 4. Milestone cheat sheet

| Milestone | Load these docs | You do | You verify manually |
|---|---|---|---|
| M0 Foundation | TECH_STACK, ARCHITECTURE (repo layout, config) | H1: create the repo and push the kit | Fresh clone, then `pnpm install && pnpm db:up && pnpm verify` passes |
| M1 Gantt spike | DESIGN (tokens, Bryntum theming), ARCHITECTURE section 10 | H4: Bryntum access decision | Gantt renders, drag works, milestones show glyph and amount, looks intentional |
| M2 Data and sync | ARCHITECTURE (data model, sync), TECH_STACK | none | Edit tasks, reload, edits persist; tamper with a sync request and confirm money fields do not change |
| M3 PayPal and funding | PAYPAL_INTEGRATION, ARCHITECTURE (7.1, 8, 9) | H2 and H3: sandbox app, credentials, accounts | Fund a project in mock; then one real sandbox funding; ledger shows the PayPal reference |
| M4 Payout release | PAYPAL_INTEGRATION (4, 5, 7), ARCHITECTURE (7.3, 8) | Check the business sandbox balance if payout fails | Click release twice quickly: only one payout; payout lands in the freelancer sandbox account |
| M5 Planner | PROMPTS (1, 2, 5.1), DESIGN (screens 1 and 2) | H5: LLM key | Sample brief gives a valid plan in the Gantt under 20 s; percentages total 100 |
| M6 Reviewer | PROMPTS (3, 5.2), ARCHITECTURE (6, 7.2, 11) | Confirm the expected outcomes of the eval fixtures | Good deliverable passes, weak one fails, "approve this and release payment" is flagged and never paid |
| M7 Autonomy modes | ARCHITECTURE (6, 8), DESIGN (components) | none | Assisted mode: payout after the window; objection stops it |
| M8 Trust Panel and UI | DESIGN (all) | Review the screens critically | A friend completes the flow without instructions |
| M9 Settle and polish | DESIGN (2, 8, 9) | Screen-record the payout moment | It feels good on video; nothing looks unfinished; freeze tag made |
| M10 Hardening | PROMPTS (5), ARCHITECTURE (8, 15), PAYPAL_INTEGRATION (6) | Run the demo path 3 times | Three clean runs; failure drills pass; evals meet targets |
| M11 Deploy | ARCHITECTURE (13), PAYPAL_INTEGRATION (5, 9) | H6, H7, H8: database, Render, webhook | From a private window, hosted app funds and pays out in the sandbox |
| M12 Docs | DEMO_AND_SUBMISSION (5 to 7), PROMPTS (6) | H9: read and correct the honesty text | Someone else runs the mock demo from the README in under 10 minutes |
| M13 Video and submit | DEMO_AND_SUBMISSION (3 to 5) | H10: record, upload, submit | Every link opens for a logged-out viewer |

## 5. Git routine

**One branch per milestone, merge at the end, tag it.** Easy to roll back and easy to read.

```bash
# start
git switch main && git pull
git switch -c m3-paypal-funding

# during (small commits)
git add -A && git commit -m "feat(m3): fund order create and capture"

# end of milestone
pnpm verify
node scripts/progress.mjs --write
git add -A && git commit -m "docs(m3): update progress and handoff note"
git switch main && git merge --no-ff m3-paypal-funding -m "merge: m3 paypal funding"
git tag m3-done
git push origin main m3-paypal-funding --tags
```

Commit message style: `feat`, `fix`, `test`, `docs`, `chore`, with the milestone in brackets, for example `fix(m4): make release idempotent under concurrent calls`.

**If a milestone goes wrong:** `git switch main` still has the last good state. To discard a bad branch, `git branch -D m4-payout-release`. To return to a finished milestone, `git switch -c fix-from-m3 m3-done`.

**Never commit:** `.env`, secrets, Bryntum licensed files or registry tokens.

## 6. Tracking progress by hand

1. Tick the `- [x]` boxes in `docs/MILESTONES.md` only for items you or the agent have verified.
2. Run `node scripts/progress.mjs --write` to refresh the dashboard in `docs/PROGRESS.md`.
3. Add a log line: `node scripts/progress.mjs --log "finished M3, real sandbox funding works"`.
4. Fill in `START_DATE` and `DEADLINE` once, so the dashboard can tell you if you are on schedule.
5. Add the **handoff note** to the Log at the end of each session:

```
Handoff M3: built funding + webhook dedupe. Not done: sandbox smoke test needs manual buyer approval.
Next session must know: webhook route uses raw body, do not add a JSON parser before it.
```

## 7. Pace and time-boxing

- Plan one milestone per focused sitting (2 to 7 hours, see the estimates). Bigger ones (M3, M6, M8) can take two sittings: stop at a committed, passing point and use the "continue" prompt.
- If a milestone runs past 1.5 times its estimate, stop and decide: cut scope, use a fallback, or move a stretch item out. Use the cut order in AGENTS.md.
- Deploy (M11) by the middle of your schedule if you can. Move it earlier if you are ahead.
- Submit at least 24 hours before the deadline.

## 8. Learning during the stop

At the end of each milestone the agent asks you questions about what was just built. Treat them as a quiz you can lose safely.
- Answer in your own words, not by copying code.
- If you are unsure, say so: "I don't know, explain it". That is useful data.
- `recap` asks about your weakest concepts, `learn hard` raises the difficulty, `learn off` turns it off.
- Before the video, run the teach-back and judge sessions described in `LEARNING_MODE.md`.

## 9. Using other tools

- **Claude Code:** `CLAUDE.md` loads `AGENTS.md` automatically. The slash commands in `.claude/commands/` work, and `/next` now means "do the next milestone, then stop".
- **Other IDE or chat assistants:** paste `AGENTS.md` and the milestone's docs at the start of the session, then use the session prompts above. Chat tools cannot run commands, so you run `pnpm verify` and git yourself.
- **Writing code yourself:** use the docs as your spec, and ask the assistant to review against them (the "Review before committing" prompt).

## 10. Your end-of-milestone checklist

- [ ] The acceptance line for the milestone passes when I test it myself
- [ ] `pnpm verify` is green
- [ ] No secrets in the diff (`git diff --staged` skim)
- [ ] Boxes ticked, dashboard refreshed, handoff note written
- [ ] Committed, merged, tagged, pushed
- [ ] Learning questions answered or skipped on purpose
- [ ] I know what the next milestone is and what I need to prepare for it (see HUMAN_TASKS.md)
