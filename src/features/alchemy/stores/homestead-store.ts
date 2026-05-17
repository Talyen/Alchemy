import { create } from "zustand";
import type { CompanionId } from "@/lib/game-data";
import { companionLibrary } from "@/lib/game-data";
import type { BuildingId, FarmId, MaterialInventory, ResearchId, HomesteadEffectManifest } from "@/lib/homestead/types";
import { emptyInventory, addInventory, subtractInventory, canAfford } from "@/lib/homestead/inventory";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";

const companionTierItems = Object.keys(companionLibrary).map((id) => ({ id, tiers: [null, null, null] }));

type HomesteadState = {
  materialInventory: MaterialInventory;
  constructedBuildings: Record<BuildingId, number>;
  plantedFarms: Record<FarmId, number>;
  completedResearch: Record<ResearchId, number>;
  bondedCompanions: Record<CompanionId, number>;
};

type HomesteadStore = HomesteadState & {
  effects: HomesteadEffectManifest;
  addMaterials: (materials: MaterialInventory) => void;
  setMaterials: (materials: MaterialInventory) => void;
  constructBuilding: (id: BuildingId) => boolean;
  plantFarm: (id: FarmId) => boolean;
  completeResearch: (id: ResearchId) => boolean;
  bondCompanion: (id: CompanionId) => boolean;
  reset: () => void;
  initialize: (initial: HomesteadState) => void;
};

function computeEffects(state: HomesteadState): HomesteadEffectManifest {
  return computeHomesteadEffects(state.constructedBuildings, state.plantedFarms, state.completedResearch, state.bondedCompanions);
}

export const useHomesteadStore = create<HomesteadStore>()((set) => ({
  materialInventory: emptyInventory(),
  constructedBuildings: createEmptyTierRecord(buildings),
  plantedFarms: createEmptyTierRecord(farmPlots),
  completedResearch: createEmptyTierRecord(researchUpgrades),
  bondedCompanions: createEmptyTierRecord(companionTierItems) as Record<CompanionId, number>,
  effects: {} as HomesteadEffectManifest,

  addMaterials: (materials) =>
    set((s) => {
      const next = { ...s, materialInventory: addInventory(s.materialInventory, materials) };
      return { ...next, effects: computeEffects(next) };
    }),

  setMaterials: (materials) =>
    set((s) => {
      const next = { ...s, materialInventory: materials };
      return { ...next, effects: computeEffects(next) };
    }),

  constructBuilding: (id) => {
    const building = buildings.find((b) => b.id === id);
    const current = useHomesteadStore.getState();
    const currentLevel = current.constructedBuildings[id] ?? 0;
    if (!building || currentLevel >= building.tiers.length) return false;
    const tier = building.tiers[currentLevel];
    if (!canAfford(current.materialInventory, tier.cost)) return false;
    set((s) => {
      const next = {
        ...s,
        materialInventory: subtractInventory(s.materialInventory, tier.cost),
        constructedBuildings: { ...s.constructedBuildings, [id]: currentLevel + 1 },
      };
      return { ...next, effects: computeEffects(next) };
    });
    return true;
  },

  plantFarm: (id) => {
    const farm = farmPlots.find((f) => f.id === id);
    const current = useHomesteadStore.getState();
    const currentLevel = current.plantedFarms[id] ?? 0;
    if (!farm || currentLevel >= farm.tiers.length) return false;
    const tier = farm.tiers[currentLevel];
    if (!canAfford(current.materialInventory, tier.cost)) return false;
    set((s) => {
      const next = {
        ...s,
        materialInventory: subtractInventory(s.materialInventory, tier.cost),
        plantedFarms: { ...s.plantedFarms, [id]: currentLevel + 1 },
      };
      return { ...next, effects: computeEffects(next) };
    });
    return true;
  },

  completeResearch: (id) => {
    const research = researchUpgrades.find((r) => r.id === id);
    const current = useHomesteadStore.getState();
    const currentLevel = current.completedResearch[id] ?? 0;
    if (!research || currentLevel >= research.tiers.length) return false;
    const tier = research.tiers[currentLevel];
    if (!canAfford(current.materialInventory, tier.cost)) return false;
    set((s) => {
      const next = {
        ...s,
        materialInventory: subtractInventory(s.materialInventory, tier.cost),
        completedResearch: { ...s.completedResearch, [id]: currentLevel + 1 },
      };
      return { ...next, effects: computeEffects(next) };
    });
    return true;
  },

  bondCompanion: (id) => {
    const current = useHomesteadStore.getState();
    const currentLevel = current.bondedCompanions[id] ?? 0;
    if (currentLevel >= COMPANION_MAX_TIER) return false;
    const cost = COMPANION_BOND_TIERS[currentLevel];
    if (!canAfford(current.materialInventory, cost)) return false;
    set((s) => {
      const next = {
        ...s,
        materialInventory: subtractInventory(s.materialInventory, cost),
        bondedCompanions: { ...s.bondedCompanions, [id]: currentLevel + 1 },
      };
      return { ...next, effects: computeEffects(next) };
    });
    return true;
  },

  reset: () =>
    set(() => {
      const next = {
        materialInventory: emptyInventory(),
        constructedBuildings: createEmptyTierRecord(buildings),
        plantedFarms: createEmptyTierRecord(farmPlots),
        completedResearch: createEmptyTierRecord(researchUpgrades),
        bondedCompanions: createEmptyTierRecord(companionTierItems) as Record<CompanionId, number>,
      };
      return { ...next, effects: computeEffects(next) };
    }),

  initialize: (initial) =>
    set((s) => ({ ...s, ...initial, effects: computeEffects(initial) })),
}));

export const COMPANION_BOND_TIERS = [
  { wood: 0, iron: 0, herbs: 0, food: 20, crystal: 0 },
  { wood: 0, iron: 0, herbs: 0, food: 30, crystal: 0 },
  { wood: 0, iron: 0, herbs: 0, food: 40, crystal: 0 },
] as const;

export const COMPANION_MAX_TIER = COMPANION_BOND_TIERS.length;
