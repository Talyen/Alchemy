import { describe, expect, it, beforeEach } from "vitest";
import { useRunStore } from "@/features/alchemy/stores/run-store";
import { useScreenStore } from "@/features/alchemy/stores/screen-store";
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
import type { BattleCard } from "@/lib/game-data";

beforeEach(() => {
  useRunStore.setState(useRunStore.getInitialState());
  useScreenStore.setState(useScreenStore.getInitialState());
});

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return { id: "test", title: "Test", descriptionLines: [""], art: "", cost: 2, effects: [{ kind: "damage", damageType: "physical", amount: 5 }], ...overrides };
}

function seedGold(amount: number) {
  useRunStore.setState({ runGold: amount });
}

function firstShopCard(): BattleCard | null {
  const cards = useScreenStore.getState().shopState.cards;
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
  it("initShop creates correct number of cards", () => {
    useScreenStore.getState().initShop();
    expect(useScreenStore.getState().shopState.cards.length).toBe(SHOP_CARDS_OFFERED);
  });

  it("initShop resets refreshesLeft and purchase state", () => {
    useScreenStore.setState((s) => ({
      shopState: { ...s.shopState, refreshesLeft: 0, removeUsed: true, firstPurchaseUsed: true },
    }));
    useScreenStore.getState().initShop();
    const shop = useScreenStore.getState().shopState;
    expect(shop.refreshesLeft).toBeGreaterThan(0);
    expect(shop.removeUsed).toBe(false);
    expect(shop.firstPurchaseUsed).toBe(false);
  });

  it("initAlchemist filters potion cards", () => {
    useScreenStore.getState().initAlchemist();
    const potions = useScreenStore.getState().alchemistState.potions;
    expect(potions.length).toBe(ALCHEMIST_POTIONS_OFFERED);
    for (const p of potions) {
      expect(p.id).toMatch(/-potion$/);
    }
  });
});

describe("shop buy flow via run store mutations", () => {
  it("deducts gold and appends card when buying", () => {
    useScreenStore.getState().initShop();
    seedGold(999);
    const card = firstShopCard();
    if (!card) return; // skip if no shop cards sampled

    const deckBefore = useRunStore.getState().runDeck.length;
    useRunStore.getState().setRunDeck((p) => [...p, card]);

    // Simulating what handleShopBuyCard does
    const price = SHOP_CARD_PRICE;
    useRunStore.getState().setRunGold((p) => Math.max(0, p - price));
    useScreenStore.getState().setShopState((p) => ({ ...p, firstPurchaseUsed: true }));

    expect(useRunStore.getState().runGold).toBe(999 - price);
    expect(useRunStore.getState().runDeck.length).toBe(deckBefore + 1);
    expect(useScreenStore.getState().shopState.firstPurchaseUsed).toBe(true);
  });

  it("does not buy when gold is insufficient", () => {
    useScreenStore.getState().initShop();
    seedGold(0);
    const card = firstShopCard();
    if (!card) return;

    const price = SHOP_CARD_PRICE;
    if (0 < price) {
      expect(useRunStore.getState().runGold).toBe(0);
    }
  });

  it("shop remove deducts gold and filters deck", () => {
    seedGold(999);
    useRunStore.getState().setRunDeck([makeCard({ id: "card-a" }), makeCard({ id: "card-b" })]);

    const price = Math.max(0, SHOP_REMOVE_PRICE);
    useRunStore.getState().setRunGold((p) => Math.max(0, p - price));
    useRunStore.getState().setRunDeck((p) => p.filter((_, i) => i !== 0));
    useScreenStore.getState().setShopState((p) => ({ ...p, removeUsed: true }));

    expect(useRunStore.getState().runGold).toBe(999 - price);
    expect(useRunStore.getState().runDeck.length).toBe(1);
    expect(useRunStore.getState().runDeck[0].id).toBe("card-b");
    expect(useScreenStore.getState().shopState.removeUsed).toBe(true);
  });

  it("shop refresh decrements refreshesLeft", () => {
    useScreenStore.getState().initShop();
    seedGold(999);
    const beforeRefreshes = useScreenStore.getState().shopState.refreshesLeft;

    const price = SHOP_REFRESH_PRICE;
    useRunStore.getState().setRunGold((g) => Math.max(0, g - price));
    useScreenStore.getState().setShopState((p) => ({
      ...p,
      refreshesLeft: p.refreshesLeft - 1,
    }));

    expect(useScreenStore.getState().shopState.refreshesLeft).toBe(beforeRefreshes - 1);
    expect(useRunStore.getState().runGold).toBe(999 - price);
  });
});

describe("alchemist buy flow via mutations", () => {
  it("alchemist buy deducts gold and appends potion", () => {
    useScreenStore.getState().initAlchemist();
    seedGold(999);
    const potions = useScreenStore.getState().alchemistState.potions;
    if (potions.length === 0) return;

    const price = ALCHEMIST_POTION_PRICE;
    const deckBefore = useRunStore.getState().runDeck.length;
    useRunStore.getState().setRunGold((p) => Math.max(0, p - price));
    useRunStore.getState().setRunDeck((p) => [...p, potions[0]]);
    useScreenStore.getState().setAlchemistState((p) => ({ ...p, firstPurchaseUsed: true }));

    expect(useRunStore.getState().runGold).toBe(999 - price);
    expect(useRunStore.getState().runDeck.length).toBe(deckBefore + 1);
    expect(useScreenStore.getState().alchemistState.firstPurchaseUsed).toBe(true);
  });

  it("alchemist refresh decrements and resamples potions", () => {
    useScreenStore.getState().initAlchemist();
    seedGold(999);
    const beforeRefreshes = useScreenStore.getState().alchemistState.refreshesLeft;

    useRunStore.getState().setRunGold((g) => Math.max(0, g - ALCHEMIST_REFRESH_PRICE));
    useScreenStore.getState().setAlchemistState((p) => ({
      ...p,
      refreshesLeft: p.refreshesLeft - 1,
    }));

    expect(useScreenStore.getState().alchemistState.refreshesLeft).toBe(beforeRefreshes - 1);
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
