---
status: complete
updated: 2026-08-27
---

# elegant-simplification-pass

## Objective

Reduce accidental duplication and complexity while fixing honest bugs — no gameplay expansion except correcting `equalToBlock/Armor/Gold` damage scaling to match card text. Bounded to: talent pool table, battle damage/amount helpers + exhaustive DamageType handling, store split/factory + gold/flush guards, script pipeline consolidation, build/dev ergonomics, and run-loop unit test rebalancing.

## Plan

- [x] Phase 1: Talent pools — single table replaces 19 copy-pasted pool files (`src/lib/game-data/talents/pool/*.ts` → `talent-pool-definitions.ts`), keep barrel export.
- [x] Phase 2: Battle — extract `amount-helpers.ts` (potion multiplier / block scale), fix `random-damage` rounding, make `DAMAGE_TYPE_HANDLERS` exhaustive `Record<DamageType,…>`, apply Option B for `equalTo*` (raw stat + forge only, no flatPhysical/archery spillover), merge physical helpers, dedup forge decay.
- [x] Phase 3: Stores — split `run-transitions.ts` into `run-lifecycle.ts` + `run-presentation-lifecycle.ts` (thin re-export), factory for `write-port-run/session` field setters, profile-gold assert, flush error logging.
- [x] Phase 4: Scripts — table-driven `optimize-pipelines.mjs` (art/sound/music shared flow), consolidate 5 check scripts under `check-architecture.mjs` subcommands, propagate `ALCHEMY_SKIP_ASSETS`, ignore `.DS_Store` if needed.
- [x] Phase 5: Build/dev — shared vite aliases (`scripts/lib/vite-aliases.mjs`), `hidden` sourcemap for any `mode=desktop`, checker off by default for `npm run dev` (document `ALCHEMY_SKIP_CHECKER` in `docs/REFERENCE.md`), note React Compiler divergence.
- [x] Phase 6: Test rebalancing — add `tests/lib/run-loop/*` unit suites (`reward-flow`, `victory-flow`, `shop-transactions`, `mystery-flow`), remove/narrow `vitest.config.ts` screen exclude, audit battle damage test dedup.
- [x] Verification — `npm run lint`, `typecheck:all`, `npm test -- <touched>`, `verify:changed -- --diff`, final `npm run docs:check:final` and handoff.

## Notes

- Decisions approved: talent table, Option B equalTo, run-loop unit tests, checker off-by-default.
- Keep `migration/steps-v*` and eager art / no React.lazy invariants.
- Each phase verified independently before next.
