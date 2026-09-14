import { describe, expect, it } from "vitest";
import { shopItemSlotKey } from "@/features/alchemy/run-loop/shop/shop-slot-keys";
import { mutateGearForTest, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { readGearState } from "@/features/alchemy/shared/stores/gear-store";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import {
  buildActions,
  createInitialAlchemistState,
  createInitialEquipmentShopState,
  createInitialShopState,
  createInitialTrinketShopState,
  makeCard,
  requiredItem,
  setAlchemistState,
  setEquipmentShopState,
  setShopState,
  setTrinketShopState,
} from "./shop-actions-harness";
import {
  ALCHEMIST_MIX_PRICE,
  ALCHEMIST_POTIONS_OFFERED,
  ALCHEMIST_POTION_PRICE,
  MIXED_POTION_CARD_ID,
  SHOP_CARD_PRICE,
  SHOP_REMOVE_PRICE,
  TRINKET_SHOP_TRINKET_PRICE,
} from "@/lib/game-constants";
import { getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import type { GearInstance } from "@/lib/gear";
import { gearDefinitions } from "@/lib/gear";
import { makeEffect } from "../../../../fixtures/battle";
import { playUISound } from "@/lib/audio";
import { readActivityData } from "@/lib/active-run-session";

describe("alchemist shop actions", () => {
  it("fills refresh slots from previous offerings when only one novel potion remains", () => {
    const pool = getStandardPotionPool();
    const novel = pool[0];
    setRunProgress({ gold: 999 });
    setAlchemistState({ ...createInitialAlchemistState(), potions: pool.slice(1), refreshesLeft: 1 });
    expect(buildActions().alchemist.refresh()).toBe(true);
    const potions = readActivityData(readRunSession().activity, "alchemist").potions;
    expect(potions).toHaveLength(ALCHEMIST_POTIONS_OFFERED);
    expect(potions).toContainEqual(novel);
    expect(new Set(potions.map((card) => card.id)).size).toBe(potions.length);
  });
  describe("alchemist mix potions", () => {
    it("returns null when mixing two non-potions", () => {
      setRunProgress({
        gold: 999,
        runDeck: [makeCard({ id: "slash", title: "Slash" }), makeCard({ id: "bash", title: "Bash" })],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();

      expect(actions.alchemist.mixPotions(0, 1)).toBeNull();
      expect(readRunProfile().gold).toBe(999);
      expect(readActivityData(readRunSession().activity, "alchemist").mixUsed).toBe(false);
      expect(readActiveRun().runDeck.map((card) => card.id)).toEqual(["slash", "bash"]);
      expect(playUISound).not.toHaveBeenCalled();
    });
    it("deducts gold, replaces two cards with mixed potion, marks mixUsed", () => {
      setRunProgress({
        gold: 999,
        runDeck: [makeCard({ id: "a-potion", title: "Potion A" }), makeCard({ id: "b-potion", title: "Potion B" })],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();

      const result = actions.alchemist.mixPotions(0, 1);

      expect(result).not.toBeNull();
      expect(readRunProfile().gold).toBe(999 - ALCHEMIST_MIX_PRICE);
      expect(readActivityData(readRunSession().activity, "alchemist").mixUsed).toBe(true);
      expect(readActiveRun().runDeck).toEqual([result]);
      expect(playUISound).toHaveBeenCalledWith("alchemistMix");
    });

    it("adds homestead potionMixPotency onto talent mix potency", () => {
      setRunProgress({
        gold: 999,
        runDeck: [
          makeCard({ id: "a-potion", title: "Potion A", effects: [makeEffect("holy", 5)] }),
          makeCard({ id: "b-potion", title: "Potion B", effects: [makeEffect("holy", 5)] }),
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
      setRunProgress({ gold: 999, runDeck: [makeCard()] });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();

      expect(actions.alchemist.mixPotions(-1, 0)).toBeNull();
      expect(actions.alchemist.mixPotions(0, 5)).toBeNull();
      expect(actions.alchemist.mixPotions(0, 0)).toBeNull();
    });

    it("does not charge gold or consume the mix slot when the mix fails", () => {
      setRunProgress({
        gold: 999,
        runDeck: [
          makeCard({ id: MIXED_POTION_CARD_ID, title: "Mixed" }),
          makeCard({ id: "b-potion", title: "Potion" }),
        ],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions({ talentEffects: { potionMixPotency: 0 } });

      const result = actions.alchemist.mixPotions(0, 1);
      expect(result).toBeNull();
      expect(readRunProfile().gold).toBe(999);
      expect(readActivityData(readRunSession().activity, "alchemist").mixUsed).toBe(false);
    });

    it("prevents a second mix attempt after first succeeds", () => {
      setRunProgress({
        gold: 999,
        runDeck: [makeCard({ id: "a-potion", title: "Potion A" }), makeCard({ id: "b-potion", title: "Potion B" })],
      });
      setAlchemistState(createInitialAlchemistState());
      const firstActions = buildActions({ talentEffects: { potionMixPotency: 0 } });

      const first = firstActions.alchemist.mixPotions(0, 1);
      expect(first).not.toBeNull();
      expect(readActivityData(readRunSession().activity, "alchemist").mixUsed).toBe(true);

      const second = firstActions.alchemist.mixPotions(0, 1);
      expect(second).toBeNull();
      expect(readRunProfile().gold).toBe(999 - ALCHEMIST_MIX_PRICE);
    });

    it("no-ops a second mix on the same actions instance without double-spending gold", () => {
      setRunProgress({
        gold: 999,
        runDeck: [
          makeCard({ id: "a-potion", title: "Potion A" }),
          makeCard({ id: "b-potion", title: "Potion B" }),
          makeCard({ id: "c-potion", title: "Potion C" }),
          makeCard({ id: "d-potion", title: "Potion D" }),
        ],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions({ talentEffects: { potionMixPotency: 0 } });

      expect(actions.alchemist.mixPotions(0, 1)).not.toBeNull();
      expect(actions.alchemist.mixPotions(2, 3)).toBeNull();
      expect(readRunProfile().gold).toBe(999 - ALCHEMIST_MIX_PRICE);
      expect(readActivityData(readRunSession().activity, "alchemist").mixUsed).toBe(true);
    });
  });
  describe("talent discounts", () => {
    it("applies potion discount only for standard potions in alchemist", () => {
      setRunProgress({ gold: 999 });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions({ talentEffects: { potionDiscount: 5, shopCardDiscount: 3 } });
      const potion = requiredItem(
        readActivityData(readRunSession().activity, "alchemist").potions[0],
        "alchemist potion",
      );

      expect(actions.alchemist.getPotionBuyPrice(potion)).toBeLessThanOrEqual(ALCHEMIST_POTION_PRICE - 3);
    });
  });
});

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
      expect(readActivityData(readRunSession().activity, "shop").removeUsed).toBe(true);
      expect(playUISound).toHaveBeenCalledWith("shopRemove");
    });

    it("does nothing when removeUsed is already true", () => {
      setRunProgress({ gold: 999 });
      setShopState({ ...createInitialShopState(), removeUsed: true });
      const actions = buildActions();

      actions.merchant.removeCard(0);

      expect(readRunProfile().gold).toBe(999);
      expect(playUISound).not.toHaveBeenCalled();
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
      const card = requiredItem(readActivityData(readRunSession().activity, "shop").cards[0], "merchant card");

      const discountedPrice = SHOP_CARD_PRICE - 7;
      actions.merchant.buyCard(card, shopItemSlotKey(card.id, 0));

      expect(readRunProfile().gold).toBe(999 - discountedPrice);
    });

    it("does not apply discount on second purchase in same visit", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const firstActions = buildActions({ trinketIds: ["merchants-favor"] });
      const cards = readActivityData(readRunSession().activity, "shop").cards;
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
      const card = requiredItem(readActivityData(readRunSession().activity, "shop").cards[0], "merchant card");

      expect(actions.merchant.getCardBuyPrice(card)).toBe(SHOP_CARD_PRICE - 5);
    });
  });
  describe("buy card", () => {
    it("purchases the live shelf card when the supplied copy is stale", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions();
      const onShelf = requiredItem(readActivityData(readRunSession().activity, "shop").cards[0], "merchant card");
      const staleCopy = { ...onShelf, uid: (onShelf.uid ?? 0) + 1000 };

      expect(actions.merchant.buyCard(staleCopy, shopItemSlotKey(onShelf.id, 0))).toBe(true);

      const deck = readActiveRun().runDeck;
      expect(deck).toContainEqual(onShelf);
      expect(deck).not.toContainEqual(staleCopy);
    });

    it("rejects a buy for a card that is not on the shelf", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions();
      const onShelf = requiredItem(readActivityData(readRunSession().activity, "shop").cards[0], "merchant card");

      expect(actions.merchant.buyCard({ ...onShelf }, shopItemSlotKey("missing-card", 0))).toBe(false);
      expect(readRunProfile().gold).toBe(999);
    });
  });
  describe("init", () => {
    it("initializes the merchant shop from the current deck", () => {
      setRunProgress({ runDeck: [makeCard()] });
      const actions = buildActions();

      actions.initialize("merchant");

      const shop = readActivityData(readRunSession().activity, "shop");
      expect(shop.firstPurchaseUsed).toBe(false);
      expect(shop.purchasedSlotKeys).toHaveLength(0);
      expect(shop.cards.length).toBeGreaterThan(0);
    });
  });
  describe("selectors reflect current store state", () => {
    it("reads the current first-purchase state when pricing merchant cards", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const card = requiredItem(readActivityData(readRunSession().activity, "shop").cards[0], "merchant card");

      buildActions().merchant.buyCard(card, shopItemSlotKey(card.id, 0));

      const postBuyActions = buildActions();
      expect(postBuyActions.merchant.getCardBuyPrice(card)).toBe(SHOP_CARD_PRICE);
    });
  });
});

describe("equipment shop actions", () => {
  it("refreshes away from the previous shelf when other equipment is available", () => {
    setRunProgress({ gold: 999, characterId: "knight" });
    const actions = buildActions();
    for (let visit = 0; visit < 10; visit++) {
      setEquipmentShopState(createInitialEquipmentShopState());
      const previous = readActivityData(readRunSession().activity, "equipment-shop").gear;
      const oldBases = new Set(previous.map((item) => gearDefinitions[item.definitionId]!.baseItemId));
      expect(actions.equipment.refresh()).toBe(true);
      const refreshed = readActivityData(readRunSession().activity, "equipment-shop").gear;
      expect(refreshed).toHaveLength(previous.length);
      expect(refreshed.every((item) => !oldBases.has(gearDefinitions[item.definitionId]!.baseItemId))).toBe(true);
    }
  });
  it("purchases the live shelf item when the supplied copy has different contents", () => {
    const onShelf: GearInstance = {
      instanceId: "shop-armor",
      definitionId: "leather-armor-basic",
      affixes: [{ id: "max-health", value: 7 }],
    };
    setRunProgress({ gold: 999, characterId: "knight" });
    setEquipmentShopState({ ...createInitialEquipmentShopState(), gear: [onShelf] });
    const actions = buildActions();
    expect(actions.equipment.buy({ ...onShelf, affixes: [{ id: "max-health", value: 999 }] }, onShelf.instanceId)).toBe(
      true,
    );
    expect(readGearState().inventories.knight).toContainEqual(onShelf);
    expect(readActiveRun().runObtainedItems).toEqual([{ kind: "gear", instance: onShelf }]);
    expect(readRunProfile().gold).toBe(999 - actions.equipment.getBuyPrice(onShelf));
  });
  describe("equipment shop", () => {
    it("persists gold, purchase slot, and gear inventory in one commit", () => {
      const instance: GearInstance = {
        instanceId: "shop-armor",
        definitionId: "leather-armor-basic",
        affixes: [{ id: "max-health", value: 7 }],
      };
      setRunProgress({ gold: 999, characterId: "knight", runMaxHealth: 30, runPlayerHealth: 30 });
      setRunSession({ hasActiveRun: true });
      setEquipmentShopState({
        ...createInitialEquipmentShopState(),
        gear: [instance],
      });
      const actions = buildActions();
      const commits: number[] = [];
      const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

      const result = actions.equipment.buy(instance, instance.instanceId);

      unsubscribe();

      expect(result).toBe(true);
      expect(commits).toHaveLength(1);
      expect(readRunProfile().gold).toBe(999 - actions.equipment.getBuyPrice(instance));
      expect(readActivityData(readRunSession().activity, "equipment-shop").purchasedSlotKeys).toEqual([
        instance.instanceId,
      ]);
      expect(readGearState().inventories.knight).toContainEqual(instance);
      expect(readActiveRun().runObtainedItems).toEqual([{ kind: "gear", instance }]);

      expect(readActiveRun().runMaxHealth).toBe(30);
      expect(readActiveRun().runPlayerHealth).toBe(30);
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
      setRunProgress({ gold: 999, characterId: "knight" });
      setEquipmentShopState({
        ...createInitialEquipmentShopState(),
        gear: [onShelf],
      });
      const actions = buildActions();

      expect(actions.equipment.buy(offMenu, offMenu.instanceId)).toBe(false);
      expect(readRunProfile().gold).toBe(999);
      expect(readGearState().inventories.knight ?? []).not.toContainEqual(offMenu);
    });
  });
});

describe("trinket shop actions", () => {
  describe("trinket shop", () => {
    it("adds a permanent trinket on purchase without granting a boon", () => {
      setRunProgress({ gold: 999 });
      setTrinketShopState(createInitialTrinketShopState(() => 0));
      const actions = buildActions();
      const trinket = requiredItem(
        readActivityData(readRunSession().activity, "trinket-shop").trinkets[0],
        "trinket offering",
      );

      expect(actions.trinket.buy(trinket, shopItemSlotKey(trinket.id, 0))).toBe(true);
      expect(readRunProfile().gold).toBe(999 - TRINKET_SHOP_TRINKET_PRICE);
      expect(readGearState().ownedTrinketIds).toContain(trinket.id);
      expect(readActiveRun().runBoons).not.toContain(trinket.id);
      expect(readActiveRun().runObtainedItems).toEqual([{ kind: "trinket", trinketId: trinket.id }]);
    });

    it("does not charge gold when the trinket is already owned", () => {
      setTrinketShopState(createInitialTrinketShopState(() => 0));
      const trinket = requiredItem(
        readActivityData(readRunSession().activity, "trinket-shop").trinkets[0],
        "trinket offering",
      );
      setRunProgress({ gold: 999 });
      mutateGearForTest((gear) => gear.addTrinket(trinket.id));
      const actions = buildActions();

      const result = actions.trinket.buy(trinket, shopItemSlotKey(trinket.id, 0));

      expect(result).toBe(false);
      expect(readRunProfile().gold).toBe(999);
      expect(readGearState().ownedTrinketIds).toEqual([trinket.id]);
    });

    it("rejects a buy when the payload is not the live slot offering", () => {
      setRunProgress({ gold: 999 });
      setTrinketShopState(createInitialTrinketShopState(() => 0));
      const actions = buildActions();
      const offered = requiredItem(
        readActivityData(readRunSession().activity, "trinket-shop").trinkets[0],
        "trinket offering",
      );
      const other = requiredItem(
        readActivityData(readRunSession().activity, "trinket-shop").trinkets[1],
        "other trinket",
      );

      const result = actions.trinket.buy(other, shopItemSlotKey(offered.id, 0));

      expect(result).toBe(false);
      expect(readRunProfile().gold).toBe(999);
      expect(readActiveRun().runBoons).not.toContain(other.id);
    });
  });
});
