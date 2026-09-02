---
name: verifier
description: Verification Gate & Test Router. Auto-triggers post-edit for fast localized test routing, and prior to final task handoff for static typechecking, boundary linting, pre-push validation, and formatting a concise handoff summary.
---

# Alchemy verification gate & test router

## Mid-task (fast iteration)

Run `npm run verify -- --diff` (or explicit paths) over `git status --short`. Use `--plan` to inspect dependency-related tests and risk escalations.

## Handoff (pre-push)

1. Run `npm run check -- --diff` (or explicit paths). It owns source-aware verification, static checks, conditional pure builds, preview smoke, and one complete source-digest run record.
2. Finalize or archive execution plans explicitly when this task owns them; plan lifecycle is workflow hygiene, not part of the product correctness gate.
3. Use `npm run context:hotspots` only as advisory process evidence. It must not block handoff.
4. If this session used the Cursor IDE browser, list tabs and close every one; unlock is not teardown.
5. Lead the handoff with the game/workflow outcome, then concise verification status. Do not paste logs, traces, or diff dumps.
