// Boon manifest defaults and ID-to-effect conversion for run boons.
// Depends on the battle BoonManifest shape only.
// Used during battle creation and shop pricing so combat reads flat boon bonuses.
import type { BoonManifest } from "./battle/types";

export const defaultBoonEffects: BoonManifest = {
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

const boonEffects: Record<string, Partial<BoonManifest>> = {
  "brass-censer": { firstHolyDamageDoubled: true },
  "tattered-pages": { extraDrawPerBattle: 1 },
  meteorite: { firstBurnDoubled: true },
  "bone-charm": { boneCharmHealOnKill: 3 },
  "obsidian-hammer": { forgeStunThreshold: 4, forgeStunAmount: 1 },
  "icy-heart": { frozenHeartDamage: 6 },
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
  "resonant-chimes": { resonantChimeCardsRequired: 3, resonantChimeMana: 1 },
  "smugglers-map": { smugglersMapGoldBonus: 2 },
  "groves-favor": { grovesFavorStartHeal: 2 },
  "companions-collar": { companionDamageBonus: 1 },
  "frozen-pocketwatch": { freezeDurationExtension: 1 },
  thunderstone: { thunderstoneDamageOnStun: 6 },
  "lucky-clover": { luckyCloverGoldChance: 10 },
};

export function computeBoonManifest(boonIds: string[]): BoonManifest {
  const manifest = { ...defaultBoonEffects };

  for (const id of boonIds) {
    const effects = boonEffects[id];
    if (effects) Object.assign(manifest, effects);
  }

  return manifest;
}

export function isDefaultBoonManifest(manifest: BoonManifest): boolean {
  return (Object.keys(defaultBoonEffects) as (keyof BoonManifest)[]).every(
    (key) => manifest[key] === defaultBoonEffects[key],
  );
}
