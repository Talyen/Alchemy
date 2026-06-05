import { describe, expect, it, beforeEach } from "vitest";
import { createEmptyRewardState } from "@/features/alchemy/navigation/reward-flow";
import {
  getRunSessionStoreView,
  resetRunSessionSlice,
  setRunSession,
} from "../../helpers/run-domain-store-test";

beforeEach(() => {
  resetRunSessionSlice();
});

describe("initial state", () => {
  it("has empty shop state", () => {
    const shop = getRunSessionStoreView().shopState;
    expect(shop.cards).toEqual([]);
    expect(shop.refreshesLeft).toBeGreaterThan(0);
    expect(shop.removeUsed).toBe(false);
    expect(shop.firstPurchaseUsed).toBe(false);
  });

  it("has empty alchemist state", () => {
    const alc = getRunSessionStoreView().alchemistState;
    expect(alc.potions).toEqual([]);
    expect(alc.refreshesLeft).toBeGreaterThan(0);
    expect(alc.mixUsed).toBe(false);
    expect(alc.firstPurchaseUsed).toBe(false);
  });

  it("starts with empty reward state", () => {
    expect(getRunSessionStoreView().rewardState).toEqual(createEmptyRewardState());
  });

  it("has no active run", () => {
    expect(getRunSessionStoreView().hasActiveRun).toBe(false);
  });

  it("starts with no labyrinth modifiers", () => {
    expect(getRunSessionStoreView().activeLabyrinthModifiers).toEqual([]);
  });
});

describe("setRewardState", () => {
  it("accepts a direct value", () => {
    const testState = { ...createEmptyRewardState(), gold: 50 };
    getRunSessionStoreView().setRewardState(testState);
    expect(getRunSessionStoreView().rewardState.gold).toBe(50);
  });

  it("accepts an updater function", () => {
    getRunSessionStoreView().setRewardState((prev) => ({ ...prev, gold: prev.gold + 25 }));
    expect(getRunSessionStoreView().rewardState.gold).toBe(25);
  });
});

describe("setShopState", () => {
  it("accepts a direct value", () => {
    getRunSessionStoreView().setShopState({ cards: [], refreshesLeft: 1, removeUsed: true, firstPurchaseUsed: false });
    expect(getRunSessionStoreView().shopState.removeUsed).toBe(true);
  });

  it("accepts an updater function", () => {
    getRunSessionStoreView().setShopState((prev) => ({ ...prev, removeUsed: !prev.removeUsed }));
    expect(getRunSessionStoreView().shopState.removeUsed).toBe(true);
  });
});

describe("setMysteryEvent", () => {
  it("sets a mystery event", () => {
    getRunSessionStoreView().setMysteryEvent({ id: "test", title: "T", art: "", narrative: "", choices: [] });
    expect(getRunSessionStoreView().mysteryEvent?.id).toBe("test");
  });

  it("clears mystery card choices via null event reset pattern", () => {
    setRunSession({
      mysteryCardChoices: [{ id: "test", title: "T", descriptionLines: [""], art: "", cost: 0, effects: [] }],
    });
    getRunSessionStoreView().setMysteryCardChoices(null);
    expect(getRunSessionStoreView().mysteryCardChoices).toBeNull();
  });
});

describe("companion and corruption setters", () => {
  it("stores companion reward cards", () => {
    const cards = [{ id: "wolf-companion", title: "Wolf", descriptionLines: [""], art: "", cost: 1, effects: [] }];
    getRunSessionStoreView().setCompanionRewardCards(cards);
    expect(getRunSessionStoreView().companionRewardCards).toEqual(cards);
  });

  it("tracks active run and corruption result", () => {
    getRunSessionStoreView().setHasActiveRun(true);
    expect(getRunSessionStoreView().hasActiveRun).toBe(true);
    getRunSessionStoreView().setCorruptionResult(null);
    expect(getRunSessionStoreView().corruptionResult).toBeNull();
  });
});

describe("setMysteryCardChoices", () => {
  it("sets a direct value", () => {
    const cards = [{ id: "a", title: "A", descriptionLines: [""], art: "", cost: 0, effects: [] }];
    getRunSessionStoreView().setMysteryCardChoices(cards);
    expect(getRunSessionStoreView().mysteryCardChoices).toHaveLength(1);
  });

  it("sets null", () => {
    getRunSessionStoreView().setMysteryCardChoices(null);
    expect(getRunSessionStoreView().mysteryCardChoices).toBeNull();
  });
});
