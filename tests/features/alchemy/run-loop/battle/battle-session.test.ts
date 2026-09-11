import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import { createTransferCancelRegistry } from "@/features/alchemy/run-loop/battle/card-transfer-animations";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { battleStageMarkName, markBattleStage } from "@/lib/performance/battle-stage-marks";
import { defaultBattleState } from "@/lib/battle";
import { TimerGroup } from "@/lib/animation/game-timer";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setHasActiveBattle, setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import { setSyncedBattleState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";

function makeSession() {
  const battleSessionRef = { current: 1 };
  const battleAbortControllerRef = { current: new AbortController() };
  const battleTimerGroupRef = { current: new TimerGroup() };
  const transferCancelRegistryRef = { current: createTransferCancelRegistry() };
  const cardPlayInProgressRef = { current: false };
  const victoryDefeatHandledRef = { current: false };
  const onBattleSessionPreparedRef = { current: null };
  const onBattleVictory = vi.fn();
  const onBattleDefeat = vi.fn();

  const session = createBattleSession({
    battleSessionRef,
    battleAbortControllerRef,
    battleTimerGroupRef,
    transferCancelRegistryRef,
    cardPlayInProgressRef,
    victoryDefeatHandledRef,
    onBattleSessionPreparedRef,
    onBattleVictory,
    onBattleDefeat,
    getPresentation: () => useBattlePresentationStore.getState(),
  } as unknown as BattleControllerContext);

  return {
    session,
    battleSessionRef,
    battleAbortControllerRef,
    victoryDefeatHandledRef,
    cardPlayInProgressRef,
    onBattleVictory,
    onBattleDefeat,
    transferCancelRegistryRef,
    battleTimerGroupRef,
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
    const { session, battleSessionRef, onBattleVictory } = makeSession();
    battleSessionRef.current = 2;
    const state = { ...defaultBattleState(), enemyHealth: 0 };
    expect(session.checkBattleEnd(state, 1)).toBe(false);
    expect(onBattleVictory).not.toHaveBeenCalled();
  });

  it("keeps the current session active during victory grace after the battle flag clears", () => {
    const { session, victoryDefeatHandledRef } = makeSession();
    victoryDefeatHandledRef.current = true;
    dispatchRunSessionCommand((draft) => {
      setHasActiveBattle(draft, false);
      setSyncedBattleState(draft, { ...defaultBattleState(), enemyHealth: 0 });
    });
    expect(session.isCurrentBattleSession(1)).toBe(true);
  });

  it("rejects a stale session id even during victory grace", () => {
    const { session, victoryDefeatHandledRef } = makeSession();
    victoryDefeatHandledRef.current = true;
    dispatchRunSessionCommand((draft) => {
      setHasActiveBattle(draft, false);
      setSyncedBattleState(draft, { ...defaultBattleState(), enemyHealth: 0 });
    });
    expect(session.isCurrentBattleSession(2)).toBe(false);
  });

  it("resetBattleSession bumps session id and cancels transfers", () => {
    const { session, battleSessionRef, transferCancelRegistryRef } = makeSession();
    const cancel = vi.fn();
    transferCancelRegistryRef.current.register(cancel);
    session.resetBattleSession();
    expect(battleSessionRef.current).toBe(2);
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
    expect(useBattlePresentationStore.getState().floatingCombatTexts).toHaveLength(1);

    const { session } = makeSession();
    session.resetBattleSession();
    expect(useBattlePresentationStore.getState().floatingCombatTexts).toEqual([]);
    vi.useRealTimers();
  });

  it("runIfSessionActive succeeds during victory grace when hasActiveBattle is false", () => {
    const { session, victoryDefeatHandledRef } = makeSession();
    victoryDefeatHandledRef.current = true;
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
    const { session, battleSessionRef, cardPlayInProgressRef } = makeSession();
    cardPlayInProgressRef.current = true;
    battleSessionRef.current = 2;
    const onComplete = vi.fn();

    const result = session.runIfSessionActive(1, onComplete, undefined);

    expect(result).toBeUndefined();
    expect(onComplete).not.toHaveBeenCalled();
    expect(cardPlayInProgressRef.current).toBe(true);
  });
});
