import type { GearAffixId } from "./affix-catalog";
import { gearAffixCatalog, formatAffixDescription, type GearAffixDefinition } from "./affix-catalog";
import type { GearEffectManifest } from "./gear-effect-manifest";
import { defaultGearEffects, GEAR_CHANCE_EFFECT_KEYS, type GearChanceEffectKey } from "./gear-effect-manifest";
import { gearDefinitions } from "./definitions";
import { getUniqueAffixView } from "./unique-catalog";
import type { GearAffixRoll, GearInstance, GearRarity } from "./types";
import { clamp } from "@/lib/math";
import { rngInt } from "@/lib/rng";

interface AffixRollInput {
  id: string;
  value: number;
}

function isGearAffixId(value: unknown): value is GearAffixId {
  return typeof value === "string" && Object.hasOwn(gearAffixCatalog, value);
}

function addAffixEffect(effects: GearEffectManifest, key: keyof GearEffectManifest, value: number): void {
  if ((GEAR_CHANCE_EFFECT_KEYS as readonly string[]).includes(key)) {
    const chanceKey = key as GearChanceEffectKey;
    effects[chanceKey] = [...effects[chanceKey], value];
  } else {
    effects[key as Exclude<keyof GearEffectManifest, GearChanceEffectKey>] += value;
  }
}

export function resolveAffixEffects(affixes: readonly GearAffixRoll[]): GearEffectManifest {
  const effects = { ...defaultGearEffects };
  for (const roll of affixes) {
    const def = gearAffixCatalog[roll.id];
    if (def) {
      addAffixEffect(effects, def.effectKey, roll.value);
    }
  }
  return effects;
}

export function effectsForAffixRolls(
  rawAffixes: readonly AffixRollInput[] | null | undefined,
  rarity?: GearRarity | null,
): GearEffectManifest {
  const effects = { ...defaultGearEffects };
  addAffixRollEffects(effects, rawAffixes, rarity);
  return effects;
}

function normalizedAffixValue(
  value: number,
  definition: GearAffixDefinition,
  rarity?: GearRarity | null,
): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const rounded = Math.round(value);
  const range = rarity ? definition.roll[rarity] : undefined;
  return range ? clamp(rounded, range.min, range.max) : rounded;
}

// Save repair, effect aggregation, and tooltips must accept the same rolls.
// Visit directly so aggregation does not need an intermediate roll array.
function forEachNormalizedAffixRoll(
  rawAffixes: readonly AffixRollInput[] | null | undefined,
  rarity: GearRarity | null | undefined,
  visit: (definition: GearAffixDefinition, value: number) => void,
): void {
  if (!Array.isArray(rawAffixes)) return;
  // Array.isArray narrows readonly arrays to any[]; retain the input element contract.
  const entries = rawAffixes as readonly AffixRollInput[];
  for (const entry of entries) {
    if (!entry || !isGearAffixId(entry.id)) continue;
    const definition = gearAffixCatalog[entry.id];
    const value = normalizedAffixValue(entry.value, definition, rarity);
    if (value !== null) visit(definition, value);
  }
}

/** Internal gear aggregation: normalize into a newly owned manifest without temporary roll arrays. */
export function addAffixRollEffects(
  effects: GearEffectManifest,
  rawAffixes: readonly AffixRollInput[] | null | undefined,
  rarity?: GearRarity | null,
): void {
  forEachNormalizedAffixRoll(rawAffixes, rarity, (definition, value) => {
    addAffixEffect(effects, definition.effectKey, value);
  });
}

export function normalizeAffixRolls(
  rawAffixes?: readonly AffixRollInput[] | null,
  rarity?: GearRarity | null,
): GearAffixRoll[] {
  const rolls: GearAffixRoll[] = [];
  forEachNormalizedAffixRoll(rawAffixes, rarity, (definition, value) => {
    rolls.push({ id: definition.id, value });
  });
  return rolls;
}

export function rollAffixValue(def: GearAffixDefinition, rarity: GearRarity, rng: () => number): number {
  const range = def.roll[rarity];
  const span = range.max - range.min + 1;
  return range.min + rngInt(rng, span);
}

export function getGearAffixTooltipEntries(
  affixes: readonly GearAffixRoll[],
  rarity?: GearRarity | null,
): Array<{ key: string; name: string; text: string; affixId: GearAffixId; value: number }> {
  const entries: ReturnType<typeof getGearAffixTooltipEntries> = [];
  forEachNormalizedAffixRoll(affixes, rarity, (definition, value) => {
    entries.push({
      key: `${definition.id}-${entries.length}`,
      affixId: definition.id,
      value,
      name: definition.name,
      text: formatAffixDescription(definition.descriptionTemplate, value),
    });
  });
  return entries;
}

export function affixMatchesAffinity(def: GearAffixDefinition, affinityKeywords: readonly string[]): boolean {
  return (
    affinityKeywords.includes(def.keywordId) ||
    (def.secondaryKeywordId !== undefined && affinityKeywords.includes(def.secondaryKeywordId))
  );
}

export function getGearInstanceAffixes(instance: GearInstance): ReadonlyArray<Readonly<GearAffixRoll>> {
  return getUniqueAffixView(instance.definitionId) ?? instance.affixes;
}

export function getGearInstanceTooltipEntries(
  instance: GearInstance,
): Array<{ key: string; name?: string; text: string; affixId?: GearAffixId; value?: number }> {
  const definition = gearDefinitions[instance.definitionId];
  const affixEntries = getGearAffixTooltipEntries(getGearInstanceAffixes(instance), definition?.rarity);
  if (affixEntries.length > 0) return affixEntries;
  return (definition?.descriptionLines ?? []).map((text, index) => ({ key: `definition-${index}`, text }));
}
