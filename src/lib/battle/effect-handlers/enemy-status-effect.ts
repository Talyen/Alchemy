import type { BattleCardEffect } from "@/lib/game-data";
import { addEnemyStatus, adjustEnemyStatusDelta, type BattleState, type CombatTextEvent } from "../types";
import { mergeCombatText } from "../combat-text";

export function handleEnemyStatusEffect(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "enemy-status" }>,
  combatTexts: CombatTextEvent[],
): BattleState {
  const adjustedDelta = adjustEnemyStatusDelta(state, effect.amount);
  mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: effect.status, amount: adjustedDelta });
  return addEnemyStatus(state, effect.status, effect.amount);
}
