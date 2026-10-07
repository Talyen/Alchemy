import "../../../../helpers/mock-audio";

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
import { cardById, trinketLibrary } from "@/lib/game-data";
import { getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import type { GearInstance } from "@/lib/gear";
import { gearDefinitions } from "@/lib/gear";
import { makeEffect } from "../../../../fixtures/battle";
import { playUISound } from "@/lib/audio";
import { readActivityData } from "@/lib/active-run-session";
import { defaultGameSession } from "@/app/application-session";

describe("alchemist shop actions", () => {
  it("Restock can make one refresh free without allowing infinite refreshes", () => {
    setRunProgress({ gold: 100 });
    setShopState({ ...createInitialShopState(), refreshesLeft: 2 });
    const actions = buildActions({ talentEffects: { shopFreeRefreshChance: 100 } });

    expect(actions.merchant.refresh()).toBe(true);
    expect(readRunProfile(defaultGameSession).gold).toBe(100);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "shop")).toMatchObject({
      refreshesLeft: 1,
      freeRefreshUsed: true,
    });
    expect(actions.merchant.refresh()).toBe(true);
    expect(readRunProfile(defaultGameSession).gold).toBeLessThan(100);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "shop").refreshesLeft).toBe(0);
  });

  it("Restock failure keeps the normal affordability guard", () => {
    setRunProgress({ gold: 0 });
    setShopState({ ...createInitialShopState(), refreshesLeft: 1 });
    const actions = buildActions({ talentEffects: { shopFreeRefreshChance: 100 } });
    const before = readRunSession(defaultGameSession);

    expect(actions.merchant.refresh()).toBe(false);
    expect(readRunSession(defaultGameSession)).toEqual(before);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "shop").freeRefreshUsed).toBe(false);
  });

  it("fills refresh slots from previous offerings when only one novel potion remains", () => {
    const pool = getStandardPotionPool();
    const novel = pool[0];
    setRunProgress({ gold: 999 });
    setAlchemistState({ ...createInitialAlchemistState(), potions: pool.slice(1), refreshesLeft: 1 });
    expect(buildActions().alchemist.refresh()).toBe(true);
    const potions = readActivityData(readRunSession(defaultGameSession).activity, "alchemist").potions;
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
      expect(readRunProfile(defaultGameSession).gold).toBe(999);
      expect(readActivityData(readRunSession(defaultGameSession).activity, "alchemist").mixUsed).toBe(false);
      expect(readActiveRun(defaultGameSession).runDeck.map((card) => card.id)).toEqual(["slash", "bash"]);
      expect(playUISound).not.toHaveBeenCalled();
    });
    it("deducts gold, replaces two cards with mixed potion, marks mixUsed", () => {
      setRunProgress({
        gold: 999,
        runDeck: [
          makeCard({ id: "health-potion", title: "Potion A" }),
          makeCard({ id: "mana-potion", title: "Potion B" }),
        ],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();

      const result = actions.alchemist.mixPotions(0, 1);

      expect(result).not.toBeNull();
      expect(readRunProfile(defaultGameSession).gold).toBe(999 - ALCHEMIST_MIX_PRICE);
      expect(readActivityData(readRunSession(defaultGameSession).activity, "alchemist").mixUsed).toBe(true);
      expect(readActiveRun(defaultGameSession).runDeck).toEqual([result]);
      expect(playUISound).toHaveBeenCalledWith("alchemistMix");
    });

    it("discounts mixing without changing the talent potion-strength bonus", () => {
      setRunProgress({
        gold: 999,
        runDeck: [
          makeCard({ id: "health-potion", title: "Potion A", effects: [makeEffect("holy", 5)] }),
          makeCard({ id: "mana-potion", title: "Potion B", effects: [makeEffect("holy", 5)] }),
        ],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions({
        talentEffects: { potionMixPotency: 1 },
        homesteadEffects: { mixPotionDiscount: 8 },
      });

      expect(actions.alchemist.getMixPrice()).toBe(ALCHEMIST_MIX_PRICE - 8);
      const result = actions.alchemist.mixPotions(0, 1);
      expect(readRunProfile(defaultGameSession).gold).toBe(999 - (ALCHEMIST_MIX_PRICE - 8));
      expect(result?.effects).toEqual([
        expect.objectContaining({ kind: "damage", damageType: "holy", amount: 6 }),
        expect.objectContaining({ kind: "damage", damageType: "holy", amount: 6 }),
      ]);
    });

    it("rejects invalid indices without spending Gold, changing the deck or consuming the service", () => {
      setRunProgress({ gold: 999, runDeck: [cardById["health-potion"]!, cardById["mana-potion"]!] });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();
      const beforeRun = readActiveRun(defaultGameSession);
      const beforeVisit = readRunSession(defaultGameSession);
      for (const index of [-1, 5, 0.5, NaN, Infinity]) {
        expect(actions.alchemist.mixPotions(index, 1)).toBeNull();
        expect(actions.alchemist.mixPotions(0, index)).toBeNull();
      }
      expect(actions.alchemist.mixPotions(0, 0)).toBeNull();
      expect(readActiveRun(defaultGameSession)).toEqual(beforeRun);
      expect(readRunSession(defaultGameSession)).toEqual(beforeVisit);
      expect(readRunProfile(defaultGameSession).gold).toBe(999);
      expect(playUISound).not.toHaveBeenCalled();
    });

    it("does not charge gold or consume the mix slot when the mix fails", () => {
      setRunProgress({
        gold: 999,
        runDeck: [
          makeCard({ id: MIXED_POTION_CARD_ID, title: "Mixed" }),
          makeCard({ id: "mana-potion", title: "Potion" }),
        ],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions({ talentEffects: { potionMixPotency: 0 } });

      const result = actions.alchemist.mixPotions(0, 1);
      expect(result).toBeNull();
      expect(readRunProfile(defaultGameSession).gold).toBe(999);
      expect(readActivityData(readRunSession(defaultGameSession).activity, "alchemist").mixUsed).toBe(false);
    });

    it("no-ops a second mix on the same actions instance without double-spending gold", () => {
      setRunProgress({
        gold: 999,
        runDeck: [
          makeCard({ id: "health-potion", title: "Potion A" }),
          makeCard({ id: "mana-potion", title: "Potion B" }),
          makeCard({ id: "panacea-potion", title: "Potion C" }),
          makeCard({ id: "stoneskin-potion", title: "Potion D" }),
        ],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions({ talentEffects: { potionMixPotency: 0 } });

      expect(actions.alchemist.mixPotions(0, 1)).not.toBeNull();
      expect(actions.alchemist.mixPotions(0, 1)).toBeNull();
      expect(readRunProfile(defaultGameSession).gold).toBe(999 - ALCHEMIST_MIX_PRICE);
      expect(readActivityData(readRunSession(defaultGameSession).activity, "alchemist").mixUsed).toBe(true);
    });
  });
  it("strengthening pays once and uses the same service slot as mixing", () => {
    const originalDeck = [cardById["health-potion"]!, cardById["mana-potion"]!, cardById["stoneskin-potion"]!];
    setRunProgress({ gold: 0, runDeck: originalDeck });
    setAlchemistState(createInitialAlchemistState());
    const actions = buildActions();
    expect(actions.alchemist.strengthenPotion(0)).toBeNull();
    expect(readActiveRun(defaultGameSession).runDeck).toEqual(originalDeck);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "alchemist").mixUsed).toBe(false);

    setRunProgress({ gold: 2 * ALCHEMIST_MIX_PRICE });
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision), defaultGameSession);
    try {
      const strengthened = actions.alchemist.strengthenPotion(0);
      expect(strengthened).toMatchObject({ brewed: true, effects: [{ kind: "heal", amount: 12 }] });
      expect(readActiveRun(defaultGameSession).runDeck).toEqual([strengthened, ...originalDeck.slice(1)]);
      expect(readRunProfile(defaultGameSession).gold).toBe(ALCHEMIST_MIX_PRICE);
      expect(readActivityData(readRunSession(defaultGameSession).activity, "alchemist").mixUsed).toBe(true);
      const after = readActiveRun(defaultGameSession);
      expect(actions.alchemist.mixPotions(1, 2)).toBeNull();
      expect(actions.alchemist.strengthenPotion(1)).toBeNull();
      expect(readActiveRun(defaultGameSession)).toEqual(after);
      expect(readRunProfile(defaultGameSession).gold).toBe(ALCHEMIST_MIX_PRICE);
      expect(commits).toHaveLength(1);
      expect(playUISound).toHaveBeenCalledExactlyOnceWith("alchemistMix");
    } finally {
      unsubscribe();
    }
  });

  describe("talent discounts", () => {
    it("applies potion discount only for standard potions in alchemist", () => {
      setRunProgress({ gold: 999 });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions({ talentEffects: { potionDiscount: 5, shopCardDiscount: 3 } });
      const potion = requiredItem(
        readActivityData(readRunSession(defaultGameSession).activity, "alchemist").potions[0],
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

      expect(readRunProfile(defaultGameSession).gold).toBe(999 - SHOP_REMOVE_PRICE);
      expect(readActiveRun(defaultGameSession).runDeck).toHaveLength(1);
      expect(readActiveRun(defaultGameSession).runDeck[0].id).toBe("b");
      expect(readActivityData(readRunSession(defaultGameSession).activity, "shop").removeUsed).toBe(true);
      expect(actions.merchant.removeCard(0)).toBe(false);
      expect(readRunProfile(defaultGameSession).gold).toBe(999 - SHOP_REMOVE_PRICE);
      expect(readActiveRun(defaultGameSession).runDeck.map((card) => card.id)).toEqual(["b"]);
      expect(playUISound).toHaveBeenCalledExactlyOnceWith("shopRemove");
    });

    it("rejects invalid indices without spending Gold, changing the deck or consuming the service", () => {
      const deck = [makeCard({ id: "a" }), makeCard({ id: "b" })];
      setRunProgress({ gold: 999, runDeck: deck });
      setShopState(createInitialShopState());
      const actions = buildActions();
      const beforeVisit = readRunSession(defaultGameSession);
      for (const index of [-1, 5, 0.5, NaN, Infinity]) expect(actions.merchant.removeCard(index)).toBe(false);
      expect(readRunProfile(defaultGameSession).gold).toBe(999);
      expect(readActiveRun(defaultGameSession).runDeck).toEqual(deck);
      expect(readRunSession(defaultGameSession)).toEqual(beforeVisit);
      expect(playUISound).not.toHaveBeenCalled();
    });
  });
  describe("merchants-favor first-purchase discount", () => {
    it("applies discount on first purchase when trinket is owned", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions({ trinketIds: ["merchants-favor"] });
      const card = requiredItem(
        readActivityData(readRunSession(defaultGameSession).activity, "shop").cards[0],
        "merchant card",
      );

      const discountedPrice = SHOP_CARD_PRICE - 7;
      actions.merchant.buyCard(card, shopItemSlotKey(card.id, 0));

      expect(readRunProfile(defaultGameSession).gold).toBe(999 - discountedPrice);
    });

    it("does not apply discount on second purchase in same visit", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const firstActions = buildActions({ trinketIds: ["merchants-favor"] });
      const cards = readActivityData(readRunSession(defaultGameSession).activity, "shop").cards;
      expect(cards.length).toBeGreaterThanOrEqual(2);
      const firstCard = requiredItem(cards[0], "first merchant card");
      const secondCard = requiredItem(cards[1], "second merchant card");

      firstActions.merchant.buyCard(firstCard, shopItemSlotKey(firstCard.id, 0));
      const discountPrice = SHOP_CARD_PRICE - 7;
      const goldAfterFirst = 999 - discountPrice;

      const result = firstActions.merchant.buyCard(secondCard, shopItemSlotKey(secondCard.id, 1));
      expect(result).toBe(true);
      expect(readRunProfile(defaultGameSession).gold).toBe(goldAfterFirst - SHOP_CARD_PRICE);
    });
  });
  describe("talent discounts", () => {
    it("applies haggle discount to shop card price", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions({ talentEffects: { shopCardDiscount: 5 } });
      const card = requiredItem(
        readActivityData(readRunSession(defaultGameSession).activity, "shop").cards[0],
        "merchant card",
      );

      expect(actions.merchant.getCardBuyPrice(card)).toBe(SHOP_CARD_PRICE - 5);
    });
  });
  describe("buy card", () => {
    it("purchases the live shelf card when the supplied copy is stale", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions();
      const onShelf = requiredItem(
        readActivityData(readRunSession(defaultGameSession).activity, "shop").cards[0],
        "merchant card",
      );
      const staleCopy = { ...onShelf, uid: (onShelf.uid ?? 0) + 1000 };

      expect(actions.merchant.buyCard(staleCopy, shopItemSlotKey(onShelf.id, 0))).toBe(true);

      const deck = readActiveRun(defaultGameSession).runDeck;
      expect(deck).toContainEqual(onShelf);
      expect(deck).not.toContainEqual(staleCopy);
    });

    it("rejects a buy for a card that is not on the shelf", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const actions = buildActions();
      const onShelf = requiredItem(
        readActivityData(readRunSession(defaultGameSession).activity, "shop").cards[0],
        "merchant card",
      );

      const commits: number[] = [];
      const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision), defaultGameSession);
      expect(actions.merchant.buyCard({ ...onShelf }, shopItemSlotKey("missing-card", 0))).toBe(false);
      expect(actions.merchant.buyCard({ ...onShelf, id: "missing-card" }, shopItemSlotKey(onShelf.id, 0))).toBe(false);
      unsubscribe();
      expect(readRunProfile(defaultGameSession).gold).toBe(999);
      expect(commits).toHaveLength(0);
    });
  });
  describe("init", () => {
    it("initializes the merchant shop from the current deck", () => {
      setRunProgress({ runDeck: [makeCard()] });
      const actions = buildActions();

      actions.initialize("merchant");

      const shop = readActivityData(readRunSession(defaultGameSession).activity, "shop");
      expect(shop.firstPurchaseUsed).toBe(false);
      expect(shop.purchasedSlotKeys).toHaveLength(0);
      expect(shop.cards.length).toBeGreaterThan(0);
    });
  });
  describe("selectors reflect current store state", () => {
    it("reads the current first-purchase state when pricing merchant cards", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      const card = requiredItem(
        readActivityData(readRunSession(defaultGameSession).activity, "shop").cards[0],
        "merchant card",
      );

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
      const previous = readActivityData(readRunSession(defaultGameSession).activity, "equipment-shop").gear;
      const oldBases = new Set(previous.map((item) => gearDefinitions[item.definitionId]!.baseItemId));
      expect(actions.equipment.refresh()).toBe(true);
      const refreshed = readActivityData(readRunSession(defaultGameSession).activity, "equipment-shop").gear;
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
    expect(readGearState(defaultGameSession).inventories.knight).toContainEqual(onShelf);
    expect(readActiveRun(defaultGameSession).runObtainedItems).toEqual([{ kind: "gear", instance: onShelf }]);
    expect(readRunProfile(defaultGameSession).gold).toBe(999 - actions.equipment.getBuyPrice(onShelf));
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
      const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision), defaultGameSession);

      const result = actions.equipment.buy(instance, instance.instanceId);

      unsubscribe();

      expect(result).toBe(true);
      expect(commits).toHaveLength(1);
      expect(readRunProfile(defaultGameSession).gold).toBe(999 - actions.equipment.getBuyPrice(instance));
      expect(readActivityData(readRunSession(defaultGameSession).activity, "equipment-shop").purchasedSlotKeys).toEqual(
        [instance.instanceId],
      );
      expect(readGearState(defaultGameSession).inventories.knight).toContainEqual(instance);
      expect(readActiveRun(defaultGameSession).runObtainedItems).toEqual([{ kind: "gear", instance }]);

      expect(readActiveRun(defaultGameSession).runMaxHealth).toBe(30);
      expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(30);
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
      expect(readRunProfile(defaultGameSession).gold).toBe(999);
      expect(readGearState(defaultGameSession).inventories.knight ?? []).not.toContainEqual(offMenu);
    });
  });
});

