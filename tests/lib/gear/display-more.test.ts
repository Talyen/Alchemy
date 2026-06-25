import { describe, expect, it } from "vitest";
import { getGearInstanceTooltipEntries, getGearInstanceDescriptionLines } from "@/lib/gear/display";
import { footprintForInstance, getInventoryFootprint } from "@/lib/gear/footprints";
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

describe("footprintForInstance", () => {
  it("returns footprint for a known definition", () => {
    const fp = footprintForInstance({ definitionId: gearDefinitionList[0]?.id ?? "wooden-sword-basic" });
    expect(fp).not.toBeNull();
    expect(fp!.w).toBeGreaterThan(0);
    expect(fp!.h).toBeGreaterThan(0);
  });

  it("returns null for unknown definition", () => {
    const fp = footprintForInstance({ definitionId: "nonexistent" });
    expect(fp).toBeNull();
  });
});

describe("getInventoryFootprint", () => {
  it("uses selected slot when provided", () => {
    const def = gearDefinitionList[0]!;
    const fp = getInventoryFootprint(def, "helm");
    expect(fp).toEqual({ w: 2, h: 2 });
  });

  it("falls back to first compatible slot when none selected", () => {
    const def = gearDefinitionList[0]!;
    const fp = getInventoryFootprint(def, null);
    expect(fp.w).toBeGreaterThan(0);
  });
});
