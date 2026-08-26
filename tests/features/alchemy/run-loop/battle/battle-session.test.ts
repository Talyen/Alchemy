import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import { createTurnOrchestration } from "@/features/alchemy/run-loop/battle/turn-orchestration";
import { createTransferCancelRegistry } from "@/features/alchemy/run-loop/battle/card-transfer-animations";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { defaultBattleState } from "@/lib/battle";
import { companionLibrary } from "@/lib/game-data";
import { COMPANION_ATTACK_DELAY } from "@/lib/game-constants";
import { TimerGroup } from "@/lib/animation/game-timer";
import { getBattleStoreView, getNavigationStoreView } from "../../../../helpers/run-domain-store-test";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import type { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfer-deps";

function makeSession() {
  const battleSessionRef = { current: 1 };
  const battleAbortControllerRef = { current: new AbortController() };
  const battleTimerGroupRef = { current: new TimerGroup() };
  const transferCancelRegistryRef = { current: createTransferCancelRegistry() };
  const cardPlayInProgressRef = { current: false };
  const victoryDefeatHandledRef = { current: false };
  const companionScheduledRef = { current: false };
  const companionTimerGroupRef = { current: new TimerGroup() };
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
    companionScheduledRef,
    companionTimerGroupRef,
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
    companionTimerGroupRef,
    companionScheduledRef,
  };
}

beforeEach(() => {
  resetBattlePresentationAndRun();
  getBattleStoreView().setHasActiveBattle(true);
  getNavigationStoreView().setScreen(ROUTE_SCREENS.BATTLE);
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

  it("resetBattleSession bumps session id and cancels transfers", () => {
    const { session, battleSessionRef, transferCancelRegistryRef } = makeSession();
    const cancel = vi.fn();
    transferCancelRegistryRef.current.register(cancel);
    session.resetBattleSession();
    expect(battleSessionRef.current).toBe(2);
    expect(cancel).toHaveBeenCalled();
  });

  it("resetBattleSession clears portrait hurt tokens", () => {
    useBattlePresentationStore.getState().hurtPlayer();
    useBattlePresentationStore.getState().hurtEnemy();
    const { session } = makeSession();
    session.resetBattleSession();
    expect(useBattlePresentationStore.getState().playerHurtFlashToken).toBe(0);
    expect(useBattlePresentationStore.getState().enemyHurtFlashToken).toBe(0);
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
    getBattleStoreView().setHasActiveBattle(false);
    getBattleStoreView().setSyncedBattleState({ ...defaultBattleState(), enemyHealth: 0 });

    const fn = vi.fn(() => "ok");
    const result = session.runIfSessionActive(1, fn);

    expect(fn).toHaveBeenCalledOnce();
    expect(result).toBe("ok");
  });

  it("clears cardPlayInProgress even when the session is inactive", () => {
    const { session, battleSessionRef, cardPlayInProgressRef } = makeSession();
    cardPlayInProgressRef.current = true;
    battleSessionRef.current = 2;
    const onComplete = vi.fn();

    session.finishDrawSequence(1, defaultBattleState(), onComplete);

    expect(cardPlayInProgressRef.current).toBe(false);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("keeps companion timers when clearing battle timeouts", () => {
    vi.useFakeTimers();
    const { session, battleTimerGroupRef, companionTimerGroupRef, companionScheduledRef } = makeSession();
    const battleFn = vi.fn();
    const companionFn = vi.fn();
    battleTimerGroupRef.current.setTimeout(battleFn, 50);
    companionTimerGroupRef.current.setTimeout(companionFn, 50);
    companionScheduledRef.current = true;

    session.clearBattleTimeoutsKeepCompanion();
    vi.advanceTimersByTime(50);

    expect(battleFn).not.toHaveBeenCalled();
    expect(companionFn).toHaveBeenCalledOnce();
    expect(companionScheduledRef.current).toBe(true);
  });

  it("cancels companion timers and resets the scheduled flag on full teardown", () => {
    vi.useFakeTimers();
    const { session, companionTimerGroupRef, companionScheduledRef } = makeSession();
    const companionFn = vi.fn();
    companionTimerGroupRef.current.setTimeout(companionFn, 50);
    companionScheduledRef.current = true;

    session.clearAllBattleTimeouts();
    vi.advanceTimersByTime(50);

    expect(companionFn).not.toHaveBeenCalled();
    expect(companionScheduledRef.current).toBe(false);
  });
});

function makeCompanionOrchestration(made: ReturnType<typeof makeSession>) {
  const ctx = {
    companionScheduledRef: made.companionScheduledRef,
    companionTimerGroupRef: made.companionTimerGroupRef,
    battleTimerGroupRef: made.battleTimerGroupRef,
    getPresentation: () => useBattlePresentationStore.getState(),
    scheduleAutoEndTurnRef: { current: null },
  } as unknown as BattleControllerContext;
  return createTurnOrchestration(ctx, made.session, { getDrawSequenceDeps: () => ({}) } as unknown as ReturnType<
    typeof createBattleTransferDeps
  >);
}

describe("scheduleCompanionFollowUp", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("still fires after end-turn clears battle timeouts", () => {
    vi.useFakeTimers();
    const made = makeSession();
    getBattleStoreView().setSyncedBattleState({
      ...defaultBattleState(),
      activeCompanion: companionLibrary.wolf,
      enemyHealth: 20,
    });
    const orch = makeCompanionOrchestration(made);
    orch.scheduleCompanionFollowUp(
      { ...defaultBattleState(), activeCompanion: companionLibrary.wolf, enemyHealth: 20 },
      1,
    );
    expect(made.companionScheduledRef.current).toBe(true);
    made.session.clearBattleTimeoutsKeepCompanion();
    vi.advanceTimersByTime(COMPANION_ATTACK_DELAY);
    expect(made.companionScheduledRef.current).toBe(false);
    expect(useBattlePresentationStore.getState().companionAttackToken).toBe(1);
    expect(useBattlePresentationStore.getState().companionShaking).toBe(true);
  });

  it("allows a later turn to schedule after full teardown", () => {
    vi.useFakeTimers();
    const made = makeSession();
    const orch = makeCompanionOrchestration(made);
    const withCompanion = { ...defaultBattleState(), activeCompanion: companionLibrary.wolf, enemyHealth: 20 };
    orch.scheduleCompanionFollowUp(withCompanion, 1);
    made.session.clearAllBattleTimeouts();
    expect(made.companionScheduledRef.current).toBe(false);
    orch.scheduleCompanionFollowUp(withCompanion, 1);
    expect(made.companionScheduledRef.current).toBe(true);
  });
});
