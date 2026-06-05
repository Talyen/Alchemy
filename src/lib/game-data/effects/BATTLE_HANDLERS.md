# Battle handlers for card effects

Effect **schemas** and **dispatch routes** live in `game-data/effects/<kind>/definition.ts`.  
Effect **runtime handlers** live in `lib/battle/effect-handlers/<kind>/apply.ts`, wired through [`registry.ts`](../../battle/effect-handlers/registry.ts).

| Effect kind | Battle apply module |
|-------------|---------------------|
| `damage` | [`damage/apply.ts`](../../battle/effect-handlers/damage/apply.ts) |
| `player-status` | [`player-status/apply.ts`](../../battle/effect-handlers/player-status/apply.ts) |
| `enemy-status` | [`enemy-status/apply.ts`](../../battle/effect-handlers/enemy-status/apply.ts) |
| `heal` | [`heal/apply.ts`](../../battle/effect-handlers/heal/apply.ts) |
| `cleanse-player-status-to-damage` | [`cleanse-player-status-to-damage/apply.ts`](../../battle/effect-handlers/cleanse-player-status-to-damage/apply.ts) |
| `random-damage` | [`random-damage/apply.ts`](../../battle/effect-handlers/random-damage/apply.ts) |
| `chance` | [`dispatch.ts`](../../battle/effect-handlers/dispatch.ts) (nested effects) |
| `restore-mana` | [`restore-mana/apply.ts`](../../battle/effect-handlers/restore-mana/apply.ts) |
| `lose-mana` | [`lose-mana/apply.ts`](../../battle/effect-handlers/lose-mana/apply.ts) |
| `gain-max-mana` | [`gain-max-mana/apply.ts`](../../battle/effect-handlers/gain-max-mana/apply.ts) |
| `lose-max-mana` | [`lose-max-mana/apply.ts`](../../battle/effect-handlers/lose-max-mana/apply.ts) |
| `gain-gold` | [`gain-gold/apply.ts`](../../battle/effect-handlers/gain-gold/apply.ts) |
| `wish` | [`wish/apply.ts`](../../battle/effect-handlers/wish/apply.ts) |
| `summon-companion` | [`summon-companion/apply.ts`](../../battle/effect-handlers/summon-companion/apply.ts) |
| `buff-companion` | [`buff-companion/apply.ts`](../../battle/effect-handlers/buff-companion/apply.ts) |
| `remove-harmful-status` | [`remove-harmful-status/apply.ts`](../../battle/effect-handlers/remove-harmful-status/apply.ts) |
| `remove-player-status` | [`remove-player-status/apply.ts`](../../battle/effect-handlers/remove-player-status/apply.ts) |
| `self-damage` | [`self-damage/apply.ts`](../../battle/effect-handlers/self-damage/apply.ts) |
| `lose-health` | [`lose-health/apply.ts`](../../battle/effect-handlers/lose-health/apply.ts) |
| `draw-cards` | [`draw-cards/apply.ts`](../../battle/effect-handlers/draw-cards/apply.ts) |
| `remove-enemy-armor` | [`remove-enemy-armor/apply.ts`](../../battle/effect-handlers/remove-enemy-armor/apply.ts) |
| `multiply-enemy-status` | [`multiply-enemy-status/apply.ts`](../../battle/effect-handlers/multiply-enemy-status/apply.ts) |

Entry point: [`applyCardEffects`](../../battle/effect-handlers/dispatch.ts) (re-exported from `@/lib/battle`).

Legacy test helpers: [`mana/compat.ts`](../../battle/effect-handlers/mana/compat.ts), [`utility/compat.ts`](../../battle/effect-handlers/utility/compat.ts).
