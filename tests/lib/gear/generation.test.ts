import { resolveLootWeights } from "@/lib/loot";
import { describe, expect, it } from "vitest";
import { GEAR_AFFIX_COUNT, GEAR_AFFIX_COUNT_MIN_WEIGHT } from "@/lib/game-constants";
import {
  generateDevRandomGearInstance,
  generateGearInstanceForBaseItem,
  generateLootGearChoices,
  generateGearRewardChoicesForRarity,
  generateGearRewardChoicesForRarities,
  uniqueItemList,
  gearDefinitions,
  rollAffixCount,
} from "@/lib/gear";
import { buildEligibleAffixPool } from "@/lib/gear/affix-pool";
import { createSeededRng } from "@/lib/rng";

const weights = resolveLootWeights({ source: "equipment", progress: { depth: 24, highestCompletedDifficulty: null } });

describe("gear generation", () => {
  it.each([
    { fillCount: false, nextRandom: 0.19854954350739717 },
    { fillCount: true, nextRandom: 0.4058688203804195 },
  ])("preserves seeded gear and subsequent RNG with fillCount=$fillCount", ({ fillCount, nextRandom }) => {
    const rng = createSeededRng(17);
    const choices = generateLootGearChoices(4, rng, weights, new Set(), ["ruby-ring", "emerald-ring"], fillCount);
    const expected = [
      { definitionId: "ruby-ring-basic", affixes: [{ id: "burn-per-mana", value: 10 }] },
      {
        definitionId: "emerald-ring-astral",
        affixes: [
          { id: "armor-on-nature-card", value: 2 },
          { id: "dodge-armor", value: 3 },
          { id: "archery-ignore-armor", value: 3 },
        ],
      },
      ...(fillCount
        ? [
            { definitionId: "emerald-ring-basic", affixes: [{ id: "archery-ignore-armor", value: 1 }] },
            { definitionId: "emerald-ring-basic", affixes: [{ id: "dodge-chance", value: 2 }] },
          ]
        : []),
    ];
    expect(choices.map(({ definitionId, affixes }) => ({ definitionId, affixes }))).toEqual(expected);
    expect(rng()).toBe(nextRandom);
  });

  it("fills a narrow equipment shelf with ordinary Gear from its allowed bases", () => {
    const choices = generateGearRewardChoicesForRarity(4, "astral", () => 0, new Set(), ["emerald-ring"], true);
    expect(choices).toHaveLength(4);
    expect(choices.every((choice) => gearDefinitions[choice.definitionId].baseItemId === "emerald-ring")).toBe(true);
  });

  it("fills a narrow shelf without pairing a Unique with ordinary Gear of its base", () => {
    const choices = generateLootGearChoices(
      4,
      () => 0.99,
      { ...weights, basic: 0, astral: 1, unique: 100 },
      new Set(),
      ["ruby-ring", "emerald-ring"],
      true,
    );
    const definitions = choices.map((choice) => gearDefinitions[choice.definitionId]);
    expect(choices).toHaveLength(4);
    expect(definitions.filter((definition) => definition.rarity === "unique")).toHaveLength(1);
    const uniqueBaseId = definitions.find((definition) => definition.rarity === "unique")?.baseItemId;
    expect(definitions.filter((definition) => definition.baseItemId === uniqueBaseId)).toHaveLength(1);
    expect(new Set(definitions.map((definition) => definition.baseItemId))).toEqual(
      new Set(["ruby-ring", "emerald-ring"]),
    );
  });

  it("stops narrow rewards at pool exhaustion instead of repeating bases", () => {
    const choices = generateGearRewardChoicesForRarity(4, "basic", () => 0, new Set(), ["emerald-ring"]);
    expect(choices.map((choice) => choice.definitionId)).toEqual(["emerald-ring-basic"]);
  });

  it("leaves a forced Unique reward empty when every allowed Unique is owned", () => {
    const owned = new Set(uniqueItemList.map((unique) => unique.id));
    expect(generateGearRewardChoicesForRarity(3, "unique", () => 0, owned)).toEqual([]);
  });

  it("weights Astral affix counts 80% toward three affixes", () => {
    expect(rollAffixCount("astral", () => 0.799999)).toBe(3);
    expect(rollAffixCount("astral", () => 0.8)).toBe(4);
    expect(rollAffixCount("basic", () => 0.799999)).toBe(1);
    expect(rollAffixCount("basic", () => 0.8)).toBe(2);
  });

  it("generates three choices at a forced reward rarity", () => {
    for (const rarity of ["basic", "astral", "unique"] as const) {
      const choices = generateGearRewardChoicesForRarity(3, rarity, () => 0.1);
      expect(choices).toHaveLength(3);
      expect(choices.every((choice) => gearDefinitions[choice.definitionId]?.rarity === rarity)).toBe(true);
    }
  });

  it("preserves mixed reward order and reserves a different base for each rarity", () => {
    const rarities = ["basic", "astral", "unique"] as const;
    const choices = generateGearRewardChoicesForRarities(rarities, createSeededRng(17));
    const definitions = choices.map((choice) => gearDefinitions[choice.definitionId]);
    expect(definitions.map((definition) => definition.rarity)).toEqual(rarities);
    expect(new Set(definitions.map((definition) => definition.baseItemId)).size).toBe(3);
    expect(new Set(choices.map((choice) => choice.instanceId)).size).toBe(3);
  });

  it.each([
    [0, "basic"],
    [0.5, "astral"],
    [0.99, "unique"],
  ] as const)("creates dev Gear from a %s rarity roll", (draw, rarity) => {
    const instance = generateDevRandomGearInstance(() => draw);
    const definition = gearDefinitions[instance.definitionId];
    expect(definition.rarity).toBe(rarity);
    if (rarity === "unique") {
      expect(instance.affixes).toEqual([]);
    } else {
      const pool = buildEligibleAffixPool(definition).map((affix) => affix.id);
      expect(instance.affixes).toHaveLength(
        draw < GEAR_AFFIX_COUNT_MIN_WEIGHT ? GEAR_AFFIX_COUNT[rarity].min : GEAR_AFFIX_COUNT[rarity].max,
      );
      expect(instance.affixes.every((roll) => pool.includes(roll.id))).toBe(true);
      expect(new Set(instance.affixes.map((roll) => roll.id)).size).toBe(instance.affixes.length);
    }
  });

  it.each([0, 1])("fills Unique slots with Astral when only %s Uniques remain", (remaining) => {
    const owned = new Set(uniqueItemList.slice(remaining).map((unique) => unique.id));
    const choices = generateGearRewardChoicesForRarities(["unique", "unique", "unique"], () => 0, owned);
    expect(choices).toHaveLength(3);
    expect(choices.every((choice) => !owned.has(choice.definitionId))).toBe(true);
    expect(choices.map((choice) => gearDefinitions[choice.definitionId].rarity)).toEqual(
      remaining === 1 ? ["unique", "astral", "astral"] : ["astral", "astral", "astral"],
    );
    expect(new Set(choices.map((choice) => gearDefinitions[choice.definitionId].baseItemId)).size).toBe(3);
  });

  it("generates a named base item with reward rarity and affixes", () => {
    const instance = generateGearInstanceForBaseItem("emerald-ring", createSeededRng(7));
    expect(instance).not.toBeNull();
    expect(instance!.definitionId).toMatch(/^emerald-ring-(basic|astral)$/);
    expect(gearDefinitions[instance!.definitionId]?.baseItemId).toBe("emerald-ring");
    expect(instance!.affixes.length).toBeGreaterThanOrEqual(GEAR_AFFIX_COUNT.basic.min);
  });

  it("treats allowed bases as membership while preserving catalog sampling order", () => {
    const pools = [
      ["ruby-ring", "emerald-ring"],
      ["emerald-ring", "ruby-ring", "emerald-ring", "unknown"],
    ];
    const generated = pools.map((pool) => {
      const seeded = createSeededRng(17);
      let draws = 0;
      const choices = generateLootGearChoices(
        4,
        () => {
          draws += 1;
          return seeded();
        },
        weights,
        new Set(),
        pool,
        true,
      );
      return { draws, choices: choices.map(({ definitionId, affixes }) => ({ definitionId, affixes })) };
    });
    expect(generated[0].choices).toHaveLength(4);
    expect(generated[1]).toEqual(generated[0]);
  });

  it("does not draw randomness when the allowed base pool is empty", () => {
    const rng = () => {
      throw new Error("An empty pool must not consume run RNG");
    };
    expect(generateLootGearChoices(3, rng, weights, new Set(), [])).toEqual([]);
    expect(generateGearRewardChoicesForRarity(3, "astral", rng, new Set(), ["unknown"])).toEqual([]);
  });

  it("returns null for an unknown base item id", () => {
    expect(generateGearInstanceForBaseItem("not-a-real-item", () => 0.1)).toBeNull();
  });
});
