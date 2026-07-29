/* eslint-disable react-refresh/only-export-components -- armory slot helper components and compatibility helpers are colocated. */
import { type FocusEvent } from "react";
import {
  gearDefinitions,
  isGearCompatibleWithLoadoutSlot,
  type CraftingCurrencyId,
  type GearInstance,
  type GearLoadout,
  type GearSlot,
} from "@/lib/gear";
import { ShineBorder } from "@/components/ui/shine-border";
import { playUISound } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { GearSlotArt } from "./gear-slot-art";
import { VALID_TARGET_SHADOW } from "../targeting-highlight";
import type { GearDragOrigin, GearPointerEnd, GearPointerMove, GearPointerStart } from "../use-armory-gear-drag";

function dismissWhenFocusLeaves(event: FocusEvent<HTMLDivElement>, dismiss: () => void) {
  if (!event.currentTarget.contains(event.relatedTarget)) dismiss();
}

export function isSlotCompatible(
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
        "pointer-events-none absolute inset-0 z-20 rounded-xl transition-[box-shadow] duration-150",
        isCompatible && VALID_TARGET_SHADOW,
        craftRing,
        salvageRing,
      )}
    />
  );
}

export function SlotContent({
  definition,
  slot,
  hideGearArt,
  isCompatible,
  showCompatibility,
  salvageRing,
  craftRing,
  shineColors,
}: {
  definition: (typeof gearDefinitions)[string] | undefined;
  slot: GearSlot;
  hideGearArt: boolean;
  isCompatible: boolean;
  showCompatibility: boolean;
  salvageRing: string[] | false;
  craftRing: string[] | false;
  shineColors: readonly string[];
}) {
  return (
    <>
      <GearSlotArt definition={definition} slot={slot} isHidden={hideGearArt} />
      <CompatibilityOverlay
        show={isCompatible || showCompatibility}
        isCompatible={isCompatible}
        salvageRing={salvageRing}
        craftRing={craftRing}
      />
      {shineColors.length > 0 ? <ShineBorder shineColor={shineColors} borderWidth={1} /> : null}
    </>
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
  onGearPointerStart: GearPointerStart;
  onGearPointerMove: GearPointerMove;
  onGearPointerEnd: GearPointerEnd;
  onGearDoubleClick: (instance: GearInstance, origin: GearDragOrigin, rect: DOMRect) => void;
  onSalvage: () => void;
  onApplyCurrency: () => void;
  onTransferRequest?: ((instance: GearInstance, anchor: { x: number; y: number }) => void) | undefined;
}

export function buildSlotHandlers(ctx: SlotHandlerContext) {
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
      instance,
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
    onGearDoubleClick(instance, { kind: "equipment", slot }, event.currentTarget.getBoundingClientRect());
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
