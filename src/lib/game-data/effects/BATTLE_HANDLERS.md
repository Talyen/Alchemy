# Battle handlers for card effects

Effect **schemas** live in [`src/lib/game-data/effects/`](./), grouped by concern into `<group>-schemas.ts` files. Primitives (`AmountSchema`, `DamageTypeSchema`, `EnemyStatusIdSchema`, `CompanionIdSchema`) are owned by [`shared-schemas.ts`](./shared-schemas.ts). Domain definitions live in `damage-schemas.ts`, `status-schemas.ts`, `mana-health-schemas.ts`, and `simple-schemas.ts`. The unified registry is [`registry.ts`](./registry.ts) (kinds + schemas + recursive factories for `chance` and `repeat-over-turns`).

Effect **runtime handlers** live in [`src/lib/battle/effect-handlers/`](../../battle/effect-handlers/), grouped by concern into `<group>-handlers.ts` (`damage-handlers.ts`, `status-handlers.ts`, `mana-health-handlers.ts`, `simple-handlers.ts`) plus `registry.ts` (kind table + `chance`/`repeat-over-turns` dispatch) and `handler-types.ts` (context type + `defineHandler` + `ccDeepenedSinceStart`). Handlers are created via `defineHandler(kind, fn)` in [`handler-types.ts`](../../battle/effect-handlers/handler-types.ts) which enforces kind-narrowing and turns direct mismatched calls into throws (registry still warm-warns for truly unknown kinds). Potion scaling threads `potionMult` (from `isPotionCard` + `talentEffects.potionPotency` in `registry.ts`) through every handler; each handler opts in via `applyPotionMultiplier` in `amount-helpers.ts`. The rule is **benefits scale, costs don't**: damage/heal/mana/gold/wish/status gains scale, while `self-damage`, `lose-*`, and factor-based effects (`multiply-enemy-status`) ignore potency. Flag effects (`next-hit-crit`, `play-next-card-twice`, `next-hit-poison`) share the `FLAG_EFFECTS` table in `simple-handlers.ts`; `next-archery-free` sets its flag through a standalone handler.

The canonical kind list is [`BATTLE_CARD_EFFECT_KINDS`](./registry.ts). Template definitions aggregate in the same registry. `BattleCardEffect["kind"]` and `BattleCardEffectKind` are held equal by a static assert in `registry.ts`, and `isRecursiveBattleCardEffectKind()` is the single check for the recursive kinds. Per-kind dispatch is [`EFFECT_APPLY_BY_KIND`](../../battle/effect-handlers/registry.ts).

## Adding a kind

Add the union member in [`src/lib/game-data/types.ts`](../types.ts), a schema definition in the matching `<group>-schemas.ts`, the definition in `TEMPLATE_EFFECT_DEFINITIONS`, a handler in the matching `<group>-handlers.ts` plus its `EFFECT_APPLY_BY_KIND` row, a `FORMATTERS` row in [`effect-metadata.ts`](../effect-metadata.ts), and a numeric-parity check in [`numeric-parity.ts`](../../content-validation/card-parity/numeric-parity.ts) when the kind has an authored number line. Card previews show authored base amounts only — no handler math is mirrored into tooltips.

[`applyCardEffects`](../../battle/effect-handlers/registry.ts) is the single entry point exported from `@/lib/battle`. It walks each effect on a card, routes `chance` (via `rollChance` + `getBattleRng`) and `repeat-over-turns` (queue `pendingTurnStartEffects` with source card ID, Consume, and tags) before the registry, and otherwise delegates to `applyEffectByKind`.

## Ordering and semantics

