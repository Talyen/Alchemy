import "../../../helpers/mock-audio";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readBattle, readHasActiveRun } from "@/features/alchemy/shared/stores/run-reads";
import { setHasActiveBattle, setGold, setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import { setHasActiveRun } from "@/features/alchemy/shared/stores/write-port-session";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import {
  resetRunBattleSlice,
  resetRunNavigationSlice,
  resetRunProgressSlice,
  setRunProgress,
} from "../../../helpers/run-domain-store-test";

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
    return renderHook(() => useAlchemyRunController());
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
    dispatchRunSessionCommand((draft) => {
      setHasActiveRun(draft, true);
      setHasActiveBattle(draft, true);
      setScreen(draft, ROUTE_SCREENS.BATTLE);
    });
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

    expect(readHasActiveRun()).toBe(false);
    expect(readBattle().hasActiveBattle).toBe(false);
  });

  it("keeps routeCommands identity across a no-op rerender", () => {
    const { result, rerender } = renderController();
    const first = result.current.routeCommands;
    rerender();
    expect(result.current.routeCommands).toBe(first);
  });

  it("does not subscribe the command controller to battle-start run data", () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useAlchemyRunController();
    });
    const initialRenders = renders;

    act(() => {
      dispatchRunSessionCommand((draft) => setGold(draft, 17));
    });

    expect(renders).toBe(initialRenders);
  });
});
