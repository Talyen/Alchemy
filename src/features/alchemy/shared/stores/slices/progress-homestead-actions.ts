import { canAfford, addInventory, subtractInventory } from "@/lib/homestead/inventory";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "@/lib/homestead/companions";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { tryUpgradeTierItem } from "@/lib/homestead/upgrades";
import type { CompanionId } from "@/lib/game-data";
import type { BuildingId, FarmId, MaterialInventory, ResearchId } from "@/lib/homestead/types";
import type { PermanentProgressFields } from "@/features/alchemy/shared/stores/run-state-init";
import type { ImmerSet } from "./_field-setter";

export interface HomesteadProfileActions {
  addMaterials: (materials: MaterialInventory) => void;
  setMaterials: (materials: MaterialInventory) => void;
  constructBuilding: (id: BuildingId) => boolean;
  plantFarm: (id: FarmId) => boolean;
  completeResearch: (id: ResearchId) => boolean;
  bondCompanion: (id: CompanionId) => boolean;
}

type TierDefinitions = ReadonlyArray<Parameters<typeof tryUpgradeTierItem>[0] & { id: string }>;

function recomputeEffects(profile: PermanentProgressFields): void {
  profile.effects = computeHomesteadEffects(
    profile.constructedBuildings,
    profile.plantedFarms,
    profile.completedResearch,
    profile.bondedCompanions,
  );
}

function applyTierUpgrade(
  profile: PermanentProgressFields,
  definitions: TierDefinitions,
  levels: Record<string, number>,
  id: string,
): boolean {
  const result = tryUpgradeTierItem(
    definitions.find((definition) => definition.id === id),
    levels[id] ?? 0,
    profile.materialInventory,
  );
  if (!result.ok) return false;
  profile.materialInventory = result.inventory;
  levels[id] = result.nextLevel;
  recomputeEffects(profile);
  return true;
}

/** Homestead spend / upgrade actions over the permanent profile fields. */
export function createHomesteadProfileActions(set: ImmerSet<PermanentProgressFields>): HomesteadProfileActions {
  return {
    addMaterials: (materials) =>
      set((profile) => {
        profile.materialInventory = addInventory(profile.materialInventory, materials);
      }),

    setMaterials: (materials) =>
      set((profile) => {
        profile.materialInventory = materials;
      }),

    constructBuilding: (id) => {
      let succeeded = false;
      set((profile) => {
        succeeded = applyTierUpgrade(profile, buildings, profile.constructedBuildings, id);
      });
      return succeeded;
    },

    plantFarm: (id) => {
      let succeeded = false;
      set((profile) => {
        succeeded = applyTierUpgrade(profile, farmPlots, profile.plantedFarms, id);
      });
      return succeeded;
    },

    completeResearch: (id) => {
      let succeeded = false;
      set((profile) => {
        succeeded = applyTierUpgrade(profile, researchUpgrades, profile.completedResearch, id);
      });
      return succeeded;
    },

    bondCompanion: (id) => {
      let succeeded = false;
      set((profile) => {
        const currentLevel = profile.bondedCompanions[id] ?? 0;
        if (currentLevel >= COMPANION_MAX_TIER) return;
        const cost = COMPANION_BOND_TIERS[currentLevel]!;
        if (!canAfford(profile.materialInventory, cost)) return;
        succeeded = true;
        profile.materialInventory = subtractInventory(profile.materialInventory, cost);
        profile.bondedCompanions[id] = currentLevel + 1;
        recomputeEffects(profile);
      });
      return succeeded;
    },
  };
}
