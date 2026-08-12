import { describe, expect, it } from "vitest";
import { packGridItems } from "@/lib/gear/grid-packing";
import { boardItemKey, resolveMoveWithSwap, type BoardItem } from "@/lib/gear/board-moves";

const COLS = 8;
const pos = (positions: Map<string, { col: number; row: number }>, item: Pick<BoardItem, "id" | "kind">) =>
  positions.get(boardItemKey(item));

describe("packGridItems", () => {
  it("packs items in row-major order using each item's footprint", () => {
    const items = [
      { id: "a", w: 2, h: 2 },
      { id: "b", w: 1, h: 1 },
      { id: "c", w: 2, h: 1 },
    ];
    const packed = packGridItems(items, COLS).items;
    expect(packed).toEqual([
      { item: items[0], col: 1, row: 1, w: 2, h: 2 },
      { item: items[1], col: 3, row: 1, w: 1, h: 1 },
      { item: items[2], col: 4, row: 1, w: 2, h: 1 },
    ]);
  });

  it("packs 56 single-cell items into exactly 7 rows on an 8-column board", () => {
    const items = Array.from({ length: 56 }, (_, index) => ({ id: String(index), w: 1, h: 1 }));
    const packed = packGridItems(items, COLS).items;
    expect(packed).toHaveLength(56);
    expect(packed[55]).toEqual({ item: items[55], col: 8, row: 7, w: 1, h: 1 });
  });

  it("rolls into an eighth row when there are 57 items", () => {
    const items = Array.from({ length: 57 }, (_, index) => ({ id: String(index), w: 1, h: 1 }));
    const packed = packGridItems(items, COLS).items;
    expect(packed[56]).toEqual({ item: items[56], col: 1, row: 8, w: 1, h: 1 });
  });

  it("returns an empty array for an empty input", () => {
    expect(packGridItems([], COLS).items).toEqual([]);
  });

  it("throws when an item's footprint is wider than the board", () => {
    expect(() => packGridItems([{ id: "wide", w: 3, h: 1 }], 2)).toThrow(RangeError);
  });

  it("throws on zero-area footprints", () => {
    expect(() => packGridItems([{ id: "x", w: 0, h: 1 }], COLS)).toThrow(RangeError);
  });

  it("keeps saved positions when they fit and pack the rest sequentially", () => {
    const items = [
      { id: "item1", w: 2, h: 2, saved: { col: 3, row: 1 } },
      { id: "item2", w: 2, h: 3, saved: { col: 1, row: 3 } },
      { id: "item3", w: 2, h: 1 },
    ];
    const packed = packGridItems(items, COLS).items;
    expect(packed).toEqual([
      { item: items[0], col: 3, row: 1, w: 2, h: 2 },
      { item: items[1], col: 1, row: 3, w: 2, h: 3 },
      { item: items[2], col: 1, row: 1, w: 2, h: 1 },
    ]);
  });

  it("falls back to first-available when saved positions collide", () => {
    const items = [
      { id: "item1", w: 2, h: 2, saved: { col: 1, row: 1 } },
      { id: "item2", w: 2, h: 1, saved: { col: 1, row: 1 } },
    ];
    const packed = packGridItems(items, COLS).items;
    expect(packed[0]).toMatchObject({ item: items[0], col: 1, row: 1 });
    expect(packed[1]?.item).toBe(items[1]);
    expect(packed[1]?.col).toBe(3);
  });

  it("ignores saved positions that are out of bounds", () => {
    const items = [{ id: "a", w: 2, h: 2, saved: { col: 0, row: 1 } }];
    const packed = packGridItems(items, COLS).items;
    expect(packed[0]).toMatchObject({ item: items[0], col: 1, row: 1 });
  });

  it("keeps saved currency positions and packs the rest around gear obstacles", () => {
    const packed = packGridItems(
      [
        { id: "voidstone", w: 1, h: 1, saved: { col: 4, row: 1 } },
        { id: "discordant-dice", w: 1, h: 1, saved: { col: 1, row: 1 } },
      ],
      COLS,
      { blockedCells: [{ col: 1, row: 1, w: 2, h: 2 }] },
    ).items;
    expect(packed).toEqual([
      { item: { id: "voidstone", w: 1, h: 1, saved: { col: 4, row: 1 } }, col: 4, row: 1, w: 1, h: 1 },
      { item: { id: "discordant-dice", w: 1, h: 1, saved: { col: 1, row: 1 } }, col: 3, row: 1, w: 1, h: 1 },
    ]);
  });

  it("packs currencies sequentially when no saved positions are valid", () => {
    const packed = packGridItems(
      [
        { id: "a", w: 1, h: 1 },
        { id: "b", w: 1, h: 1 },
      ],
      COLS,
    ).items;
    expect(packed).toEqual([
      { item: { id: "a", w: 1, h: 1 }, col: 1, row: 1, w: 1, h: 1 },
      { item: { id: "b", w: 1, h: 1 }, col: 2, row: 1, w: 1, h: 1 },
    ]);
  });
});

