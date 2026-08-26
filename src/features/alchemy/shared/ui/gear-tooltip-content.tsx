import {
  gearInstanceRarity,
  getGearAffixTooltipEntries,
  getGearInstanceTooltipLines,
  type GearDefinition,
  type GearInstance,
  gearAffixCatalog,
  getGearAffixTextShineColors,
  getGearDefinitionTextShineColors,
} from "@/lib/gear";
import { GearItemTitle } from "./gear-item-title";
import { ShineText } from "./shine-text";
import { renderColoredKeywords } from "./card-description-ui";
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
  const rarity = instance ? gearInstanceRarity(instance) : (definition.rarity ?? "basic");
  const affixEntries = instance && instance.affixes.length > 0 ? getGearAffixTooltipEntries(instance.affixes) : [];
  const bodyLines = instance
    ? getGearInstanceTooltipLines(instance)
    : definition.descriptionLines.map((text, index) => ({ key: `definition-${index}`, text }));

  return (
    <div>
      <TooltipHeader>
        <GearItemTitle {...(instance ? { instance } : { definition })} className="whitespace-normal" />
      </TooltipHeader>
      {affixEntries.length > 0 ? (
        <div className="mt-1 space-y-2">
          {affixEntries.map((entry, index) => {
            const roll = instance?.affixes[index];
            const def = roll ? gearAffixCatalog[roll.id] : undefined;
            const isMaxAstral =
              (rarity === "astral" || rarity === "unique") && def && roll && roll.value === def.roll[rarity].max;
            const colors = isMaxAstral
              ? rarity === "unique"
                ? getGearDefinitionTextShineColors(definition)
                : getGearAffixTextShineColors(def)
              : [];

            return (
              <div key={entry.key}>
                <TooltipSubheader>
                  <ShineText colors={colors} fallbackClassName="text-inherit">
                    {entry.name}
                  </ShineText>
                </TooltipSubheader>
                <p className={cn(tooltipBodyLineClass, "mt-0 pl-3")}>{renderColoredKeywords(entry.text)}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <TooltipBody>
          {bodyLines.map((entry) => (
            <p key={entry.key} className={tooltipBodyLineClass}>
              {renderColoredKeywords(entry.text)}
            </p>
          ))}
        </TooltipBody>
      )}
    </div>
  );
}
