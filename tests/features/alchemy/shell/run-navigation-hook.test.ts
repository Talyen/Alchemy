// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { useRunFlowEngine } from "@/features/alchemy/shell/use-run-flow-engine";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import {
  getBattleStoreView,
  getNavigationStoreView,
  getRunSessionStoreView,
  resetRunBattleSlice,
  resetRunProgressSlice,
} from "../../../helpers/run-domain-store-test";

vi.mock("@/lib/audio", () => ({
  playUISound: vi.fn(),
}));

beforeEach(() => {
  resetRunProgressSlice();
  resetRunBattleSlice();
  resetTransientRunUi();
  getNavigationStoreView().setScreen(ROUTE_SCREENS.MENU);
});

describe("useRunFlowEngine", () => {
  it("resetRunState tears down run stores when navigating to menu", () => {
    getRunSessionStoreView().setHasActiveRun(true);
    getBattleStoreView().setHasActiveBattle(true);
    const navigateTo = vi.fn((_screen: string, onCommit?: () => void) => onCommit?.());
    const transition = vi.fn();
    const cancelPending = vi.fn();

    const { result } = renderHook(() =>
      useRunFlowEngine({
        screen: ROUTE_SCREENS.BATTLE,
        navigateTo,
        transition,
        cancelPending,
        battle: {
          onStartBattle: vi.fn(),
          onStartBossBattle: vi.fn(),
          onStartBossById: vi.fn(),
        },
        labyrinth: {
          onLabyrinthClearNode: vi.fn(),
          onLabyrinthFailNode: vi.fn(),
        },
        shop: {
          onInitShop: vi.fn(),
          onInitAlchemist: vi.fn(),
          onInitTrinketShop: vi.fn(),
          onInitEquipmentShop: vi.fn(),
        },
        onMarkDifficultyCompleted: vi.fn(),
        randomSources: {
          rewards: () => 0.5,
          destinations: () => 0.5,
          events: () => 0.5,
          world: () => 0.5,
        },
      }),
    );

    act(() => {
      result.current.resetRunState();
    });

    expect(cancelPending).toHaveBeenCalledOnce();
    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.MENU, expect.any(Function));
    expect(getRunSessionStoreView().hasActiveRun).toBe(false);
    expect(getBattleStoreView().hasActiveBattle).toBe(false);
  });
});
