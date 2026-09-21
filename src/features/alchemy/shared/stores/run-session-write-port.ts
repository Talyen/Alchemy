// Canonical gameplay write seam: every GameplayDraft mutator lives here.
//
// This module is the draft API for command authors (adapters call commands,
// and domain command modules import here rather than `./write/*` directly).
// The implementations are split by domain
// under `./write/` so each file owns one dual-write invariant and reviews
// stay small; the export list below is the complete API.
//
// Dual-write invariants (kept, documented where they apply):
// - Gold: `runProfile.gold` is the purse; `battleState.gold` mirrors it while a
//   battle is live. `setGold` syncs purse→battle; `setBattleState` commits
//   battle→purse via `syncPurseFromBattleGold`.
// - Materials: `runProfile.materialInventory` is the stockpile;
//   `run.activeRun.runMaterialsEarned` tallies what the live run earned.
//   `awardMaterialsDuringRun` writes both; `addMaterialsToStockpile` writes the
//   stockpile only (homestead end-of-run bonuses, meta salvage). Salvaged
//   crafting currencies mirror this via `run.activeRun.runCurrenciesEarned`,
//   tallied alongside the material grant in `dispatchGearSalvageWithMaterialGrant`.
// - Talent XP: `run.activeRun.runTalentXP` accrues during the run;
//   `finalizeRunXP` merges it into `runProfile.talentXP` once at run end.
export { addGold, deductGold, grantStartGold, readDraftGold, setGold } from "./write/run-gold";
export type { CombatMeta } from "./write/live-meta";
export { deriveCombatMeta, rebindLiveRunMeta } from "./write/live-meta";
export {
  abandonCorruptionDestinationVisit,
  abandonLabyrinthCorruptionVisit,
  abandonMysteryDestinationVisit,
  beginDestinationClaim,
  beginRewardClaim,
  cancelDestinationClaim,
  clearMysteryVisitState,
  clearShopOfferings,
  clearTransientSession,
  commitDestinationClaim,
  enterWildwoodVictory,
  releaseRewardClaim,
  setActiveLabyrinthModifiers,
  setActiveLabyrinthPendingNode,
  setActiveLabyrinthRewardModifiers,
  setAlchemistState,
  setCompanionRewardCards,
  setCorruptionResult,
  setEquipmentShopState,
  setHasActiveRun,
  setLabyrinthMap,
  setMysteryCardChoices,
  setMysteryChosenCardId,
  setMysteryChosenChoice,
  setMysteryEvent,
  setMysteryGrantedGearInstances,
  setMysteryGrantedTrinketIds,
  setMysteryPendingRemoval,
  setPendingCharacterId,
  setPendingContentSystemType,
  setRewardState,
  setRunEndCurrencies,
  setRunEndItems,
  setRunEndLabyrinthFloor,
  setRunEndMaterials,
  setSelectedLabyrinthNodeId,
  setShopState,
  setStarterDraftChoices,
  setTrinketShopState,
  setWildwoodDraft,
} from "./write/run-session";
export { setHasActiveBattle } from "./write/run-battle";
export { prepareRunNavigation, resetNavigation, setScreen } from "./write/run-navigation";
export {
  addRunCurrenciesEarned,
  addRunMaterialsEarned,
  awardBattleDodgeXP,
  awardCardXP,
  awardMysteryXP,
  clearRunCurrenciesEarned,
  clearRunMaterialsEarned,
  cloneRunObtainedItem,
  createDraftRunRandomSource,
  nextRunRandom,
  recordRunObtainedItem,
  resetRunXP,
  setCompletedDestinations,
  setCurrentAct,
  setDestinationIndexInAct,
  setDestinationOfferState,
  setEncounteredRunEnemyIds,
  setRoomsEncountered,
  setRunBoons,
  setRunDeck,
  setRunMaxHealth,
  setRunPlayerHealth,
} from "./write/run-progress";
export {
  applyRunStartSnapshot,
  initializeActiveRun,
  initializeFromResumeSnapshot,
  resetProgress,
} from "./write/run-init";
export {
  addMaterialsToStockpile,
  awardMaterialsDuringRun,
  bondCompanion,
  completeResearch,
  constructBuilding,
  plantFarm,
  setMaterials,
} from "./write/run-homestead";
export {
  applyTalentState,
  clearPermanentData,
  finalizeRunXP,
  handleCollectionTabChange,
  resetToDefaults,
  resetUnlockedTalents,
  setCollectionPage,
  setCompletedDifficulties,
  setDiscoveredCardIds,
  setDiscoveredTrinketIds,
  setDiscoveredUniqueIds,
  setEncounteredEnemyIds,
  setFinishedRunCharacters,
  unlockAllTalents,
  unlockTalent,
} from "./write/run-meta";

export {
  recordRunRoom,
  cancelRunRoomEntry,
  completeRunRoom,
  addRunGoldEarned,
  captureRunRecap,
} from "./write/run-recap";
