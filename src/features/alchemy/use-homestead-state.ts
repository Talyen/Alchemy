// Manages homestead persistent state: material inventory, constructed buildings,
// planted farm plots, and completed research. Provides actions for spending
// materials and collecting farm yields between runs.

import { useState, useMemo, useCallback } from "react";
import {
  type BuildingId,
  type FarmId,
  type MaterialId,
  type MaterialInventory,
  type ResearchId,
  emptyInventory,
  addInventory,
  subtractInventory,
  canAfford,
} from "@/lib/homestead/types";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";

export function useHomesteadState(initial: {
  materialInventory: MaterialInventory;
  constructedBuildings: BuildingId[];
  plantedFarms: FarmId[];
  completedResearch: ResearchId[];
}) {
  const [materialInventory, setMaterialInventory] = useState<MaterialInventory>(initial.materialInventory);
  const [constructedBuildings, setConstructedBuildings] = useState<BuildingId[]>(initial.constructedBuildings);
  const [plantedFarms, setPlantedFarms] = useState<FarmId[]>(initial.plantedFarms);
  const [completedResearch, setCompletedResearch] = useState<ResearchId[]>(initial.completedResearch);
  const [pendingFarmYield, setPendingFarmYield] = useState(false);
  const [lastFarmYield, setLastFarmYield] = useState<MaterialInventory | null>(null);

  const effects = useMemo(
    () => computeHomesteadEffects(constructedBuildings, plantedFarms, completedResearch),
    [constructedBuildings, plantedFarms, completedResearch],
  );

  const addMaterials = useCallback((materials: MaterialInventory) => {
    setMaterialInventory((prev) => addInventory(prev, materials));
  }, []);

  const setMaterials = useCallback((materials: MaterialInventory) => {
    setMaterialInventory(materials);
  }, []);

  const constructBuilding = useCallback(
    (id: BuildingId): boolean => {
      const building = buildings.find((b) => b.id === id);
      if (!building || constructedBuildings.includes(id)) return false;

      // Apply cost reduction from carpentry/masonry research
      const costReduction = effects.buildingCostReduction;
      const cost: MaterialInventory = emptyInventory();
      for (const [mat, amount] of Object.entries(building.cost)) {
        if (amount > 0) {
          cost[mat as MaterialId] = Math.ceil(amount * (1 - costReduction));
        }
      }

      if (!canAfford(materialInventory, cost)) return false;
      setMaterialInventory((prev) => subtractInventory(prev, cost));
      setConstructedBuildings((prev) => [...prev, id]);
      return true;
    },
    [constructedBuildings, materialInventory, effects.buildingCostReduction],
  );

  const plantFarm = useCallback(
    (id: FarmId): boolean => {
      const farm = farmPlots.find((f) => f.id === id);
      if (!farm || plantedFarms.includes(id)) return false;
      if (!canAfford(materialInventory, farm.cost)) return false;
      setMaterialInventory((prev) => subtractInventory(prev, farm.cost));
      setPlantedFarms((prev) => [...prev, id]);
      return true;
    },
    [plantedFarms, materialInventory],
  );

  const completeResearch = useCallback(
    (id: ResearchId): boolean => {
      const research = researchUpgrades.find((r) => r.id === id);
      if (!research || completedResearch.includes(id)) return false;
      if (!canAfford(materialInventory, research.cost)) return false;
      setMaterialInventory((prev) => subtractInventory(prev, research.cost));
      setCompletedResearch((prev) => [...prev, id]);
      return true;
    },
    [completedResearch, materialInventory],
  );

  const triggerFarmYield = useCallback(() => {
    setPendingFarmYield(true);
  }, []);

  const collectFarmYield = useCallback((): MaterialInventory | null => {
    if (!pendingFarmYield || plantedFarms.length === 0) {
      setPendingFarmYield(false);
      return null;
    }

    let totalYield = emptyInventory();
    for (const farmId of plantedFarms) {
      const farm = farmPlots.find((f) => f.id === farmId);
      if (!farm) continue;
      const baseYield = { ...farm.yield };
      if (effects.farmYieldMultiplier > 0) {
        for (const mat of Object.keys(baseYield) as Array<keyof MaterialInventory>) {
          if (baseYield[mat] > 0) {
            baseYield[mat] = Math.floor(baseYield[mat] * (1 + effects.farmYieldMultiplier));
          }
        }
      }
      totalYield = addInventory(totalYield, baseYield);
    }

    setMaterialInventory((prev) => addInventory(prev, totalYield));
    setPendingFarmYield(false);
    setLastFarmYield(totalYield);
    return totalYield;
  }, [pendingFarmYield, plantedFarms, effects.farmYieldMultiplier]);

  const clearLastFarmYield = useCallback(() => {
    setLastFarmYield(null);
  }, []);

  const reset = useCallback(() => {
    setMaterialInventory(emptyInventory());
    setConstructedBuildings([]);
    setPlantedFarms([]);
    setCompletedResearch([]);
    setPendingFarmYield(false);
    setLastFarmYield(null);
  }, []);

  return {
    materialInventory,
    setMaterials,
    constructedBuildings,
    plantedFarms,
    completedResearch,
    effects,
    pendingFarmYield,
    lastFarmYield,
    addMaterials,
    constructBuilding,
    plantFarm,
    completeResearch,
    triggerFarmYield,
    collectFarmYield,
    clearLastFarmYield,
    reset,
  };
}
