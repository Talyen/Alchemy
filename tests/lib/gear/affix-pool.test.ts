import { describe, expect, it } from "vitest";
import { buildEligibleAffixPool, rollAffixes } from "@/lib/gear/affix-pool";
import { gearDefinitions, type GearDefinition } from "@/lib/gear/definitions";
import { createSeededRng } from "@/lib/rng";

describe("eligible affix pool caching", () => {
  it("reuses frozen pools without letting metadata unrelated to eligibility change seeded rolls", () => {
    const definition: GearDefinition = {
      ...gearDefinitions["dagger-basic"]!,
      compatibleSlots: [...gearDefinitions["dagger-basic"]!.compatibleSlots],
      affinityKeywords: [...gearDefinitions["dagger-basic"]!.affinityKeywords],
    };
    const pool = buildEligibleAffixPool(definition);
    const rolls = rollAffixes(definition, 2, createSeededRng(17));
    definition.displayName = "Renamed Dagger";
    definition.baseItemId = "shortsword";
    definition.compatibleSlots.reverse();
    expect(buildEligibleAffixPool(definition)).toBe(pool);
    expect(Object.isFrozen(pool)).toBe(true);
    expect(rollAffixes(definition, 2, createSeededRng(17))).toEqual(rolls);
    expect(rollAffixes({ ...definition }, 2, createSeededRng(17))).toEqual(rolls);
  });

  it("refreshes eligibility when custom definitions change in place", () => {
    const definition: GearDefinition = {
      ...gearDefinitions["dagger-basic"]!,
      compatibleSlots: ["main-hand"],
      affinityKeywords: ["dodge"],
    };
    const offensive = buildEligibleAffixPool(definition);
    expect(offensive.map((affix) => affix.id)).toContain("dodge-riposte");
    expect(offensive.every((affix) => affix.aspect === "offensive")).toBe(true);

    definition.baseItemId = "leather-buckler";
    const shield = buildEligibleAffixPool(definition);
    expect(shield.map((affix) => affix.id)).toContain("dodge-block");

    definition.baseItemId = "dagger";
    definition.compatibleSlots = ["main-hand"];
    definition.affinityKeywords[0] = "physical";
    const physical = buildEligibleAffixPool(definition);
    expect(physical.map((affix) => affix.id)).toContain("flat-physical");
    expect(physical.map((affix) => affix.id)).not.toContain("dodge-riposte");

    // Slot changes matter independently of the base item and affinity.
    definition.compatibleSlots[0] = "body";
    const defensive = buildEligibleAffixPool(definition);
    expect(defensive).not.toBe(physical);
    expect(defensive.every((affix) => affix.aspect === "defensive")).toBe(true);
  });
});
