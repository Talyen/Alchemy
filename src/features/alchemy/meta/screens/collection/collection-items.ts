import { getPagination } from "../../../shared/ui/pagination";
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
} from "@/features/alchemy/shared/config/game-data-catalog";
import type { BattleCard } from "@/lib/game-data";
import { gearDefinitions, uniqueItemList } from "@/lib/gear";

import type { CollectionTab } from "../../../shared/types";

const COLLECTION_ITEMS_CONFIG = {
  pageSize: COLLECTION_PAGE_SIZE,
  hiddenTitle: "Undiscovered",
  hiddenCardDescription: "Discover this card during a run to reveal it here.",
  hiddenEnemyDescription: "Encounter this enemy to record its details.",
  hiddenTrinketDescription: "Find this trinket to reveal its effect.",
  hiddenUniqueDescription: "Find this unique to reveal its effect.",
} as const;

export interface CollectionTileItem {
  id: string;
  title: string;
  subtitle: string | undefined;
  descriptionLines: string[];
  art: string;
  discovered: boolean;
  hoverScope: string;
  frameType: "hero" | "card" | "bestiary" | "trinket" | "unique";
  enemyEntry?: BestiaryEntry;

  card?: BattleCard;
  companionBondLevels?: Record<string, number>;
  character?: CharacterDefinition;
  unlockRequirementText?: string;
}

function getCollectionPageSize(tab: CollectionTab): number {
  if (tab === "trinkets" || tab === "uniques") return TRINKET_PAGE_SIZE;
  if (tab === "bestiary") return BESTIARY_PAGE_SIZE;
  return COLLECTION_PAGE_SIZE;
}

export function getCollectionLibraryLength(collectionTab: CollectionTab): number {
  switch (collectionTab) {
    case "heroes":
      return heroRoster.length;
    case "cards":
      return cardLibrary.length;
    case "bestiary":
      return enemyBestiary.length;
    case "trinkets":
      return trinketLibrary.length;
    case "uniques":
      return uniqueItemList.length;
  }
}

export function getCollectionTotalPages(collectionTab: CollectionTab, pageSize = getCollectionPageSize(collectionTab)) {
  return getPagination(getCollectionLibraryLength(collectionTab), 0, pageSize).totalPages;
}

export function getCollectionPageItems({
  collectionTab,
  discoveredCardIds,
  encounteredEnemyIds,
  discoveredTrinketIds,
  discoveredUniqueIds,
  finishedRunCharacters = [],
  bondedCompanions = {},
  page,
  pageSize = getCollectionPageSize(collectionTab),
}: {
  collectionTab: CollectionTab;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  discoveredUniqueIds: string[];
  finishedRunCharacters?: readonly CharacterId[];
  bondedCompanions?: Record<string, number>;
  page: number;
  pageSize?: number;
}) {
  const { page: safePage, pageSize: size } = getPagination(getCollectionLibraryLength(collectionTab), page, pageSize);
  const start = safePage * size;
  if (collectionTab === "heroes") {
    return getHeroItems(finishedRunCharacters, start, size);
  }
  if (collectionTab === "cards") {
    return getCardItems(discoveredCardIds, bondedCompanions, start, size);
  }
  if (collectionTab === "bestiary") {
    return getBestiaryItems(encounteredEnemyIds, start, size);
  }
  if (collectionTab === "uniques") {
    return getUniqueItems(discoveredUniqueIds, start, size);
  }
  return getTrinketItems(discoveredTrinketIds, start, size);
}

export function getCollectionFillerCount(itemCount: number, collectionTab: CollectionTab) {
  return Math.max(0, getCollectionPageSize(collectionTab) - itemCount);
}

function sortByTitle<T extends { title: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.title.localeCompare(b.title));
}

const sortedCardLibrary = sortByTitle(cardLibrary);
const sortedEnemyBestiary = sortByTitle(enemyBestiary);
const sortedTrinketLibrary = sortByTitle(trinketLibrary);
const sortedUniqueLibrary = [...uniqueItemList].sort((a, b) => a.displayName.localeCompare(b.displayName));
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

function sliceDiscoveredEntries<T extends { id: string }>(
  entries: readonly T[],
  discoveredIds: readonly string[],
  start: number,
  pageSize: number,
  mapEntry: (entry: T, discovered: boolean) => CollectionTileItem,
): CollectionTileItem[] {
  const discoveredSet = new Set(discoveredIds);
  return entries.slice(start, start + pageSize).map((entry) => mapEntry(entry, discoveredSet.has(entry.id)));
}

function getCardItems(
  discoveredCardIds: string[],
  bondedCompanions: Record<string, number> = {},
  start: number,
  pageSize: number,
): CollectionTileItem[] {
  return sliceDiscoveredEntries(sortedCardLibrary, discoveredCardIds, start, pageSize, (card, discovered) =>
    shapeCardItem(card, discovered, bondedCompanions),
  );
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
  return sliceDiscoveredEntries(sortedEnemyBestiary, encounteredEnemyIds, start, pageSize, (entry, discovered) => ({
    id: entry.id,
    title: discovered ? entry.title : COLLECTION_ITEMS_CONFIG.hiddenTitle,
    subtitle: discovered ? entry.subtitle : undefined,
    descriptionLines: discovered ? entry.descriptionLines : [COLLECTION_ITEMS_CONFIG.hiddenEnemyDescription],
    art: entry.art,
    discovered,
    hoverScope: "collection-bestiary",
    frameType: "bestiary",
    enemyEntry: entry,
  }));
}

function getTrinketItems(discoveredTrinketIds: string[], start: number, pageSize: number): CollectionTileItem[] {
  return sliceDiscoveredEntries(sortedTrinketLibrary, discoveredTrinketIds, start, pageSize, (entry, discovered) => ({
    id: entry.id,
    title: discovered ? entry.title : COLLECTION_ITEMS_CONFIG.hiddenTitle,
    subtitle: undefined,
    descriptionLines: discovered ? entry.descriptionLines : [COLLECTION_ITEMS_CONFIG.hiddenTrinketDescription],
    art: entry.art,
    discovered,
    hoverScope: "collection-trinket",
    frameType: "trinket",
  }));
}

function getUniqueItems(discoveredUniqueIds: string[], start: number, pageSize: number): CollectionTileItem[] {
  return sliceDiscoveredEntries(sortedUniqueLibrary, discoveredUniqueIds, start, pageSize, (entry, discovered) => ({
    id: entry.id,
    title: discovered ? entry.displayName : COLLECTION_ITEMS_CONFIG.hiddenTitle,
    subtitle: undefined,
    descriptionLines: discovered ? [entry.description] : [COLLECTION_ITEMS_CONFIG.hiddenUniqueDescription],
    art: gearDefinitions[entry.id]?.art ?? "",
    discovered,
    hoverScope: "collection-unique",
    frameType: "unique",
  }));
}
