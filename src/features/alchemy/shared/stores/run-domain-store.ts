// Consolidated run domain store — progress, session, navigation, and battle slices.
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  computeTalentEffects,
  getGoldMultiplier,
  getCardKeywords,
  getDifficultyXPMultiplier,
  talentPool,
  hydrateCard,
  type KeywordId,
  type UnlockedTalents,
  type CharacterId,
  addTalentXP,
  computeRunEndTalentXPSnapshot,
  mergeRunTalentXPIntoPermanent,
  xpThresholdForPoints,
  type TalentXP,
} from "@/lib/game-data";
import { type BattleState } from "@/lib/battle";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { RunStartSnapshot } from "@/features/alchemy/run-setup/run/run-start";
import {
  createInitialRunState,
  createInitialTalentState,
  runFieldsFromSnapshot,
  type RunStateFields,
} from "@/features/alchemy/run-setup/run/run-state-init";
import type { TalentEffectManifest } from "@/lib/game-data";
import type { Screen } from "@/features/alchemy/shared/types";
import type { Setter } from "@/lib/utils";
import {
  createInitialBattleFields,
  createInitialRunDomainData,
  createInitialSessionFields,
  type DisplayOverrides,
  type NavigationStore,
  type RunDomainBattleState,
  type RunDomainDataState,
  type RunProgressStore,
  type RunSessionFields,
  type RunSessionStore,
} from "./run-domain-types";

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

type RunDomainActions = {
  // Progress
  setRunDeck: Setter<RunStateFields["runDeck"]>;
  setRunGold: Setter<number>;
  setRunPlayerHealth: Setter<number>;
  setRunMaxHealth: Setter<number>;
  setRoomsEncountered: Setter<number>;
  setCurrentAct: Setter<number>;
  setDestinationIndexInAct: Setter<number>;
  setCompletedDestinations: Setter<RunStateFields["completedDestinations"]>;
  setRunTrinkets: Setter<string[]>;
  setEncounteredRunEnemyIds: Setter<string[]>;
  setSelectedDifficulty: Setter<RunStateFields["selectedDifficulty"]>;
  setContentSystemType: Setter<RunStateFields["contentSystemType"]>;
  setCharacter: (selectedId: CharacterId) => void;
  resetProgress: () => void;
  addRunGold: (amount: number) => void;
  unlockTalent: (keywordId: KeywordId, talentId: string) => void;
  unlockAllTalents: () => void;
  resetUnlockedTalents: () => void;
  resetRunXP: () => void;
  clearPermanentData: () => void;
  awardCardXP: (card: RunStateFields["runDeck"][number]) => void;
  awardMysteryXP: (keywordId: KeywordId, amount: number) => void;
  finalizeRunXP: () => void;
  initializeProgress: (
    activeRun: ActiveRunData | null,
    talentXP: TalentXP,
    unlockedTalents: UnlockedTalents,
    fallbackCharacterId?: CharacterId,
  ) => void;
  hydrateProgressFromSnapshot: (snapshot: RunStartSnapshot) => void;

  // Session
  setHasActiveRun: (active: boolean) => void;
  setActiveLabyrinthModifiers: (modifiers: RunSessionFields["activeLabyrinthModifiers"]) => void;
  setActiveLabyrinthRewardModifiers: (modifiers: RunSessionFields["activeLabyrinthRewardModifiers"]) => void;
  setActiveLabyrinthPendingNode: (node: RunSessionFields["activeLabyrinthPendingNode"]) => void;
  setRewardState: Setter<RunSessionFields["rewardState"]>;
  setCompanionRewardCards: (cards: RunSessionFields["companionRewardCards"]) => void;
  setRunEndMaterials: (materials: RunSessionFields["runEndMaterials"]) => void;
  setRunEndTalentXP: (xp: RunSessionFields["runEndTalentXP"]) => void;
  setCorruptionResult: (result: RunSessionFields["corruptionResult"]) => void;
  setPendingCharacterId: (id: RunSessionFields["pendingCharacterId"]) => void;
  setPendingContentSystemType: (type: RunSessionFields["pendingContentSystemType"]) => void;
  setLabyrinthMap: Setter<RunSessionFields["labyrinthMap"]>;
  setShopState: Setter<RunSessionFields["shopState"]>;
  setAlchemistState: Setter<RunSessionFields["alchemistState"]>;
  setMysteryEvent: (event: RunSessionFields["mysteryEvent"]) => void;
  setMysteryCardChoices: (
    choices:
      | RunSessionFields["mysteryCardChoices"]
      | ((prev: RunSessionFields["mysteryCardChoices"]) => RunSessionFields["mysteryCardChoices"]),
  ) => void;
  clearTransientSession: () => void;

  // Navigation
  setScreen: Setter<Screen>;
  resetNavigation: () => void;

  // Battle
  setSyncedBattleState: (state: BattleState | ((prev: BattleState) => BattleState)) => void;
  setDisplayOverrides: (overrides: DisplayOverrides) => void;
  clearDisplayOverrides: () => void;
  setBattleStartState: (state: BattleState | null) => void;
  setHasActiveBattle: (active: boolean | ((prev: boolean) => boolean)) => void;
  initializeActiveBattle: (battleState: BattleState | null) => void;
  resetBattle: () => void;
};

