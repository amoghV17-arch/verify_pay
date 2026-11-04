# LEARNING_LOG.md: Owner Concept Assessment Log

Living log of concepts introduced, questions asked, and assessment scores (0: not assessed, 1: shaky, 2: working, 3: can teach it).

| Concept | Milestone | Difficulty | Score |
|---|---|---:|---:|
| Largest-remainder money distribution | M0 | 2 | 0 -> pending |
| Zod runtime configuration & PayPal safety guard | M0 | 1 | 0 -> pending |
| Bryntum TaskModel custom fields & runtime mapping | M1 | 2 | 0 -> pending |

## Log

### 2026-11-04 20:12 | concept: Largest-remainder money distribution | milestone: M0 | difficulty: 2
Q: In `packages/shared/src/money.ts`, why do we distribute percentage allocations using the Largest-Remainder Method (`distributePercentages`) rather than calculating `Math.round((totalCents * pct) / 100)` independently for each milestone, and what project invariant does this protect?
A: pending
Verdict: pending
Feedback given: none
Score: 0 -> pending

### 2026-11-04 23:01 | concept: Bryntum TaskModel custom fields & runtime mapping | milestone: M1 | difficulty: 2
Q: In `apps/web/src/models/MilestoneTaskModel.ts`, we declare `static override get fields()` returning custom field definitions (`milestoneId`, `amountCents`, etc.) alongside TypeScript `declare` statements. Why does Bryntum require runtime static field declarations rather than TypeScript type definitions alone, and what role will this play when we sync changes with the backend in M2?
A: pending
Verdict: pending
Feedback given: none
Score: 0 -> pending
