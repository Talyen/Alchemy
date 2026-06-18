import {
  gearInstanceRarity,
  getGearAffixTooltipEntries,
  getGearInstanceTooltipLines,
  type GearDefinition,
  type GearInstance,
} from "@/lib/gear";
import { GearItemTitle } from "../../../shared/ui/gear-item-title";
import { renderColoredKeywords } from "../../../shared/ui/card-description-ui";
import { TooltipBody, TooltipHeader, TooltipSubheader } from "../../../shared/ui/tooltip-panel";

/** Grows to fit single-line titles and affix text; viewport cap prevents horizontal overflow. */
export const ARMORY_TOOLTIP_WIDTH = "w-max max-w-[calc(100vw-3rem)]";

export function GearTooltipContent({
  definition,
  instance,
}: {
  definition: GearDefinition;
  instance?: GearInstance | undefined;
}) {
  const rarity = instance ? gearInstanceRarity(instance) : (definition.rarity ?? "basic");
  const affixEntries =
    instance && instance.affixes.length > 0 ? getGearAffixTooltipEntries(instance.affixes, rarity) : [];
  const bodyLines = instance
    ? getGearInstanceTooltipLines(instance)
    : definition.descriptionLines.map((text, index) => ({ key: `definition-${index}`, text }));

  return (
    <div className="w-max">
      <TooltipHeader>
        {instance ? (
          <GearItemTitle instance={instance} />
        ) : (
          <span className="whitespace-nowrap">{definition.title}</span>
        )}
      </TooltipHeader>
      {affixEntries.length > 0 ? (
        <div className="mt-1 space-y-2">
          {affixEntries.map((entry) => (
            <div key={entry.key}>
              <TooltipSubheader>{entry.name}</TooltipSubheader>
              <p className="whitespace-nowrap pl-3 text-sm leading-6 text-muted-foreground">
                {renderColoredKeywords(entry.text)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <TooltipBody>
          {bodyLines.map((entry) => (
            <p key={entry.key} className="whitespace-nowrap">
              {renderColoredKeywords(entry.text)}
            </p>
          ))}
        </TooltipBody>
      )}
    </div>
  );
}
