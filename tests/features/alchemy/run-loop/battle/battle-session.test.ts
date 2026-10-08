import {
  setBattleActiveForTest as setHasActiveBattle,
  replaceBattleForTest as setSyncedBattleState,
} from "../../../../helpers/run-domain-store-test";
import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import { battlePresentation } from "@/app/battle-presentation";
import { battleStageMarkName, markBattleStage } from "@/lib/performance/marks";
import { defaultBattleState } from "@/lib/battle";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";

import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import { createBattleCapabilities } from "@/features/alchemy/shared/stores/battle-commands";
import { defaultGameSession } from "@/app/application-session";
import { readRunRevision } from "@/features/alchemy/shared/stores/run-reads";

function makeSession() {
  const playback = new PlaybackLifetime();
  playback.restart();
  const onBattleVictory = vi.fn();
  const onBattleDefeat = vi.fn();

  const session = createBattleSession({
    battle: createBattleCapabilities(defaultGameSession),
    playback,
    onBattleVictory,
    onBattleDefeat,
    getPresentation: () => battlePresentation.getState(),
  } as unknown as BattleControllerContext);

  return {
    session,
    battle: createBattleCapabilities(defaultGameSession),
    playback,
    onBattleVictory,
    onBattleDefeat,
  };
}

beforeEach(() => {
  resetBattlePresentationAndRun();
  dispatchGameplayCommand(
    (draft) => {
      setHasActiveBattle(draft, true);
      setScreen(draft, ROUTE_SCREENS.BATTLE);

      return acceptCommand();
    },
    undefined,
    defaultGameSession,
  );
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
    dispatchGameplayCommand(
      (draft) => {
        setHasActiveBattle(draft, false);
        setSyncedBattleState(draft, { ...defaultBattleState(), enemyHealth: 0 });

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    expect(session.isCurrentBattleSession(1)).toBe(true);
  });

  it("rejects a stale session id even during victory grace", () => {
    const { session, playback } = makeSession();
    playback.finish();
    dispatchGameplayCommand(
      (draft) => {
        setHasActiveBattle(draft, false);
        setSyncedBattleState(draft, { ...defaultBattleState(), enemyHealth: 0 });

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    expect(session.isCurrentBattleSession(2)).toBe(false);
  });

  it("resetBattleSession cancels presentation without publishing a gameplay change", () => {
    const { session, playback } = makeSession();
    const cancel = vi.fn();
    playback.registerCancel(cancel);
    const revision = readRunRevision(defaultGameSession);
    session.resetBattleSession();
    expect(playback.id).toBe(2);
    expect(cancel).toHaveBeenCalled();
    expect(readRunRevision(defaultGameSession)).toBe(revision);
  });

  it("resetBattleSession releases marks from the previous battle session", () => {
    const { session } = makeSession();
    const name = battleStageMarkName("draw-end");
    performance.clearMarks(name);
    markBattleStage("draw-end");
    markBattleStage("draw-end");
    session.clearAllBattleTimeouts();
    expect(performance.getEntriesByName(name, "mark")).toHaveLength(2);
    session.resetBattleSession();
    expect(performance.getEntriesByName(name, "mark")).toHaveLength(0);
    markBattleStage("draw-end");
    expect(performance.getEntriesByName(name, "mark")).toHaveLength(1);
    performance.clearMarks(name);
  });

  it("resetBattleSession clears portrait impact cues", () => {
    battlePresentation.setState({
      playerImpactCue: { sequence: 1, colors: ["#fff"], healthLost: true },
      enemyImpactCue: { sequence: 2, colors: ["#fff"], healthLost: true },
    });
    const { session } = makeSession();
    session.resetBattleSession();
    expect(battlePresentation.getState().playerImpactCue).toBeNull();
    expect(battlePresentation.getState().enemyImpactCue).toBeNull();
  });

  it("resetBattleSession clears floating combat texts", async () => {
    vi.useFakeTimers();
    battlePresentation.getState().showCombatTexts([{ target: "enemy", kind: "damage", stat: "health", amount: 5 }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(battlePresentation.getState().floatingCombatBursts).toHaveLength(1);

    const { session } = makeSession();
    session.resetBattleSession();
    expect(battlePresentation.getState().floatingCombatBursts).toEqual([]);
    vi.useRealTimers();
  });

  it("runIfSessionActive succeeds during victory grace when hasActiveBattle is false", () => {
    const { session, playback } = makeSession();
    playback.finish();
    dispatchGameplayCommand(
      (draft) => {
        setHasActiveBattle(draft, false);
        setSyncedBattleState(draft, { ...defaultBattleState(), enemyHealth: 0 });

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );

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
