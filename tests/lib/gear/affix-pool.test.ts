import { describe, expect, it } from "vitest";
import { affixMatchesAffinity } from "@/lib/gear/affixes";
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

  it("gives hero-matching affixes 50% more weight without excluding other eligible affixes", () => {
    const definition = gearDefinitions["ruby-ring-basic"]!;
    const keywords = ["burn"] as const;
    const pool = buildEligibleAffixPool(definition);
    const matches = pool.filter((affix) => affixMatchesAffinity(affix, keywords));
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.length).toBeLessThan(pool.length);
    expect(matches.some((affix) => affix.secondaryKeywordId === "burn" && affix.keywordId !== "burn")).toBe(true);

    // Half-weight bucket midpoints exhaustively sample every selection interval.
    const halfWeights = pool.map((affix) => (affixMatchesAffinity(affix, keywords) ? 3 : 2));
    const total = halfWeights.reduce((sum, weight) => sum + weight, 0);
    const counts = new Map<string, number>();
    for (let bucket = 0; bucket < total; bucket++) {
      const [roll] = rollAffixes(definition, 1, () => (bucket + 0.5) / total, keywords);
      counts.set(roll!.id, (counts.get(roll!.id) ?? 0) + 1);
    }
    for (const [index, affix] of pool.entries()) expect(counts.get(affix.id)).toBe(halfWeights[index]);

    const weighted = rollAffixes(definition, pool.length, createSeededRng(17), keywords);
    expect(new Set(weighted.map((roll) => roll.id)).size).toBe(pool.length);
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
