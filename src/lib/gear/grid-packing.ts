import type { GearFootprint, InventoryPlacement } from "./inventory-layout";

export type { GearFootprint, InventoryPlacement };

export type BoardItem<TKind extends string = string> = {
  id: string;
  kind: TKind;
  footprint: GearFootprint;
  position: InventoryPlacement;
};

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

function findFirstAvailable(occupancy: boolean[][], footprint: GearFootprint, cols: number): InventoryPlacement {
  for (let row = 1; ; row++) {
    for (let col = 1; col <= cols - footprint.w + 1; col++) {
      if (canPlace(occupancy, col, row, footprint, cols)) return { col, row };
    }
  }
}

function overlaps(
  a: { col: number; row: number; w: number; h: number },
  b: { col: number; row: number; w: number; h: number },
): boolean {
  return !(a.col + a.w <= b.col || b.col + b.w <= a.col || a.row + a.h <= b.row || b.row + b.h <= a.row);
}

export function packInventoryGrid<T>(
  items: T[],
  cols: number,
  getFootprint: (item: T) => GearFootprint,
): { item: T; col: number; row: number; w: number; h: number }[] {
  const occupancy: boolean[][] = [];
  const packed: { item: T; col: number; row: number; w: number; h: number }[] = [];

  for (const item of items) {
    const footprint = getFootprint(item);
    if (footprint.w < 1 || footprint.h < 1 || footprint.w > cols) {
      throw new RangeError(`Grid footprint ${footprint.w}x${footprint.h} does not fit ${cols}-column board`);
    }
    const pos = findFirstAvailable(occupancy, footprint, cols);
    markPlaced(occupancy, pos.col, pos.row, footprint, cols);
    packed.push({ item, col: pos.col, row: pos.row, w: footprint.w, h: footprint.h });
  }

  return packed;
}

export function packInventoryGridPreserving<T extends { id: string }>(
  items: T[],
  cols: number,
  getFootprint: (item: T) => GearFootprint,
  getSavedPosition: (item: T) => InventoryPlacement | undefined,
): { item: T; col: number; row: number; w: number; h: number }[] {
  const occupancy: boolean[][] = [];
  const packed: { item: T; col: number; row: number; w: number; h: number }[] = [];
  const remaining: T[] = [];

  for (const item of items) {
    const footprint = getFootprint(item);
    const saved = getSavedPosition(item);
    if (saved && canPlace(occupancy, saved.col, saved.row, footprint, cols)) {
      markPlaced(occupancy, saved.col, saved.row, footprint, cols);
      packed.push({ item, col: saved.col, row: saved.row, w: footprint.w, h: footprint.h });
    } else {
      remaining.push(item);
    }
  }

  for (const item of remaining) {
    const footprint = getFootprint(item);
    if (footprint.w < 1 || footprint.h < 1 || footprint.w > cols) {
      throw new RangeError(`Grid footprint ${footprint.w}x${footprint.h} does not fit ${cols}-column board`);
    }
    const pos = findFirstAvailable(occupancy, footprint, cols);
    markPlaced(occupancy, pos.col, pos.row, footprint, cols);
    packed.push({ item, col: pos.col, row: pos.row, w: footprint.w, h: footprint.h });
  }

  return packed;
}

export function packMixedBoard<TKind extends string, TItem extends { id: string; kind: TKind }>(
  items: TItem[],
  cols: number,
  getFootprint: (item: TItem) => GearFootprint,
  getSavedPosition: (item: TItem) => InventoryPlacement | undefined,
): { item: TItem; col: number; row: number }[] {
  const occupancy: boolean[][] = [];
  const packed: { item: TItem; col: number; row: number }[] = [];
  const remaining: TItem[] = [];

  for (const item of items) {
    const footprint = getFootprint(item);
    const saved = getSavedPosition(item);
    if (saved && canPlace(occupancy, saved.col, saved.row, footprint, cols)) {
      markPlaced(occupancy, saved.col, saved.row, footprint, cols);
      packed.push({ item, col: saved.col, row: saved.row });
    } else {
      remaining.push(item);
    }
  }

  for (const item of remaining) {
    const footprint = getFootprint(item);
    if (footprint.w < 1 || footprint.h < 1 || footprint.w > cols) {
      throw new RangeError(`Grid footprint ${footprint.w}x${footprint.h} does not fit ${cols}-column board`);
    }
    const pos = findFirstAvailable(occupancy, footprint, cols);
    markPlaced(occupancy, pos.col, pos.row, footprint, cols);
    packed.push({ item, col: pos.col, row: pos.row });
  }

  return packed;
}

