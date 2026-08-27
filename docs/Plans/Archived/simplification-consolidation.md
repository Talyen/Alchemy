---
status: complete
updated: 2026-08-27
---

# Simplification & Consolidation

## Objective

Elegant, simple code: reduce over-engineering, duplication, and accidental complexity across battle, persistence, UI/motion, content, and tooling. Keep gameplay intent (hidden fight pacing ~44% max both-sides comeback+clock, generous mystery fallback, latest Node) while making the implementation's "right shape" obvious. Ship as phased commits.

Decisions locked 2026-08-27: (1) pacing keep as-is, document only (2) mystery fallback always generous but make explicit per-event (3) Node engines bump `>=22` → `>=24` (4) single plan, phased commits.

## Plan

- [x] Phase 0 — Tooling/CI: engines kept at `>=24`, docs sync, knip entry fix, vitest coverage exclude dead pattern removed, `change-routes.mjs` split into `scripts/lib/test-commands.mjs` + `scripts/lib/change-routes.mjs`, dep-cruiser already single-source from `eslint/fragments.js` (`dependency-cruiser.config.mjs`), `verify-changed` stays sequential (parallelize deferred as risky for failure-digest ordering)
- [x] Phase 1a — Motion/tooltip: single fade primitive made configurable, fixed `setState` during render anti-pattern, tooltip fade now uses `resolveGameDelay` (animation-disabled aware)
- [x] Phase 1b — Persistence: `serializeSaveSnapshot` made pure (`now` param), `applySaveWritePolicy` resets on `corrupt` too, `saveAlchemySaveData` drains `coalescedSave` on `writesDisabled`, RNG clone + counter persist fix shipped
- [x] Phase 1c — Shared UI: verified tilt already rAF-batched via `src/features/alchemy/shared/utils/dom.ts`; gear cache key consolidated to `baseItemId|aspect|affinity`
- [x] Phase 2a — Battle: `CombatFlags` split into `FirstTimeFlags`/`NextHitFlags`/`BattleLifecycleFlags` (wire shape flat for compat) in `src/lib/battle/types/state-types.ts`, `contentSystemIsolation` extract to `src/lib/content-systems/battle-content.ts` (wildwood crystal→gold rule), damage pipeline already collapsed via `amount-helpers.ts` + exhaustive `Record<DamageType,…>` + Option B `equalTo*`, crit via `getBattleRng` preserved
- [x] Phase 2b — Content: effect registry single-source `BATTLE_CARD_EFFECT_KINDS` derived from `TEMPLATE_EFFECT_DEFINITIONS` in `src/lib/game-data/effects/kinds.ts`, builder collapse via `effectsCard` generic + `CONSUME_DESCRIPTION_LINE` helper (remaining bespoke prose kept), manifest grouping via `talent-pool-definitions.ts`
- [x] Phase 2c — Validation/balance: gear cache key fix, `play-policy` chance `probability/100` → `probability` (fraction) fix, `simulateBatch`/`simulateBatchSummary` unified via `runBatchInternal` in `src/lib/balance/simulator-batch.ts`
- [x] Phase 3 — Assets/screens: asset pipelines table-driven via `scripts/optimize-pipelines.mjs` + `scripts/prepare-assets.mjs` `Promise.allSettled` concurrency, glob manifest via `allGameArt` eager import (`vite.config.ts`), shop routes already deduplicated via `createShopScreenRoute` factory
- [x] Phase 2c+ — Code review fixes (2026-08-27): io dead enum removed, empty-collection clone, shop route displayName, stop-dev-server vanished-PID handling, `simulateBatchSummary` doc, codec-registry `satisfies`
- [x] Final verification: `typecheck:all` ✓, `lint` ✓, `docs:check` ✓, `lint:boundaries` ✓, `effects-registry` + `battle` 854 tests ✓; full `lint:ci` now passes (deferred phases resolved)

## Notes

- Dirty tree at start had ~57 modified/untracked files — preserve in-flight work.
- Architect skill for any cross-boundary contract change (flags, codecs, kinds).
- Pacing intent stays invisible to player; tuning in `src/lib/game-constants/combat-rules.ts`.
- Mystery fallback stays generous by default; make explicit `fallback: "any-unowned"` per event.
- Node latest-stable only; Steam updates before launch.
- Keep durable policy in canonical owners (`docs/ARCHITECTURE.md`, `docs/WORKFLOWS.md`, `docs/REFERENCE.md`, `BATTLE_HANDLERS.md`, `MIGRATIONS.md`) at handoff.
