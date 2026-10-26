const neutralTrinketEffects = {
  extraDrawPerBattle: 0,
  brassCenserProcChance: 0,
  firstBurnDoubled: false,
  boneCharmHealOnKill: 0,
  forgeStunThreshold: 0,
  forgeStunAmount: 0,
  frozenHeartDamage: 0,
  ironwoodBucklerThornsOnBlock: 0,
  runicQuillDrawOnConsume: 0,
  sinEaterHealOnHarmfulStatusRemove: 0,
  vanguardCrestForgeOnBlockAbsorb: 0,
  parasiticBloomLeechChance: 0,
  cutpurseGoldChance: 0,
  wishingWellGoldOnWish: 0,
  plagueDoctorPoisonCleanse: 0,
  mortarPestlePoisonOnPotionUse: 0,
  sunderingArmorPiercing: 0,
  resonantChimeCardsRequired: 0,
  resonantChimeMana: 0,
  smugglersMapGoldBonus: 0,
  grovesFavorThornsOnHealthRestore: 0,
  merchantsFavorDiscount: 0,
  companionDamageBonus: 0,
  freezeDurationExtension: 0,
  thunderstoneDamageOnStun: 0,
  luckyCloverGoldChance: 0,
};

export type TrinketManifest = typeof neutralTrinketEffects;

export const defaultTrinketEffects: Readonly<TrinketManifest> = Object.freeze(neutralTrinketEffects);
