// Pure collection item shaping for heroes, cards, enemies, and trinkets.
// Depends on game-data libraries and collection page size tuning.
// Used by collection UI layout and tests without owning rendering concerns.
import { COLLECTION_PAGE_SIZE, BESTIARY_PAGE_SIZE, TRINKET_PAGE_SIZE } from "@/lib/game-constants";
import {
  cardLibrary,
  characterArt,
  characters,
  enemyBestiary,
  getCharacterUnlockMessage,
  isCharacterUnlocked,
  trinketLibrary,
  type BestiaryEntry,
  type CharacterDefinition,
  type CharacterId,
  type TrinketEntry,
} from "@/features/alchemy/shared/config/game-data-catalog";
import type { BattleCard } from "@/lib/game-data";

import type { CollectionTab } from "../types";

const COLLECTION_ITEMS_CONFIG = {
  pageSize: COLLECTION_PAGE_SIZE,
  hiddenTitle: "Undiscovered",
  hiddenCardDescription: "Discover this card during a run to reveal it here.",
  hiddenEnemyDescription: "Encounter this enemy to record its details.",
  hiddenTrinketDescription: "Find this trinket to reveal its effect.",
} as const;

export interface CollectionTileItem {
  id: string;
  title: string;
  subtitle: string | undefined;
  descriptionLines: string[];
  art: string;
  discovered: boolean;
  hoverScope: string;
  frameType: "hero" | "card" | "bestiary" | "trinket";
  enemyEntry?: BestiaryEntry;
  /** Discovered cards: format description lines in the hover popup, not while paging. */
  card?: BattleCard;
  companionBondLevels?: Record<string, number>;
  character?: CharacterDefinition;
  unlockRequirementText?: string;
}

function getCollectionPageSize(tab: CollectionTab): number {
  if (tab === "trinkets") return TRINKET_PAGE_SIZE;
  if (tab === "bestiary") return BESTIARY_PAGE_SIZE;
  return COLLECTION_PAGE_SIZE;
}

function getCollectionLibraryLength(collectionTab: CollectionTab): number {
  switch (collectionTab) {
    case "heroes":
      return heroRoster.length;
    case "cards":
      return cardLibrary.length;
    case "bestiary":
      return enemyBestiary.length;
    case "trinkets":
      return trinketLibrary.length;
  }
}

export function getCollectionTotalPages(collectionTab: CollectionTab) {
  return Math.max(1, Math.ceil(getCollectionLibraryLength(collectionTab) / getCollectionPageSize(collectionTab)));
}

export function getCollectionPageItems({
  collectionTab,
  discoveredCardIds,
  encounteredEnemyIds,
  discoveredTrinketIds,
  finishedRunCharacters = [],
  bondedCompanions = {},
  page,
}: {
  collectionTab: CollectionTab;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  finishedRunCharacters?: readonly CharacterId[];
  bondedCompanions?: Record<string, number>;
  page: number;
}) {
  const pageSize = getCollectionPageSize(collectionTab);
  const totalPages = getCollectionTotalPages(collectionTab);
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * pageSize;
  if (collectionTab === "heroes") {
    return getHeroItems(finishedRunCharacters, start, pageSize);
  }
  if (collectionTab === "cards") {
    return getCardItems(discoveredCardIds, bondedCompanions, start, pageSize);
  }
  if (collectionTab === "bestiary") {
    return getBestiaryItems(encounteredEnemyIds, start, pageSize);
  }
  return getTrinketItems(discoveredTrinketIds, start, pageSize);
}

export function getCollectionFillerCount(itemCount: number, collectionTab: CollectionTab) {
  return Math.max(0, getCollectionPageSize(collectionTab) - itemCount);
}

function sortByTitle<T extends { title: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.title.localeCompare(b.title));
}

// Catalogs are static at module load; pre-sort once so paging never re-sorts the full library.
const sortedCardLibrary = sortByTitle(cardLibrary);
const sortedEnemyBestiary = sortByTitle(enemyBestiary);
const sortedTrinketLibrary = sortByTitle(trinketLibrary);
const heroRoster = Object.values(characters);

function shapeCardItem(
  card: (typeof cardLibrary)[number],
  discovered: boolean,
  bondedCompanions: Record<string, number>,
): CollectionTileItem {
  return {
    id: card.id,
    title: discovered ? card.title : COLLECTION_ITEMS_CONFIG.hiddenTitle,
    subtitle: undefined,
    descriptionLines: discovered ? [] : [COLLECTION_ITEMS_CONFIG.hiddenCardDescription],
    art: card.art,
    discovered,
    hoverScope: "collection-card",
    frameType: "card",
    ...(discovered ? { card, companionBondLevels: bondedCompanions } : {}),
  };
}

function getCardItems(
  discoveredCardIds: string[],
  bondedCompanions: Record<string, number> = {},
  start: number,
  pageSize: number,
): CollectionTileItem[] {
  const discoveredSet = new Set(discoveredCardIds);
  return sortedCardLibrary
    .slice(start, start + pageSize)
    .map((card) => shapeCardItem(card, discoveredSet.has(card.id), bondedCompanions));
}

function getHeroItems(
  finishedRunCharacters: readonly CharacterId[],
  start: number,
  pageSize: number,
): CollectionTileItem[] {
  return heroRoster.slice(start, start + pageSize).map((character) => {
    const discovered = isCharacterUnlocked(character.id, finishedRunCharacters);
    const unlockRequirementText = discovered ? "" : getCharacterUnlockMessage(character.id);
    return {
      id: character.id,
      title: character.name,
      subtitle: undefined,
      descriptionLines: discovered ? [] : [unlockRequirementText],
      art: characterArt[character.id],
      discovered,
      hoverScope: "collection-hero",
      frameType: "hero" as const,
      character,
      unlockRequirementText,
    };
  });
}

function getBestiaryItems(encounteredEnemyIds: string[], start: number, pageSize: number): CollectionTileItem[] {
  const encounteredSet = new Set(encounteredEnemyIds);
  return sortedEnemyBestiary.slice(start, start + pageSize).map((entry: BestiaryEntry) => {
    const discovered = encounteredSet.has(entry.id);
    return {
      id: entry.id,
      title: discovered ? entry.title : COLLECTION_ITEMS_CONFIG.hiddenTitle,
      subtitle: discovered ? entry.subtitle : undefined,
      descriptionLines: discovered ? entry.descriptionLines : [COLLECTION_ITEMS_CONFIG.hiddenEnemyDescription],
      art: entry.art,
      discovered,
      hoverScope: "collection-bestiary",
      frameType: "bestiary",
      enemyEntry: entry,
    };
  });
}

function getTrinketItems(discoveredTrinketIds: string[], start: number, pageSize: number): CollectionTileItem[] {
  const discoveredSet = new Set(discoveredTrinketIds);
  return sortedTrinketLibrary.slice(start, start + pageSize).map((entry: TrinketEntry) => {
    const discovered = discoveredSet.has(entry.id);
    return {
      id: entry.id,
      title: discovered ? entry.title : COLLECTION_ITEMS_CONFIG.hiddenTitle,
      subtitle: undefined,
      descriptionLines: discovered ? entry.descriptionLines : [COLLECTION_ITEMS_CONFIG.hiddenTrinketDescription],
      art: entry.art,
      discovered,
      hoverScope: "collection-trinket" as const,
      frameType: "trinket" as const,
    };
  });
}
