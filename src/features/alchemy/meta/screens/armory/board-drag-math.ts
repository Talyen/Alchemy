import {
  findNearestInventoryPlacement,
  INVENTORY_COLS,
  INVENTORY_VISIBLE_ROWS,
  inventoryPlacementRect,
  type GearFootprint,
  type InventoryPlacement,
} from "@/lib/gear";
import { readInventoryBoardMetrics } from "./read-inventory-board-metrics";
import {
  INVENTORY_SNAP_RADIUS_CELLS,
  MAGNET_SWITCH_MARGIN_PX,
  MAGNET_RELEASE_HYSTERESIS_PX,
  type DragPoint,
  type DragRect,
} from "./use-board-drag";

export { INVENTORY_SNAP_RADIUS_CELLS, MAGNET_SWITCH_MARGIN_PX, MAGNET_RELEASE_HYSTERESIS_PX };

export type InventoryPlacementResult = {
  placement: InventoryPlacement;
  rect: DragRect;
} | null;

export function placeInventoryTileFromMetrics(
  board: HTMLElement,
  footprint: GearFootprint,
  freeRect: DragRect,
  pointerScrollOffset: { scrollTop: number } | null,
  options: { requireProximity?: boolean; occupiedRows?: number } = {},
): InventoryPlacementResult {
  const metrics = readInventoryBoardMetrics(board);
  if (!metrics) return null;
  const { cellSize, gap, boardRect, scrollTop } = metrics;
  const { requireProximity = true, occupiedRows = 0 } = options;
  const renderedRows = Math.max(INVENTORY_VISIBLE_ROWS, occupiedRows + footprint.h);
  const localPointer = pointerScrollOffset ?? { scrollTop };
  const placement = findNearestInventoryPlacement(
    [],
    "",
    footprint,
    { cellSize, gap, cols: INVENTORY_COLS, rows: renderedRows },
    {
      x: freeRect.left + freeRect.width / 2 - boardRect.left,
      y: freeRect.top + freeRect.height / 2 - boardRect.top + localPointer.scrollTop,
    },
  );
  if (!placement) return null;
  const localRect = inventoryPlacementRect(placement, footprint, { cellSize, gap });
  const freeCenter = { x: freeRect.left + freeRect.width / 2, y: freeRect.top + freeRect.height / 2 };
  const destinationCenter = {
    x: boardRect.left + localRect.left + localRect.width / 2,
    y: boardRect.top + localRect.top - scrollTop + localRect.height / 2,
  };
  if (
    requireProximity &&
    Math.hypot(freeCenter.x - destinationCenter.x, freeCenter.y - destinationCenter.y) >
      cellSize * INVENTORY_SNAP_RADIUS_CELLS
  ) {
    return null;
  }
  return {
    placement,
    rect: {
      left: boardRect.left + localRect.left,
      top: boardRect.top + localRect.top - scrollTop,
      width: localRect.width,
      height: localRect.height,
    },
  };
}

export type MagnetHysteresisInput<TDest> = {
  candidate: TDest | null;
  previousDestination: TDest | null;
  freeRect: DragRect;
};

export type MagnetHysteresisResult<TDest> = {
  destination: TDest | null;
  switched: boolean;
};

export function rectCenter(rect: DragRect): DragPoint {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function distanceBetweenRects(a: DragRect, b: DragRect): number {
  const ac = rectCenter(a);
  const bc = rectCenter(b);
  return Math.hypot(ac.x - bc.x, ac.y - bc.y);
}

export function applyMagnetHysteresis<TDest extends { rect: DragRect; kind: string }>({
  candidate,
  previousDestination,
  freeRect,
}: MagnetHysteresisInput<TDest>): MagnetHysteresisResult<TDest> {
  if (!previousDestination) {
    return { destination: candidate, switched: false };
  }
  if (candidate && sameDestinationIdentity(previousDestination, candidate)) {
    return { destination: candidate, switched: false };
  }
  const previousDistance = distanceBetweenRects(freeRect, previousDestination.rect);
  const candidateDistance = candidate ? distanceBetweenRects(freeRect, candidate.rect) : Number.POSITIVE_INFINITY;
  if (
    previousDistance <= candidateDistance + MAGNET_SWITCH_MARGIN_PX &&
    previousDistance <=
      Math.max(previousDestination.rect.width, previousDestination.rect.height) / 2 + MAGNET_RELEASE_HYSTERESIS_PX
  ) {
    return { destination: previousDestination, switched: true };
  }
  return { destination: candidate, switched: false };
}

export function sameDestinationIdentity<TDest extends { kind: string }>(left: TDest, right: TDest): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "inventory" && right.kind === "inventory") {
    const lInv = left as unknown as { placement: { col: number; row: number } };
    const rInv = right as unknown as { placement: { col: number; row: number } };
    return lInv.placement.col === rInv.placement.col && lInv.placement.row === rInv.placement.row;
  }
  return true;
}
