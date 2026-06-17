export type GearEffectManifest = {
  flatPhysicalDamage: number;
  flatStunDamage: number;
  flatHolyDamage: number;
  flatBurnDamage: number;
  flatPoisonDamage: number;
  flatBleedDamage: number;
  flatFreezeDamage: number;
  flatNatureDamage: number;
  flatArrowDamage: number;
  startBlock: number;
  startArmor: number;
  startForge: number;
  startHeal: number;
  startFreeze: number;
  maxHealth: number;
  armorPiercing: number;
  burnDamagePerManaPercent: number;
  holyDamageFromBlockPercent: number;
  holyDamageFromGoldPercent: number;
  frozenEnemyDamageBonusPercent: number;
  flatBlockGained: number;
  consumeHealBonusPercent: number;
  leechHealBonusPercent: number;
  goldGainPercent: number;
  companionDamageBonus: number;
  companionBenefitsFromForge: number;
  resistPhysical: number;
  resistStun: number;
  resistHoly: number;
  resistBurn: number;
  resistPoison: number;
  resistBleed: number;
  resistFreeze: number;
  resistNature: number;
  healthPerTurn: number;
  damageOnStunPhysical: number;
  forgeOnStun: number;
  blockOnStun: number;
  manaOnStun: number;
  poisonLeechChance: number;
  natureLeechChance: number;
  physicalBleedChance: number;
  physicalStunChance: number;
  goldOnWish: number;
  burnOnWish: number;
  drawOnWish: number;
  healthOnWish: number;
  manaOnWish: number;
  healOnKill: number;
  goldOnKill: number;
  forgeOnBurnDealt: number;
  damageOnFreezePhysical: number;
  blockDepletedHeal: number;
};

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
] as const satisfies readonly (keyof GearEffectManifest)[];

export const defaultGearEffects: GearEffectManifest = Object.fromEntries(
  GEAR_EFFECT_KEYS.map((key) => [key, 0]),
) as GearEffectManifest;
