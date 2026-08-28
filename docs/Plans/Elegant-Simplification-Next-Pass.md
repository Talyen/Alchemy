---
status: active
updated: 2026-08-28
---

# Elegant Simplification — Next Pass

## Objective

Reduce accidental complexity, fix latent correctness/performance gaps, and consolidate duplicated subsystems — while preserving the elegant, minimal shape that `ARCHITECTURE.md` mandates — across stores/persistence, battle, shop/routing, shared UI, and scripts/build. No player-visible semantics change; no new Tech Stack. Each initiative is independently shippable.

Discovery: random-entry exploration (two parallel sub-agents) + manual spot-checks of `src/features/alchemy/shared/stores/*`, `src/lib/battle/*`, `src/lib/game-data/*`, `src/lib/game-constants/*`, `src/lib/gear/*`, `src/app/screen-routes/*`, `src/features/alchemy/shared/ui/*`, `src/features/alchemy/shell/*`, `src/features/alchemy/run-loop/*`, `scripts/*`, `vite/vitest/eslint/knip` configs, against the dirty tree at `3a5dc96e`.

Existing active plan `codebase-simplification-hardening.md` is preserved. This plan covers the _next_ sizable gaps it left open.

## Plan

### Initiative 1 — Persistence & store correctness (bug fixes)

**Findings (evidence-backed):**

- `src/features/alchemy/shared/stores/gear-store.ts` `gearPersistenceCodec.encode` returns live references (`inventories`, `loadouts`, `ownedTrinketIds`, `equippedTrinkets`, `craftingCurrencies`). Autosave debounces 500 ms / 2500 ms (`src/lib/game-constants/storage.ts`); a mutation before flush mutates the snapshot — silent loss-of-atomicity bug. `profile-store.ts:35-40` correctly clones via `cloneProfileSaveFields`.
- `src/features/alchemy/shared/stores/run-session-read-port.ts` and `gear-store.ts:75-84` / `profile-store.ts:55-67` return shallow copies with comment "treat as read-only" but nested `shopState`, `battleState` remain live references — accidental mutation possible. No `Object.freeze` in dev, no lint guard.
- `src/features/alchemy/shared/stores/gold-purse.ts` bidirectional sync (`syncPurseFromBattleGold` / `syncBattleGoldFromPurse`) is called from 3 battle commits (`write-port-run.ts:228,291,304`) plus `run-meta-rebind.ts:54`. Missing one path desyncs HUD vs save. Also `addProfileGold` hides `getGoldMultiplier * Math.floor` inside a setter (`write-port-run.ts:25-28`).
- Stale deprecated shims `knip.config.js:66-69` (`encode-shops.ts`, `write-port-battle.ts`, `write-port-profile.ts`) still on disk or ignored rather than deleted.

**Right shape:**

- Clone gear encode like profile does (`[...arr]` / `{...obj}` per field; `structuredClone` is overkill — same pattern as profile). Add regression test: mutate after encode must not affect encoded value.
- Freeze read-port return in `__DEV__` (or at least deep-freeze via `Object.freeze` shallow + dev-only assert) and lint `alchemy/no-direct-aggregate-write` already covers stores; add dev guard.
- Document `addProfileGold` multiplier explicitly: rename to `addScaledGold` or keep name but add JSDoc + single call site note; no derivation needed — setter is correct but surprising.
- Delete deprecated shims (after `verify:changed` confirms no import). Remove knip ignores for them.

**Verification:** `npm test -- tests/features/alchemy/shared/stores/profile-settings-stores.test.ts tests/features/alchemy/shared/storage/persistence-coordinator.test.ts` + new `gear-store-encode-clone.test.ts`. `npm run lint:ci` (boundaries + knip must go clean).

- [ ] Fix gear encode clone bug and add regression test
- [ ] Harden read-port shallow-copy contract (dev freeze + doc)
- [ ] Delete deprecated shims and knip ignores
- [ ] Verify persistence round-trip and autosave debounce

### Initiative 2 — Shop system consolidation (≈120 lines removed)

