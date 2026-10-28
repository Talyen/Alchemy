import { gearAffixRows, type GearAffixEffectKey } from "./affix-rows";
import { createNumericManifest } from "@/lib/manifest-utils";

// Independent-roll policies own list aggregation; every other effect sums.
// Chance keys are the effect keys ending in "Chances", derived here so a new
// row cannot silently aggregate as a numeric bonus. (A regex keeps the suffix
// out of the localization extractor, which claims capitalized string literals.)
const CHANCE_EFFECT_KEY_PATTERN = /Chances$/;
const authoredEffectKeys = [...new Set(gearAffixRows.map((affix) => affix.effectKey))];
export const GEAR_CHANCE_EFFECT_KEYS = Object.freeze(
  authoredEffectKeys.filter((key): key is Extract<GearAffixEffectKey, `${string}Chances`> =>
    CHANCE_EFFECT_KEY_PATTERN.test(key),
  ),
);

export const GEAR_NUMERIC_EFFECT_KEYS = Object.freeze(
  authoredEffectKeys.filter(
    (key): key is Exclude<GearAffixEffectKey, GearChanceEffectKey> => !CHANCE_EFFECT_KEY_PATTERN.test(key),
  ),
);
export const GEAR_EFFECT_KEYS = Object.freeze([...GEAR_NUMERIC_EFFECT_KEYS, ...GEAR_CHANCE_EFFECT_KEYS]);

export type GearChanceEffectKey = (typeof GEAR_CHANCE_EFFECT_KEYS)[number];

export type GearEffectManifest = {
  [K in (typeof GEAR_NUMERIC_EFFECT_KEYS)[number]]: number;
} & { [K in GearChanceEffectKey]: number[] };

const numericDefaults = createNumericManifest(GEAR_NUMERIC_EFFECT_KEYS);

function emptyChanceLists(): Record<GearChanceEffectKey, number[]> {
  const lists = {} as Record<GearChanceEffectKey, number[]>;
  for (const key of GEAR_CHANCE_EFFECT_KEYS) lists[key] = [];
  return lists;
}

export function createEmptyGearEffectManifest(): GearEffectManifest {
  return {
    ...numericDefaults,
    ...emptyChanceLists(),
  };
}

export const defaultGearEffects = createEmptyGearEffectManifest();
