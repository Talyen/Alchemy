# Battle handlers for card effects

Effect **schemas** and **dispatch routes** live in `effects/<kind>/definition.ts`.  
Effect **runtime handlers** live under `src/lib/battle/effect-handlers/`.

| Dispatch route | Battle module | Effect kinds |
|----------------|---------------|--------------|
| `damage` | [`damage-effect.ts`](../../battle/effect-handlers/damage-effect.ts) | `damage` |
| `player-status` | [`player-status-effect.ts`](../../battle/effect-handlers/player-status-effect.ts) | `player-status` |
| `enemy-status` | [`enemy-status-effect.ts`](../../battle/effect-handlers/enemy-status-effect.ts) | `enemy-status` |
| `heal` | [`heal-effect.ts`](../../battle/effect-handlers/heal-effect.ts) | `heal` |
| `cleanse-player-status-to-damage` | [`special-route.ts`](../../battle/effect-handlers/special-route.ts) | `cleanse-player-status-to-damage` |
| `random-damage` | [`special-route.ts`](../../battle/effect-handlers/special-route.ts) | `random-damage` |
| `chance` | [`dispatch.ts`](../../battle/effect-handlers/dispatch.ts) | `chance` |
| `mana` | [`mana-route.ts`](../../battle/effect-handlers/mana-route.ts) | `restore-mana`, `lose-mana`, `lose-max-mana`, `gain-max-mana` |
| `utility` | [`utility-route.ts`](../../battle/effect-handlers/utility-route.ts) | `gain-gold`, `wish`, `summon-companion`, … |

Entry point: [`applyCardEffects`](../../battle/effect-handlers/dispatch.ts) (re-exported from `@/lib/battle`).
