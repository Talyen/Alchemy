import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { CRAFTING_CURRENCY_LIST, type CraftingCurrencyDefinition, type CraftingCurrencyId } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { PortaledTooltip } from "../../../../shared/ui/portaled-tooltip";
import { TooltipBody, TooltipHeader } from "../../../../shared/ui/tooltip-panel";
import { CURRENCY_COUNT_LABEL_CLASS } from "./currency-styles";
import { sectionTitleClass, tiltSurfaceSelectedRingClass } from "../../../../shared/config";

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
      <button
        ref={triggerRef}
        type="button"
        data-testid="armory-crafting-currency"
        data-currency-id={currency.id}
        aria-label={`Use ${currency.displayName}`}
        aria-pressed={armed}
        disabled={!canUse}
        className={cn(
          "relative h-20 w-20 overflow-hidden rounded-xl border border-border/80 bg-black",
          armed && tiltSurfaceSelectedRingClass,
          !canUse && "cursor-default opacity-50",
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
      <h3 className={cn("text-center font-sans", sectionTitleClass)}>Crafting</h3>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
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
        <button
          type="button"
          data-testid="armory-salvage-toggle"
          aria-label={salvageMode ? "Cancel salvage" : "Salvage"}
          aria-pressed={salvageMode}
          disabled={!editable || (!hasSalvageableGear && !salvageMode)}
          className={cn(
            "relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-black text-red-300",
            salvageMode && tiltSurfaceSelectedRingClass,
            (!editable || (!hasSalvageableGear && !salvageMode)) && "cursor-default opacity-50",
          )}
          onClick={(event) => {
            event.stopPropagation();
            if (!editable) return;
            onToggleSalvageMode();
          }}
        >
          <Trash2 className="h-10 w-10" />
        </button>
      </div>
    </div>
  );
}
