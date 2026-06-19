import { canPlace, markPlaced, findPlacement } from "./inventory-layout";
import type { GearFootprint, InventoryPlacement, BoardItem } from "./inventory-layout";

export type { GearFootprint, InventoryPlacement, BoardItem };

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
    const pos = findPlacement(occupancy, footprint, cols);
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
    const pos = findPlacement(occupancy, footprint, cols);
    markPlaced(occupancy, pos.col, pos.row, footprint, cols);
    packed.push({ item, col: pos.col, row: pos.row, w: footprint.w, h: footprint.h });
  }

  return packed;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- TKind constrains kind field relationship across items
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
    const pos = findPlacement(occupancy, footprint, cols);
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
    const pos = findPlacement(occupancy, CURRENCY_FOOTPRINT, cols);
    markPlaced(occupancy, pos.col, pos.row, CURRENCY_FOOTPRINT, cols);
    packed.push({ id, col: pos.col, row: pos.row, w: 1, h: 1 });
  }

  return packed;
}

export { resolveMoveWithSwap } from "./inventory-layout";