export type RunDomainStore = RunDomainDataState & RunDomainActions;

function applySetter<T>(current: T, action: T | ((prev: T) => T)): T {
  return typeof action === "function" ? (action as (prev: T) => T)(current) : action;
}

function hydrateBattleState(battleState: BattleState): BattleState {
  return {
    ...battleState,
    deck: battleState.deck.map(hydrateCard),
    hand: battleState.hand.map(hydrateCard),
    discard: battleState.discard.map(hydrateCard),
    exhausted: battleState.exhausted.map(hydrateCard),
    wishOptions: battleState.wishOptions ? battleState.wishOptions.map(hydrateCard) : null,
    wishQueue: battleState.wishQueue ? battleState.wishQueue.map((list) => list.map(hydrateCard)) : [],
  };
}

export const useRunDomainStore = create<RunDomainStore>()(
  immer((set) => {
    const setProgressField =
      <K extends keyof RunStateFields>(key: K) =>
      (action: RunStateFields[K] | ((prev: RunStateFields[K]) => RunStateFields[K])) =>
        set((state) => {
          state.progress[key] = applySetter(state.progress[key], action);
        });

    const setSessionField =
      <K extends keyof RunSessionFields>(key: K) =>
      (action: RunSessionFields[K] | ((prev: RunSessionFields[K]) => RunSessionFields[K])) =>
        set((state) => {
          state.session[key] = applySetter(state.session[key], action);
        });

    return {
      ...createInitialRunDomainData(),

      setRunDeck: setProgressField("runDeck"),
      setRunGold: setProgressField("runGold"),
      setRunPlayerHealth: setProgressField("runPlayerHealth"),
      setRunMaxHealth: setProgressField("runMaxHealth"),
      setRoomsEncountered: setProgressField("roomsEncountered"),
      setCurrentAct: setProgressField("currentAct"),
      setDestinationIndexInAct: setProgressField("destinationIndexInAct"),
      setCompletedDestinations: setProgressField("completedDestinations"),
      setRunTrinkets: setProgressField("runTrinkets"),
      setEncounteredRunEnemyIds: setProgressField("encounteredRunEnemyIds"),
      setSelectedDifficulty: setProgressField("selectedDifficulty"),
      setContentSystemType: setProgressField("contentSystemType"),

      setCharacter: (selectedId) =>
        set((state) => {
          state.progress.characterId = selectedId;
        }),

      resetProgress: () =>
        set((state) => {
          const characterId = state.progress.characterId;
          const talentXP = state.progress.talentXP;
          const unlockedTalents = state.progress.unlockedTalents;
          Object.assign(state.progress, createInitialRunState(null, characterId), {
            talentXP,
            unlockedTalents,
            runTalentXP: {},
            initialized: true,
          });
        }),

      addRunGold: (amount) =>
        set((state) => {
          const mult = getGoldMultiplier(state.progress.characterId, state.progress.selectedDifficulty);
          state.progress.runGold += Math.floor(amount * mult);
        }),

      unlockTalent: (keywordId, talentId) =>
        set((state) => {
          if (state.progress.unlockedTalents[keywordId]?.includes(talentId)) return;
          state.progress.unlockedTalents = {
            ...state.progress.unlockedTalents,
            [keywordId]: [...(state.progress.unlockedTalents[keywordId] ?? []), talentId],
          };
        }),

      unlockAllTalents: import.meta.env.DEV
        ? () =>
            set((state) => {
              const next: UnlockedTalents = {};
              const xp: TalentXP = {};
              for (const talent of talentPool) {
                next[talent.keywordId] = [...(next[talent.keywordId] ?? []), talent.id];
              }
              for (const [kw, ids] of Object.entries(next)) {
                xp[kw as KeywordId] = xpThresholdForPoints(ids.length);
              }
              state.progress.unlockedTalents = next;
              state.progress.talentXP = xp;
              state.progress.runTalentXP = xp;
            })
        : () => {},

      resetUnlockedTalents: () =>
        set((state) => {
          state.progress.unlockedTalents = {};
        }),

      resetRunXP: () =>
        set((state) => {
          state.progress.runTalentXP = {};
        }),

      clearPermanentData: () =>
        set((state) => {
          state.progress.talentXP = {};
          state.progress.runTalentXP = {};
          state.progress.unlockedTalents = {};
        }),

      awardCardXP: (card) => {
        const keywords = getCardKeywords(card);
        if (keywords.length === 0) return;
        set((state) => {
          state.progress.runTalentXP = addTalentXP(state.progress.runTalentXP, keywords);
        });
      },

      awardMysteryXP: (keywordId, amount) =>
        set((state) => {
          state.progress.runTalentXP = addTalentXP(state.progress.runTalentXP, [keywordId], amount);
        }),

      finalizeRunXP: () =>
        set((state) => {
          if (Object.keys(state.progress.runTalentXP).length === 0) {
            state.session.runEndTalentXP = {};
            return;
          }
          const multiplier = getDifficultyXPMultiplier(state.progress.selectedDifficulty);
          state.session.runEndTalentXP = computeRunEndTalentXPSnapshot(state.progress.runTalentXP, multiplier);
          state.progress.talentXP = mergeRunTalentXPIntoPermanent(
            state.progress.runTalentXP,
            state.progress.talentXP,
            multiplier,
          );
          state.progress.runTalentXP = {};
        }),

      initializeProgress: (activeRun, talentXP, unlockedTalents, fallbackCharacterId = "knight") =>
        set((state) => {
          Object.assign(
            state.progress,
            createInitialRunState(activeRun, fallbackCharacterId),
            createInitialTalentState(talentXP, unlockedTalents),
            { initialized: true },
          );
        }),

      hydrateProgressFromSnapshot: (snapshot) =>
        set((state) => {
          state.session.runEndTalentXP = {};
          Object.assign(state.progress, runFieldsFromSnapshot(snapshot), { runTalentXP: {} });
        }),

      setHasActiveRun: (active) =>
        set((state) => {
          state.session.hasActiveRun = active;
        }),

      setActiveLabyrinthModifiers: (modifiers) =>
        set((state) => {
          state.session.activeLabyrinthModifiers = modifiers;
        }),

      setActiveLabyrinthRewardModifiers: (modifiers) =>
        set((state) => {
          state.session.activeLabyrinthRewardModifiers = modifiers;
        }),

      setActiveLabyrinthPendingNode: (node) =>
        set((state) => {
          state.session.activeLabyrinthPendingNode = node;
        }),

      setRewardState: setSessionField("rewardState"),
      setCompanionRewardCards: (cards) =>
        set((state) => {
          state.session.companionRewardCards = cards;
        }),
      setRunEndMaterials: (materials) =>
        set((state) => {
          state.session.runEndMaterials = materials;
        }),
      setRunEndTalentXP: (xp) =>
        set((state) => {
          state.session.runEndTalentXP = xp;
        }),
      setCorruptionResult: (result) =>
        set((state) => {
          state.session.corruptionResult = result;
        }),
      setPendingCharacterId: (id) =>
        set((state) => {
          state.session.pendingCharacterId = id;
        }),
      setPendingContentSystemType: (type) =>
        set((state) => {
          state.session.pendingContentSystemType = type;
        }),
      setLabyrinthMap: setSessionField("labyrinthMap"),
      setShopState: setSessionField("shopState"),
      setAlchemistState: setSessionField("alchemistState"),
      setMysteryEvent: (event) =>
        set((state) => {
          state.session.mysteryEvent = event;
        }),
      setMysteryCardChoices: (choices) =>
        set((state) => {
          state.session.mysteryCardChoices =
            typeof choices === "function" ? choices(state.session.mysteryCardChoices) : choices;
        }),

      clearTransientSession: () =>
        set((state) => {
          state.session = { ...createInitialSessionFields(), pendingContentSystemType: "campaign" };
        }),

      setScreen: (action) =>
        set((state) => {
          state.navigation.screen = applySetter(state.navigation.screen, action);
        }),

      resetNavigation: () =>
        set((state) => {
          state.navigation.screen = "menu";
        }),

      setSyncedBattleState: (action) =>
        set((state) => {
          state.battle.battleState = applySetter(state.battle.battleState, action);
          state.battle.displayOverrides = {};
        }),

      setDisplayOverrides: (overrides) =>
        set((state) => {
          state.battle.displayOverrides = overrides;
        }),

      clearDisplayOverrides: () =>
        set((state) => {
          state.battle.displayOverrides = {};
        }),

      setBattleStartState: (battleStartState) =>
        set((state) => {
          state.battle.battleStartState = battleStartState;
        }),

      setHasActiveBattle: (active) =>
        set((state) => {
          state.battle.hasActiveBattle = applySetter(state.battle.hasActiveBattle, active);
        }),

      initializeActiveBattle: (battleState) =>
        set((state) => {
          if (battleState) {
            const hydratedState = hydrateBattleState(battleState);
            state.battle.battleState = hydratedState;
            state.battle.displayOverrides = {};
            state.battle.battleStartState = hydratedState;
            state.battle.hasActiveBattle = true;
          } else {
            state.battle = createInitialBattleFields();
          }
        }),

      resetBattle: () =>
        set((state) => {
          state.battle = createInitialBattleFields();
        }),
    };
  }),
);

