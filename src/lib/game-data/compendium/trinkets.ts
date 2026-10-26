import { getCatalogArt } from "../assets";
import { trinket } from "../compendium-builders";
import type { TrinketManifest } from "../trinket-manifest";

function defineTrinket<Id extends string, Effects extends Partial<TrinketManifest>>(
  id: Id,
  title: string,
  effects: Effects,
  describe: (effects: Effects) => string,
) {
  return {
    entry: trinket(id, title, describe(effects), getCatalogArt(id), effects),
    describe: (values: Partial<TrinketManifest>) => describe(values as Effects),
  };
}

const trinketDefinitions = [
  defineTrinket(
    "brass-censer",
    "Brass Censer",
    { brassCenserProcChance: 20 },
    (effects) => `Holy damage has a ${effects.brassCenserProcChance}% chance to also Burn or Leech`,
  ),
  defineTrinket(
    "tattered-pages",
    "Tattered Pages",
    { extraDrawPerBattle: 1 },
    (effects) => `Draw ${effects.extraDrawPerBattle} at the start of combat`,
  ),
  defineTrinket(
    "meteorite",
    "Meteorite",
    { firstBurnDoubled: true },
    () => "Your first Burn card hit each combat is doubled",
  ),
  defineTrinket(
    "bone-charm",
    "Bone Charm",
    { boneCharmHealOnKill: 3 },
    (effects) => `Restore ${effects.boneCharmHealOnKill} Health when you defeat an enemy`,
  ),
  defineTrinket(
    "obsidian-hammer",
    "Obsidian Hammer",
    { forgeStunThreshold: 5, forgeStunAmount: 2 },
    (effects) =>
      `At ${effects.forgeStunThreshold} or more Forge, your first damaging Physical hit each turn deals ${effects.forgeStunAmount} additional Stun damage`,
  ),
  defineTrinket(
    "icy-heart",
    "Icy Heart",
    { frozenHeartDamage: 6 },
    (effects) => `When you Freeze an enemy, deal ${effects.frozenHeartDamage} Physical damage`,
  ),
  defineTrinket(
    "ironwood-buckler",
    "Ironwood Buckler",
    { ironwoodBucklerThornsOnBlock: 1 },
    (effects) => `Gain ${effects.ironwoodBucklerThornsOnBlock} Thorns when you gain Block`,
  ),
  defineTrinket(
    "runic-quill",
    "Runic Quill",
    { runicQuillDrawOnConsume: 1 },
    (effects) => `Draw ${effects.runicQuillDrawOnConsume} when you Consume`,
  ),
  defineTrinket(
    "sin-eaters-lantern",
    "Sin-Eater's Lantern",
    { sinEaterHealOnHarmfulStatusRemove: 6 },
    (effects) => `Gain ${effects.sinEaterHealOnHarmfulStatusRemove} Health when you remove a harmful status effect`,
  ),
  defineTrinket(
    "vanguards-crest",
    "Vanguard's Crest",
    { vanguardCrestForgeOnBlockAbsorb: 1 },
    (effects) =>
      `Once per turn, gain ${effects.vanguardCrestForgeOnBlockAbsorb} Forge when your Block fully absorbs an attack`,
  ),
  defineTrinket(
    "parasitic-bloom",
    "Parasitic Bloom",
    { parasiticBloomLeechChance: 10 },
    (effects) => `Poison has a ${effects.parasiticBloomLeechChance}% chance to Leech`,
  ),
  defineTrinket(
    "cutpurse-knife",
    "Cutpurse Knife",
    { cutpurseGoldChance: 10 },
    (effects) => `Bleed damage has a ${effects.cutpurseGoldChance}% chance to steal Gold`,
  ),
  defineTrinket(
    "wishing-well-coin",
    "Wishing Well Coin",
    { wishingWellGoldOnWish: 3 },
    (effects) => `When you Wish, also gain ${effects.wishingWellGoldOnWish} Gold`,
  ),
  defineTrinket(
    "merchants-favor",
    "Merchant's Favor",
    { merchantsFavorDiscount: 7 },
    (effects) => `Your first purchase at each shop costs ${effects.merchantsFavorDiscount} less Gold`,
  ),
  defineTrinket(
    "plague-doctors-mask",
    "Plague Doctor's Mask",
    { plagueDoctorPoisonCleanse: 2 },
    (effects) =>
      `At the start of your turn, Cleanse up to ${effects.plagueDoctorPoisonCleanse} Poison and deal half the amount cleansed as Poison damage`,
  ),
  defineTrinket(
    "mortar-and-pestle",
    "Mortar and Pestle",
    { mortarPestlePoisonOnPotionUse: 1 },
    (effects) => `Deal ${effects.mortarPestlePoisonOnPotionUse} Poison damage when you use a Potion`,
  ),
  defineTrinket(
    "sundering-charm",
    "Sundering Charm",
    { sunderingArmorPiercing: 2 },
    (effects) => `Your Physical and Stun damage removes ${effects.sunderingArmorPiercing} enemy Armor`,
  ),
  defineTrinket(
    "resonant-chimes",
    "Resonant Chimes",
    { resonantChimeCardsRequired: 3, resonantChimeMana: 1 },
    (effects) =>
      `When you play ${effects.resonantChimeCardsRequired} or more cards in a single turn, gain ${effects.resonantChimeMana} Mana`,
  ),
  defineTrinket(
    "smugglers-map",
    "Smuggler's Map",
    { smugglersMapGoldBonus: 2 },
    (effects) => `Gold rewards from combat are increased by ${effects.smugglersMapGoldBonus}`,
  ),
  defineTrinket(
    "groves-favor",
    "Grove's Favor",
    { grovesFavorThornsOnHealthRestore: 1 },
    (effects) => `Gain ${effects.grovesFavorThornsOnHealthRestore} Thorns when you restore Health`,
  ),
  defineTrinket(
    "companions-collar",
    "Companion's Collar",
    { companionDamageBonus: 1 },
    (effects) => `Increases Companion damage by ${effects.companionDamageBonus}`,
  ),
  defineTrinket(
    "frozen-pocketwatch",
    "Frozen Pocketwatch",
    { freezeDurationExtension: 1 },
    (effects) => `Freeze effects last ${effects.freezeDurationExtension} turn longer`,
  ),
  defineTrinket(
    "thunderstone",
    "Thunderstone",
    { thunderstoneDamageOnStun: 6 },
    (effects) => `When you Stun an enemy, deal ${effects.thunderstoneDamageOnStun} Nature damage`,
  ),
  defineTrinket(
    "lucky-clover",
    "Lucky Clover",
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
