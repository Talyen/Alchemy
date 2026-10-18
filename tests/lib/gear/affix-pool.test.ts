import { describe, expect, it } from "vitest";
import { buildEligibleAffixPool, rollAffixes } from "@/lib/gear/affix-pool";
import { gearDefinitions, type GearDefinition } from "@/lib/gear/definitions";
import { createSeededRng } from "@/lib/rng";

describe("eligible affix pool", () => {
  it("permits one aspect per equipment kind and both on shields and jewelry", () => {
    const dagger = buildEligibleAffixPool(gearDefinitions["dagger-basic"]!);
    const armor = buildEligibleAffixPool(gearDefinitions["leather-armor-basic"]!);
    const shield = buildEligibleAffixPool(gearDefinitions["leather-buckler-basic"]!);
    const ring = buildEligibleAffixPool(gearDefinitions["ruby-ring-basic"]!);
    expect(dagger.length).toBeGreaterThan(0);
    expect(dagger.every((affix) => affix.aspect === "offensive")).toBe(true);
    expect(armor.every((affix) => affix.aspect === "defensive")).toBe(true);
    expect(shield.some((affix) => affix.aspect === "offensive")).toBe(true);
    expect(shield.some((affix) => affix.aspect === "defensive")).toBe(true);
    expect(ring.some((affix) => affix.aspect === "offensive")).toBe(true);
    expect(ring.some((affix) => affix.aspect === "defensive")).toBe(true);
  });

  it("rolls distinct eligible affixes without consuming randomness for zero picks", () => {
    const definition: GearDefinition = gearDefinitions["dagger-basic"]!;
    const pool = new Set(buildEligibleAffixPool(definition).map((affix) => affix.id));
    const rolls = rollAffixes(definition, 2, createSeededRng(17));
    expect(rolls).toHaveLength(2);
    expect(new Set(rolls.map((roll) => roll.id)).size).toBe(2);
    for (const roll of rolls) expect(pool.has(roll.id)).toBe(true);
    expect(
      rollAffixes(definition, 0, () => {
        throw new Error("zero picks must not draw");
      }),
    ).toEqual([]);
  });
});
