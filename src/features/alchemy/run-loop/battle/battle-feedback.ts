// Presentation feedback predicates for battle card and enemy resolution.
// Uses only battle/game-data types so feedback decisions stay easy to test.
import type { BattleState, CombatTextEvent } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";

// Steal has its own audio identity, so generic gold-gain feedback is suppressed for it.
export function shouldPlayCardGoldGain(previousState: BattleState, nextState: BattleState, card: BattleCard) {
  return nextState.gold > previousState.gold && card.id !== "steal";
}

// Enemy shake follows actual enemy damage text instead of card metadata so status/talent
// damage and multi-effect cards stay visually aligned with resolved combat output.
export function shouldShakeEnemyFromCombatTexts(combatTexts: CombatTextEvent[]) {
  return combatTexts.some((ct) => ct.kind === "damage" && ct.target === "enemy");
}

// Player shake triggers only on damage events, not block/armor/heal text.
export function shouldShakePlayerFromCombatTexts(combatTexts: CombatTextEvent[]) {
  return combatTexts.some((ct) => ct.kind === "damage" && ct.target === "player");
}

export interface CombatTextShakeFeedback {
  shakeEnemy: () => void;
  shakePlayer: () => void;
}

// Applies batch-level shake feedback; per-event impact cues are synchronized by showCombatTexts.
export function applyCombatTextShakeFeedback(combatTexts: CombatTextEvent[], feedback: CombatTextShakeFeedback) {
  if (shouldShakeEnemyFromCombatTexts(combatTexts)) feedback.shakeEnemy();
  if (shouldShakePlayerFromCombatTexts(combatTexts)) feedback.shakePlayer();
}
