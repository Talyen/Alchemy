// Composed store views and React adapters over the lifetime-matched run stores.
// Domain fields live in run-domain / profile / transient / battle stores; this module flattens them.
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { computeTalentEffects, type KeywordId, type TalentEffectManifest, type TalentXP } from "@/lib/game-data";
import type { BattleCard, UnlockedTalents } from "@/lib/game-data";
import {
  flattenRunDomainProgress,
  pickActiveRunSessionCoreFields,
  type PermanentProgressFields,
  type RunStateFields,
} from "@/features/alchemy/shared/stores/run-state-init";
import type { Screen } from "@/features/alchemy/shared/types";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { useRunDomainStore, type RunDomainStore } from "./run-domain-store";
import {
  readRunProfileFields,
  useRunProfileStore,
  type RunProfileActions,
  type RunProfileStore,
} from "./run-profile-store";
import { useRunTransientStore, type RunTransientStore } from "./run-transient-store";
import { useRunBattleDomainStore, type RunBattleDomainStore } from "./run-battle-domain-store";
import type { RunSessionFields, RunDomainBattleState } from "./run-domain-types";
import type { SessionActions } from "./slices/session-slice";
import type { BattleActions } from "./slices/battle-slice";

// -------- Picker helpers (key arrays + generic picker) --------

const runProgressActionKeys = [
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
  "nextRunRandom",
  "resetRunXP",
  "awardCardXP",
  "awardMysteryXP",
  "addRunMaterialsEarned",
  "clearRunMaterialsEarned",
  "initialize",
  "hydrateFromSnapshot",
] as const satisfies ReadonlyArray<keyof RunDomainStore>;

const profileActionKeys = [
  "unlockTalent",
  "resetUnlockedTalents",
  "clearPermanentData",
  "applyTalentState",
  "addMaterials",
  "setMaterials",
  "constructBuilding",
  "plantFarm",
  "completeResearch",
  "bondCompanion",
] as const satisfies ReadonlyArray<keyof RunProfileActions>;

const sessionActionKeys = [
  "setHasActiveRun",
  "beginRewardClaim",
  "releaseRewardClaim",
  "beginDestinationClaim",
  "cancelDestinationClaim",
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
] as const satisfies ReadonlyArray<keyof SessionActions>;

const navigationActionKeys = ["setScreen"] as const satisfies ReadonlyArray<keyof RunDomainStore>;

const battleActionKeys = [
  "setSyncedBattleState",
  "setDisplayOverrides",
  "clearDisplayOverrides",
  "setBattleStartState",
  "setHasActiveBattle",
  "initializeActiveBattle",
] as const satisfies ReadonlyArray<keyof BattleActions>;

function mapActions<State extends object, K extends keyof State>(state: State, keys: readonly K[]): Pick<State, K> {
  const result = {} as Pick<State, K>;
  for (const key of keys) {
    result[key] = state[key];
  }
  return result;
}

function pickProgressActions(state: RunDomainStore, profile: RunProfileStore) {
  return {
    ...mapActions(state, runProgressActionKeys),
    ...mapActions(profile, profileActionKeys),
    reset: state.resetProgress,
  };
}

function pickSessionActions(state: RunTransientStore) {
  return mapActions(state, sessionActionKeys);
}

function pickNavigationActions(state: RunDomainStore) {
  return { ...mapActions(state, navigationActionKeys), reset: state.resetNavigation };
}

function pickBattleActions(state: RunBattleDomainStore) {
  return mapActions(state, battleActionKeys);
}

// -------- View types derived from picker return types --------

export type RunProgressStore = RunStateFields & ReturnType<typeof pickProgressActions>;
export type RunSessionStore = RunSessionFields & ReturnType<typeof pickSessionActions>;
export type NavigationStore = { screen: Screen } & ReturnType<typeof pickNavigationActions>;

function flattenProgressFields(state: RunDomainStore, profile: PermanentProgressFields): RunStateFields {
  return flattenRunDomainProgress(state.activeRun, readRunProfileFields(profile), state.initialized);
}

export function getRunProgressStoreView(): RunProgressStore {
  const state = useRunDomainStore.getState();
  const profile = useRunProfileStore.getState();
  return { ...flattenProgressFields(state, profile), ...pickProgressActions(state, profile) };
}

export function getRunSessionStoreView(): RunSessionStore {
  const state = useRunTransientStore.getState();
  return { ...state, ...pickSessionActions(state) };
}

export function getNavigationStoreView(): NavigationStore {
  const state = useRunDomainStore.getState();
  return { ...state.navigation, ...pickNavigationActions(state) };
}

export type BattleStoreView = RunDomainBattleState & ReturnType<typeof pickBattleActions>;

export function getBattleStoreView(): BattleStoreView {
  const state = useRunBattleDomainStore.getState();
  return {
    battleState: state.battleState,
    displayOverrides: state.displayOverrides,
    battleStartState: state.battleStartState,
    hasActiveBattle: state.hasActiveBattle,
    ...pickBattleActions(state),
  };
}

// -------- Controller projections --------

/** Run controller projection — active-run fields and setters only (no permanent progression). */
export function selectRunController(s: RunDomainStore) {
  return {
    ...pickActiveRunSessionCoreFields(s.activeRun),
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
    reset: s.resetProgress,
    addRunGold: s.addRunGold,
  };
}

export type RunStateController = ReturnType<typeof selectRunController>;

/** Talent controller surface — run XP lives on the domain store, permanent XP on the profile store. */
export interface TalentControllerFields {
  talentXP: TalentXP;
  runTalentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  awardCardXP: (card: BattleCard) => void;
  awardMysteryXP: (keywordId: KeywordId, amount: number) => void;
  resetRunXP: () => void;
  unlockTalent: (keywordId: KeywordId, talentId: string) => void;
  resetUnlockedTalents: () => void;
}

export function selectTalentController(s: RunProgressStore): TalentControllerFields {
  return {
    talentXP: s.talentXP,
    runTalentXP: s.runTalentXP,
    unlockedTalents: s.unlockedTalents,
    awardCardXP: s.awardCardXP,
    awardMysteryXP: s.awardMysteryXP,
    resetRunXP: s.resetRunXP,
    unlockTalent: s.unlockTalent,
    resetUnlockedTalents: s.resetUnlockedTalents,
  };
}

export type TalentStateController = TalentControllerFields & {
  talentEffects: TalentEffectManifest;
};

// -------- Adapter hooks --------

export function useRunAdapter(): RunStateController {
  return useRunDomainStore(useShallow(selectRunController));
}

export function useTalentAdapter(): TalentStateController {
  const runSlice = useRunDomainStore(
    useShallow((state) => ({
      runTalentXP: state.activeRun.runTalentXP,
      awardCardXP: state.awardCardXP,
      awardMysteryXP: state.awardMysteryXP,
      resetRunXP: state.resetRunXP,
    })),
  );
  const profileSlice = useRunProfileStore(
    useShallow((profile) => ({
      talentXP: profile.talentXP,
      unlockedTalents: profile.unlockedTalents,
      unlockTalent: profile.unlockTalent,
      resetUnlockedTalents: profile.resetUnlockedTalents,
    })),
  );
  const talentEffects = useMemo(
    () => computeTalentEffects(profileSlice.unlockedTalents),
    [profileSlice.unlockedTalents],
  );
  return useMemo(() => ({ ...runSlice, ...profileSlice, talentEffects }), [runSlice, profileSlice, talentEffects]);
}

export function useHomesteadAdapter(): HomesteadEffectManifest {
  return useRunProfileStore((profile) => profile.effects);
}
