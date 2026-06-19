import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  canApplyCraftingCurrency,
  canSalvageGear,
  gearDefinitions,
  getCraftingCurrencyDefinition,
  getGearInstanceTitle,
  type CraftingCurrencyId,
  type GearInstance,
} from "@/lib/gear";
import { playUISound } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { TooltipPanel } from "../../../../shared/ui/tooltip-panel";
import { GearTooltipContent, ARMORY_TOOLTIP_WIDTH } from "../gear-tooltip-content";
import { useArmoryPortaledTooltipPlacement } from "../armory-tooltip-placement";
import { packedItemStyle } from "./grid-styles";
import {
  SALVAGE_TARGET_RING,
  SALVAGE_TARGET_SHADOW,
  VALID_TARGET_RING,
  VALID_TARGET_SHADOW,
} from "../targeting-highlight";
import type { GearDragOrigin, GearPointerEnd, GearPointerMove, GearPointerStart } from "../use-armory-gear-drag";

export const InventoryGearTile = memo(function InventoryGearTile({
  instance,
  placement,
  inventory,
  editable,
  salvageMode,
  activeCurrencyId,
  dragging,
  secondaryDragging,
  interactionSuppressed,
  hasActiveDrag,
  dragSequence,
  shouldSuppressClick,
  onSalvage,
  onApplyCurrency,
  onGearPointerStart,
  onGearPointerMove,
  onGearPointerEnd,
  onGearDoubleClick,
  onAbortGearDrag,
  onTransferRequest,
}: {
  instance: GearInstance;
  placement: { col: number; row: number; w: number; h: number };
  inventory: GearInstance[];
  editable: boolean;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  dragging: boolean;
  secondaryDragging: boolean;
  interactionSuppressed: boolean;
  hasActiveDrag: boolean;
  dragSequence: number;
  shouldSuppressClick: () => boolean;
  onSalvage: () => void;
  onApplyCurrency: () => void;
  onGearPointerStart: GearPointerStart;
  onGearPointerMove: GearPointerMove;
  onGearPointerEnd: GearPointerEnd;
  onGearDoubleClick: (instance: GearInstance, origin: GearDragOrigin, rect: DOMRect) => void;
  onAbortGearDrag: (instanceId: string) => void;
  onTransferRequest?: ((instance: GearInstance, anchor: { x: number; y: number }) => void) | undefined;
}) {
  const [tooltipSequence, setTooltipSequence] = useState<number | null>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const definition = gearDefinitions[instance.definitionId];
  const showTooltip = tooltipSequence === dragSequence && !interactionSuppressed;

  useEffect(() => {
    const instanceId = instance.instanceId;
    return () => onAbortGearDrag(instanceId);
  }, [instance.instanceId, onAbortGearDrag]);

  const prevAffixesRef = useRef(instance.affixes);
  const prevDefRef = useRef(instance.definitionId);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prevAffixesRef.current !== instance.affixes || prevDefRef.current !== instance.definitionId) {
      prevAffixesRef.current = instance.affixes;
      prevDefRef.current = instance.definitionId;
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 550);
      return () => clearTimeout(timer);
    }
    return;
  }, [instance]);

  const prevDragActiveRef = useRef(hasActiveDrag);
  const [dragCooldown, setDragCooldown] = useState(false);

  useEffect(() => {
    const prev = prevDragActiveRef.current;
    prevDragActiveRef.current = hasActiveDrag;
    if (prev && !hasActiveDrag) {
      setDragCooldown(true);
      const timer = setTimeout(() => setDragCooldown(false), 1000);
      return () => clearTimeout(timer);
    }
    return;
  }, [hasActiveDrag]);

  const openTooltip = useCallback(() => {
    setTooltipSequence(dragSequence);
  }, [dragSequence]);

  const closeTooltip = useCallback(() => {
    setTooltipSequence(null);
  }, []);

  useEffect(() => {
    if (!hasActiveDrag && !dragCooldown && tileRef.current?.matches(":hover")) {
      if (!salvageMode && !shouldSuppressClick()) {
        openTooltip();
      }
    } else {
      closeTooltip();
    }
  }, [closeTooltip, dragCooldown, hasActiveDrag, openTooltip, salvageMode, shouldSuppressClick]);

  const { tooltipRef, placeBelow, tooltipStyle } = useArmoryPortaledTooltipPlacement(tileRef, showTooltip);

  const handleMouseEnter = () => {
    if (!salvageMode && !shouldSuppressClick()) {
      playUISound("buttonHover");
      openTooltip();
    }
  };

  const handleMouseLeave = () => {
    closeTooltip();
  };

  const handleFocus = () => {
    if (!salvageMode && !shouldSuppressClick()) openTooltip();
  };

  const handleBlur = () => {
    closeTooltip();
  };

  if (!definition) {
    return null;
  }

  const canSalvage = canSalvageGear(inventory, instance.instanceId);
  const canCraft = activeCurrencyId ? canApplyCraftingCurrency(activeCurrencyId, instance) : false;
  const targetingMode = salvageMode || activeCurrencyId;
  const isSalvageTarget = salvageMode && canSalvage;
  const isCurrencyTarget = !!activeCurrencyId;

  return (
    <div
      ref={tileRef}
      className={cn(
        "armory-salvage-tile absolute z-10 min-h-0 min-w-0 overflow-hidden rounded-xl",
        targetingMode ? "cursor-default" : "cursor-grab active:cursor-grabbing bg-background/60",
        dragging || secondaryDragging ? "opacity-0" : "",
      )}
      style={packedItemStyle(placement)}
      role={editable && (isSalvageTarget || isCurrencyTarget) ? "button" : undefined}
      tabIndex={editable && (isSalvageTarget || isCurrencyTarget) ? 0 : undefined}
      data-salvageable={isSalvageTarget ? "true" : undefined}
      aria-label={
        isSalvageTarget
          ? `Salvage ${getGearInstanceTitle(instance)}`
          : isCurrencyTarget
            ? `Apply ${getCraftingCurrencyDefinition(activeCurrencyId).displayName} to ${getGearInstanceTitle(instance)}`
            : undefined
      }
      onClick={(event) => {
        if (!editable) return;
        if (shouldSuppressClick()) return;
        if (isSalvageTarget) {
          event.stopPropagation();
          onSalvage();
        } else if (activeCurrencyId) {
          event.stopPropagation();
          onApplyCurrency();
        }
      }}
      onKeyDown={(event) => {
        if (!editable) return;
        if (event.key === "Enter" || event.key === " ") {
          if (isSalvageTarget) {
            event.preventDefault();
            onSalvage();
          } else if (activeCurrencyId) {
            event.preventDefault();
            onApplyCurrency();
          }
        }
      }}
      onPointerDown={(event) => {
        if (!editable || targetingMode || event.button !== 0 || interactionSuppressed) return;
        event.stopPropagation();
        closeTooltip();
        event.currentTarget.setPointerCapture(event.pointerId);
        onGearPointerStart(
          instance,
          { kind: "inventory", placement: { col: placement.col, row: placement.row } },
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
        if (!editable || targetingMode) return;
        onGearDoubleClick(
          instance,
          { kind: "inventory", placement: { col: placement.col, row: placement.row } },
          event.currentTarget.getBoundingClientRect(),
        );
      }}
      onContextMenu={(event) => {
        if (!editable || targetingMode || interactionSuppressed) return;
        event.preventDefault();
        onTransferRequest?.(instance, { x: event.clientX, y: event.clientY });
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      data-testid="armory-inventory-item"
      data-gear-title={getGearInstanceTitle(instance)}
    >
      <img
        src={definition.art}
        alt=""
        className="absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover"
      />
      {targetingMode && (
        <div
          className={cn(
            "absolute inset-0 z-20 pointer-events-none rounded-xl transition-[box-shadow] duration-150",
            isSalvageTarget && [SALVAGE_TARGET_RING, SALVAGE_TARGET_SHADOW],
            activeCurrencyId && canCraft && [VALID_TARGET_RING, VALID_TARGET_SHADOW],
          )}
        />
      )}
      {flash ? <div className="absolute inset-0 pointer-events-none rounded-xl craft-flash-overlay z-30" /> : null}
      {showTooltip
        ? createPortal(
            <TooltipPanel
              ref={tooltipRef}
              width={ARMORY_TOOLTIP_WIDTH}
              visible
              flip={placeBelow}
              className="armory-inventory-tooltip pointer-events-none fixed bottom-auto top-auto z-[100] mb-0 mt-0 !shadow-none"
              style={tooltipStyle}
            >
              <GearTooltipContent definition={definition} instance={instance} />
            </TooltipPanel>,
            document.body,
          )
        : null}
    </div>
  );
});
