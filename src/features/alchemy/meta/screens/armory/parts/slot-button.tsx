import { memo, useEffect, useRef, useState } from "react";
import {
  gearDefinitions,
  gearInstanceRarity,
  getGearInstanceShineColors,
  type GearInstance,
  type GearLoadout,
  type GearSlot,
} from "@/lib/gear";
import { canApplyCraftingCurrency, type CraftingCurrencyId } from "@/lib/gear";
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

import { buildSlotHandlers, isSlotCompatible, SlotContent } from "./slot-button-helpers";

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
  const isAstral = instance ? gearInstanceRarity(instance) === "astral" : false;
  const shineColors = instance ? getGearInstanceShineColors(instance) : [];

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
    onGearPointerStart,
    onGearPointerMove,
    onGearPointerEnd,
    onGearDoubleClick,
    onSalvage,
    onApplyCurrency,
    onTransferRequest,
  });

  const hideGearArt =
    instance !== undefined &&
    (draggedGear?.instanceId === instance.instanceId || secondaryDragInstanceIds.includes(instance.instanceId));
  const showCompatibility = !!(targetingMode && instance);
  const salvageRing = salvageMode && instance ? [SALVAGE_TARGET_RING, SALVAGE_TARGET_SHADOW] : false;
  const craftRing = activeCurrencyId && instance && canCraft ? [VALID_TARGET_RING, VALID_TARGET_SHADOW] : false;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full overflow-hidden rounded-xl transition-[box-shadow] duration-150",
        cursorClass,
        instance && !isAstral && "border border-stone-500/40",
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
      <SlotContent
        definition={definition}
        slot={slot}
        hideGearArt={hideGearArt}
        isCompatible={isCompatible}
        showCompatibility={showCompatibility}
        salvageRing={salvageRing}
        craftRing={craftRing}
        shineColors={shineColors}
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