/** Imperative access to the full domain store API. */
export function getRunDomainStore(): RunDomainStore {
  return useRunDomainStore.getState();
}

function pickProgressActions(state: RunDomainStore): Omit<RunProgressStore, keyof RunStateFields> {
  return {
    setRunDeck: state.setRunDeck,
    setRunGold: state.setRunGold,
    setRunPlayerHealth: state.setRunPlayerHealth,
    setRunMaxHealth: state.setRunMaxHealth,
    setRoomsEncountered: state.setRoomsEncountered,
    setCurrentAct: state.setCurrentAct,
    setDestinationIndexInAct: state.setDestinationIndexInAct,
    setCompletedDestinations: state.setCompletedDestinations,
    setRunTrinkets: state.setRunTrinkets,
    setEncounteredRunEnemyIds: state.setEncounteredRunEnemyIds,
    setSelectedDifficulty: state.setSelectedDifficulty,
    setContentSystemType: state.setContentSystemType,
    setCharacter: state.setCharacter,
    reset: state.resetProgress,
    addRunGold: state.addRunGold,
    unlockTalent: state.unlockTalent,
    unlockAllTalents: state.unlockAllTalents,
    resetUnlockedTalents: state.resetUnlockedTalents,
    resetRunXP: state.resetRunXP,
    clearPermanentData: state.clearPermanentData,
    awardCardXP: state.awardCardXP,
    awardMysteryXP: state.awardMysteryXP,
    finalizeRunXP: state.finalizeRunXP,
    initialize: state.initializeProgress,
    hydrateFromSnapshot: state.hydrateProgressFromSnapshot,
  };
}

