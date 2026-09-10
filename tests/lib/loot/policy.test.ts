import { describe, expect, it } from "vitest";
import { LOOT_SOURCE_WEIGHTS } from "@/lib/game-constants";
import { createSeededRng } from "@/lib/rng";
import {
  highestCompletedLootDifficulty,
  isLootEligible,
  lootAccountMultiplier,
  lootDepthMultiplier,
  resolveLootWeights,
  rollLootGearRarity,
  rollLootGroup,
  type LootSource,
} from "@/lib/loot";

const sources = Object.keys(LOOT_SOURCE_WEIGHTS) as LootSource[];
const progress = { depth: 24, highestCompletedDifficulty: null };

describe("shared loot policy", () => {
  it.each([
    ["astral", 3, 0],
    ["astral", 4, 0.2],
    ["astral", 6, 0.4],
    ["astral", 8, 0.6],
    ["astral", 12, 0.8],
    ["astral", 16, 1],
    ["trinket", 7, 0],
    ["trinket", 8, 0.35],
    ["trinket", 12, 0.675],
    ["trinket", 16, 1],
    ["unique", 11, 0],
    ["unique", 12, 0.2],
    ["unique", 18, 0.6],
    ["unique", 24, 1],
  ] as const)("interpolates %s at depth %s", (kind, depth, multiplier) => {
    expect(lootDepthMultiplier(kind, depth)).toBeCloseTo(multiplier);
    expect(isLootEligible(kind, depth)).toBe(multiplier > 0);
    expect(lootDepthMultiplier(kind, 1000)).toBe(1);
  });

  it.each(sources)("preserves the full-depth %s baseline and blocks early premiums even with bonuses", (source) => {
    const late = resolveLootWeights({ source, progress });
    for (const kind of Object.keys(late) as Array<keyof typeof late>)
      expect(late[kind]).toBeCloseTo(LOOT_SOURCE_WEIGHTS[source][kind]);
    const early = resolveLootWeights({
      source,
      progress: { depth: 1, highestCompletedDifficulty: "difficulty-3" },
      astralChanceBonus: 1,
    });
    expect(early.astral + early.unique + early.trinket).toBe(0);
    expect(Object.values(early).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
  });

  it("uses the account's best clear once and applies the capped multiplier only to premium weights", () => {
    const best = highestCompletedLootDifficulty({
      knight: ["difficulty-1", "difficulty-2"],
      rogue: ["difficulty-3"],
      wizard: ["difficulty-3"],
    });
    expect(best).toBe("difficulty-3");
    expect(highestCompletedLootDifficulty({ knight: [] })).toBeNull();
    expect(
      [null, "difficulty-1", "difficulty-2", "difficulty-3"].map((id) => lootAccountMultiplier(id as typeof best)),
    ).toEqual([1, 1.1, 1.2, 1.3]);
    const weights = resolveLootWeights({
      source: "normal",
      progress: { ...progress, highestCompletedDifficulty: best },
    });
    expect(weights.unique / weights.basic).toBeCloseTo((0.05 * 1.3) / 0.17);
    expect(weights.boon / weights.card).toBeCloseTo(0.1 / 0.55);
  });

  it("transfers Basic weight to Astral before scaling, clamps bonuses, and filters exhausted pools", () => {
    const weights = resolveLootWeights({
      source: "normal",
      progress,
      astralChanceBonus: 0.05,
      available: { unique: false, trinket: false },
    });
    expect(weights.unique + weights.trinket).toBe(0);
    expect(weights.astral / weights.basic).toBeCloseTo(1);
    expect(resolveLootWeights({ source: "normal", progress, astralChanceBonus: -1 })).toEqual(
      resolveLootWeights({ source: "normal", progress }),
    );
    expect(resolveLootWeights({ source: "equipment", progress, astralChanceBonus: 10 }).basic).toBe(0);
  });

  it("uses Basic Gear for an empty premium source and cards if no Gear is available", () => {
    const early = { depth: 1, highestCompletedDifficulty: null };
    const basic = resolveLootWeights({ source: "boss", progress: early });
    expect(rollLootGroup(basic, () => 0.999)).toBe("gear");
    expect(rollLootGearRarity(basic, () => 0.999)).toBe("basic");
    const cards = resolveLootWeights({
      source: "boss",
      progress: early,
      available: { basic: false, astral: false, unique: false },
    });
    expect(rollLootGroup(cards, () => 0)).toBe("card");
  });

  it("selects groups and conditional rarities from the same weights and is seed reproducible", () => {
    const weights = resolveLootWeights({ source: "normal", progress });
    expect(rollLootGroup(weights, () => 0.54)).toBe("card");
    expect(rollLootGroup(weights, () => 0.6)).toBe("gear");
    expect(rollLootGroup(weights, () => 0.9)).toBe("boon");
    expect(rollLootGroup(weights, () => 0.99)).toBe("trinket");
    expect(rollLootGearRarity(weights, () => 0.1)).toBe("basic");
    expect(rollLootGearRarity(weights, () => 0.7)).toBe("astral");
    expect(rollLootGearRarity(weights, () => 0.99)).toBe("unique");
    expect(rollLootGearRarity(weights, () => 0.99, { unique: false })).toBe("astral");
    const sample = () => {
      const rng = createSeededRng(42);
      return Array.from({ length: 100 }, () => [rollLootGroup(weights, rng), rollLootGearRarity(weights, rng)]);
    };
    expect(sample()).toEqual(sample());
  });
});
