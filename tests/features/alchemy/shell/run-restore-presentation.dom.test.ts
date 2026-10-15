import "../../../helpers/mock-audio";
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createGameSession, type GameSession } from "@/features/alchemy/shared/stores/game-session";
import { createSessionPersistence } from "@/features/alchemy/shared/storage";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { createBattleCapabilities } from "@/features/alchemy/shared/stores/battle-commands";
import { createBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { useBattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import { createScreenNavigation } from "@/features/alchemy/shell/screen-navigation";
import { sessionRuntime } from "@/features/alchemy/shared/stores/session-runtime";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setHasActiveRun } from "@/features/alchemy/shared/stores/run-session-write-port";

const sessions: GameSession[] = [];
function career() {
  const gameSession = createGameSession();
  sessions.push(gameSession);
  return { gameSession, presentation: createBattlePresentationStore(gameSession) };
}

afterEach(async () => {
  for (const session of sessions.splice(0)) await session.dispose();
  vi.useRealTimers();
});

it("cancels an old route before restore observers run and permits fresh navigation", () => {
  vi.useFakeTimers();
  const { gameSession } = career();
  const persistence = createSessionPersistence(gameSession);
  const showScreen = vi.fn();
  const onPendingChange = vi.fn();
  const navigation = createScreenNavigation({ readScreen: () => "menu", showScreen, onPendingChange }, gameSession);
  navigation.navigateTo("collection");
  expect(onPendingChange).toHaveBeenLastCalledWith(true);
  const observer = vi.fn(() => onPendingChange.mock.lastCall?.[0]);
  persistence.subscribe(observer);
  persistence.restore(createDefaultSaveData());
  expect(observer).toHaveBeenCalledOnce();
  expect(observer).toHaveReturnedWith(false);
  vi.runAllTimers();
  expect(showScreen).not.toHaveBeenCalled();
  navigation.navigateTo("armory");
  vi.runAllTimers();
  expect(showScreen).toHaveBeenCalledExactlyOnceWith("armory");
});

it("retains pending navigation when restore fails before publication", () => {
  vi.useFakeTimers();
  const { gameSession } = career();
  const showScreen = vi.fn();
  const navigation = createScreenNavigation({ readScreen: () => "menu", showScreen }, gameSession);
  navigation.navigateTo("collection");
  const invalid = createDefaultSaveData();
  Object.defineProperty(invalid, "musicVolume", {
    get: () => {
      throw new Error("Invalid settings");
    },
  });
  expect(() => createSessionPersistence(gameSession).restore(invalid)).toThrow("Invalid settings");
  vi.runAllTimers();
  expect(showScreen).toHaveBeenCalledExactlyOnceWith("collection");
});

it("replaces mounted battle playback before restored settings or gameplay can be observed", () => {
  vi.useFakeTimers();
  const owner = career();
  dispatchRunSessionCommand(
    (transaction) => acceptCommand(setHasActiveRun(transaction, true)),
    undefined,
    owner.gameSession,
  );
  createBattleCapabilities(owner.gameSession)
    .createStartCommands(() => {})
    .startBattle();
  const persistence = createSessionPersistence(owner.gameSession);
  const savedBattle = persistence.snapshot();
  expect(savedBattle.activeRun?.activity.kind).toBe("battle");
  const context = renderHook(() =>
    useBattleControllerContext(
      {
        battle: createBattleCapabilities(owner.gameSession),
        presentation: owner.presentation,
        screen: "battle",
        setHoveredCardId: vi.fn(),
        measureElementRect: () => null,
        measureVisualCardRect: () => null,
      },
      owner.gameSession,
    ),
  );
  const playback = context.result.current.playback;
  playback.beginAction();
  const scope = playback.capture(playback.id);
  const oldSignal = playback.signal;
  const lateOutcome = vi.fn();
  const transferCancelled = vi.fn();
  scope.registerCancel(transferCancelled);
  scope.setTimeout(lateOutcome, 100);
  act(() =>
    owner.presentation.getState().setDisplayedBattle(createBattleCapabilities(owner.gameSession).read().battleState),
  );
  const observer = vi.fn(() => ({
    aborted: oldSignal.aborted,
    current: scope.isCurrent(),
    displayed: owner.presentation.getState().displayedBattle,
  }));
  const unsubscribe = sessionRuntime(owner.gameSession).settings.subscribe(observer);
  try {
    act(() => persistence.restore(savedBattle));
    expect(observer).toHaveBeenCalledOnce();
    expect(observer).toHaveReturnedWith({ aborted: true, current: false, displayed: null });
    expect(transferCancelled).toHaveBeenCalledOnce();
    expect(playback.canAcceptInput()).toBe(true);
    scope.setTimeout(lateOutcome, 0);
    vi.runAllTimers();
    expect(lateOutcome).not.toHaveBeenCalled();
    playback.capture(playback.id).setTimeout(lateOutcome, 0);
    vi.runAllTimers();
    expect(lateOutcome).toHaveBeenCalledOnce();
  } finally {
    unsubscribe();
    context.unmount();
  }
});

it("cancels mounted playback on session disposal without touching another career", async () => {
  vi.useFakeTimers();
  const first = career();
  const second = career();
  const mount = (owner: ReturnType<typeof career>) =>
    renderHook(() =>
      useBattleControllerContext(
        {
          battle: createBattleCapabilities(owner.gameSession),
          presentation: owner.presentation,
          screen: "menu",
          setHoveredCardId: vi.fn(),
          measureElementRect: () => null,
          measureVisualCardRect: () => null,
        },
        owner.gameSession,
      ),
    );
  const a = mount(first);
  const b = mount(second);
  const late = vi.fn();
  const unaffected = vi.fn();
  const old = a.result.current.playback.capture(a.result.current.playback.id);
  old.setTimeout(late, 100);
  b.result.current.playback.capture(b.result.current.playback.id).setTimeout(unaffected, 100);
  try {
    await act(() => first.gameSession.dispose());
    expect(old.isCurrent()).toBe(false);
    vi.runAllTimers();
    expect(late).not.toHaveBeenCalled();
    expect(unaffected).toHaveBeenCalledOnce();
  } finally {
    a.unmount();
    b.unmount();
  }
});
