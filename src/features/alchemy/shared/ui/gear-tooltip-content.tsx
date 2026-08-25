import {
  gearInstanceRarity,
  getGearAffixTooltipEntries,
  getGearInstanceTooltipLines,
  getGearDefinitionTitle,
  type GearDefinition,
  type GearInstance,
  gearAffixCatalog,
  getGearAffixShineGradient,
} from "@/lib/gear";
import { GearItemTitle } from "./gear-item-title";
import { renderColoredKeywords } from "./card-description-ui";
import { TooltipBody, TooltipHeader, TooltipSubheader } from "./tooltip-panel";
import { cn } from "@/lib/utils";
import { tooltipBodyClass } from "@/features/alchemy/shared/config";

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
        {instance ? (
          <GearItemTitle instance={instance} className="whitespace-normal" />
        ) : (
          <span>{getGearDefinitionTitle(definition)}</span>
        )}
      </TooltipHeader>
      {affixEntries.length > 0 ? (
        <div className="mt-1 space-y-2">
          {affixEntries.map((entry, index) => {
            const roll = instance?.affixes[index];
            const def = roll ? gearAffixCatalog[roll.id] : undefined;
            const isMaxAstral =
              (rarity === "astral" || rarity === "unique") && def && roll && roll.value === def.roll[rarity].max;
            const gradient = isMaxAstral ? getGearAffixShineGradient(def) : null;

            return (
              <div key={entry.key}>
                {gradient ? (
                  <TooltipSubheader
                    className="boss-title-shine [background-size:300%_300%] bg-clip-text text-transparent"
                    style={{ backgroundImage: gradient }}
                  >
                    {entry.name}
                  </TooltipSubheader>
                ) : (
                  <TooltipSubheader>{entry.name}</TooltipSubheader>
                )}
                <p className={cn(tooltipBodyClass, "mt-0 pl-3")}>{renderColoredKeywords(entry.text)}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <TooltipBody>
          {bodyLines.map((entry) => (
            <p key={entry.key}>{renderColoredKeywords(entry.text)}</p>
          ))}
        </TooltipBody>
      )}
    </div>
  );
}
