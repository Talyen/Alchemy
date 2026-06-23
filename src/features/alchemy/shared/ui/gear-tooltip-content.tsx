import {
  gearInstanceRarity,
  getGearAffixTooltipEntries,
  getGearInstanceTooltipLines,
  type GearDefinition,
  type GearInstance,
  gearAffixCatalog,
  getGearAffixShineGradient,
} from "@/lib/gear";
import { GearItemTitle } from "./gear-item-title";
import { renderColoredKeywords } from "./card-description-ui";
import { TooltipBody, TooltipHeader, TooltipSubheader } from "./tooltip-panel";

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
          {affixEntries.map((entry, index) => {
            const roll = instance?.affixes[index];
            const def = roll ? gearAffixCatalog[roll.id] : undefined;
            const isMaxAstral = rarity === "astral" && def && roll && roll.value === def.roll.astral.max;
            const gradient = isMaxAstral ? getGearAffixShineGradient(def) : null;

            return (
              <div key={entry.key}>
                {gradient ? (
                  <TooltipSubheader
                    className="boss-title-shine bg-clip-text text-transparent [background-size:300%_300%]"
                    style={{ backgroundImage: gradient }}
                  >
                    {entry.name}
                  </TooltipSubheader>
                ) : (
                  <TooltipSubheader>{entry.name}</TooltipSubheader>
                )}
                <p className="whitespace-nowrap pl-3 text-sm leading-6 text-muted-foreground">
                  {renderColoredKeywords(entry.text)}
                </p>
              </div>
            );
          })}
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
