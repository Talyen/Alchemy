import type { BattleCard } from "@/lib/game-data";
import {
  getGoldMultiplier,
  getCardKeywords,
  getDifficultyXPMultiplier,
  talentPool,
  addTalentXP,
  computeRunEndTalentXPSnapshot,
  mergeRunTalentXPIntoPermanent,
  tryUnlockTalent,
  filterKeywordsForTalentXP,
  xpThresholdForPoints,
  type KeywordId,
  type CharacterId,
  type UnlockedTalents,
  type TalentXP,
} from "@/lib/game-data";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { RunStartSnapshot } from "@/features/alchemy/run-setup/run/run-start";
import {
  createInitialRunState,
  createInitialTalentState,
  runFieldsFromSnapshot,
  type RunStateFields,
} from "@/features/alchemy/run-setup/run/run-state-init";
import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { defineFieldSetter, type ImmerSet } from "./_field-setter";
import type { RunDomainDataState } from "../run-domain-types";

export interface ProgressActions {
  setRunDeck: (action: BattleCard[] | ((prev: BattleCard[]) => BattleCard[])) => void;
  setRunGold: (action: number | ((prev: number) => number)) => void;
  setRunPlayerHealth: (action: number | ((prev: number) => number)) => void;
  setRunMaxHealth: (action: number | ((prev: number) => number)) => void;
  setRoomsEncountered: (action: number | ((prev: number) => number)) => void;
  setCurrentAct: (action: number | ((prev: number) => number)) => void;
  setDestinationIndexInAct: (action: number | ((prev: number) => number)) => void;
  setCompletedDestinations: (
    action:
      | RunStateFields["completedDestinations"]
      | ((prev: RunStateFields["completedDestinations"]) => RunStateFields["completedDestinations"]),
  ) => void;
  setLastOfferedDestinations: (
    action:
      | RunStateFields["lastOfferedDestinations"]
      | ((prev: RunStateFields["lastOfferedDestinations"]) => RunStateFields["lastOfferedDestinations"]),
  ) => void;
  setDestinationRoundsSinceOffered: (
    action:
      | RunStateFields["destinationRoundsSinceOffered"]
      | ((prev: RunStateFields["destinationRoundsSinceOffered"]) => RunStateFields["destinationRoundsSinceOffered"]),
  ) => void;
  setDestinationOfferState: (state: {
    lastOfferedDestinations: RunStateFields["lastOfferedDestinations"];
    roundsSinceOffered: RunStateFields["destinationRoundsSinceOffered"];
  }) => void;
  setRunTrinkets: (action: string[] | ((prev: string[]) => string[])) => void;
  setEncounteredRunEnemyIds: (action: string[] | ((prev: string[]) => string[])) => void;
  setSelectedDifficulty: (
    action:
      | RunStateFields["selectedDifficulty"]
      | ((prev: RunStateFields["selectedDifficulty"]) => RunStateFields["selectedDifficulty"]),
  ) => void;
  setContentSystemType: (
    action:
      | RunStateFields["contentSystemType"]
      | ((prev: RunStateFields["contentSystemType"]) => RunStateFields["contentSystemType"]),
  ) => void;
  setCharacter: (selectedId: CharacterId) => void;
  resetProgress: () => void;
  addRunGold: (amount: number) => void;
  unlockTalent: (keywordId: KeywordId, talentId: string) => void;
  unlockAllTalents: () => void;
  resetUnlockedTalents: () => void;
  resetRunXP: () => void;
  clearPermanentData: () => void;
  awardCardXP: (card: BattleCard) => void;
  awardMysteryXP: (keywordId: KeywordId, amount: number) => void;
  addRunMaterialsEarned: (materials: MaterialInventory) => void;
  clearRunMaterialsEarned: () => void;
  finalizeRunXP: () => void;
  initialize: (
    activeRun: ActiveRunData | null,
    talentXP: TalentXP,
    unlockedTalents: UnlockedTalents,
    fallbackCharacterId?: CharacterId,
  ) => void;
  hydrateFromSnapshot: (snapshot: RunStartSnapshot) => void;
}

export function defineProgressActions(set: ImmerSet<RunDomainDataState>): ProgressActions {
  const setField = defineFieldSetter<RunStateFields, RunDomainDataState>(set, "progress");

  return {
    setRunDeck: setField("runDeck"),
    setRunGold: setField("runGold"),
    setRunPlayerHealth: setField("runPlayerHealth"),
    setRunMaxHealth: setField("runMaxHealth"),
    setRoomsEncountered: setField("roomsEncountered"),
    setCurrentAct: setField("currentAct"),
    setDestinationIndexInAct: setField("destinationIndexInAct"),
    setCompletedDestinations: setField("completedDestinations"),
    setLastOfferedDestinations: setField("lastOfferedDestinations"),
    setDestinationRoundsSinceOffered: setField("destinationRoundsSinceOffered"),
    setDestinationOfferState: (offerState) =>
      set((state) => {
        state.progress.lastOfferedDestinations = [...offerState.lastOfferedDestinations];
        state.progress.destinationRoundsSinceOffered = { ...offerState.roundsSinceOffered };
      }),
    setRunTrinkets: setField("runTrinkets"),
    setEncounteredRunEnemyIds: setField("encounteredRunEnemyIds"),
    setSelectedDifficulty: setField("selectedDifficulty"),
    setContentSystemType: setField("contentSystemType"),

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
        const result = tryUnlockTalent(keywordId, talentId, state.progress.talentXP, state.progress.unlockedTalents);
        if (result.unlockedTalents) {
          state.progress.unlockedTalents = result.unlockedTalents;
        }
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
            state.progress.runTalentXP = {};
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
      const keywords = filterKeywordsForTalentXP(getCardKeywords(card));
      if (keywords.length === 0) return;
      set((state) => {
        state.progress.runTalentXP = addTalentXP(state.progress.runTalentXP, keywords);
      });
    },

    awardMysteryXP: (keywordId, amount) => {
      const keywords = filterKeywordsForTalentXP([keywordId]);
      if (keywords.length === 0) return;
      set((state) => {
        state.progress.runTalentXP = addTalentXP(state.progress.runTalentXP, keywords, amount);
      });
    },

    addRunMaterialsEarned: (materials) =>
      set((state) => {
        state.progress.runMaterialsEarned = addInventory(state.progress.runMaterialsEarned, materials);
      }),

    clearRunMaterialsEarned: () =>
      set((state) => {
        state.progress.runMaterialsEarned = emptyInventory();
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

    initialize: (activeRun, talentXP, unlockedTalents, fallbackCharacterId = "knight") =>
      set((state) => {
        Object.assign(
          state.progress,
          createInitialRunState(activeRun, fallbackCharacterId),
          createInitialTalentState(talentXP, unlockedTalents),
          { initialized: true },
        );
      }),

    hydrateFromSnapshot: (snapshot) =>
      set((state) => {
        state.session.runEndTalentXP = {};
        Object.assign(state.progress, runFieldsFromSnapshot(snapshot), {
          runTalentXP: {},
          runMaterialsEarned: emptyInventory(),
          lastOfferedDestinations: [],
          destinationRoundsSinceOffered: {},
        });
      }),
  };
}
