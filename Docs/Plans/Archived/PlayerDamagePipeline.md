---
status: complete
updated: 2026-09-24
---

# Player damage calculation ownership

Flat packet construction and multiplicative bonuses once shared one module with positional origin arguments. `player-damage-base.ts` now owns base packets and typed flat modifiers; `player-damage-multipliers.ts` owns additive multipliers and first-Burn flags. `damage-calc.ts` keeps their order with pacing, critical strikes, and mitigation.

This private refactor preserves damage values, rounding, RNG order, flag use, and battle entry points. The implementation commit includes focused damage coverage; this archive does not retain a separate gate result.

Implementation: `0e140aa9`. Current owner: [Engine invariants](../../GAME_RULES.md#engine-invariants).
