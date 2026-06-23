import { memo, useEffect, useRef, useState, type FocusEvent } from "react";
import { gearDefinitions, type GearDefinition, type GearInstance, type GearLoadout, type GearSlot } from "@/lib/gear";
import { gearSlotBackgroundArt } from "@/lib/game-data";
import { canApplyCraftingCurrency, isGearCompatibleWithLoadoutSlot, type CraftingCurrencyId } from "@/lib/gear";
import { playUISound } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { GearTooltipPortal } from "../gear-tooltip-portal";
import { SLOT_LABELS } from "./grid-styles";
import {
  SALVAGE_TARGET_RING,
  SALVAGE_TARGET_SHADOW,
  VALID_TARGET_RING,
  VALID_TARGET_SHADOW,
} from "../targeting-highlight";
import type { GearDragOrigin, GearPointerEnd, GearPointerMove, GearPointerStart } from "../use-armory-gear-drag";

function dismissWhenFocusLeaves(event: FocusEvent<HTMLDivElement>, dismiss: () => void) {
  if (!event.currentTarget.contains(event.relatedTarget)) dismiss();
}

function isSlotCompatible(
  draggedGear: GearInstance | null | undefined,
  isDraggingActive: boolean,
  slot: GearSlot,
  loadout: GearLoadout,
  inventory: GearInstance[],
): boolean {
  if (!isDraggingActive || !draggedGear) return false;
  const def = gearDefinitions[draggedGear.definitionId];
  return def ? isGearCompatibleWithLoadoutSlot(def, slot, loadout, inventory) : false;
}

function GearSlotArt({
  definition,
  slot,
  isHidden,
}: {
  definition: GearDefinition | undefined;
  slot: GearSlot;
  isHidden: boolean;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl">
      <img
        src={gearSlotBackgroundArt[slot]}
        alt=""
        data-testid="armory-slot-background"
        className="absolute inset-0 h-full w-full object-cover brightness-[0.65]"
      />
      {definition?.art ? (
        <img
          src={definition.art}
          alt=""
          className={cn(
            "absolute -inset-px z-10 h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover image-rendering-pixelated",
            isHidden && "opacity-0",
          )}
        />
      ) : null}
    </div>
  );
}

function CompatibilityOverlay({
  show,
  isCompatible,
  craftRing,
  salvageRing,
}: {
  show: boolean;
  isCompatible: boolean;
  craftRing: string[] | false;
  salvageRing: string[] | false;
}) {
  if (!show) return null;
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 pointer-events-none rounded-xl transition-[box-shadow] duration-150",
        isCompatible && VALID_TARGET_SHADOW,
        craftRing,
        salvageRing,
      )}
    />
  );
}

interface SlotHandlerContext {
  slot: GearSlot;
  instance: GearInstance | undefined;
  editable: boolean;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  isDraggingActive: boolean;
  setShowTooltip: (v: boolean) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onGearPointerStart: GearPointerStart;
  onGearPointerMove: GearPointerMove;
  onGearPointerEnd: GearPointerEnd;
  onGearDoubleClick: (instance: GearInstance, origin: GearDragOrigin, rect: DOMRect) => void;
  onSalvage: () => void;
  onApplyCurrency: () => void;
  onTransferRequest?: ((instance: GearInstance, anchor: { x: number; y: number }) => void) | undefined;
}

function buildSlotHandlers(ctx: SlotHandlerContext) {
  const {
    slot,
    instance,
    editable,
    salvageMode,
    activeCurrencyId,
    isDraggingActive,
    setShowTooltip,
    onGearPointerStart,
    onGearPointerMove,
    onGearPointerEnd,
    onGearDoubleClick,
    onSalvage,
    onApplyCurrency,
    onTransferRequest,
  } = ctx;
  const handleMouseEnter = () => {
    if (instance) playUISound("buttonHover");
    setShowTooltip(true);
  };
  const handleMouseLeave = () => setShowTooltip(false);
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => dismissWhenFocusLeaves(event, handleMouseLeave);
  const pointerActive = editable && instance && !salvageMode && !activeCurrencyId && !isDraggingActive;
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerActive || event.button !== 0) return;
    event.stopPropagation();
    setShowTooltip(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    onGearPointerStart(
      instance!,
      { kind: "equipment", slot },
      event.currentTarget.getBoundingClientRect(),
      { x: event.clientX, y: event.clientY },
      event.pointerId,
    );
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    onGearPointerMove({ x: event.clientX, y: event.clientY }, event.pointerId);
  };
  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>, cancelled?: boolean) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.stopPropagation();
    event.currentTarget.releasePointerCapture(event.pointerId);
    onGearPointerEnd({ x: event.clientX, y: event.clientY }, event.pointerId, cancelled);
  };
  const canInteract = editable && instance && !salvageMode && !activeCurrencyId && !isDraggingActive;
  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!canInteract) return;
    onGearDoubleClick(instance!, { kind: "equipment", slot }, event.currentTarget.getBoundingClientRect());
  };
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!editable || !instance) return;
    if (salvageMode) {
      event.stopPropagation();
      onSalvage();
    } else if (activeCurrencyId) {
      event.stopPropagation();
      onApplyCurrency();
    }
  };
  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!editable || !instance || salvageMode || activeCurrencyId) return;
    event.preventDefault();
    onTransferRequest?.(instance, { x: event.clientX, y: event.clientY });
  };
  return {
    handleMouseEnter,
    handleMouseLeave,
    handleBlur,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handleDoubleClick,
    handleClick,
    handleContextMenu,
  };
}

