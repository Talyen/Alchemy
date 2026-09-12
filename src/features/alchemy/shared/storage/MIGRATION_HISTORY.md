# Save migration history

Completed save and content changes retained for compatibility and fixture review.
The current decision and implementation contract lives in
[MIGRATIONS.md](./MIGRATIONS.md).

## Schema 11 — reward claims and Gear slots

The supported floor replaced the prior `resumePhase`, `destinationChoices`, and
top-level `pendingReward` triad with the discriminated `interruptedFlow` union.
Reward payloads moved under the reward arms; destination-only resume retained
destination and victory metadata.

Jewelry loadouts mapped the old left Ring to left Accessory and Amulet to right
Accessory. The old middle right Ring was unequipped but retained in inventory.
Permanent Trinket ownership started empty because discovery did not imply
ownership.

## Schema 12 — Boons and permanent Trinkets

Active and parked runs preserved Boons, pending reward meaning, and battle
Trinket manifests across the rename. Saved Trinket Shop inventory became a
permanent vendor surface; restore filters ownership against the shared Gear
profile and falls back safely when an offering is no longer eligible.

## Schema 13 — Wildwood interrupted rewards

`interruptedFlow` became the sole persisted Wildwood reward owner. A live
nested draft reward is lifted only when the generic arm is `none` and the draft
is in reward/recovery. Leftover nested reward fields on battle, draft, or
removal are dropped. Wildwood phase, boss bag, draft choices, and encounter
traits remain on `wildwoodDraft`; unknown boss IDs are filtered without
dropping the draft.

Fixtures assert resumption for card, Boon, Gear, selection, and companion
handoff rewards.

## Schema 14 — Labyrinth hex floors

The 8×9 `grid` and `connections` map became hex floors with `floors`, `nodes`,
and `currentFloor`. Old maps cannot be converted losslessly, so
`migrateV13ToV14` preserves the run's deck, gold, Health, character, and RNG
seed, regenerates floor 1, and clears `labyrinthPendingNode`. Parked Labyrinth
runs take the same path; a valid hex map passes through.

`discoveredUniqueIds` was additive with an empty default. Hydration unions owned
unique Gear into discovery so existing inventories remain visible in the
Collection.

## Unversioned battle-talent shims

