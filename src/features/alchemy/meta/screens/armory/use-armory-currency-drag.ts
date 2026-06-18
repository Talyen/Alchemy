import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { playUISound } from "@/lib/audio";
import {
  findNearestInventoryPlacement,
  getCraftingCurrencyDefinition,
  INVENTORY_COLS,
  INVENTORY_VISIBLE_ROWS,
  inventoryPlacementRect,
  type CraftingCurrencyId,
  type PackedInventoryItem,
} from "@/lib/gear";
import { readInventoryBoardMetrics } from "./read-inventory-board-metrics";
import { MAGNET_RELEASE_EASE_MS, type DragDestination, type DragPoint, type DragRect } from "./use-armory-gear-drag";

const CURRENCY_FOOTPRINT = { w: 1, h: 1 };
const INVENTORY_SNAP_RADIUS_CELLS = 0.28;
const MAGNET_SWITCH_MARGIN_PX = 14;
const MAGNET_RELEASE_HYSTERESIS_PX = 18;

export type CurrencyDragOrigin = { kind: "inventory"; placement: { col: number; row: number } };

export type CurrencyDragVisual = {
  currencyId: CraftingCurrencyId;
  source: DragRect;
  rect: DragRect;
  origin: CurrencyDragOrigin;
  destination: DragDestination | null;
  settling?: boolean;
  releasing?: boolean;
};

type PendingCurrencyDrag = {
  currencyId: CraftingCurrencyId;
  origin: CurrencyDragOrigin;
  source: DragRect;
  pointerId: number;
  pointerStart: DragPoint;
  offset: DragPoint;
};

export type CurrencyPointerStart = (
  currencyId: CraftingCurrencyId,
  origin: CurrencyDragOrigin,
  rect: DOMRect,
  pointer: DragPoint,
  pointerId: number,
) => void;

export type CurrencyPointerMove = (pointer: DragPoint, pointerId: number) => void;

export type CurrencyPointerEnd = (pointer: DragPoint, pointerId: number, cancelled?: boolean) => void;

type UseArmoryCurrencyDragOptions = {
  editable: boolean;
  boardObstacles: PackedInventoryItem<{ instanceId: string }>[];
  occupiedRows: number;
  inventoryBoardRef: RefObject<HTMLDivElement | null>;
  onMoveCurrency: (currencyId: CraftingCurrencyId, col: number, row: number) => void;
};

