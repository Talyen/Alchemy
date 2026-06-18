import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { playUISound } from "@/lib/audio";
import type { CharacterId } from "@/lib/game-data";
import {
  footprintForInstance,
  gearDefinitions,
  INVENTORY_COLS,
  INVENTORY_VISIBLE_ROWS,
  findNearestInventoryPlacement,
  inventoryPlacementRect,
  isGearCompatibleWithSlot,
  type GearInstance,
  type GearLoadout,
  type GearSlot,
  resolveInventoryReturnPlacement,
  type GearBoardPositions,
  type InventoryPlacement,
  type PackedInventory,
  type PackedInventoryItem,
} from "@/lib/gear";
import { readInventoryBoardMetrics } from "./read-inventory-board-metrics";
import { resolveEquipSwap } from "./resolve-equip-swap";

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

const INVENTORY_SNAP_RADIUS_CELLS = 0.28;
const EQUIPMENT_SNAP_INSET_RATIO = 0.3;
const MAGNET_SWITCH_MARGIN_PX = 14;
const MAGNET_RELEASE_HYSTERESIS_PX = 18;
export const DOUBLE_CLICK_FLYOVER_MS = 280;
export const MAGNET_RELEASE_EASE_MS = 140;

export type DragPoint = { x: number; y: number };
export type DragRect = { left: number; top: number; width: number; height: number };
export type DragDestination =
  | { kind: "equipment"; slot: GearSlot; rect: DragRect }
  | { kind: "inventory"; placement: InventoryPlacement; rect: DragRect };
export type GearDragVisual = {
  instance: GearInstance;
  source: DragRect;
  rect: DragRect;
  origin: GearDragOrigin;
  destination: DragDestination | null;
  settling?: boolean;
  flyover?: boolean;
  releasing?: boolean;
};

type PendingGearDrag = {
  instance: GearInstance;
  origin: GearDragOrigin;
  source: DragRect;
  pointerId: number;
  pointerStart: DragPoint;
  offset: DragPoint;
};

