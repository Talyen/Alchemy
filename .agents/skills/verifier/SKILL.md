---
name: verifier
description: Verification Gate & Test Router. Auto-triggers post-edit for fast localized test routing, and prior to final task handoff for static typechecking, boundary linting, pre-push validation, and formatting a concise handoff summary.
---

# Alchemy verification gate & test router

## Mid-task (fast iteration)

Run `npm run verify:changed -- --diff` (or explicit paths) over `git status --short`. Use `--plan` to inspect the deduplicated route before running it; do not keep a second command table here.

## Handoff (pre-push)

1. Static gates: `npm run typecheck`, `npm run lint:boundaries`, `npm run ci:routing`.
2. Context gate: after the task's final `verify:changed` run, run `npm run context:hotspots -- --last 1 --check`. This checks the freshly recorded command exposures; do not substitute a broader historical window for the handoff gate.
3. If the user requested a commit to `main`: run `npm run check:push`.
4. Mark finished plans `complete` (or `cancelled`) and run `npm run docs:check:final`; it archives terminal plans, and no active plan may remain unless the task is intentionally unfinished.
5. If this session used the Cursor IDE browser, list tabs and close every one; unlock is not teardown.
6. Format the handoff brief in product/design language: lead with the game/workflow outcome (what is now true, what changed) using game vocabulary, then concise verification status (which gates passed/failed) without leaning on file paths, line numbers, or code excerpts unless the user asked for them. Do not paste raw build logs, test transcripts, or diff dumps into chat.
