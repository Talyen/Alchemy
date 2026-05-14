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

const trinketEffects: Record<string, Partial<TrinketManifest>> = {
  "brass-censer": { firstHolyDamageDoubled: true },
  "tattered-pages": { extraDrawPerBattle: 1 },
  "meteorite": { firstBurnDoubled: true },
  "bone-charm": { boneCharmHealOnKill: 3 },
  "obsidian-hammer": { forgeStunThreshold: 4, forgeStunAmount: 1 },
  "frozen-heart": { frozenHeartDamage: 6 },
  "ironwood-buckler": { blockToArmorThreshold: 6, blockToArmorAmount: 1 },
  "runic-quill": { runicQuillDrawOnConsume: 1 },
  "sin-eaters-lantern": { sinEaterHealOnHarmfulStatusRemove: 6 },
  "vanguards-crest": { vanguardCrestForgeOnBlockAbsorb: 1 },
  "parasitic-bloom": { parasiticBloomLeechChance: 10 },
  "cutpurse-knife": { cutpurseGoldOnBleed: 1 },
  "wishing-well-coin": { wishingWellGoldOnWish: 3 },
  "merchants-favor": { merchantsFavorDiscount: 7 },
  "plague-doctors-mask": { plagueDoctorImmunity: true },
  "mortar-and-pestle": { mortarPestleFreeFirstPotion: true },
  "sundering-charm": { sunderingArmorPiercing: 2 },
  "resonant-chime": { resonantChimeCardsRequired: 3, resonantChimeMana: 1 },
  "smugglers-map": { smugglersMapGoldBonus: 2 },
  "groves-favor": { grovesFavorStartHeal: 2 },
  "companions-collar": { companionDamageBonus: 1 },
  "polar-pendant": { freezeDurationExtension: 1 },
  "thunderstone": { thunderstoneDamageOnStun: 6 },
  "lucky-clover": { luckyCloverGoldChance: 10 },
};

export function computeTrinketManifest(trinketIds: string[]): TrinketManifest {
  const manifest = { ...defaultTrinketEffects };

  for (const id of trinketIds) {
    const effects = trinketEffects[id];
    if (effects) Object.assign(manifest, effects);
  }

  return manifest;
}
