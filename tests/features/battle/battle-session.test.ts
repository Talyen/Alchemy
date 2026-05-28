import { describe, expect, it, vi, beforeEach } from "vitest";
import { createBattleSession } from "@/features/alchemy/battle/battle-session";
import { createTransferCancelRegistry } from "@/features/alchemy/battle/transfer-lifecycle";
import { useBattleStore } from "@/features/alchemy/stores/battle-store";
import { defaultBattleState } from "@/lib/battle";
import { TimerGroup } from "@/lib/animation/game-timer";

function makeSession() {
  const battleSessionRef = { current: 1 };
  const battleTimerGroupRef = { current: new TimerGroup() };
  const transferCancelRegistryRef = { current: createTransferCancelRegistry() };
  const cardPlayInProgressRef = { current: false };
  const victoryDefeatHandledRef = { current: false };
  const resolvedAsHasteOrStunRef = { current: false };
  const companionScheduledRef = { current: false };
  const onBattleVictory = vi.fn();
  const onBattleDefeat = vi.fn();

  const session = createBattleSession({
    battleSessionRef,
    battleTimerGroupRef,
    transferCancelRegistryRef,
    cardPlayInProgressRef,
    victoryDefeatHandledRef,
    resolvedAsHasteOrStunRef,
    companionScheduledRef,
    onBattleVictory,
    onBattleDefeat,
  });

  return { session, battleSessionRef, onBattleVictory, onBattleDefeat, transferCancelRegistryRef };
}

beforeEach(() => {
  useBattleStore.setState(useBattleStore.getInitialState());
  useBattleStore.getState().setHasActiveBattle(true);
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
    useBattleStore.getState().hurtPlayer();
    useBattleStore.getState().hurtEnemy();
    const { session } = makeSession();
    session.resetBattleSession();
    expect(useBattleStore.getState().playerHurtFlashToken).toBe(0);
    expect(useBattleStore.getState().enemyHurtFlashToken).toBe(0);
  });
});
