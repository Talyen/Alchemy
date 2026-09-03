import { Trash2 } from "lucide-react";
import { CRAFTING_CURRENCY_LIST, type CraftingCurrencyId } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { sectionTitleClass, surfaceSelectedRingClass } from "../../../../shared/config";
import { CurrencyChip } from "./currency-chip";

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
            disabled={!editable || (craftingCurrencies[currency.id] ?? 0) <= 0}
            ariaLabel={`Use ${currency.displayName}`}
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
            salvageMode && surfaceSelectedRingClass,
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
