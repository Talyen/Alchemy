export * from "./battle-setup";
export { resolveBattleStart } from "./battle-start";
export {
  getEffectiveDamageScore,
  getImmediateDamage,
  getImmediateDefense,
  pickHighestScoring,
} from "./autoplay-policy";
export { getBattleCardPlayTarget, getBattleCardTransmutationRole, isAttackCard } from "./card-classification";
export { canPlayCard, playBattleCardResolved, type CardPlayOptions } from "./card-play";
export { projectEnemyDotDamage } from "./dot-resolve";
export { mergeCombatText } from "./combat-text-events";
export { processCompanionTurnStart } from "./companion";
export { getBattleCompanionDamageModifiers } from "./companion-scaling";
export { drawCards } from "./draw";
export { applyCardEffects } from "./effect-handlers";
export { endPlayerTurn } from "./enemy-turn";
export { collectUncoveredDifficultyModifierKinds, collectUncoveredEnemyTraitIds } from "./enemy-turn-traits";
export { getActiveCcKeyword, isCcControlled, type ActiveCcKeyword } from "./status-cc";
export { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
export type * from "./types/state-types";
export { battleSnapshot } from "./battle-snapshot";
export { isStunFreezeBuildupBlocked } from "./crowd-control-policy";
export { EMPTY_ENEMY_MITIGATION } from "./enemy-mitigation-state";
// Barrel surface: only symbols consumed through the barrel live here.
// Internal callers import mechanics from their domain owners, never the type boundary.
export { addEnemyStatus, addPlayerStatus } from "./status-state";
export { applyPlayerCombatDamage, isPlayerDefeated } from "./health-state";
export { chooseWishCard } from "./wish";

export { createUniqueGearBattleState } from "./unique-gear-state";

export { resolveBattleTurn, type BattleTurnFrame, type ResolvedBattleTurn } from "./enemy-turn";
