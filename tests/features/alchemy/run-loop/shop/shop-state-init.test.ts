const lootProgress = { depth: 24, highestCompletedDifficulty: null };
import { describe, expect, it } from "vitest";
import {
  createInitialShopState as createInitialShopStateImpl,
  createInitialAlchemistState as createInitialAlchemistStateImpl,
  createInitialTrinketShopState as createInitialTrinketShopStateImpl,
  resampleCardShopOfferings,
  resampleTrinketShopOfferings,
  resampleEquipmentShopOfferings,
} from "@/features/alchemy/run-loop/shop/shop-state-init";
import { hydrateTrinketShopState, serializeTrinketShopState, shopItemSlotKey } from "@/lib/active-run-session";
import {
  SHOP_CARDS_OFFERED,
  ALCHEMIST_POTIONS_OFFERED,
  TRINKET_SHOP_OFFERED,
  EQUIPMENT_SHOP_OFFERED,
} from "@/lib/game-constants";
import { trinketLibrary } from "@/lib/game-data";
import { getOfferableCardPool, getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import { gearDefinitions } from "@/lib/gear";

import { makeEffect, makeTestCardWithId } from "../../../../fixtures/battle";

const testRng = () => 0.5;
const createInitialShopState = () => createInitialShopStateImpl([], testRng);
const createInitialAlchemistState = () => createInitialAlchemistStateImpl([], testRng);
const createInitialTrinketShopState = (rng: () => number = testRng) => createInitialTrinketShopStateImpl(rng);

describe("shop-state-init", () => {
  it.each([
    {
      room: "Merchant",
      offers: () => createInitialShopState().cards,
      pool: getOfferableCardPool,
      count: SHOP_CARDS_OFFERED,
    },
    {
      room: "Alchemist",
      offers: () => createInitialAlchemistState().potions,
      pool: getStandardPotionPool,
      count: ALCHEMIST_POTIONS_OFFERED,
    },
  ])("opens $room with a full, distinct shelf from its eligible catalog", ({ offers, pool, count }) => {
    const shelf = offers();
    const eligible = new Set(pool().map((card) => card.id));
    expect(shelf).toHaveLength(count);
    expect(new Set(shelf.map((card) => card.id)).size).toBe(count);
    expect(shelf.every((card) => eligible.has(card.id))).toBe(true);
  });
  it.each([
    { name: "enough novel cards", currentCount: 1, novelCount: 3 },
    { name: "one novel card", currentCount: 3, novelCount: 1 },
    { name: "no novel cards", currentCount: 4, novelCount: 0 },
  ])("fills card shelves with maximum novelty when there are $name", ({ currentCount, novelCount }) => {
    const pool = ["a", "b", "c", "d"].map((id) => makeTestCardWithId(id, { effects: [makeEffect("physical", 1)] }));
    const current = pool.slice(0, currentCount);
    const refreshed = resampleCardShopOfferings([pool[0]!], pool, current, 3, testRng);
    expect(refreshed).toHaveLength(3);
    expect(new Set(refreshed.map((card) => card.id)).size).toBe(3);
    expect(refreshed.every((card) => pool.includes(card))).toBe(true);
    expect(refreshed.filter((card) => !current.some((old) => old.id === card.id))).toHaveLength(novelCount);
  });

  it("keeps Bowyer shelves full when every eligible base was already offered", () => {
    const previous = resampleEquipmentShopOfferings(testRng, lootProgress, 0, new Set(), ["bowyer"]);
    const refreshed = resampleEquipmentShopOfferings(
      testRng,
      lootProgress,
      0,
      new Set(),
      ["bowyer", "masterwork"],
      previous,
    );
    expect(refreshed).toHaveLength(EQUIPMENT_SHOP_OFFERED);
    expect(new Set(refreshed.map((item) => gearDefinitions[item.definitionId]!.baseItemId)).size).toBe(3);
    expect(refreshed.every((item) => gearDefinitions[item.definitionId]!.rarity === "astral")).toBe(true);
  });

  it("prefers unseen trinkets, excluding owned and current shelf offerings", () => {
    const owned = trinketLibrary[0]!;
    const offerings = resampleTrinketShopOfferings(() => 0, lootProgress, [owned.id]);
    expect(offerings).toHaveLength(TRINKET_SHOP_OFFERED);
    expect(offerings.map((entry) => entry.id)).not.toContain(owned.id);

    const currentIds: string[] = trinketLibrary.slice(0, TRINKET_SHOP_OFFERED).map((entry) => entry.id);
    const refreshed = resampleTrinketShopOfferings(() => 0.5, lootProgress, [], currentIds);
    expect(refreshed).toHaveLength(TRINKET_SHOP_OFFERED);
    expect(refreshed.some((entry) => currentIds.includes(entry.id))).toBe(false);
  });

  it.each([
    {
      name: "tops up with the remaining novel trinket when the unseen pool is smaller than the shelf",
      setup: () => {
        const current = trinketLibrary.slice(0, TRINKET_SHOP_OFFERED);
        const novel = trinketLibrary[TRINKET_SHOP_OFFERED]!;
        const eligibleIds = new Set([...current.map((entry) => entry.id), novel.id]);
        return {
          owned: trinketLibrary.filter((entry) => !eligibleIds.has(entry.id)).map((entry): string => entry.id),
          currentIds: current.map((entry) => entry.id),
          expectedLength: TRINKET_SHOP_OFFERED,
          expectedIds: [novel.id] as string[],
        };
      },
    },
    {
      name: "caps the shelf at the available count when almost all trinkets are owned",
      setup: () => {
        const keep = trinketLibrary.slice(0, 2).map((entry) => entry.id);
        return {
          owned: trinketLibrary.filter((entry) => !keep.includes(entry.id)).map((entry): string => entry.id),
          currentIds: keep,
          expectedLength: keep.length,
          expectedIds: keep,
        };
      },
    },
    {
      name: "reuses the current shelf when no novel alternatives remain",
      setup: () => {
        const eligible = trinketLibrary.slice(0, TRINKET_SHOP_OFFERED).map((entry) => entry.id);
        return {
          owned: trinketLibrary.filter((entry) => !eligible.includes(entry.id)).map((entry): string => entry.id),
          currentIds: eligible,
          expectedLength: TRINKET_SHOP_OFFERED,
          expectedIds: eligible,
        };
      },
    },
  ])("$name", ({ setup }) => {
    const { owned, currentIds, expectedLength, expectedIds } = setup();
    const offerings = resampleTrinketShopOfferings(() => 0.5, lootProgress, owned, currentIds);
    expect(offerings).toHaveLength(expectedLength);
    expect(offerings.every((entry) => !owned.includes(entry.id))).toBe(true);
    for (const id of expectedIds) expect(offerings.map((entry) => entry.id)).toContain(id);
  });

  it("round-trips trinket shop state through persistence helpers", () => {
    const state = createInitialTrinketShopState(() => 0.1);
    const purchased = shopItemSlotKey(state.trinkets[0]!.id, 0);
    state.refreshesLeft = 2;
    state.firstPurchaseUsed = true;
    state.purchasedSlotKeys = [purchased];
    const restored = hydrateTrinketShopState(serializeTrinketShopState(state));
    expect(restored.trinkets.map((trinket) => trinket.id)).toEqual(state.trinkets.map((trinket) => trinket.id));
    expect(restored.refreshesLeft).toBe(2);
    expect(restored.firstPurchaseUsed).toBe(true);
    expect(restored.purchasedSlotKeys).toEqual([purchased]);
  });
});
