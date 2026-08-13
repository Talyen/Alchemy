// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import {
  getBattleStoreView,
  getNavigationStoreView,
  getRunSessionStoreView,
  resetRunBattleSlice,
  resetRunNavigationSlice,
  resetRunProgressSlice,
  setRunProgress,
} from "../../../helpers/run-domain-store-test";

vi.mock("@/lib/audio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audio")>();
  return {
    ...actual,
    playGoldGain: vi.fn(),
    playGoldSpend: vi.fn(),
    playUISound: vi.fn(),
    stopAllSfx: vi.fn(),
  };
});

vi.mock("@/lib/platform", () => ({
  setSteamRichPresence: vi.fn(),
}));

beforeEach(() => {
  resetRunProgressSlice();
  setRunProgress({ initialized: true });
  resetRunNavigationSlice();
  resetRunBattleSlice();
  resetTransientRunUi();
});

describe("useAlchemyRunController", () => {
  function renderController() {
    return renderHook(() =>
      useAlchemyRunController({
        autoEndTurn: false,
        gameMenuOpen: false,
        onMarkDifficultyCompleted: vi.fn(),
      }),
    );
  }

  it("exposes menu screen after bootstrap", () => {
    const { result } = renderController();

    expect(result.current.screen).toBe(ROUTE_SCREENS.MENU);
    expect(result.current.routeCommands).toBeDefined();
    expect(result.current.routeCommands.battle.refs).toBeDefined();
    expect(result.current.routeCommands.battle.handleEndTurn).toBeTypeOf("function");
  });

  it("resetRunState tears down run stores when navigating to menu", () => {
    vi.useFakeTimers();
    getRunSessionStoreView().setHasActiveRun(true);
    getBattleStoreView().setHasActiveBattle(true);
    getNavigationStoreView().setScreen(ROUTE_SCREENS.BATTLE);
    const { result } = renderController();

    act(() => {
      result.current.resetRunState();
    });
    act(() => {
      vi.runAllTimers();
    });
    act(() => {
      result.current.commitPendingTransition();
    });
    vi.useRealTimers();

    expect(getRunSessionStoreView().hasActiveRun).toBe(false);
    expect(getBattleStoreView().hasActiveBattle).toBe(false);
  });
});
