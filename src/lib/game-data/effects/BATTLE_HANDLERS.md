# Battle handlers for card effects

Effect **schemas** live in [`src/lib/game-data/effects/`](./), grouped by concern into `<group>-schemas.ts` files. Primitives (`AmountSchema`, `DamageTypeSchema`, `EnemyStatusIdSchema`, `CompanionIdSchema`) are owned by [`shared-schemas.ts`](./shared-schemas.ts). Domain definitions live in `damage-schemas.ts`, `status-schemas.ts`, `mana-health-schemas.ts`, and `simple-schemas.ts`. The unified registry is [`registry.ts`](./registry.ts) (kinds + schemas + recursive factories for `chance` and `repeat-over-turns`).

Effect **runtime handlers** live in [`src/lib/battle/effect-handlers/`](../../battle/effect-handlers/), grouped by concern into `<group>-handlers.ts` (`damage-handlers.ts`, `status-handlers.ts`, `mana-health-handlers.ts`, `simple-handlers.ts`) plus `registry.ts` (kind table + `chance`/`repeat-over-turns` dispatch + `companion-action` handler) and `handler-types.ts` (context type + `defineHandler` + `ccDeepenedSinceStart`). Handlers are created via `defineHandler(kind, fn)` in [`handler-types.ts`](../../battle/effect-handlers/handler-types.ts) which enforces kind-narrowing and turns direct mismatched calls into throws (registry still warm-warns + `logError` and returns state for truly unknown kinds, which is the defensive path for old saves). Potion scaling threads `potionMult` (from `isPotionCard` + `talentEffects.potionPotency` in `registry.ts`, suppressed for `action.source === "repeat"`) through every handler; each handler opts in via `applyPotionMultiplier` in `amount-helpers.ts` (roll-then-scale for `random-damage`/`random-draw`). `isPotionCard` is the explicit `POTION_CARD_IDS` list in [`card-pools.ts`](../cards/card-pools.ts) plus mixed potions — never a name rule. The rule is **benefits scale, costs don't**: damage/heal/mana/gold/wish/status gains scale, while `self-damage`, `lose-*`, and factor-based effects (`multiply-enemy-status`) ignore potency. Flag effects (`next-hit-crit`, `next-hit-leech`, `play-next-card-twice`, `next-hit-poison`, `next-archery-free`) share the `FLAG_EFFECTS` table and `FLAG_HANDLERS` map in `simple-handlers.ts`, spread into `EFFECT_APPLY_BY_KIND`. `companion-action` lives in `registry.ts` (not `simple-handlers.ts`) so `companion-effects` never imports back into the registry; non-card pulses use the `processCompanionTurnStart` binder in `battle/companion.ts`.

The canonical kind list is [`BATTLE_CARD_EFFECT_KINDS`](./registry.ts). Template definitions aggregate in the same registry. Ordinary `BattleCardEffect` members derive from the grouped schemas; recursive members remain explicit in `types.ts`, and `isRecursiveBattleCardEffectKind()` is the single check for the recursive kinds. Per-kind dispatch is [`EFFECT_APPLY_BY_KIND`](../../battle/effect-handlers/registry.ts).

## Adding a kind

Add a schema definition to the matching `<group>-schemas.ts` collection; ordinary effect types derive automatically. Add a handler to the matching `<group>-handlers.ts` map (flag kinds use `FLAG_EFFECTS`). Add keyword metadata and any canonical description together in `effect-metadata.ts`. Mark `canonical: true` only for unconditional shapes whose formatter describes the complete effect: exact matching generated lines use the shared formatter, while custom/saved phrasing retains count and numeric parity validation. Keep independent formatter/behavior assertions; the shared formatter is not its own correctness oracle.

For custom phrasing, update `numeric-parity.ts` and shared `line-classifiers.ts` as needed. New recursive shapes additionally extend `types.ts`, recursive schema construction, and `effect-tree.ts`; its child order is success effects followed by failure effects, which defines corruption target paths. Cloning, corruption editing and potion scaling consume this traversal; each retains its own leaf behavior. The potion mixer retains its defensive fallback for unknown nested arrays. Extend `tests/lib/game-data/effect-kind-coverage.test.ts` (the minimal-effect table is a compile-time contract). Card previews show authored base amounts only, except summon lines recomputed with Bond/damage bonuses.

