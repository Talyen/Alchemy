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

type TileContent =
  | { frameType: "hero"; character: CharacterDefinition; unlockRequirementText: string }
  | { frameType: "card"; card: BattleCard; companionBondLevels: Record<string, number> }
  | { frameType: "bestiary"; enemyEntry: BestiaryEntry }
  | { frameType: "trinket" | "unique" };

type CatalogItem = {
  id: string;
  title: string;
  subtitle?: string | undefined;
  descriptionLines: string[];
  art: string;
} & TileContent;

export type CollectionTileItem = CatalogItem & { discovered: boolean };

function sortByTitle<T extends { title: string }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => a.title.localeCompare(b.title));
}

// Each tab owns its ordered content, default capacity, and hidden copy together.
// Catalog payloads stay available for decorative shine; discovery gates details.
const catalogs: Record<CollectionTab, { items: CatalogItem[]; pageSize: number; hiddenDescription: string }> = {
  heroes: {
    pageSize: COLLECTION_PAGE_SIZE,
    hiddenDescription: "",
    items: Object.values(characters).map((character) => ({
      id: character.id,
      title: character.name,
      art: characterArt[character.id],
      descriptionLines: [],
      frameType: "hero",
      character,
      unlockRequirementText: getCharacterUnlockMessage(character.id),
    })),
  },
  cards: {
    pageSize: COLLECTION_PAGE_SIZE,
    hiddenDescription: "Discover this card during a run to reveal it here.",
    items: sortByTitle(cardLibrary).map((card) => ({
      id: card.id,
      title: card.title,
      art: card.art,
      descriptionLines: [],
      frameType: "card",
      card,
      companionBondLevels: {},
    })),
  },
  bestiary: {
    pageSize: BESTIARY_PAGE_SIZE,
    hiddenDescription: "Encounter this enemy to record its details.",
    items: sortByTitle(enemyBestiary).map((enemyEntry) => ({
      id: enemyEntry.id,
      title: enemyEntry.title,
      subtitle: enemyEntry.subtitle,
      art: enemyEntry.art,
      descriptionLines: enemyEntry.descriptionLines,
      frameType: "bestiary",
      enemyEntry,
    })),
  },
  trinkets: {
    pageSize: TRINKET_PAGE_SIZE,
    hiddenDescription: "Find this trinket to reveal its effect.",
    items: sortByTitle(trinketLibrary).map((entry) => ({
      id: entry.id,
      title: entry.title,
      art: entry.art,
      descriptionLines: entry.descriptionLines,
      frameType: "trinket",
    })),
  },
  uniques: {
    pageSize: TRINKET_PAGE_SIZE,
    hiddenDescription: "Find this unique to reveal its effect.",
    items: [...uniqueItemList]
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map((entry) => ({
        id: entry.id,
        title: entry.displayName,
        art: gearDefinitions[entry.id]?.art ?? "",
        descriptionLines: [entry.description],
        frameType: "unique",
      })),
  },
};

export function getCollectionLibraryLength(tab: CollectionTab): number {
  return catalogs[tab].items.length;
}

export function getCollectionTotalPages(tab: CollectionTab, pageSize = catalogs[tab].pageSize) {
  return getPagination(getCollectionLibraryLength(tab), 0, pageSize).totalPages;
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
  pageSize = catalogs[collectionTab].pageSize,
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
}): CollectionTileItem[] {
  const catalog = catalogs[collectionTab];
  const discoveries = {
    heroes: [],
    cards: discoveredCardIds,
    bestiary: encounteredEnemyIds,
    trinkets: discoveredTrinketIds,
    uniques: discoveredUniqueIds,
  };
  const discoveredIds = new Set(discoveries[collectionTab]);
  const { page: safePage, pageSize: size } = getPagination(catalog.items.length, page, pageSize);
  const start = safePage * size;
  return catalog.items.slice(start, start + size).map((item) => {
    if (item.frameType === "hero") {
      const discovered = isCharacterUnlocked(item.character.id, finishedRunCharacters);
      return {
        ...item,
        discovered,
        unlockRequirementText: discovered ? "" : item.unlockRequirementText,
        descriptionLines: discovered ? [] : [item.unlockRequirementText],
      };
    }
    const discovered = discoveredIds.has(item.id);
    const tile = {
      ...item,
      discovered,
      title: discovered ? item.title : "Undiscovered",
      subtitle: discovered ? item.subtitle : undefined,
      descriptionLines: discovered ? item.descriptionLines : [catalog.hiddenDescription],
    };
    return tile.frameType === "card" ? { ...tile, companionBondLevels: bondedCompanions } : tile;
  });
}
