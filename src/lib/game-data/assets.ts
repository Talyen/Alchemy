import type { KeywordId } from "./types";
import * as assetRefs from "./assets.generated";
import { gearArtByDefinitionId } from "./gear-art.generated";

export * from "./assets.generated";

export const alchemistShopBg = assetRefs.alchemistShop;
export const eliteEnemyBg = assetRefs.eliteEnemy;
export const merchantShopBg = assetRefs.merchantShop;
export const mysteryBg = assetRefs.mystery;
export const normalEnemyBg = assetRefs.normalEnemy;
const pointerCursor = assetRefs.pointerCShaded;

export const menuLogo = assetRefs.alchemyLogo;
export const pileDrawArt = assetRefs.drawPile;
export const pileDiscardArt = assetRefs.discardPile;

export const labyrinthShroudedArt = [
  assetRefs.labyrinthShroudedVeiledArch,
  assetRefs.labyrinthShroudedDescendingSteps,
  assetRefs.labyrinthShroudedShroudedPassage,
  assetRefs.labyrinthShroudedForgottenPillars,
  assetRefs.labyrinthShroudedVanishingBridge,
  assetRefs.labyrinthShroudedHiddenChamber,
] as const;

export const characterArt = {
  knight: assetRefs.knight,
  ranger: assetRefs.ranger,
  rogue: assetRefs.rogue,
  wizard: assetRefs.wizard,
  alchemist: assetRefs.alchemist,
  warlock: assetRefs.warlock,
  druid: assetRefs.druid,
  wildcard: assetRefs.wildcard,
} as const;

export const cursorArt = {
  pointer: pointerCursor,
} as const;

export const mysteryEventArt: Record<string, string> = {
  "abandoned-study": assetRefs.mysteryAbandonedStudy,
  "altars-afterglow": assetRefs.mysteryAncientAltar,
  "ancient-altar": assetRefs.mysteryAncientAltar,
  "clearwater-remedy": assetRefs.mysteryEnchantedSpring,
  "cooled-core": assetRefs.mysteryMeteoriteCrash,
  "crystal-garden": assetRefs.mysteryCrystalGarden,
  "crystal-geode": assetRefs.mysteryCrystalGeode,
  "drowned-toll": assetRefs.mysteryMurkyPond,
  "enchanted-spring": assetRefs.mysteryEnchantedSpring,
  "fae-lanterns": assetRefs.mysteryFairyRing,
  "fairy-ring": assetRefs.mysteryFairyRing,
  "fallen-bough": assetRefs.mysterySacredGrove,
  "forgotten-door": assetRefs.mysteryOvergrownTemple,
  "forgotten-hoard": assetRefs.mysteryForgottenHoard,
  "fungal-grotto": assetRefs.mysteryFungalGrotto,
  "healers-recipe": assetRefs.mysteryMedicinalHerbGarden,
  "hidden-cache": assetRefs.mysteryHiddenCache,
  "hunters-lodge": assetRefs.mysteryHuntersLodge,
  "locked-treatise": assetRefs.mysteryAbandonedStudy,
  "mana-berries": assetRefs.mysteryManaBerries,
  "medicinal-herb-garden": assetRefs.mysteryMedicinalHerbGarden,
  "meteorite-crash": assetRefs.mysteryMeteoriteCrash,
  "moth-in-the-thicket": assetRefs.mysteryManaBerries,
  "mountain-pass": assetRefs.mysteryMountainPass,
  "murky-pond": assetRefs.mysteryMurkyPond,
  "mysterious-tome": assetRefs.mysteryMysteriousTome,
  "necromancers-offer": assetRefs.mysteryNecromancersOffer,
  "overgrown-temple": assetRefs.mysteryOvergrownTemple,
  "patient-scout": assetRefs.mysteryTheWolf,
  "roadside-censer": assetRefs.mysteryRoadsideCenser,
  "rootbound-dispatch": assetRefs.mysteryHiddenCache,
  "sacred-grove": assetRefs.mysterySacredGrove,
  "seed-in-the-ash": assetRefs.mysteryThePhoenix,
  "singing-crystal": assetRefs.mysteryCrystalGarden,
  "sporekeepers-tools": assetRefs.mysteryFungalGrotto,
  "the-phoenix": assetRefs.mysteryThePhoenix,
  "the-wolf": assetRefs.mysteryTheWolf,
  "wisdom-tree": assetRefs.mysteryWisdomTree,
};

export const allGameArt: string[] = Object.values(assetRefs);

const gearItemArt = new Set(
  Object.entries(gearArtByDefinitionId)
    .filter(([id]) => !id.startsWith("slot-"))
    .map(([, src]) => src),
);

export const essentialGameArt: string[] = Object.values(assetRefs).filter((src) => !gearItemArt.has(src));

export const gearSlotBackgroundArt = {
  body: gearArtByDefinitionId["slot-body"],
  "main-hand": gearArtByDefinitionId["slot-weapon"],
  "off-hand": gearArtByDefinitionId["slot-weapon"],
  "left-accessory": gearArtByDefinitionId["slot-accessory"],
  trinket: gearArtByDefinitionId["slot-trinket"],
  "right-accessory": gearArtByDefinitionId["slot-accessory"],
} as const;

export const talentArt: Partial<Record<KeywordId, string>> = {
  archery: assetRefs.talentArchery,
  armor: assetRefs.talentArmor,
  bleed: assetRefs.talentBleed,
  block: assetRefs.talentBlock,
  burn: assetRefs.talentBurn,
  companion: assetRefs.talentCompanion,
  consume: assetRefs.talentConsume,
  dodge: assetRefs.talentDodge,
  forge: assetRefs.talentForge,
  freeze: assetRefs.talentFreeze,
  gold: assetRefs.talentGold,
  health: assetRefs.talentHealth,
  holy: assetRefs.talentHoly,
  leech: assetRefs.talentLeech,
  mana: assetRefs.talentMana,
  nature: assetRefs.talentNature,
  physical: assetRefs.talentPhysical,
  poison: assetRefs.talentPoison,
  stun: assetRefs.talentStun,
  wish: assetRefs.talentWish,
};

export const craftingArt: Record<string, string> = {
  "discordant-dice": assetRefs.craftingDiscordantDice,
  "sprig-of-growth": assetRefs.craftingSprigOfGrowth,
  voidstone: assetRefs.craftingVoidstone,
  "ascension-seal": assetRefs.craftingAscensionSeal,
  "severance-maw": assetRefs.craftingSeveranceMaw,
  "smiths-whetstone": assetRefs.craftingSmithsWhetstone,
};

export const difficultyArt: Record<string, string> = {
  "difficulty-1": assetRefs.difficulty1,
  "difficulty-2": assetRefs.difficulty2,
  "difficulty-3": assetRefs.difficulty3,
};
