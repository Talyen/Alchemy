import { describe, expect, it } from "vitest";
import { GEAR_AFFIX_COUNT } from "@/lib/game-constants";
import { generateDevRandomGearInstance, generateGearRewardChoices, gearDefinitions, rollGearRewardRarity } from "@/lib/gear";
import { affixMatchesAffinity } from "@/lib/gear/affixes";
import { buildEligibleAffixPool } from "@/lib/gear/affix-pool";
import { gearAffixCatalog } from "@/lib/gear/affix-catalog";

describe("gear generation", () => {
  it("generates gear reward instances with affixes", () => {
    let roll = 0;
    const rng = () => {
      roll += 0.173;
      return roll % 1;
    };
    const choices = generateGearRewardChoices(3, rng);
    expect(choices).toHaveLength(3);
    for (const instance of choices) {
      expect(instance.instanceId).toBeTruthy();
      expect(instance.definitionId).toMatch(/-(basic|astral)$/);
      expect(instance.affixes.length).toBeGreaterThanOrEqual(1);
      for (const affix of instance.affixes) {
        expect(affix.value).toBeGreaterThan(0);
      }
    }
  });

  it("guarantees the requested choice count even with duplicate-prone rng", () => {
    const choices = generateGearRewardChoices(3, () => 0);
    expect(choices).toHaveLength(3);
  });

  it("generates a dev random instance with valid definition and affix bounds", () => {
    let roll = 0;
    const rng = () => {
      roll += 0.173;
      return roll % 1;
    };
    const instance = generateDevRandomGearInstance(rng);
    expect(instance.instanceId).toBeTruthy();
    expect(instance.definitionId).toMatch(/-(basic|astral)$/);
    const definition = gearDefinitions[instance.definitionId];
    expect(definition).toBeTruthy();
    const rarity = definition.rarity!;
    const range = GEAR_AFFIX_COUNT[rarity];
    expect(instance.affixes.length).toBeGreaterThanOrEqual(range.min);
    expect(instance.affixes.length).toBeLessThanOrEqual(range.max);
    expect(new Set(instance.affixes.map((roll) => roll.id)).size).toBe(instance.affixes.length);
  });

  it("rolls reward gear rarity with optional astral chance bonus", () => {
    expect(Array.from({ length: 20 }, () => rollGearRewardRarity(() => 0.1)).every((rarity) => rarity === "basic")).toBe(
      true,
    );
    expect(Array.from({ length: 20 }, () => rollGearRewardRarity(() => 0.9)).every((rarity) => rarity === "astral")).toBe(
      true,
    );
    expect(rollGearRewardRarity(() => 0.46, { astralChanceBonus: 0.03 })).toBe("basic");
    expect(rollGearRewardRarity(() => 0.47, { astralChanceBonus: 0.03 })).toBe("astral");
    expect(rollGearRewardRarity(() => 0.39, { astralChanceBonus: 0.1 })).toBe("basic");
    expect(rollGearRewardRarity(() => 0.4, { astralChanceBonus: 0.1 })).toBe("astral");
  });

  it("rolls affixes only from eligible affinity and aspect pools", () => {
    let roll = 0;
    const rng = () => {
      roll += 0.37;
      return roll % 1;
    };

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const instance = generateGearRewardChoices(1, rng)[0]!;
      const definition = gearDefinitions[instance.definitionId]!;
      const pool = buildEligibleAffixPool(definition);
      for (const affixRoll of instance.affixes) {
        const affixDef = gearAffixCatalog[affixRoll.id];
        expect(affixMatchesAffinity(affixDef, definition.affinityKeywords)).toBe(true);
        expect(pool.some((entry) => entry.id === affixRoll.id)).toBe(true);
      }
    }
  });
});
