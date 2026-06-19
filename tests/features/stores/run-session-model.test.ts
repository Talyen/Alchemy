// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { ROUTE_SCREENS } from "@/lib/routing";
import {
  useRunSessionBattleContext,
  useRunSessionNavigationSlice,
  useRunSessionShopSlice,
} from "@/features/alchemy/shared/stores/run-session-model";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { getBattleStoreView, getRunSessionStoreView } from "../../helpers/run-domain-store-test";

beforeEach(() => {
  resetTransientRunUi();
  getBattleStoreView().setSyncedBattleState(defaultBattleState());
  getBattleStoreView().setHasActiveBattle(false);
});

describe("run-session-model narrow hooks", () => {
  it("useRunSessionBattleContext reports battle phase when combat is active", () => {
    getBattleStoreView().setHasActiveBattle(true);
    const { result } = renderHook(() => useRunSessionBattleContext(ROUTE_SCREENS.BATTLE));
    expect(result.current.phase).toBe("battle");
    expect(result.current.battle.hasActiveBattle).toBe(true);
  });

  it("useRunSessionNavigationSlice reports meta on menu", () => {
    const { result } = renderHook(() => useRunSessionNavigationSlice(ROUTE_SCREENS.MENU));
    expect(result.current.phase).toBe("meta");
    expect(result.current.hasActiveBattle).toBe(false);
  });

  it("useRunSessionShopSlice exposes shop and alchemist state", () => {
    getRunSessionStoreView().setShopState((prev) => ({ ...prev, cards: [] }));
    const { result } = renderHook(() => useRunSessionShopSlice());
    expect(result.current.shopState.cards).toEqual([]);
    expect(result.current.alchemistState.potions).toEqual([]);
  });
});
