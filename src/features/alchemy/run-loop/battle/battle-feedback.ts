// Presentation feedback predicates for battle card and enemy resolution.
// Depends only on battle/game-data types so feedback decisions remain easy to test.
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

// Portrait hurt VFX (flash + sparks) only on real HP loss — not block absorb or mana loss.
function isPortraitHurtCombatText(event: CombatTextEvent) {
  return event.kind === "damage" && event.stat !== "block" && event.stat !== "mana";
}

export function shouldHurtPlayerFromCombatTexts(combatTexts: CombatTextEvent[]) {
  return combatTexts.some((ct) => ct.target === "player" && isPortraitHurtCombatText(ct));
}

export function shouldHurtEnemyFromCombatTexts(combatTexts: CombatTextEvent[]) {
  return combatTexts.some((ct) => ct.target === "enemy" && isPortraitHurtCombatText(ct));
}

export interface PortraitFeedback {
  shakeEnemy: () => void;
  shakePlayer: () => void;
  hurtEnemy: () => void;
  hurtPlayer: () => void;
}

// Applies shake + hurt portrait feedback from resolved combat text batches.
export function applyCombatTextPortraitFeedback(combatTexts: CombatTextEvent[], feedback: PortraitFeedback) {
  if (shouldShakeEnemyFromCombatTexts(combatTexts)) feedback.shakeEnemy();
  if (shouldShakePlayerFromCombatTexts(combatTexts)) feedback.shakePlayer();
  if (shouldHurtEnemyFromCombatTexts(combatTexts)) feedback.hurtEnemy();
  if (shouldHurtPlayerFromCombatTexts(combatTexts)) feedback.hurtPlayer();
}
