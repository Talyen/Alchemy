# Armory

The Armory is available from the first launch, before finding any Gear. It is the permanent meta-progression screen for managing **Gear** (per-character equipment with affix rolls), fixed collectible **Trinkets**, and **Crafting Currencies**. It is the primary surface for `useGearArmorySlice` and the gateway to their in-battle effects.

> **Related:** [ARCHITECTURE.md § Permanent Gear](./ARCHITECTURE.md#permanent-gear-gear-store), [GLOSSARY.md § Domain Glossary](./GLOSSARY.md#domain-glossary), [WORKFLOWS.md § Add permanent Gear](./WORKFLOWS.md#add-permanent-gear).

## Layout

The screen implementation lives under `src/features/alchemy/meta/screens/`.
Start from these owners:

- `shared/stores/commands/gear-commands.ts` — intent commands for equipment, crafting, salvage, and their save checkpoints. `meta-commands.ts` re-exports these for route composition.
- `armory/armory-screen-types.ts` — screen props composed from the gear read slice and route commands.
- `armory-screen.tsx` (sibling of `armory/`) — screen composition and interaction wiring.
- `armory/armory-equipment-panel.tsx` and `armory/armory-picker-panel.tsx` — equipment and inventory presentation, receiving targeting state and callbacks from the screen.
- `armory/` — picker grids (`ArmoryPagedGrid` owner in `paged-picker-grid.tsx`, slot-filtered via `itemsMatchingSlot` in `armory-screen-actions.ts`), targeting state (`use-armory-targeting-state.ts`, `armory-item-state.ts`), panels, parts, and overlays — presentation only; they receive domain state and commands through props.

Targeting interaction contract: `use-armory-targeting-events.ts` owns the workspace, context-menu, currency-click, and salvage-click selector groups. When adding an Armory interactive element, check its membership in those groups and keep the targeting-events matrix test in sync. Header controls and their dismissal behavior follow [Armory browsing UI](./UI_BROWSING.md#armory-crafting-and-salvage).

Visual layout, copy, and pagination belong to the screen
implementation and its focused tests; keep this document centered on the gear
contract and controller seams.

## Data model

New Gear and permanent Trinkets automatically fill a compatible empty slot on the
receiving Hero when **Options → Gameplay → Auto Equip** is enabled (the default).
Acquisition never replaces equipped items or displaces the other hand, and combat
reservations still apply. Rewards, shops, and Mystery grants use the same atomic
acquisition path; Boons remain run effects. Turning the option on does not equip
previously collected items. After the first equippable item, the main-menu Armory
button uses the Talents-style border until the player opens Armory with equipment
to manage. That introduction is saved with the profile. Armory opens on the current
Hero.

`src/lib/gear/definitions.ts`, `crafting.ts`, and `crafting-ids.ts` are authoritative. Item titles live with definitions (`getGearInstanceTitle`), and canonical affix resolution is centralized in `getGearInstanceAffixes`. Affix pool/roll helpers live in `affix-pool.ts` so generation and crafting depend down. Durable invariants:

- A saved `GearInstance` has a stable unique `instanceId`, a `definitionId`, and an `affixes` array. Basic and Astral items persist their rolls; Unique items keep that array empty and resolve canonical affixes from the catalog. Instances never embed definition objects or art URLs.
- Inventories and loadouts are keyed by character. A loadout maps each slot to at most one instance ID.
- Permanent Trinkets are unique definition IDs in `ownedTrinketIds`, not generated `GearInstance` values; they have no rarity, affixes, crafting, or salvage.
- `equippedTrinkets` maps each character to one owned Trinket at most. Equipping a shared Trinket moves it from any other character.
- Definitions own compatible slots, hand rules, affinity keywords, salvage value, and presentation metadata. Placement presets in `base-items.ts` bind legal slots and hand rules together. One-handed melee weapons and wands may occupy `main-hand` or `off-hand`; two-handers and ranged weapons stay main-hand only (ranged pairs with a quiver off-hand).
- `loadout-operations.ts` owns one private hand-pair resolver shared by slot validation, equipping, and saved-loadout repair. Equipping preserves the incoming hand by displacing a conflicting item; save repair preserves main-hand by clearing an invalid off-hand. Quiver requirements reject incompatible selections (including a shield beside a bow or a melee weapon beside a Quiver). Equipping body armor or accessories preserves valid hand pairs. The Armory grid checks legality through `isGearCompatibleWithLoadoutSlot`; `equipGear` applies the same resolution. `pruneOrphanGearLoadouts` removes orphan and duplicate references before validating each hero's hand pair; invalid off-hand references do not reserve another hero's equipment. Save parsing repairs each slot separately so a malformed slot cannot erase valid neighboring equipment; removing, salvaging, or transferring a bow also unequips its unsupported Quiver without removing the Quiver from inventory.
- Gear slots are `main-hand`, `off-hand`, `body`, `left-accessory`, and `right-accessory`. Both Accessory slots accept Rings or Amulets. The Armory lays these out over `left-accessory | trinket | right-accessory`; the dedicated Trinket slot accepts only permanent Trinkets.
- **Unique** is the third Gear rarity alongside Basic and Astral. Each base has
  one named Unique; saved instances retain identity and resolve canonical fixed
  affixes. [Unique items](./UNIQUE_ITEMS.md#affix-contract) owns signature/supporting
  affixes, roll normalization and crafting restrictions. Collection discovery
  survives salvage.
- Uniqueness is inventory-scoped: a unique definition is excluded from shops and rewards while any character still holds an instance. Salvaging it returns that definition to the drop pool. Reward and shop screens never offer the same unique twice, and never pair a unique with another item of the same base item.

Presentation follows [UI item shine](./UI.md#item-shine). Pass affix identity and normalized values together so tooltip text and max-roll shine use the same item data.

Crafting eligibility, rejection messages, and item changes share one private
preparation function in `crafting.ts`. Preparation consumes no RNG; previews
read its rejection message, while application prepares against the current item
and executes the permitted change with the caller's RNG. Store commands spend
currency only when application returns a changed item.

## Loot tuning

- `src/lib/gear/generation.ts` owns Gear offer construction for rewards and equipment shops. One selection loop records each base as ordinary or Unique in a reservation map. The initial sampled base order stays unchanged; eligibility derives from those reservations. Rarity availability is recalculated before each choice; unreserved bases are preferred, ordinary bases may repeat only when a caller requests shelf filling, and a Unique base cannot appear again on that shelf. The public generators keep the source's rarity policy and run RNG sequence.
- Random loot uses `src/lib/loot/`: source weights, depth curves, and account multipliers live together in `src/lib/game-constants/run-rewards.ts`, while gear affix-count tuning lives in `src/lib/game-constants/gear.ts` alongside the salvage chances. Combat, Wildwood, equipment shops, and random mystery Gear resolve these weights before choosing rewards. Boons, crafting, and explicitly promised items are separate from permanent-Trinket eligibility.
- Depth counts locations equally. Campaign includes its opening battle, then destinations across Acts (first boss: depth 9; run cap: depth 25). A pending destination claim counts during initial shop/event generation, keeping depth unchanged when navigation commits that visit. Labyrinth counts cleared non-entrance rooms across floors plus the current pending room — a missing pending node still counts one for the next room — including side rooms and excluding revisits. Wildwood uses its encounter ordinal. `shared/stores/commands/loot-progress.ts` adapts the existing saved state; rewards, follow-ups, and shop refreshes never advance depth.
- Run depth gates premium items; the highest Campaign difficulty cleared by any hero multiplies eligible premium weights account-wide without stacking heroes or bypassing gates. Astral bonuses transfer Basic weight before depth scaling, account bonuses, available-pool filtering, and normalization. Sources with no Basic weight (notably Boss) are unaffected by the bonus. Source profiles retain their full-depth, no-meta baseline distributions.
- Reward screens roll one group from summed eligible weights, then roll each Gear choice independently from those same weights. Cards, Trinkets, and Boons stay grouped. Unavailable pools are excluded before sampling and eligibility is recomputed after every Gear choice. An empty premium/Gear-only source uses Basic Gear; cards are the terminal combat fallback when Gear is unavailable. Bosses can therefore award Basic Gear before premium eligibility. Narrow equipment-shop pools may repeat ordinary bases to fill shelves, but never repeat Uniques or pair a Unique with another offering of its base.
- Newly offered Trinket shops and Astral-guaranteeing events/modifiers respect the same eligibility gates. Labyrinth generation substitutes an equipment shop for an ineligible Trinket shop and uses the minimum reachable room ordinal when assigning Masterwork. Existing maps, saved offers, and explicitly promised Astrals retain their contents; hydration never rerolls or reapplies eligibility. Entering an already-promised Trinket shop initializes its shelf even on an older shallow map; saved shelves remain purchasable, but refreshing is blocked until Trinkets are eligible. Trinket shops draw uniformly from unowned trinkets once eligible: depth gates access but does not weight the shelf, unlike equipment shops. Uniform shelves are the current intent; weight them by depth as a design task if progression demands it.

Labyrinth Hoards force a reward choice group: Arms (both hand slots), Armor
(body), Ring, and Amulet constrain ordinary Basic/Astral Gear choices;
Astral, Unique, and Trinket Hoards constrain the tier. Secondary Accessory
slots share Ring and Amulet bases rather than needing separate modifiers.
Unique and Trinket choices still exclude owned definitions. A premium Hoard is
omitted from a newly generated map before its depth gate, and a saved Hoard
with no eligible choices at victory falls back to the normal reward roll.

Edit the source weights and progression points in `run-rewards.ts`.

### Loot progression report

`npm run balance:loot` writes HTML and JSON to `reports/loot-progression/`. It uses the shared loot policy and Gear generator with deterministic per-cell seeds, comparing source/depth breakpoints, all account-clear tiers, and fresh versus nearly-complete collections. Route definitions are included in both outputs. Counts represent offered items, not acquisitions; ownership stays fixed along each route and no shop refreshes are assumed. Set `ALCHEMY_LOOT_SAMPLES` to a positive integer to change the default 1,000 samples per cell. The same command also writes `materials.html` / `materials.json` with mean homestead-material payouts per progression band and encounter type.

Gear offer rates are estimated by rolling rarities directly rather than generating
full instances. Three Gear choices can expose premium loot more often than a
single item roll. The report records sampling uncertainty. Execution follows
[Contributing](../CONTRIBUTING.md#what-to-run-when-you-change).

## Materials tuning

[Materials economy](../src/lib/game-constants/materials-economy.ts) owns base payouts
by encounter type and progression band. Campaign uses the act, Labyrinth the floor,
and Wildwood the boss number, capped at the final band. Rewards are independent of
enemy identity; each pair samples one of the seven materials uniformly with replacement,
and an odd remainder uses one final roll from the seeded rewards stream.

| Stage                          | Rule / owner                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Combat base and room modifiers | `computeCombatMaterialReward` applies Scavenger doubling and Herbalist before find bonuses                                                                                |
| Mystery base                   | `computeMysteryMaterialReward` uses the authored grant                                                                                                                    |
| Homestead find bonuses         | Add matching node bonuses, multiply each source quantity once, then `Math.round`; no extra RNG                                                                            |
| Exclusions                     | Salvage and run-end accounting never apply find bonuses; Gold find bonuses affect victory and Mystery payouts only, excluding other generated Gold and the existing purse |

[Material reward helpers](../src/lib/homestead/material-rewards.ts) own these calculations.
`npm run balance:loot` writes `reports/loot-progression/materials.html` with mean
base payouts by band and encounter type; it does not simulate build-dependent modifiers.

## Inventory ordering and equipment movement

Working inventory order and pagination are screen-local and transient while the Armory remains mounted. Remounting the Armory restores default sorting (Unique -> Astral -> Basic, Name A-Z, stable instance ID tie-breaker for Gear; Name A-Z, ID tie-breaker for Trinkets).

- **Order lifetime**: Working order and current page are tracked per hero and equipment category/slot while the Armory remains mounted (`useArmoryOrdering`). Switching heroes or slots preserves the working order and current page for each slot.
- **Inventory changes**: Each category records its default order on first visit. Crafting changes to an existing item keep its position. Missing items are removed; newly available items append in default-sorted batches without moving earlier arrivals. Inactive categories reconcile against current inventory when revisited.
- **Page clamping**: If inventory shrinkage removes the current page, the category remembers the last valid page (page 0 when empty). Later inventory growth does not restore the old page.
- **Browsing**: The inventory header toolbar searches and filters the selected slot. Search matches all entered words across item/base names, affix names, and displayed effects, ignoring case and repeated whitespace. Rarity selections match any chosen rarity. Affix Keywords match actual resolved affixes, including Unique signatures and supporting affixes, rather than base affinities. Selected keywords match any of them. Trinkets use Effect Keywords and have no Rarity filter. Different groups combine with AND.
- **Criteria lifetime**: Search, filters, and filtered page are remembered per hero/slot while mounted. Criteria changes reset to page 0; Clear filters preserves search and working order. Filtering projects the full order without deleting hidden positions. Crafting and equipment changes immediately update matches and persist page clamping. An empty inventory keeps its empty icon; a filtered inventory with no results explains that no items match.
- **One-time sorting**: Sort provides Rarity (Unique → Astral → Basic), Name (alphabetical), and Base Type (base display name, then item name, rarity, and ID) for Gear, and Name for Trinkets. Each action sorts the complete category and resets pagination to page 0 without altering persistent save order or automatically maintaining sorting after future actions.
- **Equipment movement**:
  - **Replacing equipped gear/trinket**: The unequipped item takes the exact inventory position of the equipped item being replaced, without shifting other items or changing pagination.
  - **Equipping into an empty slot**: The item is removed from the inventory grid, and subsequent items shift up/reflow to close the gap.
  - **Unequipping gear/trinket**: The unequipped item is inserted before the first visible item of the currently viewed page in the complete working order (or index 0 when no items match), shifting subsequent items down. Returned items that fail the current criteria remain hidden.
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
operations without flights clear their placeholder immediately. Filtered moves commit immediately because returned items can disappear or reflow the visible target. Criteria and sort changes settle active transfers.

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
items in their inventory. Those spares can still be equipped by another hero.
When crafting or salvage is armed, both inventory tiles and borrowed equipment
slots show the inventory owner's reservation before an attempt reaches the store.
Disarming the tool restores normal browsing and unequipping for that other hero. Unused items owned by other heroes remain
editable through other heroes’ tabs. Acquisition adds inventory normally.

The Gear intent commands enforce the same reservations through store-owned mutations;
blocked actions spend no currencies, roll no RNG, award no salvage, and trigger
neither combat rebinding nor an explicit save flush. The UI shows a lock and a
reason naming the reserved hero while preserving inspection. Talent and
Homestead mutation timing remains unchanged.

## State flow

- **Pure rules** — `src/lib/gear/` — types, definitions, affixes, crafting, generation
  - `loadout-operations.ts` owns slot compatibility, equipment changes, and orphan repair.
  - `instance-normalization.ts` owns saved-instance repair; save schemas import it directly.
  - `equipped-effects.ts` owns per-item and equipped battle stat aggregation.
  - `gear-effect-manifest.ts` owns `createEmptyGearEffectManifest()`. Each live manifest owns its chance arrays; defaults are comparison data, not a mutable battle or simulation manifest. Live equipment and simulation presets both accumulate affixes with `addAffixRollEffects`.
  - Save repair imports its rule owners directly, without depending on crafting.
- **Aggregate** — `gameplay-state-store` gear region via `gear-store.ts` (selectors + persistence codec), `gear-actions.ts` (draft mutations including inventory salvage), and `gear-session-command.ts` (HP-sync wrapper)
- **Screen** — Armory route (`meta-routes.tsx`) → `routeCommands.meta.armory` → `armory-screen.tsx`
- **Battle** — [manifest integration](#battle-integration)
- **Persistence** — `subscribeAlchemyPersistence` / `buildAlchemySaveDataFromStores` + immediate `flushSaveAfterGearMutation` (fire-and-forget; autosave owns retry)

### Read paths

- **Armory access** — the Main Menu always offers Armory, including before any Gear or Trinkets are owned. Combat preserves browsing but makes the battling hero’s Armory tab read-only through `useGearCombatRestrictions`; see [Combat equipment restrictions](#combat-equipment-restrictions).
- **`ArmoryScreen`** — reads Gear, Trinket ownership/equipment, and crafting currencies via `useGearArmorySlice`, combat reservations via `useGearCombatRestrictions`, plus finished-run characters.
- **Interaction policy** — `armory-item-state.ts` owns inventory/equipment click decisions alongside targeting affordances. Equipped slots retain locked browsing; inventory tiles retain reservation and compatibility guards. `use-armory-targeting-state.ts` owns mutually exclusive idle, salvage, currency, and salvage-confirmation modes through intent callbacks. Store commands still validate authoritative mutations.
- **Run start** — `run-start-command.ts` snapshots `computeGearManifest.maxHealth` into `RunStartSnapshot.gearMaxHealthBonus`.

### Write paths

Commands require the owning `gameSession` as their final argument; inside a store-owned command, use its transaction instead. Follow [session ownership](./RUN_STATE.md#session-ownership). Outside store internals, callers use the intent commands in
`shared/stores/commands/gear-commands.ts`: `equipGear`, `unequipGear`, `equipTrinket`,
`unequipTrinket`, `applyCurrencyToGear`, and `salvageGear`. Both the Armory routes
and headless player use these commands. Each command owns dispatch, rejection,
live Health/manifest rebinding, and the successful action's save checkpoint.
Adapters cannot supply a mutation callback or replace the checkpoint. Rejected
actions consume no RNG, publish no revision, and request no save.

`gear-session-command.ts` and `gear-actions.ts` are store internals, enforced by
import boundaries. Store-owned acquisition helpers use
`mutateGearWithRunHealthSync(transaction, { mutate })` inside their existing
transaction; its readonly `GearDraftView` exposes guarded mutations and tracks
writes. Mutation capabilities close when the `mutate` callback returns or throws,
before live Health and manifests are rebound. A retained method cannot change
equipment later in the enclosing command and leave those derived values stale.
The inner callback must return synchronously; its result is validated even when
the enclosing command ignores it, so an asynchronous callback cannot commit its
partial changes. A callback or rebinding failure invalidates the enclosing command;
catching the error cannot publish incomplete equipment, Health, or discovery changes.
It has no salvage operation. Bootstrap hydration uses the Gear codec;
feature code cannot initialize or reset Gear through an Armory action.

Salvage has one transaction-level recipe: `salvageGearInTransaction(transaction,
instanceId)`. It validates live combat reservations, finds the owned item,
recomputes its deterministic yield, removes it and its loadout references, grants
currencies and Materials, records active-run earnings, and rebinds Health in the
same transaction. No caller-supplied payout can reach settlement. Materials go
through `awardMaterialsDuringRun` for an active run or `addMaterialsToStockpile`
otherwise. Preview still uses `computeSalvageYield`; confirm pays exactly that
yield. Repeating the request cannot pay twice.

Crafting and dev spawning accept profile-lifetime randomness, defaulting to
`Math.random`; neither consumes a run RNG stream. The headless player injects
its career crafting source through the same `applyCurrencyToGear` command.
Rewards and shops grant instances and permanent Trinkets through
`deck-mutations.ts` within their existing commands, retaining discovery and run
recap accounting. Acquisition follows the [Auto Equip policy](#data-model); it never creates a Boon.

### Salvage materials

Base item construction owns homestead salvage materials; rarity increases quantities rather than introducing affinity-based Herbs. Metal equipment yields Iron, wooden equipment yields Wood, magical staves and wands combine Wood and Gems, and jewelry and spellbooks yield Gems. Leather Armor and Quivers yield Hide, and the Leather Buckler yields Wood and Hide for its backing. Herbs remain available from shared combat rewards and Mysteries, with Herb Garden progression increasing found quantities; removing gear Herbs reduces an optional supply, not access to progression. Currency rarity distributions remain unchanged.

### Route commands

The route wrapper (`src/app/screen-routes/meta-routes.tsx`) wires `routeCommands.meta.armory` for the [read paths](#read-paths) and [write paths](#write-paths) above. The commands route mutations through the appropriate Gear wrapper and delegate the successful save checkpoint to the Gear command. Rejected taps remain feedback-only. Dev spawning uses `generateDevRandomGearInstance` through the same mutation and flush boundary.

## Battle integration

Gear effects are **snapshotted** at battle start. `computeGearManifest(characterId, inventory, loadouts)` flattens equipped Gear into `BattleState.gearEffects`. Allowed Gear, talent, and Homestead mutations refresh that manifest through `rebindLiveRunMeta` in the same session command. Battle calculations read the battle manifest, never the Gear aggregate directly. `battle/scaled-damage.ts` holds only shared helpers, not a dispatch table: each consumer reads the manifest where its effect applies.

Trinket effects snapshot the same way via `computeTrinketManifest` (`src/lib/trinkets.ts`) over run Boons plus the equipped Trinket. Every `TrinketManifest` key is granted by at least one trinket and has a documented battle/run consumer; the key→consumer map lives in the manifest coverage test (`tests/lib/content-validation/trinket-validation.test.ts`) and fails compilation when a key is added or removed without updating it.

### Affix rules

[Affix rows](../src/lib/gear/affix-rows.ts) own names, triggers, magnitudes, roll
ranges, affinities and slot eligibility. `uniqueOnly`, not a fixed roll value,
restricts an affix to Uniques. Shared validation requires ordinary affixes to be
reachable on Basic/Astral Gear, including Mana-affinity Wish effects such as Fateful.

Typed rows derive `GearEffectManifest`, defaults and effect keys. Keys ending in
`Chances` retain independent roll lists; other effects sum. Preserve row, slot and
affix order because seeded generation and proc order depend on them. Duplicate IDs
are rejected; display-name, range and reachability checks belong to content validation.
`affix-catalog.ts` adds tooltip keywords without becoming a manifest dependency.

Saved rolls normalize to current rarity ranges; a captured battle retains its
magnitudes until live rebinding or the next battle. Forge procs retain every
equipped copy rather than summing or capping independent chances. In particular,
Emberforged checks positive Burn against the pre-hit non-Burning state.

The following timing/source distinctions supplement the catalog:

| Concern                | Contract                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consume                | Summons are battle-removed without Consume and earn no Consume rewards. Rotbloom uses one ordinary Poison tick per copy, including decay and riders, not whole-stack removal.                                                                                                                                                                                                                                              |
| Payment and hand state | Distilled requires Mana actually paid; Afterglow checks the last card in hand at play. Lastlight checks Mana before Consume refunds. Ashkeeper/Lastlight trigger on Consume.                                                                                                                                                                                                                                               |
| Leech and healing      | Bloodward, Bloodroot and Heartshock require actual restoration; conditions use pre-heal state. Bloodward rolls once and scales Block from Health restored. Rootmender allows triggered Nature damage against Poison and shares one restoration with Sylvan rather than stacking another. Restorative requires actual restoration.                                                                                          |
| Resource grants        | Smithguard pays once on the combined Forge award; copies add Block. Layered's first positive Armor gain includes opening grants and creates no Armor itself; its allowance is separate from Ironroot under [Armor gain limits](./GAME_RULES.md#hit-resolution-and-pacing).                                                                                                                                                 |
| Card versus packet     | Bramblecall checks Thorns before the Nature card; Spitebloom follows successful retaliation. Scarfeast, Hallowguard and conditional hero-attack bonuses require their catalog card/Health/Block conditions per hit, excluding Companions and secondary hits. Bloodscent instead uses shared Companion scaling and inspection.                                                                                              |
| Periodic damage        | Infected, Ashen Wake and Cauterize affect existing DoT ticks/detonations, not initial hits or buildup. Bloodember shares applicable Burn/Bleed periodic bonuses. Venomtrail includes direct Poison, ticks and detonations against Bleed; Frostburn modifies Freeze attack damage and buildup against Burning enemies.                                                                                                      |
| Wish and Gold          | Gildmend includes combat kill Gold; Tithebound checks Forge at the kill. Starcatcher prepares the ordinary next-card discount after an empty-hand Wish; Starfall is a normal Freeze follow-up.                                                                                                                                                                                                                             |
| Cleanse and Purge      | Clearheaded/Solace reward each removed harmful status; Unraveling/Denouncing pay once per successful Purge, even when it removes several benefits. Spellrending checks at player-turn start, including opening, with additive copy chances and no saved turn allowance. Cleanse/Purge/Death's Door use existing affinities rather than new keywords.                                                                       |
| Death's Door           | Emberwake and Deathgrip react on entry after triggering damage; Lastwatch applies during grace; Rekindled requires surviving expiry. Pending entry rewards persist.                                                                                                                                                                                                                                                        |
| Defensive conditions   | Ironbriar checks Block after turn decay; Bristling after the hit. Spiteful pays only on the first Thorns retaliation removing enemy Health each turn. Counterplate uses Armor actually lost to an enemy attack.                                                                                                                                                                                                            |
| Mana and Block         | Spellguard checks absent Block before actual Mana payment and grants before card effects. Arcane Ward requires actual Mana gained without Block, including new Crystals but excluding turn refills. Both use ordinary Block rewards.                                                                                                                                                                                       |
| Recovery and charges   | Blur respects the Dodge cap. Hero Second Wind heals only the first surviving quarter-Health crossing, including self-damage, with a saved allowance separate from the enemy's. Whiplash readies one Stun hit after Dodge; further Dodges refresh, while non-Stun, Companion, secondary and dodged hits preserve it.                                                                                                        |
| Magnitude modifiers    | Conditional hero-attack bonuses change existing packets without new hits, flags or allowances. Last Bastion modifies positive Block below half Health; Mending modifies positive healing below half Health before multipliers, rechecking Health per heal. Neither creates resources. Spentward preserves contact/Dodge, applies before Block only to enemy attacks while Mana is empty, and respects mitigation bypasses. |
| Stun and Purge         | Disrupting settles an ordinary Purge after successful Stun, retaining rewards and additive copy chances. Its pending reward and Whiplash/recovery state use safe additive save defaults rather than new per-turn allowances.                                                                                                                                                                                               |

[Game rules](./GAME_RULES.md#direct-player-hit-resolution) own shared packet stages;
[resource rules](./GAME_RULES.md#armor-forge-and-gold) own shared resource recipes;
[Unique items](./UNIQUE_ITEMS.md#combat-semantics) retain signature exceptions.

## Persistence

The [Gear codec](../src/features/alchemy/shared/stores/persistence/gear-codec.ts)
owns saved inventories, loadouts, owned/equipped Trinkets and crafting currencies.
Instances save IDs and rolls under the [data model](#data-model), never definitions
or art URLs. Shape changes follow [save compatibility](../src/features/alchemy/shared/storage/MIGRATIONS.md).

Gear intent commands own successful mutation checkpoints through
`flushSaveAfterGearMutation`; routes cannot replace that boundary. Immediate writes
and autosave use the same detached, session-owned snapshot and acknowledgement path
under [the persistence API](./RUN_STATE.md#persistence-api). Completion waits for a
covering local save; autosave owns retry.

## Unique combat effects

[Unique items](./UNIQUE_ITEMS.md) records the approved signatures, supporting-affix policy, and combat interaction rules.

## Tests

[Gear units](../tests/lib/gear/) protect generation, crafting, loadouts and salvage;
[store commands](../tests/features/alchemy/shared/stores/commands/) and
[Gear saves](../tests/features/alchemy/shared/storage/gear-save.test.ts) protect
transaction/persistence boundaries. [Armory units](../tests/features/alchemy/meta/screens/armory/)
protect interaction, ordering and transfers. [Shared content validation](../src/lib/content-validation/validators-gear.ts)
enforces catalog invariants for units and `content:audit`; [Unique verification](./UNIQUE_ITEMS.md#verification-ownership)
locates signature protection. Select checks under [CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change).
