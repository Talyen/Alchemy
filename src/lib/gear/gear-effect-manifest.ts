import { gearAffixRows, type GearAffixEffectKey } from "./affix-rows";
import { createNumericManifest } from "@/lib/manifest-utils";

export const GEAR_CHANCE_EFFECT_KEYS = [
  "forgeOnStunChances",
  "forgeOnBurnVsUnburnedChances",
  "forgeOnConsumeBurnCardChances",
  "forgeOnCompanionDamageVsBurningChances",
] as const satisfies readonly GearAffixEffectKey[];

export const GEAR_NUMERIC_EFFECT_KEYS = [...new Set(gearAffixRows.map((affix) => affix.effectKey))].filter(
  (key): key is Exclude<GearAffixEffectKey, GearChanceEffectKey> =>
    !(GEAR_CHANCE_EFFECT_KEYS as readonly string[]).includes(key),
);
export const GEAR_EFFECT_KEYS = [...GEAR_NUMERIC_EFFECT_KEYS, ...GEAR_CHANCE_EFFECT_KEYS];

export type GearChanceEffectKey = (typeof GEAR_CHANCE_EFFECT_KEYS)[number];

export type GearEffectManifest = {
  [K in (typeof GEAR_NUMERIC_EFFECT_KEYS)[number]]: number;
} & { [K in GearChanceEffectKey]: number[] };

const numericDefaults = createNumericManifest(GEAR_NUMERIC_EFFECT_KEYS);

export function createEmptyGearEffectManifest(): GearEffectManifest {
  return {
    ...numericDefaults,
    forgeOnStunChances: [],
    forgeOnBurnVsUnburnedChances: [],
    forgeOnConsumeBurnCardChances: [],
    forgeOnCompanionDamageVsBurningChances: [],
  };
}

export const defaultGearEffects = createEmptyGearEffectManifest();
