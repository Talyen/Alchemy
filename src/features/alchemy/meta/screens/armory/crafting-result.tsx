import {
  getGearAffixTooltipEntries,
  gearInstanceRarity,
  getCraftingCurrencyDefinition,
  type CraftingCurrencyId,
  type GearInstance,
} from "@/lib/gear";
import { GearItemTitle } from "../../../shared/ui/gear-item-title";

export interface CraftingResult {
  before: GearInstance;
  currencyId: CraftingCurrencyId;
}

export function CraftingResultPreview({
  result,
  after,
  onDismiss,
}: {
  result: CraftingResult;
  after: GearInstance;
  onDismiss: () => void;
}) {
  const beforeEntries = getGearAffixTooltipEntries(result.before.affixes, gearInstanceRarity(result.before));
  const afterEntries = getGearAffixTooltipEntries(after.affixes, gearInstanceRarity(after));
  const ids = new Set([...beforeEntries, ...afterEntries].map((entry) => entry.affixId));
  const changes = [...ids].flatMap((id) => {
    const previous = beforeEntries.find((entry) => entry.affixId === id);
    const current = afterEntries.find((entry) => entry.affixId === id);
    if (previous?.value === current?.value) return [];
    return [
      {
        id,
        name: current?.name ?? previous?.name,
        before: previous?.text ?? "Not present",
        after: current?.text ?? "Removed",
      },
    ];
  });
  const upgraded = gearInstanceRarity(result.before) !== gearInstanceRarity(after);
  return (
    <div role="status" className="text-sm" data-testid="armory-crafting-result">
      <p>
        <GearItemTitle instance={after} className="whitespace-normal" />:{" "}
        {getCraftingCurrencyDefinition(result.currencyId).displayName} applied.
      </p>
      {upgraded ? <p className="mt-2 text-amber-200">Basic → Astral</p> : null}
      <ul className="mt-2 max-h-[35dvh] space-y-2 overflow-y-auto">
        {changes.map((change) => (
          <li key={change.id} className="armory-affix-feedback rounded-lg bg-emerald-300/10 px-2 py-1">
            <span className="font-semibold">{change.name}</span>
            <span className="block text-muted-foreground">{change.before}</span>
            <span className="block text-emerald-100">→ {change.after}</span>
          </li>
        ))}
      </ul>
      {!changes.length && !upgraded ? <p className="mt-2">The roll produced the same affixes and values.</p> : null}
      <button type="button" className="mt-2 rounded px-2 py-1 underline underline-offset-4" onClick={onDismiss}>
        Dismiss result
      </button>
    </div>
  );
}
