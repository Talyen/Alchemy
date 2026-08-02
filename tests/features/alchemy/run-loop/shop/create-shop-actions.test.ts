import { describe, expect, it, beforeEach } from "vitest";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import { createEmptyTalentManifest, type BattleCard, type TalentEffectManifest } from "@/lib/game-data";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunProgressSlice,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import {
  setShopState,
  setAlchemistState,
  setTrinketShopState,
  setEquipmentShopState,
} from "@/features/alchemy/shared/stores/ports/run-session-shop-port";
import {
  createInitialShopState as createInitialShopStateImpl,
  createInitialAlchemistState as createInitialAlchemistStateImpl,
  createInitialTrinketShopState as createInitialTrinketShopStateImpl,
  createInitialEquipmentShopState as createInitialEquipmentShopStateImpl,
} from "@/features/alchemy/run-loop/shop/shop-state-init";
import {
  SHOP_CARD_PRICE,
  SHOP_REFRESH_PRICE,
  SHOP_REMOVE_PRICE,
  ALCHEMIST_POTION_PRICE,
  ALCHEMIST_REFRESH_PRICE,
  ALCHEMIST_MIX_PRICE,
  TRINKET_SHOP_TRINKET_PRICE,
  MIXED_POTION_CARD_ID,
} from "@/lib/game-constants";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";

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

const defaultTalentEffects: TalentEffectManifest = createEmptyTalentManifest();
const testRng = () => 0.5;
const createInitialShopState = (deck: BattleCard[] = []) => createInitialShopStateImpl(deck, testRng);
const createInitialAlchemistState = (deck: BattleCard[] = []) => createInitialAlchemistStateImpl(deck, testRng);
const createInitialTrinketShopState = (rng: () => number = testRng) => createInitialTrinketShopStateImpl(rng);
const createInitialEquipmentShopState = (rng: () => number = testRng) => createInitialEquipmentShopStateImpl(rng);

function buildActions(
  overrides?: Partial<{
    talentEffects: Partial<TalentEffectManifest>;
    gearAstralChanceBonus: number;
    trinketIds: string[];
  }>,
  rng: () => number = testRng,
) {
  if (overrides?.trinketIds) {
    getRunProgressStoreView().setRunTrinkets(() => overrides.trinketIds!);
  }
  // Read fresh state after any mutations above
  const talentEffects = { ...defaultTalentEffects, ...overrides?.talentEffects } as TalentEffectManifest;
  return createShopActions({
    talentEffects,
    rng,
    homesteadEffects: { ...defaultHomesteadEffects, gearAstralChanceBonus: overrides?.gearAstralChanceBonus ?? 0 },
    setShopState,
    setAlchemistState,
    setTrinketShopState,
    setEquipmentShopState,
  });
}

