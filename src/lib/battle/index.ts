export * from "./battle-setup";
export { isAttackCard } from "./card-classification";
export { canPlayCard, playBattleCardResolved, type CardPlayOptions } from "./card-play";
export { getBattleCardPlayTarget } from "./card-play-target";
export { mergeCombatText } from "./combat-text";
export { processCompanionTurnStart } from "./companion";
export { getBattleCompanionDamageModifiers } from "./companion-scaling";
export * from "./draw";
export { applyCardEffects } from "./effect-handlers";
export { regrowEnemyThorns } from "./encounter-trait-events";
export { endPlayerTurn, recoverLegacyEnemyPhase } from "./enemy-turn";
export { collectUncoveredDifficultyModifierKinds, collectUncoveredEnemyTraitIds } from "./enemy-turn-traits";
export { getActiveCcKeyword, isCcControlled, type ActiveCcKeyword } from "./status-cc";
export { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
export * from "./types";
export { chooseWishCard } from "./wish";

export { createUniqueGearBattleState } from "./unique-gear-state";

export { resolveBattleTurn, type BattleTurnFrame, type ResolvedBattleTurn } from "./turn-resolution";
