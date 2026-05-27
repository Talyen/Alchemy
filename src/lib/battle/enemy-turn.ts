// Enemy turn orchestration: haste skip, CC skip, standard enemy phase, and endPlayerTurn.
// Attack resolution lives in enemy-turn-attack.ts; trait handlers in enemy-turn-traits.ts.
import { applyIronwoodBuckler } from "./trinket-effects";
import { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
import type { BattleState, CombatTextEvent } from "./types";
import { processEnemyAttack } from "./enemy-turn-attack";
import { processEnemyRegeneration, processEnemyTraits } from "./enemy-turn-traits";
import { advanceToPlayerTurn, reduceSkipTurns, resolveDeathsDoorEndOfEnemyTurn } from "./enemy-turn-utils";

export type EndPlayerTurnResolution = {
  state: BattleState;
  combatTexts: CombatTextEvent[];
  playerTurnSkipped: boolean;
  enemyTurnStartState?: BattleState;
  enemyTurnStartCombatTexts: CombatTextEvent[];
  enemyResolutionCombatTexts: CombatTextEvent[];
  enemyPerformedAttack: boolean;
  afterAttackState?: BattleState;
};

function finalizePlayerTurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = applyIronwoodBuckler(state, combatTexts);
  nextState = resolveDeathsDoorEndOfEnemyTurn(nextState);
  const finalState = advanceToPlayerTurn(nextState);
  return { state: finalState, combatTexts, playerTurnSkipped: finalState.turnPhase === "enemy" };
}

type CombatTextResult = { state: BattleState; texts: CombatTextEvent[] };

function processHasteEarlyTurn(state: BattleState): BattleState {
  return {
    ...state,
    playerStatuses: { ...state.playerStatuses, haste: Math.max(0, state.playerStatuses.haste - 1) },
  };
}

function beginEnemyPhase(state: BattleState): BattleState {
  return {
    ...state,
    turnPhase: "enemy",
    hand: [],
    discard: [...state.discard, ...state.hand],
  };
}

function resolveHasteTurn(state: BattleState) {
  const combatTexts: CombatTextEvent[] = [];
  const nextState = processHasteEarlyTurn(state);
  return {
    ...finalizePlayerTurn(nextState, combatTexts),
    enemyTurnStartCombatTexts: [] as CombatTextEvent[],
    enemyResolutionCombatTexts: [] as CombatTextEvent[],
    enemyPerformedAttack: false,
  };
}

function resolveSkippedEnemyTurn(state: BattleState, options?: { traitRoll?: number }) {
  const enemyTurnStartCombatTexts: CombatTextEvent[] = [];
  const enemyResolutionCombatTexts: CombatTextEvent[] = [];
  let nextState = state;

  nextState = tickEnemyStatuses(nextState, enemyTurnStartCombatTexts);
  const enemyTurnStartState = nextState;

  nextState = processEnemyTraits(nextState, enemyResolutionCombatTexts, options);
  nextState = reduceSkipTurns(nextState);
  nextState = tickPlayerStatuses(nextState, enemyResolutionCombatTexts);
  nextState = processEnemyRegeneration(nextState, enemyResolutionCombatTexts);

  const combatTexts = [...enemyTurnStartCombatTexts, ...enemyResolutionCombatTexts];

  return {
    ...finalizePlayerTurn(nextState, combatTexts),
    enemyTurnStartState,
    enemyTurnStartCombatTexts,
    enemyResolutionCombatTexts,
    enemyPerformedAttack: false,
  };
}

function resolveEnemyTurnStart(state: BattleState): CombatTextResult {
  const texts: CombatTextEvent[] = [];
  const nextState = tickEnemyStatuses(state, texts);
  return { state: nextState, texts };
}

function resolveEnemyAction(
  state: BattleState,
  options?: { traitRoll?: number },
): CombatTextResult & { afterAttackState: BattleState } {
  const texts: CombatTextEvent[] = [];
  let nextState = processEnemyTraits(state, texts, options);
  nextState = processEnemyAttack(nextState, texts);
  const afterAttackState = nextState;
  nextState = tickPlayerStatuses(nextState, texts);
  nextState = processEnemyRegeneration(nextState, texts);
  return { state: nextState, texts, afterAttackState };
}

function resolveStandardEnemyTurn(nextState: BattleState, options?: { traitRoll?: number }) {
  const startResult = resolveEnemyTurnStart(nextState);
  const enemyTurnStartState = startResult.state;
  const enemyTurnStartCombatTexts = startResult.texts;

  if (enemyTurnStartState.enemyHealth <= 0) {
    return {
      ...finalizePlayerTurn(enemyTurnStartState, []),
      enemyTurnStartState,
      enemyTurnStartCombatTexts,
      enemyResolutionCombatTexts: [],
      enemyPerformedAttack: false,
    };
  }

  const actionResult = resolveEnemyAction(enemyTurnStartState, options);
  const combatTexts = [...enemyTurnStartCombatTexts, ...actionResult.texts];

  return {
    ...finalizePlayerTurn(actionResult.state, combatTexts),
    enemyTurnStartState,
    enemyTurnStartCombatTexts,
    enemyResolutionCombatTexts: actionResult.texts,
    enemyPerformedAttack: true,
    afterAttackState: actionResult.afterAttackState,
  };
}

export function endPlayerTurn(state: BattleState, options?: { traitRoll?: number }): EndPlayerTurnResolution {
  const nextState = beginEnemyPhase(state);

  if (state.playerStatuses.haste > 0) {
    return resolveHasteTurn(nextState);
  }

  if (state.enemyStunSkipTurns + state.enemyFreezeSkipTurns > 0) {
    return resolveSkippedEnemyTurn(nextState, options);
  }

  return resolveStandardEnemyTurn(nextState, options);
}
