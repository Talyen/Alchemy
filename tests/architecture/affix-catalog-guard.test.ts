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
    const idsByName = new Map<string, string[]>();
    for (const definition of Object.values(gearAffixCatalog)) {
      const ids = idsByName.get(definition.name) ?? [];
      ids.push(definition.id);
      idsByName.set(definition.name, ids);
    }
    expect([...idsByName.entries()].filter(([, ids]) => ids.length > 1)).toEqual([]);
  });

  it("requires unique-only affixes to have fixed rolls at every rarity", () => {
    expect(
      Object.values(gearAffixCatalog)
        .filter(
          (definition) =>
            definition.uniqueOnly && Object.values(definition.roll).some((range) => range.min !== range.max),
        )
        .map((definition) => definition.id),
    ).toEqual([]);
  });
});
