import type { GearEffectManifest } from "./types";

export const GEAR_EFFECT_KEYS = [
  "flatPhysicalDamage",
  "flatStunDamage",
  "flatHolyDamage",
  "flatBurnDamage",
  "flatPoisonDamage",
  "flatBleedDamage",
  "flatFreezeDamage",
  "flatNatureDamage",
] as const satisfies readonly (keyof GearEffectManifest)[];

export function mergeGearEffectManifests(base: GearEffectManifest, addition: GearEffectManifest): GearEffectManifest {
  const merged = { ...base };
  for (const key of GEAR_EFFECT_KEYS) {
    merged[key] = base[key] + addition[key];
  }
  return merged;
}

export function subtractGearEffectManifests(
  total: GearEffectManifest,
  subtract: GearEffectManifest,
): GearEffectManifest {
  const remainder = { ...total };
  for (const key of GEAR_EFFECT_KEYS) {
    remainder[key] = Math.max(0, total[key] - subtract[key]);
  }
  return remainder;
}
