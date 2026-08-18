import { isPlayerDefeated, type BattleState, type CombatTextEvent, type EndPlayerTurnResolution } from "@/lib/battle";
import { playBattleEvent, playEnemyAttack } from "@/lib/audio";
import { ENEMY_ATTACK_RECOVERY_DELAY, ENEMY_PHASE_DELAY } from "@/lib/game-constants";
import { delay } from "@/lib/animation/game-timer";
import { markBattleStage } from "@/lib/performance/battle-stage-marks";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  beginBattleTransition,
  clearBattleTransition,
  commitBattleTransition,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { applyCombatTextPortraitFeedback, shouldHurtEnemyFromCombatTexts } from "./battle-feedback";
import { playCombatTextSounds } from "./controller-utils";
import { runHandDrawSequence } from "./draw-sequence";
import {
  getBattleContinuation,
  type BattleTurnSession,
  type ResolveEndTurn,
  type TurnOrchestration,
} from "./turn-orchestration-shared";

export function resolveNormalEnemyTurn(
  result: Extract<EndPlayerTurnResolution, { kind: "skipped" | "standard" }>,
  currentState: BattleState,
  sessionNum: number,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
  resolveEndTurn: ResolveEndTurn,
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
    resolveEndTurn,
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
  resolveEndTurn: ResolveEndTurn,
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
  await continueAfterEnemyDraw(
    resultState,
    currentState,
    sessionNum,
    playerTurnSkipped,
    battleSession,
    orch,
    resolveEndTurn,
  );
}

async function continueAfterEnemyDraw(
  resultState: BattleState,
  currentState: BattleState,
  sessionNum: number,
  playerTurnSkipped: boolean,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
  resolveEndTurn: ResolveEndTurn,
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
