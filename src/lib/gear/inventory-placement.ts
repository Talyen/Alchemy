import type { GearFootprint } from "./footprints";
import type { GearInstance } from "./types";

export type InventoryPlacement = { col: number; row: number };

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

export type InventoryGridMetrics = {
  cellSize: number;
  gap: number;
  cols: number;
  rows: number;
};

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

export function canOccupyVacatedInventoryPlacement(
  items: PackedInventoryItem[],
  incomingInstanceId: string,
  _incomingFootprint: GearFootprint,
  displacedFootprint: GearFootprint,
  placement: InventoryPlacement,
  cols: number,
): boolean {
  if (placement.col < 1 || placement.row < 1 || placement.col + displacedFootprint.w - 1 > cols) {
    return false;
  }

  return !inventoryPlacementCollides(
    items.filter((item) => item.item.instanceId !== incomingInstanceId),
    incomingInstanceId,
    placement,
    displacedFootprint,
    cols,
  );
}
