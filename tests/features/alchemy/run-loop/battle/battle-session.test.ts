import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { battleStageMarkName, markBattleStage } from "@/lib/performance/battle-stage-marks";
import { defaultBattleState } from "@/lib/battle";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setHasActiveBattle, setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import { setSyncedBattleState } from "@/features/alchemy/shared/stores/write/run-battle";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";

function makeSession() {
  const playback = new PlaybackLifetime();
  playback.restart();
  const onBattleVictory = vi.fn();
  const onBattleDefeat = vi.fn();

  const session = createBattleSession({
    playback,
    onBattleVictory,
    onBattleDefeat,
    getPresentation: () => useBattlePresentationStore.getState(),
  } as unknown as BattleControllerContext);

  return {
    session,
    playback,
    onBattleVictory,
    onBattleDefeat,
  };
}

beforeEach(() => {
  resetBattlePresentationAndRun();
  dispatchRunSessionCommand((draft) => {
    setHasActiveBattle(draft, true);
    setScreen(draft, ROUTE_SCREENS.BATTLE);
  });
});

describe("createBattleSession", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it("fires victory once when enemy health is zero", () => {
    const { session, onBattleVictory } = makeSession();
    const state = { ...defaultBattleState(), enemyHealth: 0 };
    expect(session.checkBattleEnd(state, 1)).toBe(true);
    expect(onBattleVictory).toHaveBeenCalledOnce();
  });

  it("fires defeat when player is defeated", () => {
    const { session, onBattleDefeat } = makeSession();
    const state = { ...defaultBattleState(), playerHealth: 0, deathsDoorGraceTurns: 0 };
    expect(session.checkBattleEnd(state, 1)).toBe(true);
    expect(onBattleDefeat).toHaveBeenCalledOnce();
  });

  it("ignores checkBattleEnd when session is stale", () => {
    const { session, playback, onBattleVictory } = makeSession();
    playback.restart();
    const state = { ...defaultBattleState(), enemyHealth: 0 };
    expect(session.checkBattleEnd(state, 1)).toBe(false);
    expect(onBattleVictory).not.toHaveBeenCalled();
  });

  it("keeps the current session active during victory grace after the battle flag clears", () => {
    const { session, playback } = makeSession();
    playback.finish();
    dispatchRunSessionCommand((draft) => {
      setHasActiveBattle(draft, false);
      setSyncedBattleState(draft, { ...defaultBattleState(), enemyHealth: 0 });
    });
    expect(session.isCurrentBattleSession(1)).toBe(true);
  });

  it("rejects a stale session id even during victory grace", () => {
    const { session, playback } = makeSession();
    playback.finish();
    dispatchRunSessionCommand((draft) => {
      setHasActiveBattle(draft, false);
      setSyncedBattleState(draft, { ...defaultBattleState(), enemyHealth: 0 });
    });
    expect(session.isCurrentBattleSession(2)).toBe(false);
  });

  it("resetBattleSession bumps session id and cancels transfers", () => {
    const { session, playback } = makeSession();
    const cancel = vi.fn();
    playback.registerCancel(cancel);
    session.resetBattleSession();
    expect(playback.id).toBe(2);
    expect(cancel).toHaveBeenCalled();
  });

  it.each(["prepareBattleSessionForStart", "resetBattleSession"] as const)(
    "%s releases marks from the previous battle session",
    (reset) => {
      const { session } = makeSession();
      const name = battleStageMarkName("draw-end");
      performance.clearMarks(name);
      markBattleStage("draw-end");
      markBattleStage("draw-end");
      session.clearAllBattleTimeouts();
      expect(performance.getEntriesByName(name, "mark")).toHaveLength(2);
      session[reset]();
      expect(performance.getEntriesByName(name, "mark")).toHaveLength(0);
      markBattleStage("draw-end");
      expect(performance.getEntriesByName(name, "mark")).toHaveLength(1);
      performance.clearMarks(name);
    },
  );

  it("resetBattleSession clears portrait impact cues", () => {
    useBattlePresentationStore.setState({
      playerImpactCue: { sequence: 1, colors: ["#fff"], healthLost: true },
      enemyImpactCue: { sequence: 2, colors: ["#fff"], healthLost: true },
    });
    const { session } = makeSession();
    session.resetBattleSession();
    expect(useBattlePresentationStore.getState().playerImpactCue).toBeNull();
    expect(useBattlePresentationStore.getState().enemyImpactCue).toBeNull();
  });

  it("resetBattleSession clears floating combat texts", async () => {
    vi.useFakeTimers();
    useBattlePresentationStore
      .getState()
      .showCombatTexts([{ target: "enemy", kind: "damage", stat: "health", amount: 5 }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(useBattlePresentationStore.getState().floatingCombatBursts).toHaveLength(1);

    const { session } = makeSession();
    session.resetBattleSession();
    expect(useBattlePresentationStore.getState().floatingCombatBursts).toEqual([]);
    vi.useRealTimers();
  });

  it("runIfSessionActive succeeds during victory grace when hasActiveBattle is false", () => {
    const { session, playback } = makeSession();
    playback.finish();
    dispatchRunSessionCommand((draft) => {
      setHasActiveBattle(draft, false);
      setSyncedBattleState(draft, { ...defaultBattleState(), enemyHealth: 0 });
    });

    const fn = vi.fn(() => "ok");
    const result = session.runIfSessionActive(1, fn);

    expect(fn).toHaveBeenCalledOnce();
    expect(result).toBe("ok");
  });

  it("runIfSessionActive skips stale sessions without side effects", () => {
    const { session, playback } = makeSession();
    playback.restart();
    playback.beginAction();
    const onComplete = vi.fn();

    const result = session.runIfSessionActive(1, onComplete, undefined);

    expect(result).toBeUndefined();
    expect(onComplete).not.toHaveBeenCalled();
    expect(playback.cardPlayInProgress).toBe(true);
  });
  it("cancels playback on a menu visit and rejects late completions after returning", () => {
    const { session, playback } = makeSession();
    session.reconcile("battle", true);
    const generation = playback.id;
    const oldSignal = playback.signal;
    const cancel = vi.fn();
    playback.registerCancel(cancel);
    playback.beginAction();
    session.reconcile("menu", true);
    expect(oldSignal.aborted).toBe(true);
    expect(cancel).toHaveBeenCalledOnce();
    expect(playback.canAcceptInput()).toBe(false);
    session.reconcile("battle", true);
    playback.beginAction();
    playback.completeAction(generation);
    expect(playback.cardPlayInProgress).toBe(true);
    expect(playback.canAcceptInput()).toBe(false);
    playback.completeAction(playback.id);
    expect(playback.canAcceptInput()).toBe(true);
  });

  it("does not reopen end-turn input or auto-end-turn when a finishing animation settles", () => {
    const { session, playback, onBattleVictory } = makeSession();
    const scheduleAutoEndTurn = vi.fn();
    playback.bind({ scheduleAutoEndTurn, clearAutoEndTurn: vi.fn() });
    playback.beginAction();
    session.handleVictoryDefeat("victory");
    playback.completeAction(playback.id);
    playback.scheduleAutoEndTurn(defaultBattleState());
    session.handleVictoryDefeat("victory");
    expect(onBattleVictory).toHaveBeenCalledOnce();
    expect(playback.canAcceptInput()).toBe(false);
    expect(scheduleAutoEndTurn).not.toHaveBeenCalled();
  });
});
