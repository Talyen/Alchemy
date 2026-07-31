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
import { useBoardDrag } from "./use-board-drag";
import type { DragPoint, DragRect } from "./drag-types";
import {
  resolveEquipmentSlotAtPointer,
  calculateSecondaryDisplacedItems,
  buildSecondaryDragVisuals,
} from "./armory-drag-helpers";
import { handleGearCommit, type GearCommitEnv } from "./armory-gear-commit";
import { useLatestRef } from "../../../shared/hooks";
import { handleGearDoubleClickAction } from "./armory-gear-double-click";
import { DOUBLE_CLICK_FLYOVER_CLEAR_DELAY_MS, EQUIPMENT_SNAP_INSET_RATIO } from "./drag-constants";
import type { GearDragOrigin, GearDragVisual } from "./armory-gear-drag-types";

export type {
  GearDragOrigin,
  GearDragVisual,
  GearPointerEnd,
  GearPointerMove,
  GearPointerStart,
} from "./armory-gear-drag-types";

interface GearDragItem {
  instance: GearInstance;
  origin: GearDragOrigin;
}
interface UseArmoryGearDragOptions {
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
  onHoldCurrency?: (
    currencyId: CraftingCurrencyId,
    origin: { kind: "inventory"; placement: InventoryPlacement },
    source: DragRect,
  ) => void;
}
export function useArmoryGearDrag({
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
  onHoldCurrency,
}: UseArmoryGearDragOptions) {
  const activeIdRef = useRef<string | null>(null);
  const packedInventoryRef = useLatestRef(packedInventory);
  const packedCurrenciesRef = useLatestRef(packedCurrencies);
  const [secondaryDragVisuals, setSecondaryDragVisuals] = useState<GearDragVisual[]>([]);
  const secondaryCleanupTimerRef = useRef<number | null>(null);
  const fsmClearDragRef = useRef<() => void>(() => {});
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
      secondaryCleanupTimerRef.current = window.setTimeout(() => {
        clearSecondaryDragState();
      }, DOUBLE_CLICK_FLYOVER_CLEAR_DELAY_MS);
    },
    [clearSecondaryDragState, inventoryBoardRef],
  );
  const maybeLaunchSwapAnimations = useCallback(
    (instance: GearInstance, slot: GearSlot, slotRect: DragRect, vacatedPlacement: InventoryPlacement) => {
      const displacedItems = calculateSecondaryDisplacedItems({
        instance,
        slot,
        slotRect,
        vacatedPlacement,
        loadout,
        inventoryById,
        packedItems: packedInventory.items,
      });
      launchSecondarySwapAnimations(displacedItems);
    },
    [inventoryById, launchSecondarySwapAnimations, loadout, packedInventory.items],
  );
  const fsm = useBoardDrag<string, GearDragItem, GearDragOrigin>({
    itemLookup: undefined,
    getItemId: (item) => item.instance.instanceId,
    getOrigin: (item) => item.origin,
    getFootprint: (id) => {
      const instance = inventoryById.get(id);
      return instance ? footprintForInstance(instance) : null;
    },
    inventoryBoardRef,
    occupiedRows: packedInventory.occupiedRows,
    resolveExternalDestination: (pointer) => {
      const id = activeIdRef.current;
      const activeInstance = id ? inventoryById.get(id) : undefined;
      return resolveEquipmentSlotAtPointer({
        pointer,
        activeInstance: activeInstance ?? null,
        loadout,
        inventoryById,
        gearDefinitions,
        equipmentSnapInsetRatio: EQUIPMENT_SNAP_INSET_RATIO,
      });
    },
    onCommit: ({ id, origin, destination }) => {
      const instance = inventoryById.get(id);
      if (!instance) return;
      const env: GearCommitEnv = {
        characterId,
        inventoryById,
        packedInventoryRef,
        packedCurrenciesRef,
        inventoryBoardRef,
        onEquip,
        onUnequip,
        onMoveItem,
        onHoldCurrency,
        maybeLaunchSwapAnimations,
      };
      return handleGearCommit({ id, origin, destination, instance, env });
    },
    onCancel: () => {},
    onClear: () => {},
  });
  const fsmClearDragState = fsm.clearDragState;
  useEffect(() => {
    fsmClearDragRef.current = fsmClearDragState;
  }, [fsmClearDragState]);
  useEffect(() => {
    if (!editable) fsmClearDragState();
  }, [editable, fsmClearDragState]);
  useEffect(() => {
    return () => {
      if (secondaryCleanupTimerRef.current !== null) {
        window.clearTimeout(secondaryCleanupTimerRef.current);
      }
    };
  }, []);
  const fsmBeginPointer = fsm.beginPointer;
  const beginGearPointer = useCallback(
    (instance: GearInstance, origin: GearDragOrigin, source: DragRect, pointer: DragPoint, pointerId: number) => {
      if (!editable || !gearDefinitions[instance.definitionId]) return;
      fsmBeginPointer({ instance, origin }, source, pointer, pointerId);
    },
    [editable, fsmBeginPointer],
  );
  const moveGearPointer = fsm.movePointer;
  const finishGearPointer = fsm.finishPointer;
  const handleGearDoubleClick = useCallback(
    (instance: GearInstance, origin: GearDragOrigin, _source: DragRect) => {
      handleGearDoubleClickAction({
        editable,
        instance,
        origin,
        source: _source,
        characterId,
        loadout,
        boardObstacles,
        inventoryBoard: inventoryBoardRef.current,
        flyoverTo: fsm.flyoverTo,
        onEquip,
        onUnequip,
        onMoveItem,
        maybeLaunchSwapAnimations,
      });
    },
    [
      editable,
      characterId,
      loadout,
      boardObstacles,
      inventoryBoardRef,
      fsm,
      onEquip,
      onUnequip,
      onMoveItem,
      maybeLaunchSwapAnimations,
    ],
  );
  const draggedGear: GearInstance | null = fsm.dragVisual?.id ? (inventoryById.get(fsm.dragVisual.id) ?? null) : null;
  const dragVisual: GearDragVisual | null = fsm.dragVisual
    ? {
        instance: inventoryById.get(fsm.dragVisual.id) ?? null,
        source: fsm.dragVisual.source,
        rect: fsm.dragVisual.rect,
        origin: fsm.dragVisual.origin,
        destination: fsm.dragVisual.destination,
        settling: fsm.dragVisual.settling,
        releasing: fsm.dragVisual.releasing,
        flyover: fsm.dragVisual.flyover,
        releaseRect: fsm.dragVisual.releaseRect,
      }
    : null;
  const dragVisualIdRef = useRef<string | null>(null);
  const isFlyoverRef = useRef<boolean>(false);
  const clearDragState = useCallback(() => {
    fsmClearDragState();
  }, [fsmClearDragState]);
  useEffect(() => {
    activeIdRef.current = fsm.activeId;
    dragVisualIdRef.current = fsm.dragVisual?.id ?? null;
    isFlyoverRef.current = !!fsm.dragVisual?.flyover;
  }, [fsm.activeId, fsm.dragVisual?.id, fsm.dragVisual?.flyover]);
  const abortGearDragIfDragging = useCallback(
    (instanceId: string) => {
      if (isFlyoverRef.current) return;
      if (activeIdRef.current === instanceId || dragVisualIdRef.current === instanceId) {
        clearDragState();
      }
    },
    [clearDragState],
  );
  return {
    draggedGear,
    dragVisual,
    secondaryDragVisuals,
    isAnimating: fsm.isAnimating || secondaryDragVisuals.some((v) => v.flyover),
    isDraggingActive: fsm.isDraggingActive,
    beginGearPointer,
    moveGearPointer,
    finishGearPointer,
    handleGearDoubleClick,
    clearDragState,
    clearSecondaryDragState,
    abortGearDragIfDragging,
    beginHeldGear: fsm.beginHeld,
  };
}
