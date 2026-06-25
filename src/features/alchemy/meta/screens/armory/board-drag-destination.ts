import { applyMagnetHysteresis, placeInventoryTileFromMetrics } from "./board-drag-math";
import type { PackedInventoryItem } from "@/lib/gear";
import type { DragDestination, DragPoint, DragRect } from "./drag-types";
import { findExternalDestinationMatch } from "./board-drag-lifecycle";
import type { BoardDragVisual, DragOrigin, PendingBoardDrag } from "./board-drag-types";

export function resolveInventoryDestination<TId extends string>({
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
  obstacles: Array<PackedInventoryItem<{ instanceId: string }>>;
  draggedInstanceId: TId;
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

export function resolvePointerDestination<TId extends string>({
  id,
  freeRect,
  pointer,
  board,
  externalDestinations,
  resolveExternalDestination,
  getInventoryDestination,
}: {
  id: TId;
  freeRect: DragRect;
  pointer: DragPoint;
  board: HTMLDivElement | null;
  externalDestinations: readonly DragDestination[] | undefined;
  resolveExternalDestination: ((pointer: DragPoint) => DragDestination | null) | undefined;
  getInventoryDestination: (id: TId, freeRect: DragRect, requireProximity: boolean) => DragDestination | null;
}): DragDestination | null {
  const external = findExternalDestinationMatch(pointer, resolveExternalDestination, externalDestinations);
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

export function buildActiveBoardDragVisual<TId extends string, TOrigin extends DragOrigin>({
  pending,
  pointer,
  candidate,
  previousDestination,
}: {
  pending: PendingBoardDrag<TId, TOrigin>;
  pointer: DragPoint;
  candidate: DragDestination | null;
  previousDestination: DragDestination | null;
}): BoardDragVisual<TId, TOrigin> {
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
