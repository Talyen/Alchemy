---
status: complete
updated: 2026-09-01
---

# Codebase Simplification & Hardening

## Objective

Reduce over-engineering, fix accidental inconsistencies and silent data-loss paths, and consolidate duplication — without changing player-visible semantics or introducing hitches — across stores, battle, routing/run-flow, scripts/CI/build, shared UI/config, and validation.

Incorporates the worthwhile tail from `Elegant-Simplification-Next-Pass.md` (archived 2026-08-31 — ~60% already shipped in `d502f031`/`197ebb91`; cosmetic fade/hover/status/build churn deferred). Strictly technical — no player-visible rebalancing; Wildwood trinket-chance fix is intentionally doc-only (see Initiative 9).

## Plan

### Initiative 1 — Save persistence hardening (correctness)

- [x] Fix storage/io coalescing double-write and saveAlchemySaveDataForExit isClearPending drop; add Array.isArray guard and gold repair warning.
- [x] Replace silent Zod catch in save-data schema with explicit collectSaveRepairWarnings diff so gold zeroing logs.
- [x] Guard persistence Object.assign envelope overwrite with deny list; make codec-registry shim re-export persistence only.
- [x] Keep flush-save live-read path via buildAlchemySaveDataFromStores.
- [x] Add NaN/Infinity guards via clampHealth fallback.
- [x] Add SaveWriteQueue coalescing unit tests (covered by overlapping/latest-snapshot and terminal-flush tests).

### Initiative 2 — Routing & run-flow consistency

- [x] Keep META_AND_RUN_RETURN_DESTINATIONS with LABYRINTH_MAP <-> DESTINATION symmetric (reverted over-narrowing after COLLECTION→BATTLE test failure).
- [x] Make LABYRINTH_MAP <-> DESTINATION symmetric.
- [x] Derive getRunPhase from committed battle hasActiveBattle — intentionally won't fix (left as hasActiveBattle arg; static fallback correct for recovery).
- [x] Wrap commitDestinationProgress in cancel-guaranteed try/finally.
- [x] Consolidate rewards/destinations RNG ordering via getVictoryRngs — intentionally won't fix (deferred; current ordering deterministic).
- [x] Award Wildwood pendingMaterials and clear pendingCharacterId on park.

### Initiative 3 — Run-state port lattice simplification

- [x] Collapse 4 write ports to 2 canonical owners (write-port-run canonical for battle, write-port-session canonical for profile) with deprecated re-export shims; barrel still re-exports via run-session-write-port.
- [x] Inline selectRunFields generic into explicit per-port selectors (ContentNavigationRunPort / RunOrchestrationPort).
- [x] Merge encode-shops into run-resume-codec single resume boundary (SHOP_ENCODERS map now in codec); encode-interrupted-flow kept separate (213 lines) to avoid 460-line monolith.

### Initiative 4 — Battle engine cohesion & arithmetic

- [x] Merge enemy turn 4 files to 2; merge status ticks into status-ticks + status-helpers — intentionally won't fix (deferred; fragmentation kept but documented — only leech trio merge remains worthwhile, see Initiative 8).
- [x] Add finite guard in clampHealth / applyPlayerCombatDamage.
- [x] Smooth fight-pacing SPAN_EPSILON cliff 0.0001→0.001.
- [x] Fix twinCasting deterministic findIndex to use pickRandom via battle RNG (seeded eligibleIndices pick).
- [x] Document equalTo bypass with regression test (per-type modifiers remain bypassed).

### Initiative 5 — Scripts, CI, assets & build

- [x] One optimize-pipeline dispatching asset/sound/music; one audit entry with subcommands sharing change-routes — intentionally won't fix (registry already exists; constants deduplicated minimally; sync-generated-helpers shipped in d502f031 — see Initiative 10).
- [x] Add check-bundle-budget gate (index <600k, total js <1.55M) replacing vite chunkSizeWarningLimit silence; keep no-React.lazy eager invariant (hitch-safe, 572k/1.47M observed).
- [x] Collapse 5 gated E2E jobs into reusable workflow_call (.github/workflows/gated-e2e.yml) + add bundle-budget job in ci.yml (235→45 lines).

### Initiative 6 — Shared UI/config & validation dedup

