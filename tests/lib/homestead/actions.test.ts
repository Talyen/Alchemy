import { describe, expect, it, vi } from "vitest";
import {
  bondCompanion,
  completeResearch,
  constructBuilding,
  plantFarm,
  pruneUnknownCompanions,
  resetHomestead,
} from "@/features/alchemy/shared/stores/commands/homestead-actions";
import { emptyInventory } from "@/lib/homestead/inventory";
import { createInitialPermanentFields } from "@/features/alchemy/shared/stores/session/run-state-init";
import * as errorLogger from "@/lib/error-logger";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { companionTierItems } from "@/lib/homestead/companions";
import type { CompanionId } from "@/lib/game-data";

describe("homestead-actions", () => {
  it.each([1, 2, 3, 4])("refunds every purchased cost through tier %i exactly once", (tier) => {
    const profile = createInitialPermanentFields();
    const stockpile = { wood: 10000, stone: 10000, iron: 10000, food: 10000, herbs: 10000, hide: 10000, gems: 10000 };
    profile.materialInventory = { ...stockpile };
    for (let level = 0; level < tier; level++) {
      for (const item of buildings) expect(constructBuilding(profile, item.id)).toBe(true);
      for (const item of farmPlots) expect(plantFarm(profile, item.id)).toBe(true);
      for (const item of researchUpgrades) expect(completeResearch(profile, item.id)).toBe(true);
      if (level < 3) for (const item of companionTierItems) expect(bondCompanion(profile, item.id)).toBe(true);
    }
    const gold = profile.gold;
    expect(resetHomestead(profile)).toBe(true);
    expect(profile.materialInventory).toEqual(stockpile);
    expect(profile.gold).toBe(gold);
    expect(profile.constructedBuildings).toEqual(createInitialPermanentFields().constructedBuildings);
    expect(profile.plantedFarms).toEqual(createInitialPermanentFields().plantedFarms);
    expect(profile.completedResearch).toEqual(createInitialPermanentFields().completedResearch);
    expect(profile.bondedCompanions).toEqual(createInitialPermanentFields().bondedCompanions);
    expect(profile.effects).toEqual(createInitialPermanentFields().effects);
    const after = structuredClone(profile);
    expect(resetHomestead(profile)).toBe(false);
    expect(profile).toEqual(after);
  });

  it("pruneUnknownCompanions filters unknown companions and logs error", () => {
    const logSpy = vi.spyOn(errorLogger, "logError").mockImplementation(() => {});
    const corrupted = JSON.parse('{"wolf":2,"unknownCompanion":3,"toString":4,"__proto__":5}') as Record<
      CompanionId,
      number
    >;
    const before = structuredClone(corrupted);

    const result = pruneUnknownCompanions(corrupted);
    expect(result).toEqual({ wolf: 2 });
    expect(logSpy).toHaveBeenCalledWith(
      "Removed companions missing from catalog",
      "other",
      expect.objectContaining({ removed: ["unknownCompanion", "toString", "__proto__"] }),
    );
    expect(corrupted).toEqual(before);
    logSpy.mockRestore();
  });

  describe("constructBuilding", () => {
    it("fails when inventory cannot afford building cost", () => {
      const profile = createInitialPermanentFields();
      profile.materialInventory = emptyInventory();
      const before = structuredClone(profile);
      expect(constructBuilding(profile, "blacksmiths-forge")).toBe(false);
      expect(profile).toEqual(before);
    });

    it("upgrades building, deducts cost, and updates computed effects", () => {
      const profile = createInitialPermanentFields();
      profile.materialInventory = { ...emptyInventory(), iron: 50, stone: 50 };

      const success = constructBuilding(profile, "blacksmiths-forge");
      expect(success).toBe(true);
      expect(profile.constructedBuildings["blacksmiths-forge"]).toBe(1);
      expect(profile.materialInventory.iron).toBe(39);
      expect(profile.materialInventory.stone).toBe(46);
      expect(profile.effects.flatPhysicalDamage).toBe(1);
      expect(profile.effects.homesteadForgeBurnPercent).toBe(10);
    });

    it("fails when attempting to upgrade past max tier", () => {
      const profile = createInitialPermanentFields();
      profile.constructedBuildings["blacksmiths-forge"] = 4;
      profile.materialInventory = { ...emptyInventory(), iron: 1000, stone: 1000 };

      const before = structuredClone(profile);
      expect(constructBuilding(profile, "blacksmiths-forge")).toBe(false);
      expect(profile).toEqual(before);
    });
  });

  describe("plantFarm and completeResearch", () => {
    it("upgrades farm and recomputes effects", () => {
      const profile = createInitialPermanentFields();
      profile.materialInventory = { ...emptyInventory(), food: 100 };

      const success = plantFarm(profile, "wheat-field");
      expect(success).toBe(true);
      expect(profile.plantedFarms["wheat-field"]).toBe(1);
      expect(profile.effects.foodFindBonus).toBe(0.1);
      expect(profile.effects.healthRestorePerCombat).toBe(1);
    });

    it("completes research and updates computed effects", () => {
      const profile = createInitialPermanentFields();
      profile.materialInventory = { ...emptyInventory(), gems: 100 };

      const success = completeResearch(profile, "leyline-energy");
      expect(success).toBe(true);
      expect(profile.completedResearch["leyline-energy"]).toBe(1);
      expect(profile.effects.homesteadFreeManaChance).toBe(5);
    });
  });

  describe("bondCompanion", () => {
    it("bonds companion, deducts food, and updates companionBondLevels", () => {
      const profile = createInitialPermanentFields();
      profile.materialInventory = { ...emptyInventory(), food: 50 };

      const success = bondCompanion(profile, "wolf");
      expect(success).toBe(true);
      expect(profile.bondedCompanions.wolf).toBe(1);
      expect(profile.effects.companionBondLevels.wolf).toBe(1);
      expect(profile.materialInventory.food).toBe(40);
    });

    it("fails when food is insufficient", () => {
      const profile = createInitialPermanentFields();
      profile.materialInventory = emptyInventory();

      const success = bondCompanion(profile, "wolf");
      expect(success).toBe(false);
      expect(profile.bondedCompanions.wolf).toBe(0);
    });
  });
});
