import { describe, expect, it, beforeEach } from "vitest";
import { useHomesteadStore } from "@/features/alchemy/shared/stores/homestead-store";
import { emptyInventory } from "@/lib/homestead/inventory";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import type { BuildingId, FarmId, ResearchId, MaterialInventory } from "@/lib/homestead/types";
import type { CompanionId } from "@/lib/game-data";

beforeEach(() => {
  useHomesteadStore.setState(useHomesteadStore.getInitialState());
});

function seedInventory(mats: Partial<MaterialInventory>) {
  useHomesteadStore.setState((s) => ({
    materialInventory: { ...s.materialInventory, ...mats },
  }));
}

describe("initial state", () => {
  it("starts with empty inventory", () => {
    expect(useHomesteadStore.getState().materialInventory).toEqual(emptyInventory());
  });

  it("starts with default effects", () => {
    expect(useHomesteadStore.getState().effects).toEqual(defaultHomesteadEffects);
  });

  it("has building tiers at 0", () => {
    const buildings = useHomesteadStore.getState().constructedBuildings;
    expect(Object.keys(buildings).length).toBeGreaterThan(0);
    for (const level of Object.values(buildings)) {
      expect(level).toBe(0);
    }
  });

  it("has farm tiers at 0", () => {
    const farms = useHomesteadStore.getState().plantedFarms;
    expect(Object.keys(farms).length).toBeGreaterThan(0);
    for (const level of Object.values(farms)) {
      expect(level).toBe(0);
    }
  });

  it("has research tiers at 0", () => {
    const research = useHomesteadStore.getState().completedResearch;
    expect(Object.keys(research).length).toBeGreaterThan(0);
    for (const level of Object.values(research)) {
      expect(level).toBe(0);
    }
  });
});

describe("addMaterials", () => {
  it("adds materials to inventory", () => {
    seedInventory({ wood: 10, iron: 5 });
    useHomesteadStore.getState().addMaterials({ wood: 3, iron: 2, herbs: 0, food: 0, crystal: 0 });
    expect(useHomesteadStore.getState().materialInventory.wood).toBe(13);
    expect(useHomesteadStore.getState().materialInventory.iron).toBe(7);
  });

  it("recomputes effects after adding materials", () => {
    const prev = useHomesteadStore.getState().effects;
    useHomesteadStore.getState().addMaterials({ wood: 1, iron: 0, herbs: 0, food: 0, crystal: 0 });
    expect(useHomesteadStore.getState().effects).toEqual(prev);
  });
});

describe("setMaterials", () => {
  it("replaces the entire inventory", () => {
    const newInv = { wood: 99, iron: 99, herbs: 99, food: 99, crystal: 99 };
    useHomesteadStore.getState().setMaterials(newInv);
    expect(useHomesteadStore.getState().materialInventory).toEqual(newInv);
  });
});

describe("constructBuilding", () => {
  it("returns false when building not found", () => {
    expect(useHomesteadStore.getState().constructBuilding("nonexistent" as BuildingId)).toBe(false);
  });

  it("returns false when at max tier", () => {
    const buildings = useHomesteadStore.getState().constructedBuildings;
    const firstBuilding = Object.keys(buildings)[0] as BuildingId;
    useHomesteadStore.setState((s) => ({
      constructedBuildings: { ...s.constructedBuildings, [firstBuilding]: 99 },
    }));
    expect(useHomesteadStore.getState().constructBuilding(firstBuilding)).toBe(false);
  });

  it("returns false when cannot afford", () => {
    seedInventory({ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 });
    const buildings = useHomesteadStore.getState().constructedBuildings;
    const firstBuilding = Object.keys(buildings)[0] as BuildingId;
    expect(useHomesteadStore.getState().constructBuilding(firstBuilding)).toBe(false);
  });

  it("returns true and increments level on success", () => {
    seedInventory({ wood: 999, iron: 999, herbs: 999, food: 999, crystal: 999 });
    const buildings = useHomesteadStore.getState().constructedBuildings;
    const firstBuilding = Object.keys(buildings).find(
      (id) => (useHomesteadStore.getState().constructedBuildings[id as BuildingId] ?? 0) === 0,
    ) as BuildingId;
    const result = useHomesteadStore.getState().constructBuilding(firstBuilding);
    expect(result).toBe(true);
    expect(useHomesteadStore.getState().constructedBuildings[firstBuilding]).toBe(1);
  });

  it("subtracts cost from inventory", () => {
    seedInventory({ wood: 999, iron: 999, herbs: 999, food: 999, crystal: 999 });
    const buildings = useHomesteadStore.getState().constructedBuildings;
    const firstBuilding = Object.keys(buildings).find(
      (id) => (useHomesteadStore.getState().constructedBuildings[id as BuildingId] ?? 0) === 0,
    ) as BuildingId;
    const beforeIron = useHomesteadStore.getState().materialInventory.iron;
    const result = useHomesteadStore.getState().constructBuilding(firstBuilding);
    expect(result).toBe(true);
    expect(useHomesteadStore.getState().materialInventory.iron).toBeLessThan(beforeIron);
  });
});

