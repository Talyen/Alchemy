// Facade over the run-lifetime stores — reads, ports, lifecycle transitions, and hooks.
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { BattleCard, CharacterId, DifficultyId, TalentXP, UnlockedTalents } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { Screen } from "@/lib/routing";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import {
  getBattleStoreView,
  getRunProgressStoreView,
  getRunSessionStoreView,
  useRunAdapter,
  useTalentAdapter,
  useHomesteadAdapter,
  type RunProgressStore,
  type RunSessionStore,
  type RunStateController,
  type TalentStateController,
} from "./run-store-views";
import { getRunDomainStore, useRunDomainStore } from "./run-domain-store";
import { useRunProfileStore } from "./run-profile-store";
import { useRunTransientStore } from "./run-transient-store";
import { useRunBattleDomainStore } from "./run-battle-domain-store";
import type { DisplayOverrides } from "./run-domain-types";
import type { RunRngStream } from "@/lib/run-rng";

export { getRunSession, useRunSessionBattleContext, useRunSessionNavigationSlice } from "./run-session-model";

// Run lifecycle transitions.
export {
  restoreRun,
  snapshotRun,
  teardownRun,
  syncRunToBattleStart,
  syncBattleToRun,
  clearBattleUi,
  finalizeRunEndSession,
  applyRunDefeatTeardown,
  resolveActiveRunForSave,
  flushSaveAfterRunEnd,
  syncRunMaxHealthFromGear,
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

import { useRunScreenData } from "./use-run-screen-data";
export { useRunAdapter, useTalentAdapter, useHomesteadAdapter, useRunScreenData };
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
  return useRunDomainStore(useShallow((s) => ({ screen: s.navigation.screen, setScreen: s.setScreen })));
}

/** Subscribe to navigation screen only (autosave, routing). */
export function useActiveRunScreenValue(): Screen {
  return useRunDomainStore((s) => s.navigation.screen);
}

export function useHasActiveBattle(): boolean {
  return useRunBattleDomainStore((s) => s.hasActiveBattle);
}

export function useHasActiveRun(): boolean {
  return useRunTransientStore((s) => s.hasActiveRun);
}

export function useDisplayOverrides(): DisplayOverrides {
  return useRunBattleDomainStore((s) => s.displayOverrides);
}

export function useSetHasActiveBattle(): (active: boolean) => void {
  return useRunBattleDomainStore((s) => s.setHasActiveBattle);
}

export function useBondedCompanions() {
  return useRunProfileStore((s) => s.bondedCompanions);
}

export function useContentSystemType(): ContentSystemId {
  return useRunDomainStore((s) => s.activeRun.contentSystemType);
}

export function useIsWildwoodRun(): boolean {
  return useRunDomainStore((s) => s.activeRun.contentSystemType === "wildwood");
}

export function useHomesteadProgressSlice() {
  return useRunProfileStore(
    useShallow((s) => ({
      materialInventory: s.materialInventory,
      constructedBuildings: s.constructedBuildings,
      plantedFarms: s.plantedFarms,
      completedResearch: s.completedResearch,
      bondedCompanions: s.bondedCompanions,
    })),
  );
}

export function useTalentProgressSlice(): { talentXP: TalentXP; unlockedTalents: UnlockedTalents } {
  return useRunProfileStore(
    useShallow((s) => ({
      talentXP: s.talentXP,
      unlockedTalents: s.unlockedTalents,
    })),
  );
}

export function useDifficultySelectSlice(): {
  pendingCharacterId: CharacterId | null;
  selectedDifficulty: DifficultyId | null;
} {
  const pendingCharacterId = useRunTransientStore((s) => s.pendingCharacterId);
  const selectedDifficulty = useRunDomainStore((s) => s.activeRun.selectedDifficulty);
  return useMemo(() => ({ pendingCharacterId, selectedDifficulty }), [pendingCharacterId, selectedDifficulty]);
}

export function useDraftDeckSlice(): {
  contentSystemType: ContentSystemId;
  runDeck: BattleCard[];
  wildwoodDraft: WildwoodDraftState | null;
} {
  const run = useRunDomainStore(
    useShallow((s) => ({
      contentSystemType: s.activeRun.contentSystemType,
      runDeck: s.activeRun.runDeck,
    })),
  );
  const wildwoodDraft = useRunTransientStore((s) => s.wildwoodDraft);
  return useMemo(() => ({ ...run, wildwoodDraft }), [run, wildwoodDraft]);
}

export function useActiveRunCharacterId(): CharacterId {
  return useRunDomainStore((s) => s.activeRun.characterId);
}

/** Persistence: whether an active run should be snapshotted. */
export function readHasActiveRun(): boolean {
  return useRunTransientStore.getState().hasActiveRun;
}
