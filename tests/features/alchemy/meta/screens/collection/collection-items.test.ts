import { describe, expect, it } from "vitest";

import {
  getCollectionPageItems,
  getCollectionTotalPages,
} from "@/features/alchemy/meta/screens/collection/collection-items";
import { cardLibrary, characters, enemyBestiary, KNIGHT_UNLOCK_MESSAGE, trinketLibrary } from "@/lib/game-data";
import { uniqueItemList } from "@/lib/gear";
import { displayText, localization } from "@/lib/localization/runtime";

const emptyDiscoveries = {
  discoveredCardIds: [] as string[],
  encounteredEnemyIds: [] as string[],
  discoveredTrinketIds: [] as string[],
  discoveredUniqueIds: [] as string[],
};

function allUniqueItems(discoveredUniqueIds: string[] = []) {
  return Array.from({ length: getCollectionTotalPages("uniques") }, (_, page) =>
    getCollectionPageItems({
      collectionTab: "uniques",
      ...emptyDiscoveries,
      discoveredUniqueIds,
      page,
    }),
  ).flat();
}

describe("collection item helpers", () => {
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
      discoveredUniqueIds: [],
      page: 0,
    });

    expect(item.descriptionLines).toEqual([]);
    expect(item.frameType).toBe("card");
    if (item.frameType !== "card") throw new Error("expected card tile");
    expect(item.card.id).toBe(item.id);
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

  it.each(["bestiary", "trinkets"] as const)("masks %s details without changing catalog order", (collectionTab) => {
    const library = collectionTab === "bestiary" ? enemyBestiary : trinketLibrary;
    const sorted = [...library].sort((a, b) => a.title.localeCompare(b.title));
    const input = { collectionTab, ...emptyDiscoveries, page: 0, pageSize: 2 };
    const hidden = getCollectionPageItems(input);
    const revealed = getCollectionPageItems({
      ...input,
      encounteredEnemyIds: [sorted[0].id],
      discoveredTrinketIds: [sorted[0].id],
    });
    expect(hidden.map((item) => item.id)).toEqual(sorted.slice(0, 2).map((entry) => entry.id));
    expect(hidden.every((item) => !item.discovered && item.title === "Undiscovered")).toBe(true);
    expect(revealed[0]).toMatchObject({
      title: sorted[0].title,
      descriptionLines: sorted[0].descriptionLines,
      discovered: true,
    });
    expect(revealed[1]).toEqual(hidden[1]);
    expect(getCollectionPageItems(input)).toEqual(hidden);
  });

  it("sorts by the current localized title on every page", async () => {
    await localization.changeLanguage("en-XA");
    try {
      const expected = [...cardLibrary].sort((a, b) =>
        displayText(a.title).localeCompare(displayText(b.title), localization.language),
      );
      const actual = getCollectionPageItems({
        collectionTab: "cards",
        ...emptyDiscoveries,
        page: 0,
        pageSize: cardLibrary.length,
      });
      expect(actual.map((item) => item.id)).toEqual(expected.map((card) => card.id));
    } finally {
      await localization.changeLanguage("en");
    }
  });

  it("returns hidden unique copy until the unique is discovered", () => {
    const items = allUniqueItems();
    expect(items.map((item) => item.id).sort()).toEqual(uniqueItemList.map((item) => item.id).sort());
    const wardbreaker = items.find((item) => item.id === "wardbreaker");
    expect(wardbreaker).toMatchObject({
      title: "Undiscovered",
      discovered: false,
      frameType: "unique",
      descriptionLines: ["Find this unique to reveal its effect."],
    });
  });

  it("reveals unique name and signature when discovered", () => {
    const unique = uniqueItemList.find((entry) => entry.id === "wardbreaker");
    if (!unique) throw new Error("missing wardbreaker unique");
    const item = allUniqueItems(["wardbreaker"]).find((entry) => entry.id === "wardbreaker");

    expect(item).toMatchObject({
      title: unique.displayName,
      discovered: true,
      frameType: "unique",
      descriptionLines: [unique.description],
    });
    expect(item?.art).toBeTruthy();
  });
});
