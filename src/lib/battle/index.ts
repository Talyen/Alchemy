export { isAttackCard } from "./card-classification";
export * from "./types";
export * from "./draw";
export * from "./battle-setup";
export { applyCardEffects } from "./effect-handlers";
export { mergeCombatText } from "./combat-text";
export { canPlayCard, playBattleCardResolved, type CardPlayOptions } from "./card-play";
export { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
export { chooseWishCard } from "./wish";
export { processCompanionTurnStart } from "./companion";
export { endPlayerTurn, recoverLegacyEnemyPhase, type EndPlayerTurnResolution } from "./enemy-turn";
export { collectUncoveredDifficultyModifierKinds, collectUncoveredEnemyTraitIds } from "./enemy-turn-traits";
export { regrowEnemyThorns } from "./encounter-trait-events";
export { getActiveCcKeyword, isPlayerCcControlled, type ActiveCcKeyword } from "./status-cc";
export { getBattleCardPlayTarget } from "./card-play-target";

export { createUniqueGearBattleState } from "./unique-gear-state";

export { resolveBattleTurn, type BattleTurnFrame, type ResolvedBattleTurn } from "./turn-resolution";