**Findings:**

- `src/app/screen-routes/run-loop-routes.tsx` four shop screen routes (`MerchantShopScreenRoute`, `AlchemistShopScreenRoute`, `TrinketShopScreenRoute`, `EquipmentShopScreenRoute`) are structurally identical (useScreenData hook + `gold/runDeck/shopState` + `get*Price` + `handleContinue`). 90+ lines of copy-paste.
- `src/features/alchemy/run-loop/shop/shop-pricing.ts` six `compute*Price` wrappers over one `Math.max(0, base - discounts)` with different base lookups.
- `src/features/alchemy/run-loop/shop/create-shop-actions.ts` trivial `Record<ShopKind, () => void>` dispatch + `src/features/alchemy/shell/use-shop-controller.ts` 14-line memo wrapper — indirection for lint boundaries only.
- `src/features/alchemy/shared/ui/purchasable-shop-helpers.ts` 9-line fragment + `ShopPriceChip` recomputes `gold >= price` separately from `getShopPurchaseState` (`purchasable-shop-tile.tsx:8-9`).

**Right shape:**

- One `createShopScreenRoute` factory: `factory(useHook, Screen, priceSelector, actionsKey)` — or two factories (card-shop vs gear-shop) if prop shapes diverge. Keeps price-selector parity by construction.
- Collapse pricing to `getShopPrice(kind, ctx)` with base-price table; keep named aliases as `export const getMerchantCardPrice = (ctx) => getShopPrice("merchant", ctx)` if external contracts need them (no breaking change).
- Inline `useShopController` into `useAlchemyRunController` (`useMemo(() => createShopActions(...), [talentEffects, homesteadEffects])`) and remove `create-shop-actions.ts` dispatch file (callers use object directly).
- Make `ShopPriceChip` consume `getShopPurchaseState` result; delete `purchasable-shop-helpers.ts` fragment (merge into tile).

**Risks:** Factory must preserve per-shop `handleContinue` wiring and refresh-price memo. No lazy.

**Verification:** `npm run test:e2e`, `npm test -- tests/app/screen-routes.test.tsx`, `npm run lint:boundaries`.

- [ ] Factory for shop screen routes
- [ ] Unified shop pricing entry + deprecated aliases
- [ ] Inline shop controller and remove indirection file
- [ ] Unify purchasable helpers / ShopPriceChip

### Initiative 3 — Shared UI fade / hover / modal unification

**Findings:**

- Fade stack is 3 layers: `useFadePresence` (`shared/ui/fade-presence.ts:38-62`), `useSequentialFadeSwap` (`use-sequential-fade-swap.ts:12-45`), `FadeSlot` (`fade-slot.tsx:13-48`), plus inline fade in `portaled-tooltip.tsx:60`. Comments admit layering. Opportunity to make `PortaledTooltip` reuse `FadeSlot`/swap rather than third inline.
- Hover: `useTileHoverPopup` (`use-tile-hover-popup.ts:13-56`) vs `useHoverVisible` (`use-hover-visible.ts:6-21`) do the same job with different timeout handling (`TOOLTIP_FADE_OUT_MS`). `card-button.tsx:67-128` adds hand-specific `HAND_HOVER_HANDOFF_MS` + `closest("[data-hand-card]")` guard leaking into generic button.
- Modal escape: `useModalEscapeDismiss` (`use-modal-escape-dismiss.ts:15-36`), `useCaptureEscapeCancel` (`use-capture-escape-cancel.ts:1-10`), `ModalOverlayShell` (`modal-overlay-shell.tsx:44-51`) — one is `active ? onCancel : noop` wrapper for a single callsite.
- Collection tiles: `TrinketTile` vs `GearTile` (`collection-art-tiles.tsx:48-154`) ~90 lines of near-duplicate `InteractiveArtTile` wrapper; shine/plasma palette triple (`shine-palettes`, `gear-shine`, `plasma-palettes`) with mixed callers.
- Pagination: `PaginationControls` vs `FlankingPagination` (`navigation.tsx:7-105`) duplicate button + Chevron + disabled logic with inconsistent a11y (one returns `null`, one `invisible`).

