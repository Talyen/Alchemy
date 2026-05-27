/**
 * Player card damage entry point — delegates to calculation and rider modules.
 */
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "./types";
import { computeCardDamageToEnemy } from "./damage-calc";
import { applyDamageRiders } from "./damage-riders";

export function dealDamageToEnemy(
  state: BattleState,
  card: BattleCard,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  combatTexts: CombatTextEvent[],
) {
  const { nextState, modifiedDamage } = computeCardDamageToEnemy(state, effect, card);
  return applyDamageRiders(nextState, card, effect, modifiedDamage, combatTexts);
}
