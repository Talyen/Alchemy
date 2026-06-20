// Battle session identity, victory/defeat guards, and timeout/transfer cleanup.
import { isPlayerDefeated, type BattleState } from "@/lib/battle";
import { stopAllSfx } from "@/lib/audio";
import { readBattleStore } from "../../shared/stores/run-session-facade";
import { useBattlePresentationStore } from "../../shared/stores/battle-presentation-store";
import type { RefObject } from "react";
import type { TimerGroup } from "@/lib/animation/game-timer";
import type { TransferCancelRegistry } from "./card-transfer-animations";

/** Domain battle state plus presentation VFX actions used by turn/card-play orchestration. */
export function getBattleSessionStore() {
  return { ...readBattleStore(), ...useBattlePresentationStore.getState() };
}

export type BattleSessionDeps = {
  battleSessionRef: RefObject<number>;
  battleTimerGroupRef: RefObject<TimerGroup>;
  transferCancelRegistryRef: RefObject<TransferCancelRegistry>;
  cardPlayInProgressRef: RefObject<boolean>;
  victoryDefeatHandledRef: RefObject<boolean>;
  resolvedAsHasteOrStunRef: RefObject<boolean>;
  companionScheduledRef: RefObject<boolean>;
  onBattleVictory?: () => void;
  onBattleDefeat?: () => void;
};

export function createBattleSession(deps: BattleSessionDeps) {
  const getStore = () => readBattleStore();
  const getPresentationStore = () => useBattlePresentationStore.getState();

  function isBattleSessionActive(session: number) {
    if (session !== deps.battleSessionRef.current) return false;
    const store = getStore();
    return store.hasActiveBattle || (deps.victoryDefeatHandledRef.current && store.battleState.enemyHealth <= 0);
  }

  function isCurrentBattleSession(session: number) {
    return isBattleSessionActive(session);
  }

  function runIfSessionActive<T>(session: number, fn: () => T, fallback: T): T;
  function runIfSessionActive<T>(session: number, fn: () => T): T | undefined;
  function runIfSessionActive<T>(session: number, fn: () => T, fallback?: T): T | undefined {
    if (isBattleSessionActive(session)) {
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
    getPresentationStore().clearRevealedCardKeys();
    getStore().setBattleStartState(null);
    getPresentationStore().resetPortraitHurtTokens();
    getPresentationStore().clearFloatingCombatTexts();
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
  };
}