function pickSessionActions(state: RunDomainStore): Omit<RunSessionStore, keyof RunSessionFields> {
  return {
    setHasActiveRun: state.setHasActiveRun,
    setActiveLabyrinthModifiers: state.setActiveLabyrinthModifiers,
    setActiveLabyrinthRewardModifiers: state.setActiveLabyrinthRewardModifiers,
    setActiveLabyrinthPendingNode: state.setActiveLabyrinthPendingNode,
    setRewardState: state.setRewardState,
    setCompanionRewardCards: state.setCompanionRewardCards,
    setRunEndMaterials: state.setRunEndMaterials,
    setRunEndTalentXP: state.setRunEndTalentXP,
    setCorruptionResult: state.setCorruptionResult,
    setPendingCharacterId: state.setPendingCharacterId,
    setPendingContentSystemType: state.setPendingContentSystemType,
    setLabyrinthMap: state.setLabyrinthMap,
    setShopState: state.setShopState,
    setAlchemistState: state.setAlchemistState,
    setMysteryEvent: state.setMysteryEvent,
    setMysteryCardChoices: state.setMysteryCardChoices,
    clearTransientSession: state.clearTransientSession,
  };
}

function pickNavigationActions(state: RunDomainStore): Omit<NavigationStore, "screen"> {
  return {
    setScreen: state.setScreen,
    reset: state.resetNavigation,
  };
}

function pickBattleActions(state: RunDomainStore) {
  return {
    setSyncedBattleState: state.setSyncedBattleState,
    setDisplayOverrides: state.setDisplayOverrides,
    clearDisplayOverrides: state.clearDisplayOverrides,
    setBattleStartState: state.setBattleStartState,
    setHasActiveBattle: state.setHasActiveBattle,
    initializeActiveBattle: state.initializeActiveBattle,
  };
}

export function getRunProgressStoreView(): RunProgressStore {
  const state = useRunDomainStore.getState();
  return { ...state.progress, ...pickProgressActions(state) };
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

export function useRunAdapter(): RunStateController {
  return useRunDomainStore(
    useShallow((state) => selectRunController({ ...state.progress, ...pickProgressActions(state) })),
  );
}

export function useTalentAdapter(): TalentStateController {
  const base = useRunDomainStore(
    useShallow((state) => selectTalentController({ ...state.progress, ...pickProgressActions(state) })),
  );
  const talentEffects = useMemo(() => computeTalentEffects(base.unlockedTalents), [base.unlockedTalents]);
  return useMemo(() => ({ ...base, talentEffects }), [base, talentEffects]);
}

export function useRunProgressSlice() {
  return useRunDomainStore(useShallow((s) => s.progress));
}

export function useRunSessionSlice() {
  return useRunDomainStore(useShallow((s) => s.session));
}

export function useRunNavigationSlice() {
  return useRunDomainStore((s) => s.navigation);
}

export function useRunBattleSlice() {
  return useRunDomainStore(useShallow((s) => s.battle));
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
