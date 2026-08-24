---
name: verifier
description: Verification Gate & Test Router. Auto-triggers post-edit for fast localized test routing, and prior to final task handoff for static typechecking, boundary linting, pre-push validation, and formatting a concise handoff summary.
---

# Alchemy verification gate & test router

## Mid-task (fast iteration)

Run `npm run verify:changed -- --diff` (or explicit paths) over `git status --short`. Use `--plan` to inspect the deduplicated route before running it; do not keep a second command table here.

## Handoff (pre-push)

1. Static gates: `npm run typecheck`, `npm run lint:boundaries`, `npm run ci:routing`.
2. If the user requested a commit to `main`: run `npm run check:push`.
3. Mark finished plans `complete` (or `cancelled`) and run `npm run docs:check:final`; it archives terminal plans, and no active plan may remain unless the task is intentionally unfinished.
4. Format the handoff brief: lead with the domain/game outcome (what is now true, what changed), report exact verification commands and pass/fail status. Do not paste raw build logs, test transcripts, or diff dumps into chat.
