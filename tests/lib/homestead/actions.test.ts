import { describe, expect, it, vi } from "vitest";
import {
  bondCompanion,
  completeResearch,
  constructBuilding,
  plantFarm,
  pruneUnknownCompanions,
} from "@/features/alchemy/shared/stores/homestead-actions";
import { emptyInventory } from "@/lib/homestead/inventory";
import { createInitialPermanentFields } from "@/features/alchemy/shared/stores/run-state-init";
import * as errorLogger from "@/lib/error-logger";
import type { CompanionId } from "@/lib/game-data";

describe("homestead-actions", () => {
  describe("pruneUnknownCompanions", () => {
    it("filters unknown companions and logs error", () => {
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
      expect(profile.materialInventory.iron).toBe(28);
      expect(profile.materialInventory.stone).toBe(42);
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
      expect(profile.effects.endRunFoodPerRoom).toBe(2);
      expect(profile.effects.cardHealBonus.bread).toBe(2);
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
      expect(profile.materialInventory.food).toBe(30);
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
