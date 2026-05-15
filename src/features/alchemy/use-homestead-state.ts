// Manages homestead persistent state: material inventory, constructed buildings,
// planted farm plots, and completed research. Provides actions for spending
// materials and collecting farm yields between runs.

import { useState, useMemo, useCallback } from "react";
import {
  type BuildingId,
  type FarmId,
  type MaterialInventory,
  type ResearchId,
} from "@/lib/homestead/types";
import { emptyInventory, addInventory, subtractInventory, canAfford } from "@/lib/homestead/inventory";
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

      if (!canAfford(materialInventory, building.cost)) return false;
      setMaterialInventory((prev) => subtractInventory(prev, building.cost));
      setConstructedBuildings((prev) => [...prev, id]);
      return true;
    },
    [constructedBuildings, materialInventory],
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
    // No-op: farm yield is now shown on the Run End screen.
  }, []);

  const reset = useCallback(() => {
    setMaterialInventory(emptyInventory());
    setConstructedBuildings([]);
    setPlantedFarms([]);
    setCompletedResearch([]);
  }, []);

  return {
    materialInventory,
    setMaterials,
    constructedBuildings,
    plantedFarms,
    completedResearch,
    effects,
    addMaterials,
    constructBuilding,
    plantFarm,
    completeResearch,
    triggerFarmYield,
    reset,
  };
}
