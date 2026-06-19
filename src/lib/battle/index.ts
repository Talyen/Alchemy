// Public barrel for the battle engine.
// Re-exports state creation, turn sequencing, effects, and types for UI/controllers.
// Consumers should import from here instead of binding to battle submodule paths.
export * from "./types";
export * from "./draw";
export * from "./battle-setup";
export { applyCardEffects } from "./apply-effects";
export { mergeCombatText } from "./combat-text";
export { applyIronwoodBuckler, applyBoneCharmHeal } from "./trinket-effects";
export { getEnemyDamageMultiplier, applyPlayerDamageStatuses } from "./status-effects";
export { canPlayCard, cardHasDamageType, playBattleCardResolved, type CardPlayOptions } from "./card-play";
export { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
export { chooseWishCard } from "./wish";
export { processCompanionTurnStart } from "./companion";
export { endPlayerTurn } from "./enemy-turn";
export { getBattleStartPlayerHealth } from "./start-health";
export * from "./cost";
export { unsafeNonSeededRng } from "./rng";
