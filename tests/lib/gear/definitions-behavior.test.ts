import { describe, expect, it } from "vitest";
import {
  gearDefinitions,
  gearInstanceRarity,
  getGearDefinitionsByRarity,
  gearDefinitionList,
} from "@/lib/gear/definitions";

describe("gearInstanceRarity", () => {
  it("returns rarity of an existing definition", () => {
    const definitionId = gearDefinitionList[0]?.id;
    if (!definitionId) return;
    const expected = gearDefinitions[definitionId]?.rarity ?? "basic";
    expect(gearInstanceRarity({ instanceId: "i1", definitionId, affixes: [] })).toBe(expected);
  });

  it("falls back to 'basic' for unknown definition id", () => {
    expect(gearInstanceRarity({ instanceId: "i1", definitionId: "nonexistent-id", affixes: [] })).toBe("basic");
  });
});

describe("getGearDefinitionsByRarity", () => {
  it("returns only definitions matching the requested rarity", () => {
    const allBasic = getGearDefinitionsByRarity("basic");
    expect(allBasic.length).toBeGreaterThan(0);
    expect(allBasic.every((d) => d.rarity === "basic")).toBe(true);
  });

  it("returns only definitions matching astral rarity", () => {
    const allAstral = getGearDefinitionsByRarity("astral");
    expect(allAstral.length).toBeGreaterThan(0);
    expect(allAstral.every((d) => d.rarity === "astral")).toBe(true);
  });
});
