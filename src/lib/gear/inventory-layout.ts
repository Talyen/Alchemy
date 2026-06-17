import { gearDefinitions } from "./definitions";
import type { GearBoardPositions, GearDefinition, GearInstance, GearSlot } from "./types";

export type GearFootprint = { w: number; h: number };

export const INVENTORY_COLS = 7;
export const INVENTORY_VISIBLE_ROWS = 8;

export const GEAR_FOOTPRINT: Record<GearSlot, GearFootprint> = {
  helm: { w: 2, h: 2 },
  body: { w: 2, h: 3 },
  "main-hand": { w: 2, h: 3 },
  "off-hand": { w: 2, h: 3 },
  gloves: { w: 2, h: 2 },
  boots: { w: 2, h: 2 },
  belt: { w: 2, h: 1 },
  amulet: { w: 1, h: 1 },
  "left-ring": { w: 1, h: 1 },
  "right-ring": { w: 1, h: 1 },
};

export type PackedInventoryItem<T = GearInstance> = {
  item: T;
  col: number;
  row: number;
  w: number;
  h: number;
};

export type PackedInventory<T = GearInstance> = {
  items: PackedInventoryItem<T>[];
  occupiedRows: number;
};

export type InventoryPlacement = { col: number; row: number };

export type InventoryGridMetrics = {
  cellSize: number;
  gap: number;
  cols: number;
  rows: number;
};

function ensureRows(occupancy: boolean[][], rows: number, cols: number): void {
  while (occupancy.length < rows) {
    occupancy.push(Array.from({ length: cols }, () => false));
  }
}

function canPlace(occupancy: boolean[][], col: number, row: number, footprint: GearFootprint, cols: number): boolean {
  if (col + footprint.w > cols) return false;
  ensureRows(occupancy, row + footprint.h, cols);
  for (let y = row; y < row + footprint.h; y++) {
    for (let x = col; x < col + footprint.w; x++) {
      if (occupancy[y]![x]) return false;
    }
  }
  return true;
}

export function inventoryPlacementCollides<T extends { instanceId: string }>(
  items: PackedInventoryItem<T>[],
  draggedInstanceId: string,
  placement: InventoryPlacement,
  footprint: GearFootprint,
  cols: number,
): boolean {
  if (placement.col < 1 || placement.row < 1 || placement.col + footprint.w - 1 > cols) return true;

  return items.some((item) => {
    if (item.item.instanceId === draggedInstanceId) return false;
    return !(
      placement.col + footprint.w <= item.col ||
      item.col + item.w <= placement.col ||
      placement.row + footprint.h <= item.row ||
      item.row + item.h <= placement.row
    );
  });
}

export function inventoryPlacementRect(
  placement: InventoryPlacement,
  footprint: GearFootprint,
  metrics: Pick<InventoryGridMetrics, "cellSize" | "gap">,
): { left: number; top: number; width: number; height: number } {
  const stride = metrics.cellSize + metrics.gap;
  return {
    left: (placement.col - 1) * stride,
    top: (placement.row - 1) * stride,
    width: footprint.w * metrics.cellSize + (footprint.w - 1) * metrics.gap,
    height: footprint.h * metrics.cellSize + (footprint.h - 1) * metrics.gap,
  };
}

export function findNearestInventoryPlacement<T extends { instanceId: string }>(
  items: PackedInventoryItem<T>[],
  draggedInstanceId: string,
  footprint: GearFootprint,
  metrics: InventoryGridMetrics,
  targetCenter: { x: number; y: number },
): InventoryPlacement | null {
  let nearest: InventoryPlacement | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const lastRow = Math.max(1, metrics.rows - footprint.h + 1);

  for (let row = 1; row <= lastRow; row++) {
    for (let col = 1; col <= metrics.cols - footprint.w + 1; col++) {
      const placement = { col, row };
      if (inventoryPlacementCollides(items, draggedInstanceId, placement, footprint, metrics.cols)) continue;
      const rect = inventoryPlacementRect(placement, footprint, metrics);
      const dx = rect.left + rect.width / 2 - targetCenter.x;
      const dy = rect.top + rect.height / 2 - targetCenter.y;
      const distance = dx * dx + dy * dy;
      if (distance < nearestDistance) {
        nearest = placement;
        nearestDistance = distance;
      }
    }
  }

  return nearest;
}

export function findFirstInventoryPlacement<T extends { instanceId: string }>(
  items: PackedInventoryItem<T>[],
  draggedInstanceId: string,
  footprint: GearFootprint,
  cols: number,
): InventoryPlacement {
  for (let row = 1; ; row++) {
    for (let col = 1; col <= cols - footprint.w + 1; col++) {
      const placement = { col, row };
      if (!inventoryPlacementCollides(items, draggedInstanceId, placement, footprint, cols)) return placement;
    }
  }
}

function markPlaced(occupancy: boolean[][], col: number, row: number, footprint: GearFootprint, cols: number): void {
  ensureRows(occupancy, row + footprint.h, cols);
  for (let y = row; y < row + footprint.h; y++) {
    for (let x = col; x < col + footprint.w; x++) {
      occupancy[y]![x] = true;
    }
  }
}

