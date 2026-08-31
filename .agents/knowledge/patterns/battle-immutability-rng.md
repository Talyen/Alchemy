# Battle Immutability & Seeded RNG

Status: active
Confidence: high

## Observation

Battle logic tempted to mutate `BattleState` in place, use `Math.random()` / `Math.floor()`, or add stochastic choices without seeding. Past risks: nondeterministic replay, divergent balance sim, incorrect rounding.

## Why it matters

`BattleState` is treated as immutable; every card/effect handler returns a new state. Combat magnitudes use `Math.round` (nearest integer), never `Math.floor`. Live combat draws the persisted `world` run stream; engine consumers use `getBattleRng(state)` while setup helpers own direct callback access. `Math.random()` is allowed only for a fresh run seed or presentation-only values that cannot affect gameplay or persisted state.

## Evidence

- `docs/REFERENCE.md#battle-implementation-rules` — immutable state, `Math.round`, RNG rules, dodge/block/haste/death's-door.
- `src/lib/battle/` — `damage-calc.ts`, `dot-resolve.ts`, `status-ticks.ts`, `types/state-helpers.ts` (`addEnemyStatus`/`setEnemyStatus`).
- `src/lib/game-constants/combat-rules.ts` + topical constants — shared combat tuning lives there; content-owned magnitudes stay with their definitions.
- `eslint.config.js` — `BATTLE_NO_MATH_FLOOR`, `BATTLE_NO_MATH_RANDOM`, and `BATTLE_NO_DIRECT_RNG` cover battle TypeScript and TSX, with narrow setup-helper exceptions.
- `src/lib/battle/rng.ts` — `placeholderRng` is only allowed constant RNG.
- `docs/ARCHITECTURE.md#run-randomness` — `createDraftRunRandomSource(draft, stream)`, `withDraftWorldBattleRng` / `withRestingWorldBattleRng`.

## Preferred pattern

- Never mutate `BattleState` fields; return new state.
- `Math.round` for all combat math; never `Math.floor`.
- Live: `withDraftWorldBattleRng(draft, state)` inside command. Engine consumers: `getBattleRng(state)`. Tests/sim: `createRunStreamRng`.
- Enemy status via `addEnemyStatus` / `setEnemyStatus`; player damage via `scaleReceivedPlayerDamage` where applicable.
- Keep shared combat tunables in a topical `src/lib/game-constants/` file; keep content-owned magnitudes with their definitions.

## Exceptions

- `Math.random()` for a fresh run seed (`activeRun.rng.seed`) and presentation-only values that cannot affect gameplay or persisted state.
- `src/lib/battle/rng.ts` `placeholderRng` setup.

## Enforcement opportunity

Strongest existing: lint bans (`no-restricted-syntax`) plus the Immer command boundary. Further: type-level `Readonly<BattleState>` (already largely), Stryker mutation on `damage-calc.ts`/`dot-resolve.ts` nightly (`test:mutation`) ratchets arithmetic coverage.
