// Zustand global store and React hooks/adapters for run and talent progression state.
// Depends on: game data library, game constants, talents library.
// Depended on by: useRunNavigation, useAlchemyRunController, useBattleController, and various UI screens.
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
import { addTalentXP, xpThresholdForPoints, type TalentXP } from "@/lib/talents";
import type { RunStartSnapshot } from "@/features/alchemy/run/run-start";
import {
  createInitialRunState,
  createInitialTalentState,
  runFieldsFromSnapshot,
  type RunStateFields,
} from "@/features/alchemy/run/run-state-init";
import {
  selectRunController,
  selectTalentController,
  type RunStateController,
  type TalentStateController,
} from "@/features/alchemy/run/run-store-selectors";
import type { RunStore } from "./run-store-types";

export type { RunStateController, TalentStateController };

export const useRunStore = create<RunStore>()((set) => {
  const setField =
    <K extends keyof RunStateFields>(key: K) =>
    (action: RunStateFields[K] | ((prev: RunStateFields[K]) => RunStateFields[K])) =>
      set((s) => ({ [key]: typeof action === "function" ? action(s[key]) : action }));

  return {
    ...createInitialRunState(null),
    ...createInitialTalentState({}, {}),

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
        if (Object.keys(s.runTalentXP).length === 0) return s;

        const multiplier = getDifficultyXPMultiplier(s.selectedDifficulty);

        const nextTalentXP = { ...s.talentXP };
        for (const [kw, amount] of Object.entries(s.runTalentXP)) {
          if (typeof amount === "number") {
            const bonusAmount = Math.round(amount * multiplier);
            nextTalentXP[kw as KeywordId] = (nextTalentXP[kw as KeywordId] ?? 0) + bonusAmount;
          }
        }
        return {
          talentXP: nextTalentXP,
          runTalentXP: {},
        };
      }),

    initialize: (activeRun, talentXP, unlockedTalents, fallbackCharacterId = "knight") => {
      set({
        ...createInitialRunState(activeRun, fallbackCharacterId),
        ...createInitialTalentState(talentXP, unlockedTalents),
        initialized: true,
      });
    },

    hydrateFromSnapshot: (snapshot: RunStartSnapshot) => {
      set(runFieldsFromSnapshot(snapshot));
    },
  };
});

export function useRunAdapter(): RunStateController {
  return useRunStore(useShallow(selectRunController));
}

export function useTalentAdapter(): TalentStateController {
  const base = useRunStore(useShallow(selectTalentController));
  const talentEffects = useMemo(() => computeTalentEffects(base.unlockedTalents), [base.unlockedTalents]);
  return useMemo(() => ({ ...base, talentEffects }), [base, talentEffects]);
}
