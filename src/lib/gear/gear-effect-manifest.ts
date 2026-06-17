export const GEAR_EFFECT_KEYS = [
  "flatPhysicalDamage",
  "flatStunDamage",
  "flatHolyDamage",
  "flatBurnDamage",
  "flatPoisonDamage",
  "flatBleedDamage",
  "flatFreezeDamage",
  "flatNatureDamage",
  "flatArrowDamage",
  "startBlock",
  "startArmor",
  "startForge",
  "startHeal",
  "startFreeze",
  "maxHealth",
  "armorPiercing",
  "burnDamagePerManaPercent",
  "holyDamageFromBlockPercent",
  "holyDamageFromGoldPercent",
  "frozenEnemyDamageBonusPercent",
  "flatBlockGained",
  "consumeHealBonusPercent",
  "leechHealBonusPercent",
  "goldGainPercent",
  "companionDamageBonus",
  "companionBenefitsFromForge",
  "resistPhysical",
  "resistStun",
  "resistHoly",
  "resistBurn",
  "resistPoison",
  "resistBleed",
  "resistFreeze",
  "resistNature",
  "healthPerTurn",
  "damageOnStunPhysical",
  "forgeOnStun",
  "blockOnStun",
  "manaOnStun",
  "poisonLeechChance",
  "natureLeechChance",
  "physicalBleedChance",
  "physicalStunChance",
  "goldOnWish",
  "burnOnWish",
  "drawOnWish",
  "healthOnWish",
  "manaOnWish",
  "healOnKill",
  "goldOnKill",
  "forgeOnBurnDealt",
  "damageOnFreezePhysical",
  "blockDepletedHeal",
] as const;

export type GearEffectManifest = {
  [K in (typeof GEAR_EFFECT_KEYS)[number]]: number;
};

export const defaultGearEffects: GearEffectManifest = GEAR_EFFECT_KEYS.reduce((effects, key) => {
  effects[key] = 0;
  return effects;
}, {} as GearEffectManifest);

export function mergeGearEffectManifests(base: GearEffectManifest, addition: GearEffectManifest): GearEffectManifest {
  const merged = { ...base };
  for (const key of GEAR_EFFECT_KEYS) {
    merged[key] = base[key] + addition[key];
  }
  return merged;
}
