// Battle session identity, victory/defeat guards, and timeout/transfer cleanup.
import { isPlayerDefeated, type BattleState } from "@/lib/battle";
import { stopAllSfx } from "@/lib/audio";
import { readBattle } from "@/features/alchemy/shared/stores/run-session-read-port";
import { setBattleStartState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import type { BattleControllerContext } from "./battle-context";

export function createBattleSession(ctx: BattleControllerContext) {
  const getStore = () => readBattle();
  const getPresentationStore = () => ctx.getPresentation();

  function isBattleSessionActive(session: number) {
    if (session !== ctx.battleSessionRef.current) return false;
    if (ctx.battleAbortControllerRef.current.signal.aborted) return false;
    const store = getStore();
    // Allow post-victory animation frames until a new session starts.
    return store.hasActiveBattle || (ctx.victoryDefeatHandledRef.current && store.battleState.enemyHealth <= 0);
  }

  function isCurrentBattleSession(session: number) {
    return isBattleSessionActive(session);
  }

  function getBattleAbortSignal(): AbortSignal {
    return ctx.battleAbortControllerRef.current.signal;
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
    prepareBattleSessionForStart();
    dispatchRunSessionCommand((draft) => setBattleStartState(draft, null));
  }

  /** Reset session identity/presentation after the new battle state commits. */
  function prepareBattleSessionForStart() {
    ctx.battleAbortControllerRef.current.abort();
    ctx.battleAbortControllerRef.current = new AbortController();
    ctx.battleSessionRef.current += 1;
    ctx.battleTimerGroupRef.current.clearAll();
    clearTransferHandles();
    stopBattleFeedback();
    ctx.cardPlayInProgressRef.current = false;
    ctx.victoryDefeatHandledRef.current = false;
    ctx.companionScheduledRef.current = false;
    ctx.onBattleSessionPreparedRef.current?.();
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
    getBattleAbortSignal,
    runIfSessionActive,
    handleVictoryDefeat,
    checkBattleEnd,
    registerTransferCancelCallback,
    clearTransferHandles,
    clearAllBattleTimeouts,
    clearBattleTimeoutsKeepCompanion,
    resetBattleSession,
    prepareBattleSessionForStart,
    finishDrawSequence,
  };
}
