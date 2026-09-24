# Armory

The Armory is the permanent meta-progression screen for managing **Gear** (per-character equipment with affix rolls), fixed collectible **Trinkets**, and **Crafting Currencies**. It is the primary surface for `useGearArmorySlice` and the gateway to their in-battle effects.

> **Related:** [ARCHITECTURE.md § Permanent Gear](./ARCHITECTURE.md#permanent-gear-gear-store), [GAME_RULES.md § Domain Glossary](./GLOSSARY.md#domain-glossary), [WORKFLOWS.md § Add permanent Gear](./WORKFLOWS.md#add-permanent-gear).

## Layout

The screen implementation lives under `src/features/alchemy/meta/screens/`.
Start from these owners:

- `use-armory-controller.ts` — read facade and mutation/HP-sync/save-flush boundary consumed by the route.
- `armory-screen.tsx` (sibling of `armory/`) — screen composition and interaction wiring.
- `armory/armory-equipment-panel.tsx` and `armory/armory-picker-panel.tsx` — equipment and inventory presentation, receiving targeting state and callbacks from the screen.
- `armory/` — picker grids (`ArmoryPagedGrid` owner in `paged-picker-grid.tsx`, slot-filtered via `itemsMatchingSlot` in `armory-screen-actions.ts`), targeting state (`use-armory-targeting-state.ts`, `armory-item-state.ts`), panels, parts, and overlays — presentation only; they receive domain state and commands through props.

Targeting interaction contract: `use-armory-targeting-events.ts` derives its click/context-menu regions from one `ARMORY_TARGETING_SELECTORS` map. Adding an Armory interactive element requires updating that map and keeping the targeting-events matrix test in sync.

Visual layout, copy, and pagination belong to the screen
implementation and its focused tests; keep this document centered on the gear
contract and controller seams.

## Data model

`src/lib/gear/definitions.ts`, `crafting.ts`, and `crafting-ids.ts` are authoritative. Item titles live with definitions (`getGearInstanceTitle`), and canonical affix resolution is centralized in `getGearInstanceAffixes`. Affix pool/roll helpers live in `affix-pool.ts` so generation and crafting depend down. Durable invariants:

- A saved `GearInstance` has a stable unique `instanceId`, a `definitionId`, and rolled `affixes`; it never embeds definition objects or art URLs.
- Inventories and loadouts are keyed by character. A loadout maps each slot to at most one instance ID.
- Permanent Trinkets are unique definition IDs in `ownedTrinketIds`, not generated `GearInstance` values; they have no rarity, affixes, crafting, or salvage.
- `equippedTrinkets` maps each character to one owned Trinket at most. Equipping a shared Trinket moves it from any other character.
- Definitions own compatible slots, hand rules, affinity keywords, salvage value, and presentation metadata. One-handed melee weapons and wands may occupy `main-hand` or `off-hand`; two-handers and ranged weapons stay main-hand only (ranged pairs with a quiver off-hand).
- Hand conflicts are resolved when equipping a hand slot; equipping body armor or accessories preserves valid weapon/off-hand pairs. The Armory grid UI enforces slot legality via `isGearCompatibleWithLoadoutSlot` before allowing equipment (e.g. requiring a player to unequip a Quiver before equipping a melee weapon), while `pruneOrphanGearLoadouts` and `salvageGear` ensure cascade-pruning against the updated inventory. Removing, salvaging, or transferring a ranged weapon also unequips its unsupported Quiver without removing the Quiver from inventory. The same cleanup repairs unsupported saved Quivers. Loading also clears an off-hand item saved alongside a two-handed main-hand, and a non-quiver off-hand saved alongside a ranged main-hand, matching what the equip path would produce.
- Gear slots are `main-hand`, `off-hand`, `body`, `left-accessory`, and `right-accessory`. Both Accessory slots accept Rings or Amulets. The Armory lays these out over `left-accessory | trinket | right-accessory`; the dedicated Trinket slot accepts only permanent Trinkets.
- **Unique** is a third Gear rarity (alongside basic and astral). Each base item has exactly one named Unique with one exclusive signature and three fixed standard supporting affixes. Supporting rolls always use the standard Unique/Astral maximum from the affix catalog; the signature has its own fixed magnitude. Generation, tooltips, manifests, and saved-item normalization share these canonical affixes, and saved Unique instances store no rolls at all — older saves carrying stored rolls converge on the catalog at load without changing identity, ownership, or Collection discovery. Crafting currencies cannot modify uniques. Unique salvage follows the crafting and homestead salvage definitions. Collection tracks discovered unique definition IDs independently of current inventory, so salvage does not hide an already-found unique.
- Uniqueness is inventory-scoped: a unique definition is excluded from shops and rewards while any character still holds an instance. Salvaging it returns that definition to the drop pool. Reward and shop screens never offer the same unique twice, and never pair a unique with another item of the same base item.

Presentation follows [UI item shine](./UI.md#item-shine). Pass affix identity and normalized values together so tooltip text and max-roll shine use the same item data.

## Loot tuning

- Random loot uses `src/lib/loot/`: source weights, depth curves, and account multipliers live together in `src/lib/game-constants/run-rewards.ts`, while gear affix-count tuning lives in `src/lib/game-constants/gear.ts` alongside the salvage chances. Combat, Wildwood, equipment shops, and random mystery Gear resolve these weights before choosing rewards. Boons, crafting, and explicitly promised items are separate from permanent-Trinket eligibility.
- Depth counts locations equally. Campaign includes its opening battle, then destinations across Acts (first boss: depth 9; run cap: depth 25). A pending destination claim counts during initial shop/event generation, keeping depth unchanged when navigation commits that visit. Labyrinth counts cleared non-entrance rooms across floors plus the current pending room — a missing pending node still counts one for the next room — including side rooms and excluding revisits. Wildwood uses its encounter ordinal. `shared/stores/loot-progress.ts` adapts the existing saved state; rewards, follow-ups, and shop refreshes never advance depth.
- Run depth gates premium items; the highest Campaign difficulty cleared by any hero multiplies eligible premium weights account-wide without stacking heroes or bypassing gates. Astral bonuses transfer Basic weight before depth scaling, account bonuses, available-pool filtering, and normalization. Sources with no Basic weight (notably Boss) are unaffected by the bonus. Source profiles retain their full-depth, no-meta baseline distributions.
- Reward screens roll one group from summed eligible weights, then roll each Gear choice independently from those same weights. Cards, Trinkets, and Boons stay grouped. Unavailable pools are excluded before sampling and eligibility is recomputed after every Gear choice. An empty premium/Gear-only source uses Basic Gear; cards are the terminal combat fallback when Gear is unavailable. Bosses can therefore award Basic Gear before premium eligibility. Narrow equipment-shop pools may repeat ordinary bases to fill shelves, but never repeat Uniques or pair a Unique with another offering of its base.
- Newly offered Trinket shops and Astral-guaranteeing events/modifiers respect the same eligibility gates. Labyrinth generation substitutes an equipment shop for an ineligible Trinket shop and uses the minimum reachable room ordinal when assigning Masterwork. Existing maps, saved offers, and explicitly promised Astrals retain their contents; hydration never rerolls or reapplies eligibility. Entering an already-promised Trinket shop initializes its shelf even on an older shallow map; saved shelves remain purchasable, but refreshing is blocked until Trinkets are eligible. Trinket shops draw uniformly from unowned trinkets once eligible: depth gates access but does not weight the shelf, unlike equipment shops. Uniform shelves are the current intent; weight them by depth as a design task if progression demands it.

Edit the source weights and progression points in `run-rewards.ts`, then run `npm run balance:loot`. The seeded report in `reports/loot-progression/report.html` compares premium availability per screen and expected offered items along explicit routes for every account tier and fresh/nearly-complete collections. It counts offers, not acquisitions; three Gear choices can expose premium loot more often than a single item roll. Gear offer rates are estimated by rolling rarities directly rather than generating full instances. The report records sampling uncertainty and holds ownership fixed along each comparison route.

## Materials tuning

Homestead material payouts are tuned separately from gear offers; every knob is inventoried in `src/lib/game-constants/materials-economy.ts`. Per-enemy amounts live in the `enemyLootTables` in `src/lib/homestead/material-rewards.ts` (guaranteed loot plus chance-based bonuses that always pay at least their minimum when they hit). Campaign, Labyrinth, and Wildwood combat victories run the `computeCombatMaterialReward` pipeline there (table, then elite/boss multiplier, then herb-find, then scavenger doubling, then herbalist bonus); mystery grants use `computeMysteryMaterialReward` (herb-find only). That file's policy table is the owner for which modifiers apply to which source. The seeded materials report in `reports/loot-progression/materials.html` (built by the same `npm run balance:loot` command) shows mean base payouts per enemy and enemy type; build-dependent modifiers (herb-find, scavenger, herbalist, end-of-run bonuses) apply afterwards and are not simulated.

## Inventory ordering and equipment movement

Working inventory order and pagination are screen-local and transient while the Armory remains mounted. Remounting the Armory restores default sorting (Unique -> Astral -> Basic, Name A-Z, stable instance ID tie-breaker for Gear; Name A-Z, ID tie-breaker for Trinkets).

- **Order lifetime**: Working order and current page are tracked per hero and equipment category/slot while the Armory remains mounted (`useArmoryOrdering`). Switching heroes or slots preserves the working order and current page for each slot.
- **Inventory changes**: Each category records its default order on first visit. Crafting changes to an existing item keep its position. Missing items are removed; newly available items append in default-sorted batches without moving earlier arrivals. Inactive categories reconcile against current inventory when revisited.
- **Page clamping**: If inventory shrinkage removes the current page, the category remembers the last valid page (page 0 when empty). Later inventory growth does not restore the old page.
- **One-time sorting**: An explicit `Sort` control beside the inventory slot title provides deterministic one-time sorting (`Rarity` or `Name` for Gear, `Name` for Trinkets) and resets pagination to page 0 without altering the persistent save order or automatically maintaining sorted order after future actions.
- **Equipment movement**:
  - **Replacing equipped gear/trinket**: The unequipped item takes the exact inventory position of the equipped item being replaced, without shifting other items or changing pagination.
  - **Equipping into an empty slot**: The item is removed from the inventory grid, and subsequent items shift up/reflow to close the gap.
  - **Unequipping gear/trinket**: The unequipped item is inserted at the first position of the currently viewed page (or index 0), shifting subsequent items down.
- **Hand conflicts**: Equipping a two-handed weapon in main-hand displaces the off-hand item: the main-hand replaced item takes the incoming slot's position; any displaced off-hand item compatible with the current category (such as a 1H weapon) is placed immediately following; incompatible displaced items (such as a shield) are removed from the active category view and return to their own category.

Transfer orchestration lives in `armory/use-armory-transfers.ts`. After a successful
Gear equip, ordering receives one `commitEquip` operation with the replacement
and hand conflicts. Trinkets use the same placement operation. Inventory placement
never depends on artwork, DOM measurements, or reduced motion. The existing
`equipGear` rule describes displaced slots; the controller remains the mutation
boundary.

`armory-transfer-dom.ts` measures the pre-commit layout; the pure
`armory-transfer-presentation.ts` builds optional flights for both Gear and
Trinkets. Active flights are the single source of hidden artwork. Completion,
scroll, resize, and screen selection changes settle flights and placeholders;
operations without flights clear their placeholder immediately.

## Combat equipment restrictions

`gear-combat-restrictions.ts` derives reservations from the current battle, including while visiting meta screens. The loadout stays reserved through pending transitions until the battle lifecycle ends; ending the run releases it. Restrictions are derived after reload and require no extra saved fields.

A reserved hero’s Armory tab remains browsable but cannot equip, unequip, craft,
salvage. Other heroes remain editable. Blocked
attempts on the reserved hero’s tab play the error sound and show a red
“Equipment cannot be changed during Combat.” message; browsing the tab stays
silent with no persistent banner. Inventory is
browsed across characters: Gear and permanent Trinkets equipped by a reserved
hero cannot be taken by another hero, and no item owned by or equipped on the
reserved hero can be crafted or salvaged from any tab — including unequipped
items in their inventory, which the store boundary blocks even when reached
through another hero's tab. Unused items owned by other heroes remain
editable through other heroes’ tabs. Acquisition adds inventory normally.

The gear command boundary (`gear-session-command.ts` via `dispatchGearMutationWithRunHealthSync` / `dispatchGearSalvageWithMaterialGrant`) enforces the same reservations before running the mutator;
blocked actions spend no currencies, roll no RNG, award no salvage, and trigger
neither combat rebinding nor an explicit save flush. The UI shows a lock and a
reason naming the reserved hero while preserving inspection. Talent and
Homestead mutation timing remains unchanged.

## State flow

- **Pure rules** — `src/lib/gear/` — types, definitions, affixes, crafting, generation
- **Aggregate** — `gameplay-state-store` gear region via `gear-store.ts` (selectors + persistence codec) and `gear-session-command.ts` (HP-sync wrapper)
- **Screen** — Armory route → `use-armory-controller.ts` → `armory-screen.tsx`
- **Battle** — `computeGearManifest` → `BattleState.gearEffects`; rebound on live meta mutation
- **Persistence** — `subscribeAlchemyPersistence` / `buildAlchemySaveDataFromStores` + immediate `flushSaveAfterGearMutation` (fire-and-forget; autosave owns retry)

### Read paths

- **`Armory lock`** — computed from generated Gear or permanent Trinket ownership via `useIsArmoryLocked()` in `gear-store.ts`; `MenuScreen` receives a `locked` prop, it does not read the store. Combat preserves browsing but makes each battling hero’s Armory tab read-only; see [Combat equipment restrictions](#combat-equipment-restrictions).
- **`ArmoryScreen`** — reads Gear, Trinket ownership/equipment, and crafting currencies via `useGearArmorySlice`, combat reservations via `useGearCombatRestrictions`, plus finished-run and active-run reads bundled in `useArmoryController`.
- **Interaction policy** — `armory-item-state.ts` owns inventory/equipment click decisions alongside targeting affordances. Equipped slots retain locked browsing; inventory tiles retain reservation and compatibility guards. `use-armory-targeting-state.ts` owns mutually exclusive idle, salvage, currency, and salvage-confirmation modes through intent callbacks. Store commands still validate authoritative mutations.
- **`useArmoryController`** — facade hook that bundles the read-only slice plus the mutation callbacks.
- **Battle** — `computeGearManifest` is applied at battle start and rebound onto the live `BattleState` whenever gear, talents, or homestead change.
- **Run start** — `run-start-command.ts` snapshots `computeGearManifest.maxHealth` into `RunStartSnapshot.gearMaxHealthBonus`.

### Write paths

There is no external `useGearStore` hook. Gear mutations run against a `GearDraftView` of the aggregate state and commit through session commands. Which wrapper to use:

- **Outside a run command (Armory screen, dev spawn)** — `dispatchGearMutationWithRunHealthSync({ mutate, syncRunHealth? })`
- **Inside an existing command (shop buy, rewards, mystery)** — `mutateGearWithRunHealthSync(draft, { mutate, syncRunHealth? })`

After a Gear change, `rebindLiveRunMeta` synchronizes health when a run is active, unless the caller explicitly overrides `syncRunHealth`. Unchanged or rejected mutations do not rebind. `mutate` receives a `GearDraftView` handle and may edit any character's loadout (for example Armory browsing another hero while a run is in progress): `(state) => state.equip(loadoutCharacterId, slot, instance)`.

1. **Equip / Unequip** — `dispatchGearMutationWithRunHealthSync({ mutate: (state) => state.equip(characterId, slot, instance) })` and `(state) => state.unequip(characterId, slot)`.
2. **Salvage** — preview with `computeSalvageYield` (definition `salvageValue` homestead materials + crafting currencies drawn from the existing rarity table using a seed derived from the stable instance ID). Reopening, reloading, and changing affixes do not reroll rewards; upgrading rarity uses the new rarity table. Confirm calls `dispatchGearSalvageWithMaterialGrant((state) => state.salvage(instanceId))`, which recomputes the same deterministic yield in the store rather than trusting the preview value, then HP-syncs and grants homestead materials in the same command via `awardMaterialsDuringRun` (active run) or `addMaterialsToStockpile` (meta). Confirm always pays exactly the preview.
3. **Crafting-currency apply** — `(state) => state.applyCurrency(currencyId, instanceId, { rng })` mutates the item's affixes via `applyCraftingCurrency`. The controller injects profile-lifetime randomness, defaulting to `Math.random`, for crafting and dev spawning; neither consumes a run RNG stream. Salvage uses its stable instance-derived seed instead.
4. **Add new instance (rewards / shop / dev spawn)** — Armory/dev spawn: `dispatchGearMutationWithRunHealthSync({ mutate: (state) => state.addInstance(instance, characterId) })`. Shop and in-run reward commands already own a draft: `mutateGearWithRunHealthSync(draft, { mutate: (gear) => gear.addInstance(instance, characterId) })`.
5. **Permanent Trinkets** — use `addTrinket`, `equipTrinket`, and `unequipTrinket` on the Gear aggregate. Rewards and the Trinket Shop add ownership inside their existing run-session command; acquisition never auto-equips or creates a Boon.

### Salvage materials

Base item construction owns homestead salvage materials; rarity increases quantities rather than introducing affinity-based Herbs. Metal equipment yields Iron, wooden equipment yields Wood, magical staves and wands combine Wood and Gems, and jewelry and spellbooks yield Gems. Leather Armor and Quivers yield Hide, and the Leather Buckler yields Wood and Hide for its backing. Herbs remain available from enemy loot, Herb Garden progression, and run-end Homestead bonuses; removing gear Herbs reduces an optional supply, not access to progression. Currency rarity distributions remain unchanged.

### `useArmoryController` facade

The route wrapper (`src/app/screen-routes/meta-routes.tsx`) consumes `useArmoryController` for the [read paths](#read-paths) and [write paths](#write-paths) above. The facade supplies combat reservations and finished-run characters, routes mutations through the appropriate Gear wrapper, and calls `flushSaveAfterGearMutation` only after success. Rejected taps remain feedback-only. Dev spawning uses `generateDevRandomGearInstance` through the same mutation and flush boundary.

## Battle integration

Gear effects are **snapshotted** at battle start. `computeGearManifest(characterId, inventory, loadouts)` flattens equipped Gear into `BattleState.gearEffects`. Allowed Gear, talent, and Homestead mutations refresh that manifest through `rebindLiveRunMeta` in the same session command. Battle calculations read the battle manifest, never the Gear aggregate directly. `battle/gear-effects.ts` holds only shared helpers, not a dispatch table: each consumer reads the manifest where its effect applies.

Trinket effects snapshot the same way via `computeTrinketManifest` (`src/lib/trinkets.ts`) over run Boons plus the equipped Trinket. Every `TrinketManifest` key is granted by at least one trinket and has a documented battle/run consumer; the key→consumer map lives in the manifest coverage test (`tests/lib/content-validation/trinket-validation.test.ts`) and fails compilation when a key is added or removed without updating it.

Lifegiving grants 1 Health per turn at every rarity and remains eligible for ordinary gear. Fixed roll values do not imply unique-only eligibility; `uniqueOnly` owns that restriction. Emberforged grants Forge only on the first Burn attack each turn (Basic: 1; Astral: 2); multiple equipped copies add their amounts but share the turn limit. Companion and delayed effects do not spend this card-attack trigger. Saved inventory rolls for these two affixes are bounded to their current rarity ranges during normalization, tooltip generation, and battle-manifest construction. Existing combat snapshots retain their captured magnitudes until normal live meta rebinding or the next battle.

The ordinary reactive affixes use the event named in their tooltip. Rotbloom gives one normal Poison tick per equipped copy when a card is Consumed: it deals damage, applies Poison riders, and advances decay without removing the whole stack. Distilled requires Mana actually paid for that card, while Afterglow checks whether it was the last card in hand when played. Bloodward rolls once per Leech restoration and bases its Block on Health actually restored. Smithguard grants Block only when attack spending takes Forge from a positive amount to zero. Layered increases positive Armor grants, including starting Armor, but does not create Armor by itself.

Effect keys are listed in `GEAR_EFFECT_KEYS` (`src/lib/gear/gear-effect-manifest.ts`). Each entry in `gearAffixCatalog` declares its `effectKey: keyof GearEffectManifest`. The architecture guards `tests/architecture/affix-catalog-guard.test.ts` and `src/lib/content-validation/validators-gear.ts` assert:

- Every `effectKey` in the catalog is a member of `GEAR_EFFECT_KEYS` (catches silent zero-roll typos).
- Every key in `GEAR_EFFECT_KEYS` is referenced by at least one affix.
- The keys are unique.

## Persistence

Saves are written/read via `buildAlchemySaveDataFromStores` (`src/features/alchemy/shared/storage/persistence.ts`), which assembles the full save snapshot (settings + profile + gear + run-profile fields, plus versions and the active run). Five of those fields are Gear-owned:

- **`gearInventories`** — `Record<CharacterId, GearInstance[]>` — per-character inventories.
- **`gearLoadouts`** — `Record<CharacterId, GearLoadout>` — pruned of orphan references.
- **`ownedTrinketIds`** — Unique permanent Trinket definition IDs.
- **`equippedTrinkets`** — Per-character equipped Trinket ID, normalized for exclusivity.
- **`craftingCurrencies`** — `Record<CraftingCurrencyId, number>`.

Do not duplicate the current schema number here. [`MIGRATIONS.md`](../src/features/alchemy/shared/storage/MIGRATIONS.md) and `src/lib/validation/metadata.ts` own the supported floor and current version. Gear shape changes follow that migration contract: safe additive fields may use schema defaults, while transforms require a versioned migration.

`use-app-save-state.ts` (`useAlchemyAutosaveFromStores`) subscribes through `subscribeAlchemyPersistence`, which combines settings changes with the committed gameplay-session revision signal; changes are debounced before writing. `buildAlchemySaveDataFromStores` assembles the snapshot through `encodePersistenceFields`. The gear mutation callbacks in `useArmoryController` also call `flushSaveAfterGearMutation` (`run-lifecycle.ts`) after successful mutations.

## Unique combat effects

[Unique items](./UNIQUE_ITEMS.md) records the approved signatures, supporting-affix policy, and combat interaction rules.

## Tests

Gear rule coverage lives in `tests/lib/gear/` (`gear`, `generation`,
`crafting`, `crafting-ids`, `crafting-assets`, `salvage-yield`,
`unique-catalog`, `gear-shine`, `display`, `definitions-art`,
`definitions-behavior`, `affixes`, `item-names`, `raw-assets`); aggregate and
persistence contracts in `tests/features/alchemy/shared/stores/gear-*` and
`tests/features/alchemy/shared/storage/gear-save.test.ts`; Armory interaction
in `tests/features/alchemy/meta/screens/armory-screen*.test.tsx` and
`tests/features/alchemy/meta/screens/armory/*.test.ts`; architecture guards in
`tests/architecture/affix-catalog-guard.test.ts` and
`gear-affix-pool-guard.test.ts`; Unique battle behavior in
`tests/lib/battle/unique-effects.test.ts`, `unique-damage-bonuses.test.ts`,
`unique-card-repeats.test.ts`, `unique-card-opportunities.test.ts`,
`enemy-attack-damage.test.ts`, `damage-forge.test.ts`, and `battle-effect-persistence.test.ts`.
`src/lib/content-validation/validators-gear.ts` mirrors the catalog guards so
`npm run content:audit` enforces the same invariants outside vitest. Use
CONTRIBUTING's [changed-path gate](../CONTRIBUTING.md#what-to-run-when-you-change) and
[test value policy](../CONTRIBUTING.md#test-value-and-coverage-strategy) to select
checks for the affected risks.
