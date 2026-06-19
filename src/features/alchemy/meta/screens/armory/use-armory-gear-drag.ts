import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { playUISound } from "@/lib/audio";
import type { CharacterId } from "@/lib/game-data";
import {
  canEquipInOffHand,
  findFirstInventoryPlacement,
  footprintForInstance,
  gearDefinitions,
  INVENTORY_COLS,
  inventoryPlacementRect,
  isGearCompatibleWithLoadoutSlot,
  isTwoHanded,
  type GearInstance,
  type GearLoadout,
  type GearSlot,
  type InventoryPlacement,
  type PackedInventory,
  type PackedInventoryItem,
} from "@/lib/gear";
import { readInventoryBoardMetrics } from "./read-inventory-board-metrics";
import { resolveEquipSwap } from "./resolve-equip-swap";
import { useBoardDrag, type DragDestination, type DragRect, type DragPoint } from "./use-board-drag";

export type GearDragOrigin =
  | { kind: "inventory"; placement: { col: number; row: number } }
  | { kind: "equipment"; slot: GearSlot };

export type GearPointerStart = (
  instance: GearInstance,
  origin: GearDragOrigin,
  rect: DOMRect,
  pointer: { x: number; y: number },
  pointerId: number,
) => void;

export type GearPointerMove = (pointer: { x: number; y: number }, pointerId: number) => void;

export type GearPointerEnd = (pointer: { x: number; y: number }, pointerId: number, cancelled?: boolean) => void;

export { MAGNET_RELEASE_EASE_MS } from "./use-board-drag";
export const DOUBLE_CLICK_FLYOVER_MS = 280;
const EQUIPMENT_SNAP_INSET_RATIO = 0.3;

export type GearDragVisual = {
  instance: GearInstance;
  source: DragRect;
  rect: DragRect;
  origin: GearDragOrigin;
  destination: DragDestination | null;
  settling?: boolean | undefined;
  flyover?: boolean | undefined;
  releasing?: boolean | undefined;
  releaseRect?: DragRect | undefined;
};

type GearDragItem = {
  instance: GearInstance;
  origin: GearDragOrigin;
};

type UseArmoryGearDragOptions = {
  characterId: CharacterId;
  editable: boolean;
  loadout: GearLoadout;
  inventoryById: Map<string, GearInstance>;
  packedInventory: PackedInventory;
  inventoryBoardRef: RefObject<HTMLDivElement | null>;
  boardObstacles: PackedInventoryItem<{ instanceId: string }>[];
  onEquip: (
    characterId: CharacterId,
    slot: GearSlot,
    instance: GearInstance,
    options?: { vacatedPlacement?: InventoryPlacement },
  ) => void;
  onUnequip: (characterId: CharacterId, slot: GearSlot) => void;
  onMoveItem: (instanceId: string, col: number, row: number) => void;
};

