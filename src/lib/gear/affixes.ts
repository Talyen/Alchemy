import type { GearAffixId } from "./affix-catalog";
import { gearAffixCatalog, type GearAffixDefinition } from "./affix-catalog";
import type { GearEffectManifest } from "./gear-effect-manifest";
import { defaultGearEffects } from "./gear-effect-manifest";
import { gearDefinitions } from "./definitions";
import type { GearAffixRoll, GearInstance, GearRarity } from "./types";

function isGearAffixId(value: string): value is GearAffixId {
  return value in gearAffixCatalog;
}

function formatAffixDescription(def: GearAffixDefinition, roll: GearAffixRoll): string {
  return def.descriptionTemplate.replace("{value}", String(roll.value));
}

export function resolveAffixEffects(affixes: readonly GearAffixRoll[]): GearEffectManifest {
  const effects = { ...defaultGearEffects };
  for (const roll of affixes) {
    const def = gearAffixCatalog[roll.id];
    if (def) {
      effects[def.effectKey] += roll.value;
    }
  }
  return effects;
}

export function normalizeAffixRolls(rawAffixes?: Array<{ id: string; value: number }> | null): GearAffixRoll[] {
  if (!rawAffixes || !Array.isArray(rawAffixes)) return [];
  return rawAffixes.flatMap((entry) => {
    if (!entry || !isGearAffixId(entry.id) || !Number.isFinite(entry.value) || entry.value <= 0) return [];
    return [{ id: entry.id, value: Math.round(entry.value) }];
  });
}

export function rollAffixValue(def: GearAffixDefinition, rarity: GearRarity, rng: () => number): number {
  const range = def.roll[rarity];
  const span = range.max - range.min + 1;
  return range.min + Math.floor(rng() * span);
}

export function getGearAffixDisplayName(affixId: GearAffixId): string {
  return gearAffixCatalog[affixId]?.name ?? affixId;
}

export function getGearAffixTooltipEntries(
  affixes: readonly GearAffixRoll[],
): Array<{ key: string; name: string; text: string }> {
  return affixes.flatMap((roll, index) => {
    const def = gearAffixCatalog[roll.id];
    if (!def) return [];
    return [
      {
        key: `${roll.id}-${index}`,
        name: getGearAffixDisplayName(roll.id),
        text: formatAffixDescription(def, roll),
      },
    ];
  });
}

export function affixMatchesAffinity(def: GearAffixDefinition, affinityKeywords: readonly string[]): boolean {
  return (
    affinityKeywords.includes(def.keywordId) ||
    (def.secondaryKeywordId !== undefined && affinityKeywords.includes(def.secondaryKeywordId))
  );
}

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