**Right shape:**

- One fade primitive: keep `useFadePresence` as the boolean primitive, derive `useSequentialFadeSwap` from it, make `FadeSlot` the sole wrapper, and make `PortaledTooltip` consume `useFadePresence` with `fadeOutMs=160` via same primitive (or directly use `FadeSlot` if portaled content warrants). Delete inline timeout in tooltip.
- One hover hook: `useHoverDisclosure` with `delayHideMs` param (defaults to `TOOLTIP_FADE_OUT_MS`), replacing both. Keep `HAND_HOVER_HANDOFF_MS` as a `card-button` local, not generic.
- Inline `useCaptureEscapeCancel` at its single callsite; keep `useModalEscapeDismiss` as the primitive.
- Extract `BaseCollectionTile` (props: `art`, `shineColor`, `plasmaColor`, `popup`) and `PageButton` component; document palette choice (shine = border, plasma = background) in `shared/config/game-data-catalog.ts` header.

**Verification:** Visual: `npm run test:e2e -- tests/draw-discard-animations.spec.ts` (animation specs must not break). Unit: no logic change.

- [ ] Unify fade stack (tooltip reuses primitive, no third inline)
- [ ] Single hover disclosure hook; isolate hand-specific timer
- [ ] Inline capture-escape wrapper; keep primitive
- [ ] Extract BaseCollectionTile + PageButton; document palette

### Initiative 4 — Battle engine cohesion & arithmetic hygiene

**Findings:**

- `damage-calc.ts:85-217` eight per-type handlers (`applyPhysicalScaling`, `applyHoly…` etc.) each `+ flat + scalePercent(...)` — table-driven `Record<DamageType, {flatKey, scaleKey}>` would cut ~100 lines, but current explicit handlers are intentionally readable for tuning. Keep handlers, but extract shared `+ flat + gearFlat` prefix into helper.
- `status-*` explosion: 11 files (`status-ticks`, `status-helpers`, `status-forge`, `status-player`, `status-cc`, `status-stun-resolve`, `damage-status-riders`, `damage-rider-leech`, `leech-heal`, `dot-resolve`, etc.). `leech-heal` + `damage-rider-leech` + `damage-status-riders` all touch leech. Import depth hurts discoverability.
- Effect registry duplication: `lib/game-data/effects/registry.ts:42-68` vs `lib/battle/effect-handlers/registry.ts:42-68` list same 26 kinds; adding a kind requires two edits (guarded only by `satisfies` + runtime test).
- `Math.floor` ban: `src/lib/battle/card-play.ts` uses `Math.floor(rng()*n)` for RNG index pick with eslint-disable comment. Rule is too broad (bans all `Math.floor` in battle, but index pick is not combat arithmetic).
- `draw.ts:43` `nextDeck.shift()` O(n) per draw (trivial for 4 cards but inconsistent with `takeRandomItem` style).
- `enemy-turn.ts:135-142` `afterAttackState!` non-null assert; `EnemyPostTickMode = "attack"|"skip"` stringly typed (`enemy-turn.ts:72-97`).

**Right shape:**

- Consolidate status into `src/lib/battle/` subdir with barrel (`status-helpers` + `status-ticks` split retained, but leech trio merged into `status/leech.ts`). No behavior change, just directory + re-exports for compat.
- Single effect-kind source: derive `EFFECT_APPLY_BY_KIND` keys from `TEMPLATE_EFFECT_DEFINITIONS` array or share a `EFFECT_KINDS` const; build-time `satisfies` remains.
- Provide `rngInt(rng, n): number` helper (`Math.floor(rng()*n)`) in `src/lib/run-rng.ts` and allow it via eslint `allow` pattern; replace `Math.floor` disable comments with `rngInt`.
- Replace `shift()` with index pointer or `pop()` after shuffle (shuffle already randomizes; `pop` is O(1) equivalent).
- Replace `EnemyPostTickMode` with discriminant object or keep string but add exhaustiveness check; remove `!` assert by making `afterAttackState` optional in resolution type and handling absent case.

