// Zustand global store and React hooks/adapters for run and talent progression state.
// Depends on: game data library, game constants, talents library.
// Depended on by: useRunNavigation, useAlchemyRunController, useBattleController, and various UI screens.
import { create } from "zustand";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  getGoldMultiplier,
  getStartingDeck,
  hydrateCard,
  type BattleCard,
  type CharacterId,
  type DifficultyId,
  talentPool,
  type UnlockedTalents,
  getCardKeywords,
  getDifficultyXPMultiplier,
  computeTalentEffects,
} from "@/lib/game-data";
import type { RunStateController } from "../use-run-state";
import type { TalentStateController } from "../use-talent-state";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import { DESTINATIONS, type Destination } from "@/features/alchemy/types";
import type { ActiveRunData } from "@/features/alchemy/run/types";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { addTalentXP, xpThresholdForPoints, type TalentXP } from "@/lib/talents";
import type { KeywordId } from "@/lib/game-data";
import type { Setter } from "@/lib/utils";

type RunStateFields = {
  characterId: CharacterId;
  runDeck: BattleCard[];
  runGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: Destination[];
  runTrinkets: string[];
  encounteredRunEnemyIds: string[];
  selectedDifficulty: DifficultyId | null;
  contentSystemType: ContentSystemId;
  talentXP: TalentXP;
  runTalentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  initialized: boolean;
};

type RunStoreActions = {
  setRunDeck: Setter<BattleCard[]>;
  setRunGold: Setter<number>;
  setRunPlayerHealth: Setter<number>;
  setRunMaxHealth: Setter<number>;
  setRoomsEncountered: Setter<number>;
  setCurrentAct: Setter<number>;
  setDestinationIndexInAct: Setter<number>;
  setCompletedDestinations: Setter<Destination[]>;
  setRunTrinkets: Setter<string[]>;
  setEncounteredRunEnemyIds: Setter<string[]>;
  setSelectedDifficulty: Setter<DifficultyId | null>;
  setContentSystemType: Setter<ContentSystemId>;
  setCharacter: (selectedId: CharacterId) => void;
  reset: () => void;
  addRunGold: (amount: number) => void;
  unlockTalent: (keywordId: KeywordId, talentId: string) => void;
  unlockAllTalents: () => void;
  resetUnlockedTalents: () => void;
  resetRunXP: () => void;
  clearPermanentData: () => void;
  awardCardXP: (card: BattleCard) => void;
  awardMysteryXP: (keywordId: KeywordId, amount: number) => void;
  finalizeRunXP: () => void;
  initialize: (
    activeRun: ActiveRunData | null,
    talentXP: TalentXP,
    unlockedTalents: UnlockedTalents,
    fallbackCharacterId?: CharacterId,
  ) => void;
};

type RunStore = RunStateFields & RunStoreActions;

const VALID_DESTINATIONS = new Set<Destination>(Object.values(DESTINATIONS));

function createInitialRunState(
  initialActiveRun: ActiveRunData | null,
  fallbackCharacterId: CharacterId = "knight",
): RunStateFields {
  const characterId = initialActiveRun?.characterId ?? fallbackCharacterId;
  return {
    characterId,
    runDeck: initialActiveRun
      ? initialActiveRun.runDeck.map(hydrateCard)
      : getStartingDeck(characterId).map((c) => ({ ...c })),
    runGold: initialActiveRun?.runGold ?? 0,
    runPlayerHealth: initialActiveRun?.runPlayerHealth ?? MAX_PLAYER_HEALTH,
    runMaxHealth: initialActiveRun?.runMaxHealth ?? MAX_PLAYER_HEALTH,
    roomsEncountered: initialActiveRun?.roomsEncountered ?? 0,
    currentAct: initialActiveRun?.currentAct ?? 1,
    destinationIndexInAct: initialActiveRun?.destinationIndexInAct ?? 0,
    completedDestinations: initialActiveRun?.completedDestinations?.length
      ? initialActiveRun.completedDestinations.filter((d): d is Destination => VALID_DESTINATIONS.has(d as Destination))
      : [],
    runTrinkets: initialActiveRun?.runTrinkets ? [...initialActiveRun.runTrinkets] : [],
    encounteredRunEnemyIds: initialActiveRun?.encounteredRunEnemyIds
      ? [...initialActiveRun.encounteredRunEnemyIds]
      : [],
    selectedDifficulty: initialActiveRun?.selectedDifficulty ?? null,
    contentSystemType: initialActiveRun?.contentSystemType ?? "campaign",
    talentXP: {},
    runTalentXP: initialActiveRun?.runTalentXP ?? {},
    unlockedTalents: {},
    initialized: false,
  };
}

