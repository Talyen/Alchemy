import { describe, expect, it, beforeEach } from "vitest";
import { useRunSessionStore } from "@/features/alchemy/stores/run-session-store";
import { createEmptyRewardState } from "@/features/alchemy/navigation/reward-flow";

beforeEach(() => {
  useRunSessionStore.setState(useRunSessionStore.getInitialState(), true);
});

describe("initial state", () => {
  it("has empty shop state", () => {
    const shop = useRunSessionStore.getState().shopState;
    expect(shop.cards).toEqual([]);
    expect(shop.refreshesLeft).toBeGreaterThan(0);
    expect(shop.removeUsed).toBe(false);
    expect(shop.firstPurchaseUsed).toBe(false);
  });

  it("has empty alchemist state", () => {
    const alc = useRunSessionStore.getState().alchemistState;
    expect(alc.potions).toEqual([]);
    expect(alc.refreshesLeft).toBeGreaterThan(0);
    expect(alc.mixUsed).toBe(false);
    expect(alc.firstPurchaseUsed).toBe(false);
  });

  it("starts with empty reward state", () => {
    expect(useRunSessionStore.getState().rewardState).toEqual(createEmptyRewardState());
  });

  it("has no active run", () => {
    expect(useRunSessionStore.getState().hasActiveRun).toBe(false);
  });

  it("starts with no labyrinth modifiers", () => {
    expect(useRunSessionStore.getState().activeLabyrinthModifiers).toEqual([]);
  });
});

describe("setRewardState", () => {
  it("accepts a direct value", () => {
    const testState = { ...createEmptyRewardState(), gold: 50 };
    useRunSessionStore.getState().setRewardState(testState);
    expect(useRunSessionStore.getState().rewardState.gold).toBe(50);
  });

  it("accepts an updater function", () => {
    useRunSessionStore.getState().setRewardState((prev) => ({ ...prev, gold: prev.gold + 25 }));
    expect(useRunSessionStore.getState().rewardState.gold).toBe(25);
  });
});

describe("setShopState", () => {
  it("accepts a direct value", () => {
    useRunSessionStore.getState().setShopState({ cards: [], refreshesLeft: 1, removeUsed: true, firstPurchaseUsed: false });
    expect(useRunSessionStore.getState().shopState.removeUsed).toBe(true);
  });

  it("accepts an updater function", () => {
    useRunSessionStore.getState().setShopState((prev) => ({ ...prev, removeUsed: !prev.removeUsed }));
    expect(useRunSessionStore.getState().shopState.removeUsed).toBe(true);
  });
});

describe("setMysteryEvent", () => {
  it("sets a mystery event", () => {
    useRunSessionStore.getState().setMysteryEvent({ id: "test", title: "T", art: "", narrative: "", choices: [] });
    expect(useRunSessionStore.getState().mysteryEvent?.id).toBe("test");
  });

  it("clears mystery card choices via null event reset pattern", () => {
    useRunSessionStore.setState({
      mysteryCardChoices: [{ id: "test", title: "T", descriptionLines: [""], art: "", cost: 0, effects: [] }],
    });
    useRunSessionStore.getState().setMysteryCardChoices(null);
    expect(useRunSessionStore.getState().mysteryCardChoices).toBeNull();
  });
});

describe("companion and corruption setters", () => {
  it("stores companion reward cards", () => {
    const cards = [{ id: "wolf-companion", title: "Wolf", descriptionLines: [""], art: "", cost: 1, effects: [] }];
    useRunSessionStore.getState().setCompanionRewardCards(cards);
    expect(useRunSessionStore.getState().companionRewardCards).toEqual(cards);
  });

  it("tracks active run and corruption result", () => {
    useRunSessionStore.getState().setHasActiveRun(true);
    expect(useRunSessionStore.getState().hasActiveRun).toBe(true);
    useRunSessionStore.getState().setCorruptionResult(null);
    expect(useRunSessionStore.getState().corruptionResult).toBeNull();
  });
});

describe("setMysteryCardChoices", () => {
  it("sets a direct value", () => {
    const cards = [{ id: "a", title: "A", descriptionLines: [""], art: "", cost: 0, effects: [] }];
    useRunSessionStore.getState().setMysteryCardChoices(cards);
    expect(useRunSessionStore.getState().mysteryCardChoices).toHaveLength(1);
  });

  it("sets null", () => {
    useRunSessionStore.getState().setMysteryCardChoices(null);
    expect(useRunSessionStore.getState().mysteryCardChoices).toBeNull();
  });
});
