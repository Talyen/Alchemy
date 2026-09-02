# Purpose — verifier

Why this skill exists: route dependency-related verification and the source-aware completion gate consistently without ad-hoc test subsets.

Motivated by patterns:

- `../../knowledge/patterns/run-state-command-boundary.md` — verify run/battle changes via dependency-related tests
- `../../knowledge/patterns/save-migration-contract.md` — `test:ship:unit` + `lint:ci` gate before tagging

Introduced: 2026-08 (existing), revised 2026-08-28 for knowledge/evals linkage.

Validate via:

- `npm run verify -- --diff --plan` previews selection
- `npm run check -- --diff` records every applicable and skipped stage
