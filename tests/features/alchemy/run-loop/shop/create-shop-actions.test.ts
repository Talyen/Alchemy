import "../../../../helpers/mock-audio";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import { shopItemSlotKey } from "@/features/alchemy/run-loop/shop/shop-slot-keys";
import { createEmptyTalentEffectManifest, type BattleCard, type TalentEffectManifest } from "@/lib/game-data";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";
import {
  createRunSessionCommand,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/run-session-command";
import { useGearStore, getRunTransientStore, resetAllTestStores } from "../../../../helpers/gameplay-store-test";
import {
  setShopState as mutateShopState,
  setAlchemistState as mutateAlchemistState,
  setTrinketShopState as mutateTrinketShopState,
  setEquipmentShopState as mutateEquipmentShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";

const setShopState = createRunSessionCommand(mutateShopState);
const setAlchemistState = createRunSessionCommand(mutateAlchemistState);
const setTrinketShopState = createRunSessionCommand(mutateTrinketShopState);
const setEquipmentShopState = createRunSessionCommand(mutateEquipmentShopState);
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
import type { GearInstance } from "@/lib/gear";
import { createRunRngState } from "@/lib/run-rng";
import { makeTestCard } from "../../../../fixtures/cards";
import { makeEffect } from "../../../../fixtures/battle";

import { playGoldSpend } from "@/lib/audio";

beforeEach(() => {
  resetAllTestStores();
  useGearStore.getState().reset();
});

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return makeTestCard({ cost: 2, effects: [makeEffect("physical", 5)], ...overrides });
}

function requiredItem<T>(value: T | undefined, label: string): T {
  expect(value, `${label} fixture should exist`).toBeDefined();
  return value as T;
}

const defaultTalentEffects: TalentEffectManifest = createEmptyTalentEffectManifest();
const testRng = () => 0.5;
const createInitialShopState = (deck: BattleCard[] = []) => createInitialShopStateImpl(deck, testRng);
const createInitialAlchemistState = (deck: BattleCard[] = []) => createInitialAlchemistStateImpl(deck, testRng);
const createInitialTrinketShopState = (rng: () => number = testRng) => createInitialTrinketShopStateImpl(rng);
const createInitialEquipmentShopState = (rng: () => number = testRng) => createInitialEquipmentShopStateImpl(rng);

function buildActions(
  overrides?: Partial<{
    talentEffects: Partial<TalentEffectManifest>;
    homesteadEffects: Partial<typeof defaultHomesteadEffects>;
    gearAstralChanceBonus: number;
    trinketIds: string[];
  }>,
) {
  if (overrides?.trinketIds) {
    getRunProgressStoreView().setRunBoons(() => overrides.trinketIds!);
  }
  // Read fresh state after any mutations above
  const talentEffects = { ...defaultTalentEffects, ...overrides?.talentEffects } as TalentEffectManifest;
  return createShopActions({
    talentEffects,
    homesteadEffects: {
      ...defaultHomesteadEffects,
      gearAstralChanceBonus: overrides?.gearAstralChanceBonus ?? 0,
      ...overrides?.homesteadEffects,
    },
  });
}

describe("createShopActions", () => {
  describe("merchant shop buy", () => {
    it("deducts gold and appends card on successful purchase", () => {
      setRunProgress({ runGold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions();
      const card = requiredItem(getRunSessionStoreView().shopState.cards[0], "merchant card");

      const deckBefore = getRunProgressStoreView().runDeck.length;
      vi.mocked(playGoldSpend).mockImplementationOnce(() => {
        expect(getRunProgressStoreView().runGold).toBe(999 - SHOP_CARD_PRICE);
      });
      const slotKey = shopItemSlotKey(card.id, 0);
      const result = actions.merchant.buyCard(card, slotKey);

      expect(result).toBe(true);
      expect(getRunProgressStoreView().runGold).toBe(999 - SHOP_CARD_PRICE);
      expect(getRunProgressStoreView().runDeck.length).toBe(deckBefore + 1);
      expect(getRunSessionStoreView().shopState.firstPurchaseUsed).toBe(true);
      expect(getRunSessionStoreView().shopState.purchasedSlotKeys).toContain(slotKey);
      expect(playGoldSpend).toHaveBeenCalledOnce();
    });

    it("returns false and does nothing when gold is insufficient", () => {
      setRunProgress({ runGold: 0 });
      setShopState(createInitialShopState());
      const actions = buildActions();
      const card = requiredItem(getRunSessionStoreView().shopState.cards[0], "merchant card");

      const deckBefore = getRunProgressStoreView().runDeck.length;
      const result = actions.merchant.buyCard(card, shopItemSlotKey(card.id, 0));

      expect(result).toBe(false);
      expect(getRunProgressStoreView().runGold).toBe(0);
      expect(getRunProgressStoreView().runDeck.length).toBe(deckBefore);
      expect(playGoldSpend).not.toHaveBeenCalled();
    });

    it("no-ops a second buy of the same slot without rebuilding actions (rapid re-entry)", () => {
      setRunProgress({ runGold: 999 });
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

      expect(getRunProgressStoreView().runGold).toBe(999 - SHOP_CARD_PRICE);
      expect(getRunProgressStoreView().runDeck.length).toBe(deckBefore + 1);
      expect(getRunSessionStoreView().shopState.purchasedSlotKeys).toEqual([slotKey]);
      expect(commits).toHaveLength(0);
      expect(playGoldSpend).not.toHaveBeenCalled();
    });
  });

  describe("merchant remove card", () => {
    it("deducts gold and removes card from deck", () => {
      setRunProgress({ runGold: 999, runDeck: [makeCard({ id: "a" }), makeCard({ id: "b" })] });
      setShopState(createInitialShopState());
      const actions = buildActions();

      actions.merchant.removeCard(0);

      expect(getRunProgressStoreView().runGold).toBe(999 - SHOP_REMOVE_PRICE);
      expect(getRunProgressStoreView().runDeck).toHaveLength(1);
      expect(getRunProgressStoreView().runDeck[0].id).toBe("b");
      expect(getRunSessionStoreView().shopState.removeUsed).toBe(true);
    });

    it("does nothing when removeUsed is already true", () => {
      setRunProgress({ runGold: 999 });
      setShopState({ ...createInitialShopState(), removeUsed: true });
      const actions = buildActions();

      actions.merchant.removeCard(0);

      expect(getRunProgressStoreView().runGold).toBe(999);
    });

    it("does nothing for out-of-bounds index", () => {
      setRunProgress({ runGold: 999, runDeck: [makeCard()] });
      setShopState(createInitialShopState());
      const actions = buildActions();

      actions.merchant.removeCard(-1);
      actions.merchant.removeCard(5);

      expect(getRunProgressStoreView().runGold).toBe(999);
    });
  });

  describe.each([
    {
      name: "merchant",
      seed: () => setShopState({ ...createInitialShopState(), refreshesLeft: 1 }),
      refresh: (actions: ReturnType<typeof buildActions>) => actions.merchant.refresh(),
      read: () => getRunSessionStoreView().shopState,
      price: SHOP_REFRESH_PRICE,
    },
    {
      name: "trinket",
      seed: () => {
        const initial = createInitialTrinketShopState(() => 0);
        setTrinketShopState({
          ...initial,
          purchasedSlotKeys: [`${initial.trinkets[0]?.id}-0`],
          refreshesLeft: 1,
        });
      },
      refresh: (actions: ReturnType<typeof buildActions>) => actions.trinket.refresh(),
      read: () => getRunSessionStoreView().trinketShopState,
      price: SHOP_REFRESH_PRICE,
    },
    {
      name: "equipment",
      seed: () => {
        const initial = createInitialEquipmentShopState();
        setEquipmentShopState({
          ...initial,
          purchasedSlotKeys: [initial.gear[0]?.instanceId ?? "missing"],
          refreshesLeft: 1,
        });
      },
      refresh: (actions: ReturnType<typeof buildActions>) => actions.equipment.refresh(),
      read: () => getRunSessionStoreView().equipmentShopState,
      price: SHOP_REFRESH_PRICE,
    },
  ])("$name refresh", ({ seed, refresh, read, price }) => {
    it("deducts gold, decrements refreshesLeft, and clears purchased slots", () => {
      setRunProgress({ runGold: 999 });
      seed();
      const actions = buildActions();
      const commits: number[] = [];
      const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

      expect(refresh(actions)).toBe(true);
      unsubscribe();

      expect(read().refreshesLeft).toBe(0);
      expect(getRunProgressStoreView().runGold).toBe(999 - price);
      expect(read().purchasedSlotKeys).toEqual([]);
      expect(commits).toHaveLength(1);
      expect(playGoldSpend).toHaveBeenCalledOnce();
    });
  });

  describe("merchant refresh reject", () => {
    it("returns false without a commit or sound when no refresh remains", () => {
      setRunProgress({ runGold: 999 });
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
      setRunProgress({ runGold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions({ trinketIds: ["merchants-favor"] });
      const card = requiredItem(getRunSessionStoreView().shopState.cards[0], "merchant card");

      const discountedPrice = SHOP_CARD_PRICE - 7;
      actions.merchant.buyCard(card, shopItemSlotKey(card.id, 0));

      expect(getRunProgressStoreView().runGold).toBe(999 - discountedPrice);
    });

    it("does not apply discount on second purchase in same visit", () => {
      setRunProgress({ runGold: 999 });
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
      expect(getRunProgressStoreView().runGold).toBe(goldAfterFirst - SHOP_CARD_PRICE);
    });
  });

  describe("talent discounts", () => {
    it("applies haggle discount to shop card price", () => {
      setRunProgress({ runGold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions({ talentEffects: { shopCardDiscount: 5 } });
      const card = requiredItem(getRunSessionStoreView().shopState.cards[0], "merchant card");

      expect(actions.merchant.getCardBuyPrice(card)).toBe(SHOP_CARD_PRICE - 5);
    });

    it("applies potion discount only for standard potions in alchemist", () => {
      setRunProgress({ runGold: 999 });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions({ talentEffects: { potionDiscount: 5, shopCardDiscount: 3 } });
      const potion = requiredItem(getRunSessionStoreView().alchemistState.potions[0], "alchemist potion");

      // Potion discount stacks with shop card discount for potion cards
      expect(actions.alchemist.getPotionBuyPrice(potion)).toBeLessThanOrEqual(ALCHEMIST_POTION_PRICE - 3);
    });
  });

  describe("per-shop isolation", () => {
    it("buying in merchant shop does not affect alchemist state", () => {
      setRunProgress({ runGold: 999 });
      setShopState(createInitialShopState());
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();
      const card = requiredItem(getRunSessionStoreView().shopState.cards[0], "merchant card");

      actions.merchant.buyCard(card, shopItemSlotKey(card.id, 0));

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

      const result = actions.alchemist.mixPotions(0, 1);

      expect(result).not.toBeNull();
      expect(getRunProgressStoreView().runGold).toBe(999 - ALCHEMIST_MIX_PRICE);
      expect(getRunSessionStoreView().alchemistState.mixUsed).toBe(true);
      expect(getRunProgressStoreView().runDeck).toEqual([result]);
    });

    it("adds homestead potionMixPotency onto talent mix potency", () => {
      setRunProgress({
        runGold: 999,
        runDeck: [
          makeCard({ id: "a", title: "Potion A", effects: [makeEffect("holy", 5)] }),
          makeCard({ id: "b", title: "Potion B", effects: [makeEffect("holy", 5)] }),
        ],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions({
        talentEffects: { potionMixPotency: 1 },
        homesteadEffects: { potionMixPotency: 1 },
      });

      const result = actions.alchemist.mixPotions(0, 1);
      expect(result?.effects).toEqual([
        expect.objectContaining({ kind: "damage", damageType: "holy", amount: 7 }),
        expect.objectContaining({ kind: "damage", damageType: "holy", amount: 7 }),
      ]);
    });

    it("returns null for out-of-bounds indices", () => {
      setRunProgress({ runGold: 999, runDeck: [makeCard()] });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();

      expect(actions.alchemist.mixPotions(-1, 0)).toBeNull();
      expect(actions.alchemist.mixPotions(0, 5)).toBeNull();
      expect(actions.alchemist.mixPotions(0, 0)).toBeNull();
    });

    it("does not charge gold or consume the mix slot when the mix fails", () => {
      setRunProgress({
        runGold: 999,
        runDeck: [makeCard({ id: MIXED_POTION_CARD_ID, title: "Mixed" }), makeCard({ id: "b", title: "Potion" })],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions({ talentEffects: { potionMixPotency: 0 } });

      // Mixing a Mixed Potion with another potion fails without charging the
      // player or disabling the Mix service.
      const result = actions.alchemist.mixPotions(0, 1);
      expect(result).toBeNull();
      expect(getRunProgressStoreView().runGold).toBe(999);
      expect(getRunSessionStoreView().alchemistState.mixUsed).toBe(false);
    });

    it("prevents a second mix attempt after first succeeds", () => {
      setRunProgress({
        runGold: 999,
        runDeck: [makeCard({ id: "a", title: "Potion A" }), makeCard({ id: "b", title: "Potion B" })],
      });
      setAlchemistState(createInitialAlchemistState());
      const firstActions = buildActions({ talentEffects: { potionMixPotency: 0 } });

      const first = firstActions.alchemist.mixPotions(0, 1);
      expect(first).not.toBeNull();
      expect(getRunSessionStoreView().alchemistState.mixUsed).toBe(true);

      // mixUsed is read from the draft on the next command, not from a command closure
      const second = firstActions.alchemist.mixPotions(0, 1);
      expect(second).toBeNull();
      expect(getRunProgressStoreView().runGold).toBe(999 - ALCHEMIST_MIX_PRICE);
    });

    it("no-ops a second mix on the same actions instance without double-spending gold", () => {
      setRunProgress({
        runGold: 999,
        runDeck: [
          makeCard({ id: "a", title: "Potion A" }),
          makeCard({ id: "b", title: "Potion B" }),
          makeCard({ id: "c", title: "Potion C" }),
          makeCard({ id: "d", title: "Potion D" }),
        ],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions({ talentEffects: { potionMixPotency: 0 } });

      expect(actions.alchemist.mixPotions(0, 1)).not.toBeNull();
      expect(actions.alchemist.mixPotions(2, 3)).toBeNull();
      expect(getRunProgressStoreView().runGold).toBe(999 - ALCHEMIST_MIX_PRICE);
      expect(getRunSessionStoreView().alchemistState.mixUsed).toBe(true);
    });
  });

  describe("trinket shop", () => {
    it("deducts 80 gold and adds a permanent trinket on purchase", () => {
      setRunProgress({ runGold: 999 });
      setTrinketShopState(createInitialTrinketShopState(() => 0));
      const actions = buildActions();
      const trinket = requiredItem(getRunSessionStoreView().trinketShopState.trinkets[0], "trinket offering");

      const result = actions.trinket.buy(trinket, shopItemSlotKey(trinket.id, 0));

      expect(result).toBe(true);
      expect(getRunProgressStoreView().runGold).toBe(999 - TRINKET_SHOP_TRINKET_PRICE);
      expect(TRINKET_SHOP_TRINKET_PRICE).toBe(80);
      expect(useGearStore.getState().ownedTrinketIds).toContain(trinket.id);
      expect(getRunProgressStoreView().runBoons).not.toContain(trinket.id);
      expect(getRunProgressStoreView().runObtainedItems).toEqual([{ kind: "trinket", trinketId: trinket.id }]);
      expect(getRunSessionStoreView().trinketShopState.firstPurchaseUsed).toBe(true);
    });

    it("does not charge gold when the trinket is already owned", () => {
      setTrinketShopState(createInitialTrinketShopState(() => 0));
      const trinket = requiredItem(getRunSessionStoreView().trinketShopState.trinkets[0], "trinket offering");
      setRunProgress({ runGold: 999 });
      useGearStore.getState().addTrinket(trinket.id);
      const actions = buildActions();

      const result = actions.trinket.buy(trinket, shopItemSlotKey(trinket.id, 0));

      expect(result).toBe(false);
      expect(getRunProgressStoreView().runGold).toBe(999);
      expect(useGearStore.getState().ownedTrinketIds).toEqual([trinket.id]);
    });

    it("rejects a buy when the payload is not the live slot offering", () => {
      setRunProgress({ runGold: 999 });
      setTrinketShopState(createInitialTrinketShopState(() => 0));
      const actions = buildActions();
      const offered = requiredItem(getRunSessionStoreView().trinketShopState.trinkets[0], "trinket offering");
      const other = requiredItem(getRunSessionStoreView().trinketShopState.trinkets[1], "other trinket");

      const result = actions.trinket.buy(other, shopItemSlotKey(offered.id, 0));

      expect(result).toBe(false);
      expect(getRunProgressStoreView().runGold).toBe(999);
      expect(getRunProgressStoreView().runBoons).not.toContain(other.id);
    });
  });

  describe("equipment shop", () => {
    it("persists gold, purchase slot, and gear inventory in one commit", () => {
      const instance: GearInstance = {
        instanceId: "shop-armor",
        definitionId: "leather-armor-basic",
        affixes: [{ id: "max-health", value: 7 }],
      };
      setRunProgress({ runGold: 999, characterId: "knight", runMaxHealth: 30, runPlayerHealth: 30 });
      getRunTransientStore().setHasActiveRun(true);
      setEquipmentShopState({
        ...createInitialEquipmentShopState(),
        gear: [instance],
      });
      const actions = buildActions();
      const commits: number[] = [];
      const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

      const result = actions.equipment.buy(instance);

      unsubscribe();

      expect(result).toBe(true);
      expect(commits).toHaveLength(1);
      expect(getRunProgressStoreView().runGold).toBe(999 - actions.equipment.getBuyPrice(instance));
      expect(getRunSessionStoreView().equipmentShopState.purchasedSlotKeys).toEqual([instance.instanceId]);
      expect(useGearStore.getState().inventories.knight).toContainEqual(instance);
      expect(getRunProgressStoreView().runObtainedItems).toEqual([{ kind: "gear", instance }]);
      // Shop buy adds to inventory without equipping, so max-health affixes do not apply yet.
      // mutateGearWithRunHealthSync still runs in the same commit (delta 0).
      expect(getRunProgressStoreView().runMaxHealth).toBe(30);
      expect(getRunProgressStoreView().runPlayerHealth).toBe(30);
    });

    it("rejects a buy for gear that is not on the shelf", () => {
      const onShelf: GearInstance = {
        instanceId: "shop-armor",
        definitionId: "leather-armor-basic",
        affixes: [],
      };
      const offMenu: GearInstance = {
        instanceId: "off-menu",
        definitionId: "leather-armor-basic",
        affixes: [],
      };
      setRunProgress({ runGold: 999, characterId: "knight" });
      setEquipmentShopState({
        ...createInitialEquipmentShopState(),
        gear: [onShelf],
      });
      const actions = buildActions();

      expect(actions.equipment.buy(offMenu)).toBe(false);
      expect(getRunProgressStoreView().runGold).toBe(999);
      expect(useGearStore.getState().inventories.knight ?? []).not.toContainEqual(offMenu);
    });
  });

  describe("price selectors", () => {
    it("getRemoveCardPrice returns base price minus discount", () => {
      const actions = buildActions({ talentEffects: { removeCardDiscount: 10 } });
      expect(actions.merchant.getRemoveCardPrice()).toBe(Math.max(0, SHOP_REMOVE_PRICE - 10));
    });

    it("returns the mix price with its talent discount", () => {
      const actions = buildActions({ talentEffects: { mixPotionDiscount: 10 } });
      expect(actions.alchemist.getMixPrice()).toBe(Math.max(0, ALCHEMIST_MIX_PRICE - 10));
    });

    it("returns the merchant refresh price with the free-refresh talent", () => {
      const actions = buildActions({ talentEffects: { shopFreeRefresh: true } });
      expect(actions.merchant.getRefreshPrice(1)).toBe(0);
      expect(actions.merchant.getRefreshPrice(0)).toBe(SHOP_REFRESH_PRICE);
    });

    it("returns the alchemist refresh price with the free-refresh talent", () => {
      const actions = buildActions({ talentEffects: { shopFreeRefresh: true } });
      expect(actions.alchemist.getRefreshPrice(1)).toBe(0);
      expect(actions.alchemist.getRefreshPrice(0)).toBe(ALCHEMIST_REFRESH_PRICE);
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
      setRunProgress({ runGold: 999 });
      setShopState(createInitialShopState());
      const card = requiredItem(getRunSessionStoreView().shopState.cards[0], "merchant card");

      // Buy once to flip firstPurchaseUsed
      buildActions().merchant.buyCard(card, shopItemSlotKey(card.id, 0));

      // Fresh snapshot after purchase
      const postBuyActions = buildActions();
      expect(postBuyActions.merchant.getCardBuyPrice(card)).toBe(SHOP_CARD_PRICE);
    });
  });

  describe("alchemist refresh dedup", () => {
    it("does not restock the same potion id on refresh", () => {
      setRunProgress({ runGold: 999 });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();
      const beforeIds = getRunSessionStoreView().alchemistState.potions.map((p) => p.id);

      actions.alchemist.refresh();

      const afterIds = getRunSessionStoreView().alchemistState.potions.map((p) => p.id);
      const overlap = beforeIds.filter((id) => afterIds.includes(id));
      expect(overlap.length).toBeLessThan(beforeIds.length);
    });
  });

  describe("merchant refresh dedup", () => {
    it("does not restock the same card id on refresh", () => {
      setRunProgress({ runGold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions();
      const beforeIds = getRunSessionStoreView().shopState.cards.map((card) => card.id);

      actions.merchant.refresh();

      const afterIds = getRunSessionStoreView().shopState.cards.map((card) => card.id);
      const overlap = beforeIds.filter((id) => afterIds.includes(id));
      expect(overlap.length).toBeLessThan(beforeIds.length);
    });
  });

  describe("persisted RNG stream", () => {
    it("replays equipment shop init from the same RNG state", () => {
      const rng = () => 0.5;
      const rngState = createRunRngState(rng);
      setRunProgress({ runGold: 999, rng: rngState });

      setEquipmentShopState(createInitialEquipmentShopState(rng));
      const firstActions = buildActions();
      firstActions.equipment.initialize();
      const firstGear = getRunSessionStoreView().equipmentShopState.gear.map((g) => g.definitionId);

      setEquipmentShopState(createInitialEquipmentShopState(rng));
      setRunProgress({ rng: rngState });
      const secondActions = buildActions();
      secondActions.equipment.initialize();
      const secondGear = getRunSessionStoreView().equipmentShopState.gear.map((g) => g.definitionId);

      expect(firstGear).toEqual(secondGear);
    });

    it("replays trinket init and refresh from the same RNG state", () => {
      const rng = () => 0.25;
      const rngState = createRunRngState(rng);
      setRunProgress({ runGold: 999, rng: rngState });
      setTrinketShopState(createInitialTrinketShopState(rng));

      const actions = buildActions();
      actions.trinket.initialize();
      const firstTrinkets = getRunSessionStoreView().trinketShopState.trinkets.map((t) => t.id);

      setTrinketShopState(createInitialTrinketShopState(rng));
      setRunProgress({ rng: rngState });
      const replayActions = buildActions();
      replayActions.trinket.initialize();
      const secondTrinkets = getRunSessionStoreView().trinketShopState.trinkets.map((t) => t.id);

      expect(firstTrinkets).toEqual(secondTrinkets);

      setTrinketShopState({
        ...createInitialTrinketShopState(rng),
        refreshesLeft: 1,
      });
      setRunProgress({ rng: rngState });
      const refreshActions = buildActions();
      refreshActions.trinket.refresh();
      const refreshedTrinkets = getRunSessionStoreView().trinketShopState.trinkets.map((t) => t.id);

      setTrinketShopState({
        ...createInitialTrinketShopState(rng),
        refreshesLeft: 1,
      });
      setRunProgress({ rng: rngState });
      const replayRefreshActions = buildActions();
      replayRefreshActions.trinket.refresh();
      const replayedTrinkets = getRunSessionStoreView().trinketShopState.trinkets.map((t) => t.id);

      expect(refreshedTrinkets).toEqual(replayedTrinkets);
    });
  });
});
