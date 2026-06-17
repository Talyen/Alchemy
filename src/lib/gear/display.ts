import { getGearAffixDescriptionLines } from "./affixes";
import { gearDefinitions, gearInstanceRarity } from "./definitions";
import { formatSalvageValue } from "./operations";
import type { GearInstance } from "./types";

export function getGearInstanceDescriptionLines(instance: GearInstance): string[] {
  return getGearInstanceTooltipLines(instance).map((entry) => entry.text);
}

export function getGearInstanceTooltipLines(instance: GearInstance): { key: string; text: string }[] {
  const definition = gearDefinitions[instance.definitionId];
  const rarity = gearInstanceRarity(instance);
  const affixLines = getGearAffixDescriptionLines(instance.affixes, rarity);

  if (affixLines.length > 0) {
    return affixLines;
  }

  if (definition?.descriptionLines.length) {
    return definition.descriptionLines.map((text, index) => ({ key: `definition-${index}`, text }));
  }

  if (definition) {
    return [{ key: "salvage", text: formatSalvageValue(definition.salvageValue) }];
  }

  return [];
}
