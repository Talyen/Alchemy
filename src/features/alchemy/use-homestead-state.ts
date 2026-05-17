// Manages homestead persistent state: material inventory, constructed buildings,
// planted farm plots, completed research, and bonded companions. Provides actions
// for spending materials and bonding with companions.

import { useState, useMemo, useCallback, useRef } from "react";
import type { CompanionId } from "@/lib/game-data";
import { type BuildingId, type FarmId, type MaterialInventory, type ResearchId } from "@/lib/homestead/types";
import { emptyInventory, addInventory, subtractInventory, canAfford } from "@/lib/homestead/inventory";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import { companionTierItems, COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "@/lib/homestead/companions";

export { COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "@/lib/homestead/companions";

type HomesteadState = {
  materialInventory: MaterialInventory;
  constructedBuildings: Record<BuildingId, number>;
  plantedFarms: Record<FarmId, number>;
  completedResearch: Record<ResearchId, number>;
  bondedCompanions: Record<CompanionId, number>;
};

export function useHomesteadState(initial: {
  materialInventory: MaterialInventory;
  constructedBuildings: Record<BuildingId, number>;
  plantedFarms: Record<FarmId, number>;
  completedResearch: Record<ResearchId, number>;
  bondedCompanions: Record<CompanionId, number>;
}) {
  const [state, setState] = useState<HomesteadState>(initial);
  const stateRef = useRef(state);

  function commit(next: HomesteadState) {
    stateRef.current = next;
    setState(next);
  }

  const effects = useMemo(
    () =>
      computeHomesteadEffects(
        state.constructedBuildings,
        state.plantedFarms,
        state.completedResearch,
        state.bondedCompanions,
      ),
    [state],
  );

  const addMaterials = useCallback((materials: MaterialInventory) => {
    const current = stateRef.current;
    commit({ ...current, materialInventory: addInventory(current.materialInventory, materials) });
  }, []);

  const setMaterials = useCallback((materials: MaterialInventory) => {
    commit({ ...stateRef.current, materialInventory: materials });
  }, []);

  const constructBuilding = useCallback((id: BuildingId): boolean => {
    const building = buildings.find((b) => b.id === id);
    const current = stateRef.current;
    const currentLevel = current.constructedBuildings[id] ?? 0;
    if (!building || currentLevel >= building.tiers.length) return false;

    const tier = building.tiers[currentLevel];
    if (!canAfford(current.materialInventory, tier.cost)) return false;
    commit({
      ...current,
      materialInventory: subtractInventory(current.materialInventory, tier.cost),
      constructedBuildings: { ...current.constructedBuildings, [id]: currentLevel + 1 },
    });
    return true;
  }, []);

  const plantFarm = useCallback((id: FarmId): boolean => {
    const farm = farmPlots.find((f) => f.id === id);
    const current = stateRef.current;
    const currentLevel = current.plantedFarms[id] ?? 0;
    if (!farm || currentLevel >= farm.tiers.length) return false;

    const tier = farm.tiers[currentLevel];
    if (!canAfford(current.materialInventory, tier.cost)) return false;
    commit({
      ...current,
      materialInventory: subtractInventory(current.materialInventory, tier.cost),
      plantedFarms: { ...current.plantedFarms, [id]: currentLevel + 1 },
    });
    return true;
  }, []);

  const completeResearch = useCallback((id: ResearchId): boolean => {
    const research = researchUpgrades.find((r) => r.id === id);
    const current = stateRef.current;
    const currentLevel = current.completedResearch[id] ?? 0;
    if (!research || currentLevel >= research.tiers.length) return false;

    const tier = research.tiers[currentLevel];
    if (!canAfford(current.materialInventory, tier.cost)) return false;
    commit({
      ...current,
      materialInventory: subtractInventory(current.materialInventory, tier.cost),
      completedResearch: { ...current.completedResearch, [id]: currentLevel + 1 },
    });
    return true;
  }, []);

  const bondCompanion = useCallback((id: CompanionId): boolean => {
    const current = stateRef.current;
    const currentLevel = current.bondedCompanions[id] ?? 0;
    if (currentLevel >= COMPANION_MAX_TIER) return false;

    const cost = COMPANION_BOND_TIERS[currentLevel];
    if (!canAfford(current.materialInventory, cost)) return false;
    commit({
      ...current,
      materialInventory: subtractInventory(current.materialInventory, cost),
      bondedCompanions: { ...current.bondedCompanions, [id]: currentLevel + 1 },
    });
    return true;
  }, []);

  const triggerFarmYield = useCallback(() => {
    // No-op: farm yield is now shown on the Run End screen.
  }, []);

  const reset = useCallback(() => {
    commit({
      materialInventory: emptyInventory(),
      constructedBuildings: createEmptyTierRecord(buildings),
      plantedFarms: createEmptyTierRecord(farmPlots),
      completedResearch: createEmptyTierRecord(researchUpgrades),
      bondedCompanions: createEmptyTierRecord(companionTierItems) as Record<CompanionId, number>,
    });
  }, []);

  return {
    materialInventory: state.materialInventory,
    setMaterials,
    constructedBuildings: state.constructedBuildings,
    plantedFarms: state.plantedFarms,
    completedResearch: state.completedResearch,
    bondedCompanions: state.bondedCompanions,
    effects,
    addMaterials,
    constructBuilding,
    plantFarm,
    completeResearch,
    bondCompanion,
    triggerFarmYield,
    reset,
  };
}
