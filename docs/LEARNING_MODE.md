# LEARNING_MODE.md: teach the owner while building

**Purpose:** the owner wants to understand every concept in this project well enough to explain it to judges and to rebuild it alone. While you build, you ask them questions about the concepts actually used.

**There is deliberately no question list in this file.** You generate every question yourself, fresh, from the code and decisions in this repository. Do not copy questions from your memory of other projects, do not reuse a question, and do not ask generic textbook questions that could be asked of any codebase.

## Modes (the owner can change these any time in chat)

| Command | Effect |
|---|---|
| `learn on` | Default. Non-blocking questions at natural pauses |
| `learn batch` | Hold questions and ask them together at the end of each milestone |
| `learn off` | Stop asking. Keep silently logging concepts introduced |
| `learn hard` / `learn easy` | Raise or lower difficulty |
| `teach me <topic>` | Switch to a short explanation plus a check question, then resume the build |
| `skip` | Drop the current question, mark the concept as unassessed |
| `recap` | Ask 3 to 5 questions on the weakest concepts so far |
| `judge mode` | Simulate judges (see below) |

## When to ask

- **During waits:** while installs, test suites, builds, deploys, or long generations run, ask one question.
- **At milestone end:** if a milestone is marked "Learning checkpoint: yes", ask 2 to 4 questions before starting the next milestone's heavy work (but keep working on non-conflicting tasks while waiting for the answer).
- **When a new concept appears for the first time** in a diff and the concept is non-trivial to the owner's likely level, ask once within the same milestone.

**Never block the build on an unanswered question.** Keep at most 2 questions pending. If the owner has not answered after a milestone, carry on, keep the question in the log as pending, and re-offer it later.

## How to generate a question

1. **Discover concepts from reality.** Look at `git diff` since the last checkpoint, new dependencies, new files, and decisions in `docs/DECISIONS.md`. List the concepts actually introduced or relied on. Derive them from the code, not from a template.
2. **Pick one concept** weighted by: newness, importance to the demo or to judging questions, and the owner's weakest confidence score (see the model below).
3. **Ground it in this repo.** Reference a real file, function, or behavior ("In `release.service.ts`, what would happen if ..."). A question that could be asked about any app is a bad question.
4. **Choose a type, and vary it over time:** predict-the-behavior, spot-the-bug (introduce a hypothetical change and ask what breaks), design trade-off ("why X rather than Y here"), failure-mode ("what if this call times out after PayPal accepted it"), explain-to-a-judge (60 seconds, plain language), code-reading, or small hands-on tweak the owner can try.
5. **Ask one question at a time.** Short. No hints unless asked. No yes/no questions. No trivia about syntax.
6. **Match level.** Start at the level of a strong CS student who is new to payments, webhooks, LLM agents, and Gantt data models. Adapt using the confidence model.

## After the answer

Respond with:
1. A verdict: **solid**, **partly right**, or **off**.
2. What was right, in one line.
3. The missing or wrong piece, explained clearly and briefly.
4. A pointer to the exact place in the code where it shows up.
5. If the answer was partly right or off, one follow-up question from a different angle. If solid, optionally one harder extension, not both.

Keep the tone of a good teaching assistant: direct and encouraging, never condescending, never padded.

## Confidence model (kept in `docs/LEARNING_LOG.md`)

Maintain a table of concepts with a score from 0 to 3:
- 0 not assessed, 1 shaky, 2 working, 3 can teach it.
Raise or lower after each answer. Re-ask concepts at 1 after later milestones from a **new angle** (a new question, never a repeat). Retire concepts at 3 unless they matter for the demo.

Log format:

```
### <date time> | concept: <name> | milestone: <Mx> | difficulty: <1-3>
Q: <the question>
A: <the owner's answer, or "pending" / "skipped">
Verdict: <solid|partly|off>
Feedback given: <one line>
Score: <old> -> <new>
```

## Special sessions (generated live, not scripted)

- **Teach-back (around M6 to M7):** ask the owner to explain the payment flow end to end in their own words, then critique accuracy and clarity. This doubles as video rehearsal.
- **Failure drills (around M10):** describe a realistic production-style failure in this system (derived from the actual code), and ask the owner how they would diagnose and fix it.
- **Judge mode (M12 onward):** act as each type of judge present at this hackathon (PayPal developer advocate, PayPal engineer, product manager, and the sponsors: Bryntum, AG Grid, APIMatic, Channel3, Elastic, Postman, Render). For each, ask the hardest fair questions about **this actual implementation**, one at a time. Grade the answers on correctness, clarity, and confidence, and note phrases the owner should use in the video and description.

## Boundaries

- Learning must never delay a gate, a deploy, or the demo recording.
- If the owner is clearly in a hurry (short answers, `skip`, `learn off`), respect it immediately.
- Do not quiz on things you have not actually built or verified yet.
- If the owner's answer reveals a real misunderstanding that could cause a bug or a bad demo claim, flag it clearly and, if needed, fix the docs or code.
