# Battle handlers for card effects

Effect **schemas** live in [`src/lib/game-data/effects/`](./), grouped by concern into `<group>-schemas.ts` files. Primitives (`AmountSchema`, `DamageTypeSchema`, `EnemyStatusIdSchema`, `CompanionIdSchema`) are owned by [`shared-schemas.ts`](./shared-schemas.ts). Domain definitions live in `damage-schemas.ts`, `status-schemas.ts`, `mana-health-schemas.ts`, and `simple-schemas.ts`. The unified registry is [`registry.ts`](./registry.ts) (kinds + schemas + recursive factories for `chance` and `repeat-over-turns`).

Effect **runtime handlers** live in [`src/lib/battle/effect-handlers/`](../../battle/effect-handlers/), grouped by concern into `<group>-handlers.ts` (`damage-handlers.ts`, `status-handlers.ts`, `mana-health-handlers.ts`, `simple-handlers.ts`) plus `registry.ts` (kind table + `chance`/`repeat-over-turns` dispatch) and `handler-types.ts` (context type + `defineHandler` + `ccDeepenedSinceStart`). Handlers are created via `defineHandler(kind, fn)` in [`handler-types.ts`](../../battle/effect-handlers/handler-types.ts) which enforces kind-narrowing and turns direct mismatched calls into throws (registry still warm-warns for truly unknown kinds). Potion scaling threads `potionMult` (from `isPotionCard` + `talentEffects.potionPotency` in `registry.ts`) through every handler; each handler opts in via `applyPotionMultiplier` in `amount-helpers.ts`. The rule is **benefits scale, costs don't**: damage/heal/mana/gold/wish/status gains scale, while `self-damage`, `lose-*`, and factor-based effects (`multiply-enemy-status`) ignore potency. Flag effects (`next-hit-crit`, `play-next-card-twice`, `next-hit-poison`) share the `FLAG_EFFECTS` table in `simple-handlers.ts`; `next-archery-free` sets its flag through a standalone handler.

The canonical kind list is [`BATTLE_CARD_EFFECT_KINDS`](./registry.ts). Template definitions aggregate in the same registry. `BattleCardEffect["kind"]` and `BattleCardEffectKind` are held equal by a static assert in `registry.ts`, and `isRecursiveBattleCardEffectKind()` is the single check for the recursive kinds. Per-kind dispatch is [`EFFECT_APPLY_BY_KIND`](../../battle/effect-handlers/registry.ts).

## Adding a kind

Add the union member in [`src/lib/game-data/types.ts`](../types.ts), a schema definition in the matching `<group>-schemas.ts`, the definition in `TEMPLATE_EFFECT_DEFINITIONS`, a handler in the matching `<group>-handlers.ts` plus its `EFFECT_APPLY_BY_KIND` row, a `FORMATTERS` row in [`effect-metadata.ts`](../effect-metadata.ts), and a numeric-parity check in [`numeric-parity.ts`](../../content-validation/card-parity/numeric-parity.ts) when the kind has an authored number line. Card previews show authored base amounts only — no handler math is mirrored into tooltips.

[`applyCardEffects`](../../battle/effect-handlers/registry.ts) is the single entry point exported from `@/lib/battle`. It walks each effect on a card, routes `chance` (via `rollChance` + `getBattleRng`) and `repeat-over-turns` (queue `pendingTurnStartEffects`) before the registry, and otherwise delegates to `applyEffectByKind`.

## Ordering and semantics

- `player-status` with `convertCurrentMana` interprets the value as **block per mana** (`manaAtStart * convertCurrentMana`), zeroes mana, and respects `manaAtStart` snapshot from `CardEffectResolutionContext` (frozen before any effect mutates `state.mana`). `perManaCrystal` uses live `maxMana`.
- `restore-mana` with `ifEnemyFrozen` compares live `enemyCC.freezeSkipTurns` against the frozen `enemyFreezeSkipTurnsAtStart` — so a `damage`→`freeze` earlier on the same card enables the restore, but only if the threshold was crossed by that card's own effects.
- `damage` with `equalToBlock`/`equalToArmor`/`equalToGoldPercent` intentionally bypasses per-type flat/gear/talent modifiers — only `forgeBonus` and `applyConsumeBonus` apply; this matches card text for Tithe / Blessed Aegis.
- `damage` with `random-damage` enforces `maxAmount >= minAmount` at schema level and throws loudly on inverted bounds at runtime.
- `damage` cannot have both `doubleIfEnemyBurning` and `tripleIfEnemyNotBurning`.
- `gain-gold` with `ifEnemyStunned` fizzles unless the enemy is stunned at all.

## Tests

- [`tests/lib/battle/effect-handlers-registry.test.ts`](../../../../tests/lib/battle/effect-handlers-registry.test.ts) — every non-recursive kind has a handler.
- [`tests/lib/battle/apply-effects-*.test.ts`](../../../../tests/lib/battle/) — canonical apply-path coverage by concern (`apply-effects.test.ts`, `apply-effects-mana.test.ts`, `apply-effects-utility.test.ts`, `apply-effects-special.test.ts`).
- [`tests/lib/battle/effect-handlers.test.ts`](../../../../tests/lib/battle/effect-handlers.test.ts) — handler contract (mismatched kind throws), Death's Door, status/CC, cleanse/multiply, `convertCurrentMana` percent semantics, and `ifEnemyFrozen` branches.
- [`tests/lib/game-data/effects-registry.test.ts`](../../../../tests/lib/game-data/effects-registry.test.ts) — every kind has a schema, refines reject contradictory flags, and conditional fields parse.
- [`tests/lib/game-data/descriptions-match-effects.test.ts`](../../../../tests/lib/game-data/descriptions-match-effects.test.ts) — card `descriptionLines` reflect their `effects`.
