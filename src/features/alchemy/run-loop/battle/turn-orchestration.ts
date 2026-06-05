// End-turn orchestration: companion queue, enemy phase dispatch, and victory/defeat checks.
import type { MutableRefObject } from "react";
import {
  endPlayerTurn,
  isPlayerDefeated,
  processCompanionTurnStart,
  type BattleState,
  type CombatTextEvent,
} from "@/lib/battle";
import { applyCombatTextPortraitFeedback } from "./battle-feedback";
import { playCompanionSound } from "./controller-utils";
import {
  executeEnemyPhase as runExecuteEnemyPhase,
  resolveHasteSkipTurn as runResolveHasteSkipTurn,
  resolveNormalEnemyTurn as runResolveNormalEnemyTurn,
  type EndPlayerTurnResult,
} from "./turn-resolution-ui";
import type { HandDrawSequenceDeps } from "./draw-sequence";

type TurnOrchestrationStore = ReturnType<typeof import("./battle-store-access").getBattleSessionStore>;

export type TurnOrchestrationDeps = {
  getStore: () => TurnOrchestrationStore;
  isCurrentBattleSession: (session: number) => boolean;
  runIfSessionActive: <T>(session: number, action: () => T, fallback?: T) => T;
  checkBattleEnd: (state: BattleState, session: number) => boolean;
  handleVictoryDefeat: (outcome: "victory" | "defeat") => void;
  getTurnResolutionStore: () => import("./turn-resolution-ui").TurnResolutionStore;
  getDrawSequenceDeps: () => HandDrawSequenceDeps;
  logBattleError: (context: string, err: unknown) => void;
  companionScheduledRef: MutableRefObject<boolean>;
  battleTimerGroupRef: MutableRefObject<import("@/lib/animation/game-timer").TimerGroup>;
  resolvedAsHasteOrStunRef: MutableRefObject<boolean>;
  cardPlayInProgressRef: MutableRefObject<boolean>;
  resetHandTransferUi: () => void;
  scheduleCompanionFollowUp: (resultState: BattleState, session: number) => void;
  onResolveEndTurn: (currentState: BattleState, session: number) => void;
};

function triggerCompanionEffects(deps: TurnOrchestrationDeps, state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.activeCompanion) {
    playCompanionSound(state.activeCompanion.id);
    deps.getStore().shakeCompanion();
    return processCompanionTurnStart(state, combatTexts);
  }
  return state;
}

function resolveQueuedCompanionTurn(deps: TurnOrchestrationDeps, state: BattleState, session: number) {
  const combatTexts: CombatTextEvent[] = [];
  if (!deps.isCurrentBattleSession(session)) return { state, combatTexts };
  if (deps.companionScheduledRef.current && state.activeCompanion) {
    const nextState = triggerCompanionEffects(deps, state, combatTexts);
    deps.companionScheduledRef.current = false;
    return { state: nextState, combatTexts };
  }
  deps.companionScheduledRef.current = false;
  return { state, combatTexts };
}

function buildDrawTurnDeps(deps: TurnOrchestrationDeps, logContext: string) {
  return {
    store: deps.getTurnResolutionStore(),
    drawSequence: deps.getDrawSequenceDeps(),
    logDrawError: (err: unknown) => deps.logBattleError(logContext, err),
  };
}

function resolveHasteSkipTurnOrchestration(
  deps: TurnOrchestrationDeps,
  result: EndPlayerTurnResult,
  companionState: BattleState,
  session: number,
) {
  runResolveHasteSkipTurn(result, companionState, session, {
    ...buildDrawTurnDeps(deps, "handle end turn draw sequence"),
    setResolvedAsHasteOrStun: (value) => {
      deps.resolvedAsHasteOrStunRef.current = value;
    },
    clearHandTransferState: deps.resetHandTransferUi,
    setCardPlayInProgress: (active) => {
      deps.cardPlayInProgressRef.current = active;
    },
    runIfSessionActive: (activeSession, action) => {
      deps.runIfSessionActive(activeSession, action);
    },
    onDrawComplete: (resultState, activeSession) => {
      if (deps.checkBattleEnd(resultState, activeSession)) return;
      if (result.playerTurnSkipped) {
        deps.onResolveEndTurn(resultState, activeSession);
        return;
      }
      deps.scheduleCompanionFollowUp(resultState, activeSession);
    },
  });
}

