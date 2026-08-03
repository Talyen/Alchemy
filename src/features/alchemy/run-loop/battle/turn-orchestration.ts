// End-turn orchestration: enemy turn UI sequencing, haste/skipped/standard dispatch, and the end-turn button factory.
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

export interface TurnOrchestrationDeps {
  getStore: () => ReturnType<typeof getBattleSessionStore>;
  setBattleState: (state: BattleState | ((previous: BattleState) => BattleState)) => void;
  beginBattleTransition: (
    state: BattleState,
    transition: PersistedBattleTransition,
    displayOverrides: Parameters<typeof beginBattleTransition>[2],
  ) => void;
  commitBattleTransition: (state: BattleState, transition: PersistedBattleTransition | null) => void;
  clearBattleTransition: () => void;
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

function triggerCompanionEffects(
  deps: { getStore: () => ReturnType<typeof getBattleSessionStore> },
  state: BattleState,
  combatTexts: CombatTextEvent[],
) {
  if (!state.activeCompanion) return state;
  playCompanionSound(state.activeCompanion.id);
  deps.getStore().shakeCompanion();
  return processCompanionTurnStart(state, combatTexts);
}

// ── Public API ──

export function createTurnOrchestrationDeps(
  ctx: BattleControllerContext,
  session: ReturnType<typeof createBattleSession>,
  transferDeps: ReturnType<typeof createBattleTransferDeps>,
): TurnOrchestrationDeps {
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
        const texts = resolveCompanionFollowUpTexts(
          {
            getStore: getBattleSessionStore,
            setBattleState,
            isCurrentBattleSession: session.isCurrentBattleSession,
            runIfSessionActive: session.runIfSessionActive,
          },
          sessionNum,
        );
        if (texts.length > 0) {
          const store = getBattleSessionStore();
          store.showCombatTexts(texts);
          applyCombatTextPortraitFeedback(texts, store);
        }
      });
    }, COMPANION_ATTACK_DELAY);
  };

  return {
    getStore: getBattleSessionStore,
    setBattleState,
    beginBattleTransition,
    commitBattleTransition,
    clearBattleTransition,
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
export function resolveEndTurn(currentState: BattleState, session: number, deps: TurnOrchestrationDeps): boolean {
  if (!deps.isCurrentBattleSession(session)) return false;
  markBattleStage("resolve-start");
  try {
    const companionTexts: CombatTextEvent[] = [];
    const companionState = triggerCompanionEffects(deps, currentState, companionTexts);

    if (companionState.enemyHealth <= 0) {
      deps.setBattleState(companionState);
      if (companionTexts.length > 0) {
        const store = deps.getStore();
        store.showCombatTexts(companionTexts);
        applyCombatTextPortraitFeedback(companionTexts, store);
      }
      deps.handleVictoryDefeat("victory");
      return false;
    }
    if (isPlayerDefeated(companionState)) {
      deps.handleVictoryDefeat("defeat");
      return false;
    }

    const result = endPlayerTurn(companionState);

    switch (result.kind) {
      case "haste":
        resolveHasteSkipTurn(result, companionState, session, deps);
        return true;
      case "skipped":
      case "standard":
        resolveNormalEnemyTurn(result, companionState, companionTexts, session, deps);
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
  deps: TurnOrchestrationDeps,
) {
  const continuation = getBattleContinuation(result.state, result.playerTurnSkipped);
  deps.commitBattleTransition(result.state, continuation);
  if (result.combatTexts.length > 0) deps.getStore().showCombatTexts(result.combatTexts);
  void Promise.resolve(
    runHandDrawSequence(companionState.hand, result.state, () => undefined, session, deps.getDrawSequenceDeps()),
  )
    .catch((err: unknown) => deps.logBattleError("handle end turn draw sequence", err))
    .finally(() => continueAfterHasteDraw(result, session, deps));
}

function continueAfterHasteDraw(result: EndPlayerTurnResolution, session: number, deps: TurnOrchestrationDeps) {
  deps.runIfSessionActive(session, () => {
    const continuation = getBattleContinuation(result.state, result.playerTurnSkipped);
    if (!continuation) deps.clearBattleTransition();
    if (deps.checkBattleEnd(result.state, session)) return;
    if (result.playerTurnSkipped) {
      deps.clearBattleTransition();
      resolveEndTurn(result.state, session, deps);
      return;
    }
    deps.scheduleCompanionFollowUp(result.state, session);
  });
}

export function resolveNormalEnemyTurn(
  result: Extract<EndPlayerTurnResolution, { kind: "skipped" | "standard" }>,
  companionState: BattleState,
  companionTexts: CombatTextEvent[],
  session: number,
  deps: TurnOrchestrationDeps,
) {
  if (!deps.isCurrentBattleSession(session)) return;
  const enemyTurnStartTexts = [...companionTexts, ...result.enemyTurnStartCombatTexts];
  const enemyResolutionTexts = result.enemyResolutionCombatTexts;
  const store = deps.getStore();
  const dotTexts = enemyTurnStartTexts.filter((ct) => ct.target === "enemy" || ct.kind === "heal");

  if (result.state.enemyHealth <= 0 || isPlayerDefeated(result.state)) {
    if (dotTexts.length > 0) store.showCombatTexts(dotTexts);
    if (shouldHurtEnemyFromCombatTexts(dotTexts)) store.hurtEnemy();
    deps.commitBattleTransition({ ...result.state, turnPhase: "enemy", hand: [] }, null);
    deps.handleVictoryDefeat(result.state.enemyHealth <= 0 ? "victory" : "defeat");
    return;
  }

  deps.beginBattleTransition(
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

  if (deps.checkBattleEnd(result.state, session)) return;

  void executeEnemyPhase(
    result.state,
    companionState,
    enemyResolutionTexts,
    session,
    result.playerTurnSkipped,
    result.enemyPerformedAttack,
    deps,
  );
}

export async function executeEnemyPhase(
  resultState: BattleState,
  currentState: BattleState,
  combatTexts: CombatTextEvent[],
  session: number,
  playerTurnSkipped: boolean,
  enemyPerformedAttack: boolean,
  deps: TurnOrchestrationDeps,
) {
  markBattleStage("enemy-start");
  const playerTexts = combatTexts.filter((ct) => ct.target === "player");
  await delay(ENEMY_PHASE_DELAY);
  if (!deps.isCurrentBattleSession(session)) return;
  if (enemyPerformedAttack) playEnemyAttack(currentState.currentEnemy.id);
  if (!currentState.deathsDoorActive && resultState.deathsDoorActive) playBattleEvent("deathsDoor");
  if (combatTexts.length > 0) deps.getStore().showCombatTexts(combatTexts);
  applyCombatTextPortraitFeedback(playerTexts, deps.getStore());
  await delay(ENEMY_ATTACK_RECOVERY_DELAY);
  if (!deps.isCurrentBattleSession(session)) return;
  markBattleStage("enemy-end");
  await continueAfterEnemyDraw(resultState, currentState, session, playerTurnSkipped, deps);
}

async function continueAfterEnemyDraw(
  resultState: BattleState,
  currentState: BattleState,
  session: number,
  playerTurnSkipped: boolean,
  deps: TurnOrchestrationDeps,
) {
  const continuation = getBattleContinuation(resultState, playerTurnSkipped);
  let committedDuringDraw = false;
  try {
    await runHandDrawSequence(
      currentState.hand,
      resultState,
      () => {
        deps.commitBattleTransition(resultState, continuation);
        committedDuringDraw = true;
      },
      session,
      deps.getDrawSequenceDeps(),
    );
  } catch (err) {
    deps.logBattleError("handle enemy resolution draw sequence", err);
  }
  if (!deps.isCurrentBattleSession(session)) return;
  deps.runIfSessionActive(session, () => {
    if (!committedDuringDraw) {
      deps.commitBattleTransition(resultState, continuation);
    }
    if (deps.checkBattleEnd(resultState, session)) return;
    if (playerTurnSkipped) {
      deps.clearBattleTransition();
      resolveEndTurn(resultState, session, deps);
      return;
    }
    deps.scheduleCompanionFollowUp(resultState, session);
  });
}

function getBattleContinuation(state: BattleState, playerTurnSkipped: boolean): PersistedBattleTransition | null {
  if (!playerTurnSkipped || state.enemyHealth <= 0 || isPlayerDefeated(state)) return null;
  return { kind: "continue-end-turn" };
}

/** Consume a persisted transition without replaying presentation delays. */
export function resumePendingBattleTransition(session: number, deps: TurnOrchestrationDeps): void {
  if (!deps.isCurrentBattleSession(session)) return;
  const pending = deps.getStore().pendingBattleTransition;
  if (!pending) return;

  if (pending.kind === "legacy-enemy-turn") {
    const recovered = recoverLegacyEnemyPhase(deps.getStore().battleState);
    deps.commitBattleTransition(recovered, null);
    deps.checkBattleEnd(recovered, session);
    return;
  }

  if (pending.kind === "continue-end-turn") {
    const state = deps.getStore().battleState;
    deps.clearBattleTransition();
    resolveEndTurn(state, session, deps);
    return;
  }

  const state = pending.resultState;
  const continuation = getBattleContinuation(state, pending.playerTurnSkipped);
  deps.commitBattleTransition(state, continuation);
  if (deps.checkBattleEnd(state, session)) return;
  if (pending.playerTurnSkipped) {
    deps.clearBattleTransition();
    resolveEndTurn(state, session, deps);
    return;
  }
  deps.scheduleCompanionFollowUp(state, session);
}

interface CompanionTextsDeps {
  getStore: () => ReturnType<typeof getBattleSessionStore>;
  setBattleState: (state: BattleState | ((previous: BattleState) => BattleState)) => void;
  isCurrentBattleSession: (session: number) => boolean;
  runIfSessionActive: <T>(session: number, action: () => T, fallback?: T) => T;
}

function resolveCompanionFollowUpTexts(deps: CompanionTextsDeps, session: number): CombatTextEvent[] {
  return deps.runIfSessionActive(session, () => {
    const store = deps.getStore();
    const texts: CombatTextEvent[] = [];
    const newState = triggerCompanionEffects(deps, store.battleState, texts);
    deps.setBattleState(newState);
    return texts;
  }, []);
}
