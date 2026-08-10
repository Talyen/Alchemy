// Pure geometry + destination resolution for the armory drag board.
// Consolidates board metrics reading, snap/placement math, magnet hysteresis,
// drag visual builders, and pointer → destination resolution. No DOM mutation
// and no React here; the drag FSM hook and the armory gear actions import from
// this single module.

import {
  findNearestInventoryPlacement,
  INVENTORY_COLS,
  INVENTORY_VISIBLE_ROWS,
  inventoryPlacementRect,
  type GearFootprint,
  type InventoryPlacement,
  type PackedInventoryItem as GearPackedItem,
} from "@/lib/gear";
import {
  DRAG_POINTER_ACTIVATE_DISTANCE_PX,
  HYSTERESIS_CROSS_KIND_MARGIN_PX,
  INVENTORY_SNAP_RADIUS_CELLS,
  MAGNET_SWITCH_MARGIN_PX,
  MAGNET_RELEASE_HYSTERESIS_PX,
} from "./drag-constants";
import type {
  BoardDragVisual,
  DragDestination,
  DragOrigin,
  DragPoint,
  DragRect,
  PendingBoardDrag,
} from "./armory-drag-types";

// ── Board metrics ──

function readStyleInset(
  style: CSSStyleDeclaration | Record<string, string>,
  camelProp: string,
  dashedProp: string,
): number {
  const direct = (style as Record<string, string>)[camelProp];
  if (typeof direct === "string") return parseFloat(direct) || 0;
  if (typeof style.getPropertyValue === "function") return parseFloat(style.getPropertyValue(dashedProp)) || 0;
  return 0;
}

function buildAdjustedDOMRect(boardRect: DOMRect, inset: { l: number; t: number; r: number; b: number }): DOMRect {
  return {
    left: boardRect.left + inset.l,
    top: boardRect.top + inset.t,
    right: boardRect.right - inset.r,
    bottom: boardRect.bottom - inset.b,
    width: boardRect.width - inset.l - inset.r,
    height: boardRect.height - inset.t - inset.b,
    x: boardRect.left + inset.l,
    y: boardRect.top + inset.t,
    toJSON: () => ({}),
  };
}

export function readInventoryBoardMetrics(board: HTMLElement): {
  cellSize: number;
  gap: number;
  boardRect: DOMRect;
  scrollTop: number;
} | null {
  const boardRect = board.getBoundingClientRect();
  const cellMetric = board.querySelector<HTMLElement>("[data-armory-grid-metric='cell']")?.getBoundingClientRect();
  const strideMetric = board.querySelector<HTMLElement>("[data-armory-grid-metric='stride']")?.getBoundingClientRect();
  if (!cellMetric || !strideMetric) return null;
  const cellSize = cellMetric.width;
  const gap = strideMetric.left - cellMetric.left - cellSize;

  const style = window.getComputedStyle(board) as CSSStyleDeclaration | Record<string, string>;
  const inset = {
    l:
      readStyleInset(style, "paddingLeft", "padding-left") +
      readStyleInset(style, "borderLeftWidth", "border-left-width"),
    t: readStyleInset(style, "paddingTop", "padding-top") + readStyleInset(style, "borderTopWidth", "border-top-width"),
    r:
      readStyleInset(style, "paddingRight", "padding-right") +
      readStyleInset(style, "borderRightWidth", "border-right-width"),
    b:
      readStyleInset(style, "paddingBottom", "padding-bottom") +
      readStyleInset(style, "borderBottomWidth", "border-bottom-width"),
  };

  return { cellSize, gap, boardRect: buildAdjustedDOMRect(boardRect, inset), scrollTop: board.scrollTop };
}

// ── Cell rect resolution ──

export type InventoryPlacementResult = {
  placement: InventoryPlacement;
  rect: DragRect;
} | null;

/**
 * On-screen rect of an inventory cell placement. Falls back to the computed
 * grid position when the cell is not mounted (e.g. a scrolled-off row).
 */
export function resolveInventoryCellRect(
  board: HTMLElement,
  placement: InventoryPlacement,
  footprint: GearFootprint,
  metrics: NonNullable<ReturnType<typeof readInventoryBoardMetrics>>,
): DragRect {
  const { cellSize, gap, boardRect, scrollTop } = metrics;
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
  const snapRect = resolveInventoryCellRect(board, placement, footprint, metrics);
  if (!isWithinSnapRadius(freeCenter, snapRect, cellSize, requireProximity)) return null;
  return { placement, rect: snapRect };
}

// ── Magnet hysteresis (keep the pointer latched to its current destination) ──

