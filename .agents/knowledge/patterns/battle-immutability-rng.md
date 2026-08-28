# Battle Immutability & Seeded RNG

Status: active
Confidence: high

## Observation

Battle logic tempted to mutate `BattleState` in place, use `Math.random()` / `Math.floor()`, or add stochastic choices without seeding. Past risks: nondeterministic replay, divergent balance sim, incorrect rounding.

## Why it matters

`BattleState` is treated as immutable; every card/effect handler returns a new state. Combat magnitudes use `Math.round` (nearest integer), never `Math.floor`. Live combat draws the persisted `world` run stream; pure engine uses `state.rng` via `getBattleRng(state)`. `Math.random()` is allowed only for fresh run seed or cosmetic effects.

## Evidence

- `docs/REFERENCE.md#battle-implementation-rules` — immutable state, `Math.round`, RNG rules, dodge/block/haste/death's-door.
- `src/lib/battle/` — `damage-calc.ts`, `dot-resolve.ts`, `status-ticks.ts`, `types/state-helpers.ts` (`addEnemyStatus`/`setEnemyStatus`).
- `src/lib/game-constants/combat-rules.ts` + topical constants — tuning lives there, not inline.
- `eslint.config.js` — `BATTLE_NO_MATH_FLOOR`, `BATTLE_NO_MATH_RANDOM` in `src/lib/battle/**/*.tsx` and `src/**/*.tsx`.
- `src/lib/battle/rng.ts` — `placeholderRng` is only allowed constant RNG.
- `docs/ARCHITECTURE.md#run-randomness` — `createDraftRunRandomSource(draft, stream)`, `withDraftWorldBattleRng` / `withRestingWorldBattleRng`.

## Preferred pattern

- Never mutate `BattleState` fields; return new state.
- `Math.round` for all combat math; never `Math.floor`.
- Live: `withDraftWorldBattleRng(draft, state)` inside command. Pure: `state.rng` / `getBattleRng(state)`. Tests/sim: `createRunStreamRng`.
- Enemy status via `addEnemyStatus` / `setEnemyStatus`; player damage via `scaleReceivedPlayerDamage` where applicable.
- Keep tunables in `src/lib/game-constants/` topical file.

## Exceptions

- `Math.random()` for fresh run seed (`activeRun.rng.seed`) and cosmetic/presentation effects.
- `src/lib/battle/rng.ts` `placeholderRng` setup.

## Enforcement opportunity

Strongest existing: lint bans (`no-restricted-syntax`) + `MUTATION` via Immer boundary. Further: type-level `Readonly<BattleState>` (already largely), Stryker mutation on `damage-calc.ts`/`dot-resolve.ts` nightly (`test:mutation`) ratchets arithmetic coverage.
