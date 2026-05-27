// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useShopController } from "@/features/alchemy/use-shop-controller";
import { useRunStore, type TalentStateController } from "@/features/alchemy/stores/run-store";
import { makeRunController, makeTalentController as makeTalentControllerFromStore } from "../helpers/run-controller";
import { useScreenStore } from "@/features/alchemy/stores/screen-store";
import { createEmptyTalentManifest } from "@/lib/game-data";
import { SHOP_CARD_PRICE, SHOP_REFRESH_PRICE, SHOP_REMOVE_PRICE } from "@/lib/game-constants";

vi.mock("@/lib/audio", () => ({
  playGoldSpend: vi.fn(),
  playGoldGain: vi.fn(),
}));

vi.mock("@/features/alchemy/utils", async () => {
  const actual = await vi.importActual<typeof import("@/features/alchemy/utils")>("@/features/alchemy/utils");
  return {
    ...actual,
    resampleItems: vi.fn((pool: { id: string }[]) => pool.slice(0, 3)),
  };
});

function makeTalentController(overrides: Partial<TalentStateController> = {}): TalentStateController {
  return {
    ...makeTalentControllerFromStore(),
    talentEffects: createEmptyTalentManifest(),
    ...overrides,
  };
}

function renderShopController() {
  return renderHook(() =>
    useShopController({
      run: makeRunController(),
      talents: makeTalentController(),
      setDiscoveredCardIds: vi.fn(),
    }),
  );
}

beforeEach(() => {
  useRunStore.setState(useRunStore.getInitialState());
  useScreenStore.setState(useScreenStore.getInitialState());
});

describe("useShopController", () => {
  it("handleShopBuyCard deducts gold and appends the card", () => {
    useRunStore.setState({ runGold: 999 });
    const { result, rerender } = renderShopController();

    act(() => {
      result.current.initShop();
      rerender();
    });

    const card = useScreenStore.getState().shopState.cards[0];
    expect(card).toBeDefined();

    act(() => {
      result.current.handleShopBuyCard(card!);
      rerender();
    });

    expect(useRunStore.getState().runGold).toBe(999 - SHOP_CARD_PRICE);
    expect(useRunStore.getState().runDeck.some((entry) => entry.id === card!.id)).toBe(true);
    expect(useScreenStore.getState().shopState.firstPurchaseUsed).toBe(true);
  });

  it("handleShopBuyCard no-ops when gold is insufficient", () => {
    useRunStore.setState({ runGold: 0 });
    const { result, rerender } = renderShopController();

    act(() => {
      result.current.initShop();
      rerender();
    });

    const card = useScreenStore.getState().shopState.cards[0];
    const deckBefore = useRunStore.getState().runDeck.length;

    act(() => {
      result.current.handleShopBuyCard(card!);
      rerender();
    });

    expect(useRunStore.getState().runGold).toBe(0);
    expect(useRunStore.getState().runDeck.length).toBe(deckBefore);
  });

  it("handleShopRemoveCard deducts gold and removes the chosen card", () => {
    useRunStore.setState({
      runGold: 999,
      runDeck: [
        { id: "a", title: "A", descriptionLines: [""], art: "", cost: 1, effects: [] },
        { id: "b", title: "B", descriptionLines: [""], art: "", cost: 1, effects: [] },
      ],
    });
    const { result, rerender } = renderShopController();

    act(() => {
      result.current.handleShopRemoveCard(0);
      rerender();
    });

    expect(useRunStore.getState().runGold).toBe(999 - SHOP_REMOVE_PRICE);
    expect(useRunStore.getState().runDeck.map((card) => card.id)).toEqual(["b"]);
    expect(useScreenStore.getState().shopState.removeUsed).toBe(true);
  });

  it("handleShopRefresh spends gold and decrements refreshesLeft", () => {
    useRunStore.setState({ runGold: 999 });
    const { result, rerender } = renderShopController();

    act(() => {
      result.current.initShop();
      rerender();
    });

    const before = useScreenStore.getState().shopState.refreshesLeft;

    act(() => {
      result.current.handleShopRefresh();
      rerender();
    });

    expect(useRunStore.getState().runGold).toBe(999 - SHOP_REFRESH_PRICE);
    expect(useScreenStore.getState().shopState.refreshesLeft).toBe(before - 1);
  });
});
