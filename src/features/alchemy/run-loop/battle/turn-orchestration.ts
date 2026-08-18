// End-turn orchestration: enemy turn UI sequencing, haste/skipped/standard dispatch.
// Pass session + transfer helpers; write-port and session-store are imported directly (no re-bundle).
import { COMPANION_ATTACK_DELAY } from "@/lib/game-constants";
import { endPlayerTurn, isPlayerDefeated, type BattleState, type CombatTextEvent } from "@/lib/battle";
import { logError } from "@/lib/error-logger";
import { setBattleState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readBattle } from "@/features/alchemy/shared/stores/run-session-read-port";
import { markBattleStage } from "@/lib/performance/battle-stage-marks";
import { applyCombatTextPortraitFeedback } from "./battle-feedback";
import { playCombatTextSounds } from "./controller-utils";
import { type createBattleSession } from "./battle-session";
import type { createBattleTransferDeps } from "./battle-transfer-deps";
import type { BattleControllerContext } from "./battle-context";
import type { BattlePresentationPort } from "./battle-presentation-port";
import { resolveHasteSkipTurn } from "./haste-turn";
import { resolveNormalEnemyTurn } from "./enemy-phase";
import { resumePendingBattleTransition as resumePendingBattleTransitionImpl } from "./resume-transition";
import { triggerCompanionEffects, type BattleTurnSession, type TurnOrchestration } from "./turn-orchestration-shared";

export type { BattleTurnSession, TurnOrchestration } from "./turn-orchestration-shared";
export { resolveHasteSkipTurn } from "./haste-turn";
export { resolveNormalEnemyTurn, executeEnemyPhase } from "./enemy-phase";

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
        resolveHasteSkipTurn(result, currentState, sessionNum, battleSession, orch, resolveEndTurn);
        return true;
      case "skipped":
      case "standard":
        resolveNormalEnemyTurn(result, currentState, sessionNum, battleSession, orch, resolveEndTurn);
        return false;
    }
  } finally {
    markBattleStage("resolve-end");
  }
}

export function resumePendingBattleTransition(
  sessionNum: number,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
): void {
  resumePendingBattleTransitionImpl(sessionNum, battleSession, orch, resolveEndTurn);
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
