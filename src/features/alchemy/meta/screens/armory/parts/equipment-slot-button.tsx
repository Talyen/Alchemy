import { GearProtectionButton } from "./gear-protection-button";
import type { CraftingResult } from "../crafting-result";
import { memo } from "react";
import {
  canApplyCraftingCurrency,
  craftingCurrencyBlockedReason,
  getCraftingCurrencyDefinition,
  getGearInstanceTitle,
  gearDefinitions,
  getAstralShineColors,
  GEAR_ASTRAL_SHINE_BORDER_WIDTH,
  type CraftingCurrencyId,
  type GearInstance,
  type GearSlot,
} from "@/lib/gear";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import { getPlasmaColorPairForGear } from "../../../../shared/config";
import { Surface } from "../../../../shared/ui/surface";
import { PortaledTooltip } from "../../../../shared/ui/portaled-tooltip";
import { GearTooltipContent } from "../../../../shared/ui/gear-tooltip-content";
import { GearSlotArt } from "./gear-slot-art";
import { SLOT_ARIA_LABELS } from "./slot-labels";
import { ARMORY_GEAR_SLOT_TESTID, armorySlotSurfaceClass, useArmorySlotHover } from "./armory-slot-shell";
import { targetingRingClass } from "../targeting-highlight";

export const EquipmentSlotButton = memo(function EquipmentSlotButton({
  slot,
  instance,
  selected,
  editable,
  salvageMode,
  activeCurrencyId,
  onSelect,
  onUnequip,
  onSetProtected,
  craftingResult,
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
  onSetProtected: (instanceId: string, protectedItem: boolean) => boolean;
  craftingResult: CraftingResult | null;
  onSalvage: (instance: GearInstance) => void;
  onApplyCurrency: (instance: GearInstance) => void;
}) {
  const definition = instance ? gearDefinitions[instance.definitionId] : undefined;
  const shineColors = instance ? getAstralShineColors(instance) : undefined;
  const showShine = Boolean(shineColors);
  const canCraft = Boolean(activeCurrencyId && instance && canApplyCraftingCurrency(activeCurrencyId, instance));
  const salvageable = salvageMode && Boolean(instance) && !instance?.protected;
  const blockedReason =
    instance && activeCurrencyId
      ? craftingCurrencyBlockedReason(activeCurrencyId, instance)
      : salvageMode && instance?.protected
        ? "Unlock this item before salvaging."
        : null;
  const currencyTarget = Boolean(activeCurrencyId) && canCraft;
  const ariaLabel =
    instance && salvageMode
      ? `Salvage ${getGearInstanceTitle(instance)}`
      : instance && activeCurrencyId
        ? `Apply ${getCraftingCurrencyDefinition(activeCurrencyId).displayName} to ${getGearInstanceTitle(instance)}`
        : SLOT_ARIA_LABELS[slot];
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
        targetingRingClass(salvageable ? "salvage" : null),
        targetingRingClass(currencyTarget ? "currency" : null),
      )}
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleMouseLeave}
    >
      {instance && definition && showPopup ? (
        <PortaledTooltip
          triggerRef={wrapperRef}
          visible={isHovered}
          className="armory-inventory-tooltip !shadow-none"
          plasmaColorPair={getPlasmaColorPairForGear(instance)}
        >
          <GearTooltipContent definition={definition} instance={instance} />
          {blockedReason ? <p className="mt-3 text-sm text-amber-200">{blockedReason}</p> : null}
        </PortaledTooltip>
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
          if (salvageMode) {
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
      {instance && craftingResult?.before.instanceId === instance.instanceId ? (
        <span
          key={JSON.stringify(craftingResult)}
          aria-hidden="true"
          className="armory-item-feedback pointer-events-none absolute inset-0 z-20 rounded-shell-hero"
        />
      ) : null}
      {instance ? (
        <GearProtectionButton instance={instance} editable={editable} onSetProtected={onSetProtected} />
      ) : null}
    </div>
  );
});
