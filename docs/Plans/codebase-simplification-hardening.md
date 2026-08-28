---
status: active
updated: 2026-08-28
---

# Codebase Simplification & Hardening

## Objective

Reduce over-engineering, fix accidental inconsistencies and silent data-loss paths, and consolidate duplication — without changing player-visible semantics or introducing hitches — across stores, battle, routing/run-flow, scripts/CI/build, shared UI/config, and validation.

## Plan

### Initiative 1 — Save persistence hardening (correctness)

- [x] Fix storage/io coalescing double-write and saveAlchemySaveDataForExit isClearPending drop; add Array.isArray guard and gold repair warning.
- [x] Replace silent Zod catch in save-data schema with explicit collectSaveRepairWarnings diff so gold zeroing logs.
- [x] Guard persistence Object.assign envelope overwrite with deny list; make codec-registry shim re-export persistence only.
- [x] Keep flush-save live-read path via buildAlchemySaveDataFromStores.
- [x] Add NaN/Infinity guards via clampHealth fallback.
- [ ] Add SaveWriteQueue coalescing unit tests (deferred to follow-up).

### Initiative 2 — Routing & run-flow consistency

- [x] Keep META_AND_RUN_RETURN_DESTINATIONS with LABYRINTH_MAP <-> DESTINATION symmetric (reverted over-narrowing after COLLECTION→BATTLE test failure).
- [x] Make LABYRINTH_MAP <-> DESTINATION symmetric.
- [ ] Derive getRunPhase from committed battle hasActiveBattle (left as hasActiveBattle arg; static fallback correct for recovery).
- [x] Wrap commitDestinationProgress in cancel-guaranteed try/finally.
- [ ] Consolidate rewards/destinations RNG ordering via getVictoryRngs (deferred; current ordering deterministic).
- [x] Award Wildwood pendingMaterials and clear pendingCharacterId on park.

### Initiative 3 — Run-state port lattice simplification

- [x] Collapse 4 write ports to 2 canonical owners (write-port-run canonical for battle, write-port-session canonical for profile) with deprecated re-export shims; barrel still re-exports via run-session-write-port.
- [x] Inline selectRunFields generic into explicit per-port selectors (ContentNavigationRunPort / RunOrchestrationPort).
- [x] Merge encode-shops into run-resume-codec single resume boundary (SHOP_ENCODERS map now in codec); encode-interrupted-flow kept separate (213 lines) to avoid 460-line monolith.

### Initiative 4 — Battle engine cohesion & arithmetic

- [ ] Merge enemy turn 4 files to 2; merge status ticks into status-ticks + status-helpers (deferred; fragmentation kept but documented).
- [x] Add finite guard in clampHealth / applyPlayerCombatDamage.
- [x] Smooth fight-pacing SPAN_EPSILON cliff 0.0001→0.001.
- [x] Fix twinCasting deterministic findIndex to use pickRandom via battle RNG (seeded eligibleIndices pick).
- [ ] Document equalTo bypass with regression test (existing comment in damage-calc).

### Initiative 5 — Scripts, CI, assets & build

- [ ] One optimize-pipeline dispatching asset/sound/music; one audit entry with subcommands sharing change-routes (registry already exists; constants deduplicated minimally).
- [x] Add check-bundle-budget gate (index <600k, total js <1.55M) replacing vite chunkSizeWarningLimit silence; keep no-React.lazy eager invariant (hitch-safe, 572k/1.47M observed).
- [x] Collapse 5 gated E2E jobs into reusable workflow_call (.github/workflows/gated-e2e.yml) + add bundle-budget job in ci.yml (235→45 lines).

### Initiative 6 — Shared UI/config & validation dedup

- [ ] Single visual-tokens for plasma/shine palettes (intentionally not merged — plasma derives from shine first stop; separate tables correct).
- [ ] Consolidate collection-tile variants via variant prop; share one description formatter (kept split: builder pure data vs UI tokenizer vs runtime adjuster — each layer intentional).
- [ ] Inline talent-icons; merge normalize-active-run-data legacy shim into Zod defaults (deferred).

### Initiative 7 — Test speed/coverage

- [ ] Expand stryker config to damage-riders,status-ticks,card-play (nightly only); add unit tests for queue/pacing/twinCasting (deferred).
- [ ] Ratchet vitest thresholds after gap closure; keep screens E2E-only.

## Notes

- Hitch-free constraint: no React.lazy on route screens; vite code splitting stays eager, independently cached.
- Mutation expansion nightly-only to avoid lint:ci slowdown.
- Each initiative verifies via verify:changed plus lint:ci plus targeted tests.
