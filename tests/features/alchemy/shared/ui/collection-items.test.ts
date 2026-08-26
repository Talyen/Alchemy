import { describe, expect, it } from "vitest";

import {
  getCollectionFillerCount,
  getCollectionPageItems,
  getCollectionTotalPages,
} from "@/features/alchemy/shared/ui/collection-items";
import { COLLECTION_PAGE_SIZE, BESTIARY_PAGE_SIZE, TRINKET_PAGE_SIZE } from "@/lib/game-constants";
import { cardLibrary, characters, enemyBestiary, KNIGHT_UNLOCK_MESSAGE, trinketLibrary } from "@/lib/game-data";

const emptyDiscoveries = {
  discoveredCardIds: [] as string[],
  encounteredEnemyIds: [] as string[],
  discoveredTrinketIds: [] as string[],
};

describe("collection item helpers", () => {
  it("calculates total pages from the active tab library", () => {
    expect(getCollectionTotalPages("heroes")).toBe(
      Math.max(1, Math.ceil(Object.keys(characters).length / COLLECTION_PAGE_SIZE)),
    );
    expect(getCollectionTotalPages("cards")).toBe(Math.max(1, Math.ceil(cardLibrary.length / COLLECTION_PAGE_SIZE)));
    expect(getCollectionTotalPages("bestiary")).toBe(Math.max(1, Math.ceil(enemyBestiary.length / BESTIARY_PAGE_SIZE)));
    expect(getCollectionTotalPages("trinkets")).toBe(Math.max(1, Math.ceil(trinketLibrary.length / TRINKET_PAGE_SIZE)));
  });

  it("returns hidden card copy when a card has not been discovered", () => {
    const [item] = getCollectionPageItems({
      collectionTab: "cards",
      ...emptyDiscoveries,
      page: 0,
    });

    expect(item.title).toBe("Undiscovered");
    expect(item.descriptionLines).toEqual(["Discover this card during a run to reveal it here."]);
  });

  it("defers discovered card description lines until hover formatting", () => {
    const [item] = getCollectionPageItems({
      collectionTab: "cards",
      discoveredCardIds: cardLibrary.map((card) => card.id),
      encounteredEnemyIds: [],
      discoveredTrinketIds: [],
      page: 0,
    });

    expect(item.descriptionLines).toEqual([]);
    expect(item.card?.id).toBe(item.id);
  });

  it("keeps Knight unlocked and uses unlock copy for locked heroes", () => {
    const items = getCollectionPageItems({
      collectionTab: "heroes",
      ...emptyDiscoveries,
      finishedRunCharacters: [],
      page: 0,
    });

    expect(items).toHaveLength(Object.keys(characters).length);
    expect(items[0]).toMatchObject({
      id: "knight",
      title: "Knight",
      discovered: true,
      frameType: "hero",
    });
    expect(items[1]).toMatchObject({
      id: "rogue",
      title: "Rogue",
      discovered: false,
      descriptionLines: [KNIGHT_UNLOCK_MESSAGE],
    });
  });

  it("unlocks later heroes from finishedRunCharacters", () => {
    const items = getCollectionPageItems({
      collectionTab: "heroes",
      ...emptyDiscoveries,
      finishedRunCharacters: ["knight"],
      page: 0,
    });

    expect(items[1]?.discovered).toBe(true);
    expect(items[1]?.descriptionLines).toEqual([]);
  });

  it("clamps collection pages past the catalog to the last page", () => {
    const totalPages = getCollectionTotalPages("cards");
    const overflow = getCollectionPageItems({
      collectionTab: "cards",
      ...emptyDiscoveries,
      page: totalPages + 4,
    });
    const last = getCollectionPageItems({
      collectionTab: "cards",
      ...emptyDiscoveries,
      page: totalPages - 1,
    });

    expect(overflow.map((item) => item.id)).toEqual(last.map((item) => item.id));
  });

  it("fills incomplete collection pages to the configured page size", () => {
    expect(getCollectionFillerCount(0, "heroes")).toBe(COLLECTION_PAGE_SIZE);
    expect(getCollectionFillerCount(COLLECTION_PAGE_SIZE, "heroes")).toBe(0);
    expect(getCollectionFillerCount(0, "cards")).toBe(COLLECTION_PAGE_SIZE);
    expect(getCollectionFillerCount(COLLECTION_PAGE_SIZE - 1, "cards")).toBe(1);
    expect(getCollectionFillerCount(COLLECTION_PAGE_SIZE, "cards")).toBe(0);
  });
});
