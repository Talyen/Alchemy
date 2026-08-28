import * as assetRefs from "../assets";
import { trinket } from "../compendium-builders";

export const trinketLibrary = [
  trinket("brass-censer", "Brass Censer", "Your first Holy damage each combat is doubled.", assetRefs.brassCenser, {
    firstHolyDamageDoubled: true,
  }),
  trinket("tattered-pages", "Tattered Pages", "Draw 1 at the start of combat.", assetRefs.tatteredPages, {
    extraDrawPerBattle: 1,
  }),
  trinket("meteorite", "Meteorite", "Your first Burn damage each combat is doubled.", assetRefs.meteorite, {
    firstBurnDoubled: true,
  }),
  trinket("bone-charm", "Bone Charm", "Restore 3 Health when you defeat an enemy.", assetRefs.boneCharm, {
    boneCharmHealOnKill: 3,
  }),
  trinket(
    "obsidian-hammer",
    "Obsidian Hammer",
    "When you have 4 or more Forge, your Physical damage also deals 1 Stun damage.",
    assetRefs.obsidianHammer,
    { forgeStunThreshold: 4, forgeStunAmount: 1 },
  ),
  trinket("icy-heart", "Icy Heart", "When you Freeze an enemy, deal 6 Physical damage.", assetRefs.icyHeart, {
    frozenHeartDamage: 6,
  }),
  trinket(
    "ironwood-buckler",
    "Ironwood Buckler",
    "At the end of your turn, if you have 6 or more Block, gain 1 Armor.",
    assetRefs.ironwoodBuckler,
    { blockToArmorThreshold: 6, blockToArmorAmount: 1 },
  ),
  trinket("runic-quill", "Runic Quill", "Draw 1 when you Consume.", assetRefs.runicQuill, {
    runicQuillDrawOnConsume: 1,
  }),
  trinket(
    "sin-eaters-lantern",
    "Sin-Eater's Lantern",
    "Gain 6 Health when you remove a harmful status effect.",
    assetRefs.sinEatersLantern,
    { sinEaterHealOnHarmfulStatusRemove: 6 },
  ),
  trinket(
    "vanguards-crest",
    "Vanguard's Crest",
    "When your Block fully absorbs an attack, gain 1 Forge.",
    assetRefs.vanguardsCrest,
    { vanguardCrestForgeOnBlockAbsorb: 1 },
  ),
  trinket("parasitic-bloom", "Parasitic Bloom", "Poison has a 10% chance to Leech.", assetRefs.parasiticBloom, {
    parasiticBloomLeechChance: 10,
  }),
  trinket(
    "cutpurse-knife",
    "Cutpurse Knife",
    "When you apply Bleed to an enemy, gain 1 Gold.",
    assetRefs.cutpurseKnife,
    { cutpurseGoldOnBleed: 1 },
  ),
  trinket("wishing-well-coin", "Wishing Well Coin", "When you Wish, also gain 3 Gold.", assetRefs.wishingWellCoin, {
    wishingWellGoldOnWish: 3,
  }),
  trinket(
    "merchants-favor",
    "Merchant's Favor",
    "Your first purchase at each shop costs 7 less Gold.",
    assetRefs.merchantsFavor,
    { merchantsFavorDiscount: 7 },
  ),
  trinket(
    "plague-doctors-mask",
    "Plague Doctor's Mask",
    "You are immune to the first harmful status effect you would receive each combat.",
    assetRefs.plagueDoctorsMask,
    { plagueDoctorImmunity: true },
  ),
  trinket(
    "mortar-and-pestle",
    "Mortar and Pestle",
    "The first Potion you play each combat is free.",
    assetRefs.mortarAndPestle,
    { mortarPestleFreeFirstPotion: true },
  ),
  trinket(
    "sundering-charm",
    "Sundering Charm",
    "Your Physical and Stun damage removes 2 enemy Armor.",
    assetRefs.sunderingCharm,
    { sunderingArmorPiercing: 2 },
  ),
  trinket(
    "resonant-chimes",
    "Resonant Chimes",
    "When you play 3 or more cards in a single turn, gain 1 Mana.",
    assetRefs.resonantChimes,
    { resonantChimeCardsRequired: 3, resonantChimeMana: 1 },
  ),
  trinket("smugglers-map", "Smuggler's Map", "Gold rewards from combat are increased by 2.", assetRefs.smugglersMap, {
    smugglersMapGoldBonus: 2,
  }),
  trinket("groves-favor", "Grove's Favor", "Restore 2 Health at the start of combat.", assetRefs.grovesFavor, {
    grovesFavorStartHeal: 2,
  }),
  trinket("companions-collar", "Companion's Collar", "Increases Companion damage by 1.", assetRefs.companionsCollar, {
    companionDamageBonus: 1,
  }),
  trinket(
    "frozen-pocketwatch",
    "Frozen Pocketwatch",
    "Freeze effects last 1 turn longer.",
    assetRefs.frozenPocketwatch,
    { freezeDurationExtension: 1 },
  ),
  trinket("thunderstone", "Thunderstone", "When you Stun an enemy, deal 6 Nature damage.", assetRefs.thunderstone, {
    thunderstoneDamageOnStun: 6,
  }),
  trinket(
    "lucky-clover",
    "Lucky Clover",
    "Nature damage has a 10% chance to grant Gold equal to the damage dealt.",
    assetRefs.luckyClover,
    { luckyCloverGoldChance: 10 },
  ),
];
