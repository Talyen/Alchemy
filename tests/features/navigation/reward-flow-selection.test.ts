import { describe, expect, it, vi } from "vitest";
import {
  createBossRewardState,
  createCombatRewardState,
  createWildwoodRewardState,
} from "@/features/alchemy/run-loop/navigation/reward-flow";
import { getStartingDeck } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";

describe("reward flow selection", () => {
  describe("createWildwoodRewardState", () => {
    it("uses an exact half roll for three card choices", () => {
      const result = createWildwoodRewardState(getStartingDeck("knight"), () => 0.5);
      expect(result.rewardType).toBe("card");
      expect(result.choices).toHaveLength(3);
      expect(result.gold).toBe(0);
      expect(result.materials).toEqual(emptyInventory());
    });

    it("uses an exact half roll for three boon choices", () => {
      const result = createWildwoodRewardState(getStartingDeck("knight"), () => 0.49);
      expect(result.rewardType).toBe("trinket");
      expect(result.choices).toHaveLength(3);
    });
  });

  describe("createBossRewardState", () => {
    it("creates boon reward with summed gold", () => {
      const result = createBossRewardState({
        gold: 10,
        bossBonus: 5,
        generousBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        trinketIds: [],
        rng: () => 0.99,
      });
      expect(result.rewardType).toBe("trinket");
      expect(result.gold).toBe(17);
      expect(result.choices.length).toBeGreaterThan(0);
      expect(result.choices.every((choice) => "id" in choice && "title" in choice)).toBe(true);
    });

    it("handles zero bonuses", () => {
      const result = createBossRewardState({
        gold: 0,
        bossBonus: 0,
        generousBonus: 0,
        talentGoldPerCombat: 0,
        materials: emptyInventory(),
        trinketIds: [],
      });
      expect(result.gold).toBe(0);
      expect(result.choices.length).toBeGreaterThan(0);
    });

    it("applies goldMultiplier to boss reward gold", () => {
      const result = createBossRewardState({
        gold: 10,
        bossBonus: 5,
        generousBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        trinketIds: [],
        goldMultiplier: 2,
      });
      expect(result.gold).toBe(34);
    });

    it("goldMultiplier defaults to 1 for boss rewards", () => {
      const result = createBossRewardState({
        gold: 10,
        bossBonus: 5,
        generousBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        trinketIds: [],
      });
      expect(result.gold).toBe(17);
    });
  });

  describe("createCombatRewardState", () => {
    const baseState = { currentEnemy: { enemyType: "normal" }, gold: 15 } as const;

    it("offers card rewards when random exceeds boon chance", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const result = createCombatRewardState({
        battleState: baseState as never,
        runDeck: [],
        gold: 10,
        eliteBonus: 3,
        generousBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        destinations: ["Campfire"],
        trinketIds: [],
      });
      expect(result.rewardType).toBe("card");
      expect(result.gold).toBe(15);
      expect(result.choices.length).toBeGreaterThan(0);
      vi.restoreAllMocks();
    });

    it("high elite boon chance offers boons for elite enemies", () => {
      const eliteState = { currentEnemy: { enemyType: "elite" }, gold: 10 } as const;
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const result = createCombatRewardState({
        battleState: eliteState as never,
        runDeck: [],
        gold: 10,
        eliteBonus: 5,
        generousBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        destinations: [],
        trinketIds: [],
      });
      expect(result.rewardType).toBe("trinket");
      expect(result.gold).toBe(17);
      vi.restoreAllMocks();
    });

    it("includes destinations in result", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const result = createCombatRewardState({
        battleState: baseState as never,
        runDeck: [],
        gold: 0,
        eliteBonus: 0,
        generousBonus: 0,
        talentGoldPerCombat: 0,
        materials: emptyInventory(),
        destinations: ["Normal Combat", "Mystery"],
        trinketIds: [],
      });
      expect(result.destinations).toEqual(["Normal Combat", "Mystery"]);
      vi.restoreAllMocks();
    });

    it("applies goldMultiplier to combat reward gold", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const result = createCombatRewardState({
        battleState: baseState as never,
        runDeck: [],
        gold: 10,
        eliteBonus: 3,
        generousBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        destinations: [],
        trinketIds: [],
        goldMultiplier: 1.5,
      });
      expect(result.gold).toBe(22);
      vi.restoreAllMocks();
    });

    it("goldMultiplier defaults to 1 for combat rewards", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const result = createCombatRewardState({
        battleState: baseState as never,
        runDeck: [],
        gold: 10,
        eliteBonus: 3,
        generousBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        destinations: [],
        trinketIds: [],
      });
      expect(result.gold).toBe(15);
      vi.restoreAllMocks();
    });

    it("trinket-hoarder trait adds +10pp boon chance", () => {
      const goblinState = {
        currentEnemy: {
          enemyType: "normal",
          traits: [{ id: "trinket-hoarder", title: "Trinket Hoarder", description: "" }],
        },
        gold: 10,
      } as const;
      vi.spyOn(Math, "random").mockReturnValue(0.15);
      const result = createCombatRewardState({
        battleState: goblinState as never,
        runDeck: [],
        gold: 10,
        eliteBonus: 3,
        generousBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        destinations: [],
        trinketIds: [],
      });
      expect(result.rewardType).toBe("trinket");
      vi.restoreAllMocks();
    });
  });
});
