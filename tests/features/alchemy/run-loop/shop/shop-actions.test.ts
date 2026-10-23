import { createCleanup } from "@/lib/cleanup";
import "../../../../helpers/mock-audio";
import { initializeShopForTest } from "../../../../helpers/visit-initialization";

import { describe, expect, it } from "vitest";
import { hydrateAlchemistState } from "@/lib/active-run-session/shop-persistence";
import { snapshotRun } from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import { parseActiveRun } from "@/lib/validation/parse-active-run";
import { shopItemSlotKey } from "@/lib/active-run-session";
import { mutateGearForTest, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/session/run-reads";
import { readGearState } from "@/features/alchemy/shared/stores/session/gear-store";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/commands/run-session-command";
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
  SHOP_CARD_PRICE,
  SHOP_REMOVE_PRICE,
  TRINKET_SHOP_TRINKET_PRICE,
} from "@/lib/game-constants";
import { cardById, trinketLibrary } from "@/lib/game-data";
import { createMixedPotion } from "@/lib/alchemist";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import type { GearInstance } from "@/lib/gear";
import { gearDefinitions } from "@/lib/gear";
import { makeEffect } from "../../../../fixtures/battle";
import { playUISound } from "@/lib/audio";
import { readActivityData } from "@/lib/active-run-session";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { createRunRngState } from "@/lib/rng";
import { defaultGameSession } from "@/app/application-session";

