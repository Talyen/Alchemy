// Trinket manifest defaults and ID-to-effect conversion for run trinkets.
// Depends on the battle TrinketManifest shape only.
// Used during battle creation and shop pricing so combat reads flat trinket bonuses.
import type { TrinketManifest } from "./battle";

export const defaultTrinketEffects: TrinketManifest = {
  extraDrawPerBattle: 0,
  firstHolyDamageDoubled: false,
  firstBurnDoubled: false,
  boneCharmHealOnKill: 0,
  forgeStunThreshold: 0,
  forgeStunAmount: 0,
  frozenHeartDamage: 0,
  blockToArmorThreshold: 0,
  blockToArmorAmount: 0,
  runicQuillDrawOnConsume: 0,
  sinEaterHealOnHarmfulStatusRemove: 0,
  vanguardCrestForgeOnBlockAbsorb: 0,
  parasiticBloomLeechChance: 0,
  cutpurseGoldOnBleed: 0,
  wishingWellGoldOnWish: 0,
  plagueDoctorImmunity: false,
  mortarPestleFreeFirstPotion: false,
  sunderingArmorPiercing: 0,
  resonantChimeCardsRequired: 0,
  resonantChimeMana: 0,
  smugglersMapGoldBonus: 0,
  grovesFavorStartHeal: 0,
  merchantsFavorDiscount: 0,
  companionDamageBonus: 0,
  freezeDurationExtension: 0,
  thunderstoneDamageOnStun: 0,
  luckyCloverGoldChance: 0,
};

export function computeTrinketManifest(trinketIds: string[]): TrinketManifest {
  const manifest = { ...defaultTrinketEffects };

  for (const id of trinketIds) {
    switch (id) {
      case "brass-censer":
        manifest.firstHolyDamageDoubled = true;
        break;
      case "tattered-pages":
        manifest.extraDrawPerBattle = 1;
        break;
      case "meteorite":
        manifest.firstBurnDoubled = true;
        break;
      case "bone-charm":
        manifest.boneCharmHealOnKill = 3;
        break;
      case "obsidian-hammer":
        manifest.forgeStunThreshold = 4;
        manifest.forgeStunAmount = 1;
        break;
      case "frozen-heart":
        manifest.frozenHeartDamage = 6;
        break;
      case "ironwood-buckler":
        manifest.blockToArmorThreshold = 6;
        manifest.blockToArmorAmount = 1;
        break;
      case "runic-quill":
        manifest.runicQuillDrawOnConsume = 1;
        break;
      case "sin-eaters-lantern":
        manifest.sinEaterHealOnHarmfulStatusRemove = 6;
        break;
      case "vanguards-crest":
        manifest.vanguardCrestForgeOnBlockAbsorb = 1;
        break;
      case "parasitic-bloom":
        manifest.parasiticBloomLeechChance = 10;
        break;
      case "cutpurse-knife":
        manifest.cutpurseGoldOnBleed = 1;
        break;
      case "wishing-well-coin":
        manifest.wishingWellGoldOnWish = 3;
        break;
      case "merchants-favor":
        manifest.merchantsFavorDiscount = 7;
        break;
      case "plague-doctors-mask":
        manifest.plagueDoctorImmunity = true;
        break;
      case "mortar-and-pestle":
        manifest.mortarPestleFreeFirstPotion = true;
        break;
      case "sundering-charm":
        manifest.sunderingArmorPiercing = 2;
        break;
      case "resonant-chime":
        manifest.resonantChimeCardsRequired = 3;
        manifest.resonantChimeMana = 1;
        break;
      case "smugglers-map":
        manifest.smugglersMapGoldBonus = 2;
        break;
      case "groves-favor":
        manifest.grovesFavorStartHeal = 2;
        break;
      case "companions-collar":
        manifest.companionDamageBonus = 1;
        break;
      case "polar-pendant":
        manifest.freezeDurationExtension = 1;
        break;
      case "thunderstone":
        manifest.thunderstoneDamageOnStun = 6;
        break;
      case "lucky-clover":
        manifest.luckyCloverGoldChance = 10;
        break;
    }
  }

  return manifest;
}
