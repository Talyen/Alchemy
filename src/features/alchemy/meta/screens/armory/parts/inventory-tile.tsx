import { memo, useCallback, useRef, useState } from "react";
import {
  canApplyCraftingCurrency,
  canSalvageGear,
  gearDefinitions,
  gearInstanceRarity,
  getCraftingCurrencyDefinition,
  getGearInstanceShineColors,
  getGearInstanceTitle,
  type CraftingCurrencyId,
  type GearInstance,
} from "@/lib/gear";
import { playUISound } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { GearTooltipPortal } from "../gear-tooltip-portal";
import { packedItemStyle } from "./grid-styles";
import type { GearDragOrigin, GearPointerEnd, GearPointerMove, GearPointerStart } from "../use-armory-gear-drag";

import { buildTileHandlers, TileContent, useDragEndFeedback } from "./inventory-tile-helpers";

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
  const [flash, setFlash] = useState(false);
  useDragEndFeedback(
    instance,
    hasActiveDrag,
    dragSequence,
    shouldSuppressClick,
    tileRef,
    onAbortGearDrag,
    setFlash,
    setTooltipSequence,
  );

  const openTooltip = useCallback(() => setTooltipSequence(dragSequence), [dragSequence]);
  const closeTooltip = useCallback(() => setTooltipSequence(null), []);
  const canSalvage = canSalvageGear(inventory, instance.instanceId);
  const canCraft = activeCurrencyId ? canApplyCraftingCurrency(activeCurrencyId, instance) : false;
  const targetingMode = salvageMode || !!activeCurrencyId;
  const isSalvageTarget = salvageMode && canSalvage;
  const hideTile = dragging || secondaryDragging;
  const isAstral = gearInstanceRarity(instance) === "astral";
  const shineColors = getGearInstanceShineColors(instance);
  const h = buildTileHandlers({
    editable,
    salvageMode,
    activeCurrencyId,
    interactionSuppressed,
    targetingMode,
    isSalvageTarget,
    closeTooltip,
    placement,
    instance,
    onSalvage,
    onApplyCurrency,
    onGearPointerStart,
    onGearPointerMove,
    onGearPointerEnd,
    onGearDoubleClick,
    onTransferRequest,
  });

  if (!definition) return null;

  return (
    <div
      ref={tileRef}
      className={cn(
        "armory-salvage-tile absolute z-10 min-h-0 min-w-0 overflow-hidden rounded-xl",
        targetingMode ? "cursor-default" : "cursor-grab bg-background/60 active:cursor-grabbing",
        hideTile && "opacity-0",
        !isAstral && "border border-stone-500/40",
      )}
      style={packedItemStyle(placement)}
      role={editable && (isSalvageTarget || !!activeCurrencyId) ? "button" : undefined}
      tabIndex={editable && (isSalvageTarget || !!activeCurrencyId) ? 0 : undefined}
      data-salvageable={isSalvageTarget ? "true" : undefined}
      aria-label={
        isSalvageTarget
          ? `Salvage ${getGearInstanceTitle(instance)}`
          : activeCurrencyId
            ? `Apply ${getCraftingCurrencyDefinition(activeCurrencyId).displayName} to ${getGearInstanceTitle(instance)}`
            : undefined
      }
      onClick={h.onClick}
      onKeyDown={h.onKeyDown}
      onPointerDown={h.onPointerDown}
      onPointerMove={h.onPointerMove}
      onPointerUp={(e) => h.releasePointer(e)}
      onPointerCancel={(e) => h.releasePointer(e, true)}
      onDoubleClick={h.onDoubleClick}
      onContextMenu={h.onContextMenu}
      onMouseEnter={() => {
        if (!shouldSuppressClick()) {
          playUISound("buttonHover");
          openTooltip();
        }
      }}
      onMouseLeave={closeTooltip}
      onFocus={() => {
        if (!salvageMode && !shouldSuppressClick()) openTooltip();
      }}
      onBlur={closeTooltip}
      data-testid="armory-inventory-item"
      data-instance-id={instance.instanceId}
      data-gear-title={getGearInstanceTitle(instance)}
    >
      <TileContent
        art={definition.art}
        targetingMode={targetingMode}
        isSalvageTarget={isSalvageTarget}
        canCraft={canCraft}
        activeCurrencyId={activeCurrencyId}
        shineColors={shineColors}
        flash={flash}
      />
      <GearTooltipPortal triggerRef={tileRef} visible={showTooltip} definition={definition} instance={instance} />
    </div>
  );
});