**Verification:** `npm test -- tests/lib/battle/` (all 20+ files), `npm run lint` (Math.floor rule), balance sim `npm run balance:sim` smoke.

- [ ] Consolidate status modules into `battle/status/` barrel; merge leech trio
- [ ] Single source for effect kinds (derive handler keys)
- [ ] Add `rngInt` helper and replace `Math.floor(rng()*n)` disables
- [ ] Replace `shift` with `pop`/index; remove `!` assert; type post-tick mode

### Initiative 5 — Controller & routing simplification (correctness)

**Findings:**

- `src/features/alchemy/shell/use-alchemy-run-controller.ts` god hook (279 lines): manual `useLatestRef` + `useLayoutEffect` wiring for `battleCompletionRef` / `bindPlaybackRef`, double-negated `handleBeginLabyrinth` condition (`116-124`), `routeCommands` memo deps on `nav`/`shop` aggregates (never stable — memo does nothing), `setHoveredCardId` via `useUiStore.getState()` imperative.
- `src/features/alchemy/shell/use-run-flow-engine.ts` `actions` memo drops `modifiers, enemyId` from `startBattle` wrapper.
- `src/features/alchemy/shell/use-battle-controller.ts` three refs + `queueMicrotask(playOpeningDrawWhenReady)` race vs unmount; `readBattle()` try/catch hides hydration bug.
- `src/app/screen-routes/mystery-screen-route.tsx` seven identical `useHeldWhile` calls — should be `useHeldMysteryVisit(r)` struct; `autoContinueAttemptedRef` never resets per visit id.
- `src/app/screen-routes/run-loop-routes.tsx` runLoopScreenRoutes table repeats 10× `({ routeCommands }) => <X commands={routeCommands.runLoop.…}/>`.
- `src/features/alchemy/run-loop/navigation/reward-flow.ts` wildwood trinket chance compounding (~11% effective vs intended 33%) and boon filtering inconsistency.

**Right shape:**

- Split `useAlchemyRunController` into `useLabyrinthEntryGuard`, `useRouteCommands` (stable deps on primitives), `useBattleWiring` (encapsulates `bindPlayback` + `battleCompletionRef`). Fix `handleBeginLabyrinth` De Morgan to `if ((activeRunData || hasActiveBattle) && type !== "labyrinth") reset; else if (type === "labyrinth" && !activeRunData && !hasActiveBattle) return;`.
- Fix `useRunFlowEngine` to forward full `StartBattleOptions` via `...opts`.
- Replace `queueMicrotask` with `useEffect` + abort signal; surface `readBattle` throw as `console.warn` in dev instead of silent return.
- `useHeldMysteryVisit` hook returning struct; key auto-continue ref by `mysteryEvent.id`.
- Loop `runLoopScreenRoutes` from `SCREEN_ROUTE_TABLE` constant; minor DRY.
- Clarify `createWildwoodRewardState` trinket chance: document 11% effective vs 33% intended; decide and add unit test for `computeWildwoodTrinketChance`.

**Verification:** `npm test -- tests/features/alchemy/run-loop/` + `tests/app/screen-routes.test.tsx`, `npm run test:e2e`, `npm run test:e2e` smoke for routing.

- [ ] Split god hook; fix handleBeginLabyrinth and memo deps
- [ ] Forward full StartBattleOptions; remove microtask race
- [ ] useHeldMysteryVisit + keyed auto-continue
- [ ] Table-driven runLoopScreenRoutes; fix wildwood trinket chance or document

### Initiative 6 — Scripts & build consolidation

**Findings:**

