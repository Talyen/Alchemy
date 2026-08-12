import { useCallback, useEffect, useRef, useState } from "react";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { playUISound } from "@/lib/audio";
import { useLatestRef } from "../../../shared/hooks";
import type {
  BoardDragCommitResult,
  BoardDragVisual,
  DragDestination,
  DragPoint,
  DragOrigin,
  DragRect,
  PendingBoardDrag,
  UseBoardDragOptions,
} from "./armory-drag-types";
import { DOUBLE_CLICK_FLYOVER_CLEAR_DELAY_MS, DRAG_POINTER_ACTIVATE_DISTANCE_PX } from "./drag-constants";
import {
  buildActiveBoardDragVisual,
  buildFlyoverDragVisual,
  buildHeldDragVisual,
  createPendingBoardDrag,
  resolveInventoryDestination,
  resolvePointerDestination,
  shouldReusePendingDrag,
  withInventoryMetricsFrame,
} from "./board-drag-math";

export type { BoardDragVisual, DragOrigin, UseBoardDragOptions } from "./armory-drag-types";

type BoardDragSession<TItem, TOrigin extends DragOrigin> =
  | { phase: "idle" }
  | { phase: "armed"; item: TItem; pending: PendingBoardDrag<TOrigin> }
  | {
      phase: "dragging";
      item: TItem;
      pending: PendingBoardDrag<TOrigin>;
      visual: BoardDragVisual<TOrigin>;
    }
  | { phase: "held"; item: TItem; visual: BoardDragVisual<TOrigin>; token: number }
  | {
      phase: "animating";
      item: TItem;
      visual: BoardDragVisual<TOrigin>;
      durationMs: number;
      commit: (() => void) | null;
    };

const IDLE_SESSION = { phase: "idle" } as const;
const SETTLE_CLEAR_DELAY_MS = 1000;