export function rectCenter(rect: DragRect): DragPoint {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function distanceBetweenRects(a: DragRect, b: DragRect): number {
  const ac = rectCenter(a);
  const bc = rectCenter(b);
  return Math.hypot(ac.x - bc.x, ac.y - bc.y);
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

export interface MagnetHysteresisInput<TDest> {
  candidate: TDest | null;
  previousDestination: TDest | null;
  freeRect: DragRect;
}

export interface MagnetHysteresisResult<TDest> {
  destination: TDest | null;
  switched: boolean;
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

// ── Drag visual + pending-drag builders ──

export function createPendingBoardDrag<TOrigin extends DragOrigin>({
  id,
  origin,
  source,
  pointer,
  pointerId,
}: {
  id: string;
  origin: TOrigin;
  source: DragRect;
  pointer: DragPoint;
  pointerId: number;
}): PendingBoardDrag<TOrigin> {
  return {
    id,
    origin,
    source,
    pointerId,
    pointerStart: pointer,
    offset: { x: pointer.x - source.left, y: pointer.y - source.top },
  };
}

export function shouldReusePendingDrag<TOrigin extends DragOrigin>(
  pending: PendingBoardDrag<TOrigin> | null,
  itemId: string,
  pointer: DragPoint,
): pending is PendingBoardDrag<TOrigin> {
  if (pending?.id !== itemId) return false;
  return (
    Math.hypot(pointer.x - pending.pointerStart.x, pointer.y - pending.pointerStart.y) <
    DRAG_POINTER_ACTIVATE_DISTANCE_PX
  );
}

export function buildHeldDragVisual<TOrigin extends DragOrigin>(
  id: string,
  origin: TOrigin,
  source: DragRect,
  pointer: DragPoint | null,
  getDragDestination: (id: string, rect: DragRect, pointer: DragPoint) => DragDestination | null,
): BoardDragVisual<TOrigin> {
  const rect = pointer
    ? {
        left: pointer.x - source.width / 2,
        top: pointer.y - source.height / 2,
        width: source.width,
        height: source.height,
      }
    : source;
  return {
    id,
    source,
    rect,
    origin,
    destination: pointer ? getDragDestination(id, rect, pointer) : null,
    releasing: false,
  };
}

export function buildFlyoverDragVisual<TOrigin extends DragOrigin>({
  id,
  origin,
  destination,
  source,
}: {
  id: string;
  origin: TOrigin;
  destination: DragDestination;
  source?: DragRect;
}): BoardDragVisual<TOrigin> {
  return {
    id,
    source: source ?? { left: 0, top: 0, width: 0, height: 0 },
    rect: destination.rect,
    origin,
    destination,
    flyover: true,
  };
}

export function buildActiveBoardDragVisual<TOrigin extends DragOrigin>({
  pending,
  pointer,
  candidate,
  previousDestination,
}: {
  pending: PendingBoardDrag<TOrigin>;
  pointer: DragPoint;
  candidate: DragDestination | null;
  previousDestination: DragDestination | null;
}): BoardDragVisual<TOrigin> {
  const freeRect: DragRect = {
    left: Math.round(pointer.x - pending.offset.x),
    top: Math.round(pointer.y - pending.offset.y),
    width: pending.source.width,
    height: pending.source.height,
  };
  const effectivePrevious =
    previousDestination && candidate && previousDestination.kind !== candidate.kind ? null : previousDestination;
  const { destination } = applyMagnetHysteresis({ candidate, previousDestination: effectivePrevious, freeRect });

  return {
    id: pending.id,
    source: pending.source,
    rect: freeRect,
    origin: pending.origin,
    destination,
    releasing: false,
  };
}

// ── Pointer → destination resolution ──

function resolveExternalDestinationMatch(
  pointer: DragPoint,
  resolveExternalDestination?: (pointer: DragPoint) => DragDestination | null,
): DragDestination | null {
  if (!resolveExternalDestination) return null;
  return resolveExternalDestination(pointer);
}

export function resolveInventoryDestination({
  board,
  footprint,
  freeRect,
  requireProximity,
  occupiedRows,
  obstacles,
  draggedInstanceId,
}: {
  board: HTMLDivElement | null;
  footprint: { w: number; h: number } | null;
  freeRect: DragRect;
  requireProximity: boolean;
  occupiedRows: number;
  obstacles: Array<GearPackedItem<{ instanceId: string }>>;
  draggedInstanceId: string;
}): DragDestination | null {
  if (!board || !footprint) return null;
  const result = placeInventoryTileFromMetrics(board, footprint, freeRect, null, {
    requireProximity,
    occupiedRows,
    obstacles,
    draggedInstanceId,
  });
  return result ? { kind: "inventory", placement: result.placement, rect: result.rect } : null;
}

export function resolvePointerDestination({
  id,
  freeRect,
  pointer,
  board,
  resolveExternalDestination,
  getInventoryDestination,
}: {
  id: string;
  freeRect: DragRect;
  pointer: DragPoint;
  board: HTMLDivElement | null;
  resolveExternalDestination: ((pointer: DragPoint) => DragDestination | null) | undefined;
  getInventoryDestination: (id: string, freeRect: DragRect, requireProximity: boolean) => DragDestination | null;
}): DragDestination | null {
  const external = resolveExternalDestinationMatch(pointer, resolveExternalDestination);
  if (external) return external;

  const boardRect = board?.getBoundingClientRect();
  if (
    boardRect &&
    pointer.x >= boardRect.left &&
    pointer.x <= boardRect.right &&
    pointer.y >= boardRect.top &&
    pointer.y <= boardRect.bottom
  ) {
    return getInventoryDestination(id, freeRect, false);
  }
  return null;
}