[`applyCardEffects`](../../battle/effect-handlers/registry.ts) is the single entry point exported from `@/lib/battle`. It walks each effect on a card, routes `chance` (via `rollChance` + `getBattleRng`) and `repeat-over-turns` (queue `pendingTurnStartEffects` with source card ID, Consume, and tags) before the registry, and otherwise delegates to `applyEffectByKind`. Dispatch details: `applySingleEffect` short-circuits when the hero is defeated; `applyEffectByKind` runs the handler, then (for `summon-companion` with Eager Pack) two immediate Companion pulses by design, then `resolvePendingBattleReactions` after every single effect. Companion turn-start and pending-turn-start pulses re-enter through synthetic cards under explicit `resolveSecondaryAction` scope (see `battle/companion-effects.ts`, `player-turn-transition.ts`); `play-next-card-twice` runs a second raw `applyCardEffects` outside `resolveCardEffectChain` (`battle/card-play.ts`); unique-card repeats run with `action.source === "repeat"` (which also suppresses potion scaling).

Snapshot semantics: normal card play freezes `manaAtStart` pre-payment and `enemyFreezeSkipTurnsAtStart` pre-play (`card-play.ts`); companion pulses snapshot inside their action scope; pending-turn and unique-repeat pulses snapshot per-pulse. `convertCurrentMana` reads the frozen `manaAtStart`. Conditional Mana restoration and Gold use distinct checks documented under [Ordering and semantics](#ordering-and-semantics). Crowd control has three call sites (hero `enemy-status` stun/freeze, `multiply-enemy-status` freeze/stun triggers, enemy-side player CC) — see `status-handlers.ts` and `enemy-turn-attack.ts`. Card bonus eligibility is centralized in `action-context.ts` and `combat-flags.ts`; secondary actions never mask or restore gameplay flags. `battle-sequence.ts` owns step settlement and fatal cutoffs.

## Ordering and semantics

- `player-status` with `convertCurrentMana` interprets the value as **block per mana** (`manaAtStart * convertCurrentMana`), zeroes mana, and respects `manaAtStart` snapshot from `CardEffectResolutionContext` (frozen before any effect mutates `state.mana`). `perManaCrystal` uses live `maxMana`.
- `restore-mana` may opt into `allowOverflow` for temporary extra Mana (Mana Moth). Omission preserves capped restoration; restoration never removes existing overflow. This does not add Mana Crystals.
- `restore-mana` with `ifEnemyFrozen` compares live `enemyCC.freezeSkipTurns` against the frozen `enemyFreezeSkipTurnsAtStart` — so a `damage`→`freeze` earlier on the same card enables the restore, but only if the threshold was crossed by that card's own effects.
- `damage` with `equalToBlock`/`equalToArmor`/`equalToGoldPercent` intentionally bypasses per-type flat/gear/talent modifiers — only `forgeBonus` and `applyConsumeBonus` apply; this matches card text for resource-based damage such as Blessed Aegis.
- `damage.equalToBlockPercent` scales the live actor Block resource before the same equal-to-resource modifiers and rounding; omission preserves full Block scaling. Enemy abilities read the enemy's live Block after preceding effects such as Shield Bash's Block gain. `player-status.statusPool` selects one listed beneficial status with the battle RNG before applying the authored amount.
- `damage.equalToForge` reads live Forge as the base, without adding Forge a second time through Forge-to-Burn talents. It follows the other equal-resource effects' flat-modifier bypass and normal hit multipliers. Burning Blade gains Forge before resolving this Burn hit; ordinary Forge spending still applies. Enemies read their own already room-scaled Forge without scaling that resource again.
- `damage.ignoreArmor` bypasses only the target's Armor reduction. `damage.ignoreBlock` bypasses and preserves the target's Block. Dodge, other mitigation, normal Armor decay, and gear reactions still apply, for both heroes and enemies.
- `remove-enemy-armor.removeAll` removes the target's current Armor before subsequent effects. Authored cards omit `amount` (old saves may still carry an ignored one); omission preserves fixed-amount removal for saved cards. The same applies to `remove-harmful-status` with `removeAll`.
- `remove-enemy-armor.halve` leaves `Math.round(current Armor / 2)` Armor and cannot be combined with a fixed amount or `removeAll`.
- `random-draw` rolls a uniformly distributed integer between its inclusive bounds using the world RNG, then uses ordinary drawing, reshuffling, and hand limits. Roll the Dice has fixed bounds 1–6; its die faces are rules rather than upgradeable magnitudes.
- `companion-action` invokes the existing Companion resolver once per `amount`, including utility actions, Bond bonuses, and reactions. No Companion is a no-op; victory or hero defeat prevents later actions. These actions do not count as additional card plays. Pack Tactics keeps two actions while its conditional Wish effect offers only Companion summon cards when no Companion is active; Whistle still grants its separate action once per card play.
- `random-damage` enforces `maxAmount >= minAmount` at schema level and throws loudly on inverted bounds at runtime. Corruption clamps either bound at the other bound, keeping the description and effect valid even after repeated mutations. An optional `damageTypePool` replaces the default all-type pool; amount and type each use the battle RNG. Direct random-damage cards trigger the same once-per-card enemy retaliation as direct damage cards.
- `damage.detonateAllBurn` and `damage.detonateAllBleed` detonate all matching enemy DoT stacks after the hit, including stacks added by that hit. The legacy `detonateIfEnemyBurning` flag retains its pre-hit condition for complete saved cards.
- `damage.doubleIfEnemyNotBurning` doubles the hit when the enemy has no Burn; it cannot be combined with either opposing Burn multiplier flag.
- `gain-gold` with `ifEnemyStunned` requires positive live `enemyCC.stunSkipTurns`; it does not compare against a pre-card snapshot. An enemy already Stunned before the card qualifies, as does one Stunned by an earlier effect on that card.

- Numeric upgrades and corruption share `updateCardNumericValue` in `src/lib/corruption/numeric.ts`. Target discovery lives in `src/lib/corruption/numeric-targets.ts`: standalone description lines bind to the effect's canonical wording before equal-valued fallbacks claim numbers in authored order. Compound lines use the binding ledger's explicit shared-value rules. Targets address nested scheduled effects and both chance branches. Chance paths index success effects followed by failure effects; probabilities and schedule durations are not editable magnitudes. A fixed Random damage amount displayed as one number updates both bounds together. A scheduled effect sharing one authored amount with an immediate effect changes with that amount; separately authored delayed amounts change independently. “Draw a card” represents one editable draw. Keep original catalog effects immutable.
- Immediate and delayed damage may share a description line: “Deal 1 Freeze damage now and 3 at the start of your next turn” retains two independently editable magnitudes. “Deal 2 Stun damage now and at the start of your next turn” shares one magnitude across both hits.

## Enemy abilities

Enemies reference canonical cards through `BestiaryEntry.abilityIds`; they do not
author a parallel effect library. `game-data/enemy-abilities.ts` validates the
supported subset (hero `damage` with the supported type pools, resource scaling,
conditional fields, and Armor/Block bypasses; `player-status` block/armor/forge/thorns,
`heal`, `remove-enemy-armor`, freeze-only `multiply-enemy-status`, and recursive
`chance`), including every chance branch and conditional field. Adding a field to
hero `damage` without triaging `supportsEnemyEffect` fails the enemy-subset test
rather than silently invalidating cards; `getEnemyAbilityCard` names the offending
effect in its error.
`battle/enemy-turn-attack.ts` resolves that subset from the enemy's perspective,
using shared incoming-damage, crowd-control, healing, and mitigation primitives.
Hero-only resources and rewards never run for enemy self-benefits. Card-granted
Thorns and queued Bleed Leech use the same status semantics as hero cards while
retaining existing encounter exceptions. Selection and trait limits are owned by
[GAME_RULES](../../../../Docs/GAME_RULES.md#enemy-abilities-and-traits).

## Tests

- [`tests/lib/battle/apply-effects-*.test.ts`](../../../../tests/lib/battle/) — canonical apply-path coverage by concern (`apply-effects.test.ts`, `apply-effects-mana.test.ts`, `apply-effects-utility.test.ts`, `apply-effects-special.test.ts`), plus focused `tests/lib/battle/` regression suites (card-play, damage, status, companion, wish, talents, gear, traits).
- [`tests/lib/battle/effect-handlers.test.ts`](../../../../tests/lib/battle/effect-handlers.test.ts) — handler contract (mismatched kind throws for every non-recursive kind), unknown-kind warn+return boundary, Death's Door, status/CC, cleanse/multiply, `convertCurrentMana` Block-per-Mana semantics, `ifEnemyFrozen`/`ifEnemyStunned` branches, and `repeat-over-turns`/`chance` queue/branch shapes.
- [`tests/lib/game-data/effects-registry.test.ts`](../../../../tests/lib/game-data/effects-registry.test.ts) — schema refinements (conditional fields, bounds).
- [`tests/lib/game-data/effect-kind-coverage.test.ts`](../../../../tests/lib/game-data/effect-kind-coverage.test.ts) — the single union ⇔ schema ⇔ handler ⇔ keyword-grouping contract for every kind.
- [`tests/lib/game-data/descriptions-match-effects.test.ts`](../../../../tests/lib/game-data/descriptions-match-effects.test.ts) — card-specific invariants (1-Mana rule, Gambler's Shot punctuation, summon-companion lines); catalog-wide parity lives in `tests/lib/content-validation/` (`content-validation.test.ts`, `parity-negative.test.ts`, `line-classifiers.test.ts`).
- [`tests/lib/game-data/card-builders.test.ts`](../../../../tests/lib/game-data/card-builders.test.ts) — builder output (lines+effects+tags/consume) and the explicit-lines escape hatch.

## Gear and trinket effects

Equipment does not use the card-effect registry above. Gear affixes resolve to
[`GEAR_EFFECT_KEYS`](../../gear/gear-effect-manifest.ts) via `gear/affixes.ts`
(description formatting shared in `formatAffixDescription`), uniques contribute
canonical rolls from `gear/unique-catalog.ts`, and `computeGearManifest`
snapshots the equipped loadout into battle (`rebindLiveRunMeta`); see
[ARMORY battle integration](../../../../Docs/ARMORY.md#battle-integration).
Trinket effects resolve to `TrinketManifest` via `computeTrinketManifest` in
`lib/trinkets.ts`; every key has a documented consumer pinned by the manifest
coverage test in `tests/lib/content-validation/trinket-validation.test.ts`.
`battle/gear-effects.ts` holds only shared helpers, not a dispatch table —
each battle consumer reads the manifests where its effect applies.

## Conditional damage and feedback

Damage supports paired `blockCost`/`blockDamageBonus`, an alternative
`damageTypeIfTargetHasBlock`, or paired `damageTypeIfTargetFrozen`/
`amountIfTargetFrozen`. Only one selector may be authored on an effect; selectors
cannot combine with random-type pools or equal-resource damage. Hero and enemy
handlers share selection, then resolve their own payment and ordinary typed hit.
Resolved repeat packets omit selector/payment fields so they cannot pay twice.

Conditional descriptions share one formatter with numeric editing and parity
validation. Block cost is a fixed rule; base damage, Block damage bonus, and Frozen
alternative damage are editable. Damage pools and repeated immediate-hit lines
share one displayed amount; “Deal N damage twice” updates both hit effects.
The loader currently preserves complete saved conditional/chance effects.
Preserve valid current-run modifications as a unit; retirement of obsolete
card mechanics follows the [save baseline](../../../features/alchemy/shared/storage/MIGRATIONS.md#supported-baseline).

Boolean preparations, draw/summon/Wish, cleansing, and scheduling emit meaningful
combat events. Unsupported effects still warn without inventing a successful
result. Numeric zero fallback is restricted to valid ineffective actions.
Cross-action consolidation belongs exclusively to presentation; source events
and battle snapshots remain immutable. See the canonical UI feedback policy.

Central registries statically assemble schema collections and handler maps from the existing groups; ordinary new kinds do not require central registry edits. Both registries reject duplicate kinds before use, and the assembled handler map remains exhaustive. Recursive effects and the companion-action cycle boundary remain owned by their registries.
