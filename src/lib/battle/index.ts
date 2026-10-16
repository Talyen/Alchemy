export * from "./battle-setup";
export { resolveBattleStart } from "./battle-start";
export {
  getEffectiveDamageScore,
  getImmediateDamage,
  getImmediateDefense,
  pickHighestScoring,
} from "./autoplay-policy";
export { getBattleCardPlayTarget, isAttackCard } from "./card-classification";
export { computeCardPayment } from "./card-cost-rules";
export { canPlayCard, type CardPlayOptions } from "./card-play";
export { projectEnemyDotDamage } from "./dot-resolve";
export { mergeCombatText } from "./combat-text-events";
export { processCompanionTurnStart } from "./companion";
export { getBattleCompanionDamageModifiers } from "./companion-scaling";
export { drawCards } from "./draw";
export { applyCardEffects } from "./effect-handlers";
export { collectUncoveredEnemyTraitIds } from "./enemy-turn-traits";
export { getActiveCcKeyword, isCcControlled, type ActiveCcKeyword } from "./status-cc";
export { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
export type * from "./types/state-types";
export { battleSnapshot } from "./battle-snapshot";
export { isStunFreezeBuildupBlocked } from "./crowd-control-policy";
export { EMPTY_ENEMY_MITIGATION } from "./enemy-mitigation-state";
// Barrel surface: only symbols consumed through the barrel live here.
// Internal callers import mechanics from their domain owners, never the type boundary.
export { addEnemyStatus, addPlayerStatus } from "./status-state";
export { applyPlayerCombatDamage } from "./health-state";
export { getBattleOutcome, isPlayerDefeated, type BattleOutcome } from "./battle-outcome";
export {
  resolveBattleAction,
  resolveBattleCard,
  resolveBattleWish,
  resolveBattleTurn,
  type BattleAction,
  type ResolvedBattleAction,
  type ResolvedPlayerAction,
} from "./battle-actions";

export { createUniqueGearBattleState } from "./unique-gear-state";

export type { BattleTurnFrame, ResolvedBattleTurn } from "./enemy-turn";

export { getEncounterEnemyAbility, getEncounterEnemyTrait, type EnemyDescriptionContext } from "./enemy-description";

export { getBattleDamageInspectionCard } from "./card-damage-inspection";
