import { clearBattlePresentationUi } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  commitEndTurn as commitBattleEndTurn,
  clearBattleOpeningState,
  commitDevBattleVictory,
} from "@/features/alchemy/shared/stores/battle-commands";
import { clearBattleStageMarks, markBattleStage } from "@/lib/performance/battle-stage-marks";
import { isPlayerDefeated, type BattleSnapshot, type ResolvedBattleTurn } from "@/lib/battle";
import type { Screen } from "@/lib/routing";
import { stopAllSfx } from "@/lib/audio";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import type { BattleControllerContext } from "./battle-context";

export function isVictoryGraceActive(screen: Screen, enemyHealth: number, victoryDefeatHandled: boolean): boolean {
  return screen === "battle" && enemyHealth <= 0 && victoryDefeatHandled;
}

export function commitEndTurn(): ResolvedBattleTurn {
  markBattleStage("resolve-start");
  try {
    return commitBattleEndTurn();
  } finally {
    markBattleStage("resolve-end");
  }
}

export function createBattleDevOutcomes(ctx: BattleControllerContext, session: ReturnType<typeof createBattleSession>) {
  function skipCombatDevMode() {
    if (!import.meta.env.DEV || ctx.screen !== "battle") return;
    session.resetBattleSession();
    commitDevBattleVictory();
    session.handleVictoryDefeat("victory");
  }

  return { skipCombatDevMode };
}

export function createBattleSession(ctx: BattleControllerContext) {
  const getStore = () => readBattle();
  const getPresentationStore = () => ctx.getPresentation();

  function isCurrentBattleSession(session: number) {
    if (!ctx.playback.isCurrent(session)) return false;
    const store = getStore();

    return store.hasActiveBattle || (ctx.playback.finishing && store.battleState.enemyHealth <= 0);
  }

  function getBattleAbortSignal(): AbortSignal {
    return ctx.playback.signal;
  }

  function runIfSessionActive<T>(session: number, fn: () => T, fallback: T): T;
  function runIfSessionActive<T>(session: number, fn: () => T): T | undefined;
  function runIfSessionActive<T>(session: number, fn: () => T, fallback?: T): T | undefined {
    if (isCurrentBattleSession(session)) {
      return fn();
    }
    return fallback;
  }

  function handleVictoryDefeat(kind: "victory" | "defeat") {
    if (ctx.playback.finish()) {
      if (kind === "victory") ctx.onBattleVictory?.();
      else ctx.onBattleDefeat?.();
    }
  }

  function checkBattleEnd(state: BattleSnapshot, session: number): boolean {
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
    return ctx.playback.registerCancel(callback);
  }

  function clearTransferHandles() {
    ctx.playback.cancelTransfers();
  }

  function clearAllBattleTimeouts() {
    ctx.playback.timers.clearAll();
  }

  function stopBattleFeedback() {
    stopAllSfx();
  }

  function resetBattleSession() {
    prepareBattleSessionForStart();
    clearBattleOpeningState();
  }

  function prepareBattleSessionForStart() {
    ctx.playback.restart();
    clearBattleStageMarks();
    stopBattleFeedback();
    ctx.onSessionPrepared?.();
    // Full reset lives here (not just floating texts) so callers cannot get
    // the session-bump/reset ordering wrong; battle start then only arms the
    // new battle's pending flags.
    getPresentationStore().resetPresentation();
  }

  let previousScreen: Screen | undefined;
  function reconcile(screen: Screen, active: boolean): void {
    const leavingBattle = previousScreen === "battle" && screen !== "battle";
    previousScreen = screen;
    if (screen !== "battle") {
      // A battle can be prepared before its navigation fade commits. Cancel
      // only an actual departure, never the newly prepared opening sequence.
      if (leavingBattle) {
        ctx.playback.cancel();
        clearBattlePresentationUi();
      }
      return;
    }
    if (active) {
      ctx.playback.activate();
      checkBattleEnd(getStore().battleState, ctx.playback.id);
    } else if (!isVictoryGraceActive(screen, getStore().battleState.enemyHealth, ctx.playback.finishing)) {
      resetBattleSession();
      ctx.playback.cancel();
      clearBattlePresentationUi();
    }
  }

  return {
    reconcile,
    isCurrentBattleSession,
    getBattleAbortSignal,
    runIfSessionActive,
    handleVictoryDefeat,
    checkBattleEnd,
    registerTransferCancelCallback,
    clearTransferHandles,
    clearAllBattleTimeouts,
    resetBattleSession,
    prepareBattleSessionForStart,
  };
}
