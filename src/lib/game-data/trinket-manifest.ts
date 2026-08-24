// Authored combat knobs unlocked by Boons or equipped Trinkets. Content-owned here so each
// compendium row can carry its own effects; battle consumes the merged manifest.
export interface TrinketManifest {
  extraDrawPerBattle: number;
  firstHolyDamageDoubled: boolean;
  firstBurnDoubled: boolean;
  boneCharmHealOnKill: number;
  forgeStunThreshold: number;
  forgeStunAmount: number;
  frozenHeartDamage: number;
  blockToArmorThreshold: number;
  blockToArmorAmount: number;
  runicQuillDrawOnConsume: number;
  sinEaterHealOnHarmfulStatusRemove: number;
  vanguardCrestForgeOnBlockAbsorb: number;
  parasiticBloomLeechChance: number;
  cutpurseGoldOnBleed: number;
  wishingWellGoldOnWish: number;
  plagueDoctorImmunity: boolean;
  mortarPestleFreeFirstPotion: boolean;
  sunderingArmorPiercing: number;
  resonantChimeCardsRequired: number;
  resonantChimeMana: number;
  smugglersMapGoldBonus: number;
  grovesFavorStartHeal: number;
  merchantsFavorDiscount: number;
  companionDamageBonus: number;
  freezeDurationExtension: number;
  thunderstoneDamageOnStun: number;
  luckyCloverGoldChance: number;
}
