export * from "./battle-setup";
export {
  AUTOPLAY_EFFECT_SCORE,
  getEffectiveDamageScore,
  getImmediateDamage,
  getImmediateDefense,
  pickHighestScoring,
} from "./autoplay-policy";
export { getBattleCardPlayTarget, isAttackCard } from "./card-classification";
export { canPlayCard, playBattleCardResolved, type CardPlayOptions } from "./card-play";
export { mergeCombatText } from "./combat-text-events";
export { processCompanionTurnStart } from "./companion";
export { getBattleCompanionDamageModifiers } from "./companion-scaling";
export { drawCards } from "./draw";
export { applyCardEffects } from "./effect-handlers";
export { endPlayerTurn, recoverLegacyEnemyPhase } from "./enemy-turn";
export { collectUncoveredDifficultyModifierKinds, collectUncoveredEnemyTraitIds } from "./enemy-turn-traits";
export { getActiveCcKeyword, isCcControlled, type ActiveCcKeyword } from "./status-cc";
export { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
export * from "./types/state-types";
// Barrel surface: only symbols consumed through the barrel live here.
// Battle internals import state-helpers relatively; keep this list to what
// barrel consumers actually use (knip entry-exports enforced).
export { addEnemyStatus, addPlayerStatus, applyPlayerCombatDamage, isPlayerDefeated } from "./types/state-helpers";
export { chooseWishCard } from "./wish";

export { createUniqueGearBattleState } from "./unique-gear-state";

export { resolveBattleTurn, type BattleTurnFrame, type ResolvedBattleTurn } from "./enemy-turn";
