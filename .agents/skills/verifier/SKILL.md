---
name: verifier
description: Verification Gate & Test Router. Auto-triggers post-edit for fast localized test routing, and prior to final task handoff for static typechecking, boundary linting, pre-push validation, and formatting a concise handoff summary.
---

# Alchemy verification gate & test router

## Mid-task (fast iteration)

Run `npm run verify -- --diff` (or explicit paths) over `git status --short`. Use `--plan` to inspect dependency-related tests, the complete tooling suite, and risk escalations.

## Handoff (pre-push)

1. Run `npm run check -- --diff` (or explicit paths). It owns source-aware verification, the CI static aggregate for executable changes, conditional pure builds, preview smoke, bounded failure evidence, and one complete source-digest run record. Full Vitest and browser execution remain CI-owned.
2. Finalize or archive execution plans explicitly when this task owns them; plan lifecycle is workflow hygiene, not part of the product correctness gate.
3. Use `npm run context:hotspots` only as advisory process evidence. It must not block handoff.
4. If this session used the Cursor IDE browser, list tabs and close every one; unlock is not teardown.
