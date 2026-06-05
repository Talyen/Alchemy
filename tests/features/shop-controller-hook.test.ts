// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useShopController } from "@/features/alchemy/shell/use-shop-controller";
import { type TalentStateController } from "@/features/alchemy/stores/run-store";
import { makeRunController, makeTalentController as makeTalentControllerFromStore } from "../helpers/run-controller";
import { resetScreenStores } from "@/features/alchemy/stores/screen-store";
import { createEmptyTalentManifest } from "@/lib/game-data";
import { SHOP_CARD_PRICE, SHOP_REFRESH_PRICE, SHOP_REMOVE_PRICE } from "@/lib/game-constants";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunProgressSlice,
  setRunProgress,
} from "../helpers/run-domain-store-test";

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
  resetRunProgressSlice();
  resetScreenStores();
});

describe("useShopController", () => {
  it("handleShopBuyCard deducts gold and appends the card", () => {
    setRunProgress({ runGold: 999 });
    const { result, rerender } = renderShopController();

    act(() => {
      result.current.initShop();
      rerender();
    });

    const card = getRunSessionStoreView().shopState.cards[0];
    expect(card).toBeDefined();

    act(() => {
      result.current.handleShopBuyCard(card!);
      rerender();
    });

    expect(getRunProgressStoreView().runGold).toBe(999 - SHOP_CARD_PRICE);
    expect(getRunProgressStoreView().runDeck.some((entry) => entry.id === card!.id)).toBe(true);
    expect(getRunSessionStoreView().shopState.firstPurchaseUsed).toBe(true);
  });

  it("handleShopBuyCard no-ops when gold is insufficient", () => {
    setRunProgress({ runGold: 0 });
    const { result, rerender } = renderShopController();

    act(() => {
      result.current.initShop();
      rerender();
    });

    const card = getRunSessionStoreView().shopState.cards[0];
    const deckBefore = getRunProgressStoreView().runDeck.length;

    act(() => {
      result.current.handleShopBuyCard(card!);
      rerender();
    });

    expect(getRunProgressStoreView().runGold).toBe(0);
    expect(getRunProgressStoreView().runDeck.length).toBe(deckBefore);
  });

  it("handleShopRemoveCard deducts gold and removes the chosen card", () => {
    setRunProgress({
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

    expect(getRunProgressStoreView().runGold).toBe(999 - SHOP_REMOVE_PRICE);
    expect(getRunProgressStoreView().runDeck.map((card) => card.id)).toEqual(["b"]);
    expect(getRunSessionStoreView().shopState.removeUsed).toBe(true);
  });

  it("handleShopRefresh spends gold and decrements refreshesLeft", () => {
    setRunProgress({ runGold: 999 });
    const { result, rerender } = renderShopController();

    act(() => {
      result.current.initShop();
      rerender();
    });

    const before = getRunSessionStoreView().shopState.refreshesLeft;

    act(() => {
      result.current.handleShopRefresh();
      rerender();
    });

    expect(getRunProgressStoreView().runGold).toBe(999 - SHOP_REFRESH_PRICE);
    expect(getRunSessionStoreView().shopState.refreshesLeft).toBe(before - 1);
  });
});
