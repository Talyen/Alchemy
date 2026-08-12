# Armory

The Armory is the permanent meta-progression screen for managing **Gear** (per-character equipment with affix rolls) and **Crafting Currencies** (six material types used to upgrade gear). It is the primary surface for `useGearArmorySlice` and the gateway to in-battle gear effects.

> **Related:** [ARCHITECTURE.md § Permanent Gear](./ARCHITECTURE.md#permanent-gear-gear-store), [REFERENCE.md § Domain Glossary](./REFERENCE.md#domain-glossary), [WORKFLOWS.md § Add permanent Gear](./WORKFLOWS.md#add-permanent-gear).

## Layout

The screen implementation lives under `src/features/alchemy/meta/screens/armory/`. Start from these owners instead of relying on an exhaustive file inventory:

- `use-armory-controller.ts` — read facade and mutation/HP-sync/save-flush boundary consumed by the route.
- `use-armory-board-drag.ts` and `use-board-drag.ts` — Armory-specific carried-item policy over the single typed drag session.
- `board-drag-math.ts`, `armory-drag-types.ts`, and `resolve-equip-swap.ts` — pure geometry, session types, and swap decisions.
- `armory-gear-actions.ts` — Gear/currency commit policy and displacement/flyover outcomes.
- Panels, parts, overlays, portals, and targeting modules — presentation only; they receive domain state and commands through props.

## Data model

`src/lib/gear/types.ts`, `types-core.ts`, and `crafting-types.ts` are authoritative. Durable invariants:

- A saved `GearInstance` has a stable unique `instanceId`, a `definitionId`, and rolled `affixes`; it never embeds definition objects or art URLs.
- Inventories, loadouts, and Gear/currency board positions are keyed by character. A loadout maps each slot to at most one instance ID.
- Definitions own compatible slots, hand rules, affinity keywords, salvage value, and presentation metadata.
- Board positions are one-indexed persisted hints. Sanitizers and packers repair missing, invalid, or colliding positions.

## State flow

| Layer       | Owner                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Pure rules  | `src/lib/gear/` — types, definitions, affixes, crafting, packing, generation                                                           |
| Aggregate   | `gameplay-state-store` gear region via `gear-store.ts` (selectors + persistence codec) and `gear-session-command.ts` (HP-sync wrapper) |
| Screen      | Armory route → `use-armory-controller.ts` → `armory-screen.tsx` + panels/drag                                                          |
| Battle      | `computeGearManifest` → immutable `BattleState.gearEffects`; battle code never reads the Gear aggregate mid-fight                      |
| Persistence | `subscribeAlchemyPersistence` / `encodeAlchemyPersistenceFields`                                                                       |

### Read paths

- **`Armory lock`** — computed at the app layer: `useIsArmoryLocked() = !useHasAnyOwnedGear()` (in `app-overlays.tsx`); `MenuScreen` receives a `locked` prop, it does not read the store.
- **`ArmoryScreen`** — reads `inventories`, `loadouts`, `craftingCurrencies`, and board position slices via `useGearArmorySlice`.
- **`useArmoryController`** — facade hook that bundles the read-only slice plus the mutation callbacks.
- **Battle** — `computeGearManifest(characterId, inventory, loadouts)` is called in `battle-init.ts` and produces a flat `GearEffectManifest` copied into `BattleState.gearEffects` at battle start.
- **Run start** — `content-system-navigation.ts` snapshots `computeGearManifest.maxHealth` into `RunStartSnapshot.gearMaxHealthBonus`.

### Write paths

There is no external `useGearStore` hook. Gear mutations run against a `GearStore` view of the aggregate state and commit through session commands:

- `dispatchGearMutationWithRunHealthSync({ characterId, mutate })` — for HP-affecting ops (`equip`, `unequip`, `salvage`, `applyCurrency`, `transferToInventory`). `mutate` is called with a `GearStore` handle (e.g. `(state) => state.equip(characterId, slot, instance, options)`) and run max-health is re-synced from before/after gear snapshots.
- `dispatchRunSessionCommand(() => gear.<method>(...))` — for board ops surfaced by `useGearArmorySlice` (`moveBoardItem`, `sortBoard`, `addInstance`).

1. **Equip / Unequip** — `dispatchGearMutationWithRunHealthSync({ characterId, mutate: (state) => state.equip(characterId, slot, instance, options?) })` and `(state) => state.unequip(characterId, slot)`. The `options.vacatedPlacement` is computed by the screen via `resolveEquipSwap`.
2. **Salvage** — `(state) => state.salvage(instanceId, { rng })` removes from inventory + loadouts, deletes board position, and rolls `rollSalvageYield` for crafting currencies.
3. **Crafting-currency apply** — `(state) => state.applyCurrency(currencyId, instanceId, { rng })` mutates the item's affixes via `applyCraftingCurrency`.
4. **Transfer to another character** — `(state) => state.transferToInventory(instanceId, targetCharacterId)` moves the item and updates board positions.
5. **Add new instance (rewards / shop / dev spawn)** — `dispatchRunSessionCommand(() => gear.addInstance(instance, characterId))`.
6. **Move on board** — `dispatchRunSessionCommand(() => gear.moveBoardItem(characterId, item, col, row))` calls into `grid-packing.resolveMoveWithSwap` to push displaced items to the closest open cell.
7. **Bulk position repair / sort** — `state.syncBoardPositions()` re-packs all positions; `dispatchRunSessionCommand(() => gear.sortBoard(characterId))` re-packs a character's board.

### `useArmoryController` facade

The route wrapper (`src/app/screen-routes/meta-routes.tsx`) does not mutate gear directly. It consumes `useArmoryController()`, which:

- Reads `inventories`, `loadouts`, `craftingCurrencies` and board positions from `useGearArmorySlice`.
- Reads per-character gear/currency board positions and exposes `onMoveBoardItem` so the screen does not mutate gear directly.
- Routes `equip`/`unequip` through `dispatchGearMutationWithRunHealthSync` (HP-sync side effect).
- Routes `salvage`/`applyCurrency` through `dispatchGearMutationWithRunHealthSync` and flushes the save on success.
- Provides a dev-only `onSpawnDevGear` that calls `generateDevRandomGearInstance` + `addInstance` and flushes the save.
- Reports `browseOnly = hasActiveBattle` and `finishedRunCharacters` for the screen.

## Board packing

Board dimensions come from `INVENTORY_COLS` / `INVENTORY_VISIBLE_ROWS`; per-slot footprints come from `GEAR_FOOTPRINT` in `src/lib/gear/footprints.ts`. Do not duplicate their current numeric values in layout code or documentation.

All grid layout logic lives in **`src/lib/gear/grid-packing.ts`** (pure, framework-agnostic). The store, the screen, and the drag hooks all delegate to it:

- `packGridItems(items, cols, options?)` — pack items in row-major order, optionally keeping `saved` positions and treating `blockedCells` / `reservedItems` as obstacles.
- `resolveMoveWithSwap(items, movingId, target, cols, options?)` — `moveBoardItemForState`/`sortBoardForCharacter` use this to push displaced items to the closest open cell.

## Battle integration

Gear effects are **snapshotted** at battle start. `computeGearManifest(characterId, inventory, loadouts)` flattens equipped Gear into `BattleState.gearEffects`. Battle code never reads the Gear aggregate during a fight.

Effect keys are listed in `GEAR_EFFECT_KEYS` (`src/lib/gear/gear-effect-manifest.ts`). Each entry in `gearAffixCatalog` declares its `effectKey: keyof GearEffectManifest`. The architecture guard `tests/architecture/gear-affix-effect-keys.test.ts` asserts:

- Every `effectKey` in the catalog is a member of `GEAR_EFFECT_KEYS` (catches silent zero-roll typos).
- Every key in `GEAR_EFFECT_KEYS` is referenced by at least one affix.
- The keys are unique.

## Drag FSM

`useArmoryBoardDrag` is the sole owner of the board's primary drag. It represents the carried value as a discriminated gear-or-currency item and routes both tile entry points through one `useBoardDrag` session. The core session has explicit `idle`, `armed`, `dragging`, `held`, and `animating` phases; its public visual and active flags are derived from that phase rather than maintained as separate logical state.

When a board item is dropped onto another board item, the first item is committed and the displaced item becomes the same session's next held `ArmoryDragItem`. Gear → gear, gear → currency, currency → gear, and currency → currency use the same transition; there is no second FSM or cross-hook callback bridge. This keeps the familiar inventory behavior — drop A on B, A lands, B is now under the cursor — while guaranteeing that only one primary item can be carried.

`useBoardDrag` owns held-mode document listeners, Escape registration, visibility/blur cleanup, and animation completion as resources derived from the active phase. Geometry stays pure in `board-drag-math.ts`. Secondary gear swap flyovers remain a separate visual array because they are animations, not additional primary sessions.

Drag thresholds and animation timings live with `useBoardDrag` and are re-exported from `board-drag-math` when pure tests need them. Keep snap radius, destination-switch margin, release hysteresis, pointer activation, and flyover/release timing centralized there rather than copying their current numeric values into documentation.

## Persistence

Saves are written/read via `buildAlchemySaveDataFromStores` (`src/features/alchemy/shared/storage/build-save-data-from-stores.ts`), which serializes five Gear-owned fields:

| Field                                       | Notes                                                                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `gearInventories`                           | `Record<CharacterId, GearInstance[]>` — per-character inventories.                                        |
| `gearLoadouts`                              | `Record<CharacterId, GearLoadout>` — pruned of orphan references.                                         |
| `gearBoardPositionsByCharacter`             | `Record<CharacterId, Record<instanceId, { col, row }>>` — per-character board positions.                  |
| `craftingCurrencyBoardPositionsByCharacter` | `Record<CharacterId, Partial<Record<CraftingCurrencyId, { col, row }>>>` — per-character currency layout. |
| `craftingCurrencies`                        | `Record<CraftingCurrencyId, number>`.                                                                     |

Do not duplicate the current schema number here. [`MIGRATIONS.md`](../src/features/alchemy/shared/storage/MIGRATIONS.md) and `src/lib/validation/metadata.ts` own the supported floor and current version. Gear shape changes follow that migration contract: safe additive fields may use schema defaults, while transforms require a versioned migration.

`use-app-save-state.ts` (`useAlchemyAutosaveFromStores`) subscribes through `subscribeAlchemyPersistence`, which combines settings changes with the committed gameplay-session signal (run domain, transient/battle state, run profile, profile, and gear); changes are debounced before writing. `buildAlchemySaveDataFromStores` assembles the snapshot through `encodeAlchemyPersistenceFields`. The gear mutation callbacks in `useArmoryController` also call `flushAlchemySaveNow` after mutations during an active run.

## Tests

Use the path-scoped Gear gate in [`CONTRIBUTING.md`](../CONTRIBUTING.md#what-to-run-when-you-change) rather than maintaining a second exhaustive command here. Test ownership is intentionally split:

- `tests/lib/gear/` — pure definitions, operations, generation, crafting, manifests, and board layout.
- `tests/features/alchemy/shared/stores/gear-*.test.ts` and `shared/storage/gear-save.test.ts` — aggregate mutation and persistence.
- `tests/features/alchemy/meta/screens/armory*/` — controller, rendering, targeting, and drag interaction.
- `tests/architecture/gear-*.test.ts` and save-migration guards — registry and persistence contracts.
- `tests/*gear*.spec.ts`, `tests/armory-*.spec.ts`, and `tests/e2e/armory.ts` — player flows and Playwright helpers.
