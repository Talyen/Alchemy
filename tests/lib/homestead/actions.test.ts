import { describe, expect, it, vi } from "vitest";
import {
  addMaterials,
  bondCompanion,
  completeResearch,
  constructBuilding,
  plantFarm,
  pruneUnknownCompanions,
  setMaterials,
} from "@/features/alchemy/shared/stores/homestead-actions";
import { emptyInventory } from "@/lib/homestead/inventory";
import { createInitialPermanentFields } from "@/features/alchemy/shared/stores/run-state-init";
import * as errorLogger from "@/lib/error-logger";
import type { CompanionId } from "@/lib/game-data";

describe("homestead-actions", () => {
  describe("pruneUnknownCompanions", () => {
    it("returns original record when all companion IDs are known", () => {
      const companions = { wolf: 2, phoenix: 1 } as Record<CompanionId, number>;
      const result = pruneUnknownCompanions(companions);
      expect(result).toEqual(companions);
    });

    it("filters unknown companions and logs error", () => {
      const logSpy = vi.spyOn(errorLogger, "logError").mockImplementation(() => {});
      const corrupted = { wolf: 2, unknownCompanion: 3 } as any;

      const result = pruneUnknownCompanions(corrupted);
      expect(result).toEqual({ wolf: 2 });
      expect(logSpy).toHaveBeenCalledWith(
        "Removed companions missing from catalog",
        "other",
        expect.objectContaining({ removed: ["unknownCompanion"] }),
      );
      logSpy.mockRestore();
    });
  });

  describe("addMaterials and setMaterials", () => {
    it("adds materials to profile", () => {
      const profile = createInitialPermanentFields();
      addMaterials(profile, { ...emptyInventory(), wood: 5, iron: 10 });
      expect(profile.materialInventory.wood).toBe(5);
      expect(profile.materialInventory.iron).toBe(10);
    });

    it("sets materials on profile directly", () => {
      const profile = createInitialPermanentFields();
      setMaterials(profile, { ...emptyInventory(), gems: 99 });
      expect(profile.materialInventory.gems).toBe(99);
      expect(profile.materialInventory.wood).toBe(0);
    });
  });

  describe("constructBuilding", () => {
    it("fails when inventory cannot afford building cost", () => {
      const profile = createInitialPermanentFields();
      profile.materialInventory = emptyInventory();
      const success = constructBuilding(profile, "blacksmiths-forge");
      expect(success).toBe(false);
      expect(profile.constructedBuildings["blacksmiths-forge"]).toBe(0);
    });

    it("upgrades building, deducts cost, and updates computed effects", () => {
      const profile = createInitialPermanentFields();
      profile.materialInventory = { ...emptyInventory(), iron: 50 };

      const success = constructBuilding(profile, "blacksmiths-forge");
      expect(success).toBe(true);
      expect(profile.constructedBuildings["blacksmiths-forge"]).toBe(1);
      expect(profile.materialInventory.iron).toBe(30);
      expect(profile.effects.flatPhysicalDamage).toBe(1);
      expect(profile.effects.forgeToBurn).toBe(true);
    });

    it("fails when attempting to upgrade past max tier", () => {
      const profile = createInitialPermanentFields();
      profile.constructedBuildings["blacksmiths-forge"] = 3;
      profile.materialInventory = { ...emptyInventory(), iron: 1000 };

      const success = constructBuilding(profile, "blacksmiths-forge");
      expect(success).toBe(false);
      expect(profile.constructedBuildings["blacksmiths-forge"]).toBe(3);
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
      expect(profile.effects.startMana).toBe(1);
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
