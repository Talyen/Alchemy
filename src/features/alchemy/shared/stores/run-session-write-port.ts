// Public gameplay write capability for feature code.
// Focused implementations remain split by concern under ports/; this module
// is the only feature-facing write barrel so callers do not depend on storage
// layout or low-level slice modules.
export {
  setActiveLabyrinthModifiers,
  setActiveLabyrinthRewardModifiers,
  setActiveLabyrinthPendingNode,
  setLabyrinthMap,
} from "./ports/run-session-labyrinth-port";
export {
  setShopState,
  setAlchemistState,
  setTrinketShopState,
  setEquipmentShopState,
} from "./ports/run-session-shop-port";
export { setMysteryEvent, setMysteryCardChoices } from "./ports/run-session-mystery-port";
export {
  setRewardState,
  setCompanionRewardCards,
  beginRewardClaim,
  releaseRewardClaim,
  beginDestinationClaim,
  commitDestinationClaim,
  cancelDestinationClaim,
  setRunEndMaterials,
  setCorruptionResult,
} from "./ports/run-session-reward-port";
export { awardMaterialsDuringRun, setMaterials, finalizeRunXP, unlockAllTalents } from "./ports/run-profile-write-port";
export {
  setPendingCharacterId,
  setPendingContentSystemType,
  setWildwoodDraft,
  applyRunStartSnapshot,
} from "./ports/run-session-setup-port";
export {
  clearBattleTransition,
  beginBattleTransition,
  commitBattleTransition,
  initializeActiveBattle,
  setBattleStartState,
  setBattleState,
  setHasActiveBattle,
} from "./ports/run-battle-write-port";
