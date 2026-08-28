# Purpose — verifier

Why this skill exists: route changed-path verification and handoff gates correctly; prevent drift where agents run ad-hoc test/lint subsets or miss `context:hotspots` / `docs:check:final` steps.

Motivated by patterns:

- `../../knowledge/patterns/run-state-command-boundary.md` — verify run/battle changes via `verify:changed` routes
- `../../knowledge/patterns/save-migration-contract.md` — `test:ship:unit` + `lint:ci` gate before tagging

Introduced: 2026-08 (existing), revised 2026-08-28 for knowledge/evals linkage.

Validate via:

- `npm run verify:changed -- --plan` previews deduplicated routes
- `npm run docs:check` + `npm run context:hotspots -- --last 1 --check` in handoff
