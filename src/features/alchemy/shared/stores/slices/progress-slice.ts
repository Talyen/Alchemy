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
import { nextRunRngValue } from "@/lib/run-rng";

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
        const characterId = state.activeRun.characterId;
        const profile = state.profile;
        state.activeRun = {
          ...createInitialActiveRunFields(null, characterId),
          runTalentXP: {},
        };
        state.profile = profile;
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

    unlockTalent: (keywordId, talentId) =>
      set((state) => {
        const result = tryUnlockTalent(keywordId, talentId, state.profile.talentXP, state.profile.unlockedTalents);
        if (result.unlockedTalents) {
          state.profile.unlockedTalents = result.unlockedTalents;
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
            state.profile.unlockedTalents = next;
            state.profile.talentXP = xp;
            state.activeRun.runTalentXP = {};
          })
      : () => {},

    resetUnlockedTalents: () =>
      set((state) => {
        state.profile.unlockedTalents = {};
      }),

    resetRunXP: () =>
      set((state) => {
        state.activeRun.runTalentXP = {};
      }),

    clearPermanentData: () =>
      set((state) => {
        state.profile = createInitialPermanentFields();
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

    finalizeRunXP: () =>
      set((state) => {
        if (Object.keys(state.activeRun.runTalentXP).length === 0) {
          state.session.runEndTalentXP = {};
          return;
        }
        const multiplier = getDifficultyXPMultiplier(state.activeRun.selectedDifficulty);
        state.session.runEndTalentXP = computeRunEndTalentXPSnapshot(state.activeRun.runTalentXP, multiplier);
        state.profile.talentXP = mergeRunTalentXPIntoPermanent(
          state.activeRun.runTalentXP,
          state.profile.talentXP,
          multiplier,
        );
        state.activeRun.runTalentXP = {};
      }),

    initialize: (activeRun, talentXP, unlockedTalents, fallbackCharacterId = "knight") =>
      set((state) => {
        const existingProfile = state.profile;
        state.activeRun = createInitialActiveRunFields(activeRun, fallbackCharacterId);
        state.profile = {
          ...existingProfile,
          ...createInitialTalentState(talentXP, unlockedTalents),
        };
        state.initialized = true;
      }),

    hydrateFromSnapshot: (snapshot) =>
      set((state) => {
        state.session.runEndTalentXP = {};
        Object.assign(state.activeRun, runFieldsFromSnapshot(snapshot), {
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
