import { describe, expect, it, vi } from "vitest";
import { shopItemSlotKey } from "@/features/alchemy/run-loop/shop/shop-slot-keys";
import { setRunProgress } from "../../../../helpers/run-domain-store-test";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import {
  buildActions,
  createInitialAlchemistState,
  createInitialEquipmentShopState,
  createInitialShopState,
  createInitialTrinketShopState,
  requiredItem,
  setAlchemistState,
  setEquipmentShopState,
  setShopState,
  setTrinketShopState,
} from "./shop-actions-harness";
import {
  ALCHEMIST_POTION_PRICE,
  ALCHEMIST_REFRESH_PRICE,
  SHOP_CARD_PRICE,
  SHOP_REFRESH_PRICE,
  TRINKET_SHOP_TRINKET_PRICE,
} from "@/lib/game-constants";
import { playGoldSpend } from "@/lib/audio";
import type { GearInstance } from "@/lib/gear";
import { createRunRngState } from "@/lib/run-rng";

type Actions = ReturnType<typeof buildActions>;

const basicGear: GearInstance = {
  instanceId: "shop-armor",
  definitionId: "leather-armor-basic",
  affixes: [],
};

const shops = [
  {
    name: "merchant",
    seed: () => setShopState(createInitialShopState()),
    seedNoRefresh: () => setShopState({ ...createInitialShopState(), refreshesLeft: 0 }),
    seedRefresh: () => {
      const initial = createInitialShopState();
      setShopState({
        ...initial,
        purchasedSlotKeys: [shopItemSlotKey(requiredItem(initial.cards[0], "merchant card").id, 0)],
        refreshesLeft: 1,
      });
    },
    buy: (actions: Actions) => {
      const card = requiredItem(readRunSession().shopState.cards[0], "merchant card");
      return actions.merchant.buyCard(card, shopItemSlotKey(card.id, 0));
    },
    refresh: (actions: Actions) => actions.merchant.refresh(),
    read: () => readRunSession().shopState,
    buyPrice: SHOP_CARD_PRICE as number | null,
    refreshPrice: SHOP_REFRESH_PRICE,
    offeringIds: () => readRunSession().shopState.cards.map((card) => card.id),

    replayIds: () => readRunSession().shopState.cards.map((card) => card.id),
    restockDedup: true,
    initialize: (actions: Actions) => actions.merchant.initialize(),
    replayRefresh: false,
  },
  {
    name: "alchemist",
    seed: () => setAlchemistState(createInitialAlchemistState()),
    seedNoRefresh: () => setAlchemistState({ ...createInitialAlchemistState(), refreshesLeft: 0 }),
    seedRefresh: () => {
      const initial = createInitialAlchemistState();
      setAlchemistState({
        ...initial,
        purchasedSlotKeys: [shopItemSlotKey(requiredItem(initial.potions[0], "potion").id, 0)],
        refreshesLeft: 1,
      });
    },
    buy: (actions: Actions) => {
      const potion = requiredItem(readRunSession().alchemistState.potions[0], "alchemist potion");
      return actions.alchemist.buyPotion(potion, shopItemSlotKey(potion.id, 0));
    },
    refresh: (actions: Actions) => actions.alchemist.refresh(),
    read: () => readRunSession().alchemistState,
    buyPrice: ALCHEMIST_POTION_PRICE as number | null,
    refreshPrice: ALCHEMIST_REFRESH_PRICE,
    offeringIds: () => readRunSession().alchemistState.potions.map((card) => card.id),
    replayIds: () => readRunSession().alchemistState.potions.map((card) => card.id),
    restockDedup: true,
    initialize: (actions: Actions) => actions.alchemist.initialize(),
    replayRefresh: false,
  },
  {
    name: "trinket",
    seed: () => setTrinketShopState(createInitialTrinketShopState(() => 0)),
    seedNoRefresh: () => setTrinketShopState({ ...createInitialTrinketShopState(() => 0), refreshesLeft: 0 }),
    seedRefresh: () => {
      const initial = createInitialTrinketShopState(() => 0);
      setTrinketShopState({
        ...initial,
        purchasedSlotKeys: [shopItemSlotKey(requiredItem(initial.trinkets[0], "trinket").id, 0)],
        refreshesLeft: 1,
      });
    },
    buy: (actions: Actions) => {
      const trinket = requiredItem(readRunSession().trinketShopState.trinkets[0], "trinket offering");
      return actions.trinket.buy(trinket, shopItemSlotKey(trinket.id, 0));
    },
    refresh: (actions: Actions) => actions.trinket.refresh(),
    read: () => readRunSession().trinketShopState,
    buyPrice: TRINKET_SHOP_TRINKET_PRICE as number | null,
    refreshPrice: SHOP_REFRESH_PRICE,
    offeringIds: () => readRunSession().trinketShopState.trinkets.map((entry) => entry.id),
    replayIds: () => readRunSession().trinketShopState.trinkets.map((entry) => entry.id),
    restockDedup: true,
    initialize: (actions: Actions) => actions.trinket.initialize(),
    replayRefresh: true,
  },
  {
    name: "equipment",
    seed: () =>
      setEquipmentShopState({
        ...createInitialEquipmentShopState(),
        gear: [basicGear],
      }),
    seedNoRefresh: () => setEquipmentShopState({ ...createInitialEquipmentShopState(), refreshesLeft: 0 }),
    seedRefresh: () => {
      const initial = createInitialEquipmentShopState();
      setEquipmentShopState({
        ...initial,
        purchasedSlotKeys: [initial.gear[0]?.instanceId ?? "missing"],
        refreshesLeft: 1,
      });
    },
    buy: (actions: Actions) => {
      const instance = requiredItem(readRunSession().equipmentShopState.gear[0], "gear offering");
      return actions.equipment.buy(instance);
    },
    refresh: (actions: Actions) => actions.equipment.refresh(),
    read: () => readRunSession().equipmentShopState,
    buyPrice: null as number | null,
    refreshPrice: SHOP_REFRESH_PRICE,
    offeringIds: () => readRunSession().equipmentShopState.gear.map((item) => item.instanceId),
    replayIds: () => readRunSession().equipmentShopState.gear.map((item) => item.definitionId),
    restockDedup: false,
    initialize: (actions: Actions) => actions.equipment.initialize(),
    replayRefresh: false,
  },
];

