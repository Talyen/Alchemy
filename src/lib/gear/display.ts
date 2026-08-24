import { getGearAffixTooltipEntries } from "./affixes";
import { gearDefinitions } from "./definitions";

import type { GearInstance } from "./types";

export function getGearInstanceTooltipEntries(
  instance: GearInstance,
): Array<{ key: string; name?: string; text: string }> {
  const definition = gearDefinitions[instance.definitionId];
  const affixEntries = getGearAffixTooltipEntries(instance.affixes);
  if (affixEntries.length > 0) return affixEntries;
  return (definition?.descriptionLines ?? []).map((text, index) => ({ key: `definition-${index}`, text }));
}

export function getGearInstanceTooltipLines(instance: GearInstance): Array<{ key: string; text: string }> {
  return getGearInstanceTooltipEntries(instance).map(({ key, text }) => ({ key, text }));
}
