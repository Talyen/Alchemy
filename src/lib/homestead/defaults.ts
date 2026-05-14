// Default homestead effect manifest — all zeros/false. Used as the base state
// before applying building/farm/research bonuses from computeHomesteadEffects.
import type { HomesteadEffectManifest } from "./types";

export const defaultHomesteadEffects: HomesteadEffectManifest = {
  flatPhysicalDamage: 0,
  companionDamage: 0,
  potionHealMultiplier: 0,
  potionManaBonus: 0,
  potionDiscount: 0,
  startGold: 0,
  startBlock: 0,
  campfireHealBonus: 0,
  physicalCritChance: 0,
  startMaxHealthBonus: 0,
  forgeToBurn: false,
};
