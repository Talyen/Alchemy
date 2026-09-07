import { describe, expect, it } from "vitest";
import {
  createBossRewardState,
  createCombatRewardState,
  createWildwoodRewardState,
  computeWildwoodTrinketChance,
  rollBossRewardCategory,
  rollCombatGearRewardRarity,
  rollEncounterRewardCategory,
} from "@/features/alchemy/run-loop/navigation/reward-flow";
import { getStartingDeck, trinketLibrary } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { gearDefinitions, uniqueItemList } from "@/lib/gear";

function sequenceRng(draws: number[], fallback = 0.2): () => number {
  let index = 0;
  return () => draws[index++] ?? fallback;
}

describe("reward flow selection", () => {
  it.each([
    ["normal", 0.55, 0.84, 0.94],
    ["elite", 0.3, 0.73, 0.91],
  ] as const)("preserves %s reward group weights", (enemyType, gear, boon, trinket) => {
    for (const [boundary, before, after] of [
      [gear, "card", "gear"],
      [boon, "gear", "boon"],
      [trinket, "boon", "trinket"],
    ] as const) {
      expect(rollEncounterRewardCategory(enemyType, () => boundary - 1e-10)).toBe(before);
      expect(rollEncounterRewardCategory(enemyType, () => boundary + 1e-10)).toBe(after);
    }
  });

  it.each([
    ["normal", 17 / 29, 24 / 29],
    ["elite", 25 / 43, 35 / 43],
    ["boss", 0, 0.7],
  ] as const)("normalizes %s Gear rarity weights", (enemyType, astral, unique) => {
    expect(rollCombatGearRewardRarity(enemyType, () => 0)).toBe(enemyType === "boss" ? "astral" : "basic");
    if (astral > 0) {
      expect(rollCombatGearRewardRarity(enemyType, () => astral - 1e-10)).toBe("basic");
    }
    expect(rollCombatGearRewardRarity(enemyType, () => astral + 1e-10)).toBe("astral");
    expect(rollCombatGearRewardRarity(enemyType, () => unique - 1e-10)).toBe("astral");
    expect(rollCombatGearRewardRarity(enemyType, () => unique + 1e-10)).toBe("unique");
    expect(rollCombatGearRewardRarity(enemyType, () => 0.999)).toBe("unique");
  });

  it("transfers the Astral bonus before normalizing without increasing Unique odds", () => {
    expect(rollCombatGearRewardRarity("normal", () => 0.5)).toBe("basic");
    expect(rollCombatGearRewardRarity("normal", () => 0.5, 0.05)).toBe("astral");
    expect(rollCombatGearRewardRarity("normal", () => 0, 1)).toBe("astral");
    expect(rollCombatGearRewardRarity("normal", () => 0.5, -1)).toBe("basic");
    expect(rollCombatGearRewardRarity("normal", () => 0.9, 1)).toBe("unique");
    expect(rollCombatGearRewardRarity("elite", () => 0.5, 0.05)).toBe("astral");
    expect(rollCombatGearRewardRarity("boss", () => 0.9, 1)).toBe("unique");
  });

  it("preserves the boss Gear and Trinket group weights", () => {
    expect(rollBossRewardCategory(() => 0)).toBe("gear");
    expect(rollBossRewardCategory(() => 0.7 - 1e-10)).toBe("gear");
    expect(rollBossRewardCategory(() => 0.7 + 1e-10)).toBe("trinket");
  });

  it.each([
    ["normal", 0.6, [0.1, 0.2, 0.7], ["basic", "basic", "astral"]],
    ["elite", 0.4, [0.1, 0.7, 0.9], ["basic", "astral", "unique"]],
    ["boss", 0.1, [0.1, 0.6, 0.9], ["astral", "astral", "unique"]],
    ["normal", 0.6, [0.1, 0.7, 0.9], ["basic", "astral", "unique"]],
  ] as const)(
    "rolls independent %s Gear choices and preserves reward payload",
    (enemyType, groupRoll, rolls, rarities) => {
      const input = {
        gold: 12,
        bossBonus: 0,
        eliteBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
        talentGoldPerCombat: 0,
        materials: { ...emptyInventory(), wood: 2 },
        trinketIds: [],
        rng: sequenceRng([groupRoll, ...rolls]),
      };
      const result =
        enemyType === "boss"
          ? createBossRewardState(input)
          : createCombatRewardState({
              ...input,
              battleState: { currentEnemy: { enemyType } } as never,
              runDeck: [],
              destinations: ["Campfire"],
            });
      expect(result.rewardType).toBe("gear");
      if (result.rewardType !== "gear") throw new Error("expected gear reward");
      expect(result.choices.map((choice) => gearDefinitions[choice.definitionId].rarity)).toEqual(rarities);
      expect(result.gold).toBe(12);
      expect(result.materials.wood).toBe(2);
      if (enemyType !== "boss") expect(result.destinations).toEqual(["Campfire"]);
    },
  );

  it.each(["normal", "elite", "boss"] as const)(
    "rolls exhausted %s Trinket fallback Gear independently",
    (enemyType) => {
      const input = {
        gold: 0,
        bossBonus: 0,
        eliteBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
        talentGoldPerCombat: 0,
        materials: emptyInventory(),
        trinketIds: [],
        ownedTrinketIds: trinketLibrary.map((entry) => entry.id),
        rng: sequenceRng([0.99, 0.01, 0.1, 0.9]),
      };
      const result =
        enemyType === "boss"
          ? createBossRewardState(input)
          : createCombatRewardState({
              ...input,
              battleState: { currentEnemy: { enemyType } } as never,
              runDeck: [],
              destinations: [],
            });
      if (result.rewardType !== "gear") throw new Error("expected gear reward");
      expect(result.choices.map((choice) => gearDefinitions[choice.definitionId].rarity)).toEqual(
        enemyType === "boss" ? ["unique", "unique", "astral"] : ["unique", "astral", "basic"],
      );
    },
  );

  it("reports the effective Wildwood permanent Trinket chance", () => {
    expect(computeWildwoodTrinketChance()).toBeCloseTo(1 / 9);
  });

  describe("createWildwoodRewardState", () => {
    it("falls back to cards when every Boon is excluded", () => {
      const result = createWildwoodRewardState(
        getStartingDeck("knight"),
        () => 0.5,
        0,
        trinketLibrary.map((entry) => entry.id),
      );

      expect(result.rewardType).toBe("card");
      expect(result.choices).toHaveLength(3);
      if (result.rewardType === "card") {
        expect(new Set(result.choices.map((entry) => entry.id)).size).toBe(3);
      }
    });

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
    it.each([
      ["astral", 0.1],
      ["trinket", 0.8],
      ["unique", 0.6],
    ] as const)("offers three choices from the selected boss %s category", (category, roll) => {
      const result = createBossRewardState({
        gold: 10,
        bossBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
        talentGoldPerCombat: 0,
        materials: emptyInventory(),
        trinketIds: [],
        ownedTrinketIds: [],
        rng: sequenceRng([roll], category === "astral" ? 0.7 - 1e-10 : 0.99),
      });

      expect(result.rewardType).toBe(category === "trinket" ? "trinket" : "gear");
      expect(result.choices).toHaveLength(3);
      if (result.rewardType === "gear") {
        expect(result.choices.every((choice) => gearDefinitions[choice.definitionId]?.rarity === category)).toBe(true);
      }
    });

    it("creates gear reward with summed gold", () => {
      const result = createBossRewardState({
        gold: 10,
        bossBonus: 5,
        generousBonus: 0,
        wealthyBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        trinketIds: [],
        rng: sequenceRng([0.1], 0.99),
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
        wealthyBonus: 0,
        talentGoldPerCombat: 0,
        materials: emptyInventory(),
        trinketIds: [],
        rng: () => 0.8,
      });
      expect(result.gold).toBe(0);
      expect(result.choices.length).toBeGreaterThan(0);
    });

    it("applies goldMultiplier to boss reward gold", () => {
      const result = createBossRewardState({
        gold: 10,
        bossBonus: 5,
        generousBonus: 0,
        wealthyBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        trinketIds: [],
        goldMultiplier: 2,
        rng: () => 0.8,
      });
      expect(result.gold).toBe(34);
    });

    it("degrades an unavailable unique category to astral gear", () => {
      const ownedUniqueIds = new Set(uniqueItemList.map((unique) => unique.id));
      const result = createBossRewardState({
        gold: 10,
        bossBonus: 5,
        generousBonus: 0,
        wealthyBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        trinketIds: [],
        ownedTrinketIds: trinketLibrary.map((entry) => entry.id),
        ownedUniqueIds,
        rng: sequenceRng([0.1], 0.9),
      });
      expect(result.rewardType).toBe("gear");
      if (result.rewardType !== "gear") throw new Error("expected gear reward");
      for (const choice of result.choices) {
        expect(ownedUniqueIds.has(choice.definitionId)).toBe(false);
        expect(gearDefinitions[choice.definitionId]?.rarity).toBe("astral");
      }
    });

    it("falls back from an unavailable boss Trinket category to gear", () => {
      const result = createBossRewardState({
        gold: 10,
        bossBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
        talentGoldPerCombat: 0,
        materials: emptyInventory(),
        trinketIds: [],
        ownedTrinketIds: trinketLibrary.map((entry) => entry.id),
        rng: () => 0.8,
      });

      expect(result.rewardType).toBe("gear");
      expect(result.choices).toHaveLength(3);
    });

    it("goldMultiplier defaults to 1 for boss rewards", () => {
      const result = createBossRewardState({
        gold: 10,
        bossBonus: 5,
        generousBonus: 0,
        wealthyBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        trinketIds: [],
        rng: () => 0.8,
      });
      expect(result.gold).toBe(17);
    });

    it("offers the boss Trinket category when its roll lands in range", () => {
      const result = createBossRewardState({
        gold: 10,
        bossBonus: 5,
        generousBonus: 0,
        wealthyBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        trinketIds: [],
        ownedTrinketIds: [],
        rng: () => 0.8,
      });
      expect(result.rewardType).toBe("trinket");
      expect(result.choices.length).toBeGreaterThan(0);
    });

    it("offers gear when the boss roll lands in the Gear group", () => {
      const result = createBossRewardState({
        gold: 10,
        bossBonus: 5,
        generousBonus: 0,
        wealthyBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        trinketIds: [],
        ownedTrinketIds: [],
        rng: sequenceRng([0.1], 0.9),
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
        wealthyBonus: 0,
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

    it.each([
      ["card", 0.1],
      ["basic", 0.6],
      ["boon", 0.88],
      ["astral", 0.7],
      ["trinket", 0.96],
      ["unique", 0.8],
    ] as const)("offers three choices from the selected normal %s category", (category, roll) => {
      const result = createCombatRewardState({
        battleState: baseState as never,
        runDeck: [],
        gold: 10,
        eliteBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
        talentGoldPerCombat: 0,
        materials: emptyInventory(),
        destinations: [],
        trinketIds: [],
        rng: sequenceRng([roll], category === "basic" ? 0.1 : category === "astral" ? 0.7 - 1e-10 : 0.99),
      });

      expect(result.rewardType).toBe(
        category === "basic" || category === "astral" || category === "unique" ? "gear" : category,
      );
      expect(result.choices).toHaveLength(3);
      if (category === "basic" || category === "astral" || category === "unique") {
        if (result.rewardType !== "gear") throw new Error("expected gear reward");
        expect(result.choices.every((choice) => gearDefinitions[choice.definitionId]?.rarity === category)).toBe(true);
      }
    });

    it.each([
      ["card", 0.1],
      ["basic", 0.4],
      ["boon", 0.8],
      ["astral", 0.6],
      ["trinket", 0.95],
      ["unique", 0.7],
    ] as const)("offers three choices from the selected elite %s category", (category, roll) => {
      const result = createCombatRewardState({
        battleState: { currentEnemy: { enemyType: "elite" }, gold: 10 } as never,
        runDeck: [],
        gold: 10,
        eliteBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
        talentGoldPerCombat: 0,
        materials: emptyInventory(),
        destinations: [],
        trinketIds: [],
        rng: sequenceRng([roll], category === "basic" ? 0.1 : category === "astral" ? 0.7 - 1e-10 : 0.99),
      });

      expect(result.rewardType).toBe(
        category === "basic" || category === "astral" || category === "unique" ? "gear" : category,
      );
      expect(result.choices).toHaveLength(3);
      if (category === "basic" || category === "astral" || category === "unique") {
        if (result.rewardType !== "gear") throw new Error("expected gear reward");
        expect(result.choices.every((choice) => gearDefinitions[choice.definitionId]?.rarity === category)).toBe(true);
      }
    });

    it("falls back from an unavailable normal Trinket category to gear", () => {
      const result = createCombatRewardState({
        battleState: baseState as never,
        runDeck: [],
        gold: 10,
        eliteBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
        talentGoldPerCombat: 0,
        materials: emptyInventory(),
        destinations: [],
        trinketIds: [],
        ownedTrinketIds: trinketLibrary.map((entry) => entry.id),
        rng: () => 0.96,
      });

      expect(result.rewardType).toBe("gear");
      expect(result.choices).toHaveLength(3);
    });

    it("falls back from an unavailable boon category to cards", () => {
      const result = createCombatRewardState({
        battleState: baseState as never,
        runDeck: [],
        gold: 10,
        eliteBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
        talentGoldPerCombat: 0,
        materials: emptyInventory(),
        destinations: [],
        trinketIds: [],
        excludedBoonIds: trinketLibrary.map((entry) => entry.id),
        rng: () => 0.88,
      });

      expect(result.rewardType).toBe("card");
      expect(result.choices).toHaveLength(3);
    });

    it("degrades an unavailable unique category to astral gear", () => {
      const result = createCombatRewardState({
        battleState: baseState as never,
        runDeck: [],
        gold: 10,
        eliteBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
        talentGoldPerCombat: 0,
        materials: emptyInventory(),
        destinations: [],
        trinketIds: [],
        ownedUniqueIds: new Set(uniqueItemList.map((unique) => unique.id)),
        rng: sequenceRng([0.6], 0.96),
      });

      expect(result.rewardType).toBe("gear");
      expect(result.choices).toHaveLength(3);
      if (result.rewardType !== "gear") throw new Error("expected gear reward");
      expect(result.choices.every((choice) => gearDefinitions[choice.definitionId]?.rarity === "astral")).toBe(true);
    });

    it("offers boon rewards for elite enemies at the boon threshold", () => {
      const eliteState = { currentEnemy: { enemyType: "elite" }, gold: 10 } as const;
      const result = createCombatRewardState({
        battleState: eliteState as never,
        runDeck: [],
        gold: 10,
        eliteBonus: 5,
        generousBonus: 0,
        wealthyBonus: 0,
        talentGoldPerCombat: 2,
        materials: emptyInventory(),
        destinations: [],
        trinketIds: [],
        rng: () => 0.8,
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
        wealthyBonus: 0,
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
        wealthyBonus: 0,
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
        wealthyBonus: 0,
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