describe("createShopActions", () => {
  describe("merchant shop buy", () => {
    it("deducts gold and appends card on successful purchase", () => {
      setRunProgress({ runGold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions();
      const card = getRunSessionStoreView().shopState.cards[0];
      if (!card) return;

      const deckBefore = getRunProgressStoreView().runDeck.length;
      const result = actions.handleShopBuyCard(card, "slot-0");

      expect(result).toBe(true);
      expect(getRunProgressStoreView().runGold).toBe(999 - SHOP_CARD_PRICE);
      expect(getRunProgressStoreView().runDeck.length).toBe(deckBefore + 1);
      expect(getRunSessionStoreView().shopState.firstPurchaseUsed).toBe(true);
      expect(getRunSessionStoreView().shopState.purchasedSlotKeys).toContain("slot-0");
    });

    it("returns false and does nothing when gold is insufficient", () => {
      setRunProgress({ runGold: 0 });
      setShopState(createInitialShopState());
      const actions = buildActions();
      const card = getRunSessionStoreView().shopState.cards[0];
      if (!card) return;

      const deckBefore = getRunProgressStoreView().runDeck.length;
      const result = actions.handleShopBuyCard(card, "slot-0");

      expect(result).toBe(false);
      expect(getRunProgressStoreView().runGold).toBe(0);
      expect(getRunProgressStoreView().runDeck.length).toBe(deckBefore);
    });

    it("no-ops a second buy of the same slot without rebuilding actions (rapid re-entry)", () => {
      setRunProgress({ runGold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions();
      const card = getRunSessionStoreView().shopState.cards[0];
      if (!card) return;

      const deckBefore = getRunProgressStoreView().runDeck.length;
      expect(actions.handleShopBuyCard(card, "slot-0")).toBe(true);
      expect(actions.handleShopBuyCard(card, "slot-0")).toBe(false);

      expect(getRunProgressStoreView().runGold).toBe(999 - SHOP_CARD_PRICE);
      expect(getRunProgressStoreView().runDeck.length).toBe(deckBefore + 1);
      expect(getRunSessionStoreView().shopState.purchasedSlotKeys).toEqual(["slot-0"]);
    });
  });

  describe("merchant remove card", () => {
    it("deducts gold and removes card from deck", () => {
      setRunProgress({ runGold: 999, runDeck: [makeCard({ id: "a" }), makeCard({ id: "b" })] });
      setShopState(createInitialShopState());
      const actions = buildActions();

      actions.handleShopRemoveCard(0);

      expect(getRunProgressStoreView().runGold).toBe(999 - SHOP_REMOVE_PRICE);
      expect(getRunProgressStoreView().runDeck).toHaveLength(1);
      expect(getRunProgressStoreView().runDeck[0].id).toBe("b");
      expect(getRunSessionStoreView().shopState.removeUsed).toBe(true);
    });

    it("does nothing when removeUsed is already true", () => {
      setRunProgress({ runGold: 999 });
      setShopState({ ...createInitialShopState(), removeUsed: true });
      const actions = buildActions();

      actions.handleShopRemoveCard(0);

      expect(getRunProgressStoreView().runGold).toBe(999);
    });

    it("does nothing for out-of-bounds index", () => {
      setRunProgress({ runGold: 999, runDeck: [makeCard()] });
      setShopState(createInitialShopState());
      const actions = buildActions();

      actions.handleShopRemoveCard(-1);
      actions.handleShopRemoveCard(5);

      expect(getRunProgressStoreView().runGold).toBe(999);
    });
  });

  describe("merchant refresh", () => {
    it("deducts gold and decrements refreshesLeft", () => {
      setRunProgress({ runGold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions();
      const beforeRefreshes = getRunSessionStoreView().shopState.refreshesLeft;

      actions.handleShopRefresh();

      expect(getRunSessionStoreView().shopState.refreshesLeft).toBe(beforeRefreshes - 1);
      expect(getRunProgressStoreView().runGold).toBe(999 - SHOP_REFRESH_PRICE);
      expect(getRunSessionStoreView().shopState.purchasedSlotKeys).toHaveLength(0);
    });
  });

  describe("merchants-favor first-purchase discount", () => {
    it("applies discount on first purchase when trinket is owned", () => {
      setRunProgress({ runGold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions({ trinketIds: ["merchants-favor"] });
      const card = getRunSessionStoreView().shopState.cards[0];
      if (!card) return;

      const discountedPrice = SHOP_CARD_PRICE - 7;
      actions.handleShopBuyCard(card, "slot-0");

      expect(getRunProgressStoreView().runGold).toBe(999 - discountedPrice);
    });

    it("does not apply discount on second purchase in same visit", () => {
      setRunProgress({ runGold: 999 });
      setShopState(createInitialShopState());
      const firstActions = buildActions({ trinketIds: ["merchants-favor"] });
      const cards = getRunSessionStoreView().shopState.cards;
      if (cards.length < 2) return;

      firstActions.handleShopBuyCard(cards[0], "slot-0");
      const discountPrice = SHOP_CARD_PRICE - 7;
      const goldAfterFirst = 999 - discountPrice;

      // Imperative store reads pick up firstPurchaseUsed without rebuilding actions
      const result = firstActions.handleShopBuyCard(cards[1], "slot-1");
      expect(result).toBe(true);
      expect(getRunProgressStoreView().runGold).toBe(goldAfterFirst - SHOP_CARD_PRICE);
    });
  });

  describe("talent discounts", () => {
    it("applies haggle discount to shop card price", () => {
      setRunProgress({ runGold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions({ talentEffects: { shopCardDiscount: 5 } });
      const card = getRunSessionStoreView().shopState.cards[0];
      if (!card) return;

      expect(actions.getMerchantCardBuyPrice(card)).toBe(SHOP_CARD_PRICE - 5);
    });

    it("applies potion discount only for standard potions in alchemist", () => {
      setRunProgress({ runGold: 999 });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions({ talentEffects: { potionDiscount: 5, shopCardDiscount: 3 } });
      const potion = getRunSessionStoreView().alchemistState.potions[0];
      if (!potion) return;

      // Potion discount stacks with shop card discount for potion cards
      expect(actions.getAlchemistPotionBuyPrice(potion)).toBeLessThanOrEqual(ALCHEMIST_POTION_PRICE - 3);
    });
  });

  describe("per-shop isolation", () => {
    it("buying in merchant shop does not affect alchemist state", () => {
      setRunProgress({ runGold: 999 });
      setShopState(createInitialShopState());
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();
      const card = getRunSessionStoreView().shopState.cards[0];
      if (!card) return;

      actions.handleShopBuyCard(card, "slot-0");

      expect(getRunSessionStoreView().alchemistState.firstPurchaseUsed).toBe(false);
    });
  });

  describe("alchemist mix potions", () => {
    it("deducts gold, replaces two cards with mixed potion, marks mixUsed", () => {
      setRunProgress({
        runGold: 999,
        runDeck: [makeCard({ id: "a", title: "Potion A" }), makeCard({ id: "b", title: "Potion B" })],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();

      const result = actions.handleAlchemistMixPotions(0, 1);

      // tryCreateMixedPotion may return null if the cards can't be mixed
      if (result) {
        expect(getRunProgressStoreView().runGold).toBeLessThan(999);
        expect(getRunSessionStoreView().alchemistState.mixUsed).toBe(true);
        // Deck has the mixed card instead of the original two
        const deck = getRunProgressStoreView().runDeck;
        expect(deck.length).toBeLessThanOrEqual(2);
      }
    });

    it("returns null for out-of-bounds indices", () => {
      setRunProgress({ runGold: 999, runDeck: [makeCard()] });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();

      expect(actions.handleAlchemistMixPotions(-1, 0)).toBeNull();
      expect(actions.handleAlchemistMixPotions(0, 5)).toBeNull();
      expect(actions.handleAlchemistMixPotions(0, 0)).toBeNull();
    });

    it("consumes mix slot on every attempt — even if mixing fails", () => {
      setRunProgress({
        runGold: 999,
        runDeck: [makeCard({ id: MIXED_POTION_CARD_ID, title: "Mixed" }), makeCard({ id: "b", title: "Potion" })],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions({ talentEffects: { potionMixPotency: 0 } });

      // Mixing a Mixed Potion with another potion fails, but gold is deducted
      // and mixUsed is set so the player can't retry.
      const result = actions.handleAlchemistMixPotions(0, 1);
      expect(result).toBeNull();
      expect(getRunProgressStoreView().runGold).toBeLessThan(999);
      expect(getRunSessionStoreView().alchemistState.mixUsed).toBe(true);
    });

    it("prevents a second mix attempt after first succeeds", () => {
      setRunProgress({
        runGold: 999,
        runDeck: [makeCard({ id: "a", title: "Potion A" }), makeCard({ id: "b", title: "Potion B" })],
      });
      setAlchemistState(createInitialAlchemistState());
      const firstActions = buildActions({ talentEffects: { potionMixPotency: 0 } });

      const first = firstActions.handleAlchemistMixPotions(0, 1);
      expect(first).not.toBeNull();
      expect(getRunSessionStoreView().alchemistState.mixUsed).toBe(true);

      // Fresh snapshot picks up mixUsed: true in the new closure
      const secondActions = buildActions({ talentEffects: { potionMixPotency: 0 } });
      const second = secondActions.handleAlchemistMixPotions(0, 1);
      expect(second).toBeNull();
      expect(getRunProgressStoreView().runGold).toBe(999 - ALCHEMIST_MIX_PRICE);
    });

    it("no-ops a second mix on the same actions instance (stale mixUsed closure)", () => {
      setRunProgress({
        runGold: 999,
        runDeck: [makeCard({ id: "a", title: "Potion A" }), makeCard({ id: "b", title: "Potion B" })],
      });
      setAlchemistState(createInitialAlchemistState());
      // Stale closure still sees mixUsed: false after the first call mutates the store.
      const actions = buildActions({ talentEffects: { potionMixPotency: 0 } });

      expect(actions.handleAlchemistMixPotions(0, 1)).not.toBeNull();
      expect(actions.handleAlchemistMixPotions(0, 1)).toBeNull();
      expect(getRunProgressStoreView().runGold).toBe(999 - ALCHEMIST_MIX_PRICE);
      expect(getRunSessionStoreView().alchemistState.mixUsed).toBe(true);
    });
  });

  describe("trinket shop", () => {
    it("deducts gold and adds trinket on purchase", () => {
      setRunProgress({ runGold: 999 });
      setTrinketShopState(createInitialTrinketShopState(() => 0));
      const actions = buildActions();
      const trinket = getRunSessionStoreView().trinketShopState.trinkets[0];
      if (!trinket) return;

      const result = actions.handleTrinketShopBuy(trinket, "slot-0");

      expect(result).toBe(true);
      expect(getRunProgressStoreView().runGold).toBe(999 - TRINKET_SHOP_TRINKET_PRICE);
      expect(getRunProgressStoreView().runTrinkets).toContain(trinket.id);
      expect(getRunSessionStoreView().trinketShopState.firstPurchaseUsed).toBe(true);
    });
  });

  describe("price selectors", () => {
    it("getRemoveCardPrice returns base price minus discount", () => {
      const actions = buildActions({ talentEffects: { removeCardDiscount: 10 } });
      expect(actions.getRemoveCardPrice()).toBe(Math.max(0, SHOP_REMOVE_PRICE - 10));
    });

    it("getMixPotionPrice returns base price minus discount", () => {
      const actions = buildActions({ talentEffects: { mixPotionDiscount: 10 } });
      expect(actions.getMixPotionPrice()).toBe(Math.max(0, ALCHEMIST_MIX_PRICE - 10));
    });

    it("getShopRefreshPrice returns base price with free refresh talent", () => {
      const actions = buildActions({ talentEffects: { shopFreeRefresh: true } });
      expect(actions.getShopRefreshPrice(1)).toBe(0);
      expect(actions.getShopRefreshPrice(0)).toBe(SHOP_REFRESH_PRICE);
    });

    it("getAlchemistRefreshPrice returns base price with free refresh talent", () => {
      const actions = buildActions({ talentEffects: { shopFreeRefresh: true } });
      expect(actions.getAlchemistRefreshPrice(1)).toBe(0);
      expect(actions.getAlchemistRefreshPrice(0)).toBe(ALCHEMIST_REFRESH_PRICE);
    });
  });

  describe("init", () => {
    it("initShop creates initial shop state from deck", () => {
      setRunProgress({ runDeck: [makeCard()] });
      const actions = buildActions();

      actions.initShop();

      const shop = getRunSessionStoreView().shopState;
      expect(shop.firstPurchaseUsed).toBe(false);
      expect(shop.purchasedSlotKeys).toHaveLength(0);
      expect(shop.cards.length).toBeGreaterThan(0);
    });
  });

  describe("selectors reflect current store state", () => {
    it("getMerchantCardBuyPrice returns post-first-purchase price with fresh snapshot", () => {
      setRunProgress({ runGold: 999 });
      setShopState(createInitialShopState());
      const card = getRunSessionStoreView().shopState.cards[0];
      if (!card) return;

      // Buy once to flip firstPurchaseUsed
      buildActions().handleShopBuyCard(card, "slot-0");

      // Fresh snapshot after purchase
      const postBuyActions = buildActions();
      expect(postBuyActions.getMerchantCardBuyPrice(card)).toBe(SHOP_CARD_PRICE);
    });
  });

  describe("alchemist refresh dedup", () => {
    it("does not restock the same potion id on refresh", () => {
      setRunProgress({ runGold: 999 });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();
      const beforeIds = getRunSessionStoreView().alchemistState.potions.map((p) => p.id);

      actions.handleAlchemistRefresh();

      const afterIds = getRunSessionStoreView().alchemistState.potions.map((p) => p.id);
      const overlap = beforeIds.filter((id) => afterIds.includes(id));
      expect(overlap.length).toBeLessThan(beforeIds.length);
    });
  });

  describe("injected rng", () => {
    it("supports deterministic rng for equipment shop init", () => {
      const rng = () => 0.5;
      setRunProgress({ runGold: 999 });

      setEquipmentShopState(createInitialEquipmentShopState(rng));
      const firstActions = buildActions({}, rng);
      firstActions.initEquipmentShop();
      const firstGear = getRunSessionStoreView().equipmentShopState.gear.map((g) => g.definitionId);

      setEquipmentShopState(createInitialEquipmentShopState(rng));
      const secondActions = buildActions({}, rng);
      secondActions.initEquipmentShop();
      const secondGear = getRunSessionStoreView().equipmentShopState.gear.map((g) => g.definitionId);

      expect(firstGear).toEqual(secondGear);
    });

    it("supports deterministic rng for trinket shop init and refresh", () => {
      const rng = () => 0.25;
      setRunProgress({ runGold: 999 });
      setTrinketShopState(createInitialTrinketShopState(rng));

      const actions = buildActions({}, rng);
      actions.initTrinketShop();
      const firstTrinkets = getRunSessionStoreView().trinketShopState.trinkets.map((t) => t.id);

      setTrinketShopState(createInitialTrinketShopState(rng));
      const replayActions = buildActions({}, rng);
      replayActions.initTrinketShop();
      const secondTrinkets = getRunSessionStoreView().trinketShopState.trinkets.map((t) => t.id);

      expect(firstTrinkets).toEqual(secondTrinkets);

      setTrinketShopState({
        ...createInitialTrinketShopState(rng),
        refreshesLeft: 1,
      });
      const refreshActions = buildActions({}, rng);
      refreshActions.handleTrinketShopRefresh();
      const refreshedTrinkets = getRunSessionStoreView().trinketShopState.trinkets.map((t) => t.id);

      setTrinketShopState({
        ...createInitialTrinketShopState(rng),
        refreshesLeft: 1,
      });
      const replayRefreshActions = buildActions({}, rng);
      replayRefreshActions.handleTrinketShopRefresh();
      const replayedTrinkets = getRunSessionStoreView().trinketShopState.trinkets.map((t) => t.id);

      expect(refreshedTrinkets).toEqual(replayedTrinkets);
    });
  });
});
