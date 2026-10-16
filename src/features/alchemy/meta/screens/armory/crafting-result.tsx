import { GameMessage } from "@/components/localization";
import { useGameTranslation } from "@/components/use-game-translation";
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
  const i18n = useGameTranslation();
  const beforeEntries = getGearAffixTooltipEntries(result.before.affixes, gearInstanceRarity(result.before));
  const afterEntries = getGearAffixTooltipEntries(after.affixes, gearInstanceRarity(after));
  const beforeById = new Map(beforeEntries.map((entry) => [entry.affixId, entry]));
  const afterById = new Map(afterEntries.map((entry) => [entry.affixId, entry]));
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);
  const changes = [...ids].flatMap((id) => {
    const previous = beforeById.get(id);
    const current = afterById.get(id);
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
        <GameMessage
          id="ui.crafting-result.s1"
          defaultValue="<part0/>: <part1/> applied."
          parts={{
            part0: <GearItemTitle instance={after} className="whitespace-normal" />,
            part1: i18n.displayText(getCraftingCurrencyDefinition(result.currencyId).displayName),
          }}
        />
      </p>
      {upgraded ? <p className="mt-2 text-gold-pale">{i18n.text("ui.crafting-result.4", "Basic → Astral")}</p> : null}
      <ul className="mt-2 max-h-[35dvh] space-y-2 overflow-y-auto">
        {changes.map((change) => (
          <li key={change.id} className="armory-affix-feedback rounded-lg bg-emerald-300/10 px-2 py-1">
            <span className="font-semibold">{i18n.displayText(change.name)}</span>
            <span className="block text-muted-foreground">{i18n.displayText(change.before)}</span>
            <span className="block text-emerald-100">
              <GameMessage
                id="ui.crafting-result.s2"
                defaultValue="→ <part0/>"
                parts={{ part0: i18n.displayText(change.after) }}
              />
            </span>
          </li>
        ))}
      </ul>
      {!changes.length && !upgraded ? (
        <p className="mt-2">{i18n.text("ui.crafting-result.6", "The roll produced the same affixes and values.")}</p>
      ) : null}
      <button type="button" className="mt-2 rounded px-2 py-1 underline underline-offset-4" onClick={onDismiss}>
        {i18n.text("ui.crafting-result.7", "Dismiss result")}
      </button>
    </div>
  );
}
