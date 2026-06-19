import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { CompanionId } from "@/lib/game-data";
import type { BuildingId, FarmId, MaterialInventory, ResearchId, HomesteadEffectManifest } from "@/lib/homestead/types";
import { emptyInventory, addInventory, subtractInventory, canAfford } from "@/lib/homestead/inventory";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import { companionTierItems, COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "@/lib/homestead/companions";

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
  return computeHomesteadEffects(
    state.constructedBuildings,
    state.plantedFarms,
    state.completedResearch,
    state.bondedCompanions,
  );
}

type TieredUpgradeItem = { tiers: { cost: MaterialInventory }[] };

function tryUpgradeTierItem(
  item: TieredUpgradeItem | undefined,
  currentLevel: number,
  inventory: MaterialInventory,
): { ok: boolean; inventory: MaterialInventory; nextLevel: number } {
  if (!item || currentLevel >= item.tiers.length) {
    return { ok: false, inventory, nextLevel: currentLevel };
  }
  const tier = item.tiers[currentLevel]!;
  if (!canAfford(inventory, tier.cost)) {
    return { ok: false, inventory, nextLevel: currentLevel };
  }
  return {
    ok: true,
    inventory: subtractInventory(inventory, tier.cost),
    nextLevel: currentLevel + 1,
  };
}

export const useHomesteadStore = create<HomesteadStore>()(
  immer((set) => ({
    materialInventory: emptyInventory(),
    constructedBuildings: createEmptyTierRecord(buildings),
    plantedFarms: createEmptyTierRecord(farmPlots),
    completedResearch: createEmptyTierRecord(researchUpgrades),
    bondedCompanions: createEmptyTierRecord(companionTierItems) as Record<CompanionId, number>,
    effects: { ...defaultHomesteadEffects },

    addMaterials: (materials) =>
      set((s) => {
        s.materialInventory = addInventory(s.materialInventory, materials);
      }),

    setMaterials: (materials) =>
      set((s) => {
        s.materialInventory = materials;
      }),

    constructBuilding: (id) => {
      let succeeded = false;
      set((s) => {
        const currentLevel = s.constructedBuildings[id] ?? 0;
        const result = tryUpgradeTierItem(
          buildings.find((b) => b.id === id),
          currentLevel,
          s.materialInventory,
        );
        if (!result.ok) return;
        succeeded = true;
        s.materialInventory = result.inventory;
        s.constructedBuildings[id] = result.nextLevel;
        s.effects = computeEffects(s);
      });
      return succeeded;
    },

    plantFarm: (id) => {
      let succeeded = false;
      set((s) => {
        const currentLevel = s.plantedFarms[id] ?? 0;
        const result = tryUpgradeTierItem(
          farmPlots.find((f) => f.id === id),
          currentLevel,
          s.materialInventory,
        );
        if (!result.ok) return;
        succeeded = true;
        s.materialInventory = result.inventory;
        s.plantedFarms[id] = result.nextLevel;
        s.effects = computeEffects(s);
      });
      return succeeded;
    },

    completeResearch: (id) => {
      let succeeded = false;
      set((s) => {
        const currentLevel = s.completedResearch[id] ?? 0;
        const result = tryUpgradeTierItem(
          researchUpgrades.find((r) => r.id === id),
          currentLevel,
          s.materialInventory,
        );
        if (!result.ok) return;
        succeeded = true;
        s.materialInventory = result.inventory;
        s.completedResearch[id] = result.nextLevel;
        s.effects = computeEffects(s);
      });
      return succeeded;
    },

    bondCompanion: (id) => {
      let succeeded = false;
      set((s) => {
        const currentLevel = s.bondedCompanions[id] ?? 0;
        if (currentLevel >= COMPANION_MAX_TIER) return;
        const cost = COMPANION_BOND_TIERS[currentLevel]!;
        if (!canAfford(s.materialInventory, cost)) return;
        succeeded = true;
        s.materialInventory = subtractInventory(s.materialInventory, cost);
        s.bondedCompanions[id] = currentLevel + 1;
        s.effects = computeEffects(s);
      });
      return succeeded;
    },

    reset: () =>
      set((s) => {
        s.materialInventory = emptyInventory();
        s.constructedBuildings = createEmptyTierRecord(buildings);
        s.plantedFarms = createEmptyTierRecord(farmPlots);
        s.completedResearch = createEmptyTierRecord(researchUpgrades);
        s.bondedCompanions = createEmptyTierRecord(companionTierItems) as Record<CompanionId, number>;
        s.effects = computeEffects(s);
      }),

    initialize: (initial) =>
      set((s) => {
        Object.assign(s, initial);
        s.effects = computeEffects(s);
      }),
  })),
);
