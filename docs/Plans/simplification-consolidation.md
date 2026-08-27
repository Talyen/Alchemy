---
status: active
updated: 2026-08-27
---

# Simplification & Consolidation

## Objective

Elegant, simple code: reduce over-engineering, duplication, and accidental complexity across battle, persistence, UI/motion, content, and tooling. Keep gameplay intent (hidden fight pacing ~44% max both-sides comeback+clock, generous mystery fallback, latest Node) while making the implementation's "right shape" obvious. Ship as phased commits.

Decisions locked 2026-08-27: (1) pacing keep as-is, document only (2) mystery fallback always generous but make explicit per-event (3) Node engines bump `>=22` → `>=24` (4) single plan, phased commits.

## Plan

- [ ] Phase 0 — Tooling/CI: engines bump, docs sync, `change-routes.mjs` split, `verify-changed` parallelize, dep-cruiser single-source, knip/vitest coverage fix, script hardening
- [ ] Phase 1a — Motion/tooltip: single fade primitive, fix render-state bug, unify delays, share observers, fix placement coords
- [ ] Phase 1b — Persistence: pure serialize, RNG out of Zod transform, tombstone unify, save-write chain simplify, codec single-source, store-helpers delete
- [ ] Phase 1c — Shared UI: TiltSurface rAF batch + demote polymorphism, tile + shine consolidation, plasma lifecycle share, slice memo
- [ ] Phase 2a — Battle: `CombatFlags` split, damage pipeline collapse (gear frozen inline, block-scaled unify), `contentSystemIsolation` extract, crit wiring, pacing docs/test
- [ ] Phase 2b — Content: effect registry single-source (`kinds.ts` generated), builder collapse, manifest grouping
- [ ] Phase 2c — Validation/balance: parity single pass, gear generation unify + fix duplicate names + cache key, `play-policy` chance fix, `simulateBatch` unify, workerize `report-run`
- [ ] Phase 3 — Assets/screens: glob manifest, shop route inline, prepare-assets concurrency
- [ ] Final verification: `npm run verify:changed`, `npm run lint:ci`, `npm run test`, `npm run docs:check:final` then archive

## Notes

- Dirty tree at start had ~57 modified/untracked files — preserve in-flight work.
- Architect skill for any cross-boundary contract change (flags, codecs, kinds).
- Pacing intent stays invisible to player; tuning in `src/lib/game-constants/combat-rules.ts:55`.
- Mystery fallback stays generous by default; make explicit `fallback: "any-unowned"` per event.
- Node latest-stable only; Steam updates before launch.
- Keep durable policy in canonical owners (`docs/ARCHITECTURE.md`, `docs/WORKFLOWS.md`, `docs/REFERENCE.md`, `BATTLE_HANDLERS.md`, `MIGRATIONS.md`) at handoff.
