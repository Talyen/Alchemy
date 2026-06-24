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
  type CompanionId,
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
import { addInventory, emptyInventory, subtractInventory, canAfford } from "@/lib/homestead/inventory";
import type { MaterialInventory, BuildingId, FarmId, ResearchId } from "@/lib/homestead/types";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { companionTierItems, COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "@/lib/homestead/companions";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { tryUpgradeTierItem } from "@/lib/homestead/upgrades";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
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
  addMaterials: (materials: MaterialInventory) => void;
  setMaterials: (materials: MaterialInventory) => void;
  constructBuilding: (id: BuildingId) => boolean;
  plantFarm: (id: FarmId) => boolean;
  completeResearch: (id: ResearchId) => boolean;
  bondCompanion: (id: CompanionId) => boolean;
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

    addMaterials: (materials) =>
      set((state) => {
        state.progress.materialInventory = addInventory(state.progress.materialInventory, materials);
      }),

    setMaterials: (materials) =>
      set((state) => {
        state.progress.materialInventory = materials;
      }),

    constructBuilding: (id) => {
      let succeeded = false;
      set((state) => {
        const currentLevel = state.progress.constructedBuildings[id] ?? 0;
        const result = tryUpgradeTierItem(
          buildings.find((b) => b.id === id),
          currentLevel,
          state.progress.materialInventory,
        );
        if (!result.ok) return;
        succeeded = true;
        state.progress.materialInventory = result.inventory;
        state.progress.constructedBuildings[id] = result.nextLevel;
        state.progress.effects = computeHomesteadEffects(
          state.progress.constructedBuildings,
          state.progress.plantedFarms,
          state.progress.completedResearch,
          state.progress.bondedCompanions,
        );
      });
      return succeeded;
    },

    plantFarm: (id) => {
      let succeeded = false;
      set((state) => {
        const currentLevel = state.progress.plantedFarms[id] ?? 0;
        const result = tryUpgradeTierItem(
          farmPlots.find((f) => f.id === id),
          currentLevel,
          state.progress.materialInventory,
        );
        if (!result.ok) return;
        succeeded = true;
        state.progress.materialInventory = result.inventory;
        state.progress.plantedFarms[id] = result.nextLevel;
        state.progress.effects = computeHomesteadEffects(
          state.progress.constructedBuildings,
          state.progress.plantedFarms,
          state.progress.completedResearch,
          state.progress.bondedCompanions,
        );
      });
      return succeeded;
    },

    completeResearch: (id) => {
      let succeeded = false;
      set((state) => {
        const currentLevel = state.progress.completedResearch[id] ?? 0;
        const result = tryUpgradeTierItem(
          researchUpgrades.find((r) => r.id === id),
          currentLevel,
          state.progress.materialInventory,
        );
        if (!result.ok) return;
        succeeded = true;
        state.progress.materialInventory = result.inventory;
        state.progress.completedResearch[id] = result.nextLevel;
        state.progress.effects = computeHomesteadEffects(
          state.progress.constructedBuildings,
          state.progress.plantedFarms,
          state.progress.completedResearch,
          state.progress.bondedCompanions,
        );
      });
      return succeeded;
    },

    bondCompanion: (id) => {
      let succeeded = false;
      set((state) => {
        const currentLevel = state.progress.bondedCompanions[id] ?? 0;
        if (currentLevel >= COMPANION_MAX_TIER) return;
        const cost = COMPANION_BOND_TIERS[currentLevel]!;
        if (!canAfford(state.progress.materialInventory, cost)) return;
        succeeded = true;
        state.progress.materialInventory = subtractInventory(state.progress.materialInventory, cost);
        state.progress.bondedCompanions[id] = currentLevel + 1;
        state.progress.effects = computeHomesteadEffects(
          state.progress.constructedBuildings,
          state.progress.plantedFarms,
          state.progress.completedResearch,
          state.progress.bondedCompanions,
        );
      });
      return succeeded;
    },
  };
}
