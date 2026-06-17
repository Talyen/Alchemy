import { GEAR_EFFECT_KEYS, type GearEffectManifest } from "./gear-effect-manifest";

export { GEAR_EFFECT_KEYS, defaultGearEffects, type GearEffectManifest } from "./gear-effect-manifest";

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
