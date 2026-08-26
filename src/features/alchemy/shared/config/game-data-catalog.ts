// Feature-facing catalog seam for screen/runtime reads of static game data.
// Keeps UI modules from importing broad game-data registries directly.
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
  getCharacterUnlockMessage,
  getGameModeUnlockMessage,
  getRequiredPreviousCharacter,
  KNIGHT_UNLOCK_MESSAGE,
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
} from "@/lib/game-data";

import { trinketById, type KeywordId } from "@/lib/game-data";
import { keywordAliasMap, keywordPattern } from "./keywords";

export function getTrinketKeywords(trinketId: string): KeywordId[] {
  const trinket = trinketById[trinketId];
  if (!trinket) return [];
  const text = trinket.descriptionLines.join(" ");
  const matches = text.matchAll(keywordPattern);
  const keywords = new Set<KeywordId>();
  for (const match of matches) {
    const keywordId = keywordAliasMap.get(match[0].toLowerCase());
    if (keywordId) {
      keywords.add(keywordId);
    }
  }
  return Array.from(keywords);
}

export type {
  BattleCard,
  BestiaryEntry,
  BossEnemyId,
  EnemyId,
  CharacterDefinition,
  CharacterId,
  CompanionId,
  EnemyType,
  GameModeId,
  KeywordId,
  TrinketEntry,
} from "@/lib/game-data";