export function useBoardDrag<TItem, TOrigin extends DragOrigin>({
  getItemId,
  getOrigin,
  getFootprint,
  inventoryBoardRef,
  occupiedRows,
  resolveExternalDestination,
  onCommit,
  onCancel,
  onClear,
  boardObstacles = [],
}: UseBoardDragOptions<TItem, TOrigin>) {
  const [session, setSession] = useState<BoardDragSession<TItem, TOrigin>>(IDLE_SESSION);
  const sessionRef = useRef<BoardDragSession<TItem, TOrigin>>(IDLE_SESSION);
  const heldTokenRef = useRef(0);
  const pointerFrameRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<{ pointer: DragPoint; pointerId: number } | null>(null);
  const boardObstaclesRef = useLatestRef(boardObstacles);
  const onCommitRef = useLatestRef(onCommit);
  const onCancelRef = useLatestRef(onCancel);
  const onClearRef = useLatestRef(onClear);

  const publishSession = useCallback((next: BoardDragSession<TItem, TOrigin>) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const getInventoryDestination = useCallback(
    (id: string, freeRect: DragRect, requireProximity = true): DragDestination | null => {
      return resolveInventoryDestination({
        board: inventoryBoardRef.current,
        footprint: getFootprint(id),
        freeRect,
        requireProximity,
        occupiedRows,
        obstacles: boardObstaclesRef.current,
        draggedInstanceId: id,
      });
    },
    [boardObstaclesRef, getFootprint, inventoryBoardRef, occupiedRows],
  );

  const getDragDestination = useCallback(
    (id: string, freeRect: DragRect, pointer: DragPoint): DragDestination | null => {
      return resolvePointerDestination({
        id,
        freeRect,
        pointer,
        board: inventoryBoardRef.current,
        resolveExternalDestination,
        getInventoryDestination,
      });
    },
    [getInventoryDestination, inventoryBoardRef, resolveExternalDestination],
  );

  const clearDragState = useCallback(() => {
    if (pointerFrameRef.current !== null) {
      cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = null;
    }
    pendingPointerRef.current = null;
    publishSession(IDLE_SESSION);
    onClearRef.current?.();
  }, [onClearRef, publishSession]);

  const completeDragAnimation = useCallback(() => {
    const current = sessionRef.current;
    if (current.phase !== "animating") return;
    publishSession(IDLE_SESSION);
    const commit = current.commit;
    commit?.();
    onClearRef.current?.();
  }, [onClearRef, publishSession]);

  const commitDestination = useCallback(
    (visual: BoardDragVisual<TOrigin>, destination: DragDestination): BoardDragCommitResult<TItem> => {
      const result = onCommitRef.current({ id: visual.id, origin: visual.origin, destination });
      playUISound("gearMove");
      return result;
    },
    [onCommitRef],
  );

  const beginHeld = useCallback(
    (item: TItem, source: DragRect) => {
      const id = getItemId(item);
      const origin = getOrigin(item);
      heldTokenRef.current += 1;
      publishSession({
        phase: "held",
        item,
        visual: buildHeldDragVisual(id, origin, source, null, getDragDestination),
        token: heldTokenRef.current,
      });
    },
    [getDragDestination, getItemId, getOrigin, publishSession],
  );

  const heldToken = session.phase === "held" ? session.token : null;
  const heldId = session.phase === "held" ? session.visual.id : null;
  useEffect(() => {
    if (heldToken === null || heldId === null) return;
    const id = heldId;

    const handlePointerMove = (event: PointerEvent) => {
      pendingPointerRef.current = { pointer: { x: event.clientX, y: event.clientY }, pointerId: event.pointerId };
      pointerFrameRef.current ??= requestAnimationFrame(flushHeldPointerMove);
    };

    const flushHeldPointerMove = () => {
      pointerFrameRef.current = null;
      const pending = pendingPointerRef.current;
      pendingPointerRef.current = null;
      const current = sessionRef.current;
      if (!pending || current.phase !== "held") return;
      withInventoryMetricsFrame(() => {
        const visual = buildHeldDragVisual(
          id,
          current.visual.origin,
          current.visual.source,
          pending.pointer,
          getDragDestination,
        );
        publishSession({ ...current, visual });
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      const current = sessionRef.current;
      if (current.phase !== "held") return;
      event.stopPropagation();
      event.preventDefault();
      withInventoryMetricsFrame(() => {
        const pointer = { x: event.clientX, y: event.clientY };
        const visual = buildHeldDragVisual(
          id,
          current.visual.origin,
          current.visual.source,
          pointer,
          getDragDestination,
        );
        const destination = visual.destination;
        if (!destination) {
          onCancelRef.current?.(id);
          clearDragState();
          return;
        }
        const result = commitDestination(visual, destination);
        if (result?.heldItem) {
          beginHeld(result.heldItem.item, result.heldItem.source);
          return;
        }
        publishSession({
          phase: "animating",
          item: current.item,
          visual: { ...visual, rect: destination.rect, settling: true, releaseRect: visual.rect },
          durationMs: SETTLE_CLEAR_DELAY_MS,
          commit: null,
        });
      });
    };

    const unsubscribeEscape = pushEscapeHandler({
      id: "armory-board-drag",
      priority: ESCAPE_PRIORITY.ARMORY_TRANSIENT,
      onEscape: () => {
        onCancelRef.current?.(id);
        clearDragState();
      },
    });
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () => {
      unsubscribeEscape();
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
    };
  }, [
    beginHeld,
    clearDragState,
    commitDestination,
    getDragDestination,
    heldId,
    heldToken,
    onCancelRef,
    publishSession,
  ]);

  useEffect(() => {
    if (session.phase !== "animating") return;
    const timer = window.setTimeout(completeDragAnimation, session.durationMs);
    return () => window.clearTimeout(timer);
  }, [completeDragAnimation, session]);

  useEffect(() => {
    function clearHeldDragOnBlur() {
      if (sessionRef.current.phase === "animating") return;
      clearDragState();
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") clearHeldDragOnBlur();
    }
    window.addEventListener("blur", clearHeldDragOnBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", clearHeldDragOnBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearDragState]);

  const updateActiveDrag = useCallback(
    (pointer: DragPoint, pointerId: number) => {
      const current = sessionRef.current;
      if ((current.phase !== "armed" && current.phase !== "dragging") || current.pending.pointerId !== pointerId) {
        return;
      }
      const pending = current.pending;
      if (current.phase === "armed") {
        const distance = Math.hypot(pointer.x - pending.pointerStart.x, pointer.y - pending.pointerStart.y);
        if (distance < DRAG_POINTER_ACTIVATE_DISTANCE_PX) return;
        playUISound("gearMove");
      }
      const previewRect: DragRect = {
        left: Math.round(pointer.x - pending.offset.x),
        top: Math.round(pointer.y - pending.offset.y),
        width: pending.source.width,
        height: pending.source.height,
      };
      const candidate = getDragDestination(pending.id, previewRect, pointer);
      const previousDestination = current.phase === "dragging" ? current.visual.destination : null;
      const visual = buildActiveBoardDragVisual({ pending, pointer, candidate, previousDestination });
      publishSession({ phase: "dragging", item: current.item, pending, visual });
    },
    [getDragDestination, publishSession],
  );

  const flushPointerMove = useCallback(() => {
    pointerFrameRef.current = null;
    const pending = pendingPointerRef.current;
    pendingPointerRef.current = null;
    if (pending) {
      withInventoryMetricsFrame(() => {
        updateActiveDrag(pending.pointer, pending.pointerId);
      });
    }
  }, [updateActiveDrag]);

  const beginPointer = useCallback(
    (item: TItem, source: DragRect, pointer: DragPoint, pointerId: number) => {
      const itemId = getItemId(item);
      const current = sessionRef.current;
      if (current.phase === "armed" && shouldReusePendingDrag(current.pending, itemId, pointer)) {
        publishSession({
          phase: "armed",
          item: current.item,
          pending: { ...current.pending, pointerId, pointerStart: pointer },
        });
        return;
      }
      publishSession({
        phase: "armed",
        item,
        pending: createPendingBoardDrag({ id: itemId, origin: getOrigin(item), source, pointerId, pointer }),
      });
    },
    [getItemId, getOrigin, publishSession],
  );

  const movePointer = useCallback(
    (pointer: DragPoint, pointerId: number) => {
      // Activate immediately once the threshold is crossed so the drag never feels
      // one frame late; subsequent raw pointer events are coalesced to one per frame.
      if (sessionRef.current.phase === "armed") {
        withInventoryMetricsFrame(() => {
          updateActiveDrag(pointer, pointerId);
        });
        return;
      }
      pendingPointerRef.current = { pointer, pointerId };
      pointerFrameRef.current ??= requestAnimationFrame(flushPointerMove);
    },
    [flushPointerMove, updateActiveDrag],
  );

  const finishPointer = useCallback(
    (pointer: DragPoint, pointerId: number, cancelled = false) => {
      if (pointerFrameRef.current !== null) {
        cancelAnimationFrame(pointerFrameRef.current);
        pointerFrameRef.current = null;
      }
      pendingPointerRef.current = null;
      updateActiveDrag(pointer, pointerId);
      const current = sessionRef.current;
      if (current.phase === "armed") {
        if (current.pending.pointerId === pointerId) publishSession(IDLE_SESSION);
        return;
      }
      if (current.phase !== "dragging") return;
      const releaseRect = current.visual.rect;
      if (cancelled) onCancelRef.current?.(current.pending.id);
      const destination = cancelled ? null : current.visual.destination;
      if (!destination) {
        publishSession({
          phase: "animating",
          item: current.item,
          visual: {
            ...current.visual,
            rect: current.visual.source,
            destination: null,
            settling: true,
            releaseRect,
          },
          durationMs: SETTLE_CLEAR_DELAY_MS,
          commit: null,
        });
        return;
      }
      const result = commitDestination(current.visual, destination);
      if (result?.heldItem) {
        beginHeld(result.heldItem.item, result.heldItem.source);
        return;
      }
      publishSession({
        phase: "animating",
        item: current.item,
        visual: { ...current.visual, rect: destination.rect, settling: true, releaseRect },
        durationMs: SETTLE_CLEAR_DELAY_MS,
        commit: null,
      });
    },
    [beginHeld, commitDestination, onCancelRef, publishSession, updateActiveDrag],
  );

  useEffect(
    () => () => {
      if (pointerFrameRef.current !== null) cancelAnimationFrame(pointerFrameRef.current);
    },
    [],
  );

  const flyoverTo = useCallback(
    (
      item: TItem,
      destination: DragDestination,
      commit: () => void,
      source?: DragRect,
      holdMs = DOUBLE_CLICK_FLYOVER_CLEAR_DELAY_MS,
    ) => {
      publishSession({
        phase: "animating",
        item,
        visual: buildFlyoverDragVisual<TOrigin>({
          id: getItemId(item),
          origin: getOrigin(item),
          destination,
          ...(source ? { source } : {}),
        }),
        durationMs: holdMs,
        commit,
      });
      playUISound("gearMove");
    },
    [getItemId, getOrigin, publishSession],
  );

  const visual =
    session.phase === "dragging" || session.phase === "held" || session.phase === "animating" ? session.visual : null;
  const activeId = visual?.id ?? null;
  const activeItem = session.phase === "idle" || session.phase === "armed" ? null : session.item;

  return {
    activeId,
    activeItem,
    dragVisual: visual,
    isAnimating: session.phase === "animating",
    isDraggingActive: session.phase === "dragging" || session.phase === "held",
    beginPointer,
    beginHeld,
    movePointer,
    finishPointer,
    flyoverTo,
    clearDragState,
    completeDragAnimation,
    getInventoryDestination,
  };
}
