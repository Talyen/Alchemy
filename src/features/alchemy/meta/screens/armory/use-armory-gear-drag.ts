import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { playUISound } from "@/lib/audio";
import type { CharacterId } from "@/lib/game-data";
import {
  footprintForInstance,
  gearDefinitions,
  type CraftingCurrencyId,
  type GearInstance,
  type GearLoadout,
  type GearSlot,
  type InventoryPlacement,
  type PackedInventory,
  type PackedInventoryItem,
} from "@/lib/gear";
import { overlaps } from "@/lib/gear/grid-packing";
import { useBoardDrag, type DragDestination, type DragRect, type DragPoint } from "./use-board-drag";
import {
  findEquipSlotForDoubleClickedGear,
  resolveEquipmentSlotAtPointer,
  getInventoryDragDestination,
  calculateSecondaryDisplacedItems,
  buildSecondaryDragVisuals,
} from "./armory-drag-helpers";
import { placeInventoryTileFromMetrics } from "./board-drag-math";

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

import { DOUBLE_CLICK_FLYOVER_CLEAR_DELAY_MS, EQUIPMENT_SNAP_INSET_RATIO } from "./drag-constants";

export type GearDragVisual = {
  instance: GearInstance | null;
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
  onMoveCurrency?: (currencyId: CraftingCurrencyId, col: number, row: number) => void;
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
  onMoveCurrency,
}: UseArmoryGearDragOptions) {
  const activeIdRef = useRef<string | null>(null);
  const packedInventoryRef = useRef(packedInventory);
  useEffect(() => {
    packedInventoryRef.current = packedInventory;
  }, [packedInventory]);

  const [secondaryDragVisuals, setSecondaryDragVisuals] = useState<GearDragVisual[]>([]);
  const secondaryCleanupTimerRef = useRef<number | null>(null);
  const [carriedInstance, setCarriedInstance] = useState<GearInstance | null>(null);
  const [carriedVisual, setCarriedVisual] = useState<DragRect | null>(null);
  const carryCleanupRef = useRef<(() => void) | null>(null);
  const startCarryRef = useRef<((instance: GearInstance, sourceRect: DragRect) => void) | null>(null);
  const fsmClearDragRef = useRef<() => void>(() => {});

  const [carriedCurrencyId, setCarriedCurrencyId] = useState<CraftingCurrencyId | null>(null);
  const [carriedCurrencyVisual, setCarriedCurrencyVisual] = useState<DragRect | null>(null);
  const carryCurrencyCleanupRef = useRef<(() => void) | null>(null);
  const startCarryCurrencyRef = useRef<((currencyId: CraftingCurrencyId, sourceRect: DragRect) => void) | null>(null);

  const clearCarryCurrency = useCallback(() => {
    carryCurrencyCleanupRef.current?.();
    carryCurrencyCleanupRef.current = null;
    setCarriedCurrencyId(null);
    setCarriedCurrencyVisual(null);
  }, []);

  const clearCarry = useCallback(() => {
    carryCleanupRef.current?.();
    carryCleanupRef.current = null;
    setCarriedInstance(null);
    setCarriedVisual(null);
  }, []);

  const autoPlaceCarried = useCallback(
    (instance: GearInstance) => {
      onMoveItem(instance.instanceId, 1, 1);
    },
    [onMoveItem],
  );

  const startCarry = useCallback(
    (instance: GearInstance, sourceRect: DragRect) => {
      fsmClearDragRef.current();
      carryCleanupRef.current?.();
      setCarriedInstance(instance);

      const element = document.querySelector(`[data-instance-id="${instance.instanceId}"]`);
      const rect = element?.getBoundingClientRect();
      const actualRect = rect
        ? {
            left: sourceRect.left,
            top: sourceRect.top,
            width: rect.width,
            height: rect.height,
          }
        : sourceRect;

      setCarriedVisual(actualRect);

      const footprint = footprintForInstance(instance);
      if (!footprint) {
        clearCarry();
        return;
      }

      const onPointerMove = (e: PointerEvent) => {
        setCarriedVisual({
          left: e.clientX - actualRect.width / 2,
          top: e.clientY - actualRect.height / 2,
          width: actualRect.width,
          height: actualRect.height,
        });
      };

      const onPointerDown = (e: PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();

        const board = inventoryBoardRef.current;
        if (!board) {
          autoPlaceCarried(instance);
          clearCarry();
          return;
        }

        const freeRect: DragRect = {
          left: e.clientX - sourceRect.width / 2,
          top: e.clientY - sourceRect.height / 2,
          width: sourceRect.width,
          height: sourceRect.height,
        };

        const result = placeInventoryTileFromMetrics(board, footprint, freeRect, null, {
          requireProximity: false,
          occupiedRows: packedInventoryRef.current.occupiedRows,
        });

        if (!result) {
          autoPlaceCarried(instance);
          clearCarry();
          return;
        }

        const currentPacked = packedInventoryRef.current.items;
        const occupant = currentPacked.find(
          (item) =>
            item.item.instanceId !== instance.instanceId &&
            overlaps(
              { col: result.placement.col, row: result.placement.row, w: footprint.w, h: footprint.h },
              { col: item.col, row: item.row, w: item.w, h: item.h },
            ),
        );

        if (occupant) {
          const occupantInstance = inventoryById.get(occupant.item.instanceId);
          onMoveItem(instance.instanceId, result.placement.col, result.placement.row);
          if (occupantInstance) {
            startCarryRef.current?.(occupantInstance, freeRect);
          } else {
            clearCarry();
          }
        } else {
          onMoveItem(instance.instanceId, result.placement.col, result.placement.row);
          clearCarry();
        }
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          autoPlaceCarried(instance);
          clearCarry();
        }
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerdown", onPointerDown, { capture: true });
      document.addEventListener("keydown", onKeyDown);

      carryCleanupRef.current = () => {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerdown", onPointerDown, { capture: true });
        document.removeEventListener("keydown", onKeyDown);
      };
    },
    [autoPlaceCarried, clearCarry, inventoryBoardRef, inventoryById, onMoveItem],
  );

  useEffect(() => {
    startCarryRef.current = startCarry;
  }, [startCarry]);

  const startCarryCurrency = useCallback(
    (currencyId: CraftingCurrencyId, sourceRect: DragRect) => {
      fsmClearDragRef.current();
      carryCurrencyCleanupRef.current?.();
      setCarriedCurrencyId(currencyId);
      setCarriedCurrencyVisual(sourceRect);

      const onPointerMove = (e: PointerEvent) => {
        setCarriedCurrencyVisual({
          left: e.clientX - sourceRect.width / 2,
          top: e.clientY - sourceRect.height / 2,
          width: sourceRect.width,
          height: sourceRect.height,
        });
      };

      const onPointerDown = (e: PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();

        const board = inventoryBoardRef.current;
        if (!board) {
          if (onMoveCurrency) onMoveCurrency(currencyId, 1, 1);
          clearCarryCurrency();
          return;
        }

        const freeRect: DragRect = {
          left: e.clientX - sourceRect.width / 2,
          top: e.clientY - sourceRect.height / 2,
          width: sourceRect.width,
          height: sourceRect.height,
        };

        const result = placeInventoryTileFromMetrics(board, { w: 1, h: 1 }, freeRect, null, {
          requireProximity: false,
          occupiedRows: packedInventoryRef.current.occupiedRows,
        });

        if (!result) {
          if (onMoveCurrency) onMoveCurrency(currencyId, 1, 1);
          clearCarryCurrency();
          return;
        }

        const currentPacked = packedInventoryRef.current.items;
        const occupant = currentPacked.find((item) =>
          overlaps(
            { col: result.placement.col, row: result.placement.row, w: 1, h: 1 },
            { col: item.col, row: item.row, w: item.w, h: item.h },
          ),
        );

        if (occupant) {
          const occupantInstance = inventoryById.get(occupant.item.instanceId);
          if (onMoveCurrency) onMoveCurrency(currencyId, result.placement.col, result.placement.row);
          if (occupantInstance) {
            startCarryRef.current?.(occupantInstance, freeRect);
          }
          clearCarryCurrency();
        } else {
          if (onMoveCurrency) onMoveCurrency(currencyId, result.placement.col, result.placement.row);
          clearCarryCurrency();
        }
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          if (onMoveCurrency) onMoveCurrency(currencyId, 1, 1);
          clearCarryCurrency();
        }
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerdown", onPointerDown, { capture: true });
      document.addEventListener("keydown", onKeyDown);

      carryCurrencyCleanupRef.current = () => {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerdown", onPointerDown, { capture: true });
        document.removeEventListener("keydown", onKeyDown);
      };
    },
    [clearCarryCurrency, inventoryBoardRef, inventoryById, onMoveCurrency],
  );

  useEffect(() => {
    startCarryCurrencyRef.current = startCarryCurrency;
  }, [startCarryCurrency]);

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
      if (destination.kind === "equipment") {
        const slot = destination.slot as GearSlot;
        const vacatedPlacement = origin.kind === "inventory" ? origin.placement : undefined;
        if (vacatedPlacement) {
          maybeLaunchSwapAnimations(instance, slot, destination.rect, vacatedPlacement);
        }
        onEquip(characterId, slot, instance, vacatedPlacement ? { vacatedPlacement } : undefined);
      } else if (destination.kind === "inventory") {
        if (origin.kind === "equipment") {
          onUnequip(characterId, origin.slot);
          onMoveItem(id, destination.placement.col, destination.placement.row);
          return;
        }
        const unchanged =
          origin.placement.col === destination.placement.col && origin.placement.row === destination.placement.row;
        if (unchanged) return;
        const footprint = footprintForInstance(instance);
        const packed = packedInventoryRef.current.items;
        const occupant = footprint
          ? packed.find(
              (item) =>
                item.item.instanceId !== id &&
                overlaps(
                  { col: destination.placement.col, row: destination.placement.row, w: footprint.w, h: footprint.h },
                  { col: item.col, row: item.row, w: item.w, h: item.h },
                ),
            )
          : undefined;
        onMoveItem(id, destination.placement.col, destination.placement.row);
        if (occupant) {
          const occupantInstance = inventoryById.get(occupant.item.instanceId);
          if (occupantInstance) {
            startCarry(occupantInstance, destination.rect);
          }
        }
      }
    },
    onCancel: () => {},
    onClear: () => {},
  });
  useEffect(() => {
    fsmClearDragRef.current = fsm.clearDragState;
  }, [fsm.clearDragState]);

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
        const slot = findEquipSlotForDoubleClickedGear(loadout, definition);
        if (!slot) {
          playUISound("error");
          return;
        }
        const slotElement = document.querySelector<HTMLElement>(
          `[data-testid='armory-equipment-slot'][data-slot='${slot}']`,
        );
        if (!slotElement) return;
        const slotRect = slotElement.getBoundingClientRect();
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
      const destination = getInventoryDragDestination({ board, instance, boardObstacles });
      if (!destination) return;
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
    ],
  );

  const draggedGear: GearInstance | null = carriedInstance
    ? carriedInstance
    : fsm.dragVisual?.id
      ? (inventoryById.get(fsm.dragVisual.id) ?? null)
      : null;

  const dragVisual: GearDragVisual | null =
    // Precedence: carried visual over FSM settled visual.
    // This ordering is load-bearing for the issue 5 fix: when startCarry clears the
    // FSM settled visual, the carried visual is the only active visual.
    // If you reverse this precedence, the settled FSM visual would flash briefly.
    carriedVisual && carriedInstance
      ? {
          instance: carriedInstance,
          source: carriedVisual,
          rect: carriedVisual,
          origin: { kind: "inventory", placement: { col: 1, row: 1 } },
          destination: null,
        }
      : fsm.dragVisual
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

  const fsmClearDragState = fsm.clearDragState;
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
    carriedInstance,
    carriedVisual,
    secondaryDragVisuals,
    isAnimating: fsm.isAnimating || secondaryDragVisuals.some((v) => v.flyover) || !!carriedInstance,
    isDraggingActive: fsm.isDraggingActive || !!carriedInstance,
    beginGearPointer,
    moveGearPointer,
    finishGearPointer,
    handleGearDoubleClick,
    clearDragState,
    clearSecondaryDragState,
    abortGearDragIfDragging,
    clearCarry,
    startCarry,
    carriedCurrencyId,
    carriedCurrencyVisual,
    startCarryCurrency,
    clearCarryCurrency,
  };
}
