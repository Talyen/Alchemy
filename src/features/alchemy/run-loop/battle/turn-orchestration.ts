// End-turn orchestration, enemy turn UI sequencing, and player end-turn animation gate.
import {
  endPlayerTurn,
  isPlayerDefeated,
  processCompanionTurnStart,
  type BattleState,
  type CombatTextEvent,
} from "@/lib/battle";
import { playBattleEvent, playEnemyAttack } from "@/lib/audio";
import { ENEMY_ATTACK_RECOVERY_DELAY, ENEMY_PHASE_DELAY, isAnimationDisabled } from "@/lib/game-constants";
import { delay } from "@/lib/animation/game-timer";
import { applyCombatTextPortraitFeedback, shouldHurtEnemyFromCombatTexts } from "./battle-feedback";
import { playCompanionSound } from "./controller-utils";
import { runHandDrawSequence, type HandDrawSequenceDeps } from "./draw-sequence";
import { getBattleSessionStore } from "./battle-session";
import type { BattleControllerContext } from "./controller-context";

export type EndPlayerTurnResult = ReturnType<typeof endPlayerTurn>;

export type TurnResolutionStore = {
  showCombatTexts: (texts: CombatTextEvent[]) => void;
  setSyncedBattleState: (state: BattleState) => void;
  setDisplayOverrides: (overrides: {
    hand: [];
    playerHealth?: number;
    playerStatuses?: BattleState["playerStatuses"];
  }) => void;
  shakePlayer: () => void;
  hurtPlayer: () => void;
  hurtEnemy: () => void;
  shakeEnemy: () => void;
};

export function resolveHasteSkipTurn(
  result: EndPlayerTurnResult,
  companionState: BattleState,
  session: number,
  deps: {
    store: TurnResolutionStore;
    drawSequence: HandDrawSequenceDeps;
    onDrawComplete: (resultState: BattleState, session: number) => void;
    logDrawError: (err: unknown) => void;
    setResolvedAsHasteOrStun: (value: boolean) => void;
    clearHandTransferState: () => void;
    setCardPlayInProgress: (active: boolean) => void;
    runIfSessionActive: (session: number, action: () => void) => void;
  },
) {
  deps.setResolvedAsHasteOrStun(true);
  try {
    if (result.combatTexts.length > 0) deps.store.showCombatTexts(result.combatTexts);
  } catch (err) {
    deps.setResolvedAsHasteOrStun(false);
    throw err;
  }
  void runHandDrawSequence(
    companionState.hand,
    result.state,
    () => deps.store.setSyncedBattleState(result.state),
    session,
    deps.drawSequence,
  )
    .catch(deps.logDrawError)
    .finally(() => {
      deps.runIfSessionActive(session, () => {
        deps.setResolvedAsHasteOrStun(false);
        deps.clearHandTransferState();
        deps.setCardPlayInProgress(false);
        deps.onDrawComplete(result.state, session);
      });
    });
}

function showEnemyTurnStart(
  resultState: BattleState,
  currentState: BattleState,
  combatTexts: CombatTextEvent[],
  showPlayerUpdates: boolean,
  store: TurnResolutionStore,
) {
  store.setSyncedBattleState({ ...resultState, turnPhase: "enemy" });
  store.setDisplayOverrides({
    hand: [],
    ...(showPlayerUpdates
      ? {}
      : { playerHealth: currentState.playerHealth, playerStatuses: currentState.playerStatuses }),
  });
  const dotTexts = combatTexts.filter((ct) => ct.target === "enemy" || ct.kind === "heal");
  if (dotTexts.length > 0) store.showCombatTexts(dotTexts);
  if (shouldHurtEnemyFromCombatTexts(dotTexts)) store.hurtEnemy();
}

export function resolveNormalEnemyTurn(
  result: EndPlayerTurnResult,
  companionResult: { state: BattleState; combatTexts: CombatTextEvent[] },
  session: number,
  deps: {
    store: TurnResolutionStore;
    executeEnemyPhase: (
      resultState: BattleState,
      currentState: BattleState,
      combatTexts: CombatTextEvent[],
      session: number,
      playerTurnSkipped: boolean,
      enemyPerformedAttack: boolean,
    ) => void;
    onVictory: () => void;
    checkBattleEnd: (state: BattleState, session: number) => boolean;
  },
) {
  const enemyTurnStartTexts = result.enemyTurnStartState
    ? [...companionResult.combatTexts, ...result.enemyTurnStartCombatTexts]
    : [...companionResult.combatTexts, ...result.combatTexts];
  const enemyResolutionTexts = result.enemyTurnStartState ? result.enemyResolutionCombatTexts : result.combatTexts;
  showEnemyTurnStart(
    result.enemyTurnStartState ?? result.state,
    companionResult.state,
    enemyTurnStartTexts,
    Boolean(result.enemyTurnStartState),
    deps.store,
  );
  if (result.state.enemyHealth <= 0) {
    deps.store.setSyncedBattleState({ ...result.state, turnPhase: "enemy", hand: [] });
    deps.onVictory();
    return;
  }
  if (deps.checkBattleEnd(result.state, session)) return;
  deps.executeEnemyPhase(
    result.state,
    companionResult.state,
    enemyResolutionTexts,
    session,
    result.playerTurnSkipped,
    result.enemyPerformedAttack,
  );
}

