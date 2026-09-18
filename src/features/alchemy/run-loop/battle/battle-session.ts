import { current } from "immer";
import { clearBattleStageMarks, markBattleStage } from "@/lib/performance/battle-stage-marks";
import {
  battleSnapshot,
  isPlayerDefeated,
  processCompanionTurnStart,
  recoverLegacyEnemyPhase,
  resolveBattleTurn,
  type BattleSnapshot,
  type ResolvedBattleTurn,
} from "@/lib/battle";
import type { Screen } from "@/lib/routing";
import { stopAllSfx } from "@/lib/audio";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import {
  awardBattleDodgeXP,
  commitBattleTransition,
  createDraftRunRandomSource,
  setBattleStartState,
  setBattleState,
  withDraftWorldBattleRng,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { clearPendingDraws } from "./draw-sequence";
import type { BattleControllerContext } from "./battle-context";

export function isVictoryGraceActive(screen: Screen, enemyHealth: number, victoryDefeatHandled: boolean): boolean {
  return screen === "battle" && enemyHealth <= 0 && victoryDefeatHandled;
}

export function commitEndTurn(): ResolvedBattleTurn {
  markBattleStage("resolve-start");
  try {
    return dispatchRunSessionCommand((draft) => {
      const before = current(draft.battle.battleState);
      const result = resolveBattleTurn(before, { rng: createDraftRunRandomSource(draft, "world") });
      awardBattleDodgeXP(draft, before, result.state);
      commitBattleTransition(draft, result.state, null);
      return result;
    });
  } finally {
    markBattleStage("resolve-end");
  }
}

/** Older saves can contain a precomputed result. Consume it once without repeating its rolls or XP. */
export function resumePendingBattleTransition(
  sessionNum: number,
  session: Pick<ReturnType<typeof createBattleSession>, "isCurrentBattleSession" | "checkBattleEnd">,
): BattleSnapshot | null {
  if (!session.isCurrentBattleSession(sessionNum) || !readBattle().pendingBattleTransition) return null;
  const state = dispatchRunSessionCommand((draft) => {
    const pending = draft.battle.pendingBattleTransition ? current(draft.battle.pendingBattleTransition) : null;
    if (!pending) return current(draft.battle.battleState);
    let state = "resultState" in pending ? pending.resultState : current(draft.battle.battleState);
    if (pending.kind === "legacy-enemy-turn") {
      state = battleSnapshot(recoverLegacyEnemyPhase(withDraftWorldBattleRng(draft, state)));
    } else if (pending.kind === "continue-end-turn" || ("playerTurnSkipped" in pending && pending.playerTurnSkipped)) {
      const result = resolveBattleTurn(state, { rng: createDraftRunRandomSource(draft, "world") });
      awardBattleDodgeXP(draft, state, result.state);
      state = result.state;
    } else if (pending.kind === "enemy-turn" && state.enemyHealth > 0 && !isPlayerDefeated(state)) {
      state = battleSnapshot(processCompanionTurnStart(withDraftWorldBattleRng(draft, state), []));
    }
    commitBattleTransition(draft, state, null);
    return state;
  });
  session.checkBattleEnd(state, sessionNum);
  return state;
}

export function createBattleDevOutcomes(ctx: BattleControllerContext, session: ReturnType<typeof createBattleSession>) {
  function forceBattleOutcome(outcome: "victory" | "defeat", patch: (state: BattleSnapshot) => BattleSnapshot) {
    session.resetBattleSession();
    dispatchRunSessionCommand((draft) => setBattleState(draft, patch));
    session.handleVictoryDefeat(outcome);
  }

  function skipCombatDevMode() {
    if (!import.meta.env.DEV || ctx.screen !== "battle") return;
    forceBattleOutcome("victory", (c) => ({ ...c, enemyHealth: 0, wishOptions: null, wishQueue: [] }));
  }

  return { skipCombatDevMode };
}

export function createBattleSession(ctx: BattleControllerContext) {
  const getStore = () => readBattle();
  const getPresentationStore = () => ctx.getPresentation();

  function isCurrentBattleSession(session: number) {
    if (session !== ctx.battleSessionRef.current) return false;
    if (ctx.battleAbortControllerRef.current.signal.aborted) return false;
    const store = getStore();

    return store.hasActiveBattle || (ctx.victoryDefeatHandledRef.current && store.battleState.enemyHealth <= 0);
  }

  function getBattleAbortSignal(): AbortSignal {
    return ctx.battleAbortControllerRef.current.signal;
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
    if (!ctx.victoryDefeatHandledRef.current) {
      ctx.victoryDefeatHandledRef.current = true;
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
    return ctx.transferCancelRegistryRef.current.register(callback);
  }

  function clearTransferHandles() {
    ctx.transferCancelRegistryRef.current.cancelAll();
  }

  function clearAllBattleTimeouts() {
    ctx.battleTimerGroupRef.current.clearAll();
  }

  function stopBattleFeedback() {
    stopAllSfx();
  }

  function resetBattleSession() {
    prepareBattleSessionForStart();
    dispatchRunSessionCommand((draft) => setBattleStartState(draft, null));
  }

  function prepareBattleSessionForStart() {
    ctx.battleAbortControllerRef.current.abort();
    ctx.battleAbortControllerRef.current = new AbortController();
    ctx.battleSessionRef.current += 1;
    clearPendingDraws(ctx.battleSessionRef.current);
    clearAllBattleTimeouts();
    clearTransferHandles();
    clearBattleStageMarks();
    stopBattleFeedback();
    ctx.cardPlayInProgressRef.current = false;
    ctx.victoryDefeatHandledRef.current = false;
    ctx.onBattleSessionPreparedRef.current?.();
    // Full reset lives here (not just floating texts) so callers cannot get
    // the session-bump/reset ordering wrong; battle start then only arms the
    // new battle's pending flags.
    getPresentationStore().resetPresentation();
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
    resetBattleSession,
    prepareBattleSessionForStart,
  };
}
