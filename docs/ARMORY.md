# Armory

The Armory is the permanent meta-progression screen for managing **Gear** (per-character equipment with affix rolls) and **Crafting Currencies** (six material types used to upgrade gear). It is the primary surface for `useGearStore` and the gateway to in-battle gear effects.

> **Related:** [ARCHITECTURE.md § Armory invariants](./ARCHITECTURE.md#armory), [REFERENCE.md § Gear glossary](./REFERENCE.md), [WORKFLOWS.md § Add a gear/currency/enemy](./WORKFLOWS.md).

## Layout (`src/features/alchemy/meta/screens/armory/`)

| File | Role |
|------|------|
| `use-armory-controller.ts` | Facade hook: reads `useGearStore`, wraps gear mutations with HP-sync + save-flush side effects, and exposes board movement to the route. Consumed by `meta-routes.tsx`. |
| `use-armory-gear-drag.ts` | Pointer FSM for gear drag from inventory/equipment, equipment-slot destination detection, secondary swap animation, double-click flyover. |
| `use-armory-currency-drag.ts` | Pointer FSM for crafting-currency drag, 1×1 footprint. Wraps `useBoardDrag`. |
| `use-board-drag.ts` | Shared FSM core: magnet snap, hysteresis, animation timer, cursor lock, and held-item follow-up drags. |
| `board-drag-math.ts` | Pure helpers: `placeInventoryTileFromMetrics`, `applyMagnetHysteresis`, `sameDestinationIdentity`, `rectCenter`, `distanceBetweenRects`. |
| `armory-character-tabs.tsx` | Character tab strip with locked/unlocked state. |
| `armory-currency-targeting.tsx` | Follow-cursor targeting visual. |
| `armory-drag-visual-portal.tsx` | Shared gear/currency drag animation portal. |
| `armory-overlays.tsx` | Salvage confirmation, drag visuals, currency cursor, and transfer menu composition. |
| `gear-tooltip-portal.tsx` | Shared portaled gear tooltip rendering for inventory and equipment tiles. |
| `resolve-equip-swap.ts` | Pure function: given an incoming instance, target slot, and vacated placement, decide whether the displaced item fits. |
| `armory-tooltip-placement.ts` | Stage-aware portaled tooltip placement (reads `[data-testid="vr-stage"]`). |
| `read-inventory-board-metrics.ts` | DOM probe of `[data-armory-grid-metric="cell"|"stride"]`. |
| `character-panel.tsx` | `CharacterAndEquipmentPanel`: character art + 10 `SlotButton`s. |
| `inventory-panel.tsx` | `InventoryPanel`: currency stacks + `InventoryGearTile`s. |
| `parts/grid-styles.ts` | `SLOT_LABELS`, `EQUIP_SLOT_PLACEMENT`, `equipmentSlotStyle`, `packedItemStyle`. |
| `parts/slot-button.tsx` | `SlotButton` (single equipment slot tile). |
| `parts/inventory-tile.tsx` | `InventoryGearTile` (single gear tile in the inventory). |
| `parts/currency-tile.tsx` | `CraftingCurrencyTile` (single crafting currency tile). |

## Data model

```ts
type GearSlot = "body" | "helm" | "boots" | "gloves" | "belt"
              | "main-hand" | "off-hand"
              | "left-ring" | "right-ring" | "amulet";   // 10 slots

type GearRarity = "basic" | "astral";

type GearAffixRoll = { id: GearAffixId; value: number };

type GearDefinition = {
  id: string;                // stable id, combined with rarity
  baseItemId: GearBaseItemId;
  rarity: GearRarity | null;  // null for generic templates
  compatibleSlots: GearSlot[];
  requiresTwoHands: boolean;
  affinityKeywords: KeywordId[];
  salvageValue: MaterialInventory;
  art: string;
  descriptionLines: string[];
};

type GearInstance = {         // saved with the player
  instanceId: string;         // uuid per drop / per save
  definitionId: string;       // → GearDefinition
  affixes: GearAffixRoll[];
};

type GearInventory     = GearInstance[];
type GearInventories   = Record<CharacterId, GearInventory>;     // per-character
type GearLoadout       = Record<GearSlot, string | null>;
type GearLoadouts      = Record<CharacterId, GearLoadout>;

type GearBoardPosition = { col: number; row: number };            // 1-indexed
type GearBoardPositions = Record<instanceId, GearBoardPosition>;
type GearBoardPositionsByCharacter = Record<CharacterId, GearBoardPositions>;
```

Crafting currencies are simpler:

```ts
type CraftingCurrencyId = "discordant-dice" | "sprig-of-growth" | "voidstone"
                        | "ascension-seal"   | "severance-maw"   | "smiths-whetstone";
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
┌──────────────────────────────────────────────────────────┐
│  src/features/alchemy/shared/stores/gear-store.ts        │
│  Zustand: inventories / loadouts / board-positions /    │
│           craftingCurrencies                             │
│  Actions: equip / unequip / salvage / applyCurrency /    │
│           transferToInventory / addInstance /            │
│           setBoardPosition / syncBoardPositions /        │
│           addCurrencies / reset                           │
└──────────────┬───────────────────────────────────────────┘
               │ subscriptions + selectors
   ┌───────────┼─────────────┬──────────────────┐
   ▼           ▼             ▼                  ▼
 Armory    Meta-routes   App.tsx (isArmoryLocked, autosave)
 screen    (controller)  buildAlchemySaveDataFromStores
   │                     useAlchemySaveState
   │                     useGearStore.subscribe(triggerSave)
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

- **`MenuScreen`** — reads `useGearStore` directly to compute `isArmoryLocked = flattenGearInventories(...).length === 0`.
- **`ArmoryScreen`** — reads `inventories`, `loadouts`, `craftingCurrencies`, and board position slices.
- **`useArmoryController`** — facade hook that bundles the read-only state plus the 5 mutation callbacks.
- **Battle** — `computeGearManifest(characterId, inventory, loadouts)` is called in `battle-init.ts` and produces a flat `GearEffectManifest` (64 numeric keys) that is copied into `BattleState.gearEffects` and frozen at battle start.
- **Run start** — `content-system-navigation.ts` snapshots `computeGearManifest.maxHealth` into `RunStartSnapshot.gearMaxHealthBonus`.

### Write paths

1. **Equip / Unequip** — `useGearStore.equip(characterId, slot, instance, options?)` and `unequip(characterId, slot)`. The `options.vacatedPlacement` is computed by the screen via `resolveEquipSwap`.
2. **Salvage** — `useGearStore.salvage(instanceId, options?)` removes from inventory + loadouts, deletes board position, and rolls `rollSalvageYield` for crafting currencies.
3. **Crafting-currency apply** — `useGearStore.applyCurrency(currencyId, instanceId, options?)` mutates the item's affixes via `applyCraftingCurrency`.
4. **Transfer to another character** — `useGearStore.transferToInventory(instanceId, targetCharacterId)` moves the item and updates board positions.
5. **Add new instance (rewards / shop / dev spawn)** — `useGearStore.addInstance(instance, characterId)`.
6. **Move on board** — `useGearStore.moveBoardItem(characterId, item, col, row)` calls into `grid-packing.resolveMoveWithSwap` to push displaced items to the closest open cell.
7. **Bulk position repair** — `useGearStore.syncBoardPositions()` re-packs all positions.

### `useArmoryController` facade

The route wrapper (`src/app/screen-routes/meta-routes.tsx`) does not call `useGearStore` directly. It consumes `useArmoryController()`, which:

- Reads `inventories`, `loadouts`, `craftingCurrencies` from the store.
- Reads per-character gear/currency board positions and exposes `onMoveBoardItem` so the screen does not mutate `useGearStore` directly.
- Wraps `equip`/`unequip` with `syncRunMaxHealthFromGear` (HP-sync side effect).
- Wraps `salvage`/`applyCurrency` with `syncRunMaxHealthFromGearMutation` + `flushAlchemySaveNow`.
- Provides a dev-only `onSpawnDevGear` that calls `generateDevRandomGearInstance` + `addInstance` + `flushAlchemySaveNow`.
- Reports `browseOnly = hasActiveBattle` and `finishedRunCharacters` for the screen.

## Board packing

The inventory is a **7-column × 8-row** board (the `INVENTORY_COLS` × `INVENTORY_VISIBLE_ROWS` constants). Gear footprints are defined per-slot in `GEAR_FOOTPRINT` (`src/lib/gear/inventory-layout.ts`):

| slot | w × h | slot | w × h |
|------|-------|------|-------|
| body | 2 × 3 | main-hand | 2 × 3 |
| helm | 2 × 2 | off-hand | 2 × 3 |
| boots | 2 × 2 | gloves | 2 × 2 |
| belt | 2 × 1 | amulet / left-ring / right-ring | 1 × 1 |

All grid layout logic lives in **`src/lib/gear/grid-packing.ts`** (pure, framework-agnostic). The store, the screen, and the drag hooks all delegate to it:

- `packInventoryGrid(items, cols, getFootprint)` — pack items in row-major order.
- `packInventoryGridPreserving(items, cols, getFootprint, getSavedPosition)` — keep saved positions when valid, pack the rest sequentially.
- `packCurrencyGridWithGearObstacles(...)` — same for crafting currencies, treating gear as obstacles.
- `packMixedBoard(items, cols, getFootprint, getSavedPosition)` — heterogeneous gear + currency packer used by `syncBoardPositions`.
- `resolveMoveWithSwap(items, movingId, target, cols, options?)` — `setBoardPosition`/`setCurrencyBoardPosition` use this to push displaced items to the closest open cell.

## Battle integration

Gear effects are **snapshotted** at battle start. `computeGearManifest(characterId, inventory, loadouts)` flattens all equipped gear into a 64-key `GearEffectManifest` (a record of numbers) which is copied into `BattleState.gearEffects` and frozen. Battle code never reads `useGearStore` during a fight — it reads `state.gearEffects.X` only.

The 64 effect keys are listed in `GEAR_EFFECT_KEYS` (`src/lib/gear/gear-effect-manifest.ts`). Each entry in `gearAffixCatalog` declares its `effectKey: keyof GearEffectManifest`. The architecture guard `tests/architecture/gear-affix-effect-keys.test.ts` asserts:

- Every `effectKey` in the catalog is a member of `GEAR_EFFECT_KEYS` (catches silent zero-roll typos).
- Every key in `GEAR_EFFECT_KEYS` is referenced by at least one affix.
- The keys are unique.

## Drag FSM

`useBoardDrag` is the shared FSM core. It exposes `beginPointer`, `beginHeld`, `movePointer`, `finishPointer`, `flyoverTo`, `clearDragState`, plus the magnet-snap `getInventoryDestination` and the `applyMagnetHysteresis` math. Gear and currency drag hooks both wrap it.

When a board item is dropped onto another board item, the first item is committed and the displaced item can be handed back to `useBoardDrag` as a held drag. That keeps the familiar inventory behavior — drop A on B, A lands, B is now under the cursor — without separate carry-specific document listeners in the Armory hooks.

Magnet constants (all in `useBoardDrag` + re-exported from `board-drag-math`):

- `INVENTORY_SNAP_RADIUS_CELLS = 0.28` — the proximity check between the free rect and the destination cell.
- `MAGNET_SWITCH_MARGIN_PX = 14` — the new candidate must be at least this much closer to win the switch.
- `MAGNET_RELEASE_HYSTERESIS_PX = 18` — the previous destination's grip weakens when the free rect is far from it.
- `DOUBLE_CLICK_FLYOVER_MS = 280` — duration of the double-click flyover animation.
- `MAGNET_RELEASE_EASE_MS = 140` — duration of the magnet-release animation.
- `DRAG_POINTER_ACTIVATE_DISTANCE_PX = 4` — pointer must travel this far before the drag begins.

## Persistence

Saves are written/read via `buildAlchemySaveDataFromStores` (`src/features/alchemy/shared/storage/build-save-data-from-stores.ts`) which serializes the 5 gear fields. The current schema is **v10**:

| Field | Notes |
|-------|-------|
| `gearInventories` | `Record<CharacterId, GearInstance[]>` — per-character split added in v9. |
| `gearLoadouts` | `Record<CharacterId, GearLoadout>` — pruned of orphan references. |
| `gearBoardPositionsByCharacter` | `Record<CharacterId, Record<instanceId, { col, row }>>` — per-character split added in v9. |
| `craftingCurrencyBoardPositionsByCharacter` | `Record<CharacterId, Partial<Record<CraftingCurrencyId, { col, row }>>>` — per-character split added in v9. |
| `craftingCurrencies` | `Record<CraftingCurrencyId, number>`. |

Migration steps are in `src/lib/validation/migration/steps.ts`. Notable steps:

- **v0→v1** through **v8→v9** — historical schema and content migrations.
- **v8→v9** — splits the flat `gearInventory` into per-character `gearInventories` and per-character board positions.
- **v9→v10** — `migrateV9ToV10` is a one-shot localStorage shim: reads `alchemy-armory-positions`, merges the positions into `gearBoardPositionsByCharacter.knight`, and removes the storage key. The shim previously lived in `gear-store.ts`; it now lives in the canonical migration pipeline.

`useAppSaveState.ts` subscribes to the entire `useGearStore` and triggers an autosave on any change. The gear mutation callbacks in `useArmoryController` also call `flushAlchemySaveNow` after mutations during an active run.

## Tests

| Path | Role |
|------|------|
| `tests/lib/gear/gear.test.ts` | Slot compatibility, equip/swap, hand conflict, salvage, normalize. |
| `tests/lib/gear/affixes.test.ts` | Affix roll, value, normalize, legacy. |
| `tests/lib/gear/crafting.test.ts` | Currency apply, canApply, salvage yield. |
| `tests/lib/gear/grid-packing.test.ts` | Packing, preservation, swap, displaced re-placement, edge cases. |
| `tests/lib/gear/gear-shine.test.ts` | Astral-rarity shine colors. |
| `tests/lib/gear/display.test.ts` | Tooltip / description / title helpers. |
| `tests/lib/gear/generation.test.ts` | `generateGearRewardChoices`, `createGearInstance`. |
| `tests/features/stores/gear-store.test.ts` | Init, equip, unequip, salvage, board-position swap, transfer, crafting, cross-character equip. |
| `tests/features/stores/gear-crafting.test.ts` | Crafting integration: apply, salvage yield, normalization. |
| `tests/features/screens/armory-screen.test.tsx` | 28 integration tests covering render, character switching, salvage mode, currency targeting, double-click swap animations, transfer menu, tooltips, browse-only, locked characters, two-handed off-hand dimming, dev spawn. |
| `tests/features/screens/armory-inventory-layout.test.ts` | Pure packer / placement / swap helpers. |
| `tests/features/screens/armory-resolve-equip-swap.test.ts` | `resolveEquipSwap` canSwap / displaced decisions. |
| `tests/features/screens/board-drag-math.test.ts` | 12 math helper unit tests. |
| `tests/features/ui/armory-tooltip-placement.test.ts` | Portaled tooltip placement helpers. |
| `tests/features/storage/gear-save.test.ts` | Save round-trip, legacy migration, per-character split. |
| `tests/architecture/gear-affix-pool.test.ts` | Every gear definition has an eligible affix pool at least as large as its minimum affix count. |
| `tests/architecture/gear-affix-effect-keys.test.ts` | Every `effectKey` in the catalog is in `GEAR_EFFECT_KEYS` and vice versa. |
| `tests/architecture/armory-legacy-migration.test.ts` | `migrateV9ToV10` localStorage shim, including invalid-JSON and array-as-object cases. |
| `tests/architecture/save-migration-guard.test.ts` | Every migration step is idempotent, every fixture version 0..9 is provided. |
| `tests/architecture/save-migration-contract.test.ts` | v0→v10 round-trip via `migrateSaveDataToCurrent`. |
| `tests/armory-crafting.spec.ts`, `tests/gear-combat.spec.ts`, `tests/gear-equip.spec.ts`, `tests/gear-layout.spec.ts` | Playwright E2E specs. |
| `tests/e2e/armory.ts` | Playwright helpers: `openArmory`, `gearItemLocator`, `currencyLocator`, `activateCurrency`, `applyCurrencyToGear`, `enterSalvageMode`, `salvageInventoryItem`, `confirmSalvage`, `expectSalvageDialog`, `pointerDrag`, `pointerDragToInventory`. |
