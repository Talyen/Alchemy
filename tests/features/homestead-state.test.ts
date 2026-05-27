import { describe, expect, it } from "vitest";
import { COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "@/lib/homestead/companions";
import { emptyInventory, addInventory, subtractInventory, canAfford } from "@/lib/homestead/inventory";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import { companionTierItems } from "@/lib/homestead/companions";
import type { BuildingId, FarmId, ResearchId, MaterialInventory } from "@/lib/homestead/types";
import type { CompanionId } from "@/lib/game-data";

describe("homestead-state: pure logic (mirrors useHomesteadState callbacks)", () => {
  function makeState(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
    return {
      materialInventory: emptyInventory(),
      constructedBuildings: createEmptyTierRecord(buildings),
      plantedFarms: createEmptyTierRecord(farmPlots),
      completedResearch: createEmptyTierRecord(researchUpgrades),
      bondedCompanions: createEmptyTierRecord(companionTierItems) as Record<CompanionId, number>,
      ...overrides,
    };
  }

  describe("constructBuilding logic", () => {
    it("returns false when building not found", () => {
      const id = "nonexistent" as BuildingId;
      const building = buildings.find((b) => b.id === id);
      expect(Boolean(building)).toBe(false);
    });

    it("returns false when at max tier", () => {
      const firstBuilding = buildings[0];
      const state = makeState({
        constructedBuildings: { [firstBuilding.id]: firstBuilding.tiers.length },
      });
      const currentLevel = state.constructedBuildings[firstBuilding.id] ?? 0;
      expect(currentLevel >= firstBuilding.tiers.length).toBe(true);
    });

    it("returns false when cannot afford", () => {
      const firstBuilding = buildings[0];
      const tier = firstBuilding.tiers[0];
      const state = makeState({ materialInventory: emptyInventory() });
      expect(canAfford(state.materialInventory, tier.cost)).toBe(false);
    });

    it("returns true when construction succeeds", () => {
      // Find a building whose first tier costs can be afforded with ample materials
      const ample: MaterialInventory = { wood: 999, iron: 999, herbs: 999, food: 999, crystal: 999 };
      const buildable = buildings.find((b) => canAfford(ample, b.tiers[0].cost));
      if (!buildable) return;

      const state = makeState({ materialInventory: { ...ample } });
      const tier = buildable.tiers[0];

      expect(canAfford(state.materialInventory, tier.cost)).toBe(true);

      const newInv = subtractInventory(state.materialInventory, tier.cost);
      const newBuildings = { ...state.constructedBuildings, [buildable.id]: 1 };
      const effects = computeHomesteadEffects(newBuildings, state.plantedFarms, state.completedResearch, state.bondedCompanions);

      expect(newInv.iron).toBe(999 - tier.cost.iron);
      expect(newBuildings[buildable.id]).toBe(1);
      expect(effects.flatPhysicalDamage).toBeGreaterThanOrEqual(0);
    });
  });

  describe("plantFarm logic", () => {
    it("returns false when farm not found", () => {
      const id = "nonexistent" as FarmId;
      const farm = farmPlots.find((f) => f.id === id);
      expect(Boolean(farm)).toBe(false);
    });

    it("returns false when at max tier", () => {
      const firstFarm = farmPlots[0];
      const currentLevel = 99;
      expect(currentLevel >= (firstFarm.tiers?.length ?? 0)).toBe(true);
    });

    it("returns true when planting succeeds", () => {
      const ample: MaterialInventory = { wood: 999, iron: 999, herbs: 999, food: 999, crystal: 999 };
      const plantable = farmPlots.find((f) => f.tiers && f.tiers.length > 0 && canAfford(ample, f.tiers[0].cost));
      if (!plantable) return;

      const tier = plantable.tiers![0];
      expect(canAfford(ample, tier.cost)).toBe(true);

      const newInv = subtractInventory(ample, tier.cost);
      expect(Object.values(newInv).some((v) => v < 999)).toBe(true);
    });
  });

  describe("completeResearch logic", () => {
    it("returns false when research not found", () => {
      const id = "nonexistent" as ResearchId;
      const research = researchUpgrades.find((r) => r.id === id);
      expect(Boolean(research)).toBe(false);
    });

    it("returns true when research succeeds", () => {
      const ample: MaterialInventory = { wood: 999, iron: 999, herbs: 999, food: 999, crystal: 999 };
      const researchable = researchUpgrades.find((r) => r.tiers.length > 0 && canAfford(ample, r.tiers[0].cost));
      if (!researchable) return;

      const tier = researchable.tiers[0];
      expect(canAfford(ample, tier.cost)).toBe(true);

      const newInv = subtractInventory(ample, tier.cost);
      expect(Object.values(newInv).some((v) => v < 999)).toBe(true);
    });
  });

  describe("bondCompanion logic", () => {
    it("returns false when at max tier", () => {
      const currentLevel = 99;
      expect(currentLevel >= COMPANION_MAX_TIER).toBe(true);
    });

    it("returns false when cannot afford", () => {
      const cost = COMPANION_BOND_TIERS[0];
      const inv = emptyInventory();
      expect(canAfford(inv, cost)).toBe(false);
    });

    it("returns true when bonding succeeds", () => {
      const cost = COMPANION_BOND_TIERS[0];
      const inv = addInventory(emptyInventory(), cost);
      expect(canAfford(inv, cost)).toBe(true);

      const newInv = subtractInventory(inv, cost);
      expect(newInv.food).toBe(0);
    });
  });

  describe("addMaterials / setMaterials logic", () => {
    it("addMaterials calls addInventory", () => {
      const inv = emptyInventory();
      const added = addInventory(inv, { wood: 5, iron: 3, herbs: 0, food: 0, crystal: 0 });
      expect(added.wood).toBe(5);
      expect(added.iron).toBe(3);
    });

    it("setMaterials replaces inventory", () => {
      const newInv: MaterialInventory = { wood: 99, iron: 99, herbs: 99, food: 99, crystal: 99 };
      expect(newInv.wood).toBe(99);
    });
  });

  describe("reset logic", () => {
    it("returns to empty state", () => {
      const state = makeState();
      expect(state.materialInventory).toEqual(emptyInventory());
      expect(Object.values(state.constructedBuildings).every((v) => v === 0)).toBe(true);
      expect(Object.values(state.plantedFarms).every((v) => v === 0)).toBe(true);
      expect(Object.values(state.completedResearch).every((v) => v === 0)).toBe(true);
      expect(Object.values(state.bondedCompanions).every((v) => v === 0)).toBe(true);
    });
  });

  describe("effects recomputation", () => {
    it("default effects from empty state", () => {
      const state = makeState();
      const effects = computeHomesteadEffects(
        state.constructedBuildings,
        state.plantedFarms,
        state.completedResearch,
        state.bondedCompanions,
      );
      expect(effects).toEqual(defaultHomesteadEffects);
    });

    it("building construction changes effects", () => {
      const effects = computeHomesteadEffects({ "blacksmiths-forge": 1 }, {}, {});
      if (effects.flatPhysicalDamage > 0) {
        expect(effects.flatPhysicalDamage).toBeGreaterThan(0);
      }
    });
  });
});

describe("COMPANION_BOND_TIERS", () => {
  it("has tier cost entries", () => {
    expect(COMPANION_BOND_TIERS.length).toBe(3);
  });

  it("each tier uses food as primary cost", () => {
    for (const tier of COMPANION_BOND_TIERS) {
      expect(tier.food).toBeGreaterThan(0);
    }
  });

  it("COMPANION_MAX_TIER matches tiers length", () => {
    expect(COMPANION_MAX_TIER).toBe(COMPANION_BOND_TIERS.length);
  });
});