- `scripts/prepare-assets.mjs`, `optimize-assets.mjs`, `optimize-pipelines.mjs`, `sync-assets.mjs`, `sync-gear-art.mjs`, `sync-version-metadata.mjs`, `sync-steam-appid.mjs` — overlapping concerns + duplicated `if (process.argv.includes("--check")) + writeTextIfChanged` boilerplate per sync script.
- `vite.config.ts:86-118` `rolldownOptions.codeSplitting.groups` 5 groups with priorities `40,30,10,9,8,7` — vendor catches `game-data`'s `zod` import via priority 10 vs 9; subtle but correct today. `plugins` order (`tailwind` + `react` + conditional `babel`) is load-bearing for React Compiler.
- `vitest.config.ts:33-40` `coverage.exclude` excludes `screens/**` (intentional E2E-only) but lint:ci still checks them — consistent, just document.
- `knip.config.js:36-70` 22 ignores; `entry` lists `game-data`/`battle`/`run-flow` barrels but not `gear` barrel.
- `package.json` scripts: `check:ship`, `test:e2e` variants with `cross-env` flags — discoverable but `scripts/lib/write-text-if-changed.mjs` not reused uniformly.

**Right shape:**

- `makeSyncScript(name, generate)` factory in `scripts/lib/write-text-if-changed.mjs` wrapping `--check` + `writeTextIfChanged` + error handling. Migrate `sync-assets`, `sync-gear-art`, `sync-version-metadata` to it (3-line each). Keep `check:generated` composite.
- No change to vite groups (current 572k/1.47M well under 600k/1.55M budget `scripts/check-bundle-budget.mjs`); add comment documenting priority wins for `zod` case. Move magic `"min-h-[57.78cqh]"` to token in `shared/config/ui-tokens.ts` if present, or `game-constants/ui-motion.ts`.
- Add `gear` to knip `entry`; remove shipped-deprecated ignores after Initiative 1.
- Extract `scripts/lib/vite-aliases.mjs` for `ALCHEMY_SKIP_ASSETS` / `ALCHEMY_SKIP_CHECKER` / `ALCHEMY_ENABLE_CHECKER` validation (single truth).

**Verification:** `npm run check:generated -- --check`, `npm run lint:ci`, `npm run build` + `npm run check:bundle`, `knip --no-config-hints` clean.

- [ ] Sync-script factory and migrate 3 scripts
- [ ] Document vite group priority; tokenize magic min-height
- [ ] Knip entry + env-flags centralization

### Initiative 7 — Test fixtures & coverage rationalization

**Findings:**

- `tests/app/screen-routes.test.tsx` `createMockProps` duplicates prod `routeCommands` shape (brittle; any new field requires test edit though "registers handler for every Screen" already enforces exhaustiveness).
- Fixtures: `tests/fixtures/legacy-saves.ts`, `saves.ts`, `active-run.ts`, `battle.ts`, `default-battle-state.ts`, `battle-state.ts`, `labyrinth-hex-map.ts` — 7 files with 80% overlap in `BattleState` defaults.
- Helpers: `tests/helpers/gameplay-store-test.ts` vs `run-domain-store-test.ts`, `storage-io-test-setup.ts`, etc. — 10+ helpers with unclear split.
- Missing unit coverage: `computeVictoryGold` rounding, `getShopPurchaseState` vs `ShopPriceChip` parity, `useHeldWhile` vs `FadeSlot` interaction, `handleBeginLabyrinth` condition.
- `vitest.config.ts:44-48` thresholds `lines 75 / functions 65 / branches 65` — intentionally low per `Initiative 7` of prior plan; nightly ratchet pending.

**Right shape:**

- Share `createMockRouteCommands` builder in `tests/helpers/run-controller.ts` (or extend existing helper) and have both prod and `screen-routes.test.tsx` consume it. Or make test import `useAlchemyRunController` mock and assert against `ALLOWED_SCREEN_TRANSITIONS`.
- Merge fixtures: `default-battle-state.ts` + `battle-state.ts` → one `tests/fixtures/battle-state.ts` with `createDefaultBattleState(overrides)` factory; deprecate duplicate with re-export shim, then delete.
- Consolidate helpers: fold `gameplay-store-test.ts` into `run-domain-store-test.ts` (or vice versa) — one store mock helper per aggregate region.
- Add focused unit tests for `computeVictoryGold`, `finalizeRewardState`, `getShopPurchaseState` consistency. Keep screens E2E-only.
- Ratchet `lines` to measured baseline after gap closure (measure via `npm run test:coverage`).

