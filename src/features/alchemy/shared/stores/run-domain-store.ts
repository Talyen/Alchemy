import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { computeTalentEffects, type TalentEffectManifest } from "@/lib/game-data";
import { flattenProgressState, type RunStateFields } from "@/features/alchemy/run-setup/run/run-state-init";
import type { Screen } from "@/features/alchemy/shared/types";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import {
  createInitialRunDomainData,
  type RunDomainDataState,
  type RunDomainBattleState,
  type RunSessionFields,
} from "./run-domain-types";
import { type ProgressActions, defineProgressActions } from "./slices/progress-slice";
import { type SessionActions, defineSessionActions } from "./slices/session-slice";
import { type NavigationActions, defineNavigationActions } from "./slices/navigation-slice";
import { type BattleActions, defineBattleActions } from "./slices/battle-slice";

export type RunDomainStore = RunDomainDataState & ProgressActions & SessionActions & NavigationActions & BattleActions;

export const useRunDomainStore = create<RunDomainStore>()(
  immer((set) => ({
    ...createInitialRunDomainData(),
    ...defineProgressActions(set),
    ...defineSessionActions(set),
    ...defineNavigationActions(set),
    ...defineBattleActions(set),
  })),
);

/** Imperative access to the full domain store API. */
export function getRunDomainStore(): RunDomainStore {
  return useRunDomainStore.getState();
}

// -------- Picker helpers (key arrays + generic picker) --------

const progressActionKeys = [
  "setRunDeck",
  "setRunGold",
  "setRunPlayerHealth",
  "setRunMaxHealth",
  "setRoomsEncountered",
  "setCurrentAct",
  "setDestinationIndexInAct",
  "setCompletedDestinations",
  "setLastOfferedDestinations",
  "setDestinationRoundsSinceOffered",
  "setDestinationOfferState",
  "setRunTrinkets",
  "setEncounteredRunEnemyIds",
  "setSelectedDifficulty",
  "setContentSystemType",
  "setCharacter",
  "addRunGold",
  "unlockTalent",
  "unlockAllTalents",
  "resetUnlockedTalents",
  "resetRunXP",
  "clearPermanentData",
  "awardCardXP",
  "awardMysteryXP",
  "addRunMaterialsEarned",
  "clearRunMaterialsEarned",
  "finalizeRunXP",
  "initialize",
  "hydrateFromSnapshot",
  "addMaterials",
  "setMaterials",
  "constructBuilding",
  "plantFarm",
  "completeResearch",
  "bondCompanion",
] as const satisfies ReadonlyArray<keyof RunDomainStore>;

const sessionActionKeys = [
  "setHasActiveRun",
  "setActiveLabyrinthModifiers",
  "setActiveLabyrinthRewardModifiers",
  "setActiveLabyrinthPendingNode",
  "setRewardState",
  "setCompanionRewardCards",
  "setRunEndMaterials",
  "setRunEndTalentXP",
  "setCorruptionResult",
  "setPendingCharacterId",
  "setPendingContentSystemType",
  "setLabyrinthMap",
  "setWildwoodDraft",
  "setShopState",
  "setAlchemistState",
  "setTrinketShopState",
  "setEquipmentShopState",
  "setMysteryEvent",
  "setMysteryCardChoices",
  "clearTransientSession",
  "applyDestinationChoices",
] as const satisfies ReadonlyArray<keyof RunDomainStore>;

const navigationActionKeys = ["setScreen"] as const satisfies ReadonlyArray<keyof RunDomainStore>;

const battleActionKeys = [
  "setSyncedBattleState",
  "setDisplayOverrides",
  "clearDisplayOverrides",
  "setBattleStartState",
  "setHasActiveBattle",
  "initializeActiveBattle",
] as const satisfies ReadonlyArray<keyof RunDomainStore>;

function mapActions<K extends keyof RunDomainStore>(
  state: RunDomainStore,
  keys: readonly K[],
): Pick<RunDomainStore, K> {
  const result = {} as Pick<RunDomainStore, K>;
  for (const key of keys) {
    result[key] = state[key];
  }
  return result;
}

function pickProgressActions(state: RunDomainStore) {
  return { ...mapActions(state, progressActionKeys), reset: state.resetProgress };
}

function pickSessionActions(state: RunDomainStore) {
  return mapActions(state, sessionActionKeys);
}

function pickNavigationActions(state: RunDomainStore) {
  return { ...mapActions(state, navigationActionKeys), reset: state.resetNavigation };
}

function pickBattleActions(state: RunDomainStore) {
  return mapActions(state, battleActionKeys);
}

// -------- View types derived from picker return types --------

export type RunProgressStore = RunStateFields & ReturnType<typeof pickProgressActions>;
export type RunSessionStore = RunSessionFields & ReturnType<typeof pickSessionActions>;
export type NavigationStore = { screen: Screen } & ReturnType<typeof pickNavigationActions>;

