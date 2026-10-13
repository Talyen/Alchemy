import type { RefObject } from "react";
import { armorySalvageArt } from "@/lib/game-data";
import { CRAFTING_CURRENCY_LIST, type CraftingCurrencyId } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { sectionTitleClass, surfaceSelectedRingClass } from "../../../../shared/config";
import { CurrencyChip } from "../../../../shared/ui/currency-chip";
import { PortaledTooltip } from "../../../../shared/ui/tooltips/portaled-tooltip";
import { TooltipBody, TooltipHeader } from "../../../../shared/ui/tooltips/tooltip-panel";
import { useHoverVisible } from "../../../../shared/ui/use-hover-visible";

export function CraftingStrip({
  craftingCurrencies,
  salvageButtonRef,
  activeCurrencyId,
  salvageMode,
  editable,
  hasSalvageableGear,
  onSelectCurrency,
  onToggleSalvageMode,
}: {
  salvageButtonRef: RefObject<HTMLButtonElement | null>;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  activeCurrencyId: CraftingCurrencyId | null;
  salvageMode: boolean;
  editable: boolean;
  hasSalvageableGear: boolean;
  onSelectCurrency: (currencyId: CraftingCurrencyId) => void;
  onToggleSalvageMode: () => void;
}) {
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } = useHoverVisible();

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
        <div
          ref={triggerRef}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onFocusCapture={onFocusCapture}
          onBlurCapture={onBlurCapture}
        >
          <PortaledTooltip triggerRef={triggerRef} visible={visible} className="armory-inventory-tooltip !shadow-none">
            <TooltipHeader>Salvage</TooltipHeader>
            <TooltipBody>
              <p>
                <strong className="font-semibold text-foreground">Dismantle</strong> gear into crafting materials.
              </p>
              {!editable ? <p className="mt-2">Salvaging is unavailable.</p> : null}
            </TooltipBody>
          </PortaledTooltip>
          <button
            type="button"
            ref={salvageButtonRef}
            data-testid="armory-salvage-toggle"
            aria-label={salvageMode ? "Cancel salvage" : "Salvage"}
            aria-pressed={salvageMode}
            disabled={!editable || (!hasSalvageableGear && !salvageMode)}
            className={cn(
              "armory-currency-art relative block overflow-hidden rounded-xl border border-border/80 bg-black text-red-300 transition-[color,background-color,border-color,box-shadow] duration-150 enabled:hover:border-red-400/80 enabled:hover:text-red-200 enabled:active:bg-red-950/30",
              salvageMode && surfaceSelectedRingClass,
              (!editable || (!hasSalvageableGear && !salvageMode)) && "cursor-default opacity-50",
            )}
            onClick={(event) => {
              event.stopPropagation();
              if (!editable) return;
              onToggleSalvageMode();
            }}
          >
            <img src={armorySalvageArt} alt="" className="h-full w-full object-cover" />
          </button>
        </div>
      </div>
    </div>
  );
}