export async function executeEnemyPhase(
  resultState: BattleState,
  currentState: BattleState,
  combatTexts: CombatTextEvent[],
  session: number,
  playerTurnSkipped: boolean,
  enemyPerformedAttack: boolean,
  deps: {
    isSessionActive: (session: number) => boolean;
    store: TurnResolutionStore;
    drawSequence: HandDrawSequenceDeps;
    logDrawError: (err: unknown) => void;
    onPhaseComplete: (resultState: BattleState, session: number, playerTurnSkipped: boolean) => void;
  },
) {
  const playerTexts = combatTexts.filter((ct) => ct.target === "player");
  await delay(ENEMY_PHASE_DELAY);
  if (!deps.isSessionActive(session)) return;
  if (enemyPerformedAttack) playEnemyAttack(currentState.currentEnemy.id);
  if (!currentState.deathsDoorActive && resultState.deathsDoorActive) playBattleEvent("deathsDoor");
  if (combatTexts.length > 0) deps.store.showCombatTexts(combatTexts);
  applyCombatTextPortraitFeedback(playerTexts, {
    shakeEnemy: deps.store.shakeEnemy,
    shakePlayer: deps.store.shakePlayer,
    hurtEnemy: deps.store.hurtEnemy,
    hurtPlayer: deps.store.hurtPlayer,
  });
  await delay(ENEMY_ATTACK_RECOVERY_DELAY);
  if (!deps.isSessionActive(session)) return;
  try {
    await runHandDrawSequence(
      currentState.hand,
      resultState,
      () => deps.store.setSyncedBattleState(resultState),
      session,
      deps.drawSequence,
    );
  } catch (err) {
    deps.logDrawError(err);
  }
  if (!deps.isSessionActive(session)) return;
  deps.onPhaseComplete(resultState, session, playerTurnSkipped);
}

type TurnOrchestrationStore = ReturnType<typeof getBattleSessionStore>;

export type TurnOrchestrationDeps = {
  getStore: () => TurnOrchestrationStore;
  isCurrentBattleSession: (session: number) => boolean;
  runIfSessionActive: <T>(session: number, action: () => T, fallback?: T) => T;
  checkBattleEnd: (state: BattleState, session: number) => boolean;
  handleVictoryDefeat: (outcome: "victory" | "defeat") => void;
  getTurnResolutionStore: () => TurnResolutionStore;
  getDrawSequenceDeps: () => HandDrawSequenceDeps;
  logBattleError: (context: string, err: unknown) => void;
  companionScheduledRef: React.MutableRefObject<boolean>;
  battleTimerGroupRef: React.MutableRefObject<import("@/lib/animation/game-timer").TimerGroup>;
  resolvedAsHasteOrStunRef: React.MutableRefObject<boolean>;
  cardPlayInProgressRef: React.MutableRefObject<boolean>;
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
  resolveHasteSkipTurn(result, companionState, session, {
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
  executeEnemyPhaseFn: (
    resultState: BattleState,
    currentState: BattleState,
    combatTexts: CombatTextEvent[],
    session: number,
    playerTurnSkipped: boolean,
    enemyPerformedAttack: boolean,
  ) => Promise<void>,
) {
  resolveNormalEnemyTurn(result, companionResult, session, {
    store: deps.getTurnResolutionStore(),
    executeEnemyPhase: executeEnemyPhaseFn,
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
  await executeEnemyPhase(resultState, currentState, combatTexts, session, playerTurnSkipped, enemyPerformedAttack, {
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

export function createBattleEndTurnUi(contextOrGetter: BattleControllerContext | (() => BattleControllerContext)) {
  const getContext = typeof contextOrGetter === "function" ? contextOrGetter : () => contextOrGetter;
  const getStore = () => getBattleSessionStore();

  function resolveEndTurn(currentState: BattleState, session: number) {
    resolveEndTurnOrchestration(getContext().getTurnOrchestrationDeps(), currentState, session);
  }

  async function animateEndTurnThenResolve(currentState: BattleState, session: number) {
    const context = getContext();
    try {
      if (!isAnimationDisabled()) {
        try {
          await context.animateDiscardedHand(currentState.hand, session);
        } catch (err) {
          context.logBattleError("discard hand animation", err);
        }
      }
      context.runIfSessionActive(session, () => resolveEndTurn(currentState, session));
    } finally {
      context.runIfSessionActive(session, () => {
        if (!context.resolvedAsHasteOrStunRef.current) context.resetHandTransferUi();
        context.cardPlayInProgressRef.current = false;
      });
    }
  }

  function handleEndTurn() {
    const context = getContext();
    const currentState = getStore().battleState;
    if (
      context.screen !== "battle" ||
      currentState.turnPhase !== "player" ||
      currentState.wishOptions ||
      context.cardPlayInProgressRef.current ||
      context.cardTransferInProgress
    )
      return;
    context.clearBattleTimeoutsKeepCompanion();
    const session = context.battleSessionRef.current;
    void animateEndTurnThenResolve(currentState, session).catch((err) =>
      context.logBattleError("resolve end turn animation sequence", err),
    );
  }

  return { handleEndTurn, resolveEndTurn };
}
