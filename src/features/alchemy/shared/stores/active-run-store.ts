// Unified Zustand store: run progression, transient session UI, and current screen.
import { useMemo } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  computeTalentEffects,
  getGoldMultiplier,
  getCardKeywords,
  getDifficultyXPMultiplier,
  talentPool,
  type KeywordId,
  type UnlockedTalents,
} from "@/lib/game-data";
import {
  addTalentXP,
  computeRunEndTalentXPSnapshot,
  mergeRunTalentXPIntoPermanent,
  xpThresholdForPoints,
  type TalentXP,
} from "@/lib/talents";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { createEmptyRewardState } from "@/features/alchemy/navigation/reward-flow";
import { SHOP_REFRESHES, ALCHEMIST_REFRESHES } from "@/lib/game-constants";
import type { RunStartSnapshot } from "@/features/alchemy/run/run-start";
import {
  createInitialRunState,
  createInitialTalentState,
  runFieldsFromSnapshot,
} from "@/features/alchemy/run/run-state-init";
import {
  selectRunController,
  selectTalentController,
  type RunStateController,
  type TalentStateController,
} from "./run-store-selectors";
import type { ActiveRunStore, RunSessionFields } from "./active-run-store-types";
import type { RunStateFields } from "@/features/alchemy/run/run-state-init";

export type { ActiveRunStore, RunSessionFields, RunStore } from "./active-run-store-types";

type ActiveRunFieldKey = keyof RunStateFields | keyof RunSessionFields | "screen";
import type { Screen } from "@/features/alchemy/types";
import type { ShopState, AlchemistState } from "@/features/alchemy/shop/shop-state-init";

export type { RunStateController, TalentStateController };

const emptyShop: ShopState = {
  cards: [],
  refreshesLeft: SHOP_REFRESHES,
  removeUsed: false,
  firstPurchaseUsed: false,
};
const emptyAlchemist: AlchemistState = {
  potions: [],
  refreshesLeft: ALCHEMIST_REFRESHES,
  mixUsed: false,
  firstPurchaseUsed: false,
};

function createInitialSessionState(): RunSessionFields {
  return {
    hasActiveRun: false,
    activeLabyrinthModifiers: [],
    activeLabyrinthRewardModifiers: [],
    activeLabyrinthPendingNode: null,
    rewardState: createEmptyRewardState(),
    companionRewardCards: null,
    runEndMaterials: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
    runEndTalentXP: {},
    corruptionResult: null,
    pendingCharacterId: null,
    pendingContentSystemType: "campaign",
    labyrinthMap: generateLabyrinthMap(),
    shopState: emptyShop,
    alchemistState: emptyAlchemist,
    mysteryEvent: null,
    mysteryCardChoices: null,
  };
}

