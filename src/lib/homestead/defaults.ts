// Default homestead effect manifest — all zeros/false. Used as the base state
// before applying building/farm/research bonuses from computeHomesteadEffects.
import type { HomesteadEffectManifest } from "./types";

export const defaultHomesteadEffects: HomesteadEffectManifest = {
  flatPhysicalDamage: 0,
  companionDamage: 0,
  companionBondLevels: { wolf: 0, "lizard-scout": 0, imp: 0, "frost-whelp": 0, bear: 0, panther: 0, phoenix: 0 },
  potionHealMultiplier: 0,
  potionDiscount: 0,
  potionPotency: 0,
  herbFindBonus: 0,
  startGold: 0,
  startBlock: 0,
  campfireHealBonus: 0,
  physicalCritChance: 0,
  startMaxHealthBonus: 0,
  forgeToBurn: false,
  flatBurnDamage: 0,
  flatArrowDamage: 0,
  flatFreezeDamage: 0,
  flatNatureDamage: 0,
  wishCrystalGold: 0,
  startMana: 0,
  consumeHealMultiplier: 0,
  potionMixPotency: 0,
  trinketChanceBonus: 0,
  burnDamageReduction: 0,
  freezeDamageReduction: 0,
  natureDamageReduction: 0,
};
