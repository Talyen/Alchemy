// Feature-facing catalog seam for screen/runtime reads of static game data.
// Keeps UI modules from importing broad game-data registries directly.
export {
  alchemistShopBg,
  campfire,
  cardLibrary,
  characterArt,
  characters,
  characterUnlockRequirements,
  corruptionAltar,
  eliteEnemyBg,
  enemyBestiary,
  getRequiredPreviousCharacter,
  getTalentKeywordProgress,
  isCharacterUnlocked,
  keywordDefinitions,
  merchantShopBg,
  mysteryBg,
  normalEnemyBg,
  pileDiscardArt,
  pileDrawArt,
  theCampaign,
  theLabyrinth,
  theWildwoods,
  trinketLibrary,
} from "@/lib/game-data";

export type { BestiaryEntry, CharacterId, CompanionId, EnemyType, KeywordId, TrinketEntry } from "@/lib/game-data";
