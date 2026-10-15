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
export const demoFeatureShowcase = assetRefs.demoFeatureShowcase;
export const pileDrawArt = assetRefs.drawPile;
export const pileDiscardArt = assetRefs.discardPile;
export const armorySalvageArt = assetRefs.armorySalvage;

export const combatantFrameArt = {
  charcoal: assetRefs.combatantFrameCharcoal,
  saddle: assetRefs.combatantFrameSaddle,
  walnut: assetRefs.combatantFrameWalnut,
  oak: assetRefs.combatantFrameOak,
} as const;

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

export const boardArt: Record<string, { full: string; thumbnail: string }> = {
  acorn: { full: assetRefs.boardAcorn, thumbnail: assetRefs.boardAcornThumbnail },
  "alpine-cuckoo": { full: assetRefs.boardAlpineCuckoo, thumbnail: assetRefs.boardAlpineCuckooThumbnail },
  "amethyst-lantern": { full: assetRefs.boardAmethystLantern, thumbnail: assetRefs.boardAmethystLanternThumbnail },
  "apple-orchard": { full: assetRefs.boardAppleOrchard, thumbnail: assetRefs.boardAppleOrchardThumbnail },
  "arcanist-library": { full: assetRefs.boardArcanistLibrary, thumbnail: assetRefs.boardArcanistLibraryThumbnail },
  "astral-weave": { full: assetRefs.boardAstralWeave, thumbnail: assetRefs.boardAstralWeaveThumbnail },
  "autumn-cherrywood-salon": {
    full: assetRefs.boardAutumnCherrywoodSalon,
    thumbnail: assetRefs.boardAutumnCherrywoodSalonThumbnail,
  },
  "autumn-dragon-pavilion": {
    full: assetRefs.boardAutumnDragonPavilion,
    thumbnail: assetRefs.boardAutumnDragonPavilionThumbnail,
  },
  "autumn-harvest": { full: assetRefs.boardAutumnHarvest, thumbnail: assetRefs.boardAutumnHarvestThumbnail },
  "autumn-hazelnut-burrow": {
    full: assetRefs.boardAutumnHazelnutBurrow,
    thumbnail: assetRefs.boardAutumnHazelnutBurrowThumbnail,
  },
  "badger-burrow-marquetry": {
    full: assetRefs.boardBadgerBurrowMarquetry,
    thumbnail: assetRefs.boardBadgerBurrowMarquetryThumbnail,
  },
  "bazaar-board": { full: assetRefs.boardBazaarBoard, thumbnail: assetRefs.boardBazaarBoardThumbnail },
  "beige-windmill": { full: assetRefs.boardBeigeWindmill, thumbnail: assetRefs.boardBeigeWindmillThumbnail },
  "birch-mushroom-homestead": {
    full: assetRefs.boardBirchMushroomHomestead,
    thumbnail: assetRefs.boardBirchMushroomHomesteadThumbnail,
  },
  "blacksmith-s-board": { full: assetRefs.boardBlacksmithSBoard, thumbnail: assetRefs.boardBlacksmithSBoardThumbnail },
  "botanical-heirloom": {
    full: assetRefs.boardBotanicalHeirloom,
    thumbnail: assetRefs.boardBotanicalHeirloomThumbnail,
  },
  "brass-planetarium": { full: assetRefs.boardBrassPlanetarium, thumbnail: assetRefs.boardBrassPlanetariumThumbnail },
  "bright-conservatory": {
    full: assetRefs.boardBrightConservatory,
    thumbnail: assetRefs.boardBrightConservatoryThumbnail,
  },
  carnival: { full: assetRefs.boardCarnival, thumbnail: assetRefs.boardCarnivalThumbnail },
  "coral-inlay-tide": { full: assetRefs.boardCoralInlayTide, thumbnail: assetRefs.boardCoralInlayTideThumbnail },
  "cottage-board": { full: assetRefs.boardCottageBoard, thumbnail: assetRefs.boardCottageBoardThumbnail },
  "dragonkeeper-s-nursery": {
    full: assetRefs.boardDragonkeeperSNursery,
    thumbnail: assetRefs.boardDragonkeeperSNurseryThumbnail,
  },
  "egg-sanctuary": { full: assetRefs.boardEggSanctuary, thumbnail: assetRefs.boardEggSanctuaryThumbnail },
  "fern-conservatory": { full: assetRefs.boardFernConservatory, thumbnail: assetRefs.boardFernConservatoryThumbnail },
  fireplace: { full: assetRefs.boardFireplace, thumbnail: assetRefs.boardFireplaceThumbnail },
  "folding-green": { full: assetRefs.boardFoldingGreen, thumbnail: assetRefs.boardFoldingGreenThumbnail },
  "gilded-bee": { full: assetRefs.boardGildedBee, thumbnail: assetRefs.boardGildedBeeThumbnail },
  "glacial-shipwreck": { full: assetRefs.boardGlacialShipwreck, thumbnail: assetRefs.boardGlacialShipwreckThumbnail },
  "glassblower-s-lantern": {
    full: assetRefs.boardGlassblowerSLantern,
    thumbnail: assetRefs.boardGlassblowerSLanternThumbnail,
  },
  "glowing-mushroo-pool": {
    full: assetRefs.boardGlowingMushrooPool,
    thumbnail: assetRefs.boardGlowingMushrooPoolThumbnail,
  },
  "golden-cedar-dragon": {
    full: assetRefs.boardGoldenCedarDragon,
    thumbnail: assetRefs.boardGoldenCedarDragonThumbnail,
  },
  "honey-board": { full: assetRefs.boardHoneyBoard, thumbnail: assetRefs.boardHoneyBoardThumbnail },
  "inn-s-light": { full: assetRefs.boardInnSLight, thumbnail: assetRefs.boardInnSLightThumbnail },
  "ivory-door": { full: assetRefs.boardIvoryDoor, thumbnail: assetRefs.boardIvoryDoorThumbnail },
  "ivory-heirloom": { full: assetRefs.boardIvoryHeirloom, thumbnail: assetRefs.boardIvoryHeirloomThumbnail },
  "ivory-mulberry-heirloom": {
    full: assetRefs.boardIvoryMulberryHeirloom,
    thumbnail: assetRefs.boardIvoryMulberryHeirloomThumbnail,
  },
  "jade-dragon-lacquer": {
    full: assetRefs.boardJadeDragonLacquer,
    thumbnail: assetRefs.boardJadeDragonLacquerThumbnail,
  },
  "maple-rose-bridge": { full: assetRefs.boardMapleRoseBridge, thumbnail: assetRefs.boardMapleRoseBridgeThumbnail },
  "midnight-ballet": { full: assetRefs.boardMidnightBallet, thumbnail: assetRefs.boardMidnightBalletThumbnail },
  "midnight-rose-cabinet": {
    full: assetRefs.boardMidnightRoseCabinet,
    thumbnail: assetRefs.boardMidnightRoseCabinetThumbnail,
  },
  "moonlit-orchid": { full: assetRefs.boardMoonlitOrchid, thumbnail: assetRefs.boardMoonlitOrchidThumbnail },
  "nordic-rune-hall": { full: assetRefs.boardNordicRuneHall, thumbnail: assetRefs.boardNordicRuneHallThumbnail },
  "obsidian-volcano": { full: assetRefs.boardObsidianVolcano, thumbnail: assetRefs.boardObsidianVolcanoThumbnail },
  "olive-harvest": { full: assetRefs.boardOliveHarvest, thumbnail: assetRefs.boardOliveHarvestThumbnail },
  "orchard-guardian": { full: assetRefs.boardOrchardGuardian, thumbnail: assetRefs.boardOrchardGuardianThumbnail },
  overgrown: { full: assetRefs.boardOvergrown, thumbnail: assetRefs.boardOvergrownThumbnail },
  "petal-garden": { full: assetRefs.boardPetalGarden, thumbnail: assetRefs.boardPetalGardenThumbnail },
  "plumwood-artisan": { full: assetRefs.boardPlumwoodArtisan, thumbnail: assetRefs.boardPlumwoodArtisanThumbnail },
  "pomegranate-terrace": {
    full: assetRefs.boardPomegranateTerrace,
    thumbnail: assetRefs.boardPomegranateTerraceThumbnail,
  },
  "potting-garden": { full: assetRefs.boardPottingGarden, thumbnail: assetRefs.boardPottingGardenThumbnail },
  "purple-ribbon": { full: assetRefs.boardPurpleRibbon, thumbnail: assetRefs.boardPurpleRibbonThumbnail },
  "rainy-night": { full: assetRefs.boardRainyNight, thumbnail: assetRefs.boardRainyNightThumbnail },
  "rootwood-artisan-heirloom": {
    full: assetRefs.boardRootwoodArtisanHeirloom,
    thumbnail: assetRefs.boardRootwoodArtisanHeirloomThumbnail,
  },
  "ropeweaver-s-walnut-board": {
    full: assetRefs.boardRopeweaverSWalnutBoard,
    thumbnail: assetRefs.boardRopeweaverSWalnutBoardThumbnail,
  },
  "rose-artisan": { full: assetRefs.boardRoseArtisan, thumbnail: assetRefs.boardRoseArtisanThumbnail },
  "rose-gold-music-box": { full: assetRefs.boardRoseGoldMusicBox, thumbnail: assetRefs.boardRoseGoldMusicBoxThumbnail },
  "rose-lantern-conservatory": {
    full: assetRefs.boardRoseLanternConservatory,
    thumbnail: assetRefs.boardRoseLanternConservatoryThumbnail,
  },
  "rose-trellis-salon": { full: assetRefs.boardRoseTrellisSalon, thumbnail: assetRefs.boardRoseTrellisSalonThumbnail },
  "royal-plumwood-salon": {
    full: assetRefs.boardRoyalPlumwoodSalon,
    thumbnail: assetRefs.boardRoyalPlumwoodSalonThumbnail,
  },
  "sapphire-artisan": { full: assetRefs.boardSapphireArtisan, thumbnail: assetRefs.boardSapphireArtisanThumbnail },
  "satin-dice": { full: assetRefs.boardSatinDice, thumbnail: assetRefs.boardSatinDiceThumbnail },
  "seafaring-artisan": { full: assetRefs.boardSeafaringArtisan, thumbnail: assetRefs.boardSeafaringArtisanThumbnail },
  "snowy-greenhouse": { full: assetRefs.boardSnowyGreenhouse, thumbnail: assetRefs.boardSnowyGreenhouseThumbnail },
  "stained-glass-chapel": {
    full: assetRefs.boardStainedGlassChapel,
    thumbnail: assetRefs.boardStainedGlassChapelThumbnail,
  },
  "stained-glass-fireplace": {
    full: assetRefs.boardStainedGlassFireplace,
    thumbnail: assetRefs.boardStainedGlassFireplaceThumbnail,
  },
  "starweaver-s-loom": { full: assetRefs.boardStarweaverSLoom, thumbnail: assetRefs.boardStarweaverSLoomThumbnail },
  "swan-court-heirloom": {
    full: assetRefs.boardSwanCourtHeirloom,
    thumbnail: assetRefs.boardSwanCourtHeirloomThumbnail,
  },
  "tea-time": { full: assetRefs.boardTeaTime, thumbnail: assetRefs.boardTeaTimeThumbnail },
  "teal-mountain": { full: assetRefs.boardTealMountain, thumbnail: assetRefs.boardTealMountainThumbnail },
  "velvet-thorn": { full: assetRefs.boardVelvetThorn, thumbnail: assetRefs.boardVelvetThornThumbnail },
  "willow-artisan": { full: assetRefs.boardWillowArtisan, thumbnail: assetRefs.boardWillowArtisanThumbnail },
  "willow-lantern-bridge": {
    full: assetRefs.boardWillowLanternBridge,
    thumbnail: assetRefs.boardWillowLanternBridgeThumbnail,
  },
  "willow-mill": { full: assetRefs.boardWillowMill, thumbnail: assetRefs.boardWillowMillThumbnail },
  "willow-rose": { full: assetRefs.boardWillowRose, thumbnail: assetRefs.boardWillowRoseThumbnail },
  "winter-citrus": { full: assetRefs.boardWinterCitrus, thumbnail: assetRefs.boardWinterCitrusThumbnail },
  "winter-swan-conservatory": {
    full: assetRefs.boardWinterSwanConservatory,
    thumbnail: assetRefs.boardWinterSwanConservatoryThumbnail,
  },
};

// Registered eagerly, decoded only when a board or thumbnail is displayed.
export const onDemandBoardArt = new Set(Object.values(boardArt).flatMap((art) => [art.full, art.thumbnail]));

export const allGameArt: string[] = Object.values(assetRefs);

const gearItemArt = new Set(
  Object.entries(gearArtByDefinitionId)
    .filter(([id]) => !id.startsWith("slot-"))
    .map(([, src]) => src),
);

export const essentialGameArt: string[] = Object.values(assetRefs).filter(
  (src) => !gearItemArt.has(src) && !onDemandBoardArt.has(src),
);

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