type UseArmoryGearDragOptions = {
  characterId: CharacterId;
  editable: boolean;
  loadout: GearLoadout;
  inventoryById: Map<string, GearInstance>;
  packedInventory: PackedInventory;
  inventoryBoardRef: RefObject<HTMLDivElement | null>;
  boardPositions: GearBoardPositions;
  equippedReturnPositions: GearBoardPositions;
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
  boardPositions,
  equippedReturnPositions,
  boardObstacles,
  onEquip,
  onUnequip,
  onMoveItem,
}: UseArmoryGearDragOptions) {
  const [draggedGear, setDraggedGear] = useState<GearInstance | null>(null);
  const [dragVisual, setDragVisual] = useState<GearDragVisual | null>(null);
  const [secondaryDragVisual, setSecondaryDragVisual] = useState<GearDragVisual | null>(null);
  const pendingDragRef = useRef<PendingGearDrag | null>(null);
  const activeDragRef = useRef<GearDragVisual | null>(null);
  const pendingFlyoverCommitRef = useRef<(() => void) | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);
  const secondaryCleanupTimerRef = useRef<number | null>(null);

  const isAnimating = !!dragVisual?.settling || !!dragVisual?.flyover || !!secondaryDragVisual?.flyover;
  const isDraggingActive =
    !!draggedGear && (!dragVisual || (!dragVisual.settling && !dragVisual.flyover && !dragVisual.releasing));

  useEffect(() => {
    if (!draggedGear) return;
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";
    return () => {
      document.body.style.cursor = previousCursor;
    };
  }, [draggedGear]);

  const clearSecondaryDragState = useCallback(() => {
    if (secondaryCleanupTimerRef.current !== null) {
      window.clearTimeout(secondaryCleanupTimerRef.current);
      secondaryCleanupTimerRef.current = null;
    }
    setSecondaryDragVisual(null);
  }, []);

  const launchSecondarySwapAnimation = useCallback(
    (displaced: GearInstance, source: DragRect, vacatedPlacement: InventoryPlacement) => {
      const board = inventoryBoardRef.current;
      if (!board) return;
      const metrics = readInventoryBoardMetrics(board);
      const footprint = footprintForInstance(displaced);
      if (!metrics || !footprint) return;
      const { cellSize, gap, boardRect, scrollTop } = metrics;
      const localRect = inventoryPlacementRect(vacatedPlacement, footprint, { cellSize, gap });
      const destinationRect: DragRect = {
        left: boardRect.left + localRect.left,
        top: boardRect.top + localRect.top - scrollTop,
        width: localRect.width,
        height: localRect.height,
      };
      setSecondaryDragVisual({
        instance: displaced,
        source,
        rect: destinationRect,
        origin: { kind: "inventory", placement: vacatedPlacement },
        destination: { kind: "inventory", placement: vacatedPlacement, rect: destinationRect },
        flyover: true,
      });
      if (secondaryCleanupTimerRef.current !== null) window.clearTimeout(secondaryCleanupTimerRef.current);
      secondaryCleanupTimerRef.current = window.setTimeout(() => {
        clearSecondaryDragState();
      }, DOUBLE_CLICK_FLYOVER_MS);
    },
    [clearSecondaryDragState, inventoryBoardRef],
  );

  const maybeLaunchSwapAnimation = useCallback(
    (instance: GearInstance, slot: GearSlot, slotRect: DragRect, vacatedPlacement: InventoryPlacement) => {
      const { displaced } = resolveEquipSwap({
        loadout,
        slot,
        instance,
        vacatedPlacement,
        inventoryById,
        packedItems: packedInventory.items,
      });
      if (displaced) {
        launchSecondarySwapAnimation(displaced, slotRect, vacatedPlacement);
      }
    },
    [inventoryById, launchSecondarySwapAnimation, loadout, packedInventory.items],
  );

  const getInventoryDestination = useCallback(
    (instance: GearInstance, freeRect: DragRect, requireProximity = true): DragDestination | null => {
      const board = inventoryBoardRef.current;
      if (!board) return null;
      const metrics = readInventoryBoardMetrics(board);
      const footprint = footprintForInstance(instance);
      if (!metrics || !footprint) return null;
      const { cellSize, gap, boardRect, scrollTop } = metrics;
      const renderedRows = Math.max(INVENTORY_VISIBLE_ROWS, packedInventory.occupiedRows + footprint.h);
      const placement = findNearestInventoryPlacement(
        boardObstacles,
        instance.instanceId,
        footprint,
        { cellSize, gap, cols: INVENTORY_COLS, rows: renderedRows },
        {
          x: freeRect.left + freeRect.width / 2 - boardRect.left,
          y: freeRect.top + freeRect.height / 2 - boardRect.top + scrollTop,
        },
      );
      if (!placement) return null;
      const localRect = inventoryPlacementRect(placement, footprint, { cellSize, gap });
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
    [inventoryBoardRef, packedInventory.occupiedRows, boardObstacles],
  );

  const getDragDestination = useCallback(
    (instance: GearInstance, freeRect: DragRect, pointer: DragPoint): DragDestination | null => {
      const definition = gearDefinitions[instance.definitionId];
      if (!definition) return null;

      const element = document.elementFromPoint(pointer.x, pointer.y);
      const slotElement = element?.closest<HTMLElement>("[data-testid='armory-equipment-slot']");
      const slot = slotElement?.dataset.slot as GearSlot | undefined;
      if (slotElement && slot && isGearCompatibleWithSlot(definition, slot)) {
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

      const board = inventoryBoardRef.current;
      const boardRect = board?.getBoundingClientRect();
      if (
        boardRect &&
        pointer.x >= boardRect.left &&
        pointer.x <= boardRect.right &&
        pointer.y >= boardRect.top &&
        pointer.y <= boardRect.bottom
      ) {
        return getInventoryDestination(instance, freeRect, false);
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
    pendingFlyoverCommitRef.current?.();
    pendingFlyoverCommitRef.current = null;
    setDraggedGear(null);
    setDragVisual(null);
    activeDragRef.current = null;
  }, []);

  const abortActiveDrag = useCallback(() => {
    pendingDragRef.current = null;
    pendingFlyoverCommitRef.current = null;
    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    clearDragState();
  }, [clearDragState]);

  const abortGearDragIfDragging = useCallback(
    (instanceId: string) => {
      const pending = pendingDragRef.current;
      const active = activeDragRef.current;
      if (pending?.instance.instanceId === instanceId || active?.instance.instanceId === instanceId) {
        abortActiveDrag();
      }
    },
    [abortActiveDrag],
  );

  useEffect(
    () => () => {
      if (cleanupTimerRef.current !== null) window.clearTimeout(cleanupTimerRef.current);
      if (secondaryCleanupTimerRef.current !== null) window.clearTimeout(secondaryCleanupTimerRef.current);
      abortActiveDrag();
    },
    [abortActiveDrag],
  );

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
        setDraggedGear(pending.instance);
      }
      const freeRect = {
        left: pointer.x - pending.offset.x,
        top: pointer.y - pending.offset.y,
        width: pending.source.width,
        height: pending.source.height,
      };
      const candidate = getDragDestination(pending.instance, freeRect, pointer);
      const previousDestination = activeDragRef.current?.destination ?? null;
      const freeCenter = { x: freeRect.left + freeRect.width / 2, y: freeRect.top + freeRect.height / 2 };
      const distanceTo = (destination: DragDestination) => {
        const centerX = destination.rect.left + destination.rect.width / 2;
        const centerY = destination.rect.top + destination.rect.height / 2;
        return Math.hypot(freeCenter.x - centerX, freeCenter.y - centerY);
      };
      const sameDestination = (left: DragDestination, right: DragDestination) =>
        left.kind === right.kind &&
        (left.kind === "equipment"
          ? right.kind === "equipment" && left.slot === right.slot
          : right.kind === "inventory" &&
            left.placement.col === right.placement.col &&
            left.placement.row === right.placement.row);

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

      const visual = {
        instance: pending.instance,
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

  const beginGearPointer = useCallback(
    (instance: GearInstance, origin: GearDragOrigin, source: DragRect, pointer: DragPoint, pointerId: number) => {
      if (!gearDefinitions[instance.definitionId]) return;
      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
      pendingFlyoverCommitRef.current?.();
      pendingFlyoverCommitRef.current = null;
      activeDragRef.current = null;
      setDragVisual(null);
      setDraggedGear(null);
      pendingDragRef.current = {
        instance,
        origin,
        source,
        pointerId,
        pointerStart: pointer,
        offset: { x: pointer.x - source.left, y: pointer.y - source.top },
      };
    },
    [],
  );

  const moveGearPointer = useCallback(
    (pointer: DragPoint, pointerId: number) => {
      updateActiveDrag(pointer, pointerId);
    },
    [updateActiveDrag],
  );

  const finishGearPointer = useCallback(
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
        (pending.origin.kind === "equipment" &&
          destination.kind === "equipment" &&
          pending.origin.slot === destination.slot) ||
        (pending.origin.kind === "inventory" &&
          destination.kind === "inventory" &&
          pending.origin.placement.col === destination.placement.col &&
          pending.origin.placement.row === destination.placement.row);

      if (unchanged) {
        const reverted = { ...visual, rect: visual.source, destination: null, settling: true };
        activeDragRef.current = reverted;
        setDragVisual(reverted);
        clearDragAfterAnimation();
        return;
      }

      if (destination.kind === "equipment") {
        const vacatedPlacement = pending.origin.kind === "inventory" ? pending.origin.placement : undefined;
        if (vacatedPlacement) {
          maybeLaunchSwapAnimation(visual.instance, destination.slot, destination.rect, vacatedPlacement);
        }
        onEquip(characterId, destination.slot, visual.instance, vacatedPlacement ? { vacatedPlacement } : undefined);
      } else {
        onMoveItem(visual.instance.instanceId, destination.placement.col, destination.placement.row);
        if (pending.origin.kind === "equipment") onUnequip(characterId, pending.origin.slot);
      }
      const settled = { ...visual, rect: destination.rect, settling: true };
      activeDragRef.current = settled;
      setDragVisual(settled);
      playUISound("gearMove");
      clearDragAfterAnimation();
    },
    [characterId, updateActiveDrag, onEquip, onUnequip, onMoveItem, clearDragAfterAnimation, maybeLaunchSwapAnimation],
  );

  const animateGearTransfer = useCallback(
    (
      instance: GearInstance,
      origin: GearDragOrigin,
      source: DragRect,
      destination: DragDestination,
      commit: () => void,
    ) => {
      const visual = { instance, source, rect: destination.rect, origin, destination, flyover: true };
      activeDragRef.current = visual;
      setDraggedGear(instance);
      setDragVisual(visual);
      playUISound("gearMove");
      pendingFlyoverCommitRef.current = commit;
      clearDragAfterAnimation(DOUBLE_CLICK_FLYOVER_MS);
    },
    [clearDragAfterAnimation],
  );

  const handleGearDoubleClick = useCallback(
    (instance: GearInstance, origin: GearDragOrigin, source: DragRect) => {
      if (!editable) return;
      const definition = gearDefinitions[instance.definitionId];
      if (!definition) return;

      if (origin.kind === "inventory") {
        const compatibleSlots = definition.compatibleSlots;
        const slot = compatibleSlots.find((candidate) => !loadout[candidate]) ?? compatibleSlots[0];
        if (!slot) return;
        const slotElement = document.querySelector<HTMLElement>(
          `[data-testid='armory-equipment-slot'][data-slot='${slot}']`,
        );
        if (!slotElement) return;
        const slotRect = slotElement.getBoundingClientRect();
        animateGearTransfer(instance, origin, source, { kind: "equipment", slot, rect: slotRect }, () => {
          maybeLaunchSwapAnimation(instance, slot, slotRect, origin.placement);
          onEquip(characterId, slot, instance, {
            vacatedPlacement: origin.placement,
          });
        });
        return;
      }

      const board = inventoryBoardRef.current;
      if (!board) return;
      const metrics = readInventoryBoardMetrics(board);
      const footprint = footprintForInstance(instance);
      if (!metrics || !footprint) return;
      const { cellSize, gap, boardRect, scrollTop } = metrics;
      const preferred = boardPositions[instance.instanceId] ?? equippedReturnPositions[instance.instanceId];
      const placement = resolveInventoryReturnPlacement(
        boardObstacles,
        instance.instanceId,
        footprint,
        preferred,
        INVENTORY_COLS,
      );
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
      animateGearTransfer(instance, origin, source, destination, () => {
        onMoveItem(instance.instanceId, destination.placement.col, destination.placement.row);
        onUnequip(characterId, origin.slot);
      });
    },
    [
      editable,
      characterId,
      loadout,
      packedInventory.items,
      boardObstacles,
      inventoryBoardRef,
      animateGearTransfer,
      onEquip,
      onUnequip,
      onMoveItem,
      maybeLaunchSwapAnimation,
      boardPositions,
      equippedReturnPositions,
    ],
  );

  return {
    draggedGear,
    dragVisual,
    secondaryDragVisual,
    isAnimating,
    isDraggingActive,
    beginGearPointer,
    moveGearPointer,
    finishGearPointer,
    handleGearDoubleClick,
    clearDragState,
    clearSecondaryDragState,
    abortActiveDrag,
    abortGearDragIfDragging,
  };
}
