import { describe, expect, it } from "vitest";
import {
  getGearAffixDisplayName,
  getGearAffixTooltipEntries,
  getGearInstanceTooltipEntries,
  type GearInstance,
} from "@/lib/gear";

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

  it("returns no display entries for an unknown definition without affixes", () => {
    const unknown: GearInstance = {
      instanceId: "missing-1",
      definitionId: "missing-definition",
      affixes: [],
    };

    expect(getGearInstanceTooltipEntries(unknown)).toEqual([]);
  });

  it("uses affix epithets for tooltip display names", () => {
    expect(getGearAffixDisplayName("flat-physical")).toBe("Ironbound");
    expect(getGearAffixDisplayName("gold-on-kill")).toBe("Greed");
  });

  it("builds structured affix tooltip entries with names", () => {
    const entries = getGearAffixTooltipEntries([{ id: "flat-physical", value: 2 }]);
    expect(entries).toEqual([
      {
        key: "flat-physical-0",
        name: "Ironbound",
        text: "Increases Physical damage by 2",
      },
    ]);
  });
});
