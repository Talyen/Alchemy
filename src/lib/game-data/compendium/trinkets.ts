// Trinket compendium definitions. Kept separate so boon content changes stay localized.
import * as assetRefs from "../assets";
import { trinket } from "../compendium-builders";

export const trinketLibrary = [
  trinket("brass-censer", "Brass Censer", "Your first Holy damage each combat is doubled.", assetRefs.brassCenser),
  trinket("tattered-pages", "Tattered Pages", "Draw 1 at the start of combat.", assetRefs.tatteredPages),
  trinket("meteorite", "Meteorite", "Your first Burn damage each combat is doubled.", assetRefs.meteorite),
  trinket("bone-charm", "Bone Charm", "Restore 3 Health when you defeat an enemy.", assetRefs.boneCharm),
  trinket(
    "obsidian-hammer",
    "Obsidian Hammer",
    "When you have 4 or more Forge, your Physical damage also applies 1 Stun.",
    assetRefs.obsidianHammer,
  ),
  trinket("icy-heart", "Icy Heart", "When you Freeze an enemy, deal 6 Physical damage.", assetRefs.icyHeart),
  trinket(
    "ironwood-buckler",
    "Ironwood Buckler",
    "At the end of your turn, if you have 6 or more Block, gain 1 Armor.",
    assetRefs.ironwoodBuckler,
  ),
  trinket("runic-quill", "Runic Quill", "Draw 1 when you Consume.", assetRefs.runicQuill),
  trinket(
    "sin-eaters-lantern",
    "Sin-Eater's Lantern",
    "Gain 6 Health when you remove a harmful status effect.",
    assetRefs.sinEatersLantern,
  ),
  trinket(
    "vanguards-crest",
    "Vanguard's Crest",
    "When your Block fully absorbs an attack, gain 1 Forge.",
    assetRefs.vanguardsCrest,
  ),
  trinket("parasitic-bloom", "Parasitic Bloom", "Poison has a 10% chance to Leech.", assetRefs.parasiticBloom),
  trinket(
    "cutpurse-knife",
    "Cutpurse Knife",
    "When you apply Bleed to an enemy, gain 1 Gold.",
    assetRefs.cutpurseKnife,
  ),
  trinket("wishing-well-coin", "Wishing Well Coin", "When you Wish, also gain 3 Gold.", assetRefs.wishingWellCoin),
  trinket(
    "merchants-favor",
    "Merchant's Favor",
    "Your first purchase at each shop costs 7 less Gold.",
    assetRefs.merchantsFavor,
  ),
  trinket(
    "plague-doctors-mask",
    "Plague Doctor's Mask",
    "You are immune to the first harmful status effect you would receive each combat.",
    assetRefs.plagueDoctorsMask,
  ),
  trinket(
    "mortar-and-pestle",
    "Mortar and Pestle",
    "The first Potion you play each combat is free.",
    assetRefs.mortarAndPestle,
  ),
  trinket(
    "sundering-charm",
    "Sundering Charm",
    "Your Physical and Stun damage removes 2 enemy Armor.",
    assetRefs.sunderingCharm,
  ),
  trinket(
    "resonant-chimes",
    "Resonant Chimes",
    "When you play 3 or more cards in a single turn, gain 1 Mana.",
    assetRefs.resonantChimes,
  ),
  trinket("smugglers-map", "Smuggler's Map", "Gold rewards from combat are increased by 2.", assetRefs.smugglersMap),
  trinket("groves-favor", "Grove's Favor", "Restore 2 Health at the start of combat.", assetRefs.grovesFavor),
  trinket("companions-collar", "Companion's Collar", "Increases Companion damage by 1.", assetRefs.companionsCollar),
  trinket(
    "frozen-pocketwatch",
    "Frozen Pocketwatch",
    "Freeze effects last 1 turn longer.",
    assetRefs.frozenPocketwatch,
  ),
  trinket("thunderstone", "Thunderstone", "When you Stun an enemy, deal 6 Nature damage.", assetRefs.thunderstone),
  trinket(
    "lucky-clover",
    "Lucky Clover",
    "Nature damage has a 10% chance to grant Gold equal to the damage dealt.",
    assetRefs.luckyClover,
  ),
];