`normalizePersistedBattleState` carries renames that predate schema versioning
and run on every load without a version gate: `firstBurnCardDoubled` to
`firstBurnCardBonusMultiplier`, `receiveHalfFreezeBuildUp` to
`receiveHalfFreezeDamage`, `bleedExecuteThreshold` to a multiplier of
`LEGACY_BLEED_EXECUTE_MULTIPLIER`, `wishBlockBelowHealthPct` to an amount of
`LEGACY_WISH_BLOCK_AMOUNT`, and the `LEGACY_MANABURN_PER_CRYSTAL_ENABLED`
sentinel to `MANABURN_DAMAGE_PERCENT`. They are retained compatibility exceptions from older normalization code.
Their existence does not authorize new unversioned renames: use the current
[MIGRATIONS](./MIGRATIONS.md#single-responsibility-rule) contract for new work.
Magnitudes live beside the other legacy tuning in `game-constants`.

## Schema 15 — recurring Mask and Censer effects

Active and parked combat snapshots replace Brass Censer's first-Holy doubling
with its 20% Burn-or-Leech chance, and Plague Doctor's Mask's first-status
immunity with its turn-start 2-Poison cleanse and retaliation. The obsolete
one-use flags are removed even when already spent. Ownership, Boons, other
combat effects, and battle progress are preserved.

## Schema 16 — enemy card abilities

`migrateV15ToV16` replaces repeated enemy attack arrays with canonical
`currentEnemy.abilityIds` and an initially empty `lastEnemyAbilityId`. It updates
renamed trait metadata without changing enemy IDs or discoveries and retires the
old Blood Cultist, Vampire, and Holy-priming flags. Existing Health, statuses,
mitigation, difficulty modifiers, room scaling, RNG counters, and earned rewards
remain intact. The legacy encounter Thorns marker moves into
`flags.legacyEnemyThornsReady` while preserving the visible stack, allowing new
card-granted Thorns to coexist with its original retaliation.

The same transformation covers active and parked runs and both opening-draw and
enemy-turn saved result states. Already-resolved results retain their Health,
Gold, Dodge count, and continuation meaning; resume commits them without another
ability choice or duplicate rewards. The following action uses the new repertoire.
New snapshots retain valid last-ability history. Normalization repairs missing or
unsupported ability references from the enemy catalog and restores known trait
metadata for inspection, without discarding the battle.

## Schema 17 — Labyrinth Open Field

Each playable floor now has a completed entrance inside a full 4×4 rectangular
grid, cardinal adjacency, and a single persisted current position. The old
floor-zero entrance and `outgoingIds` are removed. Discovery is derived from
completed rooms rather than stored separately.

The explicitly authorized prelaunch migration retires incompatible hex
Labyrinth runs in both active and parked slots; their in-flight encounters
are retired with the run. Profile progression, the shared Gold purse, permanent
inventories, Campaign, and Wildwood are preserved. Already-valid Open Field
runs pass through, and repeated migration is idempotent. The older schema-14
regeneration path delegates to the current generator, so pre-hex grids recover
to a valid current floor without retaining hex runtime code.

## Schema 18 — Labyrinth side rooms

Existing sixteen-room Open Field floors gain one room on each side of the middle
two rows, using columns -1 and 4 around the unchanged 0–3 core. The migration
preserves original room IDs, coordinates, completion, Traits, current position,
and pending battles/visits in active and parked runs. A local seeded source rolls
only the additions without advancing the saved run's RNG counters. Expanded
floors pass through without another roll. The display name Boss replaces Boss
Combat while the serialized destination identifier stays unchanged.

The accompanying codec correction explicitly selects run-profile fields during
hydration and encoding. Stale inventory/settings/discovery fields from the full
save envelope can no longer overwrite their live owners when saving rewards.
This fixes field ownership without changing those domains' saved shapes.

## Content versions 2 and 3 — card IDs

`src/lib/validation/migration/content-steps.ts` remaps `sunder-armor` to `sunder`
for content versions below 2, and `roulette` to `roll-the-dice` for versions
below 3. The remaps traverse saved card-ID positions, including discoveries
and pending choices, while preserving ordinary strings such as titles, art,
and descriptions. `tests/lib/validation/migration.test.ts` covers these cases.

The archived boss-trait proposal described a boss-specific content-version-3
migration, but neither its cited completion commit `f07bbb72` nor the current
migration owner implements that step. Version 3 is the Roulette rename above.
Do not infer a boss save transformation or a completed boss redesign from the
archived plan's status; it is not evidence that either shipped.

## Compatible Gear corrections

- Unique inventory affixes normalize by definition ID to one signature and three standard maximum rolls. Instance IDs, protection, ownership, and Collection discovery survive. Existing combat manifests keep their captured values until live gear rebinding or the next battle.
- Balance-only changes to live definitions do not change the save schema. Lifegiving and Emberforged inventory rolls normalize to current rarity ranges; existing combat effect snapshots remain unchanged.

The fixed supporting-roll correction aligned Dance of Blades starting Armor,
Rimeheart starting Block, Blackfletch Archery damage, Twin Casting Burn damage
per Mana Crystal, Saintfall Block-depletion healing, and Golden Verdict Gold
on kill with the standard catalog maxima. Definition overviews now derive from
the signature affix, keeping Blackfletch's Health condition and Wardbreaker's
single-effect Purge consistent with instance text. Current values remain in the
affix catalog rather than this history.

## Compatible battle-content updates

These completed changes retained the save shape and content IDs. Their additive
fields use safe defaults; captured older battle manifests keep their legacy
readers until normal recomputation. This is historical compatibility evidence,
not a field checklist for new content. Follow the current
[save contract](./MIGRATIONS.md#test-expectations) and the owning schemas.

- Dodge counters (`playerDodgeCount`, `dodgeChanceFromDamage`) default to zero in old battle snapshots and pending result states. New snapshots retain both values. Dodge XP is already present in run progress when an enemy-turn continuation is saved; restoring that continuation must not award it again.
- Talent replacement IDs and unlocked progress are unchanged. New sequence, Companion bonus, Sanguine Overflow, and Dark Recovery flags default to false/zero in old battle snapshots and pending results; current snapshots preserve them. Retired effect fields and their readers remain for already-saved combat manifests; recomputing talents from unlocks uses the replacement definitions. Existing queued choices and resolved enemy-turn results are not rerolled or rewarded again.
- The combat-feedback talent replacements retain all Holy/Nature/Leech IDs and purchased progress despite row reordering. Reordering never removes purchased talents, refunds points, or grants missing prerequisites. `wishExtraChoiceAfterHolyCard` defaults to false, `leechCardDamageVsLowHealthPercent` to zero, and `flags.nextWishExtraChoice` to false in old battles and pending results. Current snapshots preserve readiness and already-generated Wish choices. Retired `holyWishChance` and `leechHolyDamageVsLowHealth` readers remain for captured old manifests until the battle finishes; subsequent battles recompute the replacements. The legacy Cull the Weak extra Holy hit does not trigger another Leech-hit reaction; current manifests use the conditional Leech-card damage bonus instead. Combat-text bursts, IDs, and animation lifetimes are presentation-only and never enter saved state.
- The distinct talent/card rework keeps all unlock and card IDs. New manifest fields default to zero/false; `nextHolyCardFree` and `killRewardsPaid` default to false and persist through saved battles and pending results. Retired first-use and direct-stack proc fields retain their readers for captured old manifests. New catalog cards all cost one Mana; valid saved cost, Consume, effects, descriptions, and corruption overrides retain their existing meanings.
- Mana from Heaven banks its next-turn reward in `flags.pendingWishMana`, defaulting to zero in old snapshots and retained in current snapshots and pending enemy-turn results. The five talent interaction replacements keep their unlock IDs and add manifest fields with zero defaults; old saved manifests retain immediate Wish Mana, Burn-hit Forge, flat Holy retaliation, and first-card Leech until the battle finishes.
- Queued turn-start pulses optionally retain `sourceCard` (ID, Consume, tags), preserving card bonuses after save/resume. Legacy pulses without this metadata retain their neutral-source behavior; the queue defaults to empty when absent.
- Golden Crucible threshold reactions persist in `pendingForgeThresholds`, defaulting to an empty queue in older battles and pending results. Resuming drains each crossing once without granting its already-awarded Forge again.
- The Stab, Burning Blade, Pack Tactics, Roll the Dice, and Acid Potion reworks added optional effect fields (`ignoreArmor`, `equalToForge`, `removeAll`) and the `companion-action` / `random-draw` kinds. Existing effect shapes keep their meanings, including saved chance-based Stab and Roll the Dice and the old Companion buff. No schema bump was needed: new cards use the catalog, while valid saved effects, descriptions, and Consume overrides remain paired under the card hydration contract. The Roll the Dice regression covers omitted Consume on complete legacy content and catalog fallback for incomplete content.
