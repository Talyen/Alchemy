// Battle session identity, victory/defeat guards, and timeout/transfer cleanup.
import type { RefObject } from "react";
import { TimerGroup } from "@/lib/animation/game-timer";
import { isPlayerDefeated, type BattleState } from "@/lib/battle";
import { stopAllSfx } from "@/lib/audio";
import { useBattleStore } from "../stores/battle-store";
import type { createTransferCancelRegistry } from "./transfer-lifecycle";

export type BattleSessionDeps = {
  battleSessionRef: RefObject<number>;
  battleTimerGroupRef: RefObject<TimerGroup>;
  transferCancelRegistryRef: RefObject<ReturnType<typeof createTransferCancelRegistry>>;
  cardPlayInProgressRef: RefObject<boolean>;
  victoryDefeatHandledRef: RefObject<boolean>;
  resolvedAsHasteOrStunRef: RefObject<boolean>;
  companionScheduledRef: RefObject<boolean>;
  onBattleVictory?: (() => void) | undefined;
  onBattleDefeat?: (() => void) | undefined;
};

export function createBattleSession(deps: BattleSessionDeps) {
  const getStore = () => useBattleStore.getState();

  function isCurrentBattleSession(session: number) {
    return session === deps.battleSessionRef.current && getStore().hasActiveBattle;
  }

  function runIfSessionActive<T>(session: number, fn: () => T, fallback: T): T;
  function runIfSessionActive<T>(session: number, fn: () => T): T | undefined;
  function runIfSessionActive<T>(session: number, fn: () => T, fallback?: T): T | undefined {
    if (session === deps.battleSessionRef.current && getStore().hasActiveBattle) {
      return fn();
    }
    return fallback;
  }

  function handleVictoryDefeat(kind: "victory" | "defeat") {
    if (!deps.victoryDefeatHandledRef.current) {
      deps.victoryDefeatHandledRef.current = true;
      if (kind === "victory") deps.onBattleVictory?.();
      else deps.onBattleDefeat?.();
    }
  }

  function checkBattleEnd(state: BattleState, session: number): boolean {
    if (!isCurrentBattleSession(session)) return false;
    if (isPlayerDefeated(state)) {
      handleVictoryDefeat("defeat");
      return true;
    }
    if (state.enemyHealth <= 0) {
      handleVictoryDefeat("victory");
      return true;
    }
    return false;
  }

  function registerTransferCancelCallback(callback: () => void) {
    return deps.transferCancelRegistryRef.current.register(callback);
  }

  function clearTransferHandles() {
    deps.transferCancelRegistryRef.current.cancelAll();
  }

  function clearAllBattleTimeouts() {
    deps.battleTimerGroupRef.current.clearAll();
    deps.companionScheduledRef.current = false;
  }

  function clearBattleTimeoutsKeepCompanion() {
    deps.battleTimerGroupRef.current.clearAll();
  }

  function stopBattleFeedback() {
    stopAllSfx();
  }

  function resetBattleSession() {
    deps.battleSessionRef.current += 1;
    deps.battleTimerGroupRef.current.clearAll();
    clearTransferHandles();
    stopBattleFeedback();
    deps.cardPlayInProgressRef.current = false;
    deps.victoryDefeatHandledRef.current = false;
    deps.resolvedAsHasteOrStunRef.current = false;
    deps.companionScheduledRef.current = false;
    getStore().clearRevealedCardKeys();
    getStore().setBattleStartState(null);
  }

  function finishDrawSequence(
    session: number,
    state: BattleState,
    onComplete: (session: number, state: BattleState) => void,
  ) {
    runIfSessionActive(session, () => {
      deps.cardPlayInProgressRef.current = false;
      onComplete(session, state);
    });
  }

  function getTurnResolutionStore() {
    const store = getStore();
    return {
      showCombatTexts: store.showCombatTexts.bind(store),
      setSyncedBattleState: store.setSyncedBattleState.bind(store),
      setLogicalBattleState: store.setLogicalBattleState.bind(store),
      setDisplayOverrides: store.setDisplayOverrides.bind(store),
      shakeEnemy: store.shakeEnemy.bind(store),
      shakePlayer: store.shakePlayer.bind(store),
      hurtPlayer: store.hurtPlayer.bind(store),
      hurtEnemy: store.hurtEnemy.bind(store),
    };
  }

  return {
    isCurrentBattleSession,
    runIfSessionActive,
    handleVictoryDefeat,
    checkBattleEnd,
    registerTransferCancelCallback,
    clearTransferHandles,
    clearAllBattleTimeouts,
    clearBattleTimeoutsKeepCompanion,
    resetBattleSession,
    finishDrawSequence,
    getTurnResolutionStore,
  };
}
