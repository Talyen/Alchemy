import { describe, expect, it } from "vitest";
import { getGearInstanceDescriptionLines, getGearInstanceTooltipEntries, type GearInstance } from "@/lib/gear";

describe("gear display", () => {
  const affixedArmor: GearInstance = {
    instanceId: "armor-1",
    definitionId: "leather-armor-basic",
    affixes: [{ id: "max-health", value: 7 }],
  };

  const bareArmor: GearInstance = {
    instanceId: "armor-2",
    definitionId: "leather-armor-basic",
    affixes: [],
  };

  const astralArmor: GearInstance = {
    instanceId: "armor-3",
    definitionId: "leather-armor-astral",
    affixes: [],
  };

  it("returns affix tooltip entries with names and formatted text", () => {
    const entries = getGearInstanceTooltipEntries(affixedArmor);
    expect(entries).toEqual([
      {
        key: "max-health-0",
        name: "Enduring",
        text: "Increases Health by 7",
      },
    ]);
  });

  it("returns empty tooltip entries for items with no affixes and no description lines", () => {
    expect(getGearInstanceTooltipEntries(bareArmor)).toEqual([]);
  });

  it("returns empty tooltip entries for astral items with no affixes and no description lines", () => {
    expect(getGearInstanceTooltipEntries(astralArmor)).toEqual([]);
  });

  it("strips affix names from description lines", () => {
    expect(getGearInstanceDescriptionLines(affixedArmor)).toEqual(["Increases Health by 7"]);
  });
});
