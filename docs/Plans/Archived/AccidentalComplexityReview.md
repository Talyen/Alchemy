---
status: complete
updated: 2026-09-12
---

# Accidental Complexity Review

## Final decisions

Implemented on 2026-09-12. This record supersedes the earlier replacement-run flow and mockups.

- Keep one unfinished run, with exact resume.
- Main menu: **Continue** when a run exists; otherwise **Play**. Never show both, a separate New Run action, or a disabled Play action.
- Players end the current run using the existing red **End Run** menu action. It acts immediately, with **no confirmation**, and returns to the main menu.
- Existing development saves are disposable. Establish a new supported save baseline without migrating or salvaging old development saves.
- Keep explicit combat resolution paths; make only evidenced, targeted improvements to reaction eligibility and ordering.
- Keep animated WebGL plasma with a static decorative fallback; remove animated Canvas support.
- Preserve Alchemy's actual screens, artwork, typography, controls, and minimal copy. Do not add run-summary cards, Health readouts on the menu, setup warnings, step indicators, instructional text, or extra setup screens.

## Compatibility consequences

Single-run format with schema 19 as the supported baseline; below-baseline saves rejected. Removed parked-run state, below-baseline migrations/aliases, historical fixtures, and the animated Canvas backend. Durable rules moved to their owners before trimming: single-run navigation and End Run in [ARCHITECTURE](../../ARCHITECTURE.md#run-setup-ownership), save baseline in [MIGRATIONS](../../../src/features/alchemy/shared/storage/MIGRATIONS.md#supported-baseline), plasma fallback in [UI](../../UI.md#plasma-availability). Full implementation steps and acceptance scenarios remain in git history.

## Verification summary

Completion gate `check-20260912t212647z-87585-e00932` passed: 4,724 related unit tests, save and tooling/architecture suites, CI static checks, web build, bundle budget, and preview smoke. Browser verification passed 13 menu/graphics cases and all 15 save/outcome journeys; packaged-renderer Electron graphics loss/restoration passed on macOS. Existing unrelated uncommitted work was preserved. No commit or push was requested or performed.
