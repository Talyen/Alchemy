// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { useRunNavigation } from "@/features/alchemy/shell/use-run-navigation";
import { useBattleStore } from "@/features/alchemy/stores/battle-store";
import { useRunStore } from "@/features/alchemy/stores/run-store";
import { useRunSessionStore } from "@/features/alchemy/stores/run-session-store";
import { useNavigationStore } from "@/features/alchemy/shared/stores/navigation-store";
import { resetScreenStores } from "@/features/alchemy/stores/screen-store";

vi.mock("@/lib/audio", () => ({
  playUISound: vi.fn(),
}));

beforeEach(() => {
  useRunStore.setState(useRunStore.getInitialState());
  useBattleStore.setState(useBattleStore.getInitialState());
  resetScreenStores();
  useNavigationStore.getState().setScreen(ROUTE_SCREENS.MENU);
});

describe("useRunNavigation", () => {
  it("resetRunState tears down run stores when navigating to menu", () => {
    useRunSessionStore.getState().setHasActiveRun(true);
    useBattleStore.getState().setHasActiveBattle(true);
    const navigateTo = vi.fn((_screen: string, onCommit?: () => void) => onCommit?.());
    const setScreen = vi.fn();

    const { result } = renderHook(() =>
      useRunNavigation({
        screen: ROUTE_SCREENS.BATTLE,
        setScreen,
        navigateTo,
        onStartBattle: vi.fn(),
        onStartBossBattle: vi.fn(),
        onStartBossById: vi.fn(),
        onLabyrinthClearNode: vi.fn(),
        onLabyrinthFailNode: vi.fn(),
        onInitShop: vi.fn(),
        onInitAlchemist: vi.fn(),
        onMarkDifficultyCompleted: vi.fn(),
      }),
    );

    act(() => {
      result.current.resetRunState();
    });

    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.MENU, expect.any(Function));
    expect(useRunSessionStore.getState().hasActiveRun).toBe(false);
    expect(useBattleStore.getState().hasActiveBattle).toBe(false);
  });
});
