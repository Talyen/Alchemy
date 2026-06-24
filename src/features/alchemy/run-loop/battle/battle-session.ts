// Battle session identity, victory/defeat guards, and timeout/transfer cleanup.
import { isPlayerDefeated, type BattleState } from "@/lib/battle";
import { stopAllSfx } from "@/lib/audio";
import { readBattleStore } from "../../shared/stores/run-session-facade";
import { useBattlePresentationStore } from "./battle-presentation-store";
import type { BattleControllerContext } from "./battle-context";

/** Domain battle state plus presentation VFX actions used by turn/card-play orchestration. */
export function getBattleSessionStore() {
  return { ...readBattleStore(), ...useBattlePresentationStore.getState() };
}

export function createBattleSession(ctx: BattleControllerContext) {
  const getStore = () => readBattleStore();
  const getPresentationStore = () => useBattlePresentationStore.getState();

  function isBattleSessionActive(session: number) {
    if (session !== ctx.battleSessionRef.current) return false;
    const store = getStore();
    return store.hasActiveBattle || (ctx.victoryDefeatHandledRef.current && store.battleState.enemyHealth <= 0);
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
    if (!ctx.victoryDefeatHandledRef.current) {
      ctx.victoryDefeatHandledRef.current = true;
      if (kind === "victory") ctx.onBattleVictory?.();
      else ctx.onBattleDefeat?.();
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
    return ctx.transferCancelRegistryRef.current.register(callback);
  }

  function clearTransferHandles() {
    ctx.transferCancelRegistryRef.current.cancelAll();
  }

  function clearAllBattleTimeouts() {
    ctx.battleTimerGroupRef.current.clearAll();
    ctx.companionScheduledRef.current = false;
  }

  function clearBattleTimeoutsKeepCompanion() {
    ctx.battleTimerGroupRef.current.clearAll();
  }

  function stopBattleFeedback() {
    stopAllSfx();
  }

  function resetBattleSession() {
    ctx.battleSessionRef.current += 1;
    ctx.battleTimerGroupRef.current.clearAll();
    clearTransferHandles();
    stopBattleFeedback();
    ctx.cardPlayInProgressRef.current = false;
    ctx.victoryDefeatHandledRef.current = false;
    ctx.companionScheduledRef.current = false;
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
      ctx.cardPlayInProgressRef.current = false;
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
