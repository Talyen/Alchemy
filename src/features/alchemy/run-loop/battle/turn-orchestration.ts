import { COMPANION_ATTACK_DELAY } from "@/lib/game-constants";
import {
  endPlayerTurn,
  isPlayerDefeated,
  processCompanionTurnStart,
  recoverLegacyEnemyPhase,
  type BattleState,
  type CombatTextEvent,
  type EndPlayerTurnResolution,
} from "@/lib/battle";
import {
  clearBattleTransition,
  commitBattleTransition,
  setBattleState,
  withDraftWorldBattleRng,
  withRestingEndPlayerTurnResolution,
  withRestingWorldBattleRng,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { markBattleStage } from "@/lib/performance/battle-stage-marks";
import { applyCombatTextShakeFeedback } from "./battle-status";
import { playCombatTextSounds, playCompanionSound } from "./controller-utils";
import { type createBattleSession } from "./battle-session";
import type { createBattleTransferDeps } from "./battle-transfer-deps";
import type { BattleControllerContext } from "./battle-context";
import type { BattlePresentationPort } from "./battle-presentation-store";
import { persistEnemyTurnTransition, resolveNormalEnemyTurn } from "./enemy-phase";
import { noopDrawCommit, runBattleDraw } from "./draw-sequence";
import {
  commitDrawAndResume,
  getBattleContinuation,
  type BattleTurnSession,
  type ResolveEndTurn,
  type TurnOrchestration,
} from "./turn-continuation";

export { resolveNormalEnemyTurn, executeEnemyPhase, persistEnemyTurnTransition } from "./enemy-phase";
export { commitDrawAndResume } from "./turn-continuation";
export type { BattleTurnSession, TurnOrchestration, ResolveEndTurn } from "./turn-continuation";

export function createTurnOrchestration(
  ctx: BattleControllerContext,
  session: ReturnType<typeof createBattleSession>,
  transferDeps: ReturnType<typeof createBattleTransferDeps>,
): TurnOrchestration {
  const getPresentation = () => ctx.getPresentation();

  const scheduleCompanionFollowUp = (resultState: BattleState, sessionNum: number) => {
    if (!resultState.activeCompanion || resultState.enemyHealth <= 0) return;
    if (ctx.companionScheduledRef.current) return;
    ctx.companionScheduledRef.current = true;
    ctx.companionTimerGroupRef.current.setTimeout(() => {
      session.runIfSessionActive(sessionNum, () => {
        ctx.companionScheduledRef.current = false;
        const texts = resolveCompanionFollowUpTexts(session, sessionNum, getPresentation);
        if (texts.length > 0) {
          const vfx = getPresentation();
          vfx.showCombatTexts(texts);
          applyCombatTextShakeFeedback(texts, vfx);
          playCombatTextSounds(texts);
        }
      });
    }, COMPANION_ATTACK_DELAY);
  };

  return {
    getDrawSequenceDeps: () => transferDeps.getDrawSequenceDeps(),
    resetHandTransferUi: () => getPresentation().resetHandTransferUi(),
    scheduleCompanionFollowUp,
    scheduleAutoEndTurn: (resultState) => {
      ctx.scheduleAutoEndTurnRef.current?.(resultState);
    },
    getPresentation,
  };
}

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

    const result = dispatchRunSessionCommand((draft) => {
      const bound = withDraftWorldBattleRng(draft, currentState);
      const next = endPlayerTurn(bound);
      if (next.kind === "haste") {
        commitBattleTransition(draft, next.state, getBattleContinuation(next.state, next.playerTurnSkipped));
      } else {
        persistEnemyTurnTransition(draft, next, currentState);
      }
      return withRestingEndPlayerTurnResolution(next);
    });

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

export function resolveHasteSkipTurn(
  result: EndPlayerTurnResolution,
  companionState: BattleState,
  sessionNum: number,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
  resolveEndTurn: ResolveEndTurn,
) {
  orch.resetHandTransferUi();
  if (result.combatTexts.length > 0) orch.getPresentation().showCombatTexts(result.combatTexts);
  void runBattleDraw({
    oldHand: companionState.hand,
    newState: result.state,
    applyState: noopDrawCommit,
    session: sessionNum,
    deps: orch.getDrawSequenceDeps(),
    errorContext: "handle end turn draw sequence",
    onSettled: () =>
      battleSession.runIfSessionActive(sessionNum, () => {
        commitDrawAndResume(
          result.state,
          result.playerTurnSkipped,
          sessionNum,
          battleSession,
          orch,
          resolveEndTurn,
          "clear-when-idle",
        );
      }),
  });
}

export function resumePendingBattleTransition(
  sessionNum: number,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
  resolveEndTurn: ResolveEndTurn,
): void {
  if (!battleSession.isCurrentBattleSession(sessionNum)) return;
  const pending = readBattle().pendingBattleTransition;
  if (!pending) return;

  if (pending.kind === "opening-draw") {
    const state = pending.resultState;
    dispatchRunSessionCommand((draft) => commitBattleTransition(draft, state, null));
    orch.resetHandTransferUi();
    if (!battleSession.checkBattleEnd(state, sessionNum)) {
      orch.scheduleAutoEndTurn(state);
    }
    return;
  }

  if (pending.kind === "legacy-enemy-turn") {
    const recovered = dispatchRunSessionCommand((draft) => {
      const next = withRestingWorldBattleRng(
        recoverLegacyEnemyPhase(withDraftWorldBattleRng(draft, draft.battle.battleState)),
      );
      commitBattleTransition(draft, next, null);
      return next;
    });
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
  commitDrawAndResume(state, pending.playerTurnSkipped, sessionNum, battleSession, orch, resolveEndTurn, state);
}

function resolveCompanionFollowUpTexts(
  session: ReturnType<typeof createBattleSession>,
  sessionNum: number,
  getPresentation: () => BattlePresentationPort,
): CombatTextEvent[] {
  return session.runIfSessionActive(sessionNum, () => {
    const texts: CombatTextEvent[] = [];
    dispatchRunSessionCommand(
      (draft) => {
        const bound = withDraftWorldBattleRng(draft, draft.battle.battleState);
        if (!bound.activeCompanion) return null;
        setBattleState(draft, processCompanionTurnStart(bound, texts));
        return bound.activeCompanion.id;
      },
      {
        afterCommit: (companionId) => {
          if (!companionId) return;
          playCompanionSound(companionId);
          const vfx = getPresentation();
          vfx.shakeCompanion();
          vfx.telegraphAttack("companion");
        },
      },
    );
    return texts;
  }, []);
}
