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
  createInitialRunState,
  createInitialTalentState,
  runFieldsFromSnapshot,
  type RunStateFields,
} from "@/features/alchemy/run-setup/run/run-state-init";
import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { companionTierItems } from "@/lib/homestead/companions";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import { defineFieldSetter, type ImmerSet } from "./_field-setter";
import { createHomesteadProgressActions } from "./progress-homestead-actions";
import type { RunDomainDataState } from "../run-domain-types";
import type { ProgressActions } from "./progress-action-types";

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
        const materialInventory = state.progress.materialInventory;
        const constructedBuildings = state.progress.constructedBuildings;
        const plantedFarms = state.progress.plantedFarms;
        const completedResearch = state.progress.completedResearch;
        const bondedCompanions = state.progress.bondedCompanions;
        const effects = state.progress.effects;
        Object.assign(state.progress, createInitialRunState(null, characterId), {
          talentXP,
          unlockedTalents,
          runTalentXP: {},
          materialInventory,
          constructedBuildings,
          plantedFarms,
          completedResearch,
          bondedCompanions,
          effects,
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
        state.progress.materialInventory = emptyInventory();
        state.progress.constructedBuildings = createEmptyTierRecord(buildings);
        state.progress.plantedFarms = createEmptyTierRecord(farmPlots);
        state.progress.completedResearch = createEmptyTierRecord(researchUpgrades);
        state.progress.bondedCompanions = createEmptyTierRecord(companionTierItems);
        state.progress.effects = computeHomesteadEffects(
          createEmptyTierRecord(buildings),
          createEmptyTierRecord(farmPlots),
          createEmptyTierRecord(researchUpgrades),
        );
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
        const existingHomestead = {
          materialInventory: state.progress.materialInventory,
          constructedBuildings: state.progress.constructedBuildings,
          plantedFarms: state.progress.plantedFarms,
          completedResearch: state.progress.completedResearch,
          bondedCompanions: state.progress.bondedCompanions,
          effects: state.progress.effects,
        };
        Object.assign(
          state.progress,
          createInitialRunState(activeRun, fallbackCharacterId),
          createInitialTalentState(talentXP, unlockedTalents),
          existingHomestead,
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

    ...createHomesteadProgressActions(set),
  };
}

export type { ProgressActions } from "./progress-action-types";
