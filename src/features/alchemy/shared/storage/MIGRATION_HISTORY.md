# Save migration history

Completed structural migrations retained for compatibility and fixture review.
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
sentinel to `MANABURN_DAMAGE_PERCENT`. They stay unversioned because they repair
single renamed fields rather than a save shape; magnitudes live beside the
other legacy tuning in `game-constants`.

## Schema 15 — recurring Mask and Censer effects

Active and parked combat snapshots replace Brass Censer's first-Holy doubling
with its 20% Burn-or-Leech chance, and Plague Doctor's Mask's first-status
immunity with its turn-start 2-Poison cleanse and retaliation. The obsolete
one-use flags are removed even when already spent. Ownership, Boons, other
combat effects, and battle progress are preserved.
