import { getGearAffixDescriptionLines } from "./affixes";
import { gearDefinitions } from "./definitions";
import { formatSalvageValue } from "./operations";
import type { GearInstance } from "./types";

function instanceRarity(instance: GearInstance) {
  return gearDefinitions[instance.definitionId]?.rarity ?? "basic";
}

export function getGearInstanceDescriptionLines(instance: GearInstance): string[] {
  return getGearInstanceTooltipLines(instance).map((entry) => entry.text);
}

export function getGearInstanceTooltipLines(instance: GearInstance): { key: string; text: string }[] {
  const definition = gearDefinitions[instance.definitionId];
  const rarity = instanceRarity(instance);
  const affixLines = getGearAffixDescriptionLines(instance.affixes, rarity);

  if (affixLines.length > 0) {
    return affixLines;
  }

  if (definition?.descriptionLines.length) {
    return definition.descriptionLines.map((text, index) => ({ key: `definition-${index}`, text }));
  }

  if (definition) {
    return [{ key: "salvage", text: `Salvage: ${formatSalvageValue(definition.salvageValue)}` }];
  }

  return [];
}