export function useArmoryGearDrag({
  characterId,
  editable,
  loadout,
  inventoryById,
  packedInventory,
  inventoryBoardRef,
  boardObstacles,
  onEquip,
  onUnequip,
  onMoveItem,
}: UseArmoryGearDragOptions) {
  const activeInstanceRef = useRef<GearInstance | null>(null);
  const [activeInstance, setActiveInstance] = useState<GearInstance | null>(null);
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
    (displacedItems: { instance: GearInstance; source: DragRect; vacatedPlacement: InventoryPlacement }[]) => {
      const board = inventoryBoardRef.current;
      if (!board || displacedItems.length === 0) return;
      const metrics = readInventoryBoardMetrics(board);
      if (!metrics) return;
      const { cellSize, gap, boardRect, scrollTop } = metrics;

      const visuals: GearDragVisual[] = [];
      for (const { instance: displaced, source, vacatedPlacement } of displacedItems) {
        const footprint = footprintForInstance(displaced);
        if (!footprint) continue;
        const localRect = inventoryPlacementRect(vacatedPlacement, footprint, { cellSize, gap });
        const destinationRect: DragRect = {
          left: boardRect.left + localRect.left,
          top: boardRect.top + localRect.top - scrollTop,
          width: localRect.width,
          height: localRect.height,
        };
        visuals.push({
          instance: displaced,
          source,
          rect: destinationRect,
          origin: { kind: "inventory", placement: vacatedPlacement },
          destination: { kind: "inventory", placement: vacatedPlacement, rect: destinationRect },
          flyover: true,
        });
      }

      if (visuals.length === 0) return;
      setSecondaryDragVisuals(visuals);
      if (secondaryCleanupTimerRef.current !== null) window.clearTimeout(secondaryCleanupTimerRef.current);
      secondaryCleanupTimerRef.current = window.setTimeout(() => {
        clearSecondaryDragState();
      }, DOUBLE_CLICK_FLYOVER_MS);
    },
    [clearSecondaryDragState, inventoryBoardRef],
  );

  const maybeLaunchSwapAnimations = useCallback(
    (instance: GearInstance, slot: GearSlot, slotRect: DragRect, vacatedPlacement: InventoryPlacement) => {
      const { displaced } = resolveEquipSwap({
        loadout,
        slot,
        instance,
        vacatedPlacement,
        inventoryById,
        packedItems: packedInventory.items,
      });
      const toAnimate: { instance: GearInstance; source: DragRect; vacatedPlacement: InventoryPlacement }[] = [];
      if (displaced) {
        toAnimate.push({ instance: displaced, source: slotRect, vacatedPlacement });
      }
      const otherSlot: GearSlot | null = slot === "main-hand" ? "off-hand" : slot === "off-hand" ? "main-hand" : null;
      if (otherSlot) {
        const otherInstanceId = loadout[otherSlot];
        if (otherInstanceId && otherInstanceId !== instance.instanceId && otherInstanceId !== displaced?.instanceId) {
          const otherInstance = inventoryById.get(otherInstanceId);
          const board = inventoryBoardRef.current;
          if (otherInstance && board) {
            const otherSlotEl = document.querySelector<HTMLElement>(
              `[data-testid='armory-equipment-slot'][data-slot='${otherSlot}']`,
            );
            const otherSource: DragRect = otherSlotEl ? otherSlotEl.getBoundingClientRect() : slotRect;
            toAnimate.push({ instance: otherInstance, source: otherSource, vacatedPlacement });
          }
        }
      }
      launchSecondarySwapAnimations(toAnimate);
    },
    [inventoryById, inventoryBoardRef, launchSecondarySwapAnimations, loadout, packedInventory.items],
  );

  const fsm = useBoardDrag<string, GearDragItem, GearDragOrigin>({
    itemLookup: undefined,
    getItemId: (item) => item.instance.instanceId,
    getOrigin: (item) => item.origin,
    getFootprint: (id) => {
      const instance = activeInstanceRef.current || inventoryById.get(id);
      return instance ? footprintForInstance(instance) : null;
    },
    inventoryBoardRef,
    occupiedRows: packedInventory.occupiedRows,
    resolveExternalDestination: (pointer) => {
      const instance = activeInstanceRef.current;
      if (!instance) return null;
      const definition = gearDefinitions[instance.definitionId];
      if (!definition) return null;

      const element = document.elementFromPoint(pointer.x, pointer.y);
      const slotElement = element?.closest<HTMLElement>("[data-testid='armory-equipment-slot']");
      const slot = slotElement?.dataset.slot as GearSlot | undefined;
      const inventoryList = Array.from(inventoryById.values());
      if (slotElement && slot && isGearCompatibleWithLoadoutSlot(definition, slot, loadout, inventoryList)) {
        const rect = slotElement.getBoundingClientRect();
        const insetX = rect.width * EQUIPMENT_SNAP_INSET_RATIO;
        const insetY = rect.height * EQUIPMENT_SNAP_INSET_RATIO;
        if (
          pointer.x >= rect.left + insetX &&
          pointer.x <= rect.right - insetX &&
          pointer.y >= rect.top + insetY &&
          pointer.y <= rect.bottom - insetY
        ) {
          return { kind: "equipment", slot, rect };
        }
      }
      return null;
    },
    onCommit: ({ id, origin, destination }) => {
      const instance = activeInstanceRef.current || inventoryById.get(id);
      if (!instance) return;
      if (destination.kind === "equipment") {
        const slot = destination.slot as GearSlot;
        const vacatedPlacement = origin.kind === "inventory" ? origin.placement : undefined;
        if (vacatedPlacement) {
          maybeLaunchSwapAnimations(instance, slot, destination.rect, vacatedPlacement);
        }
        onEquip(characterId, slot, instance, vacatedPlacement ? { vacatedPlacement } : undefined);
      } else if (destination.kind === "inventory") {
        const unchanged =
          origin.kind === "inventory" &&
          origin.placement.col === destination.placement.col &&
          origin.placement.row === destination.placement.row;
        if (!unchanged) {
          onMoveItem(id, destination.placement.col, destination.placement.row);
          if (origin.kind === "equipment") onUnequip(characterId, origin.slot);
        }
      }
    },
    onCancel: () => {
      activeInstanceRef.current = null;
      setActiveInstance(null);
    },
  });

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
      activeInstanceRef.current = instance;
      setActiveInstance(instance);
      fsmBeginPointer({ instance, origin }, source, pointer, pointerId);
    },
    [editable, fsmBeginPointer, setActiveInstance],
  );

  const fsmMovePointer = fsm.movePointer;
  const moveGearPointer = useCallback(
    (pointer: DragPoint, pointerId: number) => {
      fsmMovePointer(pointer, pointerId);
    },
    [fsmMovePointer],
  );

  const fsmFinishPointer = fsm.finishPointer;
  const finishGearPointer = useCallback(
    (pointer: DragPoint, pointerId: number, cancelled = false) => {
      fsmFinishPointer(pointer, pointerId, cancelled);
    },
    [fsmFinishPointer],
  );

  const handleGearDoubleClick = useCallback(
    (instance: GearInstance, origin: GearDragOrigin, _source: DragRect) => {
      if (!editable) return;
      const definition = gearDefinitions[instance.definitionId];
      if (!definition) return;

      if (origin.kind === "inventory") {
        const compatibleSlots = definition.compatibleSlots;
        let slot = compatibleSlots.find((candidate) => !loadout[candidate]) ?? null;
        if (!slot) {
          if (
            !isTwoHanded(definition) &&
            !!loadout["main-hand"] &&
            !loadout["off-hand"] &&
            compatibleSlots.includes("off-hand") &&
            canEquipInOffHand(definition)
          ) {
            slot = "off-hand";
          } else {
            slot = compatibleSlots[0] ?? null;
          }
        }
        if (!slot) {
          playUISound("error");
          return;
        }
        const slotElement = document.querySelector<HTMLElement>(
          `[data-testid='armory-equipment-slot'][data-slot='${slot}']`,
        );
        if (!slotElement) return;
        const slotRect = slotElement.getBoundingClientRect();
        activeInstanceRef.current = instance;
        setActiveInstance(instance);
        fsm.flyoverTo(
          { instance, origin },
          { kind: "equipment", slot, rect: slotRect },
          () => {
            maybeLaunchSwapAnimations(instance, slot, slotRect, origin.placement);
            onEquip(characterId, slot, instance, { vacatedPlacement: origin.placement });
          },
          _source,
        );
        return;
      }

      const board = inventoryBoardRef.current;
      if (!board) return;
      const metrics = readInventoryBoardMetrics(board);
      const footprint = footprintForInstance(instance);
      if (!metrics || !footprint) return;
      const { cellSize, gap, boardRect, scrollTop } = metrics;
      const placement = findFirstInventoryPlacement(boardObstacles, instance.instanceId, footprint, INVENTORY_COLS);
      const localRect = inventoryPlacementRect(placement, footprint, { cellSize, gap });
      const destination: DragDestination = {
        kind: "inventory",
        placement,
        rect: {
          left: boardRect.left + localRect.left,
          top: boardRect.top + localRect.top - scrollTop,
          width: localRect.width,
          height: localRect.height,
        },
      };
      activeInstanceRef.current = instance;
      setActiveInstance(instance);
      fsm.flyoverTo(
        { instance, origin },
        destination,
        () => {
          onMoveItem(instance.instanceId, destination.placement.col, destination.placement.row);
          onUnequip(characterId, origin.slot);
        },
        _source,
      );
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
      setActiveInstance,
    ],
  );

  const draggedGear: GearInstance | null = fsm.dragVisual?.id
    ? inventoryById.get(fsm.dragVisual.id) || activeInstance
    : null;

  const dragVisual: GearDragVisual | null = fsm.dragVisual
    ? {
        instance: inventoryById.get(fsm.dragVisual.id) || activeInstance!,
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

  const fsmClearDragState = fsm.clearDragState;
  const clearDragState = useCallback(() => {
    activeInstanceRef.current = null;
    setActiveInstance(null);
    fsmClearDragState();
  }, [fsmClearDragState]);

  const activeIdRef = useRef<string | null>(null);
  const dragVisualIdRef = useRef<string | null>(null);
  const isFlyoverRef = useRef<boolean>(false);

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
  };
}