export function getRunProgressStoreView(): RunProgressStore {
  const state = useRunDomainStore.getState();
  return { ...flattenProgressState(state.progress), ...pickProgressActions(state) };
}

export function getRunSessionStoreView(): RunSessionStore {
  const state = useRunDomainStore.getState();
  return { ...state.session, ...pickSessionActions(state) };
}

export function getNavigationStoreView(): NavigationStore {
  const state = useRunDomainStore.getState();
  return { ...state.navigation, ...pickNavigationActions(state) };
}

export type BattleStoreView = RunDomainBattleState & ReturnType<typeof pickBattleActions>;

export function getBattleStoreView(): BattleStoreView {
  const state = useRunDomainStore.getState();
  return { ...state.battle, ...pickBattleActions(state) };
}

// -------- Controller projections --------

export function selectRunController(s: RunProgressStore) {
  return {
    characterId: s.characterId,
    runDeck: s.runDeck,
    runGold: s.runGold,
    runPlayerHealth: s.runPlayerHealth,
    runMaxHealth: s.runMaxHealth,
    roomsEncountered: s.roomsEncountered,
    currentAct: s.currentAct,
    destinationIndexInAct: s.destinationIndexInAct,
    completedDestinations: s.completedDestinations,
    lastOfferedDestinations: s.lastOfferedDestinations,
    destinationRoundsSinceOffered: s.destinationRoundsSinceOffered,
    runTrinkets: s.runTrinkets,
    encounteredRunEnemyIds: s.encounteredRunEnemyIds,
    selectedDifficulty: s.selectedDifficulty,
    contentSystemType: s.contentSystemType,
    setRunDeck: s.setRunDeck,
    setRunGold: s.setRunGold,
    setRunPlayerHealth: s.setRunPlayerHealth,
    setRunMaxHealth: s.setRunMaxHealth,
    setRoomsEncountered: s.setRoomsEncountered,
    setCurrentAct: s.setCurrentAct,
    setDestinationIndexInAct: s.setDestinationIndexInAct,
    setCompletedDestinations: s.setCompletedDestinations,
    setLastOfferedDestinations: s.setLastOfferedDestinations,
    setDestinationRoundsSinceOffered: s.setDestinationRoundsSinceOffered,
    setDestinationOfferState: s.setDestinationOfferState,
    setRunTrinkets: s.setRunTrinkets,
    setEncounteredRunEnemyIds: s.setEncounteredRunEnemyIds,
    setSelectedDifficulty: s.setSelectedDifficulty,
    setContentSystemType: s.setContentSystemType,
    setCharacter: s.setCharacter,
    reset: s.reset,
    addRunGold: s.addRunGold,
    hydrateFromSnapshot: s.hydrateFromSnapshot,
  };
}

export type RunStateController = ReturnType<typeof selectRunController>;

export function selectTalentController(s: RunProgressStore) {
  return {
    talentXP: s.talentXP,
    runTalentXP: s.runTalentXP,
    unlockedTalents: s.unlockedTalents,
    awardCardXP: s.awardCardXP,
    unlockTalent: s.unlockTalent,
    unlockAllTalents: s.unlockAllTalents,
    resetUnlockedTalents: s.resetUnlockedTalents,
    resetRunXP: s.resetRunXP,
    clearPermanentData: s.clearPermanentData,
    awardMysteryXP: s.awardMysteryXP,
    finalizeRunXP: s.finalizeRunXP,
  };
}

export type TalentStateController = ReturnType<typeof selectTalentController> & {
  talentEffects: TalentEffectManifest;
};

// -------- Adapter hooks --------

export function useRunAdapter(): RunStateController {
  return useRunDomainStore(
    useShallow((state) =>
      selectRunController({ ...flattenProgressState(state.progress), ...pickProgressActions(state) }),
    ),
  );
}

export function useTalentAdapter(): TalentStateController {
  const base = useRunDomainStore(
    useShallow((state) =>
      selectTalentController({ ...flattenProgressState(state.progress), ...pickProgressActions(state) }),
    ),
  );
  const talentEffects = useMemo(() => computeTalentEffects(base.unlockedTalents), [base.unlockedTalents]);
  return useMemo(() => ({ ...base, talentEffects }), [base, talentEffects]);
}

export function useHomesteadAdapter(): HomesteadEffectManifest {
  return useRunDomainStore((state) => state.progress.permanent.effects);
}

/** Reset all run domain slices to initial values (tests and full teardown). */
export function resetRunDomainStore(): void {
  const initial = createInitialRunDomainData();
  useRunDomainStore.setState((state) => {
    state.progress = initial.progress;
    state.session = initial.session;
    state.navigation = initial.navigation;
    state.battle = initial.battle;
  });
}
