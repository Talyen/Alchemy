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
import { useLatestRef } from "../../../shared/hooks";
import { useBoardDrag } from "./use-board-drag";
import type {
  ArmoryDragItem,
  ArmoryDragOrigin,
  CurrencyDragOrigin,
  DragPoint,
  DragRect,
  GearDragOrigin,
  GearDragVisual,
} from "./armory-drag-types";
import {
  resolveEquipmentSlotAtPointer,
  calculateSecondaryDisplacedItems,
  buildSecondaryDragVisuals,
  handleGearCommit,
  handleCurrencyCommit,
  handleGearDoubleClickAction,
  type ArmoryDragEnv,
  type HeldDragResult,
} from "./armory-gear-actions";
import { DOUBLE_CLICK_FLYOVER_CLEAR_DELAY_MS, EQUIPMENT_SNAP_INSET_RATIO } from "./drag-constants";

const CURRENCY_FOOTPRINT = { w: 1, h: 1 };

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

function toHeldDragItem(held: HeldDragResult): ArmoryDragItem {
  if (held.kind === "gear") {
    return { kind: "gear", instance: held.item, origin: held.origin };
  }
  return { kind: "currency", currencyId: held.item.currencyId, origin: held.origin };
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

  const buildEnv = useCallback((): ArmoryDragEnv => {
    return {
      characterId,
      inventoryById,
      packedInventory,
      packedCurrencies: packedCurrenciesRef.current,
      inventoryBoard: inventoryBoardRef.current,
      onEquip,
      onUnequip,
      onMoveItem,
      onMoveCurrency,
      maybeLaunchSwapAnimations,
    };
  }, [
    characterId,
    inventoryById,
    inventoryBoardRef,
    maybeLaunchSwapAnimations,
    onEquip,
    onMoveCurrency,
    onMoveItem,
    onUnequip,
    packedCurrenciesRef,
    packedInventory,
  ]);

  const fsm = useBoardDrag<ArmoryDragItem, ArmoryDragOrigin>({
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
      const env = buildEnv();
      const instance = inventoryById.get(id);
      const result = instance
        ? handleGearCommit({ id, origin, destination, instance, env })
        : handleCurrencyCommit({
            id: id as CraftingCurrencyId,
            origin: origin as CurrencyDragOrigin,
            destination,
            env,
          });
      if (!result?.heldItem) return undefined;
      return { heldItem: { item: toHeldDragItem(result.heldItem), source: result.heldItem.source } };
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
  const beginCurrencyPointer = useCallback(
    (
      currencyId: CraftingCurrencyId,
      origin: CurrencyDragOrigin,
      rect: DOMRect,
      pointer: DragPoint,
      pointerId: number,
    ) => {
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
        env: buildEnv(),
        loadout,
        boardObstacles,
        flyoverTo: (item, destination, commit, flyoverSource) =>
          flyoverTo({ kind: "gear", ...item }, destination, commit, flyoverSource),
      });
    },
    [boardObstacles, buildEnv, editable, flyoverTo, loadout],
  );

  const activeGear = activeItem?.kind === "gear" ? activeItem.instance : null;
  const activeCurrency = activeItem?.kind === "currency" ? activeItem.currencyId : null;
  const gearDragVisual: GearDragVisual | null =
    dragVisual && activeGear ? { ...dragVisual, instance: activeGear, origin: dragVisual.origin } : null;
  const currencyDragVisual =
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
