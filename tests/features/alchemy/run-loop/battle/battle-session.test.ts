import {
  mutateGameplayForTest,
  setBattleActiveForTest as setHasActiveBattle,
  replaceBattleForTest as setSyncedBattleState,
} from "../../../../helpers/run-domain-store-test";
import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import { battlePresentation } from "@/app/battle-presentation";
import { battleStageMarkName, markBattleStage } from "@/lib/performance/marks";
import { defaultBattleState } from "@/lib/battle";
import { cardById } from "@/lib/game-data";
import { setScreen } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import { createBattleCapabilities } from "@/features/alchemy/shared/stores/commands/battle-commands";
import { defaultGameSession } from "@/app/application-session";
import { readRunRevision } from "@/features/alchemy/shared/stores/session/run-reads";

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
  mutateGameplayForTest((draft) => {
    setHasActiveBattle(draft, true);
    setScreen(draft, ROUTE_SCREENS.BATTLE);
  });
});

describe("createBattleSession", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it.each([
    { playerHealth: 10, enemyHealth: 0, deathsDoorActive: false, expected: "victory" },
    { playerHealth: 0, enemyHealth: 10, deathsDoorActive: false, expected: "defeat" },
    { playerHealth: 0, enemyHealth: 0, deathsDoorActive: false, expected: "defeat" },
    { playerHealth: 0, enemyHealth: 0, deathsDoorActive: true, expected: "victory" },
    { playerHealth: 0, enemyHealth: 10, deathsDoorActive: true, expected: null },
  ])(
    "settles $expected once at hero $playerHealth / enemy $enemyHealth, Death's Door $deathsDoorActive",
    ({ expected, ...health }) => {
      const { session, onBattleVictory, onBattleDefeat } = makeSession();
      const state = { ...defaultBattleState(), ...health };
      expect(session.checkBattleEnd(state, 1)).toBe(expected !== null);
      session.checkBattleEnd(state, 1);
      expect(onBattleVictory).toHaveBeenCalledTimes(expected === "victory" ? 1 : 0);
      expect(onBattleDefeat).toHaveBeenCalledTimes(expected === "defeat" ? 1 : 0);
    },
  );

  it.each(["player", "enemy"] as const)(
    "settles every pending Wish before victory during the %s phase",
    (turnPhase) => {
      const { session, battle, onBattleVictory } = makeSession();
      mutateGameplayForTest((draft) =>
        setSyncedBattleState(draft, {
          ...defaultBattleState(),
          enemyHealth: 0,
          turnPhase,
          wishOptions: [cardById.slash!],
          wishQueue: [[cardById.heal!]],
        }),
      );
      let state = battle.read().battleState;
      expect(session.checkBattleEnd(state, 1)).toBe(false);
      expect(onBattleVictory).not.toHaveBeenCalled();
      expect(battle.chooseWish(state, "slash")).not.toBeNull();
      state = battle.read().battleState;
      expect(session.checkBattleEnd(state, 1)).toBe(false);
      expect(battle.chooseWish(state, "heal")).not.toBeNull();
      state = battle.read().battleState;
      expect(session.checkBattleEnd(state, 1)).toBe(true);
      session.checkBattleEnd(state, 1);
      expect(state.hand.map((card) => card.id)).toEqual(["slash", "heal"]);
      expect(onBattleVictory).toHaveBeenCalledOnce();
    },
  );

  it("ignores checkBattleEnd when session is stale", () => {
    const { session, playback, onBattleVictory } = makeSession();
    playback.restart();
    const state = { ...defaultBattleState(), enemyHealth: 0 };
    expect(session.checkBattleEnd(state, 1)).toBe(false);
    expect(onBattleVictory).not.toHaveBeenCalled();
  });

  it("keeps the current session active during victory grace after the battle flag clears", () => {
    const { session, playback } = makeSession();
    playback.finish(playback.id);
    mutateGameplayForTest((draft) => {
      setHasActiveBattle(draft, false);
      setSyncedBattleState(draft, { ...defaultBattleState(), enemyHealth: 0 });
    });
    expect(session.isCurrentBattleSession(1)).toBe(true);
  });

  it("rejects a stale session id even during victory grace", () => {
    const { session, playback } = makeSession();
    playback.finish(playback.id);
    mutateGameplayForTest((draft) => {
      setHasActiveBattle(draft, false);
      setSyncedBattleState(draft, { ...defaultBattleState(), enemyHealth: 0 });
    });
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
    const { session, playback } = makeSession();
    const name = battleStageMarkName("draw-end");
    performance.clearMarks(name);
    markBattleStage("draw-end");
    markBattleStage("draw-end");
    session.clearAllBattleTimeouts(playback.id);
    expect(performance.getEntriesByName(name, "mark")).toHaveLength(2);
    session.resetBattleSession();
    expect(performance.getEntriesByName(name, "mark")).toHaveLength(0);
    markBattleStage("draw-end");
    expect(performance.getEntriesByName(name, "mark")).toHaveLength(1);
    performance.clearMarks(name);
  });

  it("resetBattleSession clears portrait impact cues", () => {
    battlePresentation.getState().showCombatTexts([
      { target: "player", kind: "damage", stat: "physical", amount: 5 },
      { target: "enemy", kind: "damage", stat: "physical", amount: 5 },
    ]);
    expect(battlePresentation.getState().playerImpactCue).not.toBeNull();
    expect(battlePresentation.getState().enemyImpactCue).not.toBeNull();
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
    playback.finish(playback.id);
    mutateGameplayForTest((draft) => {
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
    playback.beginAction(playback.id);
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
    playback.beginAction(playback.id);
    session.reconcile("menu", true);
    expect(oldSignal.aborted).toBe(true);
    expect(cancel).toHaveBeenCalledOnce();
    expect(playback.canAcceptInput()).toBe(false);
    session.reconcile("battle", true);
    playback.beginAction(playback.id);
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
    playback.beginAction(playback.id);
    session.handleVictoryDefeat("victory");
    playback.completeAction(playback.id);
    playback.scheduleAutoEndTurn(defaultBattleState());
    session.handleVictoryDefeat("victory");
    expect(onBattleVictory).toHaveBeenCalledOnce();
    expect(playback.canAcceptInput()).toBe(false);
    expect(scheduleAutoEndTurn).not.toHaveBeenCalled();
  });
});
