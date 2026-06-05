// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { ROUTE_SCREENS } from "@/lib/routing";
import {
  useRunSessionBattleContext,
  useRunSessionNavigationSlice,
  useRunSessionShopSlice,
} from "@/features/alchemy/stores/run-session-model";
import { useBattleStore } from "@/features/alchemy/stores/battle-store";
import { useRunSessionStore } from "@/features/alchemy/stores/run-session-store";
import { resetScreenStores } from "@/features/alchemy/stores/screen-store";

beforeEach(() => {
  resetScreenStores();
  useBattleStore.getState().setSyncedBattleState(defaultBattleState());
  useBattleStore.getState().setHasActiveBattle(false);
});

describe("run-session-model narrow hooks", () => {
  it("useRunSessionBattleContext reports battle phase when combat is active", () => {
    useBattleStore.getState().setHasActiveBattle(true);
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
    useRunSessionStore.getState().setShopState((prev) => ({ ...prev, cards: [] }));
    const { result } = renderHook(() => useRunSessionShopSlice());
    expect(result.current.shopState).toBeDefined();
    expect(result.current.alchemistState).toBeDefined();
  });
});