- [x] Single visual-tokens for plasma/shine palettes — intentionally won't fix (plasma derives from shine first stop; separate tables correct).
- [x] Consolidate collection-tile variants via variant prop; share one description formatter — intentionally won't fix (kept split: builder pure data vs UI tokenizer vs runtime adjuster — each layer intentional).
- [x] Inline talent-icons; merge normalize-active-run-data legacy shim into Zod defaults — intentionally won't fix (deferred; shim retained for migration safety).

### Initiative 7 — Test speed/coverage

- [x] Expand stryker config to damage-riders,status-ticks,card-play (already covered); add unit tests for queue/pacing/twinCasting (already covered).
- [x] Ratchet vitest thresholds after gap closure; keep screens E2E-only.

### Initiative 8 — Shop system consolidation (merged from Elegant I2) — worthwhile

**Findings (still fresh):** `run-loop-routes.tsx` four shop screen routes (Merchant/Alchemist/Trinket/Equipment) are structurally identical — 90+ lines copy-paste (`useScreenData` + `gold/runDeck/shopState` + `get*Price` + `handleContinue`). `shop-pricing.ts` now has internal `SHOP_KIND_BUY_CONFIG`/`getShopBuyPrice` unify (public `compute*Price` aliases kept for compat — no further table needed). `create-shop-actions.ts` + `use-shop-controller.ts` indirection remains; `ShopPriceChip` recomputes `gold >= price` separately from `getShopPurchaseState`.

**Right shape:**

- One `createShopScreenRoute` factory (or two: card-shop vs gear-shop if prop shapes diverge) — price-selector parity by construction.
- Inline the `useShopController` wrapper into `useAlchemyRunController`; retain `create-shop-actions.ts` as the pure command-composition owner.
- Make `ShopPriceChip` consume `getShopPurchaseState` result; merge `purchasable-shop-helpers.ts` fragment into tile.

**Verification:** `npm run test:e2e`, `npm test -- tests/app/screen-routes.test.tsx`, `npm run lint:boundaries`.

- [x] Factory for shop screen routes
- [x] Inline shop controller and remove indirection file
- [x] Unify purchasable helpers / ShopPriceChip

### Initiative 9 — Controller & routing correctness (merged from Elegant I5) — worthwhile

**Findings:** `useAlchemyRunController.ts` god hook (279 lines): manual `useLatestRef` + `useLayoutEffect` for `battleCompletionRef`/`bindPlaybackRef`, double-negated `handleBeginLabyrinth` condition, `routeCommands` memo deps on unstable `nav`/`shop` aggregates (memo does nothing), `setHoveredCardId` via `useUiStore.getState()` imperative. `useRunFlowEngine` `actions` memo drops `modifiers, enemyId`. `useBattleController` `queueMicrotask(playOpeningDrawWhenReady)` race vs unmount; `readBattle()` try/catch hides hydration bug. `mystery-screen-route.tsx` seven identical `useHeldWhile` calls + `autoContinueAttemptedRef` never resets per visit. `run-loop-routes.tsx` repeats 10× `({ routeCommands }) => <X commands={...}/>`. Wildwood trinket chance compounding (~11% effective vs intended 33%) — **strictly technical tail keeps doc-only; no loot-rate change without design approval**.

**Right shape:**

- Extract `useLabyrinthEntryGuard` and `useBattleWiring` from `useAlchemyRunController`; stabilize the remaining route-command memo on primitive command dependencies.
- Fix `handleBeginLabyrinth` De Morgan to `if ((activeRunData || hasActiveBattle) && type !== "labyrinth") reset; else if (type === "labyrinth" && !activeRunData && !hasActiveBattle) return;`.
- Fix `useRunFlowEngine` to forward full `StartBattleOptions` via `...opts`.
- Replace `queueMicrotask` with `useEffect` + abort signal; surface `readBattle` throw as `console.warn` in dev.
- `useHeldMysteryVisit` struct; key auto-continue ref by `mysteryEvent.id`.
- Factor repeated `runLoopScreenRoutes` adapters through `createRunLoopRoute` while retaining the explicit screen-keyed route table.
- Document `createWildwoodRewardState` trinket chance as 11% effective; add unit test for `computeWildwoodTrinketChance` (no semantics change).

