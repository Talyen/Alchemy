import { useCallback, type RefObject } from "react";
import { getCraftingCurrencyDefinition, type CraftingCurrencyId, type InventoryPlacement } from "@/lib/gear";
import { useBoardDrag, type DragDestination, type DragRect } from "./use-board-drag";

const CURRENCY_FOOTPRINT = { w: 1, h: 1 };

export type CurrencyDragOrigin = { kind: "inventory"; placement: InventoryPlacement };
export type CurrencyDragVisual = {
  currencyId: CraftingCurrencyId;
  source: DragRect;
  rect: DragRect;
  origin: CurrencyDragOrigin;
  destination: DragDestination | null;
  settling?: boolean | undefined;
  releasing?: boolean | undefined;
  flyover?: boolean | undefined;
  releaseRect?: DragRect | undefined;
};

export type CurrencyPointerStart = (
  currencyId: CraftingCurrencyId,
  origin: CurrencyDragOrigin,
  rect: DOMRect,
  pointer: { x: number; y: number },
  pointerId: number,
) => void;
export type CurrencyPointerMove = (pointer: { x: number; y: number }, pointerId: number) => void;
export type CurrencyPointerEnd = (pointer: { x: number; y: number }, pointerId: number, cancelled?: boolean) => void;

type CurrencyItem = { id: CraftingCurrencyId; origin: CurrencyDragOrigin };

type UseArmoryCurrencyDragOptions = {
  editable: boolean;
  occupiedRows: number;
  inventoryBoardRef: RefObject<HTMLDivElement | null>;
  onMoveCurrency: (currencyId: CraftingCurrencyId, col: number, row: number) => void;
};

export function useArmoryCurrencyDrag({
  editable,
  occupiedRows,
  inventoryBoardRef,
  onMoveCurrency,
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
      if (
        origin.kind === "inventory" &&
        origin.placement.col === destination.placement.col &&
        origin.placement.row === destination.placement.row
      ) {
        return;
      }
      onMoveCurrency(id, destination.placement.col, destination.placement.row);
    },
  });

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
      if (!editable || !getCraftingCurrencyDefinition(currencyId)) return;
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

  const moveCurrencyPointer = useCallback(
    (pointer: { x: number; y: number }, pointerId: number) => {
      fsm.movePointer(pointer, pointerId);
    },
    [fsm],
  );

  const finishCurrencyPointer = useCallback(
    (pointer: { x: number; y: number }, pointerId: number, cancelled = false) => {
      fsm.finishPointer(pointer, pointerId, cancelled);
    },
    [fsm],
  );

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
    clearDragState: fsm.clearDragState,
  };
}
