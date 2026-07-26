import { describe, expect, it } from "vitest";
import {
  canOccupyVacatedInventoryPlacement,
  findFirstInventoryPlacement,
  findNearestInventoryPlacement,
  inventoryPlacementCollides,
  inventoryPlacementRect,
} from "@/lib/gear";

describe("inventory placement helpers", () => {
  it("finds the nearest collision-free position using the full footprint", () => {
    const items = [
      { item: { instanceId: "blocker", definitionId: "blocker", affixes: [] }, col: 3, row: 2, w: 2, h: 2 },
      { item: { instanceId: "dragged", definitionId: "dragged", affixes: [] }, col: 1, row: 1, w: 2, h: 3 },
    ];
    const placement = findNearestInventoryPlacement(
      items,
      "dragged",
      { w: 2, h: 3 },
      { cellSize: 10, gap: 2, cols: 8, rows: 8 },
      { x: 42, y: 34 },
    );

    expect(placement).toEqual({ col: 5, row: 2 });
    expect(inventoryPlacementCollides(items, "dragged", placement!, { w: 2, h: 3 }, 8)).toBe(false);
  });

  it("finds the first top-left free position for automatic inventory placement", () => {
    const items = [
      { item: { instanceId: "blocker", definitionId: "blocker", affixes: [] }, col: 1, row: 1, w: 2, h: 2 },
      { item: { instanceId: "dragged", definitionId: "dragged", affixes: [] }, col: 5, row: 5, w: 2, h: 2 },
    ];

    expect(findFirstInventoryPlacement(items, "dragged", { w: 2, h: 2 }, 8)).toEqual({ col: 3, row: 1 });
  });

  it("allows same-footprint gear to occupy a vacated inventory placement during equip swap", () => {
    const items = [
      { item: { instanceId: "incoming", definitionId: "incoming", affixes: [] }, col: 3, row: 2, w: 2, h: 2 },
      { item: { instanceId: "neighbor", definitionId: "neighbor", affixes: [] }, col: 1, row: 1, w: 2, h: 2 },
    ];

    expect(
      canOccupyVacatedInventoryPlacement(items, "incoming", { w: 2, h: 2 }, { w: 2, h: 2 }, { col: 3, row: 2 }, 8),
    ).toBe(true);
  });

  it("rejects vacated placements that do not fit a different footprint", () => {
    const items = [
      { item: { instanceId: "incoming", definitionId: "incoming", affixes: [] }, col: 1, row: 1, w: 2, h: 1 },
      { item: { instanceId: "blocker", definitionId: "blocker", affixes: [] }, col: 2, row: 1, w: 2, h: 2 },
    ];

    expect(
      canOccupyVacatedInventoryPlacement(items, "incoming", { w: 2, h: 1 }, { w: 2, h: 2 }, { col: 1, row: 1 }, 8),
    ).toBe(false);
  });

  it.each([
    {
      footprint: { w: 1, h: 1 },
      placement: { col: 2, row: 3 },
      expected: { left: 12, top: 24, width: 10, height: 10 },
    },
    {
      footprint: { w: 2, h: 1 },
      placement: { col: 2, row: 3 },
      expected: { left: 12, top: 24, width: 22, height: 10 },
    },
    {
      footprint: { w: 2, h: 2 },
      placement: { col: 2, row: 3 },
      expected: { left: 12, top: 24, width: 22, height: 22 },
    },
    {
      footprint: { w: 2, h: 3 },
      placement: { col: 2, row: 3 },
      expected: { left: 12, top: 24, width: 22, height: 34 },
    },
  ])(
    "calculates the complete $footprint.w x $footprint.h destination rectangle",
    ({ footprint, placement, expected }) => {
      expect(inventoryPlacementRect(placement, footprint, { cellSize: 10, gap: 2 })).toEqual(expected);
    },
  );
});
