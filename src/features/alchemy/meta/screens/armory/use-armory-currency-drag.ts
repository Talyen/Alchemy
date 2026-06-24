import { useCallback, useEffect, type RefObject } from "react";
import {
  type CraftingCurrencyId,
  type GearInstance,
  type InventoryPlacement,
  type PackedInventoryItem,
} from "@/lib/gear";
import { type PackedCurrencyItem } from "@/lib/gear/board-view";
import { overlaps } from "@/lib/gear/grid-packing";
import { useBoardDrag } from "./use-board-drag";
import type { DragDestination, DragRect } from "./drag-types";

const CURRENCY_FOOTPRINT = { w: 1, h: 1 };

type CarriableItem =
  | { kind: "gear"; instance: GearInstance; origin: CurrencyDragOrigin }
  | { kind: "currency"; currencyId: CraftingCurrencyId };

export interface CurrencyDragOrigin {
  kind: "inventory";
  placement: InventoryPlacement;
}
export interface CurrencyDragVisual {
  currencyId: CraftingCurrencyId;
  source: DragRect;
  rect: DragRect;
  origin: CurrencyDragOrigin;
  destination: DragDestination | null;
  settling?: boolean | undefined;
  releasing?: boolean | undefined;
  flyover?: boolean | undefined;
  releaseRect?: DragRect | undefined;
}

export type CurrencyPointerStart = (
  currencyId: CraftingCurrencyId,
  origin: CurrencyDragOrigin,
  rect: DOMRect,
  pointer: { x: number; y: number },
  pointerId: number,
) => void;
export type CurrencyPointerMove = (pointer: { x: number; y: number }, pointerId: number) => void;
export type CurrencyPointerEnd = (pointer: { x: number; y: number }, pointerId: number, cancelled?: boolean) => void;

interface CurrencyItem {
  id: CraftingCurrencyId;
  origin: CurrencyDragOrigin;
}

interface UseArmoryCurrencyDragOptions {
  editable: boolean;
  occupiedRows: number;
  inventoryBoardRef: RefObject<HTMLDivElement | null>;
  onMoveCurrency: (currencyId: CraftingCurrencyId, col: number, row: number) => void;
  packedItems: PackedInventoryItem[];
  packedCurrencies: PackedCurrencyItem[];
  inventoryById: Map<string, GearInstance>;
  onSwapWithItem?: (item: CarriableItem, sourceRect: DragRect) => void;
}

export function useArmoryCurrencyDrag({
  editable,
  occupiedRows,
  inventoryBoardRef,
  onMoveCurrency,
  packedItems,
  packedCurrencies,
  inventoryById,
  onSwapWithItem,
}: UseArmoryCurrencyDragOptions) {
  const fsm = useBoardDrag<CraftingCurrencyId, CurrencyItem, CurrencyDragOrigin>({
    itemLookup: undefined,
    getItemId: (item) => item.id,
    getOrigin: (item) => item.origin,
    getFootprint: () => CURRENCY_FOOTPRINT,
    inventoryBoardRef,
    occupiedRows,
    onCommit: ({ id, origin, destination }) => {
      if (destination.kind !== "inventory") return;
      if (origin.placement.col === destination.placement.col && origin.placement.row === destination.placement.row) {
        return;
      }
      const col = destination.placement.col;
      const row = destination.placement.row;
      const occupant = packedItems.find((item) =>
        overlaps({ col, row, w: 1, h: 1 }, { col: item.col, row: item.row, w: item.w, h: item.h }),
      );
      const occupantInstance = occupant ? inventoryById.get(occupant.item.instanceId) : undefined;
      const occupantCurrency = packedCurrencies.find((c) => c.col === col && c.row === row);
      onMoveCurrency(id, col, row);
      if (occupant && occupantInstance && onSwapWithItem) {
        onSwapWithItem(
          {
            kind: "gear",
            instance: occupantInstance,
            origin: { kind: "inventory", placement: { col: occupant.col, row: occupant.row } },
          },
          destination.rect,
        );
      } else if (occupantCurrency && onSwapWithItem) {
        return {
          heldItem: {
            item: {
              id: occupantCurrency.currencyId,
              origin: { kind: "inventory", placement: { col: occupantCurrency.col, row: occupantCurrency.row } },
            },
            source: destination.rect,
          },
        };
      }
      return undefined;
    },
  });
  const fsmClearDragState = fsm.clearDragState;

  // Derive draggedCurrencyId from the FSM's dragVisual — only true once the drag actually
  // activates (after pointer moves past activation distance), preventing the source tile from
  // disappearing on initial click.
  const draggedCurrencyId: CraftingCurrencyId | null = fsm.dragVisual?.id ?? null;

  const beginCurrencyPointer = useCallback(
    (
      currencyId: CraftingCurrencyId,
      origin: CurrencyDragOrigin,
      rect: DOMRect,
      pointer: { x: number; y: number },
      pointerId: number,
    ) => {
      if (!editable) return;
      const source: DragRect = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
      fsm.beginPointer({ id: currencyId, origin }, source, pointer, pointerId);
    },
    [editable, fsm],
  );

  const moveCurrencyPointer = fsm.movePointer;

  const beginHeldCurrency = useCallback(
    (currencyId: CraftingCurrencyId, origin: CurrencyDragOrigin, source: DragRect) => {
      if (!editable) return;
      fsm.beginHeld({ id: currencyId, origin }, source);
    },
    [editable, fsm],
  );

  const finishCurrencyPointer = fsm.finishPointer;

  useEffect(() => {
    if (!editable) fsmClearDragState();
  }, [editable, fsmClearDragState]);

  const dragVisual: CurrencyDragVisual | null = fsm.dragVisual
    ? {
        currencyId: fsm.dragVisual.id,
        source: fsm.dragVisual.source,
        rect: fsm.dragVisual.rect,
        origin: fsm.dragVisual.origin,
        destination: fsm.dragVisual.destination,
        settling: fsm.dragVisual.settling,
        releasing: fsm.dragVisual.releasing,
        flyover: false,
        releaseRect: fsm.dragVisual.releaseRect,
      }
    : null;

  return {
    draggedCurrencyId,
    dragVisual,
    isAnimating: fsm.isAnimating,
    isDraggingActive: fsm.isDraggingActive,
    beginCurrencyPointer,
    moveCurrencyPointer,
    finishCurrencyPointer,
    beginHeldCurrency,
    clearDragState: fsmClearDragState,
  };
}
