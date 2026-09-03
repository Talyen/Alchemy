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
import { Surface } from "../../../../shared/ui/surface";
import { GearTooltipPortal } from "../gear-tooltip-portal";
import { GearSlotArt } from "./gear-slot-art";
import { SLOT_ARIA_LABELS } from "./slot-labels";
import { ARMORY_GEAR_SLOT_TESTID, armorySlotSurfaceClass, useArmorySlotHover } from "./armory-slot-shell";
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
  onSelect: (slot: GearSlot) => void;
  onUnequip: (slot: GearSlot) => void;
  onSalvage: (instance: GearInstance) => void;
  onApplyCurrency: (instance: GearInstance) => void;
}) {
  const definition = instance ? gearDefinitions[instance.definitionId] : undefined;
  const shineColors = instance ? getAstralShineColors(instance) : undefined;
  const showShine = Boolean(shineColors);
  const canCraft = Boolean(activeCurrencyId && instance && canApplyCraftingCurrency(activeCurrencyId, instance));
  const salvageable = salvageMode && Boolean(instance);
  const currencyTarget = Boolean(activeCurrencyId) && canCraft;
  const ariaLabel = SLOT_ARIA_LABELS[slot];
  const {
    isHovered,
    shimmerActive,
    shimmerToken,
    wrapperRef,
    showPopup,
    handleHoverStart,
    handleMouseLeave,
    handleBlur,
  } = useArmorySlotHover(slot);

  return (
    <div
      ref={wrapperRef}
      data-testid={ARMORY_GEAR_SLOT_TESTID}
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
      <Surface
        as="button"
        ariaLabel={ariaLabel}
        ariaPressed={selected}
        selected={selected}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        onFocus={handleHoverStart}
        onBlur={handleBlur}
        className={armorySlotSurfaceClass(editable, showShine)}
        onClick={() => {
          if (!editable) {
            onSelect(slot);
            return;
          }
          if (salvageable) {
            if (instance) onSalvage(instance);
            return;
          }
          if (activeCurrencyId && instance) {
            onApplyCurrency(instance);
            return;
          }
          if (selected && instance) {
            onUnequip(slot);
            return;
          }
          onSelect(slot);
        }}
      >
        <GearSlotArt definition={definition} slot={slot} />
        {shineColors ? (
          <ShineBorder shineColor={shineColors} borderWidth={GEAR_ASTRAL_SHINE_BORDER_WIDTH} className="z-20" />
        ) : null}
      </Surface>
    </div>
  );
});
