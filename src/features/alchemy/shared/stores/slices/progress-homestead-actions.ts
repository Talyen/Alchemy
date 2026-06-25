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