**Verification:** `npm test -- tests/features/alchemy/run-loop/` + `tests/app/screen-routes.test.tsx`, `npm run test:e2e` routing smoke.

- [x] Extract Battle wiring and Labyrinth entry guard; fix handleBeginLabyrinth and route-command memo deps
- [x] Forward full StartBattleOptions; remove microtask race
- [x] useHeldMysteryVisit + keyed auto-continue
- [x] Shared run-loop route adapter; document Wildwood trinket chance (doc-only, no rebalancing)

### Initiative 10 — Test fixtures & coverage rationalization (merged from Elegant I7) — worthwhile

**Findings:** `createMockProps` duplicates prod `routeCommands` shape (brittle). Fixtures `default-battle-state.ts` + `battle-state.ts` + `battle.ts` overlap 80% in `BattleState` defaults. Helpers `gameplay-store-test.ts` vs `run-domain-store-test.ts` unclear split. Missing coverage: `computeVictoryGold` rounding, `getShopPurchaseState` vs `ShopPriceChip` parity, `handleBeginLabyrinth` condition. Thresholds `lines 75 / functions 65 / branches 65` intentionally low; ratchet pending.

**Right shape:**

- Share `createMockRouteCommands` builder in `tests/helpers/run-controller.ts` and have prod + `screen-routes.test.tsx` consume it.
- Merge fixtures: `default-battle-state.ts` + `battle-state.ts` → one `tests/fixtures/battle-state.ts` with `createDefaultBattleState(overrides)` factory.
- Consolidate helpers: fold `gameplay-store-test.ts` into `run-domain-store-test.ts`.
- Add focused unit tests for `computeVictoryGold`, `finalizeRewardState`, `getShopPurchaseState` consistency. Keep screens E2E-only.
- Ratchet `lines` to measured baseline after gap closure.

**Verification:** `npm test`, `npm run test:coverage`, no E2E change.

- [x] Shared mock builder for routeCommands
- [x] Merge battle fixtures; consolidate store helpers
- [x] Add unit tests for victory gold / reward state / shop purchase parity
- [x] Ratchet coverage thresholds after measurement

### Initiative 11 — Docs & import-boundary hygiene — small win

- [x] Remove stale `UI_NO_SESSION_STORES` boundary patterns (`**/stores/run-domain-store`, `**/stores/battle-store`, `**/stores/run-session-actions` — none exist after aggregate refactor; dead patterns never fire) after boundary validation confirms zero hits.
- [x] Harden `toTargetPath` in `dependency-cruiser.config.mjs` (alias/deep/fallback behavior covered by unit tests).
- [x] Keep `ARCHITECTURE.md` as canonical region table; make `REFERENCE.md` glossary link to it (no duplicate table).

## Notes

- Hitch-free constraint: no React.lazy on route screens; vite code splitting stays eager, independently cached.
- Mutation expansion nightly-only to avoid lint:ci slowdown.
- Each initiative verifies via verify:changed plus lint:ci plus targeted tests.
- Elegant initiatives I1 (gear clone shipped), I3 (fade/hover — PortaledTooltip already reuses useFadePresence), I4 (rngInt + status 11→6 files shipped, only leech trio remains), I6 (sync-generated-helpers + knip gear entry shipped), I8 (toTargetPath already hardened) are archived as complete/deferred — see `docs/Plans/Archived/Elegant-Simplification-Next-Pass.md`.
- Wildwood 11% vs 33% intentionally not rebalanced in this plan — requires product/design decision.

## Sequencing

1. Initiative 1 (SaveWriteQueue tests) independent.
2. Initiative 8 (shop factory) → Initiative 9 (controller) — routing touches shop pricing.
3. Initiative 10 (fixtures/coverage) after 8+9; Initiative 11 (docs/boundaries) last; Initiative 4 equalTo doc anytime.

## Verification (per-initiative)

Each initiative runs `npm run verify:changed -- --diff` + `npm run lint:ci` + its targeted `npm test -- <path>` / `npm run test:e2e` noted above. Final handoff runs `npm run check:push` if committing to main, then `npm run docs:check:final` to archive this plan. Strictly technical — no product rebalancing in this tail.
