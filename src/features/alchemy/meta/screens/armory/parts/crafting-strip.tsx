import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { CRAFTING_CURRENCY_LIST, type CraftingCurrencyDefinition, type CraftingCurrencyId } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { PressableSound } from "../../../../shared/ui/pressable-sound";
import { PortaledTooltip } from "../../../../shared/ui/portaled-tooltip";
import { TooltipBody, TooltipHeader } from "../../../../shared/ui/tooltip-panel";
import { CURRENCY_COUNT_LABEL_CLASS } from "./currency-styles";
import { tiltSurfaceSelectedRingClass } from "../../../../shared/config/layout";

function CurrencyChip({
  currency,
  count,
  armed,
  editable,
  onSelect,
}: {
  currency: CraftingCurrencyDefinition;
  count: number;
  armed: boolean;
  editable: boolean;
  onSelect: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const canUse = editable && count > 0;
  return (
    <>
      <PortaledTooltip triggerRef={triggerRef} visible={showTooltip} className="armory-inventory-tooltip !shadow-none">
        <TooltipHeader>{currency.displayName}</TooltipHeader>
        <TooltipBody>{currency.tooltipEffect}</TooltipBody>
      </PortaledTooltip>
      <PressableSound {...(canUse ? {} : { hoverSound: false as const })}>
        <button
          ref={triggerRef}
          type="button"
          data-testid="armory-crafting-currency"
          data-currency-id={currency.id}
          aria-label={`Use ${currency.displayName}`}
          aria-pressed={armed}
          disabled={!canUse}
          className={cn(
            "relative h-14 w-14 overflow-hidden rounded-xl border border-border/80 bg-black",
            armed && tiltSurfaceSelectedRingClass,
            !canUse && "cursor-default opacity-40",
          )}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={(event) => {
            event.stopPropagation();
            if (!canUse) return;
            onSelect();
          }}
        >
          <img src={currency.art} alt="" className="h-full w-full object-cover" />
          <span className={CURRENCY_COUNT_LABEL_CLASS}>{count}</span>
        </button>
      </PressableSound>
    </>
  );
}

export function CraftingStrip({
  craftingCurrencies,
  activeCurrencyId,
  salvageMode,
  editable,
  hasSalvageableGear,
  onSelectCurrency,
  onToggleSalvageMode,
}: {
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  activeCurrencyId: CraftingCurrencyId | null;
  salvageMode: boolean;
  editable: boolean;
  hasSalvageableGear: boolean;
  onSelectCurrency: (currencyId: CraftingCurrencyId) => void;
  onToggleSalvageMode: () => void;
}) {
  return (
    <div data-testid="armory-crafting-strip" className="mt-4 w-full">
      <h3 className="text-center font-sans text-lg text-amber-100">Crafting</h3>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {CRAFTING_CURRENCY_LIST.map((currency) => (
          <CurrencyChip
            key={currency.id}
            currency={currency}
            count={craftingCurrencies[currency.id] ?? 0}
            armed={activeCurrencyId === currency.id}
            editable={editable}
            onSelect={() => onSelectCurrency(currency.id)}
          />
        ))}
        <PressableSound {...(editable && hasSalvageableGear ? {} : { hoverSound: false as const })}>
          <button
            type="button"
            data-testid="armory-salvage-toggle"
            aria-label={salvageMode ? "Cancel salvage" : "Salvage"}
            aria-pressed={salvageMode}
            disabled={!editable || (!hasSalvageableGear && !salvageMode)}
            className={cn(
              "relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-black text-red-300",
              salvageMode && tiltSurfaceSelectedRingClass,
              (!editable || (!hasSalvageableGear && !salvageMode)) && "cursor-default opacity-40",
            )}
            onClick={(event) => {
              event.stopPropagation();
              if (!editable) return;
              onToggleSalvageMode();
            }}
          >
            <Trash2 className="h-6 w-6" />
          </button>
        </PressableSound>
      </div>
    </div>
  );
}
