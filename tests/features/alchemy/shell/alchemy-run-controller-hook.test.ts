import { createCleanup } from "@/lib/cleanup";
import "../../../helpers/mock-audio";
import { battlePresentation } from "@/app/battle-presentation";
import {
  mutateRunForTest,
  setBattleActiveForTest as setHasActiveBattle,
  resetRunBattleSlice,
  resetRunNavigationSlice,
  resetRunProgressSlice,
  setRunProgress,
  setRunSession,
} from "../../../helpers/run-domain-store-test";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";
import { readBattle, readHasActiveRun } from "@/features/alchemy/shared/stores/session/run-reads";
import { setGold, setHasActiveRun, setScreen } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/commands/reset";
import { sessionRuntime } from "@/features/alchemy/shared/stores/session/session-runtime";
import { readRunSession, readRunRevision } from "@/features/alchemy/shared/stores/session/run-reads";
import { gridLabyrinthMapFixture } from "../../../fixtures/labyrinth-map";
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
    return renderHook(() => useAlchemyRunController(defaultGameSession, battlePresentation));
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
    mutateRunForTest((draft) => {
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
    act(() => {});
    vi.useRealTimers();

    expect(readHasActiveRun(defaultGameSession)).toBe(false);
    expect(readBattle(defaultGameSession).hasActiveBattle).toBe(false);
  });

  it("allows Labyrinth inspection while saving but keeps room entry blocked", () => {
    const map = gridLabyrinthMapFixture();
    const room = map.nodes["labyrinth-floor-1-n0"]!;
    room.type = "rest";
    delete room.enemyId;
    setRunProgress({ contentSystemType: "labyrinth" });
    setRunSession({ hasActiveRun: true, activity: { kind: "labyrinth-map" }, labyrinthMap: map });
    const { result } = renderController();
    const completion = sessionRuntime(defaultGameSession).progressCompletion;
    using _scopeCleanup = createCleanup(() => act(() => completion.cancel()));

    act(() => completion.mark(readRunRevision(defaultGameSession) + 1));
    act(() => result.current.routeCommands.runLoop.labyrinth.handleNodeSelect(map.currentNodeId));
    expect(readRunSession(defaultGameSession).selectedLabyrinthNodeId).toBe(map.currentNodeId);
    act(() => result.current.routeCommands.runLoop.labyrinth.handleNodeSelect(room.id));
    expect(readRunSession(defaultGameSession).selectedLabyrinthNodeId).toBe(room.id);
    expect(result.current.routeCommands.runLoop.labyrinth.handleNodeEnter()).toBe(false);
    expect(readRunSession(defaultGameSession).activeLabyrinthPendingNode).toBeNull();
    act(() => result.current.routeCommands.runLoop.labyrinth.handleNodeDeselect());
    expect(readRunSession(defaultGameSession).selectedLabyrinthNodeId).toBeNull();
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
      return useAlchemyRunController(defaultGameSession, battlePresentation);
    });
    const initialRenders = renders;

    act(() => {
      mutateRunForTest((draft) => setGold(draft, 17));
    });

    expect(renders).toBe(initialRenders);
  });
});