function findPlacement(occupancy: boolean[][], footprint: GearFootprint, cols: number): { col: number; row: number } {
  for (let row = 0; ; row++) {
    for (let col = 0; col < cols; col++) {
      if (canPlace(occupancy, col, row, footprint, cols)) return { col: col + 1, row: row + 1 };
    }
  }
}

export function packInventory<T>(
  items: T[],
  cols: number,
  getFootprint: (item: T) => GearFootprint,
): PackedInventory<T> {
  const packedItems: PackedInventoryItem<T>[] = [];
  const occupancy: boolean[][] = [];
  let occupiedRows = 0;

  for (const item of items) {
    const footprint = getFootprint(item);
    if (footprint.w < 1 || footprint.h < 1 || footprint.w > cols) {
      throw new RangeError(`Inventory footprint ${footprint.w}x${footprint.h} does not fit ${cols}-column board`);
    }

    const position = findPlacement(occupancy, footprint, cols);
    packedItems.push({ item, ...position, ...footprint });
    markPlaced(occupancy, position.col - 1, position.row - 1, footprint, cols);
    occupiedRows = Math.max(occupiedRows, position.row - 1 + footprint.h);
  }

  return { items: packedItems, occupiedRows };
}

export function getInventoryFootprint(definition: GearDefinition, selectedSlot: GearSlot | null): GearFootprint {
  if (selectedSlot) return GEAR_FOOTPRINT[selectedSlot];
  return GEAR_FOOTPRINT[definition.compatibleSlots[0]!];
}

export function footprintForInstance(instance: { definitionId: string }): GearFootprint | null {
  const definition = gearDefinitions[instance.definitionId as keyof typeof gearDefinitions];
  if (!definition) return null;
  return GEAR_FOOTPRINT[definition.compatibleSlots[0]!];
}

export function canOccupyVacatedInventoryPlacement(
  items: PackedInventoryItem[],
  incomingInstanceId: string,
  incomingFootprint: GearFootprint,
  displacedFootprint: GearFootprint,
  placement: InventoryPlacement,
  cols: number,
): boolean {
  if (placement.col < 1 || placement.row < 1 || placement.col + displacedFootprint.w - 1 > cols) {
    return false;
  }
  if (incomingFootprint.w === displacedFootprint.w && incomingFootprint.h === displacedFootprint.h) {
    return true;
  }
  return !inventoryPlacementCollides(
    items.filter((item) => item.item.instanceId !== incomingInstanceId),
    "__vacated__",
    placement,
    displacedFootprint,
    cols,
  );
}

export function packInventoryWithPositions<T extends { definitionId: string; instanceId: string }>(
  items: T[],
  cols: number,
  savedPositions: Record<string, { col: number; row: number }>,
): PackedInventory<T> {
  const packedItems: PackedInventoryItem<T>[] = [];
  const occupancy: boolean[][] = [];
  let occupiedRows = 0;

  const remainingItems: T[] = [];

  for (const item of items) {
    const definition = gearDefinitions[item.definitionId as keyof typeof gearDefinitions];
    if (!definition) {
      remainingItems.push(item);
      continue;
    }
    const footprint = GEAR_FOOTPRINT[definition.compatibleSlots[0]!];
    const saved = savedPositions[item.instanceId];
    if (saved && saved.col >= 1 && saved.row >= 1 && saved.col + footprint.w - 1 <= cols) {
      const colIdx = saved.col - 1;
      const rowIdx = saved.row - 1;
      if (canPlace(occupancy, colIdx, rowIdx, footprint, cols)) {
        markPlaced(occupancy, colIdx, rowIdx, footprint, cols);
        packedItems.push({
          item,
          col: saved.col,
          row: saved.row,
          w: footprint.w,
          h: footprint.h,
        });
        occupiedRows = Math.max(occupiedRows, rowIdx + footprint.h);
        continue;
      }
    }
    remainingItems.push(item);
  }

  for (const item of remainingItems) {
    const definition = gearDefinitions[item.definitionId as keyof typeof gearDefinitions];
    const footprint = definition ? GEAR_FOOTPRINT[definition.compatibleSlots[0]!] : { w: 1, h: 1 };

    if (footprint.w < 1 || footprint.h < 1 || footprint.w > cols) {
      throw new RangeError(`Inventory footprint ${footprint.w}x${footprint.h} does not fit ${cols}-column board`);
    }

    const position = findPlacement(occupancy, footprint, cols);
    packedItems.push({ item, ...position, ...footprint });
    markPlaced(occupancy, position.col - 1, position.row - 1, footprint, cols);
    occupiedRows = Math.max(occupiedRows, position.row - 1 + footprint.h);
  }

  return { items: packedItems, occupiedRows };
}

export function sanitizeGearBoardPositions(
  boardPositions: GearBoardPositions,
  inventory: GearInstance[],
): GearBoardPositions {
  const inventoryIds = new Set(inventory.map((item) => item.instanceId));
  const next: GearBoardPositions = {};
  for (const [instanceId, position] of Object.entries(boardPositions)) {
    if (!inventoryIds.has(instanceId)) continue;
    const item = inventory.find((entry) => entry.instanceId === instanceId);
    if (!item) continue;
    const footprint = footprintForInstance(item);
    if (!footprint) continue;
    if (position.col < 1 || position.row < 1 || position.col + footprint.w - 1 > INVENTORY_COLS) continue;
    next[instanceId] = position;
  }
  return next;
}