describe("shop action isolation", () => {
  describe.each(shops)("$name buy", (shop) => {
    it("deducts gold, marks the slot purchased, and plays spend SFX", () => {
      setRunProgress({ gold: 999, characterId: "knight" });
      shop.seed();
      const actions = buildActions();
      const price = shop.buyPrice ?? actions.equipment.getBuyPrice(basicGear);
      const deckBefore = readActiveRun().runDeck.length;

      expect(shop.buy(actions)).toBe(true);
      expect(readRunProfile().gold).toBe(999 - price);
      expect(shop.read().firstPurchaseUsed).toBe(true);
      expect(shop.read().purchasedSlotKeys.length).toBeGreaterThan(0);
      expect(playGoldSpend).toHaveBeenCalledOnce();
      if (shop.name === "merchant") {
        expect(readActiveRun().runDeck.length).toBe(deckBefore + 1);
      }
    });

    it("returns false without a commit when gold is insufficient", () => {
      setRunProgress({ gold: 0, characterId: "knight" });
      shop.seed();
      const actions = buildActions();
      const commits: number[] = [];
      const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

      expect(shop.buy(actions)).toBe(false);
      unsubscribe();

      expect(readRunProfile().gold).toBe(0);
      expect(commits).toHaveLength(0);
      expect(playGoldSpend).not.toHaveBeenCalled();
    });

    it("no-ops a second buy of the same slot without a commit", () => {
      setRunProgress({ gold: 999, characterId: "knight" });
      shop.seed();
      const actions = buildActions();
      const price = shop.buyPrice ?? actions.equipment.getBuyPrice(basicGear);
      expect(shop.buy(actions)).toBe(true);
      const keysAfterFirst = [...shop.read().purchasedSlotKeys];
      vi.mocked(playGoldSpend).mockClear();
      const commits: number[] = [];
      const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

      expect(shop.buy(actions)).toBe(false);
      unsubscribe();

      expect(readRunProfile().gold).toBe(999 - price);
      expect(shop.read().purchasedSlotKeys).toEqual(keysAfterFirst);
      expect(commits).toHaveLength(0);
      expect(playGoldSpend).not.toHaveBeenCalled();
    });
  });

  describe.each(shops)("$name refresh", (shop) => {
    it("deducts gold, decrements refreshesLeft, and clears purchased slots", () => {
      setRunProgress({ gold: 999 });
      shop.seedRefresh();
      const actions = buildActions();
      const commits: number[] = [];
      const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

      expect(shop.refresh(actions)).toBe(true);
      unsubscribe();

      expect(shop.read().refreshesLeft).toBe(0);
      expect(readRunProfile().gold).toBe(999 - shop.refreshPrice);
      expect(shop.read().purchasedSlotKeys).toEqual([]);
      expect(commits).toHaveLength(1);
      expect(playGoldSpend).toHaveBeenCalledOnce();
    });

    it("returns false without a commit when no refresh remains", () => {
      setRunProgress({ gold: 999 });
      shop.seedNoRefresh();
      const actions = buildActions();
      const commits: number[] = [];
      const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

      expect(shop.refresh(actions)).toBe(false);
      unsubscribe();

      expect(commits).toHaveLength(0);
      expect(playGoldSpend).not.toHaveBeenCalled();
    });
  });

  describe.each(shops.filter((shop) => shop.restockDedup))("$name refresh dedup", (shop) => {
    it("does not restock the same offering id on refresh", () => {
      setRunProgress({ gold: 999 });
      shop.seed();
      const actions = buildActions();
      const beforeIds = shop.offeringIds();

      shop.refresh(actions);

      const afterIds = shop.offeringIds();
      const overlap = beforeIds.filter((id) => afterIds.includes(id));
      expect(overlap.length).toBeLessThan(beforeIds.length);
    });
  });

  describe.each(shops.filter((shop) => shop.name === "trinket" || shop.name === "equipment"))(
    "$name RNG replay",
    (shop) => {
      it("replays init from the same RNG state", () => {
        const rng = () => 0.25;
        const rngState = createRunRngState(rng);
        setRunProgress({ gold: 999, rng: rngState });
        shop.seed();

        shop.initialize(buildActions());
        const first = shop.replayIds();

        shop.seed();
        setRunProgress({ rng: rngState });
        shop.initialize(buildActions());
        expect(shop.replayIds()).toEqual(first);
      });
    },
  );

  describe.each(shops.filter((shop) => shop.replayRefresh))("$name RNG refresh replay", (shop) => {
    it("replays refresh from the same RNG state", () => {
      const rng = () => 0.25;
      const rngState = createRunRngState(rng);
      setRunProgress({ gold: 999, rng: rngState });
      shop.seedRefresh();
      shop.refresh(buildActions());
      const refreshed = shop.replayIds();

      shop.seedRefresh();
      setRunProgress({ rng: rngState });
      shop.refresh(buildActions());
      expect(shop.replayIds()).toEqual(refreshed);
    });
  });

  describe("per-shop isolation", () => {
    it("buying in merchant shop does not affect alchemist state", () => {
      setRunProgress({ gold: 999 });
      setShopState(createInitialShopState());
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();
      const card = requiredItem(readRunSession().shopState.cards[0], "merchant card");

      actions.merchant.buyCard(card, shopItemSlotKey(card.id, 0));

      expect(readRunSession().alchemistState.firstPurchaseUsed).toBe(false);
    });
  });
});
