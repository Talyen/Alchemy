import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { CharacterId } from "@/lib/game-data";
import {
  footprintForInstance,
  gearDefinitions,
  type CraftingCurrencyId,
  type GearInstance,
  type GearLoadout,
  type GearSlot,
  type InventoryPlacement,
  type PackedCurrencyItem,
  type PackedInventory,
  type PackedInventoryItem,
} from "@/lib/gear";
import { overlaps } from "@/lib/gear/grid-packing";
import { useLatestRef } from "../../../shared/hooks";
import { useBoardDrag } from "./use-board-drag";
import type { DragDestination, DragPoint, DragRect } from "./drag-types";
import {
  resolveEquipmentSlotAtPointer,
  calculateSecondaryDisplacedItems,
  buildSecondaryDragVisuals,
} from "./armory-drag-helpers";
import { handleGearCommit, type GearCommitEnv } from "./armory-gear-commit";
import { handleGearDoubleClickAction } from "./armory-gear-double-click";
import { DOUBLE_CLICK_FLYOVER_CLEAR_DELAY_MS, EQUIPMENT_SNAP_INSET_RATIO } from "./drag-constants";
import type { GearDragOrigin, GearDragVisual } from "./armory-gear-drag-types";

const CURRENCY_FOOTPRINT = { w: 1, h: 1 };

export interface CurrencyDragOrigin {
  kind: "inventory";
  placement: InventoryPlacement;
}

export type ArmoryDragItem =
  | { kind: "gear"; instance: GearInstance; origin: GearDragOrigin }
  | { kind: "currency"; currencyId: CraftingCurrencyId; origin: CurrencyDragOrigin };

type ArmoryDragOrigin = GearDragOrigin | CurrencyDragOrigin;

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
  pointer: DragPoint,
  pointerId: number,
) => void;
export type CurrencyPointerMove = (pointer: DragPoint, pointerId: number) => void;
export type CurrencyPointerEnd = (pointer: DragPoint, pointerId: number, cancelled?: boolean) => void;

interface UseArmoryBoardDragOptions {
  characterId: CharacterId;
  editable: boolean;
  loadout: GearLoadout;
  inventoryById: Map<string, GearInstance>;
  packedInventory: PackedInventory;
  packedCurrencies: PackedCurrencyItem[];
  inventoryBoardRef: RefObject<HTMLDivElement | null>;
  boardObstacles: Array<PackedInventoryItem<{ instanceId: string }>>;
  onEquip: (
    characterId: CharacterId,
    slot: GearSlot,
    instance: GearInstance,
    options?: { vacatedPlacement?: InventoryPlacement },
  ) => void;
  onUnequip: (characterId: CharacterId, slot: GearSlot) => void;
  onMoveItem: (instanceId: string, col: number, row: number) => void;
  onMoveCurrency?: (currencyId: CraftingCurrencyId, col: number, row: number) => void;
}

function itemId(item: ArmoryDragItem): string {
  return item.kind === "gear" ? item.instance.instanceId : item.currencyId;
}

function isCurrencyId(id: string, packedCurrencies: PackedCurrencyItem[]): id is CraftingCurrencyId {
  return packedCurrencies.some((currency) => currency.currencyId === id);
}

