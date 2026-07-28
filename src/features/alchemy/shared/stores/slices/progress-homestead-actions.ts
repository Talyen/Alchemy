import { canAfford, addInventory, subtractInventory } from "@/lib/homestead/inventory";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "@/lib/homestead/companions";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { tryUpgradeTierItem } from "@/lib/homestead/upgrades";
import type { ImmerSet } from "./_field-setter";
import type { RunDomainDataState } from "../run-domain-types";
import type { ProgressActions } from "./progress-action-types";

export function createHomesteadProgressActions(
  set: ImmerSet<RunDomainDataState>,
): Pick<
  ProgressActions,
  "addMaterials" | "setMaterials" | "constructBuilding" | "plantFarm" | "completeResearch" | "bondCompanion"
> {
  return {
    addMaterials: (materials) =>
      set((state) => {
        state.profile.materialInventory = addInventory(state.profile.materialInventory, materials);
      }),

    setMaterials: (materials) =>
      set((state) => {
        state.profile.materialInventory = materials;
      }),

    constructBuilding: (id) => {
      let succeeded = false;
      set((state) => {
        const profile = state.profile;
        const currentLevel = profile.constructedBuildings[id] ?? 0;
        const result = tryUpgradeTierItem(
          buildings.find((b) => b.id === id),
          currentLevel,
          profile.materialInventory,
        );
        if (!result.ok) return;
        succeeded = true;
        profile.materialInventory = result.inventory;
        profile.constructedBuildings[id] = result.nextLevel;
        profile.effects = computeHomesteadEffects(
          profile.constructedBuildings,
          profile.plantedFarms,
          profile.completedResearch,
          profile.bondedCompanions,
        );
      });
      return succeeded;
    },

    plantFarm: (id) => {
      let succeeded = false;
      set((state) => {
        const profile = state.profile;
        const currentLevel = profile.plantedFarms[id] ?? 0;
        const result = tryUpgradeTierItem(
          farmPlots.find((f) => f.id === id),
          currentLevel,
          profile.materialInventory,
        );
        if (!result.ok) return;
        succeeded = true;
        profile.materialInventory = result.inventory;
        profile.plantedFarms[id] = result.nextLevel;
        profile.effects = computeHomesteadEffects(
          profile.constructedBuildings,
          profile.plantedFarms,
          profile.completedResearch,
          profile.bondedCompanions,
        );
      });
      return succeeded;
    },

    completeResearch: (id) => {
      let succeeded = false;
      set((state) => {
        const profile = state.profile;
        const currentLevel = profile.completedResearch[id] ?? 0;
        const result = tryUpgradeTierItem(
          researchUpgrades.find((r) => r.id === id),
          currentLevel,
          profile.materialInventory,
        );
        if (!result.ok) return;
        succeeded = true;
        profile.materialInventory = result.inventory;
        profile.completedResearch[id] = result.nextLevel;
        profile.effects = computeHomesteadEffects(
          profile.constructedBuildings,
          profile.plantedFarms,
          profile.completedResearch,
          profile.bondedCompanions,
        );
      });
      return succeeded;
    },

    bondCompanion: (id) => {
      let succeeded = false;
      set((state) => {
        const profile = state.profile;
        const currentLevel = profile.bondedCompanions[id] ?? 0;
        if (currentLevel >= COMPANION_MAX_TIER) return;
        const cost = COMPANION_BOND_TIERS[currentLevel]!;
        if (!canAfford(profile.materialInventory, cost)) return;
        succeeded = true;
        profile.materialInventory = subtractInventory(profile.materialInventory, cost);
        profile.bondedCompanions[id] = currentLevel + 1;
        profile.effects = computeHomesteadEffects(
          profile.constructedBuildings,
          profile.plantedFarms,
          profile.completedResearch,
          profile.bondedCompanions,
        );
      });
      return succeeded;
    },
  };
}
