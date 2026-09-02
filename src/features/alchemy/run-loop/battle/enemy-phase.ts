import {
  enemyAttackDealsDamage,
  isPlayerDefeated,
  type BattleState,
  type CombatTextEvent,
  type EndPlayerTurnResolution,
} from "@/lib/battle";
import { playBattleEvent, playEnemyAttack } from "@/lib/audio";
import { ENEMY_ATTACK_RECOVERY_DELAY, ENEMY_PHASE_DELAY } from "@/lib/game-constants";
import { delay } from "@/lib/animation/game-timer";
import { markBattleStage } from "@/lib/performance/battle-stage-marks";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { beginBattleTransition, commitBattleTransition } from "@/features/alchemy/shared/stores/run-session-write-port";
import { applyCombatTextShakeFeedback } from "./battle-status";
import { logBattleError, playCombatTextSounds } from "./controller-utils";
import { runHandDrawSequence } from "./draw-sequence";
import {
  finalizePlayerTurnResume,
  getBattleContinuation,
  type BattleTurnSession,
  type ResolveEndTurn,
  type TurnOrchestration,
} from "./turn-orchestration-shared";

export function persistEnemyTurnTransition(
  draft: GameplayDraft,
  result: Extract<EndPlayerTurnResolution, { kind: "skipped" | "standard" }>,
  currentState: BattleState,
): void {
  if (result.state.enemyHealth <= 0 || isPlayerDefeated(result.state)) {
    commitBattleTransition(draft, { ...result.state, turnPhase: "enemy", hand: [] }, null);
    return;
  }
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
  );
}

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
    battleSession.handleVictoryDefeat(result.state.enemyHealth <= 0 ? "victory" : "defeat");
    return;
  }

  if (dotTexts.length > 0) vfx.showCombatTexts(dotTexts);

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
  const vfx = orch.getPresentation();
  if (enemyPerformedAttack) {
    playEnemyAttack(currentState.currentEnemy.id);
    if (enemyAttackDealsDamage(currentState.currentEnemy.attackEffects)) {
      vfx.telegraphAttack("enemy");
    } else {
      vfx.telegraphCast("enemy");
    }
  }
  if (!currentState.deathsDoorActive && resultState.deathsDoorActive) playBattleEvent("deathsDoor");
  if (combatTexts.length > 0) vfx.showCombatTexts(combatTexts);
  applyCombatTextShakeFeedback(playerTexts, vfx);
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
    logBattleError("handle enemy resolution draw sequence", err);
  }
  if (!battleSession.isCurrentBattleSession(sessionNum)) return;
  battleSession.runIfSessionActive(sessionNum, () => {
    if (!committedDuringDraw) {
      dispatchRunSessionCommand((draft) => commitBattleTransition(draft, resultState, continuation));
    }
    finalizePlayerTurnResume(resultState, playerTurnSkipped, sessionNum, battleSession, orch, resolveEndTurn);
  });
}
