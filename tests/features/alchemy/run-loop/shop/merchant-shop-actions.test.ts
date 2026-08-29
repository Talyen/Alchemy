import { describe, expect, it } from "vitest";
import { shopItemSlotKey } from "@/features/alchemy/run-loop/shop/shop-slot-keys";
import { setRunProgress } from "../../../../helpers/run-domain-store-test";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { buildActions, createInitialShopState, makeCard, requiredItem, setShopState } from "./shop-actions-harness";
import { SHOP_CARD_PRICE, SHOP_REMOVE_PRICE } from "@/lib/game-constants";

describe("merchant shop actions", () => {
  describe("merchant remove card", () => {
    it("deducts gold and removes card from deck", () => {
      setRunProgress({ gold: 999, runDeck: [makeCard({ id: "a" }), makeCard({ id: "b" })] });
      setShopState(createInitialShopState());
      const actions = buildActions();

      actions.merchant.removeCard(0);

      expect(readRunProfile().gold).toBe(999 - SHOP_REMOVE_PRICE);
      expect(readActiveRun().runDeck).toHaveLength(1);
      expect(readActiveRun().runDeck[0].id).toBe("b");
      expect(readRunSession().shopState.removeUsed).toBe(true);
    });

    it("does nothing when removeUsed is already true", () => {
      setRunProgress({ gold: 999 });
      setShopState({ ...createInitialShopState(), removeUsed: true });
      const actions = buildActions();

      actions.merchant.removeCard(0);

      expect(readRunProfile().gold).toBe(999);
    });

    it("does nothing for out-of-bounds index", () => {
      setRunProgress({ gold: 999, runDeck: [makeCard()] });
      setShopState(createInitialShopState());
      const actions = buildActions();

      actions.merchant.removeCard(-1);
      actions.merchant.removeCard(5);

      expect(readRunProfile().gold).toBe(999);
    });
  });
  describe("merchants-favor first-purchase discount", () => {
    it("applies discount on first purchase when trinket is owned", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions({ trinketIds: ["merchants-favor"] });
      const card = requiredItem(readRunSession().shopState.cards[0], "merchant card");

      const discountedPrice = SHOP_CARD_PRICE - 7;
      actions.merchant.buyCard(card, shopItemSlotKey(card.id, 0));

      expect(readRunProfile().gold).toBe(999 - discountedPrice);
    });

    it("does not apply discount on second purchase in same visit", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const firstActions = buildActions({ trinketIds: ["merchants-favor"] });
      const cards = readRunSession().shopState.cards;
      expect(cards.length).toBeGreaterThanOrEqual(2);
      const firstCard = requiredItem(cards[0], "first merchant card");
      const secondCard = requiredItem(cards[1], "second merchant card");

      firstActions.merchant.buyCard(firstCard, shopItemSlotKey(firstCard.id, 0));
      const discountPrice = SHOP_CARD_PRICE - 7;
      const goldAfterFirst = 999 - discountPrice;

      const result = firstActions.merchant.buyCard(secondCard, shopItemSlotKey(secondCard.id, 1));
      expect(result).toBe(true);
      expect(readRunProfile().gold).toBe(goldAfterFirst - SHOP_CARD_PRICE);
    });
  });
  describe("talent discounts", () => {
    it("applies haggle discount to shop card price", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions({ talentEffects: { shopCardDiscount: 5 } });
      const card = requiredItem(readRunSession().shopState.cards[0], "merchant card");

      expect(actions.merchant.getCardBuyPrice(card)).toBe(SHOP_CARD_PRICE - 5);
    });
  });
  describe("init", () => {
    it("initializes the merchant shop from the current deck", () => {
      setRunProgress({ runDeck: [makeCard()] });
      const actions = buildActions();

      actions.initialize("merchant");

      const shop = readRunSession().shopState;
      expect(shop.firstPurchaseUsed).toBe(false);
      expect(shop.purchasedSlotKeys).toHaveLength(0);
      expect(shop.cards.length).toBeGreaterThan(0);
    });
  });
  describe("selectors reflect current store state", () => {
    it("reads the current first-purchase state when pricing merchant cards", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const card = requiredItem(readRunSession().shopState.cards[0], "merchant card");

      buildActions().merchant.buyCard(card, shopItemSlotKey(card.id, 0));

      const postBuyActions = buildActions();
      expect(postBuyActions.merchant.getCardBuyPrice(card)).toBe(SHOP_CARD_PRICE);
    });
  });
});
