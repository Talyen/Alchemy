import { memo, useEffect, useRef, useState, type FocusEvent } from "react";
import { createPortal } from "react-dom";
import { gearDefinitions, type GearInstance, type GearLoadout, type GearSlot } from "@/lib/gear";
import { gearSlotBackgroundArt } from "@/lib/game-data";
import { canApplyCraftingCurrency, isGearCompatibleWithLoadoutSlot, type CraftingCurrencyId } from "@/lib/gear";
import { playUISound } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { TooltipPanel } from "../../../../shared/ui/tooltip-panel";
import { GearTooltipContent, ARMORY_TOOLTIP_WIDTH } from "../gear-tooltip-content";
import { useArmoryPortaledTooltipPlacement } from "../armory-tooltip-placement";
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
  const { tooltipRef, placeBelow, tooltipStyle } = useArmoryPortaledTooltipPlacement(containerRef, showTooltip);
  const definition = instance ? gearDefinitions[instance.definitionId] : undefined;

  useEffect(() => {
    if (!instance) return;
    const instanceId = instance.instanceId;
    return () => onAbortGearDrag(instanceId);
  }, [instance, onAbortGearDrag]);

  useEffect(() => {
    if (!isDraggingActive && containerRef.current?.matches(":hover")) {
      if (instance) {
        setShowTooltip(true);
      }
    }
  }, [isDraggingActive, instance]);

  const isCompatible =
    isDraggingActive && draggedGear
      ? (() => {
          const draggedDefinition = gearDefinitions[draggedGear.definitionId];
          return draggedDefinition
            ? isGearCompatibleWithLoadoutSlot(draggedDefinition, slot, loadout, inventory)
            : false;
        })()
      : false;
  const canCraft = activeCurrencyId && instance ? canApplyCraftingCurrency(activeCurrencyId, instance) : false;
  const handleMouseEnter = () => {
    if (instance) playUISound("buttonHover");
    if (!salvageMode) setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  const targetingMode = salvageMode || activeCurrencyId;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full overflow-hidden rounded-xl transition-[box-shadow] duration-150",
        salvageMode || activeCurrencyId ? "cursor-default" : "cursor-grab active:cursor-grabbing",
      )}
      aria-label={`${SLOT_LABELS[slot]} equipment slot`}
      data-salvageable={salvageMode && instance ? "true" : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={(event) => dismissWhenFocusLeaves(event, handleMouseLeave)}
      onPointerDown={(event) => {
        if (!editable || !instance || salvageMode || activeCurrencyId || event.button !== 0 || isDraggingActive) return;
        event.stopPropagation();
        setShowTooltip(false);
        event.currentTarget.setPointerCapture(event.pointerId);
        onGearPointerStart(
          instance,
          { kind: "equipment", slot },
          event.currentTarget.getBoundingClientRect(),
          { x: event.clientX, y: event.clientY },
          event.pointerId,
        );
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.stopPropagation();
        onGearPointerMove({ x: event.clientX, y: event.clientY }, event.pointerId);
      }}
      onPointerUp={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.stopPropagation();
        event.currentTarget.releasePointerCapture(event.pointerId);
        onGearPointerEnd({ x: event.clientX, y: event.clientY }, event.pointerId);
      }}
      onPointerCancel={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.stopPropagation();
        event.currentTarget.releasePointerCapture(event.pointerId);
        onGearPointerEnd({ x: event.clientX, y: event.clientY }, event.pointerId, true);
      }}
      onDoubleClick={(event) => {
        if (editable && instance && !salvageMode && !activeCurrencyId)
          onGearDoubleClick(instance, { kind: "equipment", slot }, event.currentTarget.getBoundingClientRect());
      }}
      onClick={(event) => {
        if (!editable || !instance) return;
        if (salvageMode) {
          event.stopPropagation();
          onSalvage();
        } else if (activeCurrencyId) {
          event.stopPropagation();
          onApplyCurrency();
        }
      }}
      onContextMenu={(event) => {
        if (!editable || !instance || salvageMode || activeCurrencyId) return;
        event.preventDefault();
        onTransferRequest?.(instance, { x: event.clientX, y: event.clientY });
      }}
      data-testid="armory-equipment-slot"
      data-slot={slot}
    >
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
              "absolute -inset-px z-10 h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover",
              instance !== undefined &&
                (draggedGear?.instanceId === instance.instanceId ||
                  secondaryDragInstanceIds.includes(instance.instanceId)) &&
                "opacity-0",
            )}
          />
        ) : null}
      </div>
      {(isCompatible || (targetingMode && instance)) && (
        <div
          className={cn(
            "absolute inset-0 z-20 pointer-events-none rounded-xl transition-[box-shadow] duration-150",
            isCompatible && VALID_TARGET_SHADOW,
            activeCurrencyId && instance && canCraft && [VALID_TARGET_RING, VALID_TARGET_SHADOW],
            salvageMode && instance && [SALVAGE_TARGET_RING, SALVAGE_TARGET_SHADOW],
          )}
        />
      )}
      {showTooltip && definition && !isDraggingActive && !salvageMode
        ? createPortal(
            <TooltipPanel
              ref={tooltipRef}
              width={ARMORY_TOOLTIP_WIDTH}
              visible
              flip={placeBelow}
              className="armory-inventory-tooltip pointer-events-none fixed bottom-auto top-auto z-[100] mb-0 mt-0 !shadow-none"
              style={tooltipStyle}
            >
              <GearTooltipContent definition={definition} {...(instance ? { instance } : {})} />
            </TooltipPanel>,
            document.body,
          )
        : null}
    </div>
  );
});