- `player-status` with `convertCurrentMana` interprets the value as **block per mana** (`manaAtStart * convertCurrentMana`), zeroes mana, and respects `manaAtStart` snapshot from `CardEffectResolutionContext` (frozen before any effect mutates `state.mana`). `perManaCrystal` uses live `maxMana`.
- `restore-mana` may opt into `allowOverflow` for temporary extra Mana (Mana Moth). Omission preserves capped restoration; restoration never removes existing overflow. This does not add Mana Crystals.
- `restore-mana` with `ifEnemyFrozen` compares live `enemyCC.freezeSkipTurns` against the frozen `enemyFreezeSkipTurnsAtStart` — so a `damage`→`freeze` earlier on the same card enables the restore, but only if the threshold was crossed by that card's own effects.
- `damage` with `equalToBlock`/`equalToArmor`/`equalToGoldPercent` intentionally bypasses per-type flat/gear/talent modifiers — only `forgeBonus` and `applyConsumeBonus` apply; this matches card text for Tithe / Blessed Aegis.
- `damage.equalToForge` reads live Forge as the base, without adding Forge a second time through Forge-to-Burn talents. It follows the other equal-resource effects' flat-modifier bypass and normal hit multipliers. Burning Blade resolves this Burn hit before its Physical hit; ordinary Forge spending still applies. Enemies read their own already room-scaled Forge without scaling that resource again.
- `damage.ignoreArmor` bypasses only the target's Armor reduction. Block, Dodge, other mitigation, normal Armor decay, and gear reactions still apply, for both heroes and enemies.
- `remove-enemy-armor.removeAll` removes the target's current Armor before subsequent effects. Its retained `amount` field is ignored and is not an editable numeric target. Omission preserves fixed-amount removal for saved cards.
- `random-draw` rolls a uniformly distributed integer between its inclusive bounds using the world RNG, then uses ordinary drawing, reshuffling, and hand limits. Roll the Dice has fixed bounds 1–6; its die faces are rules rather than upgradeable magnitudes.
- `companion-action` invokes the existing Companion resolver once per `amount`, including utility actions, Bond bonuses, and reactions. No Companion is a no-op; victory or hero defeat prevents later actions. These actions do not count as additional card plays. Pack Tactics' implicit “twice” is an editable amount, like “Draw a card”; Whistle still grants its separate action once per card play.
- `random-damage` enforces `maxAmount >= minAmount` at schema level and throws loudly on inverted bounds at runtime. Corruption clamps either bound at the other bound, keeping the description and effect valid even after repeated mutations. Direct random-damage cards trigger the same once-per-card enemy retaliation as direct damage cards.
- `damage` cannot have both `doubleIfEnemyBurning` and `tripleIfEnemyNotBurning`.
- `gain-gold` with `ifEnemyStunned` fizzles unless the enemy is stunned at all.

- Numeric upgrades and corruption share `updateCardNumericValue` in `src/lib/corruption/numeric.ts`. Targets address nested scheduled effects and both chance branches. Chance paths index success effects followed by failure effects; probabilities and schedule durations are not editable magnitudes. A fixed Random damage amount displayed as one number updates both bounds together. A scheduled effect sharing one authored amount with an immediate effect changes with that amount; separately authored delayed amounts change independently. “Draw a card” represents one editable draw. Keep original catalog effects immutable.
- Immediate and delayed damage may share a description line: “Deal 1 Freeze damage now and 3 at the start of your next turn” retains two independently editable magnitudes. “Deal 2 Stun damage now and at the start of your next turn” shares one magnitude across both hits.

## Enemy abilities

Enemies reference canonical cards through `BestiaryEntry.abilityIds`; they do not
author a parallel effect library. `game-data/enemy-abilities.ts` validates the
supported subset, including every chance branch and conditional field.
`battle/enemy-turn-attack.ts` resolves that subset from the enemy's perspective,
using shared incoming-damage, crowd-control, healing, and mitigation primitives.
Hero-only resources and rewards never run for enemy self-benefits. Card-granted
Thorns and queued Bleed Leech use the same status semantics as hero cards while
retaining existing encounter exceptions. Selection and trait limits are owned by
[GAME_RULES](../../../../docs/GAME_RULES.md#enemy-abilities-and-traits).

## Tests

- [`tests/lib/battle/effect-handlers-registry.test.ts`](../../../../tests/lib/battle/effect-handlers-registry.test.ts) — every non-recursive kind has a handler.
- [`tests/lib/battle/apply-effects-*.test.ts`](../../../../tests/lib/battle/) — canonical apply-path coverage by concern (`apply-effects.test.ts`, `apply-effects-mana.test.ts`, `apply-effects-utility.test.ts`, `apply-effects-special.test.ts`).
- [`tests/lib/battle/effect-handlers.test.ts`](../../../../tests/lib/battle/effect-handlers.test.ts) — handler contract (mismatched kind throws), Death's Door, status/CC, cleanse/multiply, `convertCurrentMana` Block-per-Mana semantics, and `ifEnemyFrozen` branches.
- [`tests/lib/game-data/effects-registry.test.ts`](../../../../tests/lib/game-data/effects-registry.test.ts) — every kind has a schema, refines reject contradictory flags, and conditional fields parse.
- [`tests/lib/game-data/descriptions-match-effects.test.ts`](../../../../tests/lib/game-data/descriptions-match-effects.test.ts) — card `descriptionLines` reflect their `effects`.