export function useArmoryCurrencyDrag({
  editable,
  boardObstacles,
  occupiedRows,
  inventoryBoardRef,
  onMoveCurrency,
}: UseArmoryCurrencyDragOptions) {
  const [draggedCurrencyId, setDraggedCurrencyId] = useState<CraftingCurrencyId | null>(null);
  const [dragVisual, setDragVisual] = useState<CurrencyDragVisual | null>(null);
  const pendingDragRef = useRef<PendingCurrencyDrag | null>(null);
  const activeDragRef = useRef<CurrencyDragVisual | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);

  const isAnimating = !!dragVisual?.settling;
  const isDraggingActive = !!draggedCurrencyId && (!dragVisual || (!dragVisual.settling && !dragVisual.releasing));

  useEffect(() => {
    if (!draggedCurrencyId) return;
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";
    return () => {
      document.body.style.cursor = previousCursor;
    };
  }, [draggedCurrencyId]);

  useEffect(
    () => () => {
      if (cleanupTimerRef.current !== null) window.clearTimeout(cleanupTimerRef.current);
    },
    [],
  );

  const getInventoryDestination = useCallback(
    (currencyId: CraftingCurrencyId, freeRect: DragRect, requireProximity = true): DragDestination | null => {
      const board = inventoryBoardRef.current;
      if (!board) return null;
      const metrics = readInventoryBoardMetrics(board);
      if (!metrics) return null;
      const { cellSize, gap, boardRect, scrollTop } = metrics;
      const renderedRows = Math.max(INVENTORY_VISIBLE_ROWS, occupiedRows + 1);
      const placement = findNearestInventoryPlacement(
        boardObstacles,
        currencyId,
        CURRENCY_FOOTPRINT,
        { cellSize, gap, cols: INVENTORY_COLS, rows: renderedRows },
        {
          x: freeRect.left + freeRect.width / 2 - boardRect.left,
          y: freeRect.top + freeRect.height / 2 - boardRect.top + scrollTop,
        },
      );
      if (!placement) return null;
      const localRect = inventoryPlacementRect(placement, CURRENCY_FOOTPRINT, { cellSize, gap });
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
        kind: "inventory",
        placement,
        rect: {
          left: boardRect.left + localRect.left,
          top: boardRect.top + localRect.top - scrollTop,
          width: localRect.width,
          height: localRect.height,
        },
      };
    },
    [boardObstacles, inventoryBoardRef, occupiedRows],
  );

  const getDragDestination = useCallback(
    (currencyId: CraftingCurrencyId, freeRect: DragRect, pointer: DragPoint): DragDestination | null => {
      const board = inventoryBoardRef.current;
      const boardRect = board?.getBoundingClientRect();
      if (
        boardRect &&
        pointer.x >= boardRect.left &&
        pointer.x <= boardRect.right &&
        pointer.y >= boardRect.top &&
        pointer.y <= boardRect.bottom
      ) {
        return getInventoryDestination(currencyId, freeRect, false);
      }
      return null;
    },
    [getInventoryDestination, inventoryBoardRef],
  );

  const clearDragState = useCallback(() => {
    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    setDraggedCurrencyId(null);
    setDragVisual(null);
    activeDragRef.current = null;
  }, []);

  const clearDragAfterAnimation = useCallback(
    (delay = 1000) => {
      if (cleanupTimerRef.current !== null) window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = window.setTimeout(() => {
        clearDragState();
      }, delay);
    },
    [clearDragState],
  );

  const updateActiveDrag = useCallback(
    (pointer: DragPoint, pointerId: number) => {
      const pending = pendingDragRef.current;
      if (!pending || pending.pointerId !== pointerId) return;
      if (!activeDragRef.current) {
        if (Math.hypot(pointer.x - pending.pointerStart.x, pointer.y - pending.pointerStart.y) < 4) return;
        playUISound("gearMove");
        setDraggedCurrencyId(pending.currencyId);
      }
      const freeRect = {
        left: pointer.x - pending.offset.x,
        top: pointer.y - pending.offset.y,
        width: pending.source.width,
        height: pending.source.height,
      };
      const candidate = getDragDestination(pending.currencyId, freeRect, pointer);
      const previousDestination = activeDragRef.current?.destination ?? null;
      const freeCenter = { x: freeRect.left + freeRect.width / 2, y: freeRect.top + freeRect.height / 2 };
      const distanceTo = (destination: DragDestination) => {
        const centerX = destination.rect.left + destination.rect.width / 2;
        const centerY = destination.rect.top + destination.rect.height / 2;
        return Math.hypot(freeCenter.x - centerX, freeCenter.y - centerY);
      };
      const sameDestination = (left: DragDestination, right: DragDestination) =>
        left.kind === "inventory" &&
        right.kind === "inventory" &&
        left.placement.col === right.placement.col &&
        left.placement.row === right.placement.row;

      let destination = candidate;
      if (previousDestination && (!candidate || !sameDestination(previousDestination, candidate))) {
        const previousDistance = distanceTo(previousDestination);
        const candidateDistance = candidate ? distanceTo(candidate) : Number.POSITIVE_INFINITY;
        if (
          previousDistance <= candidateDistance + MAGNET_SWITCH_MARGIN_PX &&
          previousDistance <=
            Math.max(previousDestination.rect.width, previousDestination.rect.height) / 2 + MAGNET_RELEASE_HYSTERESIS_PX
        ) {
          destination = previousDestination;
        }
      }

      const visual: CurrencyDragVisual = {
        currencyId: pending.currencyId,
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

  const beginCurrencyPointer = useCallback(
    (
      currencyId: CraftingCurrencyId,
      origin: CurrencyDragOrigin,
      source: DragRect,
      pointer: DragPoint,
      pointerId: number,
    ) => {
      if (!editable || !getCraftingCurrencyDefinition(currencyId)) return;
      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
      activeDragRef.current = null;
      setDragVisual(null);
      setDraggedCurrencyId(null);
      pendingDragRef.current = {
        currencyId,
        origin,
        source,
        pointerId,
        pointerStart: pointer,
        offset: { x: pointer.x - source.left, y: pointer.y - source.top },
      };
    },
    [editable],
  );

  const moveCurrencyPointer = useCallback(
    (pointer: DragPoint, pointerId: number) => {
      updateActiveDrag(pointer, pointerId);
    },
    [updateActiveDrag],
  );

  const finishCurrencyPointer = useCallback(
    (pointer: DragPoint, pointerId: number, cancelled = false) => {
      if (!cancelled) updateActiveDrag(pointer, pointerId);
      const visual = activeDragRef.current;
      const pending = pendingDragRef.current;
      pendingDragRef.current = null;
      if (!visual || !pending) return;

      if (cancelled) {
        const reverted = { ...visual, rect: visual.source, destination: null, settling: true };
        activeDragRef.current = reverted;
        setDragVisual(reverted);
        clearDragAfterAnimation();
        return;
      }

      const destination = visual.destination;
      const unchanged =
        !destination ||
        (destination.kind === "inventory" &&
          pending.origin.placement.col === destination.placement.col &&
          pending.origin.placement.row === destination.placement.row);

      if (unchanged || destination.kind !== "inventory") {
        const reverted = { ...visual, rect: visual.source, destination: null, settling: true };
        activeDragRef.current = reverted;
        setDragVisual(reverted);
        clearDragAfterAnimation();
        return;
      }

      onMoveCurrency(pending.currencyId, destination.placement.col, destination.placement.row);
      const settled = { ...visual, rect: destination.rect, settling: true };
      activeDragRef.current = settled;
      setDragVisual(settled);
      playUISound("gearMove");
      clearDragAfterAnimation();
    },
    [clearDragAfterAnimation, onMoveCurrency, updateActiveDrag],
  );

  return {
    draggedCurrencyId,
    dragVisual,
    isAnimating,
    isDraggingActive,
    beginCurrencyPointer,
    moveCurrencyPointer,
    finishCurrencyPointer,
    clearDragState,
  };
}

export { MAGNET_RELEASE_EASE_MS };
