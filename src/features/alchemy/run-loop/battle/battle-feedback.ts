import type { BattleState, CombatTextEvent } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";

export function shouldPlayCardGoldGain(previousState: BattleState, nextState: BattleState, card: BattleCard) {
  return nextState.gold > previousState.gold && card.id !== "steal";
}

export function shouldShakeEnemyFromCombatTexts(combatTexts: CombatTextEvent[]) {
  return combatTexts.some((ct) => ct.kind === "damage" && ct.target === "enemy");
}

export function shouldShakePlayerFromCombatTexts(combatTexts: CombatTextEvent[]) {
  return combatTexts.some((ct) => ct.kind === "damage" && ct.target === "player");
}

export interface CombatTextShakeFeedback {
  shakeEnemy: () => void;
  shakePlayer: () => void;
}

export function applyCombatTextShakeFeedback(combatTexts: CombatTextEvent[], feedback: CombatTextShakeFeedback) {
  if (shouldShakeEnemyFromCombatTexts(combatTexts)) feedback.shakeEnemy();
  if (shouldShakePlayerFromCombatTexts(combatTexts)) feedback.shakePlayer();
}