describe("trinket shop actions", () => {
  it.each([false, true])(
    "does not charge for an empty refresh after collecting the last Trinket during this visit: %s",
    (buyLast) => {
      setRunProgress({ gold: 999 });
      mutateGearForTest((gear) => {
        for (const trinket of trinketLibrary.slice(buyLast ? 1 : 0)) gear.addTrinket(trinket.id);
      });
      const actions = buildActions();
      actions.trinket.initialize();
      if (buyLast) {
        const trinket = trinketLibrary[0]!;
        expect(actions.trinket.buy(trinket, shopItemSlotKey(trinket.id, 0))).toBe(true);
        expect(readActivityData(readRunSession(defaultGameSession).activity, "trinket-shop").refreshesLeft).toBe(0);
      } else {
        expect(readActivityData(readRunSession(defaultGameSession).activity, "trinket-shop").trinkets).toEqual([]);
      }
      const beforeGold = readRunProfile(defaultGameSession).gold;
      const beforeSession = readRunSession(defaultGameSession);
      const beforeRun = readActiveRun(defaultGameSession);
      expect(actions.trinket.refresh()).toBe(false);
      expect(readRunProfile(defaultGameSession).gold).toBe(beforeGold);
      expect(readRunSession(defaultGameSession)).toEqual(beforeSession);
      expect(readActiveRun(defaultGameSession)).toEqual(beforeRun);
    },
  );

  describe("trinket shop", () => {
    it("adds a permanent trinket on purchase without granting a boon", () => {
      setRunProgress({ gold: 999 });
      setTrinketShopState(createInitialTrinketShopState(() => 0));
      const actions = buildActions();
      const trinket = requiredItem(
        readActivityData(readRunSession(defaultGameSession).activity, "trinket-shop").trinkets[0],
        "trinket offering",
      );

      expect(actions.trinket.buy(trinket, shopItemSlotKey(trinket.id, 0))).toBe(true);
      expect(readRunProfile(defaultGameSession).gold).toBe(999 - TRINKET_SHOP_TRINKET_PRICE);
      expect(readGearState(defaultGameSession).ownedTrinketIds).toContain(trinket.id);
      expect(readActiveRun(defaultGameSession).runBoons).not.toContain(trinket.id);
      expect(readActiveRun(defaultGameSession).runObtainedItems).toEqual([{ kind: "trinket", trinketId: trinket.id }]);
    });

    it("does not charge gold when the trinket is already owned", () => {
      setTrinketShopState(createInitialTrinketShopState(() => 0));
      const trinket = requiredItem(
        readActivityData(readRunSession(defaultGameSession).activity, "trinket-shop").trinkets[0],
        "trinket offering",
      );
      setRunProgress({ gold: 999 });
      mutateGearForTest((gear) => gear.addTrinket(trinket.id));
      const actions = buildActions();

      const result = actions.trinket.buy(trinket, shopItemSlotKey(trinket.id, 0));

      expect(result).toBe(false);
      expect(readRunProfile(defaultGameSession).gold).toBe(999);
      expect(readGearState(defaultGameSession).ownedTrinketIds).toEqual([trinket.id]);
    });

    it("rejects a buy when the payload is not the live slot offering", () => {
      setRunProgress({ gold: 999 });
      setTrinketShopState(createInitialTrinketShopState(() => 0));
      const actions = buildActions();
      const offered = requiredItem(
        readActivityData(readRunSession(defaultGameSession).activity, "trinket-shop").trinkets[0],
        "trinket offering",
      );
      const other = requiredItem(
        readActivityData(readRunSession(defaultGameSession).activity, "trinket-shop").trinkets[1],
        "other trinket",
      );

      const result = actions.trinket.buy(other, shopItemSlotKey(offered.id, 0));

      expect(result).toBe(false);
      expect(readRunProfile(defaultGameSession).gold).toBe(999);
      expect(readActiveRun(defaultGameSession).runBoons).not.toContain(other.id);
    });
  });
});
