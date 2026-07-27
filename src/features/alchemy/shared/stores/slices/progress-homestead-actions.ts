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
        state.progress.permanent.materialInventory = addInventory(
          state.progress.permanent.materialInventory,
          materials,
        );
      }),

    setMaterials: (materials) =>
      set((state) => {
        state.progress.permanent.materialInventory = materials;
      }),

    constructBuilding: (id) => {
      let succeeded = false;
      set((state) => {
        const currentLevel = state.progress.permanent.constructedBuildings[id] ?? 0;
        const result = tryUpgradeTierItem(
          buildings.find((b) => b.id === id),
          currentLevel,
          state.progress.permanent.materialInventory,
        );
        if (!result.ok) return;
        succeeded = true;
        state.progress.permanent.materialInventory = result.inventory;
        state.progress.permanent.constructedBuildings[id] = result.nextLevel;
        state.progress.permanent.effects = computeHomesteadEffects(
          state.progress.permanent.constructedBuildings,
          state.progress.permanent.plantedFarms,
          state.progress.permanent.completedResearch,
          state.progress.permanent.bondedCompanions,
        );
      });
      return succeeded;
    },

    plantFarm: (id) => {
      let succeeded = false;
      set((state) => {
        const currentLevel = state.progress.permanent.plantedFarms[id] ?? 0;
        const result = tryUpgradeTierItem(
          farmPlots.find((f) => f.id === id),
          currentLevel,
          state.progress.permanent.materialInventory,
        );
        if (!result.ok) return;
        succeeded = true;
        state.progress.permanent.materialInventory = result.inventory;
        state.progress.permanent.plantedFarms[id] = result.nextLevel;
        state.progress.permanent.effects = computeHomesteadEffects(
          state.progress.permanent.constructedBuildings,
          state.progress.permanent.plantedFarms,
          state.progress.permanent.completedResearch,
          state.progress.permanent.bondedCompanions,
        );
      });
      return succeeded;
    },

    completeResearch: (id) => {
      let succeeded = false;
      set((state) => {
        const currentLevel = state.progress.permanent.completedResearch[id] ?? 0;
        const result = tryUpgradeTierItem(
          researchUpgrades.find((r) => r.id === id),
          currentLevel,
          state.progress.permanent.materialInventory,
        );
        if (!result.ok) return;
        succeeded = true;
        state.progress.permanent.materialInventory = result.inventory;
        state.progress.permanent.completedResearch[id] = result.nextLevel;
        state.progress.permanent.effects = computeHomesteadEffects(
          state.progress.permanent.constructedBuildings,
          state.progress.permanent.plantedFarms,
          state.progress.permanent.completedResearch,
          state.progress.permanent.bondedCompanions,
        );
      });
      return succeeded;
    },

    bondCompanion: (id) => {
      let succeeded = false;
      set((state) => {
        const currentLevel = state.progress.permanent.bondedCompanions[id] ?? 0;
        if (currentLevel >= COMPANION_MAX_TIER) return;
        const cost = COMPANION_BOND_TIERS[currentLevel]!;
        if (!canAfford(state.progress.permanent.materialInventory, cost)) return;
        succeeded = true;
        state.progress.permanent.materialInventory = subtractInventory(
          state.progress.permanent.materialInventory,
          cost,
        );
        state.progress.permanent.bondedCompanions[id] = currentLevel + 1;
        state.progress.permanent.effects = computeHomesteadEffects(
          state.progress.permanent.constructedBuildings,
          state.progress.permanent.plantedFarms,
          state.progress.permanent.completedResearch,
          state.progress.permanent.bondedCompanions,
        );
      });
      return succeeded;
    },
  };
}
