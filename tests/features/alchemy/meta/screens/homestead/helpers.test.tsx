import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  BUILDING_GOAL_ITEMS,
  FARM_GOAL_ITEMS,
  HOMESTEAD_CONFIG,
  RESEARCH_GOAL_ITEMS,
  formatMaterialCostSummary,
  getArt,
  getHomesteadUpgradeShineColors,
  renderTextWithMaterials,
} from "@/features/alchemy/meta/screens/homestead/helpers";
import { emptyInventory } from "@/lib/homestead/inventory";

describe("renderTextWithMaterials", () => {
  it("renders multiple chips in one line and plain text segments", () => {
    const { container } = render(<div>{renderTextWithMaterials("Gain 2 Food and 1 Herbs each run")}</div>);
    expect(screen.getByText("Food")).toBeTruthy();
    expect(screen.getByText("Herbs")).toBeTruthy();
    expect(container.textContent).toContain("Gain");
  });

  it("returns plain text when no material is present", () => {
    const { container } = render(<div>{renderTextWithMaterials("No materials here")}</div>);
    expect(container.textContent).toContain("No materials here");
  });
});

describe("getArt", () => {
  it("returns a string for known ids", () => {
    expect(getArt("blacksmiths-forge")).toBeTruthy();
    expect(typeof getArt("blacksmiths-forge")).toBe("string");
  });

  it("returns fallback empty for unknown id", () => {
    expect(getArt("unknown-id")).toBe("");
  });

  it("resolves valid artwork for every building, farm, and research upgrade", () => {
    const allGoals = [...BUILDING_GOAL_ITEMS, ...FARM_GOAL_ITEMS, ...RESEARCH_GOAL_ITEMS];
    expect(allGoals).toHaveLength(23);
    for (const goal of allGoals) {
      const art = getArt(goal.data.id);
      expect(art, `Art for ${goal.data.id} should be non-empty`).toBeTruthy();
      expect(typeof art).toBe("string");
    }
  });
});

describe("formatMaterialCostSummary", () => {
  it("returns formatted string for single material", () => {
    const cost = { ...emptyInventory(), wood: 10 };
    expect(formatMaterialCostSummary(cost)).toBe("10 Wood");
  });

  it("returns formatted string for multiple materials in canonical order", () => {
    const cost = { ...emptyInventory(), stone: 8, iron: 22 };
    expect(formatMaterialCostSummary(cost)).toBe("8 Stone, 22 Iron");
  });

  it("returns empty string when cost is zero", () => {
    expect(formatMaterialCostSummary(emptyInventory())).toBe("");
  });
});

describe("getHomesteadUpgradeShineColors", () => {
  it("returns an array of shine colors for an upgrade item and caches it", () => {
    const item = BUILDING_GOAL_ITEMS[0]!;
    const colors1 = getHomesteadUpgradeShineColors(item);
    expect(Array.isArray(colors1)).toBe(true);
    expect(colors1.length).toBeGreaterThan(0);

    const colors2 = getHomesteadUpgradeShineColors(item);
    expect(colors2).toBe(colors1); // cached reference
  });
});

describe("HOMESTEAD_CONFIG", () => {
  it("has expected pagination constants", () => {
    expect(HOMESTEAD_CONFIG.companionPageSize).toBe(8);
    expect(HOMESTEAD_CONFIG.upgradePageSize).toBe(6);
    expect(HOMESTEAD_CONFIG.hoverScope).toBe("homestead");
  });
});
