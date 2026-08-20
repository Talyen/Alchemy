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
  const convertToPoison = state.flags.nextHitPoison;
  const activeEffect = convertToPoison ? { ...effect, damageType: "poison" as const } : effect;
  const damageState = convertToPoison ? { ...state, flags: { ...state.flags, nextHitPoison: false } } : state;
  const { nextState, modifiedDamage } = computeCardDamageToEnemy(damageState, activeEffect, card);
  return applyDamageRiders(nextState, card, activeEffect, modifiedDamage, combatTexts);
}
