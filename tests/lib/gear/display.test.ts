import { describe, expect, it } from "vitest";
import { getGearInstanceDescriptionLines, getGearInstanceTooltipEntries, type GearInstance } from "@/lib/gear";

describe("gear display", () => {
  const affixedHelm: GearInstance = {
    instanceId: "helm-1",
    definitionId: "leather-helm-basic",
    affixes: [{ id: "max-health", value: 7 }],
  };

  const bareHelm: GearInstance = {
    instanceId: "helm-2",
    definitionId: "leather-helm-basic",
    affixes: [],
  };

  const astralHelm: GearInstance = {
    instanceId: "helm-3",
    definitionId: "leather-helm-astral",
    affixes: [],
  };

  it("returns affix tooltip entries with names and formatted text", () => {
    const entries = getGearInstanceTooltipEntries(affixedHelm);
    expect(entries).toEqual([
      {
        key: "max-health-0",
        name: "Enduring",
        text: "Increases Health by 7",
      },
    ]);
  });

  it("falls back to basic salvage text when an item has no affixes", () => {
    expect(getGearInstanceTooltipEntries(bareHelm)).toEqual([
      { key: "salvage", text: "Salvage for Basic crafting currency" },
    ]);
  });

  it("falls back to astral salvage text for astral items without affixes", () => {
    expect(getGearInstanceTooltipEntries(astralHelm)).toEqual([
      { key: "salvage", text: "Salvage for Astral crafting currency" },
    ]);
  });

  it("strips affix names from description lines", () => {
    expect(getGearInstanceDescriptionLines(affixedHelm)).toEqual(["Increases Health by 7"]);
  });
});
