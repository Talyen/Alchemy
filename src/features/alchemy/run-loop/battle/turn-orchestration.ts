// End-turn orchestration: enemy turn UI sequencing, haste/skipped/standard dispatch, and the end-turn button factory.
import {
  endPlayerTurn,
  isPlayerDefeated,
  processCompanionTurnStart,
  type BattleState,
  type CombatTextEvent,
  type EndPlayerTurnResolution,
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

export type TurnOrchestrationDeps = {
  getStore: () => ReturnType<typeof getBattleSessionStore>;
  isCurrentBattleSession: (session: number) => boolean;
  runIfSessionActive: <T>(session: number, action: () => T, fallback?: T) => T;
  checkBattleEnd: (state: BattleState, session: number) => boolean;
  handleVictoryDefeat: (outcome: "victory" | "defeat") => void;
  getDrawSequenceDeps: () => HandDrawSequenceDeps;
  logBattleError: (context: string, err: unknown) => void;
  resetHandTransferUi: () => void;
  scheduleCompanionFollowUp: (resultState: BattleState, session: number) => void;
};

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

/** Top-level end-turn dispatch. Returns true when an async draw sequence was started (haste), false otherwise. */
export function resolveEndTurn(currentState: BattleState, session: number, deps: TurnOrchestrationDeps): boolean {
  const companionTexts: CombatTextEvent[] = [];
  const companionState = triggerCompanionEffects(deps, currentState, companionTexts);

  if (companionState.enemyHealth <= 0) {
    deps.getStore().setSyncedBattleState(companionState);
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
}

export function resolveHasteSkipTurn(
  result: EndPlayerTurnResolution,
  companionState: BattleState,
  session: number,
  deps: TurnOrchestrationDeps,
) {
  if (result.combatTexts.length > 0) deps.getStore().showCombatTexts(result.combatTexts);
  void Promise.resolve(
    runHandDrawSequence(
      companionState.hand,
      result.state,
      () => deps.getStore().setSyncedBattleState(result.state),
      session,
      deps.getDrawSequenceDeps(),
    ),
  )
    .catch((err: unknown) => deps.logBattleError("handle end turn draw sequence", err))
    .finally(() => {
      deps.runIfSessionActive(session, () => {
        if (deps.checkBattleEnd(result.state, session)) return;
        if (result.playerTurnSkipped) {
          resolveEndTurn(result.state, session, deps);
          return;
        }
        deps.scheduleCompanionFollowUp(result.state, session);
      });
    });
}

export function resolveNormalEnemyTurn(
  result: EndPlayerTurnResolution,
  companionState: BattleState,
  companionTexts: CombatTextEvent[],
  session: number,
  deps: TurnOrchestrationDeps,
) {
  const enemyTurnStartTexts = [...companionTexts, ...result.enemyTurnStartCombatTexts];
  const enemyResolutionTexts = result.enemyResolutionCombatTexts;

  const store = deps.getStore();
  store.setSyncedBattleState({ ...result.enemyTurnStartState!, turnPhase: "enemy" });
  store.setDisplayOverrides({
    hand: [],
    playerHealth: companionState.playerHealth,
    playerStatuses: companionState.playerStatuses,
  });

  const dotTexts = enemyTurnStartTexts.filter((ct) => ct.target === "enemy" || ct.kind === "heal");
  if (dotTexts.length > 0) store.showCombatTexts(dotTexts);
  if (shouldHurtEnemyFromCombatTexts(dotTexts)) store.hurtEnemy();

  if (result.state.enemyHealth <= 0) {
    store.setSyncedBattleState({ ...result.state, turnPhase: "enemy", hand: [] });
    deps.handleVictoryDefeat("victory");
    return;
  }
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
  const playerTexts = combatTexts.filter((ct) => ct.target === "player");
  await delay(ENEMY_PHASE_DELAY);
  if (!deps.isCurrentBattleSession(session)) return;
  if (enemyPerformedAttack) playEnemyAttack(currentState.currentEnemy.id);
  if (!currentState.deathsDoorActive && resultState.deathsDoorActive) playBattleEvent("deathsDoor");
  if (combatTexts.length > 0) deps.getStore().showCombatTexts(combatTexts);
  applyCombatTextPortraitFeedback(playerTexts, deps.getStore());
  await delay(ENEMY_ATTACK_RECOVERY_DELAY);
  if (!deps.isCurrentBattleSession(session)) return;
  try {
    await runHandDrawSequence(
      currentState.hand,
      resultState,
      () => deps.getStore().setSyncedBattleState(resultState),
      session,
      deps.getDrawSequenceDeps(),
    );
  } catch (err) {
    deps.logBattleError("handle enemy resolution draw sequence", err);
  }
  if (!deps.isCurrentBattleSession(session)) return;
  deps.runIfSessionActive(session, () => {
    if (deps.checkBattleEnd(resultState, session)) return;
    if (playerTurnSkipped) {
      resolveEndTurn(resultState, session, deps);
      return;
    }
    deps.scheduleCompanionFollowUp(resultState, session);
  });
}

type CompanionTextsDeps = {
  getStore: () => ReturnType<typeof getBattleSessionStore>;
  isCurrentBattleSession: (session: number) => boolean;
  runIfSessionActive: <T>(session: number, action: () => T, fallback?: T) => T;
};

export function resolveCompanionFollowUpTexts(deps: CompanionTextsDeps, session: number): CombatTextEvent[] {
  return deps.runIfSessionActive(session, () => {
    const store = deps.getStore();
    const texts: CombatTextEvent[] = [];
    const newState = triggerCompanionEffects(deps, store.battleState, texts);
    store.setSyncedBattleState(newState);
    return texts;
  }, []);
}

export type BattleEndTurnUiParams = {
  screen: Screen;
  battleSessionRef: RefObject<number>;
  cardPlayInProgressRef: RefObject<boolean>;
  runIfSessionActive: <T>(session: number, action: () => T, fallback?: T) => T;
  logBattleError: (context: string, err: unknown) => void;
  resetHandTransferUi: () => void;
  clearBattleTimeoutsKeepCompanion: () => void;
  animateDiscardedHand: (hand: BattleCard[], session: number) => Promise<void>;
  deps: TurnOrchestrationDeps;
};

export function createBattleEndTurnUi(params: BattleEndTurnUiParams) {
  let hasteDrawInProgress = false;

  function resolveEndTurnHandler(currentState: BattleState, session: number) {
    resolveEndTurn(currentState, session, params.deps);
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
      params.runIfSessionActive(session, () => {
        if (resolveEndTurn(currentState, session, params.deps)) {
          hasteDrawInProgress = true;
        }
      });
    } finally {
      params.runIfSessionActive(session, () => {
        if (!hasteDrawInProgress) params.resetHandTransferUi();
        params.cardPlayInProgressRef.current = false;
      });
    }
  }

  function handleEndTurn() {
    hasteDrawInProgress = false;
    const currentState = getBattleSessionStore().battleState;
    if (
      params.screen !== "battle" ||
      currentState.turnPhase !== "player" ||
      currentState.wishOptions ||
      params.cardPlayInProgressRef.current
    )
      return;
    params.clearBattleTimeoutsKeepCompanion();
    const session = params.battleSessionRef.current;
    void animateEndTurnThenResolve(currentState, session).catch((err: unknown) =>
      params.logBattleError("resolve end turn animation sequence", err),
    );
  }

  return { handleEndTurn, resolveEndTurn: resolveEndTurnHandler };
}
