import { describe, expect, it } from "vitest";
import { gearDefinitions } from "@/lib/gear";
import {
  findFirstInventoryPlacement,
  findNearestInventoryPlacement,
  getInventoryFootprint,
  inventoryPlacementCollides,
  inventoryPlacementRect,
  packInventory,
  packInventoryWithPositions,
  type GearFootprint,
} from "@/lib/gear";

describe("packInventory", () => {
  it("packs mixed footprints into the first available cells", () => {
    const items: GearFootprint[] = [
      { w: 2, h: 2 },
      { w: 1, h: 1 },
      { w: 2, h: 1 },
    ];

    expect(packInventory(items, 4, (item) => item)).toEqual({
      items: [
        { item: items[0], col: 1, row: 1, w: 2, h: 2 },
        { item: items[1], col: 3, row: 1, w: 1, h: 1 },
        { item: items[2], col: 3, row: 2, w: 2, h: 1 },
      ],
      occupiedRows: 2,
    });
  });

  it("fits exactly eight rows without requiring overflow", () => {
    const items = Array.from({ length: 64 }, (_, index) => index);
    const packed = packInventory(items, 8, () => ({ w: 1, h: 1 }));

    expect(packed.items).toHaveLength(64);
    expect(packed.occupiedRows).toBe(8);
  });

  it("continues into a ninth row instead of creating a page", () => {
    const items = Array.from({ length: 65 }, (_, index) => index);
    const packed = packInventory(items, 8, () => ({ w: 1, h: 1 }));

    expect(packed.occupiedRows).toBe(9);
    expect(packed.items[64]).toEqual({ item: 64, col: 1, row: 9, w: 1, h: 1 });
  });

  it("uses the selected slot footprint for filtered inventory", () => {
    const body = gearDefinitions["placeholder-body"];

    expect(getInventoryFootprint(body, null)).toEqual({ w: 2, h: 3 });
    expect(getInventoryFootprint(body, "left-ring")).toEqual({ w: 1, h: 1 });
  });

  it("uses the expanded equipment footprints", () => {
    expect(getInventoryFootprint(gearDefinitions["placeholder-main-hand"], null)).toEqual({ w: 2, h: 3 });
    expect(getInventoryFootprint(gearDefinitions["placeholder-off-hand"], null)).toEqual({ w: 2, h: 3 });
    expect(getInventoryFootprint(gearDefinitions["placeholder-belt"], null)).toEqual({ w: 2, h: 1 });
  });

  it("returns no occupied rows for an empty inventory", () => {
    expect(packInventory([], 8, () => ({ w: 1, h: 1 }))).toEqual({ items: [], occupiedRows: 0 });
  });

  it("rejects footprints wider than the board", () => {
    expect(() => packInventory([1], 2, () => ({ w: 3, h: 1 }))).toThrow(RangeError);
  });

  it("places items at saved positions if valid, otherwise packs sequentially", () => {
    const items = [
      { instanceId: "item1", definitionId: "placeholder-helm" }, // 2x2
      { instanceId: "item2", definitionId: "placeholder-body" }, // 2x3
      { instanceId: "item3", definitionId: "placeholder-belt" }, // 2x1
    ];
    const savedPositions = {
      item1: { col: 3, row: 1 },
      item2: { col: 1, row: 3 },
    };
    const result = packInventoryWithPositions(items, 4, savedPositions);
    expect(result.items).toEqual([
      { item: items[0], col: 3, row: 1, w: 2, h: 2 },
      { item: items[1], col: 1, row: 3, w: 2, h: 3 },
      { item: items[2], col: 1, row: 1, w: 2, h: 1 }, // packs on first available slot (1,1)
    ]);
  });

  it("repacks items when saved positions collide", () => {
    const items = [
      { instanceId: "item1", definitionId: "placeholder-helm" },
      { instanceId: "item2", definitionId: "placeholder-belt" },
    ];
    const result = packInventoryWithPositions(items, 8, {
      item1: { col: 1, row: 1 },
      item2: { col: 1, row: 1 },
    });

    expect(result.items[0]).toMatchObject({ item: items[0], col: 1, row: 1 });
    expect(result.items[1]?.col).toBeGreaterThan(0);
    expect(result.items[1]?.item).toBe(items[1]);
  });

  it("finds the nearest collision-free position using the full footprint", () => {
    const items = [
      { item: { instanceId: "blocker" }, col: 3, row: 2, w: 2, h: 2 },
      { item: { instanceId: "dragged" }, col: 1, row: 1, w: 2, h: 3 },
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
      { item: { instanceId: "blocker" }, col: 1, row: 1, w: 2, h: 2 },
      { item: { instanceId: "dragged" }, col: 5, row: 5, w: 2, h: 2 },
    ];

    expect(findFirstInventoryPlacement(items, "dragged", { w: 2, h: 2 }, 8)).toEqual({ col: 3, row: 1 });
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
