# Armory

The Armory is the permanent meta-progression screen for managing **Gear** (per-character equipment with affix rolls) and **Crafting Currencies** (six material types used to upgrade gear). It is the primary surface for `useGearArmorySlice` and the gateway to in-battle gear effects.

> **Related:** [ARCHITECTURE.md § Permanent Gear](./ARCHITECTURE.md#permanent-gear-gear-store), [REFERENCE.md § Domain Glossary](./REFERENCE.md#domain-glossary), [WORKFLOWS.md § Add permanent Gear](./WORKFLOWS.md#add-permanent-gear).

## Layout

The screen implementation lives under `src/features/alchemy/meta/screens/armory/`. Start from these owners:

- `use-armory-controller.ts` — read facade and mutation/HP-sync/save-flush boundary consumed by the route.
- `armory-screen.tsx` — hero tabs, 3×2 equipment slots, Crafting strip, and slot-filtered item picker.
- `item-picker-grid.tsx` — Collection-style click-to-equip grid for the selected slot.
- Panels, parts, and overlays — presentation only; they receive domain state and commands through props.

Hero identity is the Collection-style tab ring. There is no hero portrait and no packed inventory board. Selecting an equipment slot shows matching items on the right; clicking an item equips it into that slot (or unequips if it is already in that slot). Salvage and currency apply are mutually exclusive targeting modes from the Crafting strip.

## Data model

`src/lib/gear/types.ts`, `types-core.ts`, and `crafting-types.ts` are authoritative. Durable invariants:

- A saved `GearInstance` has a stable unique `instanceId`, a `definitionId`, and rolled `affixes`; it never embeds definition objects or art URLs.
- Inventories and loadouts are keyed by character. A loadout maps each slot to at most one instance ID.
- Definitions own compatible slots, hand rules, affinity keywords, salvage value, and presentation metadata.
- Equipment slots are `main-hand`, `off-hand`, `body`, `left-ring`, `right-ring`, and `amulet` (UI labels: Weapon 1, Weapon 2, Armor, Ring 1, Ring 2, Amulet).

## State flow

| Layer       | Owner                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Pure rules  | `src/lib/gear/` — types, definitions, affixes, crafting, generation                                                                    |
| Aggregate   | `gameplay-state-store` gear region via `gear-store.ts` (selectors + persistence codec) and `gear-session-command.ts` (HP-sync wrapper) |
| Screen      | Armory route → `use-armory-controller.ts` → `armory-screen.tsx`                                                                        |
| Battle      | `computeGearManifest` → immutable `BattleState.gearEffects`; battle code never reads the Gear aggregate mid-fight                      |
| Persistence | `subscribeAlchemyPersistence` / `encodeAlchemyPersistenceFields`                                                                       |

### Read paths

- **`Armory lock`** — computed at the app layer: `useIsArmoryLocked() = !useHasAnyOwnedGear()` (in `app-overlays.tsx`); `MenuScreen` receives a `locked` prop, it does not read the store.
- **`ArmoryScreen`** — reads `inventories`, `loadouts`, and `craftingCurrencies` via `useGearArmorySlice`.
- **`useArmoryController`** — facade hook that bundles the read-only slice plus the mutation callbacks.
- **Battle** — `computeGearManifest(characterId, inventory, loadouts)` is called in `battle-init.ts` and produces a flat `GearEffectManifest` copied into `BattleState.gearEffects` at battle start.
- **Run start** — `content-system-navigation.ts` snapshots `computeGearManifest.maxHealth` into `RunStartSnapshot.gearMaxHealthBonus`.

### Write paths

There is no external `useGearStore` hook. Gear mutations run against a `GearStore` view of the aggregate state and commit through session commands:

- `dispatchGearMutationWithRunHealthSync({ characterId, mutate })` — for HP-affecting ops (`equip`, `unequip`, `salvage`, `applyCurrency`). `mutate` is called with a `GearStore` handle (e.g. `(state) => state.equip(characterId, slot, instance)`) and run max-health is re-synced from before/after gear snapshots.
- `dispatchRunSessionCommand(() => gear.<method>(...))` — for `addInstance` (dev spawn / rewards).

1. **Equip / Unequip** — `dispatchGearMutationWithRunHealthSync({ characterId, mutate: (state) => state.equip(characterId, slot, instance) })` and `(state) => state.unequip(characterId, slot)`.
2. **Salvage** — `(state) => state.salvage(instanceId, { rng })` removes from inventory + loadouts and rolls `rollSalvageYield` for crafting currencies.
3. **Crafting-currency apply** — `(state) => state.applyCurrency(currencyId, instanceId, { rng })` mutates the item's affixes via `applyCraftingCurrency`.
4. **Add new instance (rewards / shop / dev spawn)** — `dispatchRunSessionCommand(() => gear.addInstance(instance, characterId))`.

### `useArmoryController` facade

The route wrapper (`src/app/screen-routes/meta-routes.tsx`) does not mutate gear directly. It consumes `useArmoryController()`, which:

- Reads `inventories`, `loadouts`, and `craftingCurrencies` from `useGearArmorySlice`.
- Routes `equip`/`unequip` through `dispatchGearMutationWithRunHealthSync` (HP-sync side effect).
- Routes `salvage`/`applyCurrency` through `dispatchGearMutationWithRunHealthSync` and flushes the save on success.
- Provides a dev-only `onSpawnDevGear` that calls `generateDevRandomGearInstance` + `addInstance` and flushes the save.
- Reports `browseOnly = hasActiveBattle` and `finishedRunCharacters` for the screen.

## Battle integration

Gear effects are **snapshotted** at battle start. `computeGearManifest(characterId, inventory, loadouts)` flattens equipped Gear into `BattleState.gearEffects`. Battle code never reads the Gear aggregate during a fight.

Effect keys are listed in `GEAR_EFFECT_KEYS` (`src/lib/gear/gear-effect-manifest.ts`). Each entry in `gearAffixCatalog` declares its `effectKey: keyof GearEffectManifest`. The architecture guard `tests/architecture/gear-affix-effect-keys.test.ts` asserts:

- Every `effectKey` in the catalog is a member of `GEAR_EFFECT_KEYS` (catches silent zero-roll typos).
- Every key in `GEAR_EFFECT_KEYS` is referenced by at least one affix.
- The keys are unique.

## Persistence

Saves are written/read via `buildAlchemySaveDataFromStores` (`src/features/alchemy/shared/storage/build-save-data-from-stores.ts`), which serializes three Gear-owned fields:

| Field                | Notes                                                              |
| -------------------- | ------------------------------------------------------------------ |
| `gearInventories`    | `Record<CharacterId, GearInstance[]>` — per-character inventories. |
| `gearLoadouts`       | `Record<CharacterId, GearLoadout>` — pruned of orphan references.  |
| `craftingCurrencies` | `Record<CraftingCurrencyId, number>`.                              |

Do not duplicate the current schema number here. [`MIGRATIONS.md`](../src/features/alchemy/shared/storage/MIGRATIONS.md) and `src/lib/validation/metadata.ts` own the supported floor and current version. Gear shape changes follow that migration contract: safe additive fields may use schema defaults, while transforms require a versioned migration.

`use-app-save-state.ts` (`useAlchemyAutosaveFromStores`) subscribes through `subscribeAlchemyPersistence`, which combines settings changes with the committed gameplay-session signal (run domain, transient/battle state, run profile, profile, and gear); changes are debounced before writing. `buildAlchemySaveDataFromStores` assembles the snapshot through `encodeAlchemyPersistenceFields`. The gear mutation callbacks in `useArmoryController` also call `flushAlchemySaveNow` after mutations during an active run.

## Tests

Use the path-scoped Gear gate in [`CONTRIBUTING.md`](../CONTRIBUTING.md#what-to-run-when-you-change) rather than maintaining a second exhaustive command here. Test ownership is intentionally split:

- `tests/lib/gear/` — pure definitions, operations, generation, crafting, and manifests.
- `tests/features/alchemy/shared/stores/gear-*.test.ts` and `shared/storage/gear-save.test.ts` — aggregate mutation and persistence.
- `tests/features/alchemy/meta/screens/armory*/` — controller, rendering, targeting, and click-to-equip.
- `tests/architecture/gear-*.test.ts` and save-migration guards — registry and persistence contracts.
- `tests/*gear*.spec.ts`, `tests/armory-*.spec.ts`, and `tests/e2e/armory.ts` — player flows and Playwright helpers.
