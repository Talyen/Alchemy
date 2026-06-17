import type { GearAffixId } from "./affix-ids";
import { LEGACY_GEAR_AFFIX_IDS } from "./affix-ids";
import { gearAffixCatalog, type GearAffixDefinition } from "./affix-catalog";
import type { GearEffectManifest } from "./gear-effect-manifest";
import { defaultGearEffects } from "./gear-effect-manifest";
import type { GearAffixRoll, GearRarity } from "./types";

const LEGACY_AFFIX_MAP: Record<(typeof LEGACY_GEAR_AFFIX_IDS)[number], GearAffixId> = {
  "flat-physical-1": "flat-physical",
  "flat-stun-1": "flat-stun",
  "flat-holy-1": "flat-holy",
  "flat-burn-1": "flat-burn",
  "flat-poison-1": "flat-poison",
  "flat-bleed-1": "flat-bleed",
  "flat-freeze-1": "flat-freeze",
  "flat-nature-1": "flat-nature",
};

function isGearAffixId(value: string): value is GearAffixId {
  return value in gearAffixCatalog;
}

function scaleAffixValue(rollValue: number, rarity: GearRarity, def: GearAffixDefinition): number {
  return Math.max(0, Math.round(rollValue * def.rarityScale[rarity]));
}

function formatAffixDescription(def: GearAffixDefinition, roll: GearAffixRoll, rarity: GearRarity): string {
  const scaledValue = scaleAffixValue(roll.value, rarity, def);
  return def.descriptionTemplate.replace("{value}", String(scaledValue));
}

export function resolveAffixEffects(affixes: readonly GearAffixRoll[], rarity: GearRarity): GearEffectManifest {
  const effects = { ...defaultGearEffects };
  for (const roll of affixes) {
    const def = gearAffixCatalog[roll.id];
    if (!def) continue;
    const scaledValue = scaleAffixValue(roll.value, rarity, def);
    effects[def.effectKey] += scaledValue;
  }
  return effects;
}

function isLegacyAffixId(id: string): id is (typeof LEGACY_GEAR_AFFIX_IDS)[number] {
  return id in LEGACY_AFFIX_MAP;
}

function normalizeLegacyAffixId(id: string): GearAffixId | null {
  if (isGearAffixId(id)) return id;
  if (isLegacyAffixId(id)) return LEGACY_AFFIX_MAP[id];
  return null;
}

export function normalizeAffixRolls(raw: {
  affixes?: { id: string; value: number }[];
  affixIds?: string[];
  modifiers?: { kind: string; value: number }[];
}): GearAffixRoll[] {
  if (raw.affixes && raw.affixes.length > 0) {
    return raw.affixes.flatMap((entry) => {
      const id = normalizeLegacyAffixId(entry.id);
      if (!id || !Number.isFinite(entry.value) || entry.value <= 0) return [];
      return [{ id, value: Math.round(entry.value) }];
    });
  }

  if (raw.affixIds && raw.affixIds.length > 0) {
    return raw.affixIds.flatMap((legacyId) => {
      const id = normalizeLegacyAffixId(legacyId);
      return id ? [{ id, value: 1 }] : [];
    });
  }

  return legacyFlatPhysicalModifiersToAffixRolls(raw.modifiers ?? []);
}

export function legacyFlatPhysicalModifiersToAffixRolls(modifiers: { kind: string; value: number }[]): GearAffixRoll[] {
  const rolls: GearAffixRoll[] = [];
  for (const modifier of modifiers) {
    if (modifier.kind !== "flatPhysicalDamage" || !Number.isFinite(modifier.value)) continue;
    const count = Math.max(0, Math.round(modifier.value));
    for (let index = 0; index < count; index += 1) {
      rolls.push({ id: "flat-physical", value: 1 });
    }
  }
  return rolls;
}

export function rollAffixValue(def: GearAffixDefinition, rng: () => number): number {
  const span = def.roll.max - def.roll.min + 1;
  return def.roll.min + Math.floor(rng() * span);
}

export function getGearAffixDescriptionLines(
  affixes: readonly GearAffixRoll[],
  rarity: GearRarity,
): { key: string; text: string }[] {
  return affixes.flatMap((roll, index) => {
    const def = gearAffixCatalog[roll.id];
    if (!def) return [];
    return [{ key: `${roll.id}-${index}`, text: formatAffixDescription(def, roll, rarity) }];
  });
}

export function affixMatchesAffinity(def: GearAffixDefinition, affinityKeywords: readonly string[]): boolean {
  return (
    affinityKeywords.includes(def.keywordId) ||
    (def.secondaryKeywordId !== undefined && affinityKeywords.includes(def.secondaryKeywordId))
  );
}
