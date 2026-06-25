import { useCallback, useEffect, useRef, useState } from "react";
import { playUISound } from "@/lib/audio";
import type { DragDestination, DragPoint, DragRect } from "./drag-types";
import { DOUBLE_CLICK_FLYOVER_CLEAR_DELAY_MS, DRAG_POINTER_ACTIVATE_DISTANCE_PX } from "./drag-constants";
import {
  buildHeldDragVisual,
  buildFlyoverDragVisual,
  createPendingBoardDrag,
  finishBoardDrag,
  shouldReusePendingDrag,
  setupHeldDragListeners,
} from "./board-drag-lifecycle";
import {
  buildActiveBoardDragVisual,
  resolveInventoryDestination,
  resolvePointerDestination,
} from "./board-drag-destination";
import type {
  BoardDragCommitResult,
  BoardDragVisual,
  DragOrigin,
  PendingBoardDrag,
  UseBoardDragOptions,
} from "./board-drag-types";
export type { BoardDragVisual, DragOrigin, UseBoardDragOptions } from "./board-drag-types";
export function useBoardDrag<TId extends string, TItem, TOrigin extends DragOrigin = DragOrigin>({
  itemLookup,
  getItemId,
  getOrigin,
  getFootprint,
  inventoryBoardRef,
  occupiedRows,
  externalDestinations,
  resolveExternalDestination,
  onCommit,
  onCancel,
  onClear,
  boardObstacles = [],
}: UseBoardDragOptions<TId, TItem, TOrigin>) {
  const [activeId, setActiveId] = useState<TId | null>(null);
  const [dragVisual, setDragVisual] = useState<BoardDragVisual<TId, TOrigin> | null>(null);
  const pendingDragRef = useRef<PendingBoardDrag<TId, TOrigin> | null>(null);
  const activeDragRef = useRef<BoardDragVisual<TId, TOrigin> | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);
  const pendingCommitRef = useRef<(() => void) | null>(null);
  const heldCleanupRef = useRef<(() => void) | null>(null);
  const beginHeldRef = useRef<(item: TItem, source: DragRect) => void>(() => {});
  const boardObstaclesRef = useRef(boardObstacles);
  useEffect(() => {
    boardObstaclesRef.current = boardObstacles;
  }, [boardObstacles]);
  useEffect(
    () => () => {
      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current);
      }
      pendingCommitRef.current = null;
      heldCleanupRef.current?.();
      heldCleanupRef.current = null;
    },
    [],
  );
  const getInventoryDestination = useCallback(
    (id: TId, freeRect: DragRect, requireProximity = true): DragDestination | null => {
      return resolveInventoryDestination({
        board: inventoryBoardRef.current,
        footprint: getFootprint(id, itemLookup),
        freeRect,
        requireProximity,
        occupiedRows,
        obstacles: boardObstaclesRef.current,
        draggedInstanceId: id,
      });
    },
    [getFootprint, inventoryBoardRef, itemLookup, occupiedRows],
  );
  const getDragDestination = useCallback(
    (id: TId, freeRect: DragRect, pointer: DragPoint): DragDestination | null => {
      return resolvePointerDestination({
        id,
        freeRect,
        pointer,
        board: inventoryBoardRef.current,
        externalDestinations,
        resolveExternalDestination,
        getInventoryDestination,
      });
    },
    [externalDestinations, getInventoryDestination, inventoryBoardRef, resolveExternalDestination],
  );
  const clearDragState = useCallback(() => {
    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    heldCleanupRef.current?.();
    heldCleanupRef.current = null;
    setActiveId(null);
    setDragVisual(null);
    activeDragRef.current = null;
    pendingCommitRef.current = null;
    onClear?.();
  }, [onClear]);
  const completeDragAnimation = useCallback(() => {
    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    heldCleanupRef.current?.();
    heldCleanupRef.current = null;
    setActiveId(null);
    setDragVisual(null);
    activeDragRef.current = null;
    const pendingCommit = pendingCommitRef.current;
    pendingCommitRef.current = null;
    pendingCommit?.();
    onClear?.();
  }, [onClear]);
  const clearDragAfterAnimation = useCallback(
    (delay = 1000) => {
      if (cleanupTimerRef.current !== null) window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = window.setTimeout(() => {
        completeDragAnimation();
      }, delay);
    },
    [completeDragAnimation],
  );
  const commitDestination = useCallback(
    (visual: BoardDragVisual<TId, TOrigin>, destination: DragDestination): BoardDragCommitResult<TItem> => {
      const result = onCommit({ id: visual.id, origin: visual.origin, destination });
      playUISound("gearMove");
      return result;
    },
    [onCommit],
  );
  const beginHeld = useCallback(
    (item: TItem, source: DragRect) => {
      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
      heldCleanupRef.current?.();
      pendingCommitRef.current = null;
      pendingDragRef.current = null;
      const id = getItemId(item);
      const origin = getOrigin(item);
      const buildVisual = (pointer: DragPoint | null) =>
        buildHeldDragVisual(id, origin, source, pointer, getDragDestination);
      const initial = buildVisual(null);
      activeDragRef.current = initial;
      setActiveId(id);
      setDragVisual(initial);
      heldCleanupRef.current = setupHeldDragListeners({
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
      });
    },
    [clearDragAfterAnimation, clearDragState, commitDestination, getDragDestination, getItemId, getOrigin, onCancel],
  );
  useEffect(() => {
    beginHeldRef.current = beginHeld;
  }, [beginHeld]);
  const updateActiveDrag = useCallback(
    (pointer: DragPoint, pointerId: number) => {
      const pending = pendingDragRef.current;
      if (!pending || pending.pointerId !== pointerId) return;
      if (!activeDragRef.current) {
        const dist = Math.hypot(pointer.x - pending.pointerStart.x, pointer.y - pending.pointerStart.y);
        if (dist < DRAG_POINTER_ACTIVATE_DISTANCE_PX) {
          return;
        }
        playUISound("gearMove");
        setActiveId(pending.id);
      }
      const previewRect: DragRect = {
        left: Math.round(pointer.x - pending.offset.x),
        top: Math.round(pointer.y - pending.offset.y),
        width: pending.source.width,
        height: pending.source.height,
      };
      const candidate = getDragDestination(pending.id, previewRect, pointer);
      const previousDestination = activeDragRef.current?.destination ?? null;
      const visual = buildActiveBoardDragVisual({
        pending,
        pointer,
        candidate,
        previousDestination,
      });
      activeDragRef.current = visual;
      setDragVisual(visual);
    },
    [getDragDestination],
  );
  const beginPointer = useCallback(
    (item: TItem, source: DragRect, pointer: DragPoint, pointerId: number) => {
      const itemId = getItemId(item);
      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
      if (shouldReusePendingDrag(pendingDragRef.current, itemId, pointer)) {
        pendingDragRef.current = { ...pendingDragRef.current, pointerId, pointerStart: pointer };
        return;
      }
      heldCleanupRef.current?.();
      heldCleanupRef.current = null;
      pendingCommitRef.current = null;
      activeDragRef.current = null;
      setDragVisual(null);
      setActiveId(null);
      pendingDragRef.current = createPendingBoardDrag({
        id: itemId,
        origin: getOrigin(item),
        source,
        pointerId,
        pointer,
      });
    },
    [getItemId, getOrigin],
  );
  const movePointer = useCallback(
    (pointer: DragPoint, pointerId: number) => {
      updateActiveDrag(pointer, pointerId);
    },
    [updateActiveDrag],
  );
  const finishPointer = useCallback(
    (pointer: DragPoint, pointerId: number, cancelled = false) => {
      if (!cancelled) updateActiveDrag(pointer, pointerId);
      const visual = activeDragRef.current;
      const pending = pendingDragRef.current;
      pendingDragRef.current = null;
      if (!visual || !pending) return;
      finishBoardDrag({
        visual,
        pending,
        cancelled,
        onCancel,
        commitDestination,
        beginHeldRef,
        activeDragRef,
        setDragVisual,
        clearDragAfterAnimation,
      });
    },
    [clearDragAfterAnimation, commitDestination, onCancel, updateActiveDrag],
  );
  const flyoverTo = useCallback(
    (
      item: TItem,
      destination: DragDestination,
      commit: () => void,
      source?: DragRect,
      holdMs = DOUBLE_CLICK_FLYOVER_CLEAR_DELAY_MS,
    ) => {
      const visual = buildFlyoverDragVisual<TId, TOrigin>({
        id: getItemId(item),
        origin: getOrigin(item),
        destination,
        ...(source ? { source } : {}),
      });
      activeDragRef.current = visual;
      setActiveId(getItemId(item));
      setDragVisual(visual);
      playUISound("gearMove");
      pendingCommitRef.current = commit;
      clearDragAfterAnimation(holdMs);
    },
    [clearDragAfterAnimation, getItemId, getOrigin],
  );
  return {
    activeId,
    dragVisual,
    isAnimating: !!dragVisual?.settling,
    isDraggingActive: !!activeId && (!dragVisual || (!dragVisual.settling && !dragVisual.releasing)),
    beginPointer,
    beginHeld,
    movePointer,
    finishPointer,
    flyoverTo,
    clearDragState,
    getInventoryDestination,
  };
}
