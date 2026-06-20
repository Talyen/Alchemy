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
import type { RefObject } from "react";
import type { BattleCard } from "@/lib/game-data";
import type { Screen } from "../../shared/types";

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
  void Promise.resolve(
    runHandDrawSequence(
      companionState.hand,
      result.state,
      () => deps.store.setSyncedBattleState(result.state),
      session,
      deps.drawSequence,
    ),
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
  companionScheduledRef: RefObject<boolean>;
  battleTimerGroupRef: RefObject<import("@/lib/animation/game-timer").TimerGroup>;
  resolvedAsHasteOrStunRef: RefObject<boolean>;
  cardPlayInProgressRef: RefObject<boolean>;
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
        resolveHasteSkipTurn(result, companionResult.state, session, {
          store: deps.getTurnResolutionStore(),
          drawSequence: deps.getDrawSequenceDeps(),
          logDrawError: (err: unknown) => deps.logBattleError("handle end turn draw sequence", err),
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
        return;
      }

      resolveNormalEnemyTurn(result, companionResult, session, {
        store: deps.getTurnResolutionStore(),
        executeEnemyPhase: (resultState, currentState, combatTexts, s, playerTurnSkipped, enemyPerformedAttack) =>
          void executeEnemyPhase(resultState, currentState, combatTexts, s, playerTurnSkipped, enemyPerformedAttack, {
            isSessionActive: deps.isCurrentBattleSession,
            store: deps.getTurnResolutionStore(),
            drawSequence: deps.getDrawSequenceDeps(),
            logDrawError: (err: unknown) => deps.logBattleError("handle enemy resolution draw sequence", err),
            onPhaseComplete: (rs, sess, skip) => {
              if (deps.checkBattleEnd(rs, sess)) return;
              if (skip) {
                deps.onResolveEndTurn(rs, sess);
                return;
              }
              deps.scheduleCompanionFollowUp(rs, sess);
            },
          }),
        onVictory: () => deps.handleVictoryDefeat("victory"),
        checkBattleEnd: deps.checkBattleEnd,
      });
    } catch (err) {
      deps.logBattleError("resolve end turn forcing defeat", err);
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

export function createBattleEndTurnUi(params: {
  screen: Screen;
  battleSessionRef: RefObject<number>;
  cardPlayInProgressRef: RefObject<boolean>;
  runIfSessionActive: <T>(session: number, action: () => T, fallback?: T) => T;
  logBattleError: (context: string, err: unknown) => void;
  resetHandTransferUi: () => void;
  resolvedAsHasteOrStunRef: RefObject<boolean>;
  clearBattleTimeoutsKeepCompanion: () => void;
  getTurnOrchestrationDeps: () => TurnOrchestrationDeps;
  animateDiscardedHand: (hand: BattleCard[], session: number) => Promise<void>;
  cardTransferInProgress: boolean;
}) {
  function resolveEndTurn(currentState: BattleState, session: number) {
    resolveEndTurnOrchestration(params.getTurnOrchestrationDeps(), currentState, session);
  }

  async function animateEndTurnThenResolve(currentState: BattleState, session: number) {
    try {
      if (!isAnimationDisabled()) {
        try {
          await params.animateDiscardedHand(currentState.hand, session);
        } catch (err) {
          params.logBattleError("discard hand animation", err);
        }
      }
      params.runIfSessionActive(session, () => resolveEndTurn(currentState, session));
    } finally {
      params.runIfSessionActive(session, () => {
        if (!params.resolvedAsHasteOrStunRef.current) params.resetHandTransferUi();
        params.cardPlayInProgressRef.current = false;
      });
    }
  }

  function handleEndTurn() {
    const getStore = () => getBattleSessionStore();
    const currentState = getStore().battleState;
    if (
      params.screen !== "battle" ||
      currentState.turnPhase !== "player" ||
      currentState.wishOptions ||
      params.cardPlayInProgressRef.current ||
      params.cardTransferInProgress
    )
      return;
    params.clearBattleTimeoutsKeepCompanion();
    const session = params.battleSessionRef.current;
    void animateEndTurnThenResolve(currentState, session).catch((err: unknown) =>
      params.logBattleError("resolve end turn animation sequence", err),
    );
  }

  return { handleEndTurn, resolveEndTurn };
}
