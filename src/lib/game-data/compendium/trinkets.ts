import * as assetRefs from "../assets";
import { trinket } from "../compendium-builders";
import type { TrinketManifest } from "../trinket-manifest";

function defineTrinket<Id extends string, Effects extends Partial<TrinketManifest>>(
  id: Id,
  title: string,
  art: string,
  effects: Effects,
  describe: (effects: Effects) => string,
) {
  return {
    entry: trinket(id, title, describe(effects), art, effects),
    // Keep each formatter typed to its own authored effects; dispatch below
    // accepts the common manifest shape for content validation.
    describe: (values: Partial<TrinketManifest>) => describe(values as Effects),
  };
}

const trinketDefinitions = [
  defineTrinket(
    "brass-censer",
    "Brass Censer",
    assetRefs.brassCenser,
    { brassCenserProcChance: 20 },
    (effects) => `Holy damage has a ${effects.brassCenserProcChance}% chance to also Burn or Leech`,
  ),
  defineTrinket(
    "tattered-pages",
    "Tattered Pages",
    assetRefs.tatteredPages,
    { extraDrawPerBattle: 1 },
    (effects) => `Draw ${effects.extraDrawPerBattle} at the start of combat`,
  ),
  defineTrinket(
    "meteorite",
    "Meteorite",
    assetRefs.meteorite,
    { firstBurnDoubled: true },
    () => "Your first Burn damage each combat is doubled",
  ),
  defineTrinket(
    "bone-charm",
    "Bone Charm",
    assetRefs.boneCharm,
    { boneCharmHealOnKill: 3 },
    (effects) => `Restore ${effects.boneCharmHealOnKill} Health when you defeat an enemy`,
  ),
  defineTrinket(
    "obsidian-hammer",
    "Obsidian Hammer",
    assetRefs.obsidianHammer,
    { forgeStunThreshold: 5, forgeStunAmount: 2 },
    (effects) =>
      `At ${effects.forgeStunThreshold} or more Forge, your first damaging Physical hit each turn deals ${effects.forgeStunAmount} additional Stun damage`,
  ),
  defineTrinket(
    "icy-heart",
    "Icy Heart",
    assetRefs.icyHeart,
    { frozenHeartDamage: 6 },
    (effects) => `When you Freeze an enemy, deal ${effects.frozenHeartDamage} Physical damage`,
  ),
  defineTrinket(
    "ironwood-buckler",
    "Ironwood Buckler",
    assetRefs.ironwoodBuckler,
    { ironwoodBucklerThornsOnBlock: 1 },
    (effects) => `Gain ${effects.ironwoodBucklerThornsOnBlock} Thorns when you gain Block`,
  ),
  defineTrinket(
    "runic-quill",
    "Runic Quill",
    assetRefs.runicQuill,
    { runicQuillDrawOnConsume: 1 },
    (effects) => `Draw ${effects.runicQuillDrawOnConsume} when you Consume`,
  ),
  defineTrinket(
    "sin-eaters-lantern",
    "Sin-Eater's Lantern",
    assetRefs.sinEatersLantern,
    { sinEaterHealOnHarmfulStatusRemove: 6 },
    (effects) => `Gain ${effects.sinEaterHealOnHarmfulStatusRemove} Health when you remove a harmful status effect`,
  ),
  defineTrinket(
    "vanguards-crest",
    "Vanguard's Crest",
    assetRefs.vanguardsCrest,
    { vanguardCrestForgeOnBlockAbsorb: 1 },
    (effects) =>
      `Once per turn, gain ${effects.vanguardCrestForgeOnBlockAbsorb} Forge when your Block fully absorbs an attack`,
  ),
  defineTrinket(
    "parasitic-bloom",
    "Parasitic Bloom",
    assetRefs.parasiticBloom,
    { parasiticBloomLeechChance: 10 },
    (effects) => `Poison has a ${effects.parasiticBloomLeechChance}% chance to Leech`,
  ),
  defineTrinket(
    "cutpurse-knife",
    "Cutpurse Knife",
    assetRefs.cutpurseKnife,
    { cutpurseGoldOnBleed: 1 },
    (effects) => `Gain ${effects.cutpurseGoldOnBleed} Gold when you deal Bleed damage`,
  ),
  defineTrinket(
    "wishing-well-coin",
    "Wishing Well Coin",
    assetRefs.wishingWellCoin,
    { wishingWellGoldOnWish: 3 },
    (effects) => `When you Wish, also gain ${effects.wishingWellGoldOnWish} Gold`,
  ),
  defineTrinket(
    "merchants-favor",
    "Merchant's Favor",
    assetRefs.merchantsFavor,
    { merchantsFavorDiscount: 7 },
    (effects) => `Your first purchase at each shop costs ${effects.merchantsFavorDiscount} less Gold`,
  ),
  defineTrinket(
    "plague-doctors-mask",
    "Plague Doctor's Mask",
    assetRefs.plagueDoctorsMask,
    { plagueDoctorPoisonCleanse: 2 },
    (effects) =>
      `At the start of your turn, Cleanse up to ${effects.plagueDoctorPoisonCleanse} Poison and deal half the amount cleansed as Poison damage`,
  ),
  defineTrinket(
    "mortar-and-pestle",
    "Mortar and Pestle",
    assetRefs.mortarAndPestle,
    { mortarPestlePoisonOnPotionUse: 1 },
    (effects) => `Deal ${effects.mortarPestlePoisonOnPotionUse} Poison damage when you use a Potion`,
  ),
  defineTrinket(
    "sundering-charm",
    "Sundering Charm",
    assetRefs.sunderingCharm,
    { sunderingArmorPiercing: 2 },
    (effects) => `Your Physical and Stun damage removes ${effects.sunderingArmorPiercing} enemy Armor`,
  ),
  defineTrinket(
    "resonant-chimes",
    "Resonant Chimes",
    assetRefs.resonantChimes,
    { resonantChimeCardsRequired: 3, resonantChimeMana: 1 },
    (effects) =>
      `When you play ${effects.resonantChimeCardsRequired} or more cards in a single turn, gain ${effects.resonantChimeMana} Mana`,
  ),
  defineTrinket(
    "smugglers-map",
    "Smuggler's Map",
    assetRefs.smugglersMap,
    { smugglersMapGoldBonus: 2 },
    (effects) => `Gold rewards from combat are increased by ${effects.smugglersMapGoldBonus}`,
  ),
  defineTrinket(
    "groves-favor",
    "Grove's Favor",
    assetRefs.grovesFavor,
    { grovesFavorThornsOnHealthRestore: 1 },
    (effects) => `Gain ${effects.grovesFavorThornsOnHealthRestore} Thorns when you restore Health`,
  ),
  defineTrinket(
    "companions-collar",
    "Companion's Collar",
    assetRefs.companionsCollar,
    { companionDamageBonus: 1 },
    (effects) => `Increases Companion damage by ${effects.companionDamageBonus}`,
  ),
  defineTrinket(
    "frozen-pocketwatch",
    "Frozen Pocketwatch",
    assetRefs.frozenPocketwatch,
    { freezeDurationExtension: 1 },
    (effects) => `Freeze effects last ${effects.freezeDurationExtension} turn longer`,
  ),
  defineTrinket(
    "thunderstone",
    "Thunderstone",
    assetRefs.thunderstone,
    { thunderstoneDamageOnStun: 6 },
    (effects) => `When you Stun an enemy, deal ${effects.thunderstoneDamageOnStun} Nature damage`,
  ),
  defineTrinket(
    "lucky-clover",
    "Lucky Clover",
    assetRefs.luckyClover,
    { luckyCloverGoldChance: 10 },
    (effects) =>
      `Nature damage has a ${effects.luckyCloverGoldChance}% chance to grant Gold equal to enemy Health lost`,
  ),
];

export const trinketLibrary = trinketDefinitions.map(({ entry }) => entry);
const trinketDefinitionsById = new Map<string, (typeof trinketDefinitions)[number]>(
  trinketDefinitions.map((definition) => [definition.entry.id, definition]),
);

/** The complete trigger and outcome, using the supplied balance values. */
export function describeTrinket(id: string, effects: Partial<TrinketManifest>): string | null {
  return trinketDefinitionsById.get(id)?.describe(effects) ?? null;
}
