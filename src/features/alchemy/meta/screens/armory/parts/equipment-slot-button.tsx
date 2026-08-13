import { memo, useRef, useState } from "react";
import {
  canApplyCraftingCurrency,
  gearDefinitions,
  gearInstanceRarity,
  getGearInstanceShineColors,
  type CraftingCurrencyId,
  type GearInstance,
  type GearSlot,
} from "@/lib/gear";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import { playUISound } from "@/lib/audio";
import { GearSlotArt } from "./gear-slot-art";
import { SLOT_LABELS } from "./slot-labels";
import { GearTooltipPortal } from "../gear-tooltip-portal";
import {
  SALVAGE_TARGET_RING,
  SALVAGE_TARGET_SHADOW,
  VALID_TARGET_RING,
  VALID_TARGET_SHADOW,
} from "../targeting-highlight";
import { tiltSurfaceSelectedRingClass } from "../../../../shared/config/layout";

export const EquipmentSlotButton = memo(function EquipmentSlotButton({
  slot,
  instance,
  selected,
  editable,
  salvageMode,
  activeCurrencyId,
  onSelect,
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
  onSalvage: () => void;
  onApplyCurrency: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const definition = instance ? gearDefinitions[instance.definitionId] : undefined;
  const shineColors = instance ? getGearInstanceShineColors(instance) : [];
  const isAstral = instance ? gearInstanceRarity(instance) === "astral" : false;
  const canCraft = Boolean(activeCurrencyId && instance && canApplyCraftingCurrency(activeCurrencyId, instance));
  const salvageable = salvageMode && Boolean(instance);
  const currencyTarget = Boolean(activeCurrencyId) && canCraft;
  const label = SLOT_LABELS[slot];

  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      {instance && definition ? (
        <GearTooltipPortal triggerRef={triggerRef} visible={showTooltip} definition={definition} instance={instance} />
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        data-testid="armory-equipment-slot"
        data-slot={slot}
        data-salvageable={salvageable ? "true" : undefined}
        aria-label={`${label} equipment slot`}
        aria-pressed={selected}
        className={cn(
          "relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-border/80 bg-black",
          selected && tiltSurfaceSelectedRingClass,
          salvageable && [SALVAGE_TARGET_RING, SALVAGE_TARGET_SHADOW],
          currencyTarget && [VALID_TARGET_RING, VALID_TARGET_SHADOW],
          editable ? "cursor-pointer" : "cursor-default",
        )}
        onMouseEnter={() => {
          if (instance) playUISound("buttonHover");
          setShowTooltip(true);
        }}
        onMouseLeave={() => setShowTooltip(false)}
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
          onSelect();
        }}
      >
        <GearSlotArt definition={definition} slot={slot} />
        {isAstral && shineColors.length > 0 ? <ShineBorder shineColor={shineColors} borderWidth={1} /> : null}
      </button>
      <p className="text-center font-sans text-sm text-amber-100">{label}</p>
    </div>
  );
});
