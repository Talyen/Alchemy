import { useGameTranslation } from "@/components/use-game-translation";

import {
  gearInstanceRarity,
  getGearInstanceTooltipEntries,
  type GearDefinition,
  type GearInstance,
  gearAffixCatalog,
  getGearAffixTextShineColors,
} from "@/lib/gear";
import { GearItemTitle } from "../gear-item-title";
import { ShineText } from "../shine-text";
import { renderColoredKeywords } from "../cards/card-description-ui";
import { TooltipBody, TooltipHeader, TooltipSubheader } from "./tooltip-panel";
import { cn } from "@/lib/utils";
import { tooltipBodyLineClass } from "@/features/alchemy/shared/config";

export function GearTooltipContent({
  definition,
  instance,
}: {
  definition: GearDefinition;
  instance?: GearInstance | undefined;
}) {
  const i18n = useGameTranslation();
  const rarity = instance
    ? (gearInstanceRarity(instance) ?? definition.rarity ?? "basic")
    : (definition.rarity ?? "basic");
  const entries: ReturnType<typeof getGearInstanceTooltipEntries> = instance
    ? getGearInstanceTooltipEntries(instance)
    : definition.descriptionLines.map((text, index) => ({ key: `definition-${index}`, text }));
  const affixEntries = instance
    ? entries.filter(
        (entry): entry is typeof entry & { affixId: NonNullable<typeof entry.affixId>; value: number; name: string } =>
          entry.affixId !== undefined && entry.value !== undefined && entry.name !== undefined,
      )
    : [];

  return (
    <div>
      <TooltipHeader>
        <GearItemTitle {...(instance ? { instance } : { definition })} className="whitespace-normal" />
      </TooltipHeader>
      {affixEntries.length > 0 ? (
        <div className="mt-1 space-y-2">
          {affixEntries.map((entry) => {
            const def = gearAffixCatalog[entry.affixId];
            const isMaxRoll = (rarity === "astral" || rarity === "unique") && entry.value === def.roll[rarity].max;
            const colors = isMaxRoll ? getGearAffixTextShineColors(def) : [];

            return (
              <div key={entry.key}>
                <TooltipSubheader>
                  <ShineText colors={colors} fallbackClassName="text-inherit">
                    {i18n.displayText(entry.name)}
                  </ShineText>
                </TooltipSubheader>
                <p className={cn(tooltipBodyLineClass, "mt-0 pl-3")}>
                  {i18n.displayText(i18n.read(() => renderColoredKeywords(entry.text)))}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <TooltipBody>
          {entries.map((entry) => (
            <p key={entry.key} className={tooltipBodyLineClass}>
              {i18n.displayText(i18n.read(() => renderColoredKeywords(entry.text)))}
            </p>
          ))}
        </TooltipBody>
      )}
    </div>
  );
}
