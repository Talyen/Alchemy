# Armory

The Armory is the permanent meta-progression screen for managing **Gear** (per-character equipment with affix rolls), fixed collectible **Trinkets**, and **Crafting Currencies**. It is the primary surface for `useGearArmorySlice` and the gateway to their in-battle effects.

> **Related:** [ARCHITECTURE.md § Permanent Gear](./ARCHITECTURE.md#permanent-gear-gear-store), [REFERENCE.md § Domain Glossary](./REFERENCE.md#domain-glossary), [WORKFLOWS.md § Add permanent Gear](./WORKFLOWS.md#add-permanent-gear).

## Layout

The screen implementation lives under
`src/features/alchemy/meta/screens/armory/` (controller + parts) and
`src/features/alchemy/meta/screens/armory-screen.tsx` (composition). Start from these owners:

- `use-armory-controller.ts` — read facade and mutation/HP-sync/save-flush boundary consumed by the route.
- `armory-screen.tsx` (sibling of `armory/`) — screen composition and interaction wiring.
- `item-picker-grid.tsx` — slot-filtered inventory presentation.
- Panels, parts, and overlays — presentation only; they receive domain state and commands through props.

Visual layout, copy, pagination, and targeting details belong to the screen
implementation and its focused tests; keep this document centered on the gear
contract and controller seams.

## Data model

`src/lib/gear/types.ts`, `types-core.ts`, and `crafting.ts` are authoritative. Durable invariants:

- A saved `GearInstance` has a stable unique `instanceId`, a `definitionId`, and rolled `affixes`; it never embeds definition objects or art URLs.
- Inventories and loadouts are keyed by character. A loadout maps each slot to at most one instance ID.
- Permanent Trinkets are unique definition IDs in `ownedTrinketIds`, not generated `GearInstance` values; they have no rarity, affixes, crafting, or salvage.
- `equippedTrinkets` maps each character to one owned Trinket at most. Equipping a shared Trinket moves it from any other character.
- Definitions own compatible slots, hand rules, affinity keywords, salvage value, and presentation metadata. One-handed melee weapons and wands may occupy `main-hand` or `off-hand`; two-handers and ranged weapons stay main-hand only (ranged pairs with a quiver off-hand).
- Gear slots are `main-hand`, `off-hand`, `body`, `left-accessory`, and `right-accessory`. Both Accessory slots accept Rings or Amulets. The Armory lays these out over `left-accessory | trinket | right-accessory`; the dedicated Trinket slot accepts only permanent Trinkets.
- **Unique** is a third Gear rarity (alongside basic and astral). Each unique is a named definition with a fixed signature affix plus three supporting affixes. Crafting currencies cannot modify uniques. Salvage yields a guaranteed crafting-currency package (2 Discordant Dice, 1 Ascension Seal, 1 Severance Maw, 1 Smith's Whetstone) plus homestead materials at the unique/astral salvage table. Collection tracks discovered unique definition IDs independently of current inventory, so salvage does not hide an already-found unique.
- Uniqueness is inventory-scoped: a unique definition is excluded from shops and rewards while any character still holds an instance. Salvaging it returns that definition to the drop pool. Reward and shop screens never offer the same unique twice, and never pair a unique with another item of the same base item.
- Drop/shop tables live in `src/lib/game-constants/run-rewards.ts`: equipment shop 5% unique / 35% astral / 60% basic (unique rolls degrade to astral when none remain); normal gear rewards 5% unique / 8% astral / remainder basic; boss gear rewards 30% unique / remainder astral. A separate permanent-Trinket replacement gate (`GEAR_REWARD_PERMANENT_TRINKET_CHANCE`) runs before gear generation: Wildwood first rolls Gear on one of three reward branches, then applies the 1/3 gate, for an effective 1/9 (~11%) overall chance; boss gear surfaces use 30%, falling back to Gear when no unowned Trinkets remain.

## State flow

| Layer       | Owner                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Pure rules  | `src/lib/gear/` — types, definitions, affixes, crafting, generation                                                                    |
| Aggregate   | `gameplay-state-store` gear region via `gear-store.ts` (selectors + persistence codec) and `gear-session-command.ts` (HP-sync wrapper) |
| Screen      | Armory route → `use-armory-controller.ts` → `armory-screen.tsx`                                                                        |
| Battle      | `computeGearManifest` → `BattleState.gearEffects`; rebound on live meta mutation                                                       |
| Persistence | `subscribeAlchemyPersistence` / `encodePersistenceFields`                                                                              |

### Read paths

- **`Armory lock`** — computed from generated Gear or permanent Trinket ownership via `useIsArmoryLocked()` in `gear-store.ts`; `MenuScreen` receives a `locked` prop, it does not read the store. Combat does not lock the Armory.
- **`ArmoryScreen`** — reads Gear, Trinket ownership/equipment, and crafting currencies via `useGearArmorySlice`.
- **`useArmoryController`** — facade hook that bundles the read-only slice plus the mutation callbacks.
- **Battle** — `computeGearManifest` is applied at battle start and rebound onto the live `BattleState` whenever gear, talents, or homestead change.
- **Run start** — `content-system-run-init.ts` snapshots `computeGearManifest.maxHealth` into `RunStartSnapshot.gearMaxHealthBonus`.

### Write paths

There is no external `useGearStore` hook. Gear mutations run against a `GearStore` view of the aggregate state and commit through session commands:

- `dispatchGearMutationWithRunHealthSync({ mutate, syncRunHealth? })` — for HP-affecting ops (`equip`, `unequip`, `applyCurrency`, `addInstance`) when the caller is **not** already inside `dispatchRunSessionCommand`. Inside an existing command (shop buy, rewards, mystery), call `mutateGearWithRunHealthSync(draft, { mutate, syncRunHealth? })` instead. HP sync runs through `rebindLiveRunMeta` when `syncRunHealth ?? draft.session.hasActiveRun`. `mutate` receives a `GearStore` handle and may edit any character's loadout (for example Armory browsing another hero while a run is in progress): `(state) => state.equip(loadoutCharacterId, slot, instance)`.

1. **Equip / Unequip** — `dispatchGearMutationWithRunHealthSync({ mutate: (state) => state.equip(characterId, slot, instance) })` and `(state) => state.unequip(characterId, slot)`.
2. **Salvage** — preview rolls `computeSalvageYield` (definition `salvageValue` homestead materials + `rollSalvageYield` crafting currencies). Confirm passes that frozen yield into `dispatchGearSalvageWithMaterialGrant((state) => state.salvage(instanceId, { yield }))`, which HP-syncs, then grants homestead materials in the same command via `awardMaterialsDuringRun` (active run) or `addMaterials` (meta).
3. **Crafting-currency apply** — `(state) => state.applyCurrency(currencyId, instanceId, { rng })` mutates the item's affixes via `applyCraftingCurrency`.
4. **Add new instance (rewards / shop / dev spawn)** — Armory/dev spawn: `dispatchGearMutationWithRunHealthSync({ mutate: (state) => state.addInstance(instance, characterId) })`. Shop and in-run reward commands already own a draft: `mutateGearWithRunHealthSync(draft, { mutate: (gear) => gear.addInstance(instance, characterId) })`.
5. **Permanent Trinkets** — use `addTrinket`, `equipTrinket`, and `unequipTrinket` on the Gear aggregate. Rewards and the Trinket Shop add ownership inside their existing run-session command; acquisition never auto-equips or creates a Boon.

### `useArmoryController` facade

The route wrapper (`src/app/screen-routes/meta-routes.tsx`) does not mutate gear directly. It consumes `useArmoryController()`, which:

- Reads `inventories`, `loadouts`, and `craftingCurrencies` from `useGearArmorySlice`.
- Routes `equip`/`unequip` through `dispatchGearMutationWithRunHealthSync` (HP-sync side effect).
- Routes `applyCurrency` through `dispatchGearMutationWithRunHealthSync` and flushes the save on success.
- Routes `salvage` through `dispatchGearSalvageWithMaterialGrant` and flushes the save on success.
- Provides a dev-only `onSpawnDevGear` that calls `generateDevRandomGearInstance` through `dispatchGearMutationWithRunHealthSync` and flushes the save.
- Reports `browseOnly: false` (combat does not lock the Armory) and `finishedRunCharacters` for the screen.

## Battle integration

Gear effects are **snapshotted** at battle start. `computeGearManifest(characterId, inventory, loadouts)` flattens equipped Gear into `BattleState.gearEffects`. Battle code never reads the Gear aggregate during a fight.

Effect keys are listed in `GEAR_EFFECT_KEYS` (`src/lib/gear/gear-effect-manifest.ts`). Each entry in `gearAffixCatalog` declares its `effectKey: keyof GearEffectManifest`. The architecture guards `tests/architecture/affix-catalog-guard.test.ts` and `src/lib/content-validation/validators-gear.ts` assert:

- Every `effectKey` in the catalog is a member of `GEAR_EFFECT_KEYS` (catches silent zero-roll typos).
- Every key in `GEAR_EFFECT_KEYS` is referenced by at least one affix.
- The keys are unique.

## Persistence

Saves are written/read via `buildAlchemySaveDataFromStores` (`src/features/alchemy/shared/storage/persistence.ts`), which serializes five Gear-owned fields:

| Field                | Notes                                                              |
| -------------------- | ------------------------------------------------------------------ |
| `gearInventories`    | `Record<CharacterId, GearInstance[]>` — per-character inventories. |
| `gearLoadouts`       | `Record<CharacterId, GearLoadout>` — pruned of orphan references.  |
| `ownedTrinketIds`    | Unique permanent Trinket definition IDs.                           |
| `equippedTrinkets`   | Per-character equipped Trinket ID, normalized for exclusivity.     |
| `craftingCurrencies` | `Record<CraftingCurrencyId, number>`.                              |

Do not duplicate the current schema number here. [`MIGRATIONS.md`](../src/features/alchemy/shared/storage/MIGRATIONS.md) and `src/lib/validation/metadata.ts` own the supported floor and current version. Gear shape changes follow that migration contract: safe additive fields may use schema defaults, while transforms require a versioned migration.

`use-app-save-state.ts` (`useAlchemyAutosaveFromStores`) subscribes through `subscribeAlchemyPersistence`, which combines settings changes with the committed gameplay-session signal (run domain, transient/battle state, run profile, profile, and gear); changes are debounced before writing. `buildAlchemySaveDataFromStores` assembles the snapshot through `encodePersistenceFields`. The gear mutation callbacks in `useArmoryController` also call `flushSaveAfterGearMutation` (lifecycle port) after mutations during an active run.

## Tests

Use the path-scoped Gear gate in
[`CONTRIBUTING.md`](../CONTRIBUTING.md#what-to-run-when-you-change) rather than
maintaining a second exhaustive command here. Test ownership is split between
pure Gear rules, aggregate/persistence contracts, Armory screen behavior,
architecture guards, and player flows; the changed-path route selects the
current files for each layer.
