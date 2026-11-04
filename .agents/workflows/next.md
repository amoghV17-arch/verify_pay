---
description: Continue the build from the first unchecked milestone, honoring RUN_MODE
---

1. Read `RUN_MODE` in `AGENTS.md` and `docs/PROGRESS.md` (especially the last handoff note).
2. Run `node scripts/progress.mjs --write` and identify the first unchecked milestone in `docs/MILESTONES.md`.
3. Work on that milestone, following the work loop in `AGENTS.md` (branch, build, `pnpm verify`, tick boxes, commit, merge, tag, push, handoff note, status report).
4. If `RUN_MODE` is `auto`, continue to the next milestone unless a gate stops you. If `RUN_MODE` is `milestone`, STOP after the status report and wait for the owner to say `next`.
