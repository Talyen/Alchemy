import type { GearFootprint } from "./footprints";
import type { InventoryPlacement } from "./inventory-placement";

type GridItemInput = {
  id: string;
  w: number;
  h: number;
  saved?: { col: number; row: number } | undefined;
};

type Obstacle = { col: number; row: number; w: number; h: number };

export type PackedGridItem<T> = { item: T; col: number; row: number; w: number; h: number };

function ensureRows(occupancy: boolean[][], rows: number, cols: number): void {
  while (occupancy.length < rows) {
    occupancy.push(Array.from({ length: cols }, () => false));
  }
}

export function canPlace(
  occupancy: boolean[][],
  col: number,
  row: number,
  footprint: GearFootprint,
  cols: number,
): boolean {
  if (col < 1 || row < 1 || col + footprint.w - 1 > cols) return false;
  ensureRows(occupancy, row + footprint.h - 1, cols);
  for (let y = row - 1; y < row - 1 + footprint.h; y++) {
    for (let x = col - 1; x < col - 1 + footprint.w; x++) {
      if (occupancy[y]?.[x]) return false;
    }
  }
  return true;
}

export function markPlaced(
  occupancy: boolean[][],
  col: number,
  row: number,
  footprint: GearFootprint,
  cols: number,
): void {
  ensureRows(occupancy, row + footprint.h - 1, cols);
  for (let y = row - 1; y < row - 1 + footprint.h; y++) {
    for (let x = col - 1; x < col - 1 + footprint.w; x++) {
      if (occupancy[y]) occupancy[y]![x] = true;
    }
  }
}

export function findPlacement(
  occupancy: boolean[][],
  footprint: GearFootprint,
  cols: number,
): { col: number; row: number } {
  for (let row = 1; ; row++) {
    for (let col = 1; col <= cols - footprint.w + 1; col++) {
      if (canPlace(occupancy, col, row, footprint, cols)) return { col, row };
    }
  }
}

export function overlaps(
  a: { col: number; row: number; w: number; h: number },
  b: { col: number; row: number; w: number; h: number },
): boolean {
  return !(a.col + a.w <= b.col || b.col + b.w <= a.col || a.row + a.h <= b.row || b.row + b.h <= a.row);
}

export function packGridItems<T extends GridItemInput>(
  items: T[],
  cols: number,
  options: {
    reservedItems?: readonly T[];
    blockedCells?: readonly Obstacle[];
  } = {},
): { items: PackedGridItem<T>[]; occupiedRows: number } {
  const { reservedItems = [], blockedCells = [] } = options;
  const packedItems: PackedGridItem<T>[] = [];
  const occupancy: boolean[][] = [];
  let occupiedRows = 0;
  const visibleIds = new Set(items.map((item) => item.id));

  for (const cell of blockedCells) {
    if (cell.col < 1 || cell.row < 1 || cell.col + cell.w - 1 > cols) continue;
    markPlaced(occupancy, cell.col, cell.row, { w: cell.w, h: cell.h }, cols);
    occupiedRows = Math.max(occupiedRows, cell.row - 1 + cell.h);
  }

  for (const item of reservedItems) {
    if (visibleIds.has(item.id)) continue;
    const saved = item.saved;
    if (!saved || saved.col < 1 || saved.row < 1 || saved.col + item.w - 1 > cols) continue;
    if (!canPlace(occupancy, saved.col, saved.row, { w: item.w, h: item.h }, cols)) continue;
    markPlaced(occupancy, saved.col, saved.row, { w: item.w, h: item.h }, cols);
    occupiedRows = Math.max(occupiedRows, saved.row - 1 + item.h);
  }

  const remainingItems: T[] = [];

  for (const item of items) {
    const saved = item.saved;
    if (saved && saved.col >= 1 && saved.row >= 1 && saved.col + item.w - 1 <= cols) {
      if (canPlace(occupancy, saved.col, saved.row, { w: item.w, h: item.h }, cols)) {
        markPlaced(occupancy, saved.col, saved.row, { w: item.w, h: item.h }, cols);
        packedItems.push({
          item,
          col: saved.col,
          row: saved.row,
          w: item.w,
          h: item.h,
        });
        occupiedRows = Math.max(occupiedRows, saved.row - 1 + item.h);
        continue;
      }
    }
    remainingItems.push(item);
  }

  for (const item of remainingItems) {
    if (item.w < 1 || item.h < 1 || item.w > cols) {
      throw new RangeError(`Inventory footprint ${item.w}x${item.h} does not fit ${cols}-column board`);
    }
    const position = findPlacement(occupancy, { w: item.w, h: item.h }, cols);
    packedItems.push({ item, col: position.col, row: position.row, w: item.w, h: item.h });
    markPlaced(occupancy, position.col, position.row, { w: item.w, h: item.h }, cols);
    occupiedRows = Math.max(occupiedRows, position.row - 1 + item.h);
  }

  return { items: packedItems, occupiedRows };
}

export function packInventoryGrid<T>(
  items: T[],
  cols: number,
  getFootprint: (item: T) => GearFootprint,
): PackedGridItem<T>[] {
  return packGridItems(
    items.map((item, idx) => {
      const footprint = getFootprint(item);
      return { id: String(idx), w: footprint.w, h: footprint.h, originalItem: item };
    }),
    cols,
  ).items.map((packed) => ({
    item: packed.item.originalItem,
    col: packed.col,
    row: packed.row,
    w: packed.w,
    h: packed.h,
  }));
}

export function packInventoryGridPreserving<T extends { id: string }>(
  items: T[],
  cols: number,
  getFootprint: (item: T) => GearFootprint,
  getSavedPosition: (item: T) => InventoryPlacement | undefined,
): PackedGridItem<T>[] {
  return packGridItems(
    items.map((item) => {
      const footprint = getFootprint(item);
      return { id: item.id, w: footprint.w, h: footprint.h, saved: getSavedPosition(item), originalItem: item };
    }),
    cols,
  ).items.map((packed) => ({
    item: packed.item.originalItem,
    col: packed.col,
    row: packed.row,
    w: packed.w,
    h: packed.h,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- TKind constrains kind field relationship across items
export function packMixedBoard<TKind extends string, TItem extends { id: string; kind: TKind }>(
  items: TItem[],
  cols: number,
  getFootprint: (item: TItem) => GearFootprint,
  getSavedPosition: (item: TItem) => InventoryPlacement | undefined,
): { item: TItem; col: number; row: number }[] {
  return packGridItems(
    items.map((item) => {
      const footprint = getFootprint(item);
      return { id: item.id, w: footprint.w, h: footprint.h, saved: getSavedPosition(item), originalItem: item };
    }),
    cols,
  ).items.map((packed) => ({
    item: packed.item.originalItem,
    col: packed.col,
    row: packed.row,
  }));
}

export function packCurrencyGridWithGearObstacles(
  currencyIds: string[],
  cols: number,
  savedPositions: Record<string, InventoryPlacement | undefined>,
  gearObstacles: { col: number; row: number; w: number; h: number }[],
): { id: string; col: number; row: number; w: 1; h: 1 }[] {
  const result = packGridItems(
    currencyIds.map((id) => ({ id, w: 1, h: 1, saved: savedPositions[id] })),
    cols,
    { blockedCells: gearObstacles },
  );
  return result.items.map((packed) => ({
    id: packed.item.id,
    col: packed.col,
    row: packed.row,
    w: 1 as const,
    h: 1 as const,
  }));
}