describe("resolveMoveWithSwap", () => {
  it("reports unchanged when the target equals the current position", () => {
    const items: BoardItem[] = [{ id: "a", kind: "gear", footprint: { w: 2, h: 2 }, position: { col: 1, row: 1 } }];
    const { positions, unchanged } = resolveMoveWithSwap(items, { kind: "gear", id: "a" }, { col: 1, row: 1 }, COLS);
    expect(unchanged).toBe(true);
    expect(pos(positions, items[0]!)).toEqual({ col: 1, row: 1 });
  });

  it("moves the item and keeps non-overlapping items fixed", () => {
    const items: BoardItem[] = [
      { id: "moving", kind: "gear", footprint: { w: 2, h: 2 }, position: { col: 1, row: 1 } },
      { id: "fixed", kind: "gear", footprint: { w: 1, h: 1 }, position: { col: 5, row: 5 } },
    ];
    const { positions, unchanged } = resolveMoveWithSwap(
      items,
      { kind: "gear", id: "moving" },
      { col: 3, row: 3 },
      COLS,
    );
    expect(unchanged).toBe(false);
    expect(pos(positions, items[0]!)).toEqual({ col: 3, row: 3 });
    expect(pos(positions, items[1]!)).toEqual({ col: 5, row: 5 });
  });

  it("displaces overlapping items to the closest open position", () => {
    const items: BoardItem[] = [
      { id: "moving", kind: "gear", footprint: { w: 2, h: 2 }, position: { col: 1, row: 1 } },
      { id: "blocker", kind: "gear", footprint: { w: 1, h: 1 }, position: { col: 3, row: 1 } },
    ];
    const { positions } = resolveMoveWithSwap(items, { kind: "gear", id: "moving" }, { col: 3, row: 1 }, COLS);
    expect(pos(positions, items[0]!)).toEqual({ col: 3, row: 1 });
    expect(pos(positions, items[1]!)?.col).not.toBe(3);
    expect(pos(positions, items[1]!)?.row).toBe(1);
  });

  it("places the largest displaced footprint first", () => {
    const items: BoardItem[] = [
      { id: "moving", kind: "gear", footprint: { w: 1, h: 1 }, position: { col: 1, row: 1 } },
      { id: "small", kind: "gear", footprint: { w: 1, h: 1 }, position: { col: 3, row: 1 } },
      { id: "large", kind: "gear", footprint: { w: 2, h: 2 }, position: { col: 4, row: 1 } },
    ];
    const { positions } = resolveMoveWithSwap(items, { kind: "gear", id: "moving" }, { col: 3, row: 1 }, COLS);
    expect(pos(positions, items[0]!)).toEqual({ col: 3, row: 1 });
    expect(pos(positions, items[2]!)).toBeDefined();
    expect(pos(positions, items[1]!)).toBeDefined();
  });

  it("returns the original positions when the moving id is not found", () => {
    const items: BoardItem[] = [{ id: "a", kind: "gear", footprint: { w: 1, h: 1 }, position: { col: 1, row: 1 } }];
    const { positions, unchanged } = resolveMoveWithSwap(
      items,
      { kind: "gear", id: "missing" },
      { col: 5, row: 5 },
      COLS,
    );
    expect(unchanged).toBe(true);
    expect(pos(positions, items[0]!)).toEqual({ col: 1, row: 1 });
  });

  it("preserves the original position of fixed items exactly", () => {
    const items: BoardItem[] = [
      { id: "moving", kind: "gear", footprint: { w: 2, h: 2 }, position: { col: 1, row: 1 } },
      { id: "fixed", kind: "gear", footprint: { w: 1, h: 1 }, position: { col: 6, row: 6 } },
    ];
    const { positions } = resolveMoveWithSwap(items, { kind: "gear", id: "moving" }, { col: 4, row: 4 }, COLS);
    expect(pos(positions, items[1]!)).toEqual({ col: 6, row: 6 });
  });

  it("places a 1x1 currency into the 1x1 vacated slot when both items are 1x1", () => {
    const items: Array<BoardItem<"currency">> = [
      { id: "moving", kind: "currency", footprint: { w: 1, h: 1 }, position: { col: 1, row: 1 } },
      { id: "blocker", kind: "currency", footprint: { w: 1, h: 1 }, position: { col: 3, row: 3 } },
    ];
    const { positions } = resolveMoveWithSwap(items, { kind: "currency", id: "moving" }, { col: 3, row: 3 }, COLS);
    expect(pos(positions, items[0]!)).toEqual({ col: 3, row: 3 });
    expect(pos(positions, items[1]!)?.col).toBeDefined();
  });

  it("keeps gear and currency ids distinct when their raw ids match", () => {
    const items: BoardItem[] = [
      { id: "voidstone", kind: "gear", footprint: { w: 1, h: 1 }, position: { col: 1, row: 1 } },
      { id: "voidstone", kind: "currency", footprint: { w: 1, h: 1 }, position: { col: 3, row: 1 } },
    ];
    const { positions } = resolveMoveWithSwap(items, { kind: "gear", id: "voidstone" }, { col: 3, row: 1 }, COLS);
    expect(pos(positions, items[0]!)).toEqual({ col: 3, row: 1 });
    expect(pos(positions, items[1]!)).toBeDefined();
    expect(pos(positions, items[1]!)).not.toEqual(pos(positions, items[0]!));
  });
});
