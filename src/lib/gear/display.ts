import { getGearAffixTooltipEntries } from "./affixes";
import { gearDefinitions, gearInstanceRarity } from "./definitions";

import type { GearInstance } from "./types";

export function getGearInstanceDescriptionLines(instance: GearInstance): string[] {
  return getGearInstanceTooltipLines(instance).map((entry) => entry.text);
}

export function getGearInstanceTooltipEntries(instance: GearInstance): { key: string; name?: string; text: string }[] {
  const definition = gearDefinitions[instance.definitionId];
  const rarity = gearInstanceRarity(instance);
  const affixEntries = getGearAffixTooltipEntries(instance.affixes, rarity);

  if (affixEntries.length > 0) {
    return affixEntries;
  }

  if (definition?.descriptionLines.length) {
    return definition.descriptionLines.map((text, index) => ({ key: `definition-${index}`, text }));
  }

  if (definition) {
    if (instance.affixes.length > 0) {
      const text = rarity === "basic" ? "Salvage for Basic crafting currency" : "Salvage for Astral crafting currency";
      return [{ key: "salvage", text }];
    }
  }

  return [];
}

export function getGearInstanceTooltipLines(instance: GearInstance): { key: string; text: string }[] {
  return getGearInstanceTooltipEntries(instance).map(({ key, text }) => ({ key, text }));
}
