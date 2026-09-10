import type { CraftingResult } from "../crafting-result";
import { memo } from "react";
import {
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
import { CraftingFlash } from "./armory-item-chrome";
import { targetingRingClass } from "../targeting-highlight";
import { getArmoryTargetState } from "../armory-item-state";

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
}) {
  const definition = instance ? gearDefinitions[instance.definitionId] : undefined;
  const shineColors = instance ? getAstralShineColors(instance) : undefined;
  const showShine = Boolean(shineColors);
  const target = getArmoryTargetState({ instance, salvageMode, activeCurrencyId });
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
          {blockedReason ? <p className="mt-3 text-sm text-amber-200">{blockedReason}</p> : null}
        </PortaledTooltip>
      ) : null}
      <Surface
        as="button"
        ariaLabel={ariaLabel}
        ariaPressed={selected}
        overlay={
          shineColors ? (
            <ShineBorder
              glow={isHovered}
              shineColor={shineColors}
              borderWidth={GEAR_ASTRAL_SHINE_BORDER_WIDTH}
              className="z-20"
            />
          ) : null
        }
        selected={selected}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        onFocus={handleHoverStart}
        onBlur={handleBlur}
        className={armorySlotSurfaceClass(editable, showShine)}
        onClick={() => {
          if (!editable) {
            if (instance && (selected || salvageMode || activeCurrencyId)) {
              onCombatLockedAttempt();
              return;
            }
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
      </Surface>
      {instance ? <CraftingFlash result={craftingResult} instanceId={instance.instanceId} /> : null}
    </div>
  );
});
