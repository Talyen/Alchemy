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
import {
  beginBattleTransition,
  clearBattleTransition,
  commitBattleTransition,
  setBattleState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import { applyCombatTextPortraitFeedback, shouldHurtEnemyFromCombatTexts } from "./battle-feedback";
import { playCompanionSound, playCombatTextSounds } from "./controller-utils";
import { runHandDrawSequence, type HandDrawSequenceDeps } from "./draw-sequence";
import { type createBattleSession } from "./battle-session";
import { markBattleStage } from "@/lib/performance/battle-stage-marks";
import type { createBattleTransferDeps } from "./battle-transfer-deps";
import type { BattleControllerContext } from "./battle-context";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readBattle } from "@/features/alchemy/shared/stores/run-session-read-port";
import type { BattlePresentationPort } from "./battle-presentation-port";

export type BattleTurnSession = Pick<
  ReturnType<typeof createBattleSession>,
  "isCurrentBattleSession" | "runIfSessionActive" | "checkBattleEnd" | "handleVictoryDefeat"
>;

/** Presentation + logging helpers for end-turn sequencing (session is passed separately). */
export interface TurnOrchestration {
  getDrawSequenceDeps: () => HandDrawSequenceDeps;
  logBattleError: (context: string, err: unknown) => void;
  resetHandTransferUi: () => void;
  scheduleCompanionFollowUp: (resultState: BattleState, sessionNum: number) => void;
  getPresentation: () => BattlePresentationPort;
}

// ── Helpers ──

function triggerCompanionEffects(state: BattleState, combatTexts: CombatTextEvent[], vfx: BattlePresentationPort) {
  if (!state.activeCompanion) return state;
  playCompanionSound(state.activeCompanion.id);
  vfx.shakeCompanion();
  return processCompanionTurnStart(state, combatTexts);
}

export function createTurnOrchestration(
  ctx: BattleControllerContext,
  session: ReturnType<typeof createBattleSession>,
  transferDeps: ReturnType<typeof createBattleTransferDeps>,
): TurnOrchestration {
  const getPresentation = () => ctx.getPresentation();
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
        const texts = resolveCompanionFollowUpTexts(session, sessionNum, getPresentation);
        if (texts.length > 0) {
          const vfx = getPresentation();
          vfx.showCombatTexts(texts);
          applyCombatTextPortraitFeedback(texts, vfx);
          playCombatTextSounds(texts);
        }
      });
    }, COMPANION_ATTACK_DELAY);
  };

  return {
    getDrawSequenceDeps: () => transferDeps.getDrawSequenceDeps(),
    logBattleError,
    resetHandTransferUi: () => getPresentation().resetHandTransferUi(),
    scheduleCompanionFollowUp,
    getPresentation,
  };
}

/** Top-level end-turn dispatch. Returns true when an async draw sequence was started (haste), false otherwise. */
export function resolveEndTurn(
  currentState: BattleState,
  sessionNum: number,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
): boolean {
  if (!battleSession.isCurrentBattleSession(sessionNum)) return false;
  markBattleStage("resolve-start");
  try {
    if (currentState.enemyHealth <= 0) {
      battleSession.handleVictoryDefeat("victory");
      return false;
    }
    if (isPlayerDefeated(currentState)) {
      battleSession.handleVictoryDefeat("defeat");
      return false;
    }

    const result = endPlayerTurn(currentState);

    switch (result.kind) {
      case "haste":
        resolveHasteSkipTurn(result, currentState, sessionNum, battleSession, orch);
        return true;
      case "skipped":
      case "standard":
        resolveNormalEnemyTurn(result, currentState, sessionNum, battleSession, orch);
        return false;
    }
  } finally {
    markBattleStage("resolve-end");
  }
}

