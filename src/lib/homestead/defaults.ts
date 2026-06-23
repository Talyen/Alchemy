// Default homestead effect manifest — all zeros/false. Used as the base state
// before applying building/farm/research bonuses from computeHomesteadEffects.
import { defaultCompanionBondLevels } from "@/lib/game-data/companions";
import type { HomesteadEffectManifest } from "./types";

export const defaultHomesteadEffects: HomesteadEffectManifest = {
  flatPhysicalDamage: 0,
  companionDamage: 0,
  companionBondLevels: { ...defaultCompanionBondLevels },
  potionPotency: 0,
  herbFindBonus: 0,
  endRunFoodPerRoom: 0,
  endRunHerbsPerRoom: 0,
  endRunCrystalPerRoom: 0,
  forgeToBurn: false,
  flatBurnDamage: 0,
  flatArrowDamage: 0,
  flatFreezeDamage: 0,
  flatNatureDamage: 0,
  wishCrystalGold: 0,
  startMana: 0,
  consumeHealMultiplier: 0,
  potionMixPotency: 0,
  gearAstralChanceBonus: 0,
  burnDamageReduction: 0,
  freezeDamageReduction: 0,
  natureDamageReduction: 0,
  poisonDamageReduction: 0,
  runMaxHealthBonus: 0,
  runMaxManaBonus: 0,
  cardHealBonus: {},
};
