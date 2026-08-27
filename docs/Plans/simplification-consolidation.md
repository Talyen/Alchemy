---
status: active
updated: 2026-08-27
---

# Simplification & Consolidation

## Objective

Elegant, simple code: reduce over-engineering, duplication, and accidental complexity across battle, persistence, UI/motion, content, and tooling. Keep gameplay intent (hidden fight pacing ~44% max both-sides comeback+clock, generous mystery fallback, latest Node) while making the implementation's "right shape" obvious. Ship as phased commits.

Decisions locked 2026-08-27: (1) pacing keep as-is, document only (2) mystery fallback always generous but make explicit per-event (3) Node engines bump `>=22` → `>=24` (4) single plan, phased commits.

## Plan

- [x] Phase 0 — Tooling/CI: engines kept at `>=24`, docs sync, knip entry fix, vitest coverage exclude dead pattern removed (remaining: `change-routes.mjs` split, `verify-changed` parallelize, dep-cruiser single-source deferred)
- [x] Phase 1a — Motion/tooltip: single fade primitive made configurable, fixed `setState` during render anti-pattern, tooltip fade now uses `resolveGameDelay` (animation-disabled aware)
- [x] Phase 1b — Persistence: `serializeSaveSnapshot` made pure (`now` param), `applySaveWritePolicy` resets on `corrupt` too, `saveAlchemySaveData` drains `coalescedSave` on `writesDisabled` (RNG-out-of-Zod and full tombstone unify deferred)
- [x] Phase 1c — Shared UI: verified tilt already rAF-batched via `src/features/alchemy/shared/utils/dom.ts`; gear cache key consolidated to `baseItemId` (tile/shine/plasma consolidation deferred)
- [ ] Phase 2a — Battle: `CombatFlags` split, damage pipeline collapse, `contentSystemIsolation` extract, crit wiring — deferred, needs `architect` skill (pacing already documented in `src/lib/game-constants/combat-rules.ts`)
- [ ] Phase 2b — Content: effect registry single-source (`kinds.ts` generated), builder collapse, manifest grouping — deferred
- [x] Phase 2c — Validation/balance: gear cache key fix, `play-policy` chance `probability/100` → `probability` (fraction) fix, `simulateBatch`/`simulateBatchSummary` unified via `runBatchInternal` (parity single-pass and workerize deferred)
- [ ] Phase 3 — Assets/screens: glob manifest, shop route inline, prepare-assets concurrency — deferred
- [x] Final verification: `typecheck`/`lint`/`docs:check`/`format:check` passed; full `lint:ci` blocked only by deferred phases, `test` pending final gate

## Notes

- Dirty tree at start had ~57 modified/untracked files — preserve in-flight work.
- Architect skill for any cross-boundary contract change (flags, codecs, kinds).
- Pacing intent stays invisible to player; tuning in `src/lib/game-constants/combat-rules.ts`.
- Mystery fallback stays generous by default; make explicit `fallback: "any-unowned"` per event.
- Node latest-stable only; Steam updates before launch.
- Keep durable policy in canonical owners (`docs/ARCHITECTURE.md`, `docs/WORKFLOWS.md`, `docs/REFERENCE.md`, `BATTLE_HANDLERS.md`, `MIGRATIONS.md`) at handoff.
