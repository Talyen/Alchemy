import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { dealDamageToEnemy } from "../damage";
import type { BattleState, CombatTextEvent } from "../types";

export function handleDamageEffect(
  state: BattleState,
  card: BattleCard,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const adjustedEffect = potionMult !== 1 ? { ...effect, amount: Math.round(effect.amount * potionMult) } : effect;
  return dealDamageToEnemy(state, card, adjustedEffect, combatTexts);
}
