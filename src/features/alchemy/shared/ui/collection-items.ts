// Pure collection item shaping for cards, enemies, and boons.
// Depends on game-data libraries, card description formatting, and collection page size tuning.
// Used by collection UI layout and tests without owning rendering concerns.
import { COLLECTION_PAGE_SIZE, BOON_PAGE_SIZE } from "@/lib/game-constants";
import { cardLibrary, enemyBestiary, boonLibrary, type BestiaryEntry, type BoonEntry } from "@/lib/game-data";

import type { CollectionTab } from "../types";
import { getEffectiveCardDescriptionLines } from "../utils/card-description";

const COLLECTION_ITEMS_CONFIG = {
  pageSize: COLLECTION_PAGE_SIZE,
  hiddenTitle: "Undiscovered",
  hiddenCardDescription: "Discover this card during a run to reveal it here.",
  hiddenEnemyDescription: "Encounter this enemy to record its details.",
  hiddenBoonDescription: "Find this boon to reveal its effect.",
} as const;

export type CollectionTileItem = {
  id: string;
  title: string;
  subtitle: string | undefined;
  descriptionLines: string[];
  art: string;
  discovered: boolean;
  hoverScope: string;
  frameType: "card" | "bestiary" | "boon";
  enemyEntry?: BestiaryEntry;
};

function getCollectionPageSize(tab: CollectionTab): number {
  return tab === "boons" ? BOON_PAGE_SIZE : COLLECTION_PAGE_SIZE;
}

export function getCollectionTotalPages(collectionTab: CollectionTab) {
  const itemCount =
    collectionTab === "cards"
      ? cardLibrary.length
      : collectionTab === "bestiary"
        ? enemyBestiary.length
        : boonLibrary.length;

  return Math.max(1, Math.ceil(itemCount / getCollectionPageSize(collectionTab)));
}

export function getCollectionPageItems({
  collectionTab,
  discoveredCardIds,
  encounteredEnemyIds,
  discoveredBoonIds,
  bondedCompanions = {},
  page,
}: {
  collectionTab: CollectionTab;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredBoonIds: string[];
  bondedCompanions?: Record<string, number>;
  page: number;
}) {
  const items = getCollectionItems({
    collectionTab,
    discoveredCardIds,
    encounteredEnemyIds,
    discoveredBoonIds,
    bondedCompanions,
  });
  const pageSize = getCollectionPageSize(collectionTab);
  return items.slice(page * pageSize, (page + 1) * pageSize);
}

export function getCollectionFillerCount(itemCount: number, collectionTab: CollectionTab) {
  return Math.max(0, getCollectionPageSize(collectionTab) - itemCount);
}

function getCollectionItems({
  collectionTab,
  discoveredCardIds,
  encounteredEnemyIds,
  discoveredBoonIds,
  bondedCompanions = {},
}: {
  collectionTab: CollectionTab;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredBoonIds: string[];
  bondedCompanions?: Record<string, number>;
}) {
  if (collectionTab === "cards") return getCardItems(discoveredCardIds, bondedCompanions);
  if (collectionTab === "bestiary") return getBestiaryItems(encounteredEnemyIds);
  return getBoonItems(discoveredBoonIds);
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

export function getDiscoveryCardTileItems(cardIds: readonly string[]): CollectionTileItem[] {
  const idSet = new Set(cardIds);
  return cardLibrary
    .filter((card) => idSet.has(card.id))
    .sort((a, b) => cardIds.indexOf(a.id) - cardIds.indexOf(b.id))
    .map((card) => ({
      id: card.id,
      title: card.title,
      subtitle: undefined,
      descriptionLines: getEffectiveCardDescriptionLines(card),
      art: card.art,
      discovered: true,
      hoverScope: "discoveries-card" as const,
      frameType: "card" as const,
    }));
}

export function getDiscoveryBoonTileItems(boonIds: readonly string[]): CollectionTileItem[] {
  const idSet = new Set(boonIds);
  return boonLibrary
    .filter((entry) => idSet.has(entry.id))
    .sort((a, b) => boonIds.indexOf(a.id) - boonIds.indexOf(b.id))
    .map((entry: BoonEntry) => ({
      id: entry.id,
      title: entry.title,
      subtitle: undefined,
      descriptionLines: entry.descriptionLines,
      art: entry.art,
      discovered: true,
      hoverScope: "discoveries-boon" as const,
      frameType: "boon" as const,
    }));
}

function getBoonItems(discoveredBoonIds: string[]) {
  return [...boonLibrary]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((entry: BoonEntry) => {
      const discovered = discoveredBoonIds.includes(entry.id);
      return {
        id: entry.id,
        title: discovered ? entry.title : COLLECTION_ITEMS_CONFIG.hiddenTitle,
        subtitle: undefined,
        descriptionLines: discovered ? entry.descriptionLines : [COLLECTION_ITEMS_CONFIG.hiddenBoonDescription],
        art: entry.art,
        discovered,
        hoverScope: "collection-boon" as const,
        frameType: "boon" as const,
      };
    });
}
