// End-turn orchestration: enemy turn UI sequencing, haste/skipped/standard dispatch.
// Pass session + transfer helpers; write-port and session-store are imported directly (no re-bundle).
import {
  endPlayerTurn,
  isPlayerDefeated,
  processCompanionTurnStart,
  recoverLegacyEnemyPhase,
  type BattleState,
  type CombatTextEvent,
  type EndPlayerTurnResolution,
} from "@/lib/battle";
import { playBattleEvent, playEnemyAttack } from "@/lib/audio";
import { ENEMY_ATTACK_RECOVERY_DELAY, ENEMY_PHASE_DELAY, COMPANION_ATTACK_DELAY } from "@/lib/game-constants";
import { delay } from "@/lib/animation/game-timer";
import { logError } from "@/lib/error-logger";
import { useBattlePresentationStore } from "./battle-presentation-store";
import {
  beginBattleTransition,
  clearBattleTransition,
  commitBattleTransition,
  setBattleState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import { applyCombatTextPortraitFeedback, shouldHurtEnemyFromCombatTexts } from "./battle-feedback";
import { playCompanionSound } from "./controller-utils";
import { runHandDrawSequence, type HandDrawSequenceDeps } from "./draw-sequence";
import { getBattleSessionStore, type createBattleSession } from "./battle-session";
import { markBattleStage } from "@/lib/performance/battle-stage-marks";
import type { createBattleTransferDeps } from "./battle-transfer-deps";
import type { BattleControllerContext } from "./battle-context";

/** Session + presentation helpers for end-turn sequencing (write-port is module-scoped). */
export interface TurnOrchestration {
  isCurrentBattleSession: (session: number) => boolean;
  runIfSessionActive: <T>(session: number, action: () => T, fallback?: T) => T;
  checkBattleEnd: (state: BattleState, session: number) => boolean;
  handleVictoryDefeat: (outcome: "victory" | "defeat") => void;
  getDrawSequenceDeps: () => HandDrawSequenceDeps;
  logBattleError: (context: string, err: unknown) => void;
  resetHandTransferUi: () => void;
  scheduleCompanionFollowUp: (resultState: BattleState, session: number) => void;
}

// ── Helpers ──

function triggerCompanionEffects(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (!state.activeCompanion) return state;
  playCompanionSound(state.activeCompanion.id);
  getBattleSessionStore().shakeCompanion();
  return processCompanionTurnStart(state, combatTexts);
}

export function createTurnOrchestration(
  ctx: BattleControllerContext,
  session: ReturnType<typeof createBattleSession>,
  transferDeps: ReturnType<typeof createBattleTransferDeps>,
): TurnOrchestration {
  const logBattleError = (context: string, err: unknown) => {
    logError(`Failed to ${context}`, "battle", { error: String(err) }, err instanceof Error ? err.stack : undefined);
  };

  const scheduleCompanionFollowUp = (resultState: BattleState, sessionNum: number) => {
    if (!resultState.activeCompanion || resultState.enemyHealth <= 0) return;
    if (ctx.companionScheduledRef.current) return;
    ctx.companionScheduledRef.current = true;
    ctx.battleTimerGroupRef.current.setTimeout(() => {
      session.runIfSessionActive(sessionNum, () => {
        ctx.companionScheduledRef.current = false;
        const texts = resolveCompanionFollowUpTexts(session, sessionNum);
        if (texts.length > 0) {
          const store = getBattleSessionStore();
          store.showCombatTexts(texts);
          applyCombatTextPortraitFeedback(texts, store);
        }
      });
    }, COMPANION_ATTACK_DELAY);
  };

  return {
    isCurrentBattleSession: session.isCurrentBattleSession,
    runIfSessionActive: session.runIfSessionActive,
    checkBattleEnd: session.checkBattleEnd,
    handleVictoryDefeat: session.handleVictoryDefeat,
    getDrawSequenceDeps: () => transferDeps.getDrawSequenceDeps(),
    logBattleError,
    resetHandTransferUi: () => useBattlePresentationStore.getState().resetHandTransferUi(),
    scheduleCompanionFollowUp,
  };
}

/** Top-level end-turn dispatch. Returns true when an async draw sequence was started (haste), false otherwise. */
export function resolveEndTurn(currentState: BattleState, session: number, orch: TurnOrchestration): boolean {
  if (!orch.isCurrentBattleSession(session)) return false;
  markBattleStage("resolve-start");
  try {
    const companionTexts: CombatTextEvent[] = [];
    const companionState = triggerCompanionEffects(currentState, companionTexts);

    if (companionState.enemyHealth <= 0) {
      setBattleState(companionState);
      if (companionTexts.length > 0) {
        const store = getBattleSessionStore();
        store.showCombatTexts(companionTexts);
        applyCombatTextPortraitFeedback(companionTexts, store);
      }
      orch.handleVictoryDefeat("victory");
      return false;
    }
    if (isPlayerDefeated(companionState)) {
      orch.handleVictoryDefeat("defeat");
      return false;
    }

    const result = endPlayerTurn(companionState);

    switch (result.kind) {
      case "haste":
        resolveHasteSkipTurn(result, companionState, session, orch);
        return true;
      case "skipped":
      case "standard":
        resolveNormalEnemyTurn(result, companionState, companionTexts, session, orch);
        return false;
    }
  } finally {
    markBattleStage("resolve-end");
  }
}

export function resolveHasteSkipTurn(
  result: EndPlayerTurnResolution,
  companionState: BattleState,
  session: number,
  orch: TurnOrchestration,
) {
  const continuation = getBattleContinuation(result.state, result.playerTurnSkipped);
  commitBattleTransition(result.state, continuation);
  if (result.combatTexts.length > 0) getBattleSessionStore().showCombatTexts(result.combatTexts);
  void Promise.resolve(
    runHandDrawSequence(companionState.hand, result.state, () => undefined, session, orch.getDrawSequenceDeps()),
  )
    .catch((err: unknown) => orch.logBattleError("handle end turn draw sequence", err))
    .finally(() => continueAfterHasteDraw(result, session, orch));
}

function continueAfterHasteDraw(result: EndPlayerTurnResolution, session: number, orch: TurnOrchestration) {
  orch.runIfSessionActive(session, () => {
    const continuation = getBattleContinuation(result.state, result.playerTurnSkipped);
    if (!continuation) clearBattleTransition();
    if (orch.checkBattleEnd(result.state, session)) return;
    if (result.playerTurnSkipped) {
      clearBattleTransition();
      resolveEndTurn(result.state, session, orch);
      return;
    }
    orch.scheduleCompanionFollowUp(result.state, session);
  });
}

export function resolveNormalEnemyTurn(
  result: Extract<EndPlayerTurnResolution, { kind: "skipped" | "standard" }>,
  companionState: BattleState,
  companionTexts: CombatTextEvent[],
  session: number,
  orch: TurnOrchestration,
) {
  if (!orch.isCurrentBattleSession(session)) return;
  const enemyTurnStartTexts = [...companionTexts, ...result.enemyTurnStartCombatTexts];
  const enemyResolutionTexts = result.enemyResolutionCombatTexts;
  const store = getBattleSessionStore();
  const dotTexts = enemyTurnStartTexts.filter((ct) => ct.target === "enemy" || ct.kind === "heal");

  if (result.state.enemyHealth <= 0 || isPlayerDefeated(result.state)) {
    if (dotTexts.length > 0) store.showCombatTexts(dotTexts);
    if (shouldHurtEnemyFromCombatTexts(dotTexts)) store.hurtEnemy();
    commitBattleTransition({ ...result.state, turnPhase: "enemy", hand: [] }, null);
    orch.handleVictoryDefeat(result.state.enemyHealth <= 0 ? "victory" : "defeat");
    return;
  }

  beginBattleTransition(
    { ...result.enemyTurnStartState, turnPhase: "enemy" },
    {
      kind: "enemy-turn",
      resultState: result.state,
      playerTurnSkipped: result.playerTurnSkipped,
    },
    {
      hand: [],
      playerHealth: companionState.playerHealth,
      playerStatuses: companionState.playerStatuses,
      turnPhase: "enemy",
    },
  );

  if (dotTexts.length > 0) store.showCombatTexts(dotTexts);
  if (shouldHurtEnemyFromCombatTexts(dotTexts)) store.hurtEnemy();

  if (orch.checkBattleEnd(result.state, session)) return;

  void executeEnemyPhase(
    result.state,
    companionState,
    enemyResolutionTexts,
    session,
    result.playerTurnSkipped,
    result.enemyPerformedAttack,
    orch,
  );
}

export async function executeEnemyPhase(
  resultState: BattleState,
  currentState: BattleState,
  combatTexts: CombatTextEvent[],
  session: number,
  playerTurnSkipped: boolean,
  enemyPerformedAttack: boolean,
  orch: TurnOrchestration,
) {
  markBattleStage("enemy-start");
  const playerTexts = combatTexts.filter((ct) => ct.target === "player");
  await delay(ENEMY_PHASE_DELAY);
  if (!orch.isCurrentBattleSession(session)) return;
  if (enemyPerformedAttack) playEnemyAttack(currentState.currentEnemy.id);
  if (!currentState.deathsDoorActive && resultState.deathsDoorActive) playBattleEvent("deathsDoor");
  if (combatTexts.length > 0) getBattleSessionStore().showCombatTexts(combatTexts);
  applyCombatTextPortraitFeedback(playerTexts, getBattleSessionStore());
  await delay(ENEMY_ATTACK_RECOVERY_DELAY);
  if (!orch.isCurrentBattleSession(session)) return;
  markBattleStage("enemy-end");
  await continueAfterEnemyDraw(resultState, currentState, session, playerTurnSkipped, orch);
}

async function continueAfterEnemyDraw(
  resultState: BattleState,
  currentState: BattleState,
  session: number,
  playerTurnSkipped: boolean,
  orch: TurnOrchestration,
) {
  const continuation = getBattleContinuation(resultState, playerTurnSkipped);
  let committedDuringDraw = false;
  try {
    await runHandDrawSequence(
      currentState.hand,
      resultState,
      () => {
        commitBattleTransition(resultState, continuation);
        committedDuringDraw = true;
      },
      session,
      orch.getDrawSequenceDeps(),
    );
  } catch (err) {
    orch.logBattleError("handle enemy resolution draw sequence", err);
  }
  if (!orch.isCurrentBattleSession(session)) return;
  orch.runIfSessionActive(session, () => {
    if (!committedDuringDraw) {
      commitBattleTransition(resultState, continuation);
    }
    if (orch.checkBattleEnd(resultState, session)) return;
    if (playerTurnSkipped) {
      clearBattleTransition();
      resolveEndTurn(resultState, session, orch);
      return;
    }
    orch.scheduleCompanionFollowUp(resultState, session);
  });
}

function getBattleContinuation(state: BattleState, playerTurnSkipped: boolean): PersistedBattleTransition | null {
  if (!playerTurnSkipped || state.enemyHealth <= 0 || isPlayerDefeated(state)) return null;
  return { kind: "continue-end-turn" };
}

/** Consume a persisted transition without replaying presentation delays. */
export function resumePendingBattleTransition(session: number, orch: TurnOrchestration): void {
  if (!orch.isCurrentBattleSession(session)) return;
  const pending = getBattleSessionStore().pendingBattleTransition;
  if (!pending) return;

  if (pending.kind === "legacy-enemy-turn") {
    const recovered = recoverLegacyEnemyPhase(getBattleSessionStore().battleState);
    commitBattleTransition(recovered, null);
    orch.checkBattleEnd(recovered, session);
    return;
  }

  if (pending.kind === "continue-end-turn") {
    const state = getBattleSessionStore().battleState;
    clearBattleTransition();
    resolveEndTurn(state, session, orch);
    return;
  }

  const state = pending.resultState;
  const continuation = getBattleContinuation(state, pending.playerTurnSkipped);
  commitBattleTransition(state, continuation);
  if (orch.checkBattleEnd(state, session)) return;
  if (pending.playerTurnSkipped) {
    clearBattleTransition();
    resolveEndTurn(state, session, orch);
    return;
  }
  orch.scheduleCompanionFollowUp(state, session);
}

function resolveCompanionFollowUpTexts(
  session: ReturnType<typeof createBattleSession>,
  sessionNum: number,
): CombatTextEvent[] {
  return session.runIfSessionActive(sessionNum, () => {
    const store = getBattleSessionStore();
    const texts: CombatTextEvent[] = [];
    const newState = triggerCompanionEffects(store.battleState, texts);
    setBattleState(newState);
    return texts;
  }, []);
}
