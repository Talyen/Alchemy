export * from "./battle-setup";
export { resolveBattleStart } from "./battle-start";
export {
  getEffectiveDamageScore,
  getImmediateDamage,
  getImmediateDefense,
  hasPotentialLethalSelfCost,
  pickHighestScoring,
} from "./autoplay-policy";
export { getBattleCardPlayTarget, isAttackCard } from "./card-classification";
export { getBattleCardAnimationTarget } from "./card-animation-target";
export { computeCardPayment } from "./card-cost-rules";
export { canPlayCard, type CardPlayOptions } from "./card-play";
export { mergeCombatText } from "./combat-text-events";
export { processCompanionTurnStart } from "./companion";
export { getBattleCompanionDamageModifiers } from "./companion-scaling";
export { applyCardEffects } from "./effect-handlers";
export { getActiveCcKeyword, isCcControlled, type ActiveCcKeyword } from "./status-cc";
export { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
export type * from "./types/state-types";
export { battleSnapshot } from "./battle-snapshot";
export { isStunFreezeBuildupBlocked } from "./crowd-control-policy";
// Barrel surface: only symbols consumed through the barrel live here.
// Internal callers import mechanics from their domain owners, never the type boundary.
export { addEnemyStatus, addPlayerStatus } from "./status-state";
export { applyPlayerCombatDamage } from "./health-state";
export { getBattleOutcome, isPlayerDefeated, type BattleOutcome } from "./battle-outcome";
export { resolveBattleAction, resolveBattleCard, resolveBattleWish, resolveBattleTurn } from "./battle-actions";

export { createUniqueGearBattleState } from "./unique-gear-state";

export type { BattleTurnFrame, ResolvedBattleTurn } from "./enemy-turn";

export { getEncounterEnemyAbility, getEncounterEnemyTrait, type EnemyDescriptionContext } from "./enemy-description";

export { getBattleCardDescriptionInspection } from "./card-damage-inspection";

export { createElementalReactionState, expireCcReactions } from "./elemental-reaction-state";
export { REACTION_DEFINITIONS, type ReactionId } from "./reaction-definitions";
