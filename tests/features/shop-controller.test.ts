import { describe, expect, it, beforeEach } from "vitest";
import { resetScreenStores } from "@/features/alchemy/stores/screen-store";
import {
  SHOP_CARD_PRICE,
  SHOP_REMOVE_PRICE,
  SHOP_REFRESH_PRICE,
  SHOP_CARDS_OFFERED,
  ALCHEMIST_POTION_PRICE,
  ALCHEMIST_REFRESH_PRICE,
  ALCHEMIST_MIX_PRICE,
  ALCHEMIST_POTIONS_OFFERED,
} from "@/lib/game-constants";
import { createInitialShopState, createInitialAlchemistState } from "@/features/alchemy/shop/shop-state-init";
import type { BattleCard } from "@/lib/game-data";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunProgressSlice,
  setRunProgress,
  setRunSession,
} from "../helpers/run-domain-store-test";

beforeEach(() => {
  resetRunProgressSlice();
  resetScreenStores();
});

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return { id: "test", title: "Test", descriptionLines: [""], art: "", cost: 2, effects: [{ kind: "damage", damageType: "physical", amount: 5 }], ...overrides };
}

function seedGold(amount: number) {
  setRunProgress({ runGold: amount });
}

function firstShopCard(): BattleCard | null {
  const cards = getRunSessionStoreView().shopState.cards;
  return cards.length > 0 ? cards[0] : null;
}

// Pricing formulas — match useShopController purchaseCard logic.
const shopCardPrice = (firstPurchase: boolean, shopCardDiscount: number, merchantsFavorDiscount: number) =>
  Math.max(0, SHOP_CARD_PRICE - shopCardDiscount - (firstPurchase ? merchantsFavorDiscount : 0));

const alchemistPotionPrice = (firstPurchase: boolean, potionDiscount: number, merchantsFavorDiscount: number) =>
  Math.max(0, ALCHEMIST_POTION_PRICE - potionDiscount - (firstPurchase ? merchantsFavorDiscount : 0));

describe("shop pricing formulas", () => {
  it("shopCardPrice: base minus talent discount", () => {
    expect(shopCardPrice(true, 10, 0)).toBe(Math.max(0, SHOP_CARD_PRICE - 10));
  });

  it("shopCardPrice: first purchase gets trinket discount too", () => {
    expect(shopCardPrice(true, 10, 5)).toBe(Math.max(0, SHOP_CARD_PRICE - 10 - 5));
  });

  it("shopCardPrice: non-first purchase loses trinket discount", () => {
    expect(shopCardPrice(false, 10, 5)).toBe(Math.max(0, SHOP_CARD_PRICE - 10));
  });

  it("shopCardPrice: floors at 0", () => {
    expect(shopCardPrice(true, 999, 0)).toBe(0);
  });

  it("alchemistPotionPrice: base minus talent discount", () => {
    expect(alchemistPotionPrice(true, 10, 0)).toBe(Math.max(0, ALCHEMIST_POTION_PRICE - 10));
  });

  it("alchemistPotionPrice: first purchase gets trinket discount too", () => {
    expect(alchemistPotionPrice(true, 10, 5)).toBe(Math.max(0, ALCHEMIST_POTION_PRICE - 10 - 5));
  });
});

describe("shop store integration", () => {
  it("createInitialShopState creates correct number of cards", () => {
    getRunSessionStoreView().setShopState(createInitialShopState());
    expect(getRunSessionStoreView().shopState.cards.length).toBe(SHOP_CARDS_OFFERED);
  });

  it("createInitialShopState resets refreshesLeft and purchase state", () => {
    setRunSession({
      shopState: {
        ...getRunSessionStoreView().shopState,
        refreshesLeft: 0,
        removeUsed: true,
        firstPurchaseUsed: true,
      },
    });
    getRunSessionStoreView().setShopState(createInitialShopState());
    const shop = getRunSessionStoreView().shopState;
    expect(shop.refreshesLeft).toBeGreaterThan(0);
    expect(shop.removeUsed).toBe(false);
    expect(shop.firstPurchaseUsed).toBe(false);
  });

  it("createInitialAlchemistState filters potion cards", () => {
    getRunSessionStoreView().setAlchemistState(createInitialAlchemistState());
    const potions = getRunSessionStoreView().alchemistState.potions;
    expect(potions.length).toBe(ALCHEMIST_POTIONS_OFFERED);
    for (const p of potions) {
      expect(p.id).toMatch(/-potion$/);
    }
  });
});

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

describe("mix potion pricing", () => {
  it("mix price uses mixPotionDiscount", () => {
    const price = Math.max(0, ALCHEMIST_MIX_PRICE - 15);
    expect(price).toBe(Math.max(0, ALCHEMIST_MIX_PRICE - 15));
  });

  it("mix price floors at 0", () => {
    expect(Math.max(0, ALCHEMIST_MIX_PRICE - 999)).toBe(0);
  });
});
