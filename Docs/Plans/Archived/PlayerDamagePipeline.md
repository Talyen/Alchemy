---
status: complete
updated: 2026-09-22
---

# Player damage calculation ownership

## Problem

`player-damage-bonuses.ts` mixes flat packet construction with multiplicative
bonuses and once-per-battle flag consumption. Its positional arguments hide
whether a hit came from a Companion. This makes damage changes hard to place
and easy to apply at the wrong stage.

## Plan

1. Move packet construction, Forge eligibility, and typed flat modifiers into
   `player-damage-base.ts`.
2. Move additive multipliers and first-Burn flag consumption into
   `player-damage-multipliers.ts`.
3. Give both stages named inputs for card, bonus, and Companion origin. Keep
   `damage-calc.ts` as the ordering owner for base amount, first-hit bonuses,
   multiplication, pacing, critical strikes, and mitigation.
4. Update the battle-rule owner and the consumer inventory, then run focused
   damage tests and the task-scoped handoff gate.

## Invariants

Damage values, rounding, RNG draw order, flag consumption, and public battle
entry points remain unchanged. This is a private battle-engine refactor.
