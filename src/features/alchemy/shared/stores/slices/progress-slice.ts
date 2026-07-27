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
  type UnlockedTalents,
  type TalentXP,
} from "@/lib/game-data";
import {
  createInitialActiveRunFields,
  createInitialPermanentFields,
  createInitialTalentState,
  runFieldsFromSnapshot,
  type ActiveRunProgressFields,
} from "@/features/alchemy/run-setup/run/run-state-init";
import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import { defineNestedFieldSetter, type ImmerSet } from "./_field-setter";
import { createHomesteadProgressActions } from "./progress-homestead-actions";
import type { RunDomainDataState } from "../run-domain-types";
import type { ProgressActions } from "./progress-action-types";

export function defineProgressActions(set: ImmerSet<RunDomainDataState>): ProgressActions {
  const setRunField = defineNestedFieldSetter<ActiveRunProgressFields, RunDomainDataState>(
    set,
    (state) => state.progress.run,
  );

  return {
    setRunDeck: setRunField("runDeck"),
    setRunGold: setRunField("runGold"),
    setRunPlayerHealth: setRunField("runPlayerHealth"),
    setRunMaxHealth: setRunField("runMaxHealth"),
    setRoomsEncountered: setRunField("roomsEncountered"),
    setCurrentAct: setRunField("currentAct"),
    setDestinationIndexInAct: setRunField("destinationIndexInAct"),
    setCompletedDestinations: setRunField("completedDestinations"),
    setLastOfferedDestinations: setRunField("lastOfferedDestinations"),
    setDestinationRoundsSinceOffered: setRunField("destinationRoundsSinceOffered"),
    setDestinationOfferState: (offerState) =>
      set((state) => {
        state.progress.run.lastOfferedDestinations = [...offerState.lastOfferedDestinations];
        state.progress.run.destinationRoundsSinceOffered = { ...offerState.roundsSinceOffered };
      }),
    setRunTrinkets: setRunField("runTrinkets"),
    setEncounteredRunEnemyIds: setRunField("encounteredRunEnemyIds"),
    setSelectedDifficulty: setRunField("selectedDifficulty"),
    setContentSystemType: setRunField("contentSystemType"),

    setCharacter: (selectedId) =>
      set((state) => {
        state.progress.run.characterId = selectedId;
      }),

    resetProgress: () =>
      set((state) => {
        const characterId = state.progress.run.characterId;
        const permanent = state.progress.permanent;
        state.progress.run = {
          ...createInitialActiveRunFields(null, characterId),
          runTalentXP: {},
        };
        state.progress.permanent = permanent;
        state.progress.initialized = true;
      }),

    addRunGold: (amount) =>
      set((state) => {
        const mult = getGoldMultiplier(state.progress.run.characterId, state.progress.run.selectedDifficulty);
        state.progress.run.runGold += Math.floor(amount * mult);
      }),

    unlockTalent: (keywordId, talentId) =>
      set((state) => {
        const result = tryUnlockTalent(
          keywordId,
          talentId,
          state.progress.permanent.talentXP,
          state.progress.permanent.unlockedTalents,
        );
        if (result.unlockedTalents) {
          state.progress.permanent.unlockedTalents = result.unlockedTalents;
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
            state.progress.permanent.unlockedTalents = next;
            state.progress.permanent.talentXP = xp;
            state.progress.run.runTalentXP = {};
          })
      : () => {},

    resetUnlockedTalents: () =>
      set((state) => {
        state.progress.permanent.unlockedTalents = {};
      }),

    resetRunXP: () =>
      set((state) => {
        state.progress.run.runTalentXP = {};
      }),

    clearPermanentData: () =>
      set((state) => {
        state.progress.permanent = createInitialPermanentFields();
        state.progress.run.runTalentXP = {};
      }),

    awardCardXP: (card) => {
      const keywords = filterKeywordsForTalentXP(getCardKeywords(card));
      if (keywords.length === 0) return;
      set((state) => {
        state.progress.run.runTalentXP = addTalentXP(state.progress.run.runTalentXP, keywords);
      });
    },

    awardMysteryXP: (keywordId, amount) => {
      const keywords = filterKeywordsForTalentXP([keywordId]);
      if (keywords.length === 0) return;
      set((state) => {
        state.progress.run.runTalentXP = addTalentXP(state.progress.run.runTalentXP, keywords, amount);
      });
    },

    addRunMaterialsEarned: (materials) =>
      set((state) => {
        state.progress.run.runMaterialsEarned = addInventory(state.progress.run.runMaterialsEarned, materials);
      }),

    clearRunMaterialsEarned: () =>
      set((state) => {
        state.progress.run.runMaterialsEarned = emptyInventory();
      }),

    finalizeRunXP: () =>
      set((state) => {
        if (Object.keys(state.progress.run.runTalentXP).length === 0) {
          state.session.runEndTalentXP = {};
          return;
        }
        const multiplier = getDifficultyXPMultiplier(state.progress.run.selectedDifficulty);
        state.session.runEndTalentXP = computeRunEndTalentXPSnapshot(state.progress.run.runTalentXP, multiplier);
        state.progress.permanent.talentXP = mergeRunTalentXPIntoPermanent(
          state.progress.run.runTalentXP,
          state.progress.permanent.talentXP,
          multiplier,
        );
        state.progress.run.runTalentXP = {};
      }),

    initialize: (activeRun, talentXP, unlockedTalents, fallbackCharacterId = "knight") =>
      set((state) => {
        const existingPermanent = state.progress.permanent;
        state.progress.run = createInitialActiveRunFields(activeRun, fallbackCharacterId);
        state.progress.permanent = {
          ...existingPermanent,
          ...createInitialTalentState(talentXP, unlockedTalents),
        };
        state.progress.initialized = true;
      }),

    hydrateFromSnapshot: (snapshot) =>
      set((state) => {
        state.session.runEndTalentXP = {};
        Object.assign(state.progress.run, runFieldsFromSnapshot(snapshot), {
          runTalentXP: {},
          runMaterialsEarned: emptyInventory(),
          lastOfferedDestinations: [],
          destinationRoundsSinceOffered: {},
        });
      }),

    ...createHomesteadProgressActions(set),
  };
}

export type { ProgressActions } from "./progress-action-types";
