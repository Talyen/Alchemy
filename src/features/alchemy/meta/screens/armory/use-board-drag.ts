import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { playUISound } from "@/lib/audio";
import { type InventoryPlacement, type PackedInventoryItem } from "@/lib/gear";
import { applyMagnetHysteresis, placeInventoryTileFromMetrics } from "./board-drag-math";

export type DragPoint = { x: number; y: number };
export type DragRect = { left: number; top: number; width: number; height: number };
export type DragDestination =
  | { kind: "inventory"; placement: InventoryPlacement; rect: DragRect }
  | { kind: "equipment"; slot: string; rect: DragRect }
  | { kind: "external"; rect: DragRect };

import { DOUBLE_CLICK_FLYOVER_CLEAR_DELAY_MS, DRAG_POINTER_ACTIVATE_DISTANCE_PX } from "./drag-constants";

export type DragOrigin =
  | { kind: "inventory"; placement: InventoryPlacement }
  | { kind: "equipment"; slot: string }
  | { kind: "external" };

export type BoardDragVisual<TId extends string, TOrigin extends DragOrigin> = {
  id: TId;
  source: DragRect;
  rect: DragRect;
  origin: TOrigin;
  destination: DragDestination | null;
  settling?: boolean;
  releasing?: boolean;
  flyover?: boolean;
  releaseRect?: DragRect | undefined;
};

type PendingBoardDrag<TId extends string, TOrigin extends DragOrigin> = {
  id: TId;
  origin: TOrigin;
  source: DragRect;
  pointerId: number;
  pointerStart: DragPoint;
  offset: DragPoint;
};

type FootprintFn<TId extends string, TItem> = (id: TId, lookup: TItem | undefined) => { w: number; h: number } | null;
type BoardDragCommitResult<TItem> = { heldItem?: { item: TItem; source: DragRect } } | undefined;

export type UseBoardDragOptions<TId extends string, TItem, TOrigin extends DragOrigin> = {
  itemLookup: TItem | undefined;
  getItemId: (item: TItem) => TId;
  getOrigin: (item: TItem) => TOrigin;
  getFootprint: FootprintFn<TId, TItem>;
  inventoryBoardRef: RefObject<HTMLDivElement | null>;
  occupiedRows: number;
  externalDestinations?: ReadonlyArray<DragDestination>;
  resolveExternalDestination?: (pointer: DragPoint) => DragDestination | null;
  onCommit: (input: { id: TId; origin: TOrigin; destination: DragDestination }) => BoardDragCommitResult<TItem>;
  onCancel?: (id: TId) => void;
  onClear?: () => void;
  boardObstacles?: PackedInventoryItem<{ instanceId: string }>[];
};

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
      const board = inventoryBoardRef.current;
      if (!board) return null;
      const footprint = getFootprint(id, itemLookup);
      if (!footprint) return null;
      const result = placeInventoryTileFromMetrics(board, footprint, freeRect, null, {
        requireProximity,
        occupiedRows,
        obstacles: boardObstaclesRef.current,
        draggedInstanceId: id,
      });
      if (!result) return null;
      return { kind: "inventory", placement: result.placement, rect: result.rect };
    },
    [getFootprint, inventoryBoardRef, itemLookup, occupiedRows],
  );

  const getDragDestination = useCallback(
    (id: TId, freeRect: DragRect, pointer: DragPoint): DragDestination | null => {
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

      const board = inventoryBoardRef.current;
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
    pendingCommitRef.current?.();
    pendingCommitRef.current = null;
    onClear?.();
  }, [onClear]);

  const clearDragAfterAnimation = useCallback(
    (delay = 1000) => {
      if (cleanupTimerRef.current !== null) window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = window.setTimeout(() => {
        clearDragState();
      }, delay);
    },
    [clearDragState],
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
      const buildVisual = (pointer: DragPoint | null): BoardDragVisual<TId, TOrigin> => {
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
      };

      const initial = buildVisual(null);
      activeDragRef.current = initial;
      setActiveId(id);
      setDragVisual(initial);

      const onPointerMove = (event: PointerEvent) => {
        const visual = buildVisual({ x: event.clientX, y: event.clientY });
        activeDragRef.current = visual;
        setDragVisual(visual);
      };

      const onPointerDown = (event: PointerEvent) => {
        event.stopPropagation();
        event.preventDefault();
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
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        if (onCancel) onCancel(id);
        clearDragState();
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerdown", onPointerDown, { capture: true });
      document.addEventListener("keydown", onKeyDown, true);
      heldCleanupRef.current = () => {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerdown", onPointerDown, { capture: true });
        document.removeEventListener("keydown", onKeyDown, true);
      };
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
      const freeRect: DragRect = {
        left: pointer.x - pending.offset.x,
        top: pointer.y - pending.offset.y,
        width: pending.source.width,
        height: pending.source.height,
      };
      const candidate = getDragDestination(pending.id, freeRect, pointer);
      const previousDestination = activeDragRef.current?.destination ?? null;
      const effectivePrevious =
        previousDestination && candidate && previousDestination.kind !== candidate.kind ? null : previousDestination;
      const { destination } = applyMagnetHysteresis({
        candidate,
        previousDestination: effectivePrevious,
        freeRect,
      });

      const visual: BoardDragVisual<TId, TOrigin> = {
        id: pending.id,
        source: pending.source,
        rect: freeRect,
        origin: pending.origin,
        destination,
        releasing: false,
      };
      activeDragRef.current = visual;
      setDragVisual(visual);
    },
    [getDragDestination],
  );

  const beginPointer = useCallback(
    (item: TItem, source: DragRect, pointer: DragPoint, pointerId: number) => {
      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
      heldCleanupRef.current?.();
      heldCleanupRef.current = null;
      pendingCommitRef.current?.();
      pendingCommitRef.current = null;
      activeDragRef.current = null;
      setDragVisual(null);
      setActiveId(null);
      pendingDragRef.current = {
        id: getItemId(item),
        origin: getOrigin(item),
        source,
        pointerId,
        pointerStart: pointer,
        offset: { x: pointer.x - source.left, y: pointer.y - source.top },
      };
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

      const releaseRect = visual.rect;

      if (cancelled) {
        const reverted = {
          ...visual,
          rect: visual.source,
          destination: null,
          settling: true,
          releaseRect,
        };
        activeDragRef.current = reverted;
        setDragVisual(reverted);
        if (onCancel) onCancel(pending.id);
        clearDragAfterAnimation();
        return;
      }

      const destination = visual.destination;
      const unchanged = !destination;
      if (unchanged) {
        const reverted = {
          ...visual,
          rect: visual.source,
          destination: null,
          settling: true,
          releaseRect,
        };
        activeDragRef.current = reverted;
        setDragVisual(reverted);
        clearDragAfterAnimation();
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
      const startSource = source ?? { left: 0, top: 0, width: 0, height: 0 };
      const visual: BoardDragVisual<TId, TOrigin> = {
        id: getItemId(item),
        source: startSource,
        rect: destination.rect,
        origin: getOrigin(item),
        destination,
        flyover: true,
      };
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
