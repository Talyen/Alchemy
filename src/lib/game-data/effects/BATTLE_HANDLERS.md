# Battle handlers for card effects

Effect **schemas** live in [`src/lib/game-data/effects/`](./), grouped by concern into `<group>-schemas.ts` files. Primitives (`AmountSchema`, `DamageTypeSchema`, `EnemyStatusIdSchema`, `CompanionIdSchema`) are owned by [`shared-schemas.ts`](./shared-schemas.ts). Domain definitions live in `damage-schemas.ts`, `status-schemas.ts`, `mana-health-schemas.ts`, and `simple-schemas.ts`. The unified registry is [`registry.ts`](./registry.ts) (kinds + schemas + recursive factories for `chance` and `repeat-over-turns`).

Effect **runtime handlers** live in [`src/lib/battle/effect-handlers/`](../../battle/effect-handlers/), grouped by concern into `<group>-handlers.ts` plus `registry.ts` (kind table + `chance`/`repeat-over-turns` dispatch) and `handler-types.ts` (context type + `defineHandler`). Handlers are created via `defineHandler(kind, fn)` in [`handler-types.ts`](../../battle/effect-handlers/handler-types.ts) which enforces kind-narrowing and turns direct mismatched calls into throws (registry still warm-warns for truly unknown kinds). Potion scaling is documented in `POTION_SCALED_KINDS` — `damage`, `random-damage`, `player-status`, `enemy-status`, `heal`, `restore-mana`, `gain-gold`, `wish`, `cleanse-player-status-to-damage`, and `remove-harmful-status` (conditional). Flag effects (`next-hit-crit`, `play-next-card-twice`, `next-hit-poison`) share the `FLAG_EFFECTS` table in `simple-handlers.ts`.

The canonical kind list is [`BATTLE_CARD_EFFECT_KINDS`](./registry.ts). Template definitions aggregate in the same registry. Per-kind dispatch is [`EFFECT_APPLY_BY_KIND`](../../battle/effect-handlers/registry.ts).

[`applyCardEffects`](../../battle/effect-handlers/registry.ts) is the single entry point exported from `@/lib/battle`. It walks each effect on a card, routes `chance` (via `rollChance` + `getBattleRng`) and `repeat-over-turns` (queue `pendingTurnStartEffects`) before the registry, and otherwise delegates to `applyEffectByKind`.

## Ordering and semantics

- `player-status` with `convertCurrentMana` interprets the value as **block per mana** (`manaAtStart * convertCurrentMana`), zeroes mana, and respects `manaAtStart` snapshot from `CardEffectResolutionContext` (frozen before any effect mutates `state.mana`). `perManaCrystal` uses live `maxMana`.
- `restore-mana` with `ifEnemyFrozen` compares live `enemyCC.freezeSkipTurns` against the frozen `enemyFreezeSkipTurnsAtStart` — so a `damage`→`freeze` earlier on the same card enables the restore, but only if the threshold was crossed by that card's own effects.
- `damage` with `equalToBlock`/`equalToArmor`/`equalToGoldPercent` intentionally bypasses per-type flat/gear/talent modifiers — only `forgeBonus` and `applyConsumeBonus` apply; this matches card text for Tithe / Blessed Aegis.
- `damage` with `random-damage` enforces `maxAmount >= minAmount` at schema level.
- `damage` cannot have both `doubleIfEnemyBurning` and `tripleIfEnemyNotBurning`.

## Tests

- [`tests/lib/battle/effect-handlers-registry.test.ts`](../../../../tests/lib/battle/effect-handlers-registry.test.ts) — every non-recursive kind has a handler.
- [`tests/lib/battle/apply-effects-*.test.ts`](../../../../tests/lib/battle/) — canonical apply-path coverage by concern (`apply-effects.test.ts`, `apply-effects-mana.test.ts`, `apply-effects-utility.test.ts`, `apply-effects-special.test.ts`).
- [`tests/lib/battle/effect-handlers.test.ts`](../../../../tests/lib/battle/effect-handlers.test.ts) — handler contract (mismatched kind throws), Death's Door, status/CC, cleanse/multiply, `convertCurrentMana` percent semantics, and `ifEnemyFrozen` branches.
- [`tests/lib/game-data/effects-registry.test.ts`](../../../../tests/lib/game-data/effects-registry.test.ts) — every kind has a schema, refines reject contradictory flags, and conditional fields parse.
- [`tests/lib/game-data/descriptions-match-effects.test.ts`](../../../../tests/lib/game-data/descriptions-match-effects.test.ts) — card `descriptionLines` reflect their `effects`.
