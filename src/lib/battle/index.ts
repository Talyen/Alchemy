// Public barrel for the battle engine.
// Re-exports state creation, turn sequencing, effects, and types for UI/controllers.
// Consumers should import from here instead of binding to battle submodule paths.
export * from "./types";
export * from "./draw";
export * from "./battle-setup";
export { applyCardEffects } from "./effect-handlers";
export { mergeCombatText } from "./combat-text";
export { getEnemyDamageMultiplier } from "./status-helpers";
export { canPlayCard, playBattleCardResolved, type CardPlayOptions } from "./card-play";
export { cardHasDamageType, computeEffectiveCost } from "./card-cost-rules";
export { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
export { chooseWishCard } from "./wish";
export { processCompanionTurnStart } from "./companion";
export { endPlayerTurn, recoverLegacyEnemyPhase, type EndPlayerTurnResolution } from "./enemy-turn";
export { collectUncoveredDifficultyModifierKinds, collectUncoveredEnemyTraitIds } from "./enemy-turn-traits";
export { getBattleStartPlayerHealth } from "./start-health";
export {
  fightPacingClockMultiplier,
  fightPacingComebackMultiplier,
  fightPacingMultiplier,
  fightPacingPoolMetrics,
  paceCombatMagnitude,
  type FightPacingSide,
} from "./fight-pacing";
export { repairPersistedBattleBoonManifest } from "./repair-persisted-trinket-manifest";
export { getActiveCcKeyword, isPlayerCcControlled, type ActiveCcKeyword } from "./status-cc";
