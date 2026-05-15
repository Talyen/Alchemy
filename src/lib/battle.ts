export * from "./battle/types";
// Public barrel for the battle engine.
// Re-exports state creation, turn sequencing, effects, and types for UI/controllers.
// Consumers should import from here instead of binding to battle submodule paths.
export * from "./battle/draw";
export { applyCardEffects } from "./battle/apply-effects";
export { mergeCombatText } from "./battle/combat-text";
export { applyIronwoodBuckler, applyBoneCharmHeal } from "./battle/trinket-effects";
export { getEnemyDamageMultiplier } from "./battle/status-effects";
export { cardHasDamageType, playBattleCardResolved } from "./battle/card-play";
export { tickEnemyStatuses, tickPlayerStatuses } from "./battle/status-ticks";
export { chooseWishCard, endPlayerTurn, processCompanionTurnStart } from "./battle/enemy-turn";
export * from "./battle/cost";
