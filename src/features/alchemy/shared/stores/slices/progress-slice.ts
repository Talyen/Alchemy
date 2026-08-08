import {
  addTalentXP,
  filterKeywordsForTalentXP,
  getCardKeywords,
  getGoldMultiplier,
  type BattleCard,
  type CharacterId,
  type KeywordId,
} from "@/lib/game-data";
import {
  createInitialActiveRunFields,
  runFieldsFromSnapshot,
  type ActiveRunProgressFields,
} from "@/features/alchemy/shared/stores/run-state-init";
import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import { defineNestedFieldSetter, type ImmerSet } from "./_field-setter";
import type { RunDomainDataState } from "../run-domain-types";
import { nextRunRngValue, type RunRngStream } from "@/lib/run-rng";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";

/** Active-run scoped progression actions. Permanent progression lives on the aggregate's runProfile region. */
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
      | ActiveRunProgressFields["completedDestinations"]
      | ((prev: ActiveRunProgressFields["completedDestinations"]) => ActiveRunProgressFields["completedDestinations"]),
  ) => void;
  setDestinationOfferState: (state: {
    lastOfferedDestinations: ActiveRunProgressFields["lastOfferedDestinations"];
    roundsSinceOffered: ActiveRunProgressFields["destinationRoundsSinceOffered"];
  }) => void;
  setRunTrinkets: (action: string[] | ((prev: string[]) => string[])) => void;
  setEncounteredRunEnemyIds: (action: string[] | ((prev: string[]) => string[])) => void;
  setSelectedDifficulty: (
    action:
      | ActiveRunProgressFields["selectedDifficulty"]
      | ((prev: ActiveRunProgressFields["selectedDifficulty"]) => ActiveRunProgressFields["selectedDifficulty"]),
  ) => void;
  setContentSystemType: (
    action:
      | ActiveRunProgressFields["contentSystemType"]
      | ((prev: ActiveRunProgressFields["contentSystemType"]) => ActiveRunProgressFields["contentSystemType"]),
  ) => void;
  setCharacter: (selectedId: CharacterId) => void;
  resetProgress: () => void;
  addRunGold: (amount: number) => void;
  nextRunRandom: (stream: RunRngStream) => number;
  resetRunXP: () => void;
  awardCardXP: (card: BattleCard) => void;
  awardMysteryXP: (keywordId: KeywordId, amount: number) => void;
  addRunMaterialsEarned: (materials: MaterialInventory) => void;
  clearRunMaterialsEarned: () => void;
  initialize: (activeRun: ActiveRunData | null, fallbackCharacterId?: CharacterId) => void;
  initializeFromResumeSnapshot: (activeRun: ActiveRunProgressFields) => void;
  hydrateFromSnapshot: (snapshot: RunStartSnapshot) => void;
}

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

    initializeFromResumeSnapshot: (activeRun) =>
      set((state) => {
        state.activeRun = activeRun;
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
