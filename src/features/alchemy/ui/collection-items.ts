// Pure collection item shaping for cards, enemies, and trinkets.
// Depends on game-data libraries, card description formatting, and collection page size tuning.
// Used by collection UI layout and tests without owning rendering concerns.
import { COLLECTION_PAGE_SIZE } from "@/lib/game-constants";
import { cardLibrary, enemyBestiary, trinketLibrary, type BestiaryEntry, type TrinketEntry } from "@/lib/game-data";

import type { CollectionTab } from "../types";
import { getEffectiveCardDescriptionLines } from "../utils/card-description";

const COLLECTION_ITEMS_CONFIG = {
  pageSize: COLLECTION_PAGE_SIZE,
  hiddenTitle: "Undiscovered",
  hiddenCardDescription: "Discover this card during a run to reveal it here.",
  hiddenEnemyDescription: "Encounter this enemy to record its details.",
  hiddenTrinketDescription: "Find this trinket to reveal its effect.",
} as const;

export type CollectionTileItem = {
  id: string;
  title: string;
  subtitle: string | undefined;
  descriptionLines: string[];
  art: string;
  discovered: boolean;
  hoverScope: string;
  frameType: "card" | "bestiary" | "trinket";
  enemyEntry?: BestiaryEntry;
};

export function getCollectionTotalPages(collectionTab: CollectionTab) {
  const itemCount =
    collectionTab === "cards"
      ? cardLibrary.length
      : collectionTab === "bestiary"
        ? enemyBestiary.length
        : trinketLibrary.length;

  return Math.max(1, Math.ceil(itemCount / COLLECTION_ITEMS_CONFIG.pageSize));
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
  const items = getCollectionItems({
    collectionTab,
    discoveredCardIds,
    encounteredEnemyIds,
    discoveredTrinketIds,
    bondedCompanions,
  });
  return items.slice(page * COLLECTION_ITEMS_CONFIG.pageSize, (page + 1) * COLLECTION_ITEMS_CONFIG.pageSize);
}

export function getCollectionFillerCount(itemCount: number) {
  return Math.max(0, COLLECTION_ITEMS_CONFIG.pageSize - itemCount);
}

function getCollectionItems({
  collectionTab,
  discoveredCardIds,
  encounteredEnemyIds,
  discoveredTrinketIds,
  bondedCompanions = {},
}: {
  collectionTab: CollectionTab;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  bondedCompanions?: Record<string, number>;
}) {
  if (collectionTab === "cards") return getCardItems(discoveredCardIds, bondedCompanions);
  if (collectionTab === "bestiary") return getBestiaryItems(encounteredEnemyIds);
  return getTrinketItems(discoveredTrinketIds);
}

function getCardItems(discoveredCardIds: string[], bondedCompanions: Record<string, number> = {}) {
  return [...cardLibrary]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((card) => {
      const discovered = discoveredCardIds.includes(card.id);
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
        hoverScope: "collection-card" as const,
        frameType: "card" as const,
      };
    });
}

function getBestiaryItems(encounteredEnemyIds: string[]) {
  return [...enemyBestiary]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((entry: BestiaryEntry) => {
      const discovered = encounteredEnemyIds.includes(entry.id);
      return {
        id: entry.id,
        title: discovered ? entry.title : COLLECTION_ITEMS_CONFIG.hiddenTitle,
        subtitle: discovered ? entry.subtitle : undefined,
        descriptionLines: discovered ? entry.descriptionLines : [COLLECTION_ITEMS_CONFIG.hiddenEnemyDescription],
        art: entry.art,
        discovered,
        hoverScope: "collection-bestiary" as const,
        frameType: "bestiary" as const,
        enemyEntry: entry,
      };
    });
}

function getTrinketItems(discoveredTrinketIds: string[]) {
  return [...trinketLibrary]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((entry: TrinketEntry) => {
      const discovered = discoveredTrinketIds.includes(entry.id);
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
