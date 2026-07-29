import { getGoldMultiplier, getCardKeywords, addTalentXP, filterKeywordsForTalentXP } from "@/lib/game-data";
import {
  createInitialActiveRunFields,
  runFieldsFromSnapshot,
  type ActiveRunProgressFields,
} from "@/features/alchemy/shared/stores/run-state-init";
import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import { defineNestedFieldSetter, type ImmerSet } from "./_field-setter";
import type { RunDomainDataState } from "../run-domain-types";
import type { ProgressActions } from "./progress-action-types";
import { nextRunRngValue } from "@/lib/run-rng";

/** Active-run progression actions (deck, gold, HP, acts, run tallies, RNG). */
export function defineProgressActions(set: ImmerSet<RunDomainDataState>): ProgressActions {
  const setRunField = defineNestedFieldSetter<ActiveRunProgressFields, RunDomainDataState>(
    set,
    (state) => state.activeRun,
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
        state.activeRun.lastOfferedDestinations = [...offerState.lastOfferedDestinations];
        state.activeRun.destinationRoundsSinceOffered = { ...offerState.roundsSinceOffered };
      }),
    setRunTrinkets: setRunField("runTrinkets"),
    setEncounteredRunEnemyIds: setRunField("encounteredRunEnemyIds"),
    setSelectedDifficulty: setRunField("selectedDifficulty"),
    setContentSystemType: setRunField("contentSystemType"),

    setCharacter: (selectedId) =>
      set((state) => {
        state.activeRun.characterId = selectedId;
      }),

    resetProgress: () =>
      set((state) => {
        state.activeRun = {
          ...createInitialActiveRunFields(null, state.activeRun.characterId),
          runTalentXP: {},
        };
        state.initialized = true;
      }),

    addRunGold: (amount) =>
      set((state) => {
        const mult = getGoldMultiplier(state.activeRun.characterId, state.activeRun.selectedDifficulty);
        state.activeRun.runGold += Math.floor(amount * mult);
      }),

    nextRunRandom: (stream) => {
      let value = 0;
      set((state) => {
        const draw = nextRunRngValue(state.activeRun.rng, stream);
        state.activeRun.rng.counters[stream] = draw.nextCounter;
        value = draw.value;
      });
      return value;
    },

    resetRunXP: () =>
      set((state) => {
        state.activeRun.runTalentXP = {};
      }),

    awardCardXP: (card) => {
      const keywords = filterKeywordsForTalentXP(getCardKeywords(card));
      if (keywords.length === 0) return;
      set((state) => {
        state.activeRun.runTalentXP = addTalentXP(state.activeRun.runTalentXP, keywords);
      });
    },

    awardMysteryXP: (keywordId, amount) => {
      const keywords = filterKeywordsForTalentXP([keywordId]);
      if (keywords.length === 0) return;
      set((state) => {
        state.activeRun.runTalentXP = addTalentXP(state.activeRun.runTalentXP, keywords, amount);
      });
    },

    addRunMaterialsEarned: (materials) =>
      set((state) => {
        state.activeRun.runMaterialsEarned = addInventory(state.activeRun.runMaterialsEarned, materials);
      }),

    clearRunMaterialsEarned: () =>
      set((state) => {
        state.activeRun.runMaterialsEarned = emptyInventory();
      }),

    initialize: (activeRun, fallbackCharacterId = "knight") =>
      set((state) => {
        state.activeRun = createInitialActiveRunFields(activeRun, fallbackCharacterId);
        state.initialized = true;
      }),

    hydrateFromSnapshot: (snapshot) =>
      set((state) => {
        Object.assign(state.activeRun, runFieldsFromSnapshot(snapshot), {
          runTalentXP: {},
          runMaterialsEarned: emptyInventory(),
          lastOfferedDestinations: [],
          destinationRoundsSinceOffered: {},
        });
      }),
  };
}

export type { ProgressActions } from "./progress-action-types";
