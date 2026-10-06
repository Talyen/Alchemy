import "../../../helpers/mock-audio";

import { setBattleActiveForTest as setHasActiveBattle } from "../../../helpers/run-domain-store-test";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readBattle, readHasActiveRun } from "@/features/alchemy/shared/stores/run-reads";
import { setGold, setHasActiveRun, setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import {
  resetRunBattleSlice,
  resetRunNavigationSlice,
  resetRunProgressSlice,
  setRunProgress,
} from "../../../helpers/run-domain-store-test";
import { defaultGameSession } from "@/app/application-session";
vi.mock("@/lib/platform", () => ({
  setSteamRichPresence: vi.fn(),
}));

beforeEach(() => {
  resetRunProgressSlice();
  setRunProgress({ initialized: true });
  resetRunNavigationSlice();
  resetRunBattleSlice();
  resetTransientRunUi(defaultGameSession);
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
    dispatchRunSessionCommand(
      (draft) => {
        setHasActiveRun(draft, true);
        setHasActiveBattle(draft, true);
        setScreen(draft, ROUTE_SCREENS.BATTLE);

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    const { result } = renderController();

    act(() => {
      result.current.resetRunState();
    });
    act(() => {
      vi.runAllTimers();
    });
    act(() => {});
    vi.useRealTimers();

    expect(readHasActiveRun(defaultGameSession)).toBe(false);
    expect(readBattle(defaultGameSession).hasActiveBattle).toBe(false);
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
      dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, 17)), undefined, defaultGameSession);
    });

    expect(renders).toBe(initialRenders);
  });
});
