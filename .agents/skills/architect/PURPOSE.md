# Purpose — architect

Why this skill exists: guard new or structurally revised cross-boundary contracts (capability ports, store schemas, persistence envelopes, screen-controller prop trees) from ad-hoc shape changes that widen coupling or break saves.

Motivated by patterns:

- `../../knowledge/patterns/run-state-command-boundary.md` — capability ports + `run-session-command` atomicity
- `../../knowledge/patterns/save-migration-contract.md` — save codec/persistence coordinator ownership
- `../../knowledge/patterns/static-route-imports.md` — screen routing + `ALLOWED_SCREEN_TRANSITIONS` policy

Introduced: 2026-08 (existing), revised 2026-08-28.

Validate via:

- Contract review before implementation; `npm run verify -- --diff --plan` + `npm run check -- --diff` after.