describe("plantFarm", () => {
  it("returns false when farm not found", () => {
    expect(useHomesteadStore.getState().plantFarm("nonexistent" as FarmId)).toBe(false);
  });

  it("returns true and increments level on success", () => {
    seedInventory({ wood: 999, iron: 999, herbs: 999, food: 999, crystal: 999 });
    const farms = useHomesteadStore.getState().plantedFarms;
    const firstFarm = Object.keys(farms).find(
      (id) => (useHomesteadStore.getState().plantedFarms[id as FarmId] ?? 0) === 0,
    ) as FarmId;
    const result = useHomesteadStore.getState().plantFarm(firstFarm);
    expect(result).toBe(true);
    expect(useHomesteadStore.getState().plantedFarms[firstFarm]).toBe(1);
  });
});

describe("completeResearch", () => {
  it("returns false when research not found", () => {
    expect(useHomesteadStore.getState().completeResearch("nonexistent" as ResearchId)).toBe(false);
  });

  it("returns true and increments level on success", () => {
    seedInventory({ wood: 999, iron: 999, herbs: 999, food: 999, crystal: 999 });
    const research = useHomesteadStore.getState().completedResearch;
    const firstResearch = Object.keys(research).find(
      (id) => (useHomesteadStore.getState().completedResearch[id as ResearchId] ?? 0) === 0,
    ) as ResearchId;
    const result = useHomesteadStore.getState().completeResearch(firstResearch);
    expect(result).toBe(true);
    expect(useHomesteadStore.getState().completedResearch[firstResearch]).toBe(1);
  });
});

describe("bondCompanion", () => {
  it("returns false when at max tier", () => {
    useHomesteadStore.setState((s) => ({
      bondedCompanions: { ...s.bondedCompanions, wolf: 99 },
    }));
    expect(useHomesteadStore.getState().bondCompanion("wolf")).toBe(false);
  });

  it("returns false when cannot afford", () => {
    seedInventory({ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 });
    expect(useHomesteadStore.getState().bondCompanion("wolf")).toBe(false);
  });

  it("returns true and increments bond level on success", () => {
    seedInventory({ wood: 0, iron: 0, herbs: 0, food: 999, crystal: 0 });
    const result = useHomesteadStore.getState().bondCompanion("wolf");
    expect(result).toBe(true);
    expect(useHomesteadStore.getState().bondedCompanions.wolf).toBe(1);
  });
});

describe("reset", () => {
  it("resets all state to empty defaults", () => {
    seedInventory({ wood: 99, iron: 99, herbs: 99, food: 99, crystal: 99 });
    useHomesteadStore.getState().reset();
    expect(useHomesteadStore.getState().materialInventory).toEqual(emptyInventory());
    expect(useHomesteadStore.getState().effects).toEqual(defaultHomesteadEffects);
    for (const level of Object.values(useHomesteadStore.getState().constructedBuildings)) {
      expect(level).toBe(0);
    }
  });
});

describe("initialize", () => {
  it("loads saved state and recomputes effects", () => {
    const saved = {
      materialInventory: { wood: 10, iron: 5, herbs: 2, food: 3, crystal: 1 },
      constructedBuildings: {} as Record<BuildingId, number>,
      plantedFarms: {} as Record<FarmId, number>,
      completedResearch: {} as Record<ResearchId, number>,
      bondedCompanions: {} as Record<CompanionId, number>,
    };
    useHomesteadStore.getState().initialize(saved);
    expect(useHomesteadStore.getState().materialInventory.wood).toBe(10);
    expect(useHomesteadStore.getState().effects).toEqual(defaultHomesteadEffects);
  });
});
