import { formatGearEffectSummary, getGearAffixDescriptionLines, resolveAffixEffects } from "./affixes";
import { gearDefinitions } from "./definitions";
import { subtractGearEffectManifests } from "./effect-manifest";
import { effectsForInstance } from "./operations";
import type { GearInstance } from "./types";

export function getGearInstanceDescriptionLines(instance: GearInstance): string[] {
  return getGearInstanceTooltipLines(instance).map((entry) => entry.text);
}

export function getGearInstanceTooltipLines(instance: GearInstance): { key: string; text: string }[] {
  const definition = gearDefinitions[instance.definitionId];
  const affixLines = getGearAffixDescriptionLines(instance.affixIds);
  const totalEffects = effectsForInstance(instance);
  const affixEffects = resolveAffixEffects(instance.affixIds);
  const remainderEffects = subtractGearEffectManifests(totalEffects, affixEffects);
  const remainderLines = formatGearEffectSummary(remainderEffects).map((text, index) => ({
    key: `remainder-${index}`,
    text,
  }));

  if (affixLines.length > 0) {
    return [...affixLines, ...remainderLines];
  }

  const summaryLines = formatGearEffectSummary(totalEffects).map((text, index) => ({
    key: `summary-${index}`,
    text,
  }));
  if (summaryLines.length > 0) return summaryLines;

  return (definition?.descriptionLines ?? []).map((text, index) => ({ key: `definition-${index}`, text }));
}
