import type { DragDestination, DragPoint, DragRect } from "./drag-types";
import { DRAG_POINTER_ACTIVATE_DISTANCE_PX } from "./drag-constants";
import type { BoardDragVisual, DragOrigin, PendingBoardDrag } from "./board-drag-types";

export function buildHeldDragVisual<TId extends string, TOrigin extends DragOrigin>(
  id: TId,
  origin: TOrigin,
  source: DragRect,
  pointer: DragPoint | null,
  getDragDestination: (id: TId, rect: DragRect, pointer: DragPoint) => DragDestination | null,
): BoardDragVisual<TId, TOrigin> {
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

export function findExternalDestinationMatch(
  pointer: DragPoint,
  resolveExternalDestination?: (pointer: DragPoint) => DragDestination | null,
  externalDestinations?: readonly DragDestination[],
): DragDestination | null {
  if (resolveExternalDestination) {
    const external = resolveExternalDestination(pointer);
    if (external) return external;
  }
  if (externalDestinations) {
    for (const external of externalDestinations) {
      if (
        pointer.x >= external.rect.left &&
        pointer.x <= external.rect.left + external.rect.width &&
        pointer.y >= external.rect.top &&
        pointer.y <= external.rect.top + external.rect.height
      ) {
        return external;
      }
    }
  }
  return null;
}

export function shouldReusePendingDrag<TId extends string, TOrigin extends DragOrigin>(
  pending: PendingBoardDrag<TId, TOrigin> | null,
  itemId: TId,
  pointer: DragPoint,
): pending is PendingBoardDrag<TId, TOrigin> {
  if (pending?.id !== itemId) return false;
  return (
    Math.hypot(pointer.x - pending.pointerStart.x, pointer.y - pending.pointerStart.y) <
    DRAG_POINTER_ACTIVATE_DISTANCE_PX
  );
}

export function createPendingBoardDrag<TId extends string, TOrigin extends DragOrigin>({
  id,
  origin,
  source,
  pointer,
  pointerId,
}: {
  id: TId;
  origin: TOrigin;
  source: DragRect;
  pointer: DragPoint;
  pointerId: number;
}): PendingBoardDrag<TId, TOrigin> {
  return {
    id,
    origin,
    source,
    pointerId,
    pointerStart: pointer,
    offset: { x: pointer.x - source.left, y: pointer.y - source.top },
  };
}

export function buildFlyoverDragVisual<TId extends string, TOrigin extends DragOrigin>({
  id,
  origin,
  destination,
  source,
}: {
  id: TId;
  origin: TOrigin;
  destination: DragDestination;
  source?: DragRect;
}): BoardDragVisual<TId, TOrigin> {
  return {
    id,
    source: source ?? { left: 0, top: 0, width: 0, height: 0 },
    rect: destination.rect,
    origin,
    destination,
    flyover: true,
  };
}
