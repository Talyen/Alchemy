# Battle handlers for card effects

Effect **schemas** live in [`src/lib/game-data/effects/`](./), grouped by concern into per-concern `<group>-schemas.ts` files plus the recursive `chance-definition.ts`.
Effect **runtime handlers** live in [`src/lib/battle/effect-handlers/`](../../battle/effect-handlers/), grouped by concern into five `<group>-handlers.ts` files plus `dispatch.ts` and `registry.ts`.

## Schemas (`src/lib/game-data/effects/`)

| Effect kind                                                                                                                                  | Schema file                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `damage`, `self-damage`, `random-damage`, `remove-enemy-armor`                                                                               | [`damage-schemas.ts`](./damage-schemas.ts)           |
| `player-status`, `enemy-status`, `remove-harmful-status`, `remove-player-status`, `multiply-enemy-status`, `cleanse-player-status-to-damage` | [`status-schemas.ts`](./status-schemas.ts)           |
| `restore-mana`, `lose-mana`, `gain-max-mana`, `lose-max-mana`, `heal`, `lose-health`                                                         | [`mana-health-schemas.ts`](./mana-health-schemas.ts) |
| `summon-companion`, `buff-companion`                                                                                                         | [`companion-schemas.ts`](./companion-schemas.ts)     |
| `gain-gold`, `wish`, `draw-cards`                                                                                                            | [`utility-schemas.ts`](./utility-schemas.ts)         |
| `chance` (recursive)                                                                                                                         | [`chance-definition.ts`](./chance-definition.ts)     |

The canonical kind list is [`BATTLE_CARD_EFFECT_KINDS`](./kinds.ts). All template definitions are aggregated in [`template-definitions.ts`](./template-definitions.ts).

## Runtime handlers (`src/lib/battle/effect-handlers/`)

| Concern                                                                                                                                               | File                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Damage (`damage`, `self-damage`, `random-damage`, `remove-enemy-armor`)                                                                               | [`damage-handlers.ts`](../../battle/effect-handlers/damage-handlers.ts)           |
| Status (`player-status`, `enemy-status`, `remove-harmful-status`, `remove-player-status`, `multiply-enemy-status`, `cleanse-player-status-to-damage`) | [`status-handlers.ts`](../../battle/effect-handlers/status-handlers.ts)           |
| Mana & health (`restore-mana`, `lose-mana`, `gain-max-mana`, `lose-max-mana`, `heal`, `lose-health`)                                                  | [`mana-health-handlers.ts`](../../battle/effect-handlers/mana-health-handlers.ts) |
| Companion (`summon-companion`, `buff-companion`)                                                                                                      | [`companion-handlers.ts`](../../battle/effect-handlers/companion-handlers.ts)     |
| Utility (`gain-gold`, `wish`, `draw-cards`)                                                                                                           | [`utility-handlers.ts`](../../battle/effect-handlers/utility-handlers.ts)         |

The per-kind dispatch map lives in [`registry.ts`](../../battle/effect-handlers/registry.ts) (`EFFECT_APPLY_BY_KIND`).

## Dispatch entry point

[`applyCardEffects`](../../battle/effect-handlers/dispatch.ts) is the single entry point exported from `@/lib/battle`. It walks each effect on a card, routes `chance` recursively, and otherwise delegates to `applyEffectByKind` from the registry.

## Tests

- [`tests/lib/battle/effect-handlers-registry.test.ts`](../../../../tests/lib/battle/effect-handlers-registry.test.ts) — every non-`chance` kind has a handler.
- [`tests/lib/game-data/effects-registry.test.ts`](../../../../tests/lib/game-data/effects-registry.test.ts) — every kind has a schema and they parse.
- [`tests/lib/game-data/descriptions-match-effects.test.ts`](../../../../tests/lib/game-data/descriptions-match-effects.test.ts) — card `descriptionLines` reflect their `effects`.
