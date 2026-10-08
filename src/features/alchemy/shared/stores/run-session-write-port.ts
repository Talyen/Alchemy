import * as ending from "./write/run-end";
import { gameplayDraftRuntime } from "./gameplay-command";
// Canonical gameplay write seam: commands write through these transaction operations.
//
// This module is the transaction API for command authors (adapters call commands,
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

import type { RunActivityData } from "@/lib/active-run-session";
import type { Immutable } from "immer";
import { createReadonlyView, unwrapReadonlyValue } from "./readonly-view";
import type { RunTransaction } from "./run-session-command";
import { transactionDraft, transactionOperation } from "./transaction-internal";
import * as meta from "./write/live-meta";
import * as battle from "./write/run-battle";
import * as battleStart from "./write/battle-start";
import * as gold from "./write/run-gold";
import * as homestead from "./write/run-homestead";
import * as initialization from "./write/run-init";
import * as profile from "./write/run-meta";
import * as navigation from "./write/run-navigation";
import * as progress from "./write/run-progress";
import * as recap from "./write/run-recap";
import * as session from "./write/run-session";

export const initializeBattle = transactionOperation(battleStart.initializeBattle);

export const addGold = transactionOperation(gold.addGold);
export const deductGold = transactionOperation(gold.deductGold);
export const grantStartGold = transactionOperation(gold.grantStartGold);
export const readDraftGold = transactionOperation(gold.readDraftGold);
export const setGold = transactionOperation(gold.setGold);
export const deriveCombatMeta = transactionOperation(meta.deriveCombatMeta);
export const rebindLiveRunMeta = transactionOperation(meta.rebindLiveRunMeta);
export const abandonCorruptionDestinationVisit = transactionOperation(session.abandonCorruptionDestinationVisit);
export const abandonLabyrinthCorruptionVisit = transactionOperation(session.abandonLabyrinthCorruptionVisit);
export const abandonMysteryDestinationVisit = transactionOperation(session.abandonMysteryDestinationVisit);
export const setAlchemyVisit = transactionOperation(session.setAlchemyVisit);
export const beginDestinationClaim = transactionOperation(session.beginDestinationClaim);
export const beginRewardClaim = transactionOperation(session.beginRewardClaim);
export const cancelDestinationClaim = transactionOperation(session.cancelDestinationClaim);
export const clearMysteryVisitState = transactionOperation(session.clearMysteryVisitState);
export const clearShopOfferings = transactionOperation(session.clearShopOfferings);
export const clearTransientSession = transactionOperation(session.clearTransientSession);
export const commitDestinationClaim = transactionOperation(session.commitDestinationClaim);
export const enterWildwoodVictory = transactionOperation(session.enterWildwoodVictory);
export const releaseRewardClaim = transactionOperation(session.releaseRewardClaim);
export const setActiveLabyrinthModifiers = transactionOperation(session.setActiveLabyrinthModifiers);
export const setActiveLabyrinthPendingNode = transactionOperation(session.setActiveLabyrinthPendingNode);
export const setActiveLabyrinthRewardModifiers = transactionOperation(session.setActiveLabyrinthRewardModifiers);
export const setAlchemistState = transactionOperation(session.setAlchemistState);
export const setCompanionRewardCards = transactionOperation(session.setCompanionRewardCards);
export const setCorruptionResult = transactionOperation(session.setCorruptionResult);
export const setEquipmentShopState = transactionOperation(session.setEquipmentShopState);
export const setHasActiveRun = transactionOperation(session.setHasActiveRun);
export const setLabyrinthMap = transactionOperation(session.setLabyrinthMap);
export const setMysteryCardChoices = transactionOperation(session.setMysteryCardChoices);
export const setMysteryChosenCardId = transactionOperation(session.setMysteryChosenCardId);
export const setMysteryChosenChoice = transactionOperation(session.setMysteryChosenChoice);
export const setMysteryEvent = transactionOperation(session.setMysteryEvent);
export const setMysteryGrantedGearInstances = transactionOperation(session.setMysteryGrantedGearInstances);
export const setMysteryGrantedTrinketIds = transactionOperation(session.setMysteryGrantedTrinketIds);
export const setPendingCharacterId = transactionOperation(session.setPendingCharacterId);
export const setPendingContentSystemType = transactionOperation(session.setPendingContentSystemType);
export const setRewardState = transactionOperation(session.setRewardState);
export const setRunEndCurrencies = transactionOperation(session.setRunEndCurrencies);
export const setRunEndItems = transactionOperation(session.setRunEndItems);
export const setRunEndLabyrinthFloor = transactionOperation(session.setRunEndLabyrinthFloor);
export const setRunEndMaterials = transactionOperation(session.setRunEndMaterials);
export const setSelectedLabyrinthNodeId = transactionOperation(session.setSelectedLabyrinthNodeId);
export const setShopState = transactionOperation(session.setShopState);
export function setRunActivityData<K extends keyof RunActivityData>(
  transaction: RunTransaction,
  kind: K,
  action:
    | RunActivityData[NoInfer<K>]
    | Immutable<RunActivityData[NoInfer<K>]>
    | ((
        previous: Immutable<RunActivityData[NoInfer<K>]>,
      ) => RunActivityData[NoInfer<K>] | Immutable<RunActivityData[NoInfer<K>]>),
): void {
  session.setRunActivityData(
    transactionDraft(transaction),
    kind,
    (previous) =>
      unwrapReadonlyValue(
        typeof action === "function" ? action(createReadonlyView(previous)) : action,
      ) as RunActivityData[NoInfer<K>],
  );
}
export const setStarterDraftChoices = transactionOperation(session.setStarterDraftChoices);
export const setTrinketShopState = transactionOperation(session.setTrinketShopState);
export const setWildwoodDraft = transactionOperation(session.setWildwoodDraft);
export const enterBattle = transactionOperation(battle.enterBattle);
export const settleBattleVictory = transactionOperation(battle.settleBattleVictory);
export const setRunProgressActivity = transactionOperation(session.setRunProgressActivity);
export const resetNavigation = transactionOperation(navigation.resetNavigation);
export const setScreen = transactionOperation(navigation.setScreen);
export const addRunCurrenciesEarned = transactionOperation(progress.addRunCurrenciesEarned);
export const addRunMaterialsEarned = transactionOperation(progress.addRunMaterialsEarned);
export const awardBattleDodgeXP = transactionOperation(progress.awardBattleDodgeXP);
export const awardCardXP = transactionOperation(progress.awardCardXP);
export const awardMysteryXP = transactionOperation(progress.awardMysteryXP);
export const clearRunCurrenciesEarned = transactionOperation(progress.clearRunCurrenciesEarned);
export const clearRunMaterialsEarned = transactionOperation(progress.clearRunMaterialsEarned);
export type { CombatMeta } from "./write/live-meta";
export { cloneRunObtainedItem } from "./write/run-progress";
export const createDraftRunRandomSource = transactionOperation(progress.createDraftRunRandomSource);
export const nextRunRandom = transactionOperation(progress.nextRunRandom);
export const recordRunObtainedItem = transactionOperation(progress.recordRunObtainedItem);
export const resetRunXP = transactionOperation(progress.resetRunXP);
export const setCompletedDestinations = transactionOperation(progress.setCompletedDestinations);
export const setCurrentAct = transactionOperation(progress.setCurrentAct);
export const setDestinationIndexInAct = transactionOperation(progress.setDestinationIndexInAct);
export const setDestinationOfferState = transactionOperation(progress.setDestinationOfferState);
export const setEncounteredRunEnemyIds = transactionOperation(progress.setEncounteredRunEnemyIds);
export const setRoomsEncountered = transactionOperation(progress.setRoomsEncountered);
export const setRunBoons = transactionOperation(progress.setRunBoons);
export const setRunDeck = transactionOperation(progress.setRunDeck);
export const setRunMaxHealth = transactionOperation(progress.setRunMaxHealth);
export const setRunPlayerHealth = transactionOperation(progress.setRunPlayerHealth);
export const applyRunStartSnapshot = transactionOperation(initialization.applyRunStartSnapshot);
export const initializeActiveRun = transactionOperation(initialization.initializeActiveRun);
export const initializeFromResumeSnapshot = transactionOperation(initialization.initializeFromResumeSnapshot);
export const resetProgress = transactionOperation(initialization.resetProgress);
export const addMaterialsToStockpile = transactionOperation(homestead.addMaterialsToStockpile);
export const awardMaterialsDuringRun = transactionOperation(homestead.awardMaterialsDuringRun);
export const bondCompanion = transactionOperation(homestead.bondCompanion);
export const completeResearch = transactionOperation(homestead.completeResearch);
export const constructBuilding = transactionOperation(homestead.constructBuilding);
export const plantFarm = transactionOperation(homestead.plantFarm);
export const setMaterials = transactionOperation(homestead.setMaterials);
export const applyTalentState = transactionOperation(profile.applyTalentState);
export const clearPermanentData = transactionOperation(profile.clearPermanentData);
export const finalizeRunXP = transactionOperation(profile.finalizeRunXP);
export const handleCollectionTabChange = transactionOperation(profile.handleCollectionTabChange);
export const resetToDefaults = transactionOperation(profile.resetToDefaults);
export const resetUnlockedTalents = transactionOperation(profile.resetUnlockedTalents);
export const setCollectionPage = transactionOperation(profile.setCollectionPage);
export const setCompletedDifficulties = transactionOperation(profile.setCompletedDifficulties);
export const setDiscoveredCardIds = transactionOperation(profile.setDiscoveredCardIds);
export const setDiscoveredTrinketIds = transactionOperation(profile.setDiscoveredTrinketIds);
export const setDiscoveredUniqueIds = transactionOperation(profile.setDiscoveredUniqueIds);
export const setEncounteredEnemyIds = transactionOperation(profile.setEncounteredEnemyIds);
export const setFinishedRunCharacters = transactionOperation(profile.setFinishedRunCharacters);
export const unlockAllTalents = transactionOperation(profile.unlockAllTalents);
export const unlockTalent = transactionOperation(profile.unlockTalent);
export const recordRunRoom = transactionOperation(recap.recordRunRoom);
export const completeRunRoom = transactionOperation(recap.completeRunRoom);
export const addRunGoldEarned = transactionOperation(recap.addRunGoldEarned);
export const captureRunRecap = transactionOperation(recap.captureRunRecap);

export const settlePendingBattleMaterials = transactionOperation(battle.settlePendingBattleMaterials);

export function createDraftInstanceIdSource(transaction: RunTransaction): () => string {
  return gameplayDraftRuntime(transactionDraft(transaction)).createInstanceId;
}

export const awardRunEndMaterials = transactionOperation(ending.awardRunEndMaterials);
export function settleRunVictory(transaction: RunTransaction): void {
  ending.settleRunEnd(undefined, transactionDraft(transaction), "victory");
}
