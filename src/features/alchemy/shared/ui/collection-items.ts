// Pure collection item shaping for cards, enemies, and trinkets.
// Depends on game-data libraries, card description formatting, and collection page size tuning.
// Used by collection UI layout and tests without owning rendering concerns.
import { COLLECTION_PAGE_SIZE, TRINKET_PAGE_SIZE } from "@/lib/game-constants";
import {
  cardLibrary,
  enemyBestiary,
  trinketLibrary,
  type BestiaryEntry,
  type TrinketEntry,
} from "@/features/alchemy/shared/config/game-data-catalog";

import type { CollectionTab } from "../types";
import { getEffectiveCardDescriptionLines } from "../utils/card-description";

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
  frameType: "card" | "bestiary" | "trinket";
  enemyEntry?: BestiaryEntry;
}

function getCollectionPageSize(tab: CollectionTab): number {
  return tab === "trinkets" ? TRINKET_PAGE_SIZE : COLLECTION_PAGE_SIZE;
}

export function getCollectionTotalPages(collectionTab: CollectionTab) {
  const itemCount =
    collectionTab === "cards"
      ? cardLibrary.length
      : collectionTab === "bestiary"
        ? enemyBestiary.length
        : trinketLibrary.length;

  return Math.max(1, Math.ceil(itemCount / getCollectionPageSize(collectionTab)));
}

export function getCollectionPageItems({
  collectionTab,
  discoveredCardIds,
  encounteredEnemyIds,
  discoveredTrinketIds,
  bondedCompanions = {},
  page,
}: {
  collectionTab: CollectionTab;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  bondedCompanions?: Record<string, number>;
  page: number;
}) {
  const pageSize = getCollectionPageSize(collectionTab);
  const start = page * pageSize;
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

function shapeCardItem(
  card: (typeof cardLibrary)[number],
  discovered: boolean,
  bondedCompanions: Record<string, number>,
): CollectionTileItem {
  const descriptionLines = discovered
    ? getEffectiveCardDescriptionLines(card, { companionBondLevels: bondedCompanions })
    : [COLLECTION_ITEMS_CONFIG.hiddenCardDescription];
  return {
    id: card.id,
    title: discovered ? card.title : COLLECTION_ITEMS_CONFIG.hiddenTitle,
    subtitle: undefined,
    descriptionLines,
    art: card.art,
    discovered,
    hoverScope: "collection-card",
    frameType: "card",
  };
}

function getCardItems(
  discoveredCardIds: string[],
  bondedCompanions: Record<string, number> = {},
  start: number,
  pageSize: number,
): CollectionTileItem[] {
  const discoveredSet = new Set(discoveredCardIds);
  return sortByTitle(cardLibrary)
    .slice(start, start + pageSize)
    .map((card) => shapeCardItem(card, discoveredSet.has(card.id), bondedCompanions));
}

function getBestiaryItems(encounteredEnemyIds: string[], start: number, pageSize: number): CollectionTileItem[] {
  const encounteredSet = new Set(encounteredEnemyIds);
  return sortByTitle(enemyBestiary)
    .slice(start, start + pageSize)
    .map((entry: BestiaryEntry) => {
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
  return sortByTitle(trinketLibrary)
    .slice(start, start + pageSize)
    .map((entry: TrinketEntry) => {
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
