import type { GearFootprint } from "./footprints";

interface GridItemInput {
  id: string;
  w: number;
  h: number;
  saved?: { col: number; row: number } | undefined;
}

interface Obstacle {
  col: number;
  row: number;
  w: number;
  h: number;
}

export interface PackedGridItem<T> {
  item: T;
  col: number;
  row: number;
  w: number;
  h: number;
}

function ensureRows(occupancy: boolean[][], rows: number, cols: number): void {
  while (occupancy.length < rows) {
    occupancy.push(Array.from({ length: cols }, () => false));
  }
}

function canPlace(occupancy: boolean[][], col: number, row: number, footprint: GearFootprint, cols: number): boolean {
  if (col < 1 || row < 1 || col + footprint.w - 1 > cols) return false;
  ensureRows(occupancy, row + footprint.h - 1, cols);
  for (let y = row - 1; y < row - 1 + footprint.h; y++) {
    for (let x = col - 1; x < col - 1 + footprint.w; x++) {
      if (occupancy[y]?.[x]) return false;
    }
  }
  return true;
}

function markPlaced(occupancy: boolean[][], col: number, row: number, footprint: GearFootprint, cols: number): void {
  ensureRows(occupancy, row + footprint.h - 1, cols);
  for (let y = row - 1; y < row - 1 + footprint.h; y++) {
    for (let x = col - 1; x < col - 1 + footprint.w; x++) {
      if (occupancy[y]) occupancy[y]![x] = true;
    }
  }
}

function findPlacement(occupancy: boolean[][], footprint: GearFootprint, cols: number): { col: number; row: number } {
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

function placeBlockedCells(occupancy: boolean[][], blockedCells: readonly Obstacle[], cols: number): number {
  let occupiedRows = 0;
  for (const cell of blockedCells) {
    if (cell.col < 1 || cell.row < 1 || cell.col + cell.w - 1 > cols) continue;
    markPlaced(occupancy, cell.col, cell.row, { w: cell.w, h: cell.h }, cols);
    occupiedRows = Math.max(occupiedRows, cell.row - 1 + cell.h);
  }
  return occupiedRows;
}

function placeReservedItems<T extends GridItemInput>(
  occupancy: boolean[][],
  reservedItems: readonly T[],
  visibleIds: Set<string>,
  cols: number,
): number {
  let occupiedRows = 0;
  for (const item of reservedItems) {
    if (visibleIds.has(item.id)) continue;
    const saved = item.saved;
    if (!saved || saved.col < 1 || saved.row < 1 || saved.col + item.w - 1 > cols) continue;
    if (!canPlace(occupancy, saved.col, saved.row, { w: item.w, h: item.h }, cols)) continue;
    markPlaced(occupancy, saved.col, saved.row, { w: item.w, h: item.h }, cols);
    occupiedRows = Math.max(occupiedRows, saved.row - 1 + item.h);
  }
  return occupiedRows;
}

function placeSavedItems<T extends GridItemInput>(
  occupancy: boolean[][],
  items: T[],
  cols: number,
  packedItems: Array<PackedGridItem<T>>,
): { remainingItems: T[]; occupiedRows: number } {
  let occupiedRows = 0;
  const remainingItems: T[] = [];

  for (const item of items) {
    const saved = item.saved;
    if (saved && saved.col >= 1 && saved.row >= 1 && saved.col + item.w - 1 <= cols) {
      if (canPlace(occupancy, saved.col, saved.row, { w: item.w, h: item.h }, cols)) {
        markPlaced(occupancy, saved.col, saved.row, { w: item.w, h: item.h }, cols);
        packedItems.push({ item, col: saved.col, row: saved.row, w: item.w, h: item.h });
        occupiedRows = Math.max(occupiedRows, saved.row - 1 + item.h);
        continue;
      }
    }
    remainingItems.push(item);
  }

  return { remainingItems, occupiedRows };
}

function placeRemainingItems<T extends GridItemInput>(
  occupancy: boolean[][],
  items: T[],
  cols: number,
  packedItems: Array<PackedGridItem<T>>,
): number {
  let occupiedRows = 0;
  for (const item of items) {
    if (item.w < 1 || item.h < 1 || item.w > cols) {
      throw new RangeError(`Inventory footprint ${item.w}x${item.h} does not fit ${cols}-column board`);
    }
    const position = findPlacement(occupancy, { w: item.w, h: item.h }, cols);
    packedItems.push({ item, col: position.col, row: position.row, w: item.w, h: item.h });
    markPlaced(occupancy, position.col, position.row, { w: item.w, h: item.h }, cols);
    occupiedRows = Math.max(occupiedRows, position.row - 1 + item.h);
  }
  return occupiedRows;
}

export function packGridItems<T extends GridItemInput>(
  items: T[],
  cols: number,
  options: {
    reservedItems?: readonly T[];
    blockedCells?: readonly Obstacle[];
  } = {},
): { items: Array<PackedGridItem<T>>; occupiedRows: number } {
  const { reservedItems = [], blockedCells = [] } = options;
  const packedItems: Array<PackedGridItem<T>> = [];
  const occupancy: boolean[][] = [];
  const visibleIds = new Set(items.map((item) => item.id));

  const blockedRows = placeBlockedCells(occupancy, blockedCells, cols);
  const reservedRows = placeReservedItems(occupancy, reservedItems, visibleIds, cols);
  const { remainingItems, occupiedRows: savedRows } = placeSavedItems(occupancy, items, cols, packedItems);
  const fillRows = placeRemainingItems(occupancy, remainingItems, cols, packedItems);

  return { items: packedItems, occupiedRows: Math.max(blockedRows, reservedRows, savedRows, fillRows) };
}
