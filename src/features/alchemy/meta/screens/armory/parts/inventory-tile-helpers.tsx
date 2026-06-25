import { useEffect, useRef, useState } from "react";
import { type CraftingCurrencyId, type GearInstance } from "@/lib/gear";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
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

export function TileContent({
  art,
  targetingMode,
  isSalvageTarget,
  canCraft,
  activeCurrencyId,
  shineColors,
  flash,
}: {
  art: string;
  targetingMode: boolean;
  isSalvageTarget: boolean;
  canCraft: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  shineColors: readonly string[];
  flash: boolean;
}) {
  return (
    <>
      <img
        src={art}
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
    </>
  );
}

export function useDragEndFeedback(
  instance: GearInstance,
  hasActiveDrag: boolean,
  dragSequence: number,
  shouldSuppressClick: () => boolean,
  tileRef: React.RefObject<HTMLDivElement | null>,
  onAbortGearDrag: (instanceId: string) => void,
  setFlash: React.Dispatch<React.SetStateAction<boolean>>,
  setTooltipSequence: React.Dispatch<React.SetStateAction<number | null>>,
) {
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
  }, [instance, setFlash]);

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
  }, [dragCooldown, hasActiveDrag, dragSequence, shouldSuppressClick, setTooltipSequence, tileRef]);
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

export function buildTileHandlers(ctx: TileHandlerCtx) {
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
