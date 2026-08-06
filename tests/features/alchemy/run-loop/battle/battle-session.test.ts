import { describe, expect, it, vi, beforeEach } from "vitest";
import { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import { createTransferCancelRegistry } from "@/features/alchemy/run-loop/battle/card-transfer-animations";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { defaultBattleState } from "@/lib/battle";
import { TimerGroup } from "@/lib/animation/game-timer";
import {
  getBattleStoreView,
  getNavigationStoreView,
  resetRunBattleSlice,
} from "../../../../helpers/run-domain-store-test";
import { ROUTE_SCREENS } from "@/lib/routing";

import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";

function makeSession() {
  const battleSessionRef = { current: 1 };
  const battleAbortControllerRef = { current: new AbortController() };
  const battleTimerGroupRef = { current: new TimerGroup() };
  const transferCancelRegistryRef = { current: createTransferCancelRegistry() };
  const cardPlayInProgressRef = { current: false };
  const victoryDefeatHandledRef = { current: false };
  const companionScheduledRef = { current: false };
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
    onBattleVictory,
    onBattleDefeat,
  } as unknown as BattleControllerContext);

  return {
    session,
    battleSessionRef,
    battleAbortControllerRef,
    victoryDefeatHandledRef,
    onBattleVictory,
    onBattleDefeat,
    transferCancelRegistryRef,
  };
}

beforeEach(() => {
  resetRunBattleSlice();
  useBattlePresentationStore.setState(useBattlePresentationStore.getInitialState());
  getBattleStoreView().setHasActiveBattle(true);
  getNavigationStoreView().setScreen(ROUTE_SCREENS.BATTLE);
});

describe("createBattleSession", () => {
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
});
