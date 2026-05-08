import type { TrinketManifest } from "./battle/types";

export const defaultTrinketEffects: TrinketManifest = {
  extraDrawPerBattle: 0,
  firstHolyDamageBonus: 0,
  firstBurnDoubled: false,
  boneCharmHealOnKill: 0,
  forgeStunThreshold: 0,
  forgeStunAmount: 0,
  frozenHeartDamage: 0,
  blockToArmorThreshold: 0,
  blockToArmorAmount: 0,
  runicQuillDrawOnConsume: 0,
  sinEaterGoldOnAilmentRemove: 0,
  vanguardCrestForgeOnBlockAbsorb: 0,
  parasiticBloomHealPerPoisonTick: 0,
  cutpurseGoldOnBleed: 0,
  wishingWellGoldOnWish: 0,
  plagueDoctorImmunity: false,
  mortarPestleFreeFirstPotion: false,
  sunderingArmorPiercing: 0,
  resonantChimeCardsRequired: 0,
  resonantChimeMana: 0,
  smugglersMapGoldBonus: 0,
  grovesFavorStartHeal: 0,
};

export function computeTrinketManifest(trinketIds: string[]): TrinketManifest {
  const manifest = { ...defaultTrinketEffects };

  for (const id of trinketIds) {
    switch (id) {
      case "brass-censer":
        manifest.firstHolyDamageBonus = 2;
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
        manifest.frozenHeartDamage = 3;
        break;
      case "ironwood-buckler":
        manifest.blockToArmorThreshold = 6;
        manifest.blockToArmorAmount = 1;
        break;
      case "runic-quill":
        manifest.runicQuillDrawOnConsume = 1;
        break;
      case "sin-eaters-lantern":
        manifest.sinEaterGoldOnAilmentRemove = 1;
        break;
      case "vanguards-crest":
        manifest.vanguardCrestForgeOnBlockAbsorb = 1;
        break;
      case "parasitic-bloom":
        manifest.parasiticBloomHealPerPoisonTick = 1;
        break;
      case "cutpurse-knife":
        manifest.cutpurseGoldOnBleed = 1;
        break;
      case "wishing-well-coin":
        manifest.wishingWellGoldOnWish = 3;
        break;
      case "merchants-favor":
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
    }
  }

  return manifest;
}