export function resolveHasteSkipTurn(
  result: EndPlayerTurnResolution,
  companionState: BattleState,
  sessionNum: number,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
) {
  const continuation = getBattleContinuation(result.state, result.playerTurnSkipped);
  dispatchRunSessionCommand((draft) => commitBattleTransition(draft, result.state, continuation));
  if (result.combatTexts.length > 0) orch.getPresentation().showCombatTexts(result.combatTexts);
  void Promise.resolve(
    runHandDrawSequence(companionState.hand, result.state, () => undefined, sessionNum, orch.getDrawSequenceDeps()),
  )
    .catch((err: unknown) => orch.logBattleError("handle end turn draw sequence", err))
    .finally(() => continueAfterHasteDraw(result, sessionNum, battleSession, orch));
}

function continueAfterHasteDraw(
  result: EndPlayerTurnResolution,
  sessionNum: number,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
) {
  battleSession.runIfSessionActive(sessionNum, () => {
    orch.resetHandTransferUi();
    const continuation = getBattleContinuation(result.state, result.playerTurnSkipped);
    if (!continuation) dispatchRunSessionCommand((draft) => clearBattleTransition(draft));
    if (battleSession.checkBattleEnd(result.state, sessionNum)) return;
    if (result.playerTurnSkipped) {
      dispatchRunSessionCommand((draft) => clearBattleTransition(draft));
      resolveEndTurn(result.state, sessionNum, battleSession, orch);
      return;
    }
    orch.scheduleCompanionFollowUp(result.state, sessionNum);
  });
}

export function resolveNormalEnemyTurn(
  result: Extract<EndPlayerTurnResolution, { kind: "skipped" | "standard" }>,
  currentState: BattleState,
  sessionNum: number,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
) {
  if (!battleSession.isCurrentBattleSession(sessionNum)) return;
  const enemyTurnStartTexts = result.enemyTurnStartCombatTexts;
  const enemyResolutionTexts = result.enemyResolutionCombatTexts;
  const vfx = orch.getPresentation();
  const dotTexts = enemyTurnStartTexts.filter((ct) => ct.target === "enemy" || ct.kind === "heal");

  if (result.state.enemyHealth <= 0 || isPlayerDefeated(result.state)) {
    if (dotTexts.length > 0) vfx.showCombatTexts(dotTexts);
    if (shouldHurtEnemyFromCombatTexts(dotTexts)) vfx.hurtEnemy();
    dispatchRunSessionCommand((draft) =>
      commitBattleTransition(draft, { ...result.state, turnPhase: "enemy", hand: [] }, null),
    );
    battleSession.handleVictoryDefeat(result.state.enemyHealth <= 0 ? "victory" : "defeat");
    return;
  }

  dispatchRunSessionCommand((draft) =>
    beginBattleTransition(
      draft,
      { ...result.enemyTurnStartState, turnPhase: "enemy" },
      {
        kind: "enemy-turn",
        resultState: result.state,
        playerTurnSkipped: result.playerTurnSkipped,
      },
      {
        hand: [],
        playerHealth: currentState.playerHealth,
        playerStatuses: currentState.playerStatuses,
        turnPhase: "enemy",
      },
    ),
  );

  if (dotTexts.length > 0) vfx.showCombatTexts(dotTexts);
  if (shouldHurtEnemyFromCombatTexts(dotTexts)) vfx.hurtEnemy();

  if (battleSession.checkBattleEnd(result.state, sessionNum)) return;

  void executeEnemyPhase(
    result.state,
    currentState,
    enemyResolutionTexts,
    sessionNum,
    result.playerTurnSkipped,
    result.enemyPerformedAttack,
    battleSession,
    orch,
  );
}

export async function executeEnemyPhase(
  resultState: BattleState,
  currentState: BattleState,
  combatTexts: CombatTextEvent[],
  sessionNum: number,
  playerTurnSkipped: boolean,
  enemyPerformedAttack: boolean,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
) {
  markBattleStage("enemy-start");
  const playerTexts = combatTexts.filter((ct) => ct.target === "player");
  await delay(ENEMY_PHASE_DELAY);
  if (!battleSession.isCurrentBattleSession(sessionNum)) return;
  if (enemyPerformedAttack) playEnemyAttack(currentState.currentEnemy.id);
  if (!currentState.deathsDoorActive && resultState.deathsDoorActive) playBattleEvent("deathsDoor");
  const vfx = orch.getPresentation();
  if (combatTexts.length > 0) vfx.showCombatTexts(combatTexts);
  applyCombatTextPortraitFeedback(playerTexts, vfx);
  playCombatTextSounds(playerTexts);
  await delay(ENEMY_ATTACK_RECOVERY_DELAY);
  if (!battleSession.isCurrentBattleSession(sessionNum)) return;
  markBattleStage("enemy-end");
  await continueAfterEnemyDraw(resultState, currentState, sessionNum, playerTurnSkipped, battleSession, orch);
}