function createInitialTalentState(
  initialTalentXP: TalentXP,
  initialUnlockedTalents: UnlockedTalents,
): Pick<RunStateFields, "talentXP" | "unlockedTalents"> {
  return { talentXP: initialTalentXP, unlockedTalents: initialUnlockedTalents };
}

export const useRunStore = create<RunStore>()((set) => ({
  ...createInitialRunState(null),
  ...createInitialTalentState({}, {}),

  setRunDeck: (action) => set((s) => ({ runDeck: typeof action === "function" ? action(s.runDeck) : action })),
  setRunGold: (action) => set((s) => ({ runGold: typeof action === "function" ? action(s.runGold) : action })),
  setRunPlayerHealth: (action) =>
    set((s) => ({ runPlayerHealth: typeof action === "function" ? action(s.runPlayerHealth) : action })),
  setRunMaxHealth: (action) =>
    set((s) => ({ runMaxHealth: typeof action === "function" ? action(s.runMaxHealth) : action })),
  setRoomsEncountered: (action) =>
    set((s) => ({ roomsEncountered: typeof action === "function" ? action(s.roomsEncountered) : action })),
  setCurrentAct: (action) => set((s) => ({ currentAct: typeof action === "function" ? action(s.currentAct) : action })),
  setDestinationIndexInAct: (action) =>
    set((s) => ({ destinationIndexInAct: typeof action === "function" ? action(s.destinationIndexInAct) : action })),
  setCompletedDestinations: (action) =>
    set((s) => ({ completedDestinations: typeof action === "function" ? action(s.completedDestinations) : action })),
  setRunTrinkets: (action) =>
    set((s) => ({ runTrinkets: typeof action === "function" ? action(s.runTrinkets) : action })),
  setEncounteredRunEnemyIds: (action) =>
    set((s) => ({
      encounteredRunEnemyIds: typeof action === "function" ? action(s.encounteredRunEnemyIds) : action,
    })),
  setSelectedDifficulty: (action) =>
    set((s) => ({ selectedDifficulty: typeof action === "function" ? action(s.selectedDifficulty) : action })),
  setContentSystemType: (action) =>
    set((s) => ({ contentSystemType: typeof action === "function" ? action(s.contentSystemType) : action })),

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

      const multiplier = getDifficultyXPMultiplier(s.selectedDifficulty) ?? 1;

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
    const runState = createInitialRunState(activeRun, fallbackCharacterId);
    const talentState = createInitialTalentState(talentXP, unlockedTalents);
    set({ ...runState, ...talentState, initialized: true });
  },
}));

export function useRunAdapter(): RunStateController {
  const fields = useRunStore(
    useShallow((s) => ({
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
    })),
  );

  const actions = useRunStore(
    useShallow((s) => ({
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
    })),
  );

  return useMemo(() => ({ ...fields, ...actions }), [fields, actions]);
}

export function useTalentAdapter(): TalentStateController {
  const store = useRunStore(
    useShallow((s) => ({
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
    })),
  );

  const talentEffects = useMemo(() => computeTalentEffects(store.unlockedTalents), [store.unlockedTalents]);

  return useMemo(() => ({ ...store, talentEffects }), [store, talentEffects]);
}
