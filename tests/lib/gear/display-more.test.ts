import { describe, expect, it } from "vitest";
import { getGearInstanceTooltipEntries, getGearInstanceDescriptionLines } from "@/lib/gear/display";
import type { GearInstance } from "@/lib/gear/types";
import { gearDefinitionList } from "@/lib/gear/definitions";

function makeInstance(overrides?: Partial<GearInstance>): GearInstance {
  return {
    instanceId: "test-1",
    definitionId: gearDefinitionList[0]?.id ?? "wooden-sword-basic",
    affixes: [],
    ...overrides,
  };
}

describe("getGearInstanceTooltipEntries", () => {
  it("returns affix entries when affixes exist", () => {
    const instance = makeInstance({
      affixes: [{ id: "flat-physical" as const, value: 3 }],
    });
    const entries = getGearInstanceTooltipEntries(instance);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("returns description lines when no affixes and definition has descriptions", () => {
    const instance = makeInstance({ affixes: [] });
    const entries = getGearInstanceTooltipEntries(instance);
    expect(entries.every((e) => e.key.startsWith("definition-"))).toBe(true);
  });

  it("returns empty array for unknown definition", () => {
    const instance = makeInstance({
      definitionId: "nonexistent",
      affixes: [],
    });
    const entries = getGearInstanceTooltipEntries(instance);
    expect(entries).toEqual([]);
  });
});

describe("getGearInstanceDescriptionLines", () => {
  it("returns text lines from tooltip entries", () => {
    const instance = makeInstance();
    const lines = getGearInstanceDescriptionLines(instance);
    expect(Array.isArray(lines)).toBe(true);
  });
});
