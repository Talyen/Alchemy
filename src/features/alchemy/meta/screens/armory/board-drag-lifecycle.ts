import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import type { DragDestination, DragPoint, DragRect } from "./drag-types";
import { DRAG_POINTER_ACTIVATE_DISTANCE_PX } from "./drag-constants";
import type {
  BoardDragCommitResult,
  BoardDragVisual,
  DragOrigin,
  FsmDragRefs,
  PendingBoardDrag,
} from "./board-drag-types";

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

function buildRevertedDragVisual<TId extends string, TOrigin extends DragOrigin>(
  visual: BoardDragVisual<TId, TOrigin>,
  releaseRect: DragRect,
): BoardDragVisual<TId, TOrigin> {
  return { ...visual, rect: visual.source, destination: null, settling: true, releaseRect };
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

function handleHeldPointerDown<TId extends string, TOrigin extends DragOrigin, TItem>(
  event: PointerEvent,
  state: FsmDragRefs<TId, TOrigin, TItem>,
) {
  event.stopPropagation();
  event.preventDefault();
  const {
    id,
    buildVisual,
    activeDragRef,
    setDragVisual,
    heldCleanupRef,
    commitDestination,
    onCancel,
    clearDragState,
    clearDragAfterAnimation,
    beginHeldRef,
  } = state;
  const visual = buildVisual({ x: event.clientX, y: event.clientY });
  const destination = visual.destination;
  heldCleanupRef.current?.();
  heldCleanupRef.current = null;

  if (!destination) {
    if (onCancel) onCancel(id);
    clearDragState();
    return;
  }

  const result = commitDestination(visual, destination);
  if (result?.heldItem) {
    beginHeldRef.current(result.heldItem.item, result.heldItem.source);
    return;
  }

  const settled = { ...visual, rect: destination.rect, settling: true, releaseRect: visual.rect };
  activeDragRef.current = settled;
  setDragVisual(settled);
  clearDragAfterAnimation();
}

export function setupHeldDragListeners<TId extends string, TOrigin extends DragOrigin, TItem>(
  state: FsmDragRefs<TId, TOrigin, TItem>,
): () => void {
  const { id, buildVisual, activeDragRef, setDragVisual, onCancel, clearDragState } = state;
  const onPointerMove = (event: PointerEvent) => {
    const visual = buildVisual({ x: event.clientX, y: event.clientY });
    activeDragRef.current = visual;
    setDragVisual(visual);
  };

  const onPointerDown = (event: PointerEvent) => handleHeldPointerDown(event, state);

  const unsubscribeEscape = pushEscapeHandler({
    id: "armory-board-drag",
    priority: ESCAPE_PRIORITY.ARMORY_TRANSIENT,
    onEscape: () => {
      if (onCancel) onCancel(id);
      clearDragState();
    },
  });

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerdown", onPointerDown, { capture: true });
  return () => {
    unsubscribeEscape();
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerdown", onPointerDown, { capture: true });
  };
}

export function finishBoardDrag<TId extends string, TOrigin extends DragOrigin, TItem>({
  visual,
  pending,
  cancelled,
  onCancel,
  commitDestination,
  beginHeldRef,
  activeDragRef,
  setDragVisual,
  clearDragAfterAnimation,
}: {
  visual: BoardDragVisual<TId, TOrigin>;
  pending: PendingBoardDrag<TId, TOrigin>;
  cancelled: boolean;
  onCancel: ((id: TId) => void) | undefined;
  commitDestination: (
    visual: BoardDragVisual<TId, TOrigin>,
    destination: DragDestination,
  ) => BoardDragCommitResult<TItem>;
  beginHeldRef: { current: (item: TItem, source: DragRect) => void };
  activeDragRef: { current: BoardDragVisual<TId, TOrigin> | null };
  setDragVisual: (visual: BoardDragVisual<TId, TOrigin> | null) => void;
  clearDragAfterAnimation: (delay?: number) => void;
}) {
  const releaseRect = visual.rect;
  const revert = () => {
    const reverted = buildRevertedDragVisual(visual, releaseRect);
    activeDragRef.current = reverted;
    setDragVisual(reverted);
    clearDragAfterAnimation();
  };

  if (cancelled) {
    revert();
    if (onCancel) onCancel(pending.id);
    return;
  }

  const destination = visual.destination;
  if (!destination) {
    revert();
    return;
  }

  const result = commitDestination(visual, destination);
  if (result?.heldItem) {
    beginHeldRef.current(result.heldItem.item, result.heldItem.source);
    return;
  }
  const settled = { ...visual, rect: destination.rect, settling: true, releaseRect };
  activeDragRef.current = settled;
  setDragVisual(settled);
  clearDragAfterAnimation();
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
