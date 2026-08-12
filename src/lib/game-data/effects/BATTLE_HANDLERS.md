# Battle handlers for card effects

Effect **schemas** live in [`src/lib/game-data/effects/`](./), grouped by concern into `<group>-schemas.ts` files plus the recursive `chance-definition.ts`.
Effect **runtime handlers** live in [`src/lib/battle/effect-handlers/`](../../battle/effect-handlers/), grouped by concern into `<group>-handlers.ts` plus `dispatch.ts` and `registry.ts`.

The canonical kind list is [`BATTLE_CARD_EFFECT_KINDS`](./kinds.ts). Template definitions aggregate in [`template-definitions.ts`](./template-definitions.ts). Per-kind dispatch is [`EFFECT_APPLY_BY_KIND`](../../battle/effect-handlers/registry.ts).

[`applyCardEffects`](../../battle/effect-handlers/dispatch.ts) is the single entry point exported from `@/lib/battle`. It walks each effect on a card, routes `chance` recursively, and otherwise delegates to `applyEffectByKind`.

## Tests

- [`tests/lib/battle/effect-handlers-registry.test.ts`](../../../../tests/lib/battle/effect-handlers-registry.test.ts) — every non-`chance` kind has a handler.
- [`tests/lib/game-data/effects-registry.test.ts`](../../../../tests/lib/game-data/effects-registry.test.ts) — every kind has a schema and they parse.
- [`tests/lib/game-data/descriptions-match-effects.test.ts`](../../../../tests/lib/game-data/descriptions-match-effects.test.ts) — card `descriptionLines` reflect their `effects`.
