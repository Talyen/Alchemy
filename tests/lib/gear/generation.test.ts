import { describe, expect, it } from "vitest";
import { generateGearRewardChoices, rollGearRarity } from "@/lib/gear";

describe("gear generation", () => {
  it("generates gear reward instances with affixes", () => {
    let roll = 0;
    const rng = () => {
      roll += 0.173;
      return roll % 1;
    };
    const choices = generateGearRewardChoices(3, "normal", rng);
    expect(choices).toHaveLength(3);
    for (const instance of choices) {
      expect(instance.instanceId).toBeTruthy();
      expect(instance.definitionId).toMatch(/-(basic|astral)$/);
      expect(instance.affixIds.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("guarantees the requested choice count even with duplicate-prone rng", () => {
    const choices = generateGearRewardChoices(3, "normal", () => 0);
    expect(choices).toHaveLength(3);
  });

  it("biases boss rewards toward astral rarity", () => {
    const basicBoss = Array.from({ length: 20 }, () => rollGearRarity("boss", () => 0.1));
    const astralBoss = Array.from({ length: 20 }, () => rollGearRarity("boss", () => 0.8));
    expect(basicBoss.every((rarity) => rarity === "basic")).toBe(true);
    expect(astralBoss.every((rarity) => rarity === "astral")).toBe(true);
  });
});
