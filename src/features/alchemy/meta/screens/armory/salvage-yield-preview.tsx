import { CRAFTING_CURRENCY_LIST, type SalvageYield } from "@/lib/gear";
import { MATERIAL_IDS } from "@/lib/homestead/types";
import { MaterialPill } from "../../../shared/ui/material-icons";
import { CurrencyChip } from "./parts/currency-chip";

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
            <CurrencyChip
              key={currency.id}
              currency={currency}
              count={salvageYield.currencies[currency.id] ?? 0}
              size="sm"
              showDescription
              countPrefix="+"
              testId="armory-salvage-currency-preview"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