export const SlotButton = memo(function SlotButton({
  slot,
  instance,
  loadout,
  inventory,
  editable,
  draggedGear,
  secondaryDragInstanceIds = [],
  isDraggingActive,
  salvageMode,
  activeCurrencyId,
  onGearPointerStart,
  onGearPointerMove,
  onGearPointerEnd,
  onGearDoubleClick,
  onSalvage,
  onApplyCurrency,
  onAbortGearDrag,
  onTransferRequest,
}: {
  slot: GearSlot;
  instance: GearInstance | undefined;
  loadout: GearLoadout;
  inventory: GearInstance[];
  editable: boolean;
  draggedGear: GearInstance | null | undefined;
  secondaryDragInstanceIds?: string[];
  isDraggingActive: boolean;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  onGearPointerStart: GearPointerStart;
  onGearPointerMove: GearPointerMove;
  onGearPointerEnd: GearPointerEnd;
  onGearDoubleClick: (instance: GearInstance, origin: GearDragOrigin, rect: DOMRect) => void;
  onSalvage: () => void;
  onApplyCurrency: () => void;
  onAbortGearDrag: (instanceId: string) => void;
  onTransferRequest?: ((instance: GearInstance, anchor: { x: number; y: number }) => void) | undefined;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const definition = instance ? gearDefinitions[instance.definitionId] : undefined;

  useEffect(() => {
    if (!instance) return;
    const instanceId = instance.instanceId;
    return () => onAbortGearDrag(instanceId);
  }, [instance, onAbortGearDrag]);

  const isCompatible = isSlotCompatible(draggedGear, isDraggingActive, slot, loadout, inventory);
  const canCraft = activeCurrencyId && instance ? canApplyCraftingCurrency(activeCurrencyId, instance) : false;
  const targetingMode = salvageMode || activeCurrencyId;
  const cursorClass = targetingMode ? "cursor-default" : "cursor-grab active:cursor-grabbing";

  const slotHandlers = buildSlotHandlers({
    slot,
    instance,
    editable,
    salvageMode,
    activeCurrencyId,
    isDraggingActive,
    setShowTooltip,
    containerRef,
    onGearPointerStart,
    onGearPointerMove,
    onGearPointerEnd,
    onGearDoubleClick,
    onSalvage,
    onApplyCurrency,
    onTransferRequest,
  });

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full overflow-hidden rounded-xl transition-[box-shadow] duration-150",
        cursorClass,
      )}
      aria-label={`${SLOT_LABELS[slot]} equipment slot`}
      data-instance-id={instance?.instanceId}
      data-salvageable={salvageMode && instance ? "true" : undefined}
      onMouseEnter={slotHandlers.handleMouseEnter}
      onMouseLeave={slotHandlers.handleMouseLeave}
      onFocus={slotHandlers.handleMouseEnter}
      onBlur={slotHandlers.handleBlur}
      onPointerDown={slotHandlers.handlePointerDown}
      onPointerMove={slotHandlers.handlePointerMove}
      onPointerUp={(e) => slotHandlers.handlePointerEnd(e)}
      onPointerCancel={(e) => slotHandlers.handlePointerEnd(e, true)}
      onDoubleClick={slotHandlers.handleDoubleClick}
      onClick={slotHandlers.handleClick}
      onContextMenu={slotHandlers.handleContextMenu}
      data-testid="armory-equipment-slot"
      data-slot={slot}
    >
      <GearSlotArt
        definition={definition}
        slot={slot}
        isHidden={
          instance !== undefined &&
          (draggedGear?.instanceId === instance.instanceId || secondaryDragInstanceIds.includes(instance.instanceId))
        }
      />
      <CompatibilityOverlay
        show={isCompatible || !!(targetingMode && instance)}
        isCompatible={isCompatible}
        salvageRing={salvageMode && instance ? [SALVAGE_TARGET_RING, SALVAGE_TARGET_SHADOW] : false}
        craftRing={activeCurrencyId && instance && canCraft ? [VALID_TARGET_RING, VALID_TARGET_SHADOW] : false}
      />
      {definition ? (
        <GearTooltipPortal
          triggerRef={containerRef}
          visible={showTooltip && !isDraggingActive}
          definition={definition}
          {...(instance ? { instance } : {})}
        />
      ) : null}
    </div>
  );
});
