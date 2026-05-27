import { describe, expect, it, beforeEach } from "vitest";
import { useScreenStore } from "@/features/alchemy/stores/screen-store";
import { createEmptyRewardState } from "@/features/alchemy/navigation/reward-flow";
import { SHOP_CARDS_OFFERED, ALCHEMIST_POTIONS_OFFERED } from "@/lib/game-constants";

beforeEach(() => {
  useScreenStore.setState(useScreenStore.getInitialState());
});

describe("initial state", () => {
  it("has empty shop state", () => {
    const shop = useScreenStore.getState().shopState;
    expect(shop.cards).toEqual([]);
    expect(shop.refreshesLeft).toBeGreaterThan(0);
    expect(shop.removeUsed).toBe(false);
    expect(shop.firstPurchaseUsed).toBe(false);
  });

  it("has empty alchemist state", () => {
    const alc = useScreenStore.getState().alchemistState;
    expect(alc.potions).toEqual([]);
    expect(alc.refreshesLeft).toBeGreaterThan(0);
    expect(alc.mixUsed).toBe(false);
    expect(alc.firstPurchaseUsed).toBe(false);
  });

  it("starts with empty reward state", () => {
    expect(useScreenStore.getState().rewardState).toEqual(createEmptyRewardState());
  });

  it("has no active run", () => {
    expect(useScreenStore.getState().hasActiveRun).toBe(false);
  });

  it("starts with no labyrinth modifiers", () => {
    expect(useScreenStore.getState().activeLabyrinthModifiers).toEqual([]);
  });
});

describe("initShop", () => {
  it("samples correct number of shop cards", () => {
    useScreenStore.getState().initShop();
    expect(useScreenStore.getState().shopState.cards.length).toBe(SHOP_CARDS_OFFERED);
  });

  it("resets refreshesLeft", () => {
    useScreenStore.setState((s) => ({ shopState: { ...s.shopState, refreshesLeft: 0 } }));
    useScreenStore.getState().initShop();
    expect(useScreenStore.getState().shopState.refreshesLeft).toBeGreaterThan(0);
  });

  it("resets removeUsed", () => {
    useScreenStore.setState((s) => ({ shopState: { ...s.shopState, removeUsed: true } }));
    useScreenStore.getState().initShop();
    expect(useScreenStore.getState().shopState.removeUsed).toBe(false);
  });

  it("resets firstPurchaseUsed", () => {
    useScreenStore.setState((s) => ({ shopState: { ...s.shopState, firstPurchaseUsed: true } }));
    useScreenStore.getState().initShop();
    expect(useScreenStore.getState().shopState.firstPurchaseUsed).toBe(false);
  });
});

describe("initAlchemist", () => {
  it("samples correct number of potions", () => {
    useScreenStore.getState().initAlchemist();
    expect(useScreenStore.getState().alchemistState.potions.length).toBe(ALCHEMIST_POTIONS_OFFERED);
  });

  it("filters to only potion cards", () => {
    useScreenStore.getState().initAlchemist();
    const potions = useScreenStore.getState().alchemistState.potions;
    for (const potion of potions) {
      expect(potion.id).toMatch(/-potion$/);
      expect(potion.id).not.toBe("mixed-potion");
      expect(potion.id.startsWith("mixed-potion-")).toBe(false);
    }
  });

  it("resets refreshesLeft and mixUsed", () => {
    useScreenStore.setState((s) => ({ alchemistState: { ...s.alchemistState, refreshesLeft: 0, mixUsed: true, firstPurchaseUsed: true } }));
    useScreenStore.getState().initAlchemist();
    expect(useScreenStore.getState().alchemistState.refreshesLeft).toBeGreaterThan(0);
    expect(useScreenStore.getState().alchemistState.mixUsed).toBe(false);
    expect(useScreenStore.getState().alchemistState.firstPurchaseUsed).toBe(false);
  });
});

describe("setRewardState", () => {
  it("accepts a direct value", () => {
    const testState = { ...createEmptyRewardState(), gold: 50 };
    useScreenStore.getState().setRewardState(testState);
    expect(useScreenStore.getState().rewardState.gold).toBe(50);
  });

  it("accepts an updater function", () => {
    useScreenStore.getState().setRewardState((prev) => ({ ...prev, gold: prev.gold + 25 }));
    expect(useScreenStore.getState().rewardState.gold).toBe(25);
  });
});

describe("setShopState", () => {
  it("accepts a direct value", () => {
    useScreenStore.getState().setShopState({ cards: [], refreshesLeft: 1, removeUsed: true, firstPurchaseUsed: false });
    expect(useScreenStore.getState().shopState.removeUsed).toBe(true);
  });

  it("accepts an updater function", () => {
    useScreenStore.getState().setShopState((prev) => ({ ...prev, removeUsed: !prev.removeUsed }));
    expect(useScreenStore.getState().shopState.removeUsed).toBe(true);
  });
});

describe("setMysteryEvent", () => {
  it("sets a mystery event", () => {
    useScreenStore.getState().setMysteryEvent({ id: "test", title: "T", art: "", narrative: "", choices: [] });
    expect(useScreenStore.getState().mysteryEvent?.id).toBe("test");
  });

  it("clears mystery card choices via null event reset pattern", () => {
    useScreenStore.setState({ mysteryCardChoices: [{ id: "test", title: "T", descriptionLines: [""], art: "", cost: 0, effects: [] }] });
    useScreenStore.getState().setMysteryCardChoices(null);
    expect(useScreenStore.getState().mysteryCardChoices).toBeNull();
  });
});

describe("setHoveredCardId", () => {
  it("sets a direct value", () => {
    useScreenStore.getState().setHoveredCardId("card-1");
    expect(useScreenStore.getState().hoveredCardId).toBe("card-1");
  });

  it("accepts an updater function", () => {
    useScreenStore.setState({ hoveredCardId: "card-1" });
    useScreenStore.getState().setHoveredCardId((prev) => (prev === "card-1" ? null : prev));
    expect(useScreenStore.getState().hoveredCardId).toBeNull();
  });
});

describe("companion and corruption setters", () => {
  it("stores companion reward cards", () => {
    const cards = [{ id: "wolf-companion", title: "Wolf", descriptionLines: [""], art: "", cost: 1, effects: [] }];
    useScreenStore.getState().setCompanionRewardCards(cards);
    expect(useScreenStore.getState().companionRewardCards).toEqual(cards);
  });

  it("tracks active run and corruption result", () => {
    useScreenStore.getState().setHasActiveRun(true);
    expect(useScreenStore.getState().hasActiveRun).toBe(true);
    useScreenStore.getState().setCorruptionResult(null);
    expect(useScreenStore.getState().corruptionResult).toBeNull();
  });
});

describe("setMysteryCardChoices", () => {
  it("sets a direct value", () => {
    const cards = [{ id: "a", title: "A", descriptionLines: [""], art: "", cost: 0, effects: [] }];
    useScreenStore.getState().setMysteryCardChoices(cards);
    expect(useScreenStore.getState().mysteryCardChoices).toHaveLength(1);
  });

  it("sets null", () => {
    useScreenStore.getState().setMysteryCardChoices(null);
    expect(useScreenStore.getState().mysteryCardChoices).toBeNull();
  });
});
