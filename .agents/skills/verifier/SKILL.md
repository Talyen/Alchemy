---
name: verifier
description: Verification Gate & Test Router. Auto-triggers post-edit for fast localized test routing, and prior to final task handoff for static typechecking, boundary linting, pre-push validation, and formatting a concise handoff summary.
---

# Alchemy verification gate & test router

## Mid-task (fast iteration)

Run `npm run verify:changed -- --diff` (or explicit paths) over `git status --short`. Use `--plan` to inspect the deduplicated route before running it; do not keep a second command table here.

## Handoff (pre-push)

1. Run `npm run check:handoff -- --diff` (or explicit paths). It owns the full handoff gate: strict changed-path verification, `lint:ci`, full Vitest, verified build + preview smoke, `@prepush` canary, final docs/plan validation, and `context:hotspots -- --run-id <id> --check` against the gate's single run ID with source-state digest staleness detection. Do not substitute `--last 1` for the handoff exposure check.
2. If the user requested a fast push only: `npm run check:push` is the canonical hook gate (lockfile, format, typechecks, lint, generated-output validation including version metadata, and non-mutating `build:verified`).
3. Mark finished plans `complete` (or `cancelled`) and run `npm run archive:plans` explicitly, then `npm run docs:check:final` (pure validation — no archiving). No active plan may remain unless the task is intentionally unfinished; unarchived terminal plans fail final validation with guidance to archive.
4. If this session used the Cursor IDE browser, list tabs and close every one; unlock is not teardown.
5. Format the handoff brief in product/design language: lead with the game/workflow outcome (what is now true, what changed) using game vocabulary, then concise verification status (which gates passed/failed) without leaning on file paths, line numbers, or code excerpts unless the user asked for them. Do not paste raw build logs, test transcripts, or diff dumps into chat.
