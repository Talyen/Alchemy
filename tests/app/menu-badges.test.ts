import { describe, expect, it } from "vitest";
import { hasAffordableHomesteadUpgrade, hasUnspentTalents } from "@/app/app-screen-chrome-context";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { countImplementedTalents } from "@/lib/game-data";

const RICH = { wood: 999, iron: 999, herbs: 999, food: 999, gems: 999, stone: 0, hide: 0 };

function freshProgress() {
  return {
    materialInventory: RICH,
    constructedBuildings: {},
    plantedFarms: {},
    completedResearch: {},
    bondedCompanions: {},
    discoveredCardIds: [] as string[],
  };
}

describe("hasUnspentTalents", () => {
  it("signals spendable points without offering nonexistent Talents after a tree is complete", () => {
    expect(hasUnspentTalents({}, {})).toBe(false);
    const talentXP = { physical: 1_000_000 };
    expect(hasUnspentTalents(talentXP, {})).toBe(true);
    expect(
      hasUnspentTalents(talentXP, {
        physical: Array.from({ length: countImplementedTalents("physical") }, (_, index) => `spent-${index}`),
      }),
    ).toBe(false);
  });
});

describe("hasAffordableHomesteadUpgrade", () => {
  it("is true for a fresh homestead with stocked materials", () => {
    expect(hasAffordableHomesteadUpgrade(freshProgress())).toBe(true);
  });

  it("is false with an empty inventory and nothing discovered", () => {
    expect(
      hasAffordableHomesteadUpgrade({
        ...freshProgress(),
        materialInventory: emptyInventory(),
      }),
    ).toBe(false);
  });

  it("is false when everything is maxed out", () => {
    expect(
      hasAffordableHomesteadUpgrade({
        materialInventory: RICH,
        constructedBuildings: Object.fromEntries(buildings.map((b) => [b.id, b.tiers.length])),
        plantedFarms: Object.fromEntries(farmPlots.map((f) => [f.id, f.tiers.length])),
        completedResearch: Object.fromEntries(researchUpgrades.map((r) => [r.id, r.tiers.length])),
        bondedCompanions: {},
        discoveredCardIds: [],
      }),
    ).toBe(false);
  });
});
