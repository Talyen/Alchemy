import type { BattleCardEffect } from "@/lib/game-data";
import { applyHealingWithCombatText } from "../combat-text";
import type { BattleState, CombatTextEvent } from "../types";

export function handleHealEffect(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "heal" }>,
  potionMult: number,
  isConsume: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  const adjustedHeal = Math.round(effect.amount * potionMult);
  const consumeBonus = isConsume ? (state.talentEffects.consumeHealMultiplier ?? 0) : 0;
  const healAmount = Math.round(adjustedHeal * (state.talentEffects.healMultiplier + consumeBonus));
  return applyHealingWithCombatText(state, healAmount, combatTexts);
}
