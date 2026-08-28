import { describe, expect, it } from "vitest";
import {
  createBossRewardState,
  createCombatRewardState,
  createWildwoodRewardState,
} from "@/features/alchemy/run-loop/navigation/reward-flow";
import { getStartingDeck, trinketLibrary } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { gearDefinitions, uniqueItemList } from "@/lib/gear";

describe("reward flow selection", () => {
  describe("createWildwoodRewardState", () => {
    it("rolls card rewards at the low third", () => {
      const result = createWildwoodRewardState(getStartingDeck("knight"), () => 0.1);
      expect(result.rewardType).toBe("card");
      expect(result.choices).toHaveLength(3);
      expect(result.gold).toBe(0);
      expect(result.materials).toEqual(emptyInventory());
    });

    it("rolls boon rewards in the middle third", () => {
      const result = createWildwoodRewardState(getStartingDeck("knight"), () => 0.5);
      expect(result.rewardType).toBe("boon");
      expect(result.choices).toHaveLength(3);
    });

    it("rolls gear rewards in the high third", () => {
      const result = createWildwoodRewardState(getStartingDeck("knight"), () => 0.9);
      expect(result.rewardType).toBe("gear");
      expect(result.choices).toHaveLength(3);
      expect(result.choices.every((choice) => "instanceId" in choice)).toBe(true);
    });
  });

  describe("createBossRewardState", () => {
    it("creates gear reward with summed gold", () => {
      const result = createBossRewardState({
        gold: 10,
        bossBonus: 5,
        generousBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        trinketIds: [],
        rng: () => 0.99,
      });
      expect(result.rewardType).toBe("gear");
      expect(result.gold).toBe(17);
      expect(result.choices.length).toBeGreaterThan(0);
      expect(result.choices.every((choice) => "instanceId" in choice)).toBe(true);
    });

    it("handles zero bonuses", () => {
      const result = createBossRewardState({
        gold: 0,
        bossBonus: 0,
        generousBonus: 0,
        talentGoldPerCombat: 0,
        materials: emptyInventory(),
        trinketIds: [],
        rng: () => 0.5,
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
        rng: () => 0.5,
      });
      expect(result.gold).toBe(34);
    });

    it("degrades unique rolls to astral when every unique is owned", () => {
      const ownedUniqueIds = new Set(uniqueItemList.map((unique) => unique.id));
      const result = createBossRewardState({
        gold: 10,
        bossBonus: 5,
        generousBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        trinketIds: [],
        ownedTrinketIds: trinketLibrary.map((entry) => entry.id),
        ownedUniqueIds,
        rng: () => 0,
      });
      expect(result.rewardType).toBe("gear");
      if (result.rewardType !== "gear") throw new Error("expected gear reward");
      for (const choice of result.choices) {
        expect(ownedUniqueIds.has(choice.definitionId)).toBe(false);
        expect(gearDefinitions[choice.definitionId]?.rarity).toBe("astral");
      }
    });

    it("goldMultiplier defaults to 1 for boss rewards", () => {
      const result = createBossRewardState({
        gold: 10,
        bossBonus: 5,
        generousBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        trinketIds: [],
        rng: () => 0.5,
      });
      expect(result.gold).toBe(17);
    });

    it("replaces boss gear with a permanent Trinket below the boss gate chance", () => {
      const result = createBossRewardState({
        gold: 10,
        bossBonus: 5,
        generousBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        trinketIds: [],
        ownedTrinketIds: [],
        rng: () => 0,
      });
      expect(result.rewardType).toBe("trinket");
      expect(result.choices.length).toBeGreaterThan(0);
    });

    it("keeps boss gear when the Trinket roll misses", () => {
      const result = createBossRewardState({
        gold: 10,
        bossBonus: 5,
        generousBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        trinketIds: [],
        ownedTrinketIds: [],
        rng: () => 0.5,
      });
      expect(result.rewardType).toBe("gear");
    });
  });

  describe("permanent Trinket gate on Wildwood gear", () => {
    it("replaces Wildwood gear with a permanent Trinket below the normal gate chance", () => {
      let call = 0;
      const rng = () => {
        call += 1;

        return call === 1 ? 0.9 : 0.1;
      };
      const result = createWildwoodRewardState(getStartingDeck("knight"), rng, 0, [], []);
      expect(result.rewardType).toBe("trinket");
    });

    it("keeps Wildwood gear when the Trinket roll misses", () => {
      const result = createWildwoodRewardState(getStartingDeck("knight"), () => 0.9);
      expect(result.rewardType).toBe("gear");
    });
  });

  describe("createCombatRewardState", () => {
    const baseState = { currentEnemy: { enemyType: "normal" }, gold: 15 } as const;

    it("offers card rewards for normal enemies", () => {
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
        rng: () => 0.5,
      });
      expect(result.rewardType).toBe("card");
      expect(result.gold).toBe(15);
      expect(result.choices.length).toBeGreaterThan(0);
    });

    it("always offers boon rewards for elite enemies", () => {
      const eliteState = { currentEnemy: { enemyType: "elite" }, gold: 10 } as const;
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
        rng: () => 0.5,
      });
      expect(result.rewardType).toBe("boon");
      expect(result.gold).toBe(17);
    });

    it("includes destinations in result", () => {
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
        rng: () => 0.5,
      });
      expect(result.destinations).toEqual(["Normal Combat", "Mystery"]);
    });

    it("applies goldMultiplier to combat reward gold", () => {
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
        rng: () => 0.5,
      });
      expect(result.gold).toBe(23);
    });

    it("goldMultiplier defaults to 1 for combat rewards", () => {
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
        rng: () => 0.5,
      });
      expect(result.gold).toBe(15);
    });
  });
});
