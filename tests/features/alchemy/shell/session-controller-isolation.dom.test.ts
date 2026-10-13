import "../../../helpers/mock-audio";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGameSession,
  type GameSession,
  type GameSessionOptions,
} from "@/features/alchemy/shared/stores/game-session";
import { createBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";
import { useBattleController } from "@/features/alchemy/shell/use-battle-controller";
import { showRunScreen } from "@/features/alchemy/shared/stores/navigation-commands";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { readBattle, readRunRevision } from "@/features/alchemy/shared/stores/run-reads";
import { sessionRuntime } from "@/features/alchemy/shared/stores/session-runtime";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setGold, setHasActiveRun } from "@/features/alchemy/shared/stores/run-session-write-port";
import { defaultGameSession } from "@/app/application-session";

vi.mock("@/lib/platform", () => ({ setSteamRichPresence: vi.fn() }));

const sessions: GameSession[] = [];
function career(options: GameSessionOptions = {}) {
  const gameSession = createGameSession(options);
  sessions.push(gameSession);
  return { gameSession, presentation: createBattlePresentationStore(gameSession) };
}

afterEach(async () => {
  for (const session of sessions.splice(0)) await session.dispose();
});

describe("session-bound React controllers", () => {
  it("subscribes and dispatches to its own career while another controller and the application remain unchanged", () => {
    const a = career();
    const b = career();
    const application = readGameplayState(defaultGameSession);
    const first = renderHook(() => useAlchemyRunController(a.gameSession, a.presentation));
    const second = renderHook(() => useAlchemyRunController(b.gameSession, b.presentation));

    act(() => {
      showRunScreen("collection", a.gameSession);
      first.result.current.routeCommands.meta.selectCollectionTab("cards");
    });

    expect(first.result.current.screen).toBe("collection");
    expect(readGameplayState(a.gameSession).profile.collectionTab).toBe("cards");
    expect(second.result.current.screen).toBe("menu");
    expect(readGameplayState(b.gameSession).profile.collectionTab).toBe("heroes");
    expect(readGameplayState(defaultGameSession)).toBe(application);
    first.unmount();
    second.unmount();
  });

  it("keeps save-gated battle reads and autoplay settings local to their session", () => {
    const sound = vi.fn();
    const a = career({ feedback: { playUISound: sound } });
    const b = career();
    const runtime = sessionRuntime(a.gameSession);
    runtime.settings.getState().setRememberAutoplayPreference(true);
    const first = renderHook(() => useBattleController({ ...a, screen: "menu" }));
    const second = renderHook(() => useBattleController({ ...b, screen: "menu" }));
    const deactivate = runtime.progressCompletion.registerRetryDriver(() => {});
    try {
      act(() => {
        dispatchRunSessionCommand(
          (transaction) => {
            setHasActiveRun(transaction, true);
            setGold(transaction, 100);
            return acceptCommand();
          },
          undefined,
          a.gameSession,
        );
      });
      // Complete the setup receipt, then start the actual player operation.
      act(() =>
        runtime.progressCompletion.complete(runtime.progressCompletion.token(readRunRevision(a.gameSession)), "saved"),
      );
      act(() => {
        first.result.current.setAutoplayEnabled(true);
        first.result.current.startBattle();
      });
      expect(readBattle(a.gameSession).hasActiveBattle).toBe(true);
      expect(first.result.current.hasActiveBattle).toBe(false);
      expect(readBattle(b.gameSession).hasActiveBattle).toBe(false);
      expect(second.result.current.hasActiveBattle).toBe(false);
      expect(runtime.settings.getState().autoplayEnabled).toBe(true);
      expect(sound).toHaveBeenCalledExactlyOnceWith("toggleOn");
      expect(sessionRuntime(b.gameSession).settings.getState().autoplayEnabled).toBe(false);
      expect(a.presentation.getState().openingDrawPending).toBe(true);
      expect(b.presentation.getState().openingDrawPending).toBe(false);

      act(() =>
        runtime.progressCompletion.complete(runtime.progressCompletion.token(readRunRevision(a.gameSession)), "saved"),
      );
      expect(first.result.current.hasActiveBattle).toBe(true);
      expect(second.result.current.hasActiveBattle).toBe(false);
    } finally {
      first.unmount();
      second.unmount();
      deactivate();
    }
  });

  it("rejects a presentation store belonging to a different career before gameplay can run", () => {
    const a = career();
    const b = career();
    expect(() =>
      renderHook(() =>
        useBattleController({
          gameSession: a.gameSession,
          presentation: b.presentation,
          screen: "menu",
        }),
      ),
    ).toThrow(/different game sessions/);
    expect(readBattle(a.gameSession).hasActiveBattle).toBe(false);
    expect(readBattle(b.gameSession).hasActiveBattle).toBe(false);
  });
});