export function packCurrencyGridWithGearObstacles(
  currencyIds: string[],
  cols: number,
  savedPositions: Record<string, InventoryPlacement | undefined>,
  gearObstacles: { col: number; row: number; w: number; h: number }[],
): { id: string; col: number; row: number; w: 1; h: 1 }[] {
  const occupancy: boolean[][] = [];
  const packed: { id: string; col: number; row: number; w: 1; h: 1 }[] = [];
  const CURRENCY_FOOTPRINT: GearFootprint = { w: 1, h: 1 };

  for (const obstacle of gearObstacles) {
    markPlaced(occupancy, obstacle.col, obstacle.row, { w: obstacle.w, h: obstacle.h }, cols);
  }

  const remaining: string[] = [];

  for (const id of currencyIds) {
    const saved = savedPositions[id];
    if (saved && canPlace(occupancy, saved.col, saved.row, CURRENCY_FOOTPRINT, cols)) {
      markPlaced(occupancy, saved.col, saved.row, CURRENCY_FOOTPRINT, cols);
      packed.push({ id, col: saved.col, row: saved.row, w: 1, h: 1 });
    } else {
      remaining.push(id);
    }
  }

  for (const id of remaining) {
    const pos = findFirstAvailable(occupancy, CURRENCY_FOOTPRINT, cols);
    markPlaced(occupancy, pos.col, pos.row, CURRENCY_FOOTPRINT, cols);
    packed.push({ id, col: pos.col, row: pos.row, w: 1, h: 1 });
  }

  return packed;
}

export function resolveMoveWithSwap<TKind extends string>(
  items: BoardItem<TKind>[],
  movingId: string,
  target: InventoryPlacement,
  cols: number,
  options: { maxSearchRows?: number } = {},
): { positions: Map<string, InventoryPlacement>; unchanged: boolean } {
  const { maxSearchRows = 40 } = options;
  const positions = new Map<string, InventoryPlacement>();
  for (const item of items) positions.set(item.id, item.position);

  const moving = items.find((item) => item.id === movingId);
  if (!moving) return { positions, unchanged: true };
  if (moving.position.col === target.col && moving.position.row === target.row) {
    return { positions, unchanged: true };
  }

  const targetRect = {
    col: target.col,
    row: target.row,
    w: moving.footprint.w,
    h: moving.footprint.h,
  };
  const others = items.filter((item) => item.id !== movingId);
  const displaced: BoardItem<TKind>[] = [];
  const fixed: BoardItem<TKind>[] = [];
  for (const item of others) {
    const itemRect = { col: item.position.col, row: item.position.row, w: item.footprint.w, h: item.footprint.h };
    if (overlaps(targetRect, itemRect)) displaced.push(item);
    else fixed.push(item);
  }
  displaced.sort((a, b) => b.footprint.w * b.footprint.h - a.footprint.w * a.footprint.h);

  const placed: BoardItem<TKind>[] = [{ ...moving, position: target }, ...fixed];

  const isOccupied = (col: number, row: number, w: number, h: number): boolean => {
    if (col < 1 || col + w - 1 > cols || row < 1) return true;
    return placed.some((p) =>
      overlaps({ col: p.position.col, row: p.position.row, w: p.footprint.w, h: p.footprint.h }, { col, row, w, h }),
    );
  };

  for (const item of displaced) {
    let bestCol = 1;
    let bestRow = 1;
    let bestDistanceSq = Number.POSITIVE_INFINITY;
    const origCenterX = item.position.col + (item.footprint.w - 1) / 2;
    const origCenterY = item.position.row + (item.footprint.h - 1) / 2;

    for (let r = 1; r <= maxSearchRows; r++) {
      for (let c = 1; c <= cols - item.footprint.w + 1; c++) {
        if (isOccupied(c, r, item.footprint.w, item.footprint.h)) continue;
        const candCenterX = c + (item.footprint.w - 1) / 2;
        const candCenterY = r + (item.footprint.h - 1) / 2;
        const dx = origCenterX - candCenterX;
        const dy = origCenterY - candCenterY;
        const distSq = dx * dx + dy * dy;
        if (distSq < bestDistanceSq) {
          bestDistanceSq = distSq;
          bestCol = c;
          bestRow = r;
        }
      }
    }

    const next: BoardItem<TKind> = { ...item, position: { col: bestCol, row: bestRow } };
    placed.push(next);
  }

  for (const item of placed) positions.set(item.id, item.position);
  return { positions, unchanged: false };
}

export const __gridPackingInternals = {
  canPlace,
  markPlaced,
  findFirstAvailable,
  ensureRows,
  overlaps,
};
