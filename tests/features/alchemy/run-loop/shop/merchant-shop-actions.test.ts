import { describe, expect, it, vi } from "vitest";
import { shopItemSlotKey } from "@/features/alchemy/run-loop/shop/shop-slot-keys";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import { buildActions, createInitialShopState, makeCard, requiredItem, setShopState } from "./shop-actions-harness";
import { SHOP_CARD_PRICE, SHOP_REMOVE_PRICE } from "@/lib/game-constants";
import { playGoldSpend } from "@/lib/audio";

describe("merchant shop actions", () => {
  describe("merchant shop buy", () => {
    it("deducts gold and appends card on successful purchase", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions();
      const card = requiredItem(getRunSessionStoreView().shopState.cards[0], "merchant card");

      const deckBefore = getRunProgressStoreView().runDeck.length;
      vi.mocked(playGoldSpend).mockImplementationOnce(() => {
        expect(getRunProgressStoreView().gold).toBe(999 - SHOP_CARD_PRICE);
      });
      const slotKey = shopItemSlotKey(card.id, 0);
      const result = actions.merchant.buyCard(card, slotKey);

      expect(result).toBe(true);
      expect(getRunProgressStoreView().gold).toBe(999 - SHOP_CARD_PRICE);
      expect(getRunProgressStoreView().runDeck.length).toBe(deckBefore + 1);
      expect(getRunSessionStoreView().shopState.firstPurchaseUsed).toBe(true);
      expect(getRunSessionStoreView().shopState.purchasedSlotKeys).toContain(slotKey);
      expect(playGoldSpend).toHaveBeenCalledOnce();
    });

    it("returns false and does nothing when gold is insufficient", () => {
      setRunProgress({ gold: 0 });
      setShopState(createInitialShopState());
      const actions = buildActions();
      const card = requiredItem(getRunSessionStoreView().shopState.cards[0], "merchant card");

      const deckBefore = getRunProgressStoreView().runDeck.length;
      const result = actions.merchant.buyCard(card, shopItemSlotKey(card.id, 0));

      expect(result).toBe(false);
      expect(getRunProgressStoreView().gold).toBe(0);
      expect(getRunProgressStoreView().runDeck.length).toBe(deckBefore);
      expect(playGoldSpend).not.toHaveBeenCalled();
    });

    it("no-ops a second buy of the same slot without rebuilding actions (rapid re-entry)", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions();
      const card = requiredItem(getRunSessionStoreView().shopState.cards[0], "merchant card");

      const deckBefore = getRunProgressStoreView().runDeck.length;
      const slotKey = shopItemSlotKey(card.id, 0);
      expect(actions.merchant.buyCard(card, slotKey)).toBe(true);
      vi.mocked(playGoldSpend).mockClear();
      const commits: number[] = [];
      const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));
      expect(actions.merchant.buyCard(card, slotKey)).toBe(false);
      unsubscribe();

      expect(getRunProgressStoreView().gold).toBe(999 - SHOP_CARD_PRICE);
      expect(getRunProgressStoreView().runDeck.length).toBe(deckBefore + 1);
      expect(getRunSessionStoreView().shopState.purchasedSlotKeys).toEqual([slotKey]);
      expect(commits).toHaveLength(0);
      expect(playGoldSpend).not.toHaveBeenCalled();
    });
  });
  describe("merchant remove card", () => {
    it("deducts gold and removes card from deck", () => {
      setRunProgress({ gold: 999, runDeck: [makeCard({ id: "a" }), makeCard({ id: "b" })] });
      setShopState(createInitialShopState());
      const actions = buildActions();

      actions.merchant.removeCard(0);

      expect(getRunProgressStoreView().gold).toBe(999 - SHOP_REMOVE_PRICE);
      expect(getRunProgressStoreView().runDeck).toHaveLength(1);
      expect(getRunProgressStoreView().runDeck[0].id).toBe("b");
      expect(getRunSessionStoreView().shopState.removeUsed).toBe(true);
    });

    it("does nothing when removeUsed is already true", () => {
      setRunProgress({ gold: 999 });
      setShopState({ ...createInitialShopState(), removeUsed: true });
      const actions = buildActions();

      actions.merchant.removeCard(0);

      expect(getRunProgressStoreView().gold).toBe(999);
    });

    it("does nothing for out-of-bounds index", () => {
      setRunProgress({ gold: 999, runDeck: [makeCard()] });
      setShopState(createInitialShopState());
      const actions = buildActions();

      actions.merchant.removeCard(-1);
      actions.merchant.removeCard(5);

      expect(getRunProgressStoreView().gold).toBe(999);
    });
  });
  describe("merchant refresh reject", () => {
    it("returns false without a commit or sound when no refresh remains", () => {
      setRunProgress({ gold: 999 });
      setShopState({ ...createInitialShopState(), refreshesLeft: 0 });
      const actions = buildActions();
      const commits: number[] = [];
      const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

      expect(actions.merchant.refresh()).toBe(false);
      unsubscribe();

      expect(commits).toHaveLength(0);
      expect(playGoldSpend).not.toHaveBeenCalled();
    });
  });
  describe("merchants-favor first-purchase discount", () => {
    it("applies discount on first purchase when trinket is owned", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions({ trinketIds: ["merchants-favor"] });
      const card = requiredItem(getRunSessionStoreView().shopState.cards[0], "merchant card");

      const discountedPrice = SHOP_CARD_PRICE - 7;
      actions.merchant.buyCard(card, shopItemSlotKey(card.id, 0));

      expect(getRunProgressStoreView().gold).toBe(999 - discountedPrice);
    });

    it("does not apply discount on second purchase in same visit", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const firstActions = buildActions({ trinketIds: ["merchants-favor"] });
      const cards = getRunSessionStoreView().shopState.cards;
      expect(cards.length).toBeGreaterThanOrEqual(2);
      const firstCard = requiredItem(cards[0], "first merchant card");
      const secondCard = requiredItem(cards[1], "second merchant card");

      firstActions.merchant.buyCard(firstCard, shopItemSlotKey(firstCard.id, 0));
      const discountPrice = SHOP_CARD_PRICE - 7;
      const goldAfterFirst = 999 - discountPrice;

      // Imperative store reads pick up firstPurchaseUsed without rebuilding actions
      const result = firstActions.merchant.buyCard(secondCard, shopItemSlotKey(secondCard.id, 1));
      expect(result).toBe(true);
      expect(getRunProgressStoreView().gold).toBe(goldAfterFirst - SHOP_CARD_PRICE);
    });
  });
  describe("talent discounts", () => {
    it("applies haggle discount to shop card price", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions({ talentEffects: { shopCardDiscount: 5 } });
      const card = requiredItem(getRunSessionStoreView().shopState.cards[0], "merchant card");

      expect(actions.merchant.getCardBuyPrice(card)).toBe(SHOP_CARD_PRICE - 5);
    });
  });
  describe("init", () => {
    it("initializes the merchant shop from the current deck", () => {
      setRunProgress({ runDeck: [makeCard()] });
      const actions = buildActions();

      actions.initialize("merchant");

      const shop = getRunSessionStoreView().shopState;
      expect(shop.firstPurchaseUsed).toBe(false);
      expect(shop.purchasedSlotKeys).toHaveLength(0);
      expect(shop.cards.length).toBeGreaterThan(0);
    });
  });
  describe("selectors reflect current store state", () => {
    it("reads the current first-purchase state when pricing merchant cards", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const card = requiredItem(getRunSessionStoreView().shopState.cards[0], "merchant card");

      // Buy once to flip firstPurchaseUsed
      buildActions().merchant.buyCard(card, shopItemSlotKey(card.id, 0));

      // Fresh snapshot after purchase
      const postBuyActions = buildActions();
      expect(postBuyActions.merchant.getCardBuyPrice(card)).toBe(SHOP_CARD_PRICE);
    });
  });
  describe("merchant refresh dedup", () => {
    it("does not restock the same card id on refresh", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions();
      const beforeIds = getRunSessionStoreView().shopState.cards.map((card) => card.id);

      actions.merchant.refresh();

      const afterIds = getRunSessionStoreView().shopState.cards.map((card) => card.id);
      const overlap = beforeIds.filter((id) => afterIds.includes(id));
      expect(overlap.length).toBeLessThan(beforeIds.length);
    });
  });
});