function resolveNormalEnemyTurnOrchestration(
  deps: TurnOrchestrationDeps,
  result: EndPlayerTurnResult,
  companionResult: { state: BattleState; combatTexts: CombatTextEvent[] },
  session: number,
  executeEnemyPhase: (
    resultState: BattleState,
    currentState: BattleState,
    combatTexts: CombatTextEvent[],
    session: number,
    playerTurnSkipped: boolean,
    enemyPerformedAttack: boolean,
  ) => Promise<void>,
) {
  runResolveNormalEnemyTurn(result, companionResult, session, {
    store: deps.getTurnResolutionStore(),
    executeEnemyPhase,
    onVictory: () => deps.handleVictoryDefeat("victory"),
    checkBattleEnd: deps.checkBattleEnd,
  });
}

async function executeEnemyPhaseOrchestration(
  deps: TurnOrchestrationDeps,
  resultState: BattleState,
  currentState: BattleState,
  combatTexts: CombatTextEvent[],
  session: number,
  playerTurnSkipped: boolean,
  enemyPerformedAttack: boolean,
  onPhaseComplete: (resultState: BattleState, session: number, playerTurnSkipped: boolean) => void,
) {
  await runExecuteEnemyPhase(resultState, currentState, combatTexts, session, playerTurnSkipped, enemyPerformedAttack, {
    isSessionActive: deps.isCurrentBattleSession,
    ...buildDrawTurnDeps(deps, "handle enemy resolution draw sequence"),
    onPhaseComplete,
  });
}

export function resolveEndTurnOrchestration(deps: TurnOrchestrationDeps, currentState: BattleState, session: number) {
  deps.runIfSessionActive(session, () => {
    try {
      const companionResult = resolveQueuedCompanionTurn(deps, currentState, session);

      if (companionResult.state.enemyHealth <= 0) {
        deps.getStore().setSyncedBattleState(companionResult.state);
        if (companionResult.combatTexts.length > 0) {
          const store = deps.getStore();
          store.showCombatTexts(companionResult.combatTexts);
          applyCombatTextPortraitFeedback(companionResult.combatTexts, store);
        }
        deps.handleVictoryDefeat("victory");
        return;
      }
      if (isPlayerDefeated(companionResult.state)) {
        deps.handleVictoryDefeat("defeat");
        return;
      }

      const result = endPlayerTurn(companionResult.state);

      if (!result.enemyTurnStartState) {
        resolveHasteSkipTurnOrchestration(deps, result, companionResult.state, session);
        return;
      }

      resolveNormalEnemyTurnOrchestration(
        deps,
        result,
        companionResult,
        session,
        (resultState, current, texts, s, skipped, attacked) =>
          executeEnemyPhaseOrchestration(deps, resultState, current, texts, s, skipped, attacked, (rs, sess, skip) => {
            if (deps.checkBattleEnd(rs, sess)) return;
            if (skip) {
              deps.onResolveEndTurn(rs, sess);
              return;
            }
            deps.scheduleCompanionFollowUp(rs, sess);
          }),
      );
    } catch (err) {
      deps.logBattleError("resolve end turn — forcing defeat", err);
      if (deps.isCurrentBattleSession(session)) {
        deps.handleVictoryDefeat("defeat");
      }
    }
  });
}

export function resolveCompanionFollowUpTexts(deps: TurnOrchestrationDeps, session: number) {
  return deps.runIfSessionActive(session, () => {
    const store = deps.getStore();
    const texts: CombatTextEvent[] = [];
    const newState = triggerCompanionEffects(deps, store.battleState, texts);
    store.setSyncedBattleState(newState);
    return texts;
  }, []);
}
