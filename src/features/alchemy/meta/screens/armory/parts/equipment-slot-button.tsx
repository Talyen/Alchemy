import { memo } from "react";
import {
  canApplyCraftingCurrency,
  gearDefinitions,
  getAstralShineColors,
  GEAR_ASTRAL_SHINE_BORDER_WIDTH,
  type CraftingCurrencyId,
  type GearInstance,
  type GearSlot,
} from "@/lib/gear";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import {
  cardSurfaceClass,
  collectionGridTileWidthClass,
  gearArtAspectClass,
  cardInteractiveGlowClass,
  cardShineFrameClass,
} from "../../../../shared/config";
import { TiltSurface } from "../../../../shared/ui/tilt-surface";
import { useInteractiveCard } from "../../../../shared/ui/use-interactive-card";
import { useTileHoverPopup } from "../../../../shared/ui/use-tile-hover-popup";
import { GearTooltipPortal } from "../gear-tooltip-portal";
import { GearSlotArt } from "./gear-slot-art";
import { SLOT_ARIA_LABELS } from "./slot-labels";
import {
  SALVAGE_TARGET_RING,
  SALVAGE_TARGET_SHADOW,
  VALID_TARGET_RING,
  VALID_TARGET_SHADOW,
} from "../targeting-highlight";

export const EquipmentSlotButton = memo(function EquipmentSlotButton({
  slot,
  instance,
  selected,
  editable,
  salvageMode,
  activeCurrencyId,
  onSelect,
  onUnequip,
  onSalvage,
  onApplyCurrency,
}: {
  slot: GearSlot;
  instance: GearInstance | undefined;
  selected: boolean;
  editable: boolean;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  onSelect: () => void;
  onUnequip: () => void;
  onSalvage: () => void;
  onApplyCurrency: () => void;
}) {
  const definition = instance ? gearDefinitions[instance.definitionId] : undefined;
  const shineColors = instance ? getAstralShineColors(instance) : undefined;
  const showShine = Boolean(shineColors);
  const canCraft = Boolean(activeCurrencyId && instance && canApplyCraftingCurrency(activeCurrencyId, instance));
  const salvageable = salvageMode && Boolean(instance);
  const currencyTarget = Boolean(activeCurrencyId) && canCraft;
  const ariaLabel = SLOT_ARIA_LABELS[slot];
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("armory", slot);
  const { wrapperRef, showPopup, handleHoverStart, handleMouseLeave, handleBlur } = useTileHoverPopup({
    interactive: true,
    isHovered,
    onHoverStart,
    onHoverEnd,
  });

  return (
    <div
      ref={wrapperRef}
      data-testid="armory-equipment-slot"
      data-slot={slot}
      data-salvageable={salvageable ? "true" : undefined}
      className={cn(
        "relative",
        salvageable && [SALVAGE_TARGET_RING, SALVAGE_TARGET_SHADOW, "rounded-shell-hero"],
        currencyTarget && [VALID_TARGET_RING, VALID_TARGET_SHADOW, "rounded-shell-hero"],
      )}
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleMouseLeave}
    >
      {instance && definition && showPopup ? (
        <GearTooltipPortal triggerRef={wrapperRef} visible={isHovered} definition={definition} instance={instance} />
      ) : null}
      <TiltSurface
        as="button"
        ariaLabel={ariaLabel}
        ariaPressed={selected}
        selected={selected}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        onFocus={handleHoverStart}
        onBlur={handleBlur}
        className={cn(
          cardSurfaceClass,
          collectionGridTileWidthClass,
          gearArtAspectClass,
          "group shadow-md",
          showShine && cardShineFrameClass,
          !showShine && "border border-border/80",
          cardInteractiveGlowClass,
          editable ? "cursor-pointer" : "cursor-default",
        )}
        onClick={() => {
          if (!editable) {
            onSelect();
            return;
          }
          if (salvageable) {
            onSalvage();
            return;
          }
          if (activeCurrencyId && instance) {
            onApplyCurrency();
            return;
          }
          if (selected && instance) {
            onUnequip();
            return;
          }
          onSelect();
        }}
      >
        <GearSlotArt definition={definition} slot={slot} />
        {shineColors ? (
          <ShineBorder shineColor={shineColors} borderWidth={GEAR_ASTRAL_SHINE_BORDER_WIDTH} className="z-20" />
        ) : null}
      </TiltSurface>
    </div>
  );
});
