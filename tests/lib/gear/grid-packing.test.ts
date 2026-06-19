import { describe, expect, it } from "vitest";
import {
  packInventoryGrid,
  packInventoryGridPreserving,
  packCurrencyGridWithGearObstacles,
  resolveMoveWithSwap,
  type BoardItem,
} from "@/lib/gear/grid-packing";

const COLS = 7;

describe("packInventoryGrid", () => {
  it("packs items in row-major order using each item's footprint", () => {
    const items = [
      { id: "a", w: 2, h: 2 },
      { id: "b", w: 1, h: 1 },
      { id: "c", w: 2, h: 1 },
    ];
    const packed = packInventoryGrid(items, COLS, (item) => ({ w: item.w, h: item.h }));
    expect(packed).toEqual([
      { item: items[0], col: 1, row: 1, w: 2, h: 2 },
      { item: items[1], col: 3, row: 1, w: 1, h: 1 },
      { item: items[2], col: 4, row: 1, w: 2, h: 1 },
    ]);
  });

  it("packs 56 single-cell items into exactly 8 rows on a 7-column board", () => {
    const items = Array.from({ length: 56 }, (_, index) => ({ id: String(index) }));
    const packed = packInventoryGrid(items, COLS, () => ({ w: 1, h: 1 }));
    expect(packed).toHaveLength(56);
    expect(packed[55]).toEqual({ item: items[55], col: 7, row: 8, w: 1, h: 1 });
  });

  it("rolls into a ninth row when there are 57 items", () => {
    const items = Array.from({ length: 57 }, (_, index) => ({ id: String(index) }));
    const packed = packInventoryGrid(items, COLS, () => ({ w: 1, h: 1 }));
    expect(packed[56]).toEqual({ item: items[56], col: 1, row: 9, w: 1, h: 1 });
  });

  it("returns an empty array for an empty input", () => {
    expect(packInventoryGrid([], COLS, () => ({ w: 1, h: 1 }))).toEqual([]);
  });

  it("throws when an item's footprint is wider than the board", () => {
    expect(() => packInventoryGrid([{ id: "wide" }], 2, () => ({ w: 3, h: 1 }))).toThrow(RangeError);
  });

  it("throws on zero-area footprints", () => {
    expect(() => packInventoryGrid([{ id: "x" }], COLS, () => ({ w: 0, h: 1 }))).toThrow(RangeError);
  });
});

describe("packInventoryGridPreserving", () => {
  it("keeps saved positions when they fit and pack the rest sequentially", () => {
    const items = [
      { id: "item1", footprint: { w: 2, h: 2 } },
      { id: "item2", footprint: { w: 2, h: 3 } },
      { id: "item3", footprint: { w: 2, h: 1 } },
    ];
    const saved = {
      item1: { col: 3, row: 1 },
      item2: { col: 1, row: 3 },
    };
    const packed = packInventoryGridPreserving(
      items,
      COLS,
      (item) => item.footprint,
      (item) => saved[item.id as keyof typeof saved],
    );
    expect(packed).toEqual([
      { item: items[0], col: 3, row: 1, w: 2, h: 2 },
      { item: items[1], col: 1, row: 3, w: 2, h: 3 },
      { item: items[2], col: 1, row: 1, w: 2, h: 1 },
    ]);
  });

  it("falls back to first-available when saved positions collide", () => {
    const items = [
      { id: "item1", footprint: { w: 2, h: 2 } },
      { id: "item2", footprint: { w: 2, h: 1 } },
    ];
    const saved = {
      item1: { col: 1, row: 1 },
      item2: { col: 1, row: 1 },
    };
    const packed = packInventoryGridPreserving(
      items,
      COLS,
      (item) => item.footprint,
      (item) => saved[item.id as keyof typeof saved],
    );
    expect(packed[0]).toMatchObject({ item: items[0], col: 1, row: 1 });
    expect(packed[1]?.item).toBe(items[1]);
    expect(packed[1]?.col).toBe(3);
  });

  it("ignores saved positions that are out of bounds", () => {
    const items = [{ id: "a", footprint: { w: 2, h: 2 } }];
    const saved = { a: { col: 0, row: 1 } };
    const packed = packInventoryGridPreserving(
      items,
      COLS,
      (item) => item.footprint,
      (item) => saved[item.id as keyof typeof saved],
    );
    expect(packed[0]).toMatchObject({ item: items[0], col: 1, row: 1 });
  });
});

