import {
  findNearestInventoryPlacement,
  INVENTORY_COLS,
  INVENTORY_VISIBLE_ROWS,
  inventoryPlacementRect,
  type GearFootprint,
  type InventoryPlacement,
  type PackedInventoryItem as GearPackedItem,
} from "@/lib/gear";
import { readInventoryBoardMetrics } from "./read-inventory-board-metrics";
import {
  HYSTERESIS_CROSS_KIND_MARGIN_PX,
  INVENTORY_SNAP_RADIUS_CELLS,
  MAGNET_SWITCH_MARGIN_PX,
  MAGNET_RELEASE_HYSTERESIS_PX,
} from "./drag-constants";
import { type DragPoint, type DragRect } from "./use-board-drag";

export type InventoryPlacementResult = {
  placement: InventoryPlacement;
  rect: DragRect;
} | null;

function computeTileSnapRect(
  board: HTMLElement,
  boardRect: DOMRect,
  placement: InventoryPlacement,
  footprint: GearFootprint,
  cellSize: number,
  gap: number,
  scrollTop: number,
): DragRect {
  const cellEl = board.querySelector<HTMLElement>(`[data-armory-inventory-cell="${placement.col}-${placement.row}"]`);
  if (!cellEl) {
    const local = inventoryPlacementRect(placement, footprint, { cellSize, gap });
    return {
      left: boardRect.left + local.left,
      top: boardRect.top + local.top - scrollTop,
      width: local.width,
      height: local.height,
    };
  }
  const domRect = cellEl.getBoundingClientRect();
  return {
    left: domRect.left,
    top: domRect.top,
    width: cellSize * footprint.w + gap * (footprint.w - 1),
    height: cellSize * footprint.h + gap * (footprint.h - 1),
  };
}

function isWithinSnapRadius(
  freeCenter: DragPoint,
  snapRect: DragRect,
  cellSize: number,
  requireProximity: boolean,
): boolean {
  if (!requireProximity) return true;
  const destCenter = { x: snapRect.left + snapRect.width / 2, y: snapRect.top + snapRect.height / 2 };
  return Math.hypot(freeCenter.x - destCenter.x, freeCenter.y - destCenter.y) <= cellSize * INVENTORY_SNAP_RADIUS_CELLS;
}

export function placeInventoryTileFromMetrics(
  board: HTMLElement,
  footprint: GearFootprint,
  freeRect: DragRect,
  pointerScrollOffset: { scrollTop: number } | null,
  options: {
    requireProximity?: boolean;
    occupiedRows?: number;
    obstacles?: Array<GearPackedItem<{ instanceId: string }>>;
    draggedInstanceId?: string;
  } = {},
): InventoryPlacementResult {
  const metrics = readInventoryBoardMetrics(board);
  if (!metrics) return null;
  const { cellSize, gap, boardRect, scrollTop } = metrics;
  const { requireProximity = true, occupiedRows = 0, obstacles = [], draggedInstanceId = "" } = options;
  const renderedRows = Math.max(INVENTORY_VISIBLE_ROWS, occupiedRows + footprint.h);
  const scrollRef = pointerScrollOffset ?? { scrollTop };
  const freeCenter = { x: freeRect.left + freeRect.width / 2, y: freeRect.top + freeRect.height / 2 };
  const placement = findNearestInventoryPlacement(
    obstacles,
    draggedInstanceId,
    footprint,
    { cellSize, gap, cols: INVENTORY_COLS, rows: renderedRows },
    { x: freeCenter.x - boardRect.left, y: freeCenter.y - boardRect.top + scrollRef.scrollTop },
  );
  if (!placement) return null;
  const snapRect = computeTileSnapRect(board, boardRect, placement, footprint, cellSize, gap, scrollTop);
  if (!isWithinSnapRadius(freeCenter, snapRect, cellSize, requireProximity)) return null;
  return { placement, rect: snapRect };
}

export interface MagnetHysteresisInput<TDest> {
  candidate: TDest | null;
  previousDestination: TDest | null;
  freeRect: DragRect;
}

export interface MagnetHysteresisResult<TDest> {
  destination: TDest | null;
  switched: boolean;
}

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

  const crossKind = candidate && previousDestination.kind !== candidate.kind;
  const previousDistance = distanceBetweenRects(freeRect, previousDestination.rect);
  const candidateDistance = candidate ? distanceBetweenRects(freeRect, candidate.rect) : Number.POSITIVE_INFINITY;

  if (crossKind) {
    if (previousDistance <= candidateDistance + HYSTERESIS_CROSS_KIND_MARGIN_PX) {
      return { destination: previousDestination, switched: true };
    }
    return { destination: candidate, switched: false };
  }

  if (
    previousDistance <= candidateDistance + MAGNET_SWITCH_MARGIN_PX &&
    previousDistance <=
      Math.max(previousDestination.rect.width, previousDestination.rect.height) / 2 + MAGNET_RELEASE_HYSTERESIS_PX
  ) {
    return { destination: previousDestination, switched: true };
  }
  return { destination: candidate, switched: false };
}

export function sameDestinationIdentity(left: { kind: string }, right: { kind: string }): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "inventory" && "placement" in left && "placement" in right) {
    const l = left as { placement: { col: number; row: number } };
    const r = right as { placement: { col: number; row: number } };
    return l.placement.col === r.placement.col && l.placement.row === r.placement.row;
  }
  if (left.kind === "equipment" && "slot" in left && "slot" in right) {
    const l = left as { slot: string };
    const r = right as { slot: string };
    return l.slot === r.slot;
  }
  return true;
}
