# Battle Immutability & Seeded RNG

Status: enforced-rationale
Confidence: high

Why: mutating `BattleState` or using unseeded randomness breaks replay, balance sim, and rounding.

Owner: [GAME_RULES.md](../../../docs/GAME_RULES.md#battle-implementation-rules) owns immutable state, `Math.round`, and the `world`-stream contract; [run randomness](../../../docs/ARCHITECTURE.md#run-randomness) owns seeding details.

Enforcement: `BATTLE_NO_MATH_FLOOR`, `BATTLE_NO_MATH_RANDOM`, `BATTLE_NO_DIRECT_RNG` lint plus command boundary.
