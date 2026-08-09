# Armory

The Armory is the permanent meta-progression screen for managing **Gear** (per-character equipment with affix rolls) and **Crafting Currencies** (six material types used to upgrade gear). It is the primary surface for `useGearArmorySlice` and the gateway to in-battle gear effects.

> **Related:** [ARCHITECTURE.md § Permanent Gear](./ARCHITECTURE.md#permanent-gear-gear-store), [REFERENCE.md § Domain Glossary](./REFERENCE.md#domain-glossary), [WORKFLOWS.md § Add permanent Gear](./WORKFLOWS.md#add-permanent-gear).

## Layout (`src/features/alchemy/meta/screens/armory/`)

| File                              | Role                                                                                                                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `use-armory-controller.ts`        | Facade hook: reads `useGearArmorySlice`, routes gear mutations through `dispatchGearMutationWithRunHealthSync` / `dispatchRunSessionCommand` with HP-sync + save-flush side effects, and exposes board movement to the route. Consumed by `meta-routes.tsx`. |
| `use-armory-board-drag.ts`        | Sole Armory drag owner for gear and currency: domain-specific destinations/commits, cross-type held-item chaining, secondary gear animation, and double-click flyover.                                                                                       |
| `use-board-drag.ts`               | Typed primary-session core: `idle` / `armed` / `dragging` / `held` / `animating`, magnet snap, hysteresis, animation completion, and held-item listeners.                                                                                                    |
| `board-drag-math.ts`              | Pure helpers: `placeInventoryTileFromMetrics`, `applyMagnetHysteresis`, `sameDestinationIdentity`, `rectCenter`, `distanceBetweenRects`.                                                                                                                     |
| `armory-character-tabs.tsx`       | Character tab strip with locked/unlocked state.                                                                                                                                                                                                              |
| `armory-currency-targeting.tsx`   | Follow-cursor targeting visual.                                                                                                                                                                                                                              |
| `armory-drag-visual-portal.tsx`   | Shared gear/currency drag animation portal.                                                                                                                                                                                                                  |
| `armory-overlays.tsx`             | Salvage confirmation, drag visuals, currency cursor, and transfer menu composition.                                                                                                                                                                          |
| `gear-tooltip-portal.tsx`         | Shared portaled gear tooltip rendering for inventory and equipment tiles (uses shared `PortaledTooltip`).                                                                                                                                                    |
| `resolve-equip-swap.ts`           | Pure function: given an incoming instance, target slot, and vacated placement, decide whether the displaced item fits.                                                                                                                                       |
| `read-inventory-board-metrics.ts` | DOM probe of the `cell` and `stride` grid metrics.                                                                                                                                                                                                           |
| `character-panel.tsx`             | `CharacterAndEquipmentPanel`: character art + 10 `SlotButton`s.                                                                                                                                                                                              |
| `inventory-panel.tsx`             | `InventoryPanel`: currency stacks + `InventoryGearTile`s.                                                                                                                                                                                                    |
| `parts/grid-styles.ts`            | `SLOT_LABELS`, `EQUIP_SLOT_PLACEMENT`, `equipmentSlotStyle`, `packedItemStyle`.                                                                                                                                                                              |
| `parts/slot-button.tsx`           | `SlotButton` (single equipment slot tile).                                                                                                                                                                                                                   |
| `parts/inventory-tile.tsx`        | `InventoryGearTile` (single gear tile in the inventory).                                                                                                                                                                                                     |
| `parts/currency-tile.tsx`         | `CraftingCurrencyTile` (single crafting currency tile).                                                                                                                                                                                                      |

## Data model

```ts
type GearSlot =
  | "body"
  | "helm"
  | "boots"
  | "gloves"
  | "belt"
  | "main-hand"
  | "off-hand"
  | "left-ring"
  | "right-ring"
  | "amulet"; // 10 slots

type GearRarity = "basic" | "astral";

type GearAffixRoll = { id: GearAffixId; value: number };

type GearDefinition = {
  id: string; // stable id, combined with rarity
  baseItemId: GearBaseItemId;
  rarity: GearRarity | null; // null for generic templates
  title: string;
  compatibleSlots: GearSlot[];
  requiresTwoHands: boolean;
  affinityKeywords: KeywordId[];
  salvageValue: MaterialInventory;
  art: string;
  descriptionLines: string[];
  rangedWeapon?: boolean;
  quiver?: boolean;
};

type GearInstance = {
  // saved with the player
  instanceId: string; // uuid per drop / per save
  definitionId: string; // → GearDefinition
  affixes: GearAffixRoll[];
};

type GearInventory = GearInstance[];
type GearInventories = Record<CharacterId, GearInventory>; // per-character
type GearLoadout = Record<GearSlot, string | null>;
type GearLoadouts = Record<CharacterId, GearLoadout>;

type GearBoardPosition = { col: number; row: number }; // 1-indexed
type GearBoardPositions = Record<string, GearBoardPosition>;
type GearBoardPositionsByCharacter = Record<CharacterId, GearBoardPositions>;
```

Crafting currencies are simpler:

```ts
type CraftingCurrencyId =
  | "discordant-dice"
  | "sprig-of-growth"
  | "voidstone"
  | "ascension-seal"
  | "severance-maw"
  | "smiths-whetstone";
type CraftingCurrencyBoardPositions = Partial<Record<CraftingCurrencyId, { col: number; row: number }>>;
type CraftingCurrencyBoardPositionsByCharacter = Record<CharacterId, CraftingCurrencyBoardPositions>;
```

## State flow

```
                  ┌─────────────────────────────────────┐
                  │  src/lib/gear/  (pure, immutable)   │
                  │  types / definitions / base-items   │
                  │  affix-catalog / crafting / ops     │
                  │  inventory-layout / grid-packing    │
                  │  generation                         │
                  └──────────────┬──────────────────────┘
                                 │ types + functions
                                 ▼
┌───────────────────────────────────────────────────────────┐
│  src/features/alchemy/shared/stores/gear-store.ts         │
│  Gear aggregate adapter: selector (`useGearArmorySlice`) +│
│  persistence codec; state + actions live in the           │
│  gameplay-state-store aggregate (gear-actions.ts).        │
│  Adjacent: gear-session-command.ts (HP-sync wrapper).     │
│  GearStore mutation surface:                              │
│  equip / unequip / salvage / applyCurrency /              │
│  transferToInventory / addInstance / moveBoardItem /      │
│  syncBoardPositions / sortBoard / addCurrencies / reset   │
└──────────────┬────────────────────────────────────────────┘
               │ subscriptions / selectors
   ┌───────────┼─────────────┬──────────────────────────────┐
   ▼           ▼             ▼                              ▼
 Armory    Meta-routes   App.tsx (isArmoryLocked)   subscribeAlchemyPersistence
 screen    (controller)  useAlchemyAutosaveFromStores  (store-owned codecs)
   │
   ▼
 armory-screen.tsx + armory/* (panels, drag hooks, tooltips)
                                 │
                                 ▼
              Battle snapshots: computeGearManifest → BattleState.gearEffects
                                 │
                                 ▼
                  All src/lib/battle/*.ts read state.gearEffects.X
```

### Read paths

- **`Armory lock`** — computed at the app layer: `useIsArmoryLocked() = !useHasAnyOwnedGear()` (in `app-overlays.tsx`); `MenuScreen` receives a `locked` prop, it does not read the store.
- **`ArmoryScreen`** — reads `inventories`, `loadouts`, `craftingCurrencies`, and board position slices via `useGearArmorySlice`.
- **`useArmoryController`** — facade hook that bundles the read-only slice plus the mutation callbacks.
- **Battle** — `computeGearManifest(characterId, inventory, loadouts)` is called in `battle-init.ts` and produces a flat `GearEffectManifest` (64 numeric keys) that is copied into `BattleState.gearEffects` and frozen at battle start.
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

The inventory is an **8-column × 8-row** board (the `INVENTORY_COLS` × `INVENTORY_VISIBLE_ROWS` constants). Gear footprints are defined per-slot in `GEAR_FOOTPRINT` (`src/lib/gear/footprints.ts`):

| slot  | w × h | slot                            | w × h |
| ----- | ----- | ------------------------------- | ----- |
| body  | 2 × 3 | main-hand                       | 2 × 3 |
| helm  | 2 × 2 | off-hand                        | 2 × 3 |
| boots | 2 × 2 | gloves                          | 2 × 2 |
| belt  | 2 × 1 | amulet / left-ring / right-ring | 1 × 1 |

All grid layout logic lives in **`src/lib/gear/grid-packing.ts`** (pure, framework-agnostic). The store, the screen, and the drag hooks all delegate to it:

- `packInventoryGrid(items, cols, getFootprint)` — pack items in row-major order.
- `packInventoryGridPreserving(items, cols, getFootprint, getSavedPosition)` — keep saved positions when valid, pack the rest sequentially.
- `packCurrencyGridWithGearObstacles(...)` — same for crafting currencies, treating gear as obstacles.
- `resolveMoveWithSwap(items, movingId, target, cols, options?)` — `moveBoardItemForState`/`sortBoardForCharacter` use this to push displaced items to the closest open cell.

## Battle integration

Gear effects are **snapshotted** at battle start. `computeGearManifest(characterId, inventory, loadouts)` flattens all equipped gear into a 64-key `GearEffectManifest` (a record of numbers) which is copied into `BattleState.gearEffects` and frozen. Battle code never reads the gear aggregate during a fight — it reads `state.gearEffects.X` only.

The 64 effect keys are listed in `GEAR_EFFECT_KEYS` (`src/lib/gear/gear-effect-manifest.ts`). Each entry in `gearAffixCatalog` declares its `effectKey: keyof GearEffectManifest`. The architecture guard `tests/architecture/gear-affix-effect-keys.test.ts` asserts:

- Every `effectKey` in the catalog is a member of `GEAR_EFFECT_KEYS` (catches silent zero-roll typos).
- Every key in `GEAR_EFFECT_KEYS` is referenced by at least one affix.
- The keys are unique.

## Drag FSM

`useArmoryBoardDrag` is the sole owner of the board's primary drag. It represents the carried value as a discriminated gear-or-currency item and routes both tile entry points through one `useBoardDrag` session. The core session has explicit `idle`, `armed`, `dragging`, `held`, and `animating` phases; its public visual and active flags are derived from that phase rather than maintained as separate logical state.

When a board item is dropped onto another board item, the first item is committed and the displaced item becomes the same session's next held `ArmoryDragItem`. Gear → gear, gear → currency, currency → gear, and currency → currency use the same transition; there is no second FSM or cross-hook callback bridge. This keeps the familiar inventory behavior — drop A on B, A lands, B is now under the cursor — while guaranteeing that only one primary item can be carried.

`useBoardDrag` owns held-mode document listeners, Escape registration, visibility/blur cleanup, and animation completion as resources derived from the active phase. Geometry stays pure in `board-drag-math.ts` and `board-drag-destination.ts`. Secondary gear swap flyovers remain a separate visual array because they are animations, not additional primary sessions.

Magnet constants (all in `useBoardDrag` + re-exported from `board-drag-math`):

- `INVENTORY_SNAP_RADIUS_CELLS = 0.28` — the proximity check between the free rect and the destination cell.
- `MAGNET_SWITCH_MARGIN_PX = 14` — the new candidate must be at least this much closer to win the switch.
- `MAGNET_RELEASE_HYSTERESIS_PX = 18` — the previous destination's grip weakens when the free rect is far from it.
- `DOUBLE_CLICK_FLYOVER_MS = 280` — duration of the double-click flyover animation.
- `MAGNET_RELEASE_EASE_MS = 140` — duration of the magnet-release animation.
- `DRAG_POINTER_ACTIVATE_DISTANCE_PX = 4` — pointer must travel this far before the drag begins.

## Persistence

Saves are written/read via `buildAlchemySaveDataFromStores` (`src/features/alchemy/shared/storage/build-save-data-from-stores.ts`) which serializes the 5 gear fields. The current schema is **v10**:

| Field                                       | Notes                                                                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `gearInventories`                           | `Record<CharacterId, GearInstance[]>` — per-character inventories.                                        |
| `gearLoadouts`                              | `Record<CharacterId, GearLoadout>` — pruned of orphan references.                                         |
| `gearBoardPositionsByCharacter`             | `Record<CharacterId, Record<instanceId, { col, row }>>` — per-character board positions.                  |
| `craftingCurrencyBoardPositionsByCharacter` | `Record<CharacterId, Partial<Record<CraftingCurrencyId, { col, row }>>>` — per-character currency layout. |
| `craftingCurrencies`                        | `Record<CraftingCurrencyId, number>`.                                                                     |

`LAUNCH_SAVE_SCHEMA_VERSION` and `CURRENT_SAVE_SCHEMA_VERSION` are both **10** pre-launch. `migrateSaveDataToCurrent` stamps the current version; there are no schema step functions until launch.

`use-app-save-state.ts` (`useAlchemyAutosaveFromStores`) subscribes through `subscribeAlchemyPersistence`, which combines settings changes with the committed gameplay-session signal (run domain, transient/battle state, run profile, profile, and gear); changes are debounced before writing. `buildAlchemySaveDataFromStores` assembles the snapshot through `encodeAlchemyPersistenceFields`. The gear mutation callbacks in `useArmoryController` also call `flushAlchemySaveNow` after mutations during an active run.

## Tests

| Path                                                                                                                  | Role                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/lib/gear/gear.test.ts`                                                                                         | Slot compatibility, equip/swap, hand conflict, salvage, normalize.                                                                                                                                                                               |
| `tests/lib/gear/affixes.test.ts`                                                                                      | Affix roll, value, normalize, effect mapping.                                                                                                                                                                                                    |
| `tests/lib/gear/crafting.test.ts`                                                                                     | Currency apply, canApply, salvage yield.                                                                                                                                                                                                         |
| `tests/lib/gear/grid-packing.test.ts`                                                                                 | Packing, preservation, swap, displaced re-placement, edge cases.                                                                                                                                                                                 |
| `tests/lib/gear/gear-shine.test.ts`                                                                                   | Astral-rarity shine colors.                                                                                                                                                                                                                      |
| `tests/lib/gear/display.test.ts`                                                                                      | Tooltip / description / title helpers.                                                                                                                                                                                                           |
| `tests/lib/gear/generation.test.ts`                                                                                   | `generateGearRewardChoices`, `createGearInstance`.                                                                                                                                                                                               |
| `tests/features/alchemy/shared/stores/gear-store.test.ts`                                                             | Init, equip, unequip, salvage, board-position swap, transfer, crafting, cross-character equip.                                                                                                                                                   |
| `tests/features/alchemy/shared/stores/gear-crafting.test.ts`                                                          | Crafting integration: apply, salvage yield, normalization.                                                                                                                                                                                       |
| `tests/features/alchemy/meta/screens/armory-screen.test.tsx`                                                          | Integration coverage for render, character switching, salvage mode, currency targeting, double-click swap animations, transfer menu, tooltips, browse-only, locked characters, two-handed off-hand dimming, and dev spawn.                       |
| `tests/lib/gear/board-view.test.ts`                                                                                   | Mixed board view and saved-position packing.                                                                                                                                                                                                     |
| `tests/lib/gear/inventory-placement.test.ts`                                                                          | Collision, nearest/first placement, vacated slots, and destination rectangles.                                                                                                                                                                   |
| `tests/features/alchemy/meta/screens/armory/armory-resolve-equip-swap.test.ts`                                        | `resolveEquipSwap` canSwap / displaced decisions.                                                                                                                                                                                                |
| `tests/features/alchemy/meta/screens/armory/board-drag-math.test.ts`                                                  | Drag geometry, destination identity, and magnet-hysteresis math helpers.                                                                                                                                                                         |
| `tests/features/alchemy/shared/ui/portaled-tooltip-placement.test.ts`                                                 | Portaled tooltip placement helpers (shared stage-aware math).                                                                                                                                                                                    |
| `tests/features/alchemy/shared/storage/gear-save.test.ts`                                                             | Save round-trip and v10 gear normalization.                                                                                                                                                                                                      |
| `tests/architecture/gear-affix-pool.test.ts`                                                                          | Every gear definition has an eligible affix pool at least as large as its minimum affix count.                                                                                                                                                   |
| `tests/architecture/gear-affix-effect-keys.test.ts`                                                                   | Every `effectKey` in the catalog is in `GEAR_EFFECT_KEYS` and vice versa.                                                                                                                                                                        |
| `tests/architecture/save-migration-guard.test.ts`                                                                     | Every fixture is idempotent at the v10 launch baseline.                                                                                                                                                                                          |
| `tests/architecture/save-migration-contract.test.ts`                                                                  | Launch baseline and migration contract at v10.                                                                                                                                                                                                   |
| `tests/armory-crafting.spec.ts`, `tests/gear-combat.spec.ts`, `tests/gear-equip.spec.ts`, `tests/gear-layout.spec.ts` | Playwright E2E specs.                                                                                                                                                                                                                            |
| `tests/e2e/armory.ts`                                                                                                 | Playwright helpers: `openArmory`, `gearItemLocator`, `currencyLocator`, `activateCurrency`, `applyCurrencyToGear`, `enterSalvageMode`, `salvageInventoryItem`, `confirmSalvage`, `expectSalvageDialog`, `pointerDrag`, `pointerDragToInventory`. |
