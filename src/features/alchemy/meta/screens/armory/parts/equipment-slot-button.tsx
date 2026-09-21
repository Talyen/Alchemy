import { ShineBorder } from "@/components/ui/shine-border";
import {
  GEAR_ASTRAL_SHINE_BORDER_WIDTH,
  gearDefinitions,
  getAstralShineColors,
  type CraftingCurrencyId,
  type GearInstance,
  type GearSlot,
} from "@/lib/gear";
import { cn } from "@/lib/utils";
import { memo } from "react";
import { getPlasmaColorPairForGear } from "../../../../shared/config";
import { Surface } from "../../../../shared/ui/surface";
import { GearTooltipContent } from "../../../../shared/ui/tooltips/gear-tooltip-content";
import { PortaledTooltip } from "../../../../shared/ui/tooltips/portaled-tooltip";
import { getArmoryItemInteraction, performArmoryItemAction } from "../armory-item-state";
import type { CraftingResult } from "../crafting-result";
import { targetingRingClass } from "../targeting-highlight";
import { CraftingFlash } from "./armory-item-chrome";
import { ARMORY_GEAR_SLOT_TESTID, armorySlotSurfaceClass, useArmorySlotHover } from "./armory-slot-shell";
import { GearSlotArt } from "./gear-slot-art";
import { SLOT_ARIA_LABELS } from "./slot-labels";

export const EquipmentSlotButton = memo(function EquipmentSlotButton({
  slot,
  instance,
  selected,
  editable,
  salvageMode,
  activeCurrencyId,
  onSelect,
  onUnequip,
  craftingResult,
  onSalvage,
  onApplyCurrency,
  onCombatLockedAttempt,
  isArtHidden = false,
}: {
  slot: GearSlot;
  instance: GearInstance | undefined;
  selected: boolean;
  editable: boolean;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  onSelect: (slot: GearSlot) => void;
  onUnequip: (slot: GearSlot) => void;
  craftingResult: CraftingResult | null;
  onSalvage: (instance: GearInstance) => void;
  onApplyCurrency: (instance: GearInstance) => void;
  onCombatLockedAttempt: () => void;
  isArtHidden?: boolean;
}) {
  const definition = instance ? gearDefinitions[instance.definitionId] : undefined;
  const shineColors = instance ? getAstralShineColors(instance) : undefined;
  const target = getArmoryItemInteraction({
    instance,
    salvageMode,
    activeCurrencyId,
    editable,
    surface: { kind: "equipment", selected },
  });
  const { salvageable, blockedReason, mode, targetAriaLabel } = target;
  const ariaLabel = targetAriaLabel ?? SLOT_ARIA_LABELS[slot];
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
  // Shine borders appear on hover/focus; the active slot keeps its shine as a selection marker.
  const showShine = Boolean(shineColors && (isHovered || selected));

  return (
    <div
      ref={wrapperRef}
      data-testid={ARMORY_GEAR_SLOT_TESTID}
      data-slot={slot}
      data-salvageable={salvageable ? "true" : undefined}
      className={cn("relative", targetingRingClass(mode))}
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
          {blockedReason ? <p className="mt-3 text-sm text-warning">{blockedReason}</p> : null}
        </PortaledTooltip>
      ) : null}
      <Surface
        as="button"
        ariaLabel={ariaLabel}
        ariaPressed={selected}
        overlay={
          showShine && shineColors ? (
            <ShineBorder shineColor={shineColors} borderWidth={GEAR_ASTRAL_SHINE_BORDER_WIDTH} className="z-20" />
          ) : null
        }
        selected={selected}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        onFocus={handleHoverStart}
        onBlur={handleBlur}
        className={armorySlotSurfaceClass(editable, showShine, selected)}
        onClick={() =>
          performArmoryItemAction(target.action, {
            "combat-locked": onCombatLockedAttempt,
            salvage: () => {
              if (instance) onSalvage(instance);
            },
            craft: () => {
              if (instance) onApplyCurrency(instance);
            },
            unequip: () => onUnequip(slot),
            select: () => onSelect(slot),
          })
        }
      >
        <GearSlotArt definition={definition} slot={slot} isHidden={isArtHidden} />
      </Surface>
      {instance ? <CraftingFlash result={craftingResult} instanceId={instance.instanceId} /> : null}
    </div>
  );
});