**Verification:** `npm test`, `npm run test:coverage`, no E2E change.

- [ ] Shared mock builder for routeCommands
- [ ] Merge battle fixtures; consolidate store helpers
- [ ] Add unit tests for victory gold / reward state / shop purchase parity
- [ ] Ratchet coverage thresholds after measurement

### Initiative 8 — Docs & import-boundary hygiene

**Findings:**

- `docs/ARCHITECTURE.md` aggregate region table duplicates `docs/REFERENCE.md` glossary and `docs/WORKFLOWS.md` task index — three sources for same mapping.
- `eslint/boundaries.js:222-234` `UI_NO_SESSION_STORES` lists stale specifiers (`**/stores/run-domain-store`, `**/stores/battle-store`, `**/stores/run-session-actions`) — none exist after aggregate refactor; dead patterns never fire.
- `dependency-cruiser.config.mjs:15-23` `toTargetPath` fragile helper (`groups.at(-1)` assumes deep glob last) — if fragment order changes, mapping breaks silently. `gameplay-aggregate-is-internal` has no fragments equivalent (comment admits drift risk).
- `docs/WORKFLOWS.md` task index has per-step `File(s)` column requiring manual upkeep when barrels regenerate; `docs/ARCHITECTURE.md` `min-h-[57.78cqh]` token undocumented elsewhere.

**Right shape:**

- Keep `ARCHITECTURE.md` as canonical region table; make `REFERENCE.md` glossary link to it (remove duplicate table, keep glossary terms). Keep task file tables in `WORKFLOWS.md` but generate barrel list from `scripts/sync-assets.mjs` output if possible, else note "generated barrels are outputs — edit manifest".
- Delete stale boundary patterns after `npm run lint:boundaries -- --dry-run` confirms zero hits.
- Make `toTargetPath` robust: prefer alias branch else find deep-glob via `groups.find(g => g.startsWith("**/"))` fallback; add unit test for `eslint/boundaries.js` helper.
- Move `57.78cqh` history comment to `layout-components.tsx` only; remove from `ARCHITECTURE.md`.

**Verification:** `npm run docs:check`, `npm run lint:boundaries`, `npm run lint:architecture-smoke`.

- [ ] Deduplicate region table; link glossary to canonical
- [ ] Remove stale boundary patterns; harden toTargetPath
- [ ] Move magic token comment to owning file

## Sequencing

1. Initiative 1 (bug fix, no deps) → 2 (shop) → 3 (UI) can run in parallel after 1.
2. Initiative 4 (battle) after 1; 5 (controller) after 2+4 (routing touches battle).
3. Initiative 6 (scripts/build) independent; 7 (tests) after 2+5; 8 (docs/boundaries) last.

## Non-goals

- No player-visible rebalancing (fight pacing, crit/dodge 5% stays split unless tuned with data).
- No `React.lazy` on route screens (hitch-safe eager invariant `ARCHITECTURE.md` boot policy).
- No save-migration bump (MIGRATIONS.md) unless codec shape changes — gear clone is internal.

## Risks & Mitigations

- Shop factory / controller split: narrowly scoped to route props; guard with `lint:boundaries` and `test:e2e`.
- Fade/hover unification: visual regression via existing animation E2E; no logic change.
- Status subdir move: keep barrel re-exports for one commit before deleting old paths; `knip` will catch stragglers.
- `write-port` deletion: two-step — first deprecate with re-export shim, then delete after `verify:changed` confirms no consumer drift.

## Verification (per-initiative)

Each initiative runs `npm run verify:changed -- --diff` + `npm run lint:ci` + its targeted `npm test -- <path>` / `npm run test:e2e` noted above. Final handoff runs `npm run check:push` if committing to main, then `npm run docs:check:final` to archive this plan.
