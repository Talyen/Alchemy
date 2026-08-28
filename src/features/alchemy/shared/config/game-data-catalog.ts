export {
  alchemistShopBg,
  campfire,
  cardById,
  cardLibrary,
  characterArt,
  characters,
  corruptionAltar,
  eliteEnemyBg,
  bossEnemies,
  encounterEnemies,
  enemiesByType,
  enemyById,
  enemyBestiary,
  isEnemyId,
  getCardKeywords,
  getCompanionKeywords,
  getCharacterUnlockMessage,
  getGameModeUnlockMessage,
  getProgressionFeatureUnlockMessage,
  getRequiredPreviousCharacter,
  getTalentKeywordProgress,
  isCharacterUnlocked,
  isGameModeUnlocked,
  isProgressionFeatureUnlocked,
  keywordDefinitions,
  merchantShopBg,
  mysteryBg,
  normalEnemyBg,
  pileDiscardArt,
  pileDrawArt,
  theCampaign,
  theLabyrinth,
  wildwoodDraft,
  trinketLibrary,
  trinketById,
} from "@/lib/game-data";

import { trinketById, type KeywordId } from "@/lib/game-data";
import { extractKeywordIds } from "./keywords";

export function getTrinketKeywords(trinketId: string): KeywordId[] {
  const trinket = trinketById[trinketId];
  if (!trinket) return [];
  return extractKeywordIds(trinket.descriptionLines.join(" "));
}

export type {
  BattleCard,
  BestiaryEntry,
  CharacterDefinition,
  CharacterId,
  CompanionDefinition,
  CompanionId,
  EnemyType,
  GameModeId,
  KeywordId,
  TalentDefinition,
  TrinketEntry,
} from "@/lib/game-data";