export function useArmoryBoardDrag({
  characterId,
  editable,
  loadout,
  inventoryById,
  packedInventory,
  packedCurrencies,
  inventoryBoardRef,
  boardObstacles,
  onEquip,
  onUnequip,
  onMoveItem,
  onMoveCurrency = () => {},
}: UseArmoryBoardDragOptions) {
  const activeIdRef = useRef<string | null>(null);
  const isFlyoverRef = useRef(false);
  const packedInventoryRef = useLatestRef(packedInventory);
  const packedCurrenciesRef = useLatestRef(packedCurrencies);
  const [secondaryDragVisuals, setSecondaryDragVisuals] = useState<GearDragVisual[]>([]);
  const secondaryCleanupTimerRef = useRef<number | null>(null);

  const clearSecondaryDragState = useCallback(() => {
    if (secondaryCleanupTimerRef.current !== null) {
      window.clearTimeout(secondaryCleanupTimerRef.current);
      secondaryCleanupTimerRef.current = null;
    }
    setSecondaryDragVisuals([]);
  }, []);

  const launchSecondarySwapAnimations = useCallback(
    (displacedItems: Array<{ instance: GearInstance; source: DragRect; vacatedPlacement: InventoryPlacement }>) => {
      const board = inventoryBoardRef.current;
      if (!board || displacedItems.length === 0) return;
      const visuals = buildSecondaryDragVisuals({ board, displacedItems });
      if (visuals.length === 0) return;
      setSecondaryDragVisuals(visuals);
      if (secondaryCleanupTimerRef.current !== null) window.clearTimeout(secondaryCleanupTimerRef.current);
      secondaryCleanupTimerRef.current = window.setTimeout(
        clearSecondaryDragState,
        DOUBLE_CLICK_FLYOVER_CLEAR_DELAY_MS,
      );
    },
    [clearSecondaryDragState, inventoryBoardRef],
  );

  const maybeLaunchSwapAnimations = useCallback(
    (instance: GearInstance, slot: GearSlot, slotRect: DragRect, vacatedPlacement: InventoryPlacement) => {
      launchSecondarySwapAnimations(
        calculateSecondaryDisplacedItems({
          instance,
          slot,
          slotRect,
          vacatedPlacement,
          loadout,
          inventoryById,
          packedItems: packedInventory.items,
        }),
      );
    },
    [inventoryById, launchSecondarySwapAnimations, loadout, packedInventory.items],
  );

  const fsm = useBoardDrag<string, ArmoryDragItem, ArmoryDragOrigin>({
    itemLookup: undefined,
    getItemId: itemId,
    getOrigin: (item) => item.origin,
    getFootprint: (id) => {
      const instance = inventoryById.get(id);
      return instance ? footprintForInstance(instance) : CURRENCY_FOOTPRINT;
    },
    inventoryBoardRef,
    occupiedRows: packedInventory.occupiedRows,
    resolveExternalDestination: (pointer) => {
      const id = activeIdRef.current;
      const activeInstance = id ? inventoryById.get(id) : undefined;
      if (!activeInstance) return null;
      return resolveEquipmentSlotAtPointer({
        pointer,
        activeInstance,
        loadout,
        inventoryById,
        gearDefinitions,
        equipmentSnapInsetRatio: EQUIPMENT_SNAP_INSET_RATIO,
      });
    },
    onCommit: ({ id, origin, destination }) => {
      const instance = inventoryById.get(id);
      if (instance) {
        const env: GearCommitEnv = {
          characterId,
          inventoryById,
          packedInventoryRef,
          packedCurrenciesRef,
          inventoryBoardRef,
          onEquip,
          onUnequip,
          onMoveItem,
          maybeLaunchSwapAnimations,
        };
        const result = handleGearCommit({ id, origin, destination, instance, env });
        if (result?.heldItem) {
          return {
            heldItem: {
              item: result.heldItem.item,
              source: result.heldItem.source,
            },
          };
        }
        return undefined;
      }

      if (!isCurrencyId(id, packedCurrenciesRef.current) || destination.kind !== "inventory") return undefined;
      const currencyOrigin = origin as CurrencyDragOrigin;
      if (
        currencyOrigin.placement.col === destination.placement.col &&
        currencyOrigin.placement.row === destination.placement.row
      ) {
        return undefined;
      }
      const { col, row } = destination.placement;
      const occupant = packedInventoryRef.current.items.find((item) =>
        overlaps({ col, row, w: 1, h: 1 }, { col: item.col, row: item.row, w: item.w, h: item.h }),
      );
      const occupantInstance = occupant ? inventoryById.get(occupant.item.instanceId) : undefined;
      const occupantCurrency = packedCurrenciesRef.current.find(
        (currency) => currency.currencyId !== id && currency.col === col && currency.row === row,
      );
      onMoveCurrency(id, col, row);
      if (occupant && occupantInstance) {
        return {
          heldItem: {
            item: {
              kind: "gear",
              instance: occupantInstance,
              origin: { kind: "inventory", placement: { col: occupant.col, row: occupant.row } },
            },
            source: destination.rect,
          },
        };
      }
      if (occupantCurrency) {
        return {
          heldItem: {
            item: {
              kind: "currency",
              currencyId: occupantCurrency.currencyId,
              origin: { kind: "inventory", placement: { col: occupantCurrency.col, row: occupantCurrency.row } },
            },
            source: destination.rect,
          },
        };
      }
      return undefined;
    },
  });
  const {
    activeId,
    activeItem,
    beginHeld,
    beginPointer,
    clearDragState,
    completeDragAnimation,
    dragVisual,
    finishPointer,
    flyoverTo,
    isAnimating,
    isDraggingActive,
    movePointer,
  } = fsm;

  useEffect(() => {
    activeIdRef.current = activeId;
    isFlyoverRef.current = !!dragVisual?.flyover;
  }, [activeId, dragVisual?.flyover]);
  useEffect(() => {
    if (!editable) clearDragState();
  }, [clearDragState, editable]);
  useEffect(
    () => () => {
      if (secondaryCleanupTimerRef.current !== null) window.clearTimeout(secondaryCleanupTimerRef.current);
    },
    [],
  );

  const beginGearPointer = useCallback(
    (instance: GearInstance, origin: GearDragOrigin, source: DragRect, pointer: DragPoint, pointerId: number) => {
      if (!editable || !gearDefinitions[instance.definitionId]) return;
      beginPointer({ kind: "gear", instance, origin }, source, pointer, pointerId);
    },
    [beginPointer, editable],
  );
  const beginCurrencyPointer = useCallback<CurrencyPointerStart>(
    (currencyId, origin, rect, pointer, pointerId) => {
      if (!editable) return;
      beginPointer(
        { kind: "currency", currencyId, origin },
        { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        pointer,
        pointerId,
      );
    },
    [beginPointer, editable],
  );

  const handleGearDoubleClick = useCallback(
    (instance: GearInstance, origin: GearDragOrigin, source: DragRect) => {
      handleGearDoubleClickAction({
        editable,
        instance,
        origin,
        source,
        characterId,
        loadout,
        boardObstacles,
        inventoryBoard: inventoryBoardRef.current,
        flyoverTo: (item, destination, commit, flyoverSource) =>
          flyoverTo({ kind: "gear", ...item }, destination, commit, flyoverSource),
        onEquip,
        onUnequip,
        onMoveItem,
        maybeLaunchSwapAnimations,
      });
    },
    [
      boardObstacles,
      characterId,
      editable,
      flyoverTo,
      inventoryBoardRef,
      loadout,
      maybeLaunchSwapAnimations,
      onEquip,
      onMoveItem,
      onUnequip,
    ],
  );

  const activeGear = activeItem?.kind === "gear" ? activeItem.instance : null;
  const activeCurrency = activeItem?.kind === "currency" ? activeItem.currencyId : null;
  const gearDragVisual: GearDragVisual | null =
    dragVisual && activeGear ? { ...dragVisual, instance: activeGear, origin: dragVisual.origin } : null;
  const currencyDragVisual: CurrencyDragVisual | null =
    dragVisual && activeCurrency && dragVisual.origin.kind === "inventory"
      ? { ...dragVisual, currencyId: activeCurrency, origin: dragVisual.origin }
      : null;

  const abortGearDragIfDragging = useCallback(
    (instanceId: string) => {
      if (isFlyoverRef.current) return;
      if (activeIdRef.current === instanceId) clearDragState();
    },
    [clearDragState],
  );

  return {
    draggedGear: activeGear,
    draggedCurrencyId: activeCurrency,
    gearDragVisual,
    dragVisual: gearDragVisual,
    currencyDragVisual,
    secondaryDragVisuals,
    isAnimating: isAnimating || secondaryDragVisuals.some((visual) => visual.flyover),
    isDraggingActive,
    beginGearPointer,
    moveGearPointer: movePointer,
    finishGearPointer: finishPointer,
    beginCurrencyPointer,
    moveCurrencyPointer: movePointer,
    finishCurrencyPointer: finishPointer,
    handleGearDoubleClick,
    clearDragState,
    completeDragAnimation,
    clearSecondaryDragState,
    abortGearDragIfDragging,
    beginHeldGear: (item: Omit<Extract<ArmoryDragItem, { kind: "gear" }>, "kind">, source: DragRect) =>
      beginHeld({ kind: "gear", ...item }, source),
    beginHeldCurrency: (currencyId: CraftingCurrencyId, origin: CurrencyDragOrigin, source: DragRect) =>
      beginHeld({ kind: "currency", currencyId, origin }, source),
  };
}
