import { memo, useCallback, useEffect, useRef, useState } from "react";
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
import { ShineBorder } from "@/components/ui/shine-border";
import { playUISound } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { GearTooltipPortal } from "../gear-tooltip-portal";
import { packedItemStyle } from "./grid-styles";
import {
  SALVAGE_TARGET_RING,
  SALVAGE_TARGET_SHADOW,
  VALID_TARGET_RING,
  VALID_TARGET_SHADOW,
} from "../targeting-highlight";
import type { GearDragOrigin, GearPointerEnd, GearPointerMove, GearPointerStart } from "../use-armory-gear-drag";

function TargetingOverlay({
  visible,
  salvageRing,
  craftRing,
}: {
  visible: boolean;
  salvageRing: boolean;
  craftRing: boolean;
}) {
  if (!visible) return null;
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 pointer-events-none rounded-xl transition-[box-shadow] duration-150",
        salvageRing && [SALVAGE_TARGET_RING, SALVAGE_TARGET_SHADOW],
        craftRing && [VALID_TARGET_RING, VALID_TARGET_SHADOW],
      )}
    />
  );
}

interface TileHandlerCtx {
  editable: boolean;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  interactionSuppressed: boolean;
  targetingMode: boolean;
  isSalvageTarget: boolean;
  closeTooltip: () => void;
  placement: { col: number; row: number; h: number; w: number };
  instance: GearInstance;
  onSalvage: () => void;
  onApplyCurrency: () => void;
  onGearPointerStart: GearPointerStart;
  onGearPointerMove: GearPointerMove;
  onGearPointerEnd: GearPointerEnd;
  onGearDoubleClick: (instance: GearInstance, origin: GearDragOrigin, rect: DOMRect) => void;
  onTransferRequest?: ((instance: GearInstance, anchor: { x: number; y: number }) => void) | undefined;
}

function buildTileHandlers(ctx: TileHandlerCtx) {
  const pointerGuard = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!ctx.editable || ctx.targetingMode || event.button !== 0 || ctx.interactionSuppressed) return false;
    return true;
  };
  return {
    onClick: (event: React.MouseEvent) => {
      if (!ctx.editable) return;
      if (ctx.isSalvageTarget) {
        event.stopPropagation();
        ctx.onSalvage();
      } else if (ctx.activeCurrencyId) {
        event.stopPropagation();
        ctx.onApplyCurrency();
      }
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      if (!ctx.editable || (event.key !== "Enter" && event.key !== " ")) return;
      if (ctx.isSalvageTarget) {
        event.preventDefault();
        ctx.onSalvage();
      } else if (ctx.activeCurrencyId) {
        event.preventDefault();
        ctx.onApplyCurrency();
      }
    },
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      if (!pointerGuard(event)) return;
      event.stopPropagation();
      ctx.closeTooltip();
      event.currentTarget.setPointerCapture(event.pointerId);
      ctx.onGearPointerStart(
        ctx.instance,
        { kind: "inventory", placement: { col: ctx.placement.col, row: ctx.placement.row } },
        event.currentTarget.getBoundingClientRect(),
        { x: event.clientX, y: event.clientY },
        event.pointerId,
      );
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      ctx.onGearPointerMove({ x: event.clientX, y: event.clientY }, event.pointerId);
    },
    releasePointer: (event: React.PointerEvent<HTMLDivElement>, cancelled?: boolean) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      event.stopPropagation();
      event.currentTarget.releasePointerCapture(event.pointerId);
      ctx.onGearPointerEnd({ x: event.clientX, y: event.clientY }, event.pointerId, cancelled);
    },
    onDoubleClick: (event: React.MouseEvent) => {
      if (!ctx.editable || ctx.targetingMode || ctx.interactionSuppressed) return;
      ctx.onGearDoubleClick(
        ctx.instance,
        { kind: "inventory", placement: { col: ctx.placement.col, row: ctx.placement.row } },
        (event.currentTarget as HTMLElement).getBoundingClientRect(),
      );
    },
    onContextMenu: (event: React.MouseEvent) => {
      if (!ctx.editable || ctx.targetingMode || ctx.interactionSuppressed) return;
      event.preventDefault();
      ctx.onTransferRequest?.(ctx.instance, { x: event.clientX, y: event.clientY });
    },
  };
}

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
  const [dragCooldown, setDragCooldown] = useState(false);
  const prevAffixesRef = useRef(instance.affixes);
  const prevDefRef = useRef(instance.definitionId);
  const prevDragActiveRef = useRef(hasActiveDrag);

  useEffect(() => {
    const id = instance.instanceId;
    return () => onAbortGearDrag(id);
  }, [instance.instanceId, onAbortGearDrag]);
  useEffect(() => {
    if (prevAffixesRef.current !== instance.affixes || prevDefRef.current !== instance.definitionId) {
      prevAffixesRef.current = instance.affixes;
      prevDefRef.current = instance.definitionId;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 550);
      return () => clearTimeout(t);
    }
    return;
  }, [instance]);
  useEffect(() => {
    const prev = prevDragActiveRef.current;
    prevDragActiveRef.current = hasActiveDrag;
    if (prev && !hasActiveDrag) {
      setDragCooldown(true);
      const t = setTimeout(() => setDragCooldown(false), 1000);
      return () => clearTimeout(t);
    }
    return;
  }, [hasActiveDrag]);
  useEffect(() => {
    if (!hasActiveDrag && !dragCooldown && tileRef.current?.matches(":hover") && !shouldSuppressClick())
      setTooltipSequence(dragSequence);
    else setTooltipSequence(null);
  }, [dragCooldown, hasActiveDrag, dragSequence, shouldSuppressClick]);

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
        targetingMode ? "cursor-default" : "cursor-grab active:cursor-grabbing bg-background/60",
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
      <img
        src={definition.art}
        alt=""
        className="absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover image-rendering-pixelated"
      />
      <TargetingOverlay
        visible={targetingMode}
        salvageRing={isSalvageTarget}
        craftRing={!!(activeCurrencyId && canCraft)}
      />
      {shineColors.length > 0 ? <ShineBorder shineColor={shineColors} borderWidth={1} /> : null}
      {flash ? <div className="absolute inset-0 pointer-events-none rounded-xl craft-flash-overlay z-30" /> : null}
      <GearTooltipPortal triggerRef={tileRef} visible={showTooltip} definition={definition} instance={instance} />
    </div>
  );
});
