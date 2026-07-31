// Facade over the run-lifetime stores — reads, ports, lifecycle transitions, and hooks.
import { useShallow } from "zustand/react/shallow";
import type { BattleCard, CharacterId, DifficultyId, TalentXP, UnlockedTalents } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { Screen } from "@/lib/routing";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import {
  getBattleStoreView,
  getRunProgressStoreView,
  getRunSessionStoreView,
  type RunProgressStore,
  type RunSessionStore,
  type RunStateController,
  type TalentStateController,
} from "./run-store-views";
import { getRunDomainStore } from "./run-domain-store";
import { useRunTransientStore } from "./run-transient-store";
import type { DisplayOverrides } from "./run-domain-types";
import type { RunRngStream } from "@/lib/run-rng";
import { useRunSessionCommitStore } from "./run-session-transaction";

export {
  getCommittedRunSession,
  getRunSession,
  useRunSessionBattleContext,
  useRunSessionNavigationSlice,
} from "./run-session-model";
export { dispatchRunSessionCommand, type RunSessionCommand } from "./run-session-command";
export {
  dispatchGearMutationWithRunHealthSync,
  snapshotGearHealth,
  type GearHealthSnapshot,
} from "./gear-session-command";

// Run lifecycle transitions.
export {
  restoreRun,
  snapshotRun,
  teardownRun,
  syncRunToBattleStart,
  syncBattleToRun,
  clearBattleUi,
  clearBattlePresentationUi,
  finalizeRunEndSession,
  applyRunDefeatTeardown,
  resolveActiveRunForSave,
  flushSaveAfterRunEnd,
  syncRunMaxHealthFromGearMutation,
} from "./run-transitions";

// Session write ports — grouped by the surface that owns each field.
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
  setHasActiveRun,
  setPendingCharacterId,
  setPendingContentSystemType,
  setWildwoodDraft,
  applyRunStartSnapshot,
} from "./ports/run-session-setup-port";

export {
  useAlchemistScreenData,
  useCampfireScreenData,
  useCorruptionScreenData,
  useDestinationScreenData,
  useEquipmentShopScreenData,
  useGameOverScreenData,
  useLabyrinthMapScreenData,
  useMysteryScreenData,
  useRewardsScreenData,
  useRunVictoryScreenData,
  useScreenAssetPreloadData,
  useShopScreenData,
  useTrinketShopScreenData,
  useWildwoodRecoveryScreenData,
  useWildwoodRemovalScreenData,
} from "./use-run-screen-data";
export { useRunAdapter, useTalentAdapter, useHomesteadAdapter } from "./run-store-views";
export type { RunStateController, TalentStateController, RunProgressStore, RunSessionStore, DisplayOverrides };

/** Imperative read of run progression fields (deck, gold, talents, initialized). */
export function readActiveRunStore(): RunProgressStore {
  return getRunProgressStoreView();
}

/** Imperative read of transient session fields (shops, labyrinth, mystery). */
export function readRunSessionStore(): RunSessionStore {
  return getRunSessionStoreView();
}

/** Imperative read of battle domain state. */
export function readBattleStore() {
  return getBattleStoreView();
}

export function createRunRandomSource(stream: RunRngStream): () => number {
  return () => getRunDomainStore().nextRunRandom(stream);
}

/** Current screen and setter (owned by run domain navigation slice). */
export function useActiveRunScreen() {
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      screen: snapshot.domain.navigation.screen,
      setScreen: snapshot.domain.setScreen,
    })),
  );
}

/** Subscribe to navigation screen only (autosave, routing). */
export function useActiveRunScreenValue(): Screen {
  return useRunSessionCommitStore((state) => state.snapshot.domain.navigation.screen);
}

export function useHasActiveBattle(): boolean {
  return useRunSessionCommitStore((state) => state.snapshot.battle.hasActiveBattle);
}

export function useHasActiveRun(): boolean {
  return useRunSessionCommitStore((state) => state.snapshot.transient.hasActiveRun);
}

export function useDisplayOverrides(): DisplayOverrides {
  return useRunSessionCommitStore((state) => state.snapshot.battle.displayOverrides);
}

export function useSetHasActiveBattle(): (active: boolean) => void {
  return useRunSessionCommitStore((state) => state.snapshot.battle.setHasActiveBattle);
}

export function useBondedCompanions() {
  return useRunSessionCommitStore((state) => state.snapshot.runProfile.bondedCompanions);
}

export function useContentSystemType(): ContentSystemId {
  return useRunSessionCommitStore((state) => state.snapshot.domain.activeRun.contentSystemType);
}

export function useIsWildwoodRun(): boolean {
  return useRunSessionCommitStore((state) => state.snapshot.domain.activeRun.contentSystemType === "wildwood");
}

export function useHomesteadProgressSlice() {
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      materialInventory: snapshot.runProfile.materialInventory,
      constructedBuildings: snapshot.runProfile.constructedBuildings,
      plantedFarms: snapshot.runProfile.plantedFarms,
      completedResearch: snapshot.runProfile.completedResearch,
      bondedCompanions: snapshot.runProfile.bondedCompanions,
    })),
  );
}

export function useTalentProgressSlice(): { talentXP: TalentXP; unlockedTalents: UnlockedTalents } {
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      talentXP: snapshot.runProfile.talentXP,
      unlockedTalents: snapshot.runProfile.unlockedTalents,
    })),
  );
}

export function useDifficultySelectSlice(): {
  pendingCharacterId: CharacterId | null;
  selectedDifficulty: DifficultyId | null;
} {
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      pendingCharacterId: snapshot.transient.pendingCharacterId,
      selectedDifficulty: snapshot.domain.activeRun.selectedDifficulty,
    })),
  );
}

export function useDraftDeckSlice(): {
  contentSystemType: ContentSystemId;
  runDeck: BattleCard[];
  wildwoodDraft: WildwoodDraftState | null;
} {
  return useRunSessionCommitStore(
    useShallow(({ snapshot }) => ({
      contentSystemType: snapshot.domain.activeRun.contentSystemType,
      runDeck: snapshot.domain.activeRun.runDeck,
      wildwoodDraft: snapshot.transient.wildwoodDraft,
    })),
  );
}

export function useActiveRunCharacterId(): CharacterId {
  return useRunSessionCommitStore((state) => state.snapshot.domain.activeRun.characterId);
}

/** Persistence: whether an active run should be snapshotted. */
export function readHasActiveRun(): boolean {
  return useRunTransientStore.getState().hasActiveRun;
}
