import { CRAFTING_CURRENCY_LIST, type CraftingCurrencyDefinition, type SalvageYield } from "@/lib/gear";
import { MATERIAL_IDS } from "@/lib/homestead/types";
import { MaterialPill } from "../../../shared/ui/material-icons";
import { PortaledTooltip } from "../../../shared/ui/portaled-tooltip";
import { TooltipBody, TooltipHeader } from "../../../shared/ui/tooltip-panel";
import { useHoverVisible } from "../../../shared/ui/use-hover-visible";
import { CURRENCY_COUNT_LABEL_CLASS } from "./parts/currency-styles";

const DIALOG_TOOLTIP_CLASS = "armory-inventory-tooltip z-[130] !shadow-none";

function SalvageCurrencyChip({ currency, count }: { currency: CraftingCurrencyDefinition; count: number }) {
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } =
    useHoverVisible<HTMLButtonElement>();
  return (
    <>
      <PortaledTooltip triggerRef={triggerRef} visible={visible} className={DIALOG_TOOLTIP_CLASS}>
        <TooltipHeader>{currency.displayName}</TooltipHeader>
        <TooltipBody>
          <p className="text-pretty">{currency.tooltipEffect}</p>
          <p className="mt-2 text-pretty">{currency.description}</p>
        </TooltipBody>
      </PortaledTooltip>
      <button
        ref={triggerRef}
        type="button"
        data-testid="armory-salvage-currency-preview"
        data-currency-id={currency.id}
        className="relative h-16 w-16 overflow-hidden rounded-xl border border-border/80 bg-black"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocusCapture={onFocusCapture}
        onBlurCapture={onBlurCapture}
      >
        <img src={currency.art} alt="" className="h-full w-full object-cover" />
        <span className={CURRENCY_COUNT_LABEL_CLASS}>+{count}</span>
      </button>
    </>
  );
}

export function SalvageYieldPreview({ salvageYield }: { salvageYield: SalvageYield }) {
  const materials = MATERIAL_IDS.filter((id) => salvageYield.materials[id] > 0);
  const currencies = CRAFTING_CURRENCY_LIST.filter((currency) => (salvageYield.currencies[currency.id] ?? 0) > 0);
  if (materials.length === 0 && currencies.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-3" data-testid="armory-salvage-yield">
      {materials.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {materials.map((material) => (
            <MaterialPill
              key={material}
              material={material}
              amount={salvageYield.materials[material]}
              showsIncreasePrefix
            />
          ))}
        </div>
      ) : null}
      {currencies.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {currencies.map((currency) => (
            <SalvageCurrencyChip
              key={currency.id}
              currency={currency}
              count={salvageYield.currencies[currency.id] ?? 0}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
