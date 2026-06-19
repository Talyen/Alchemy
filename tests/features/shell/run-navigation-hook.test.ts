// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { useRunNavigation } from "@/features/alchemy/shell/use-run-navigation";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import {
  getBattleStoreView,
  getNavigationStoreView,
  getRunSessionStoreView,
  resetRunBattleSlice,
  resetRunProgressSlice,
} from "../../helpers/run-domain-store-test";

vi.mock("@/lib/audio", () => ({
  playUISound: vi.fn(),
}));

beforeEach(() => {
  resetRunProgressSlice();
  resetRunBattleSlice();
  resetTransientRunUi();
  getNavigationStoreView().setScreen(ROUTE_SCREENS.MENU);
});

describe("useRunNavigation", () => {
  it("resetRunState tears down run stores when navigating to menu", () => {
    getRunSessionStoreView().setHasActiveRun(true);
    getBattleStoreView().setHasActiveBattle(true);
    const navigateTo = vi.fn((_screen: string, onCommit?: () => void) => onCommit?.());
    const transition = vi.fn();
    const cancelPending = vi.fn();

    const { result } = renderHook(() =>
      useRunNavigation({
        screen: ROUTE_SCREENS.BATTLE,
        navigateTo,
        transition,
        cancelPending,
        onStartBattle: vi.fn(),
        onStartBossBattle: vi.fn(),
        onStartBossById: vi.fn(),
        onLabyrinthClearNode: vi.fn(),
        onLabyrinthFailNode: vi.fn(),
        onInitShop: vi.fn(),
        onInitAlchemist: vi.fn(),
        onInitTrinketShop: vi.fn(),
        onInitEquipmentShop: vi.fn(),
        onMarkDifficultyCompleted: vi.fn(),
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
