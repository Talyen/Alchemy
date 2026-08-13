import { describe, expect, it } from "vitest";

import {
  getCollectionFillerCount,
  getCollectionPageItems,
  getCollectionTotalPages,
} from "@/features/alchemy/shared/ui/collection-items";
import { COLLECTION_PAGE_SIZE, BESTIARY_PAGE_SIZE } from "@/lib/game-constants";
import { cardLibrary, enemyBestiary } from "@/lib/game-data";

describe("collection item helpers", () => {
  it("calculates total pages from the active tab library", () => {
    expect(getCollectionTotalPages("cards")).toBe(Math.max(1, Math.ceil(cardLibrary.length / COLLECTION_PAGE_SIZE)));
    expect(getCollectionTotalPages("bestiary")).toBe(Math.max(1, Math.ceil(enemyBestiary.length / BESTIARY_PAGE_SIZE)));
  });

  it("returns hidden card copy when a card has not been discovered", () => {
    const [item] = getCollectionPageItems({
      collectionTab: "cards",
      discoveredCardIds: [],
      encounteredEnemyIds: [],
      discoveredTrinketIds: [],
      page: 0,
    });

    expect(item.title).toBe("Undiscovered");
    expect(item.descriptionLines).toEqual(["Discover this card during a run to reveal it here."]);
  });

  it("fills incomplete collection pages to the configured page size", () => {
    expect(getCollectionFillerCount(0, "cards")).toBe(COLLECTION_PAGE_SIZE);
    expect(getCollectionFillerCount(COLLECTION_PAGE_SIZE - 1, "cards")).toBe(1);
    expect(getCollectionFillerCount(COLLECTION_PAGE_SIZE, "cards")).toBe(0);
  });
});
