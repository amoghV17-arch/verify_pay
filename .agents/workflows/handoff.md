---
description: Write the end-of-session handoff note and refresh progress
---

1. Run `node scripts/progress.mjs --write --log "handoff"`.
2. Append a handoff note to the Log in `docs/PROGRESS.md`: what was built, what is deliberately unfinished, and what the next session must know.
3. Update `docs/DECISIONS.md` for any judgment calls made this session.
4. Commit the documentation changes.