describe("alchemist shop actions", () => {
  it("Restock can make one refresh free without allowing infinite refreshes", () => {
    setRunProgress({ gold: 100, rng: createRunRngState(13) });
    setShopState({ ...createInitialShopState(), refreshesLeft: 2 });
    const actions = buildActions();
    setRunProgress({ unlockedTalents: { gold: ["gold-shop-refresh"] } });

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
    setRunProgress({ gold: 0, unlockedTalents: { gold: ["gold-shop-refresh"] } });
    setShopState({ ...createInitialShopState(), refreshesLeft: 1 });
    const actions = buildActions();
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
    it("mixes maximum-strength ingredients, charging once for a saveable Potion", () => {
      const potion = makeCard({ id: "health-potion", effects: [{ kind: "heal", amount: 999 }] });
      const sibling = cardById.slash!;
      setRunProgress({
        gold: 999,
        runDeck: [potion, sibling, potion],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();

      const result = actions.alchemist.mixPotions(2, 0);

      expect(result?.effects).toEqual([...potion.effects, ...potion.effects]);
      expect(hydrateCard(BattleCardSchema.parse(result))).toEqual(result);
      expect(readRunProfile(defaultGameSession).gold).toBe(999 - ALCHEMIST_MIX_PRICE);
      expect(readActivityData(readRunSession(defaultGameSession).activity, "alchemist").mixUsed).toBe(true);
      expect(readActiveRun(defaultGameSession).runDeck).toEqual([sibling, result]);
      expect(playUISound).toHaveBeenCalledWith("alchemistMix");
    });

    it("discounts mixing without changing ingredient potency", () => {
      setRunProgress({
        gold: 999,
        runDeck: [
          makeCard({ id: "health-potion", title: "Potion A", effects: [makeEffect("holy", 5)] }),
          makeCard({ id: "mana-potion", title: "Potion B", effects: [makeEffect("holy", 5)] }),
        ],
      });
      setAlchemistState(createInitialAlchemistState());
      setRunProgress({
        completedResearch: { ...readRunProfile(defaultGameSession).completedResearch, "botanical-distillation": 4 },
        effects: computeHomesteadEffects({}, {}, { "botanical-distillation": 4 }),
      });
      const actions = buildActions();

      expect(actions.alchemist.getMixPrice()).toBe(ALCHEMIST_MIX_PRICE - 8);
      const result = actions.alchemist.mixPotions(0, 1);
      expect(readRunProfile(defaultGameSession).gold).toBe(999 - (ALCHEMIST_MIX_PRICE - 8));
      expect(result?.effects).toEqual([
        expect.objectContaining({ kind: "damage", damageType: "holy", amount: 5 }),
        expect.objectContaining({ kind: "damage", damageType: "holy", amount: 5 }),
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

    it("mixes an existing Mixed Potion again, preserving its effects and spending the service once", () => {
      const mixed = createMixedPotion(cardById["health-potion"]!, cardById["mana-potion"]!);
      const ingredient = cardById["stoneskin-potion"]!;
      setRunProgress({
        gold: 999,
        runDeck: [mixed, ingredient],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();

      const result = actions.alchemist.mixPotions(0, 1);
      expect(result?.effects).toEqual([...mixed.effects, ...ingredient.effects]);
      expect(readActiveRun(defaultGameSession).runDeck).toEqual([result]);
      expect(readRunProfile(defaultGameSession).gold).toBe(999 - ALCHEMIST_MIX_PRICE);
      expect(readActivityData(readRunSession(defaultGameSession).activity, "alchemist").mixUsed).toBe(true);
      expect(actions.alchemist.mixPotions(0, 1)).toBeNull();
      expect(readRunProfile(defaultGameSession).gold).toBe(999 - ALCHEMIST_MIX_PRICE);
    });

    it.each(["mix", "distill"] as const)(
      "rejects unsupported %s effects without spending Gold, ingredients, or the service",
      (operation) => {
        const potion = makeCard({
          id: "health-potion",
          effects: [{ kind: "heal", amount: operation === "mix" ? 1000 : 999 }],
        });
        setRunProgress({ gold: 999, runDeck: [potion, potion] });
        setAlchemistState(createInitialAlchemistState());
        const beforeRun = readActiveRun(defaultGameSession);
        const beforeVisit = readRunSession(defaultGameSession);
        const actions = buildActions();
        const result = operation === "mix" ? actions.alchemist.mixPotions(0, 1) : actions.alchemist.strengthenPotion(0);
        expect(result).toBeNull();
        expect(readRunProfile(defaultGameSession).gold).toBe(999);
        expect(readActiveRun(defaultGameSession)).toEqual(beforeRun);
        expect(readRunSession(defaultGameSession)).toEqual(beforeVisit);
        expect(playUISound).not.toHaveBeenCalled();
      },
    );
  });
  it("each preparation charges once, survives refresh and hydration, and leaves the other services available", () => {
    const originalDeck = [cardById["health-potion"]!, cardById["mana-potion"]!, cardById["stoneskin-potion"]!];
    setRunProgress({ gold: 0, runDeck: originalDeck });
    setAlchemistState(createInitialAlchemistState());
    const actions = buildActions();
    expect(actions.alchemist.strengthenPotion(0)).toBeNull();
    expect(readActiveRun(defaultGameSession).runDeck).toEqual(originalDeck);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "alchemist").mixUsed).toBe(false);

    setRunProgress({ gold: 4 * ALCHEMIST_MIX_PRICE });
    const commits: number[] = [];
    using _unsubscribe = createCleanup(
      subscribeRunSessionCommits((revision) => commits.push(revision), defaultGameSession),
    );

    const strengthened = actions.alchemist.strengthenPotion(0);
    expect(strengthened).toMatchObject({ effects: [{ kind: "heal", amount: 9 }] });
    expect(readActiveRun(defaultGameSession).runDeck).toEqual([strengthened, ...originalDeck.slice(1)]);
    expect(readRunProfile(defaultGameSession).gold).toBe(3 * ALCHEMIST_MIX_PRICE);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "alchemist")).toMatchObject({
      distillUsed: true,
      mixUsed: false,
      brewUsed: false,
    });
    expect(actions.alchemist.strengthenPotion(1)).toBeNull();
    const mixed = actions.alchemist.mixPotions(1, 2);
    expect(mixed).not.toBeNull();
    const visit = readActivityData(readRunSession(defaultGameSession).activity, "alchemist");
    const offers = visit.brewOffers;
    expect(actions.alchemist.brewPotion(-1)).toBeNull();
    const brewed = actions.alchemist.brewPotion(0);
    expect(brewed?.id).toBe(offers[0]!.id);
    expect(actions.alchemist.brewPotion(1)).toBeNull();
    expect(readRunProfile(defaultGameSession).gold).toBe(ALCHEMIST_MIX_PRICE);
    expect(readActiveRun(defaultGameSession).runDeck).toEqual([strengthened, mixed, brewed]);
    const restored = parseActiveRun(JSON.parse(JSON.stringify(snapshotRun(defaultGameSession))))!;
    if (restored.activity.kind !== "alchemist") throw new Error("Expected Alchemist visit");
    const saved = hydrateAlchemistState(restored.activity.data);
    setAlchemistState(saved);
    expect(actions.alchemist.refresh()).toBe(true);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "alchemist")).toMatchObject({
      brewUsed: true,
      mixUsed: true,
      distillUsed: true,
      brewOffers: offers,
    });
    expect(actions.alchemist.brewPotion(0)).toBeNull();
    expect(actions.alchemist.strengthenPotion(0)).toBeNull();
    expect(commits).toHaveLength(5);
    expect(playUISound).toHaveBeenCalledWith("alchemistMix");
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
      actions.merchant.buyCard(shopItemSlotKey(card.id, 0));

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

      firstActions.merchant.buyCard(shopItemSlotKey(firstCard.id, 0));
      const discountPrice = SHOP_CARD_PRICE - 7;
      const goldAfterFirst = 999 - discountPrice;

      const result = firstActions.merchant.buyCard(shopItemSlotKey(secondCard.id, 1));
      expect(result).toBe(true);
      expect(readRunProfile(defaultGameSession).gold).toBe(goldAfterFirst - SHOP_CARD_PRICE);
    });
  });
  describe("buy card", () => {
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
      expect(actions.merchant.buyCard(shopItemSlotKey("missing-card", 0))).toBe(false);
      expect(actions.merchant.buyCard(shopItemSlotKey(onShelf.id, 99))).toBe(false);
      unsubscribe();
      expect(readRunProfile(defaultGameSession).gold).toBe(999);
      expect(commits).toHaveLength(0);
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
  describe("equipment shop", () => {
    it("persists the purchase, Auto Equip, and maximum Health in one commit", () => {
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

      const result = actions.equipment.buy(instance.instanceId);

      unsubscribe();

      expect(result).toBe(true);
      expect(commits).toHaveLength(1);
      expect(readRunProfile(defaultGameSession).gold).toBe(999 - actions.equipment.getBuyPrice(instance));
      expect(readActivityData(readRunSession(defaultGameSession).activity, "equipment-shop").purchasedSlotKeys).toEqual(
        [instance.instanceId],
      );
      expect(readGearState(defaultGameSession).inventories.knight).toContainEqual(instance);
      expect(readGearState(defaultGameSession).loadouts.knight.body).toBe(instance.instanceId);
      expect(readActiveRun(defaultGameSession).runObtainedItems).toEqual([{ kind: "gear", instance }]);

      expect(readActiveRun(defaultGameSession).runMaxHealth).toBe(37);
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

      expect(actions.equipment.buy(offMenu.instanceId)).toBe(false);
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
      initializeShopForTest("trinket-shop", defaultGameSession);
      if (buyLast) {
        const trinket = trinketLibrary[0]!;
        expect(actions.trinket.buy(shopItemSlotKey(trinket.id, 0))).toBe(true);
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

      expect(actions.trinket.buy(shopItemSlotKey(trinket.id, 0))).toBe(true);
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

      const result = actions.trinket.buy(shopItemSlotKey(trinket.id, 0));

      expect(result).toBe(false);
      expect(readRunProfile(defaultGameSession).gold).toBe(999);
      expect(readGearState(defaultGameSession).ownedTrinketIds).toEqual([trinket.id]);
    });
  });
});
