// Special card effects: gold-scaled damage, cleanse-to-damage, and random damage rolls.
import { DAMAGE_TYPES, type BattleCard, type BattleCardEffect } from "@/lib/game-data";
import { dealDamageToEnemy } from "./damage";
import { applyHealingWithCombatText } from "./combat-text";
import { getBattleRng } from "./status-helpers";
import type { BattleState, CombatTextEvent } from "./types";

export function handleCleansePlayerStatusToDamage(
  state: BattleState,
  card: BattleCard,
  effect: Extract<BattleCardEffect, { kind: "cleanse-player-status-to-damage" }>,
  combatTexts: CombatTextEvent[],
): BattleState {
  const stacks = state.playerStatuses[effect.status];
  if (stacks <= 0) return state;

  let nextState: BattleState = {
    ...state,
    playerStatuses: { ...state.playerStatuses, [effect.status]: 0 },
  };
  nextState = applyHealingWithCombatText(
    nextState,
    nextState.trinketEffects.sinEaterHealOnHarmfulStatusRemove,
    combatTexts,
  );
  nextState = applyHealingWithCombatText(nextState, nextState.talentEffects.healOnStatusCleanse, combatTexts);

  return dealDamageToEnemy(
    nextState,
    card,
    { kind: "damage", damageType: effect.damageType, amount: stacks },
    combatTexts,
  );
}

export function handleRandomDamage(
  state: BattleState,
  card: BattleCard,
  effect: Extract<BattleCardEffect, { kind: "random-damage" }>,
  combatTexts: CombatTextEvent[],
): BattleState {
  const rng = getBattleRng(state);
  const damageType = DAMAGE_TYPES[Math.trunc(rng() * DAMAGE_TYPES.length)]!;
  const span = effect.maxAmount - effect.minAmount + 1;
  const amount = effect.minAmount + Math.trunc(rng() * span);
  return dealDamageToEnemy(state, card, { kind: "damage", damageType, amount }, combatTexts);
}
