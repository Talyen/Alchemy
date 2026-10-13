import "../../../helpers/mock-audio";
import { battlePresentation } from "@/app/battle-presentation";

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
import { sessionRuntime } from "@/features/alchemy/shared/stores/session-runtime";
import { readRunSession, readRunRevision } from "@/features/alchemy/shared/stores/run-reads";
import { setRunSession } from "../../../helpers/run-domain-store-test";
import { gridLabyrinthMapFixture } from "../../../fixtures/labyrinth-map";
import { emptyAlchemyVisit } from "@/lib/active-run-session/alchemy-visits";
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

  it("allows Labyrinth inspection while saving but keeps room entry blocked", () => {
    const map = gridLabyrinthMapFixture();
    const room = map.nodes["labyrinth-floor-1-n0"]!;
    room.type = "rest";
    delete room.enemyId;
    setRunProgress({ contentSystemType: "labyrinth" });
    setRunSession({ hasActiveRun: true, activity: { kind: "labyrinth-map" }, labyrinthMap: map });
    const { result } = renderController();
    const completion = sessionRuntime(defaultGameSession).progressCompletion;
    try {
      act(() => completion.mark(readRunRevision(defaultGameSession) + 1));
      act(() => result.current.routeCommands.runLoop.labyrinth.handleNodeSelect(map.currentNodeId));
      expect(readRunSession(defaultGameSession).selectedLabyrinthNodeId).toBe(map.currentNodeId);
      act(() => result.current.routeCommands.runLoop.labyrinth.handleNodeSelect(room.id));
      expect(readRunSession(defaultGameSession).selectedLabyrinthNodeId).toBe(room.id);
      expect(result.current.routeCommands.runLoop.labyrinth.handleNodeEnter()).toBe(false);
      expect(readRunSession(defaultGameSession).activeLabyrinthPendingNode).toBeNull();
      act(() => result.current.routeCommands.runLoop.labyrinth.handleNodeDeselect());
      expect(readRunSession(defaultGameSession).selectedLabyrinthNodeId).toBeNull();
    } finally {
      act(() => completion.cancel());
    }
  });

  it.each(["campfire", "transmutation"] as const)("initializes %s offers while a save is pending", (kind) => {
    setRunSession({ hasActiveRun: true, activity: { kind, data: emptyAlchemyVisit() } });
    const { result } = renderController();
    const completion = sessionRuntime(defaultGameSession).progressCompletion;
    try {
      act(() => completion.mark(readRunRevision(defaultGameSession) + 1));
      act(() => {
        if (kind === "campfire") result.current.routeCommands.runLoop.destinations.initializeCampfire();
        else result.current.routeCommands.runLoop.transmutation.initialize();
      });
      const activity = readRunSession(defaultGameSession).activity;
      if (activity.kind !== "campfire" && activity.kind !== "transmutation") throw new Error("Unexpected activity");
      expect(kind === "campfire" ? activity.data.offers : activity.data.transmutation?.choices).toHaveLength(3);
    } finally {
      act(() => completion.cancel());
    }
  });

  it.each(["campfire", "transmutation"] as const)("ignores an outgoing %s route's late initialization", (kind) => {
    setRunSession({ hasActiveRun: true, activity: { kind, data: emptyAlchemyVisit() } });
    const { result } = renderController();
    const initialize =
      kind === "campfire"
        ? result.current.routeCommands.runLoop.destinations.initializeCampfire
        : result.current.routeCommands.runLoop.transmutation.initialize;
    act(() => setRunSession({ activity: { kind: "labyrinth-map" }, labyrinthMap: gridLabyrinthMapFixture() }));
    const revision = readRunRevision(defaultGameSession);
    act(() => initialize());
    expect(readRunSession(defaultGameSession).activity.kind).toBe("labyrinth-map");
    expect(readRunRevision(defaultGameSession)).toBe(revision);
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
      dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, 17)), undefined, defaultGameSession);
    });

    expect(renders).toBe(initialRenders);
  });
});
