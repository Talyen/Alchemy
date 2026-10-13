import { describe, expect, it } from "vitest";
import { gearAffixCatalog } from "@/lib/gear/affix-catalog";
import { gearDefinitions } from "@/lib/gear/definitions";
import { buildEligibleAffixPool } from "@/lib/gear/affix-pool";

describe("affix catalog guard", () => {
  it("makes every ordinary affix reachable on Basic or Astral Gear", () => {
    const reachable = new Set(
      Object.values(gearDefinitions)
        .filter((definition) => definition.rarity === "basic" || definition.rarity === "astral")
        .flatMap((definition) => buildEligibleAffixPool(definition).map((affix) => affix.id)),
    );
    expect(
      Object.values(gearAffixCatalog)
        .filter((affix) => !affix.uniqueOnly && !reachable.has(affix.id))
        .map((affix) => affix.id),
    ).toEqual([]);
  });

  it("requires unique display names for affixes", () => {
    const seen = new Map<string, string>();
    for (const definition of Object.values(gearAffixCatalog)) {
      const prev = seen.get(definition.name);
      expect(prev, `duplicate affix name "${definition.name}" used by ${prev} and ${definition.id}`).toBeUndefined();
      seen.set(definition.name, definition.id);
    }
  });

  it("requires unique-only affixes to have fixed rolls at every rarity", () => {
    for (const definition of Object.values(gearAffixCatalog)) {
      if (!definition.uniqueOnly) continue;
      for (const range of Object.values(definition.roll)) {
        expect(range.min, `${definition.id} uniqueOnly should have fixed roll`).toBe(range.max);
      }
    }
  });
});
