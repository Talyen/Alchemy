import type { KeywordId } from "./types";
import * as assetRefs from "./assets.generated";

export * from "./assets.generated";

export const alchemistShopBg = assetRefs.alchemistShop;
export const eliteEnemyBg = assetRefs.eliteEnemy;
export const merchantShopBg = assetRefs.merchantShop;
export const mysteryBg = assetRefs.mystery;
export const normalEnemyBg = assetRefs.normalEnemy;
const pointerCursor = assetRefs.pointerCShaded;

export const menuLogo = assetRefs.alchemyLogo;
export const menuLogoVariants = [
  assetRefs.alchemyLogo,
  assetRefs.alchemyLogoArcaneMana,
  assetRefs.alchemyLogoFireIron,
  assetRefs.alchemyLogoFrost,
  assetRefs.alchemyLogoHolyBlock,
  assetRefs.alchemyLogoNatureBleed,
  assetRefs.alchemyLogoPoison,
];
export const pileDrawArt = assetRefs.drawPile;
export const pileDiscardArt = assetRefs.discardPile;

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
  "ancient-altar": assetRefs.mysteryAncientAltar,
  "crystal-garden": assetRefs.mysteryCrystalGarden,
  "crystal-geode": assetRefs.mysteryCrystalGeode,
  "enchanted-spring": assetRefs.mysteryEnchantedSpring,
  "fairy-ring": assetRefs.mysteryFairyRing,
  "forgotten-hoard": assetRefs.mysteryForgottenHoard,
  "fungal-grotto": assetRefs.mysteryFungalGrotto,
  "hidden-cache": assetRefs.mysteryHiddenCache,
  "hunters-lodge": assetRefs.mysteryHuntersLodge,
  "mana-berries": assetRefs.mysteryManaBerries,
  "medicinal-herb-garden": assetRefs.mysteryMedicinalHerbGarden,
  "meteorite-crash": assetRefs.mysteryMeteoriteCrash,
  "mountain-pass": assetRefs.mysteryMountainPass,
  "murky-pond": assetRefs.mysteryMurkyPond,
  "mysterious-tome": assetRefs.mysteryMysteriousTome,
  "necromancers-offer": assetRefs.mysteryNecromancersOffer,
  "overgrown-temple": assetRefs.mysteryOvergrownTemple,
  "roadside-censer": assetRefs.mysteryRoadsideCenser,
  "sacred-grove": assetRefs.mysterySacredGrove,
  "the-phoenix": assetRefs.mysteryThePhoenix,
  "the-wolf": assetRefs.mysteryTheWolf,
  "wisdom-tree": assetRefs.mysteryWisdomTree,
};

export const allGameArt: string[] = Object.values(assetRefs);

export const gearSlotBackgroundArt = {
  body: assetRefs.gearSlotBody,
  "main-hand": assetRefs.gearSlotWeapon,
  "off-hand": assetRefs.gearSlotWeapon,
  "left-accessory": assetRefs.gearSlotAccessory,
  trinket: assetRefs.gearSlotTrinket,
  "right-accessory": assetRefs.gearSlotAccessory,
} as const;

export const talentArt: Partial<Record<KeywordId, string>> = {
  archery: assetRefs.talentArchery,
  armor: assetRefs.talentArmor,
  bleed: assetRefs.talentBleed,
  block: assetRefs.talentBlock,
  burn: assetRefs.talentBurn,
  companion: assetRefs.talentCompanion,
  consume: assetRefs.talentConsume,
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
