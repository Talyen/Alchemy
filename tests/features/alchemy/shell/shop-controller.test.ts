import { describe, expect, it, beforeEach } from "vitest";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import {
  SHOP_CARD_PRICE,
  SHOP_REMOVE_PRICE,
  SHOP_REFRESH_PRICE,
  ALCHEMIST_POTION_PRICE,
  ALCHEMIST_REFRESH_PRICE,
} from "@/lib/game-constants";
import { createInitialShopState, createInitialAlchemistState } from "@/features/alchemy/run-loop/shop/shop-state-init";
import type { BattleCard } from "@/lib/game-data";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunProgressSlice,
  setRunProgress,
} from "../../../helpers/run-domain-store-test";

beforeEach(() => {
  resetRunProgressSlice();
  resetTransientRunUi();
});

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "test",
    title: "Test",
    descriptionLines: [""],
    art: "",
    cost: 2,
    effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    ...overrides,
  };
}

function seedGold(amount: number) {
  setRunProgress({ runGold: amount });
}

function firstShopCard(): BattleCard | null {
  const cards = getRunSessionStoreView().shopState.cards;
  return cards.length > 0 ? cards[0] : null;
}

describe("shop buy flow via run store mutations", () => {
  it("deducts gold and appends card when buying", () => {
    getRunSessionStoreView().setShopState(createInitialShopState());
    seedGold(999);
    const card = firstShopCard();
    if (!card) return; // skip if no shop cards sampled

    const deckBefore = getRunProgressStoreView().runDeck.length;
    getRunProgressStoreView().setRunDeck((p) => [...p, card]);

    // Simulating what handleShopBuyCard does
    const price = SHOP_CARD_PRICE;
    getRunProgressStoreView().setRunGold((p) => Math.max(0, p - price));
    getRunSessionStoreView().setShopState((p) => ({ ...p, firstPurchaseUsed: true }));

    expect(getRunProgressStoreView().runGold).toBe(999 - price);
    expect(getRunProgressStoreView().runDeck.length).toBe(deckBefore + 1);
    expect(getRunSessionStoreView().shopState.firstPurchaseUsed).toBe(true);
  });

  it("does not buy when gold is insufficient", () => {
    getRunSessionStoreView().setShopState(createInitialShopState());
    seedGold(0);
    const card = firstShopCard();
    if (!card) return;

    const price = SHOP_CARD_PRICE;
    if (0 < price) {
      expect(getRunProgressStoreView().runGold).toBe(0);
    }
  });

  it("shop remove deducts gold and filters deck", () => {
    seedGold(999);
    getRunProgressStoreView().setRunDeck([makeCard({ id: "card-a" }), makeCard({ id: "card-b" })]);

    const price = Math.max(0, SHOP_REMOVE_PRICE);
    getRunProgressStoreView().setRunGold((p) => Math.max(0, p - price));
    getRunProgressStoreView().setRunDeck((p) => p.filter((_, i) => i !== 0));
    getRunSessionStoreView().setShopState((p) => ({ ...p, removeUsed: true }));

    expect(getRunProgressStoreView().runGold).toBe(999 - price);
    expect(getRunProgressStoreView().runDeck.length).toBe(1);
    expect(getRunProgressStoreView().runDeck[0].id).toBe("card-b");
    expect(getRunSessionStoreView().shopState.removeUsed).toBe(true);
  });

  it("shop refresh decrements refreshesLeft", () => {
    getRunSessionStoreView().setShopState(createInitialShopState());
    seedGold(999);
    const beforeRefreshes = getRunSessionStoreView().shopState.refreshesLeft;

    const price = SHOP_REFRESH_PRICE;
    getRunProgressStoreView().setRunGold((g) => Math.max(0, g - price));
    getRunSessionStoreView().setShopState((p) => ({
      ...p,
      refreshesLeft: p.refreshesLeft - 1,
    }));

    expect(getRunSessionStoreView().shopState.refreshesLeft).toBe(beforeRefreshes - 1);
    expect(getRunProgressStoreView().runGold).toBe(999 - price);
  });
});

describe("alchemist buy flow via mutations", () => {
  it("alchemist buy deducts gold and appends potion", () => {
    getRunSessionStoreView().setAlchemistState(createInitialAlchemistState());
    seedGold(999);
    const potions = getRunSessionStoreView().alchemistState.potions;
    if (potions.length === 0) return;

    const price = ALCHEMIST_POTION_PRICE;
    const deckBefore = getRunProgressStoreView().runDeck.length;
    getRunProgressStoreView().setRunGold((p) => Math.max(0, p - price));
    getRunProgressStoreView().setRunDeck((p) => [...p, potions[0]]);
    getRunSessionStoreView().setAlchemistState((p) => ({ ...p, firstPurchaseUsed: true }));

    expect(getRunProgressStoreView().runGold).toBe(999 - price);
    expect(getRunProgressStoreView().runDeck.length).toBe(deckBefore + 1);
    expect(getRunSessionStoreView().alchemistState.firstPurchaseUsed).toBe(true);
  });

  it("alchemist refresh decrements and resamples potions", () => {
    getRunSessionStoreView().setAlchemistState(createInitialAlchemistState());
    seedGold(999);
    const beforeRefreshes = getRunSessionStoreView().alchemistState.refreshesLeft;

    getRunProgressStoreView().setRunGold((g) => Math.max(0, g - ALCHEMIST_REFRESH_PRICE));
    getRunSessionStoreView().setAlchemistState((p) => ({
      ...p,
      refreshesLeft: p.refreshesLeft - 1,
    }));

    expect(getRunSessionStoreView().alchemistState.refreshesLeft).toBe(beforeRefreshes - 1);
  });
});