async function continueAfterEnemyDraw(
  resultState: BattleState,
  currentState: BattleState,
  sessionNum: number,
  playerTurnSkipped: boolean,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
) {
  const continuation = getBattleContinuation(resultState, playerTurnSkipped);
  let committedDuringDraw = false;
  try {
    await runHandDrawSequence(
      currentState.hand,
      resultState,
      () => {
        dispatchRunSessionCommand((draft) => commitBattleTransition(draft, resultState, continuation));
        committedDuringDraw = true;
      },
      sessionNum,
      orch.getDrawSequenceDeps(),
    );
  } catch (err) {
    orch.logBattleError("handle enemy resolution draw sequence", err);
  }
  if (!battleSession.isCurrentBattleSession(sessionNum)) return;
  battleSession.runIfSessionActive(sessionNum, () => {
    if (!committedDuringDraw) {
      dispatchRunSessionCommand((draft) => commitBattleTransition(draft, resultState, continuation));
    }
    if (battleSession.checkBattleEnd(resultState, sessionNum)) return;
    if (playerTurnSkipped) {
      dispatchRunSessionCommand((draft) => clearBattleTransition(draft));
      resolveEndTurn(resultState, sessionNum, battleSession, orch);
      return;
    }
    orch.scheduleCompanionFollowUp(resultState, sessionNum);
  });
}

function getBattleContinuation(state: BattleState, playerTurnSkipped: boolean): PersistedBattleTransition | null {
  if (!playerTurnSkipped || state.enemyHealth <= 0 || isPlayerDefeated(state)) return null;
  return { kind: "continue-end-turn" };
}

/** Consume a persisted transition without replaying presentation delays. */
export function resumePendingBattleTransition(
  sessionNum: number,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
): void {
  if (!battleSession.isCurrentBattleSession(sessionNum)) return;
  const pending = readBattle().pendingBattleTransition;
  if (!pending) return;

  if (pending.kind === "legacy-enemy-turn") {
    const recovered = recoverLegacyEnemyPhase(readBattle().battleState);
    dispatchRunSessionCommand((draft) => commitBattleTransition(draft, recovered, null));
    battleSession.checkBattleEnd(recovered, sessionNum);
    return;
  }

  if (pending.kind === "continue-end-turn") {
    const state = readBattle().battleState;
    dispatchRunSessionCommand((draft) => clearBattleTransition(draft));
    resolveEndTurn(state, sessionNum, battleSession, orch);
    return;
  }

  const state = pending.resultState;
  const continuation = getBattleContinuation(state, pending.playerTurnSkipped);
  dispatchRunSessionCommand((draft) => commitBattleTransition(draft, state, continuation));
  if (battleSession.checkBattleEnd(state, sessionNum)) return;
  if (pending.playerTurnSkipped) {
    dispatchRunSessionCommand((draft) => clearBattleTransition(draft));
    resolveEndTurn(state, sessionNum, battleSession, orch);
    return;
  }
  orch.scheduleCompanionFollowUp(state, sessionNum);
}

function resolveCompanionFollowUpTexts(
  session: ReturnType<typeof createBattleSession>,
  sessionNum: number,
  getPresentation: () => BattlePresentationPort,
): CombatTextEvent[] {
  return session.runIfSessionActive(sessionNum, () => {
    const texts: CombatTextEvent[] = [];
    const newState = triggerCompanionEffects(readBattle().battleState, texts, getPresentation());
    dispatchRunSessionCommand((draft) => setBattleState(draft, newState));
    return texts;
  }, []);
}