describe("packCurrencyGridWithGearObstacles", () => {
  it("keeps saved currency positions and packs the rest around gear obstacles", () => {
    const gearObstacles = [{ col: 1, row: 1, w: 2, h: 2 }];
    const saved = {
      voidstone: { col: 4, row: 1 },
      "discordant-dice": { col: 1, row: 1 },
    };
    const packed = packCurrencyGridWithGearObstacles(["voidstone", "discordant-dice"], COLS, saved, gearObstacles);
    expect(packed).toEqual([
      { id: "voidstone", col: 4, row: 1, w: 1, h: 1 },
      { id: "discordant-dice", col: 3, row: 1, w: 1, h: 1 },
    ]);
  });

  it("packs currencies sequentially when no saved positions are valid", () => {
    const packed = packCurrencyGridWithGearObstacles(["a", "b"], COLS, {}, []);
    expect(packed).toEqual([
      { id: "a", col: 1, row: 1, w: 1, h: 1 },
      { id: "b", col: 2, row: 1, w: 1, h: 1 },
    ]);
  });
});

describe("resolveMoveWithSwap", () => {
  it("reports unchanged when the target equals the current position", () => {
    const items: BoardItem[] = [{ id: "a", kind: "gear", footprint: { w: 2, h: 2 }, position: { col: 1, row: 1 } }];
    const { positions, unchanged } = resolveMoveWithSwap(items, "a", { col: 1, row: 1 }, COLS);
    expect(unchanged).toBe(true);
    expect(positions.get("a")).toEqual({ col: 1, row: 1 });
  });

  it("moves the item and keeps non-overlapping items fixed", () => {
    const items: BoardItem[] = [
      { id: "moving", kind: "gear", footprint: { w: 2, h: 2 }, position: { col: 1, row: 1 } },
      { id: "fixed", kind: "gear", footprint: { w: 1, h: 1 }, position: { col: 5, row: 5 } },
    ];
    const { positions, unchanged } = resolveMoveWithSwap(items, "moving", { col: 3, row: 3 }, COLS);
    expect(unchanged).toBe(false);
    expect(positions.get("moving")).toEqual({ col: 3, row: 3 });
    expect(positions.get("fixed")).toEqual({ col: 5, row: 5 });
  });

  it("displaces overlapping items to the closest open position", () => {
    const items: BoardItem[] = [
      { id: "moving", kind: "gear", footprint: { w: 2, h: 2 }, position: { col: 1, row: 1 } },
      { id: "blocker", kind: "gear", footprint: { w: 1, h: 1 }, position: { col: 3, row: 1 } },
    ];
    const { positions } = resolveMoveWithSwap(items, "moving", { col: 3, row: 1 }, COLS);
    expect(positions.get("moving")).toEqual({ col: 3, row: 1 });
    expect(positions.get("blocker")?.col).not.toBe(3);
    expect(positions.get("blocker")?.row).toBe(1);
  });

  it("places the largest displaced footprint first", () => {
    const items: BoardItem[] = [
      { id: "moving", kind: "gear", footprint: { w: 1, h: 1 }, position: { col: 1, row: 1 } },
      { id: "small", kind: "gear", footprint: { w: 1, h: 1 }, position: { col: 3, row: 1 } },
      { id: "large", kind: "gear", footprint: { w: 2, h: 2 }, position: { col: 4, row: 1 } },
    ];
    const { positions } = resolveMoveWithSwap(items, "moving", { col: 3, row: 1 }, COLS);
    expect(positions.get("moving")).toEqual({ col: 3, row: 1 });
    expect(positions.get("large")).toBeDefined();
    expect(positions.get("small")).toBeDefined();
  });

  it("returns the original positions when the moving id is not found", () => {
    const items: BoardItem[] = [{ id: "a", kind: "gear", footprint: { w: 1, h: 1 }, position: { col: 1, row: 1 } }];
    const { positions, unchanged } = resolveMoveWithSwap(items, "missing", { col: 5, row: 5 }, COLS);
    expect(unchanged).toBe(true);
    expect(positions.get("a")).toEqual({ col: 1, row: 1 });
  });

  it("preserves the original position of fixed items exactly", () => {
    const items: BoardItem[] = [
      { id: "moving", kind: "gear", footprint: { w: 2, h: 2 }, position: { col: 1, row: 1 } },
      { id: "fixed", kind: "gear", footprint: { w: 1, h: 1 }, position: { col: 6, row: 6 } },
    ];
    const { positions } = resolveMoveWithSwap(items, "moving", { col: 4, row: 4 }, COLS);
    expect(positions.get("fixed")).toEqual({ col: 6, row: 6 });
  });

  it("places a 1x1 currency into the 1x1 vacated slot when both items are 1x1", () => {
    const items: BoardItem<"currency">[] = [
      { id: "moving", kind: "currency", footprint: { w: 1, h: 1 }, position: { col: 1, row: 1 } },
      { id: "blocker", kind: "currency", footprint: { w: 1, h: 1 }, position: { col: 3, row: 3 } },
    ];
    const { positions } = resolveMoveWithSwap(items, "moving", { col: 3, row: 3 }, COLS);
    expect(positions.get("moving")).toEqual({ col: 3, row: 3 });
    expect(positions.get("blocker")?.col).toBeDefined();
  });
});
