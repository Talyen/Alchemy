import { describe, expect, it } from "vitest";
import { GEAR_AFFIX_COUNT } from "@/lib/game-constants";
import {
  definitionOfferFootprintKey,
  eligibleOfferFootprintKeys,
  generateDevRandomGearInstance,
  generateGearRewardChoices,
  gearDefinitions,
  rollGearRewardRarity,
} from "@/lib/gear";
import { affixMatchesAffinity } from "@/lib/gear/affixes";
import { buildEligibleAffixPool } from "@/lib/gear/generation";
import { gearAffixCatalog } from "@/lib/gear/affix-catalog";
import { createSeededRng } from "@/lib/utils";

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

  it("never offers the same base item across the three choices (dedupe by baseItemId)", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const rng = createSeededRng(seed);
      const choices = generateGearRewardChoices(3, rng);
      expect(choices).toHaveLength(3);
      const baseItemIds = choices.map((c) => gearDefinitions[c.definitionId]?.baseItemId);
      expect(new Set(baseItemIds).size, `seed ${seed}: ${JSON.stringify(baseItemIds)}`).toBe(baseItemIds.length);
    }
  });

  it("offers three choices that share the same footprint family", () => {
    const seenFamilies = new Set<string>();
    for (let seed = 1; seed <= 80; seed += 1) {
      const rng = createSeededRng(seed);
      const choices = generateGearRewardChoices(3, rng);
      expect(choices).toHaveLength(3);
      const keys = choices.map((choice) => {
        const definition = gearDefinitions[choice.definitionId];
        expect(definition, `seed ${seed}: missing definition ${choice.definitionId}`).toBeTruthy();
        return definitionOfferFootprintKey(definition!);
      });
      expect(new Set(keys).size, `seed ${seed}: ${JSON.stringify(keys)}`).toBe(1);
      seenFamilies.add(keys[0]!);
    }
    expect(seenFamilies.size).toBeGreaterThan(1);
    for (const key of seenFamilies) {
      expect(eligibleOfferFootprintKeys(3)).toContain(key);
    }
  });

  it("lists only footprint families with enough unique base items", () => {
    expect(eligibleOfferFootprintKeys(3)).toEqual(["1x1", "2x2", "2x3"]);
    expect(eligibleOfferFootprintKeys(3)).not.toContain("2x1");
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
    expect(
      Array.from({ length: 20 }, () => rollGearRewardRarity(() => 0.1)).every((rarity) => rarity === "basic"),
    ).toBe(true);
    expect(
      Array.from({ length: 20 }, () => rollGearRewardRarity(() => 0.9)).every((rarity) => rarity === "astral"),
    ).toBe(true);
    expect(rollGearRewardRarity(() => 0.46, 0.03)).toBe("basic");
    expect(rollGearRewardRarity(() => 0.47, 0.03)).toBe("astral");
    expect(rollGearRewardRarity(() => 0.39, 0.1)).toBe("basic");
    expect(rollGearRewardRarity(() => 0.4, 0.1)).toBe("astral");
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
