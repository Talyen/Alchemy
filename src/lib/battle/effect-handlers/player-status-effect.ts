import type { BattleCardEffect } from "@/lib/game-data";
import { applyPlayerStatusEffect } from "../status-effects";
import type { BattleState, CombatTextEvent } from "../types";

export function handlePlayerStatusEffect(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "player-status" }>,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  let adjustedAmount = effect.amount;
  if (effect.perManaCrystal) {
    adjustedAmount = effect.perManaCrystal * state.maxMana;
  }
  if (potionMult !== 1) {
    adjustedAmount = Math.round(adjustedAmount * potionMult);
  }
  const adjustedEffect = { ...effect, amount: adjustedAmount };
  return applyPlayerStatusEffect(state, adjustedEffect, combatTexts);
}
