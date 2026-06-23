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
  const localPointer = pointerScrollOffset ?? { scrollTop };
  const placement = findNearestInventoryPlacement(
    obstacles,
    draggedInstanceId,
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

  const cellEl = board.querySelector<HTMLElement>(`[data-armory-inventory-cell="${placement.col}-${placement.row}"]`);
  let snapRect: DragRect;
  if (cellEl) {
    const cellDomRect = cellEl.getBoundingClientRect();
    const tileWidth = cellSize * footprint.w + gap * (footprint.w - 1);
    const tileHeight = cellSize * footprint.h + gap * (footprint.h - 1);
    snapRect = {
      left: cellDomRect.left,
      top: cellDomRect.top,
      width: tileWidth,
      height: tileHeight,
    };
  } else {
    snapRect = {
      left: boardRect.left + localRect.left,
      top: boardRect.top + localRect.top - scrollTop,
      width: localRect.width,
      height: localRect.height,
    };
  }

  const destinationCenter = {
    x: snapRect.left + snapRect.width / 2,
    y: snapRect.top + snapRect.height / 2,
  };
  if (
    requireProximity &&
    Math.hypot(freeCenter.x - destinationCenter.x, freeCenter.y - destinationCenter.y) >
      cellSize * INVENTORY_SNAP_RADIUS_CELLS
  ) {
    return null;
  }
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

export function sameDestinationIdentity<TDest extends { kind: string }>(left: TDest, right: TDest): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "inventory" && right.kind === "inventory") {
    const lInv = left as unknown as { placement: { col: number; row: number } };
    const rInv = right as unknown as { placement: { col: number; row: number } };
    return lInv.placement.col === rInv.placement.col && lInv.placement.row === rInv.placement.row;
  }
  if (left.kind === "equipment" && right.kind === "equipment") {
    return (left as unknown as { slot: string }).slot === (right as unknown as { slot: string }).slot;
  }
  return true;
}