export const useActiveRunStore = create<ActiveRunStore>()((set) => {
  const setField =
    <K extends ActiveRunFieldKey>(key: K) =>
    (action: ActiveRunStore[K] | ((prev: ActiveRunStore[K]) => ActiveRunStore[K])) =>
      set((s) => ({
        [key]:
          typeof action === "function" ? (action as (prev: ActiveRunStore[K]) => ActiveRunStore[K])(s[key]) : action,
      }));

  return {
    ...createInitialRunState(null),
    ...createInitialTalentState({}, {}),
    ...createInitialSessionState(),
    screen: "menu" as Screen,

    setScreen: setField("screen"),

    setRunDeck: setField("runDeck"),
    setRunGold: setField("runGold"),
    setRunPlayerHealth: setField("runPlayerHealth"),
    setRunMaxHealth: setField("runMaxHealth"),
    setRoomsEncountered: setField("roomsEncountered"),
    setCurrentAct: setField("currentAct"),
    setDestinationIndexInAct: setField("destinationIndexInAct"),
    setCompletedDestinations: setField("completedDestinations"),
    setRunTrinkets: setField("runTrinkets"),
    setEncounteredRunEnemyIds: setField("encounteredRunEnemyIds"),
    setSelectedDifficulty: setField("selectedDifficulty"),
    setContentSystemType: setField("contentSystemType"),

    setHasActiveRun: (active) => set({ hasActiveRun: active }),
    setActiveLabyrinthModifiers: (modifiers) => set({ activeLabyrinthModifiers: modifiers }),
    setActiveLabyrinthRewardModifiers: (modifiers) => set({ activeLabyrinthRewardModifiers: modifiers }),
    setActiveLabyrinthPendingNode: (node) => set({ activeLabyrinthPendingNode: node }),
    setRewardState: setField("rewardState"),
    setCompanionRewardCards: (cards) => set({ companionRewardCards: cards }),
    setRunEndMaterials: (materials) => set({ runEndMaterials: materials }),
    setRunEndTalentXP: (xp) => set({ runEndTalentXP: xp }),
    setCorruptionResult: (result) => set({ corruptionResult: result }),
    setPendingCharacterId: (id) => set({ pendingCharacterId: id }),
    setPendingContentSystemType: (type) => set({ pendingContentSystemType: type }),
    setLabyrinthMap: setField("labyrinthMap"),
    setShopState: setField("shopState"),
    setAlchemistState: setField("alchemistState"),
    setMysteryEvent: (event) => set({ mysteryEvent: event }),
    setMysteryCardChoices: (choices) =>
      set((s) => ({
        mysteryCardChoices: typeof choices === "function" ? choices(s.mysteryCardChoices) : choices,
      })),

    clearTransientSession: () =>
      set({
        ...createInitialSessionState(),
        pendingContentSystemType: "campaign",
      }),

    setCharacter: (selectedId) => set({ characterId: selectedId }),

    reset: () =>
      set((s) => ({
        ...createInitialRunState(null, s.characterId),
        talentXP: s.talentXP,
        unlockedTalents: s.unlockedTalents,
        runTalentXP: {},
        initialized: true,
      })),

    addRunGold: (amount) =>
      set((s) => {
        const mult = getGoldMultiplier(s.characterId, s.selectedDifficulty);
        return { runGold: s.runGold + Math.floor(amount * mult) };
      }),

    unlockTalent: (keywordId, talentId) =>
      set((s) => {
        if (s.unlockedTalents[keywordId]?.includes(talentId)) return s;
        return {
          unlockedTalents: { ...s.unlockedTalents, [keywordId]: [...(s.unlockedTalents[keywordId] ?? []), talentId] },
        };
      }),

    unlockAllTalents: import.meta.env.DEV
      ? () => {
          const next: UnlockedTalents = {};
          const xp: TalentXP = {};
          for (const talent of talentPool) {
            next[talent.keywordId] = [...(next[talent.keywordId] ?? []), talent.id];
          }
          for (const [kw, ids] of Object.entries(next)) {
            xp[kw as KeywordId] = xpThresholdForPoints(ids.length);
          }
          set({ unlockedTalents: next, talentXP: xp, runTalentXP: xp });
        }
      : () => {},

    resetUnlockedTalents: () => set({ unlockedTalents: {} }),
    resetRunXP: () => set({ runTalentXP: {} }),

    clearPermanentData: () =>
      set({
        talentXP: {},
        runTalentXP: {},
        unlockedTalents: {},
      }),

    awardCardXP: (card) => {
      const keywords = getCardKeywords(card);
      if (keywords.length === 0) return;
      set((s) => ({
        runTalentXP: addTalentXP(s.runTalentXP, keywords),
      }));
    },

    awardMysteryXP: (keywordId, amount) =>
      set((s) => ({
        runTalentXP: addTalentXP(s.runTalentXP, [keywordId], amount),
      })),

    finalizeRunXP: () =>
      set((s) => {
        if (Object.keys(s.runTalentXP).length === 0) {
          return { runEndTalentXP: {} };
        }

        const multiplier = getDifficultyXPMultiplier(s.selectedDifficulty);
        const runEndTalentXP = computeRunEndTalentXPSnapshot(s.runTalentXP, multiplier);

        return {
          talentXP: mergeRunTalentXPIntoPermanent(s.runTalentXP, s.talentXP, multiplier),
          runTalentXP: {},
          runEndTalentXP,
        };
      }),

    initialize: (activeRun, talentXP, unlockedTalents, fallbackCharacterId = "knight") => {
      set({
        ...createInitialRunState(activeRun, fallbackCharacterId),
        ...createInitialTalentState(talentXP, unlockedTalents),
        initialized: true,
        ...(activeRun?.currentScreen ? { screen: activeRun.currentScreen as Screen } : {}),
      });
    },

    hydrateFromSnapshot: (snapshot: RunStartSnapshot) => {
      set({ ...runFieldsFromSnapshot(snapshot), runTalentXP: {}, runEndTalentXP: {} });
    },
  };
});

/** @deprecated Alias for {@link useActiveRunStore}. */
export const useRunStore = useActiveRunStore;

/** @deprecated Alias for {@link useActiveRunStore}. */
export const useRunSessionStore = useActiveRunStore;

export function useRunAdapter(): RunStateController {
  return useActiveRunStore(useShallow(selectRunController));
}

export function useTalentAdapter(): TalentStateController {
  const base = useActiveRunStore(useShallow(selectTalentController));
  const talentEffects = useMemo(() => computeTalentEffects(base.unlockedTalents), [base.unlockedTalents]);
  return useMemo(() => ({ ...base, talentEffects }), [base, talentEffects]);
}

export function readActiveRunStore(): ActiveRunStore {
  return useActiveRunStore.getState();
}
