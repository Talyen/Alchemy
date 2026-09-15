export * from "./battle-setup";
export { isAttackCard } from "./card-classification";
export { canPlayCard, playBattleCardResolved, type CardPlayOptions } from "./card-play";
export { getBattleCardPlayTarget } from "./card-play-target";
export { mergeCombatText } from "./combat-text";
export { processCompanionTurnStart } from "./companion";
export { getBattleCompanionDamageModifiers } from "./companion-scaling";
export { applyDrawResult, drawCards, drawFromState, drawKeywordCard, takeRandomCardFromDeck } from "./draw";
export { applyCardEffects } from "./effect-handlers";
export { endPlayerTurn, recoverLegacyEnemyPhase } from "./enemy-turn";
export { collectUncoveredDifficultyModifierKinds, collectUncoveredEnemyTraitIds } from "./enemy-turn-traits";
export { getActiveCcKeyword, isCcControlled, type ActiveCcKeyword } from "./status-cc";
export { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
export * from "./types/state-types";
// Explicit staging surface: everything in state-helpers except the three
// hit-pipeline internals (playerStatusDelta, scaleReceivedPlayerDamage,
// mitigatePlayerCombatDamage), which battle leaves import relatively.
export {
  addEnemyMitigation,
  addEnemyStatus,
  addPlayerStatus,
  applyGearDamageResistance,
  applyPlayerCombatDamage,
  applyPlayerHealing,
  clampHealth,
  damageEnemyHealth,
  deathsDoorGraceTurns,
  type EnemyHitHealth,
  type EnemyTraitIgnoreMitigationOptions,
  gainMana,
  getEnemyTraitSet,
  hasEncounterBenefit,
  hasEnemyTrait,
  isPlayerDefeated,
  reduceEnemyArmor,
  scaleGoldReward,
  setEnemyStatus,
  setFlag,
  setPlayerStatus,
  stripEnemyArmor,
  stripEnemyBlock,
  withPreservedFlags,
} from "./types/state-helpers";
export { chooseWishCard } from "./wish";

export { createUniqueGearBattleState } from "./unique-gear-state";

export { resolveBattleTurn, type BattleTurnFrame, type ResolvedBattleTurn } from "./turn-resolution";
