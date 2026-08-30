import { applyIronwoodBuckler } from "./trinket-effects";
import { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
import type { BattleState, CombatTextEvent } from "./types";
import { processEnemyAttack, processEnemyTraitActionStart } from "./enemy-turn-attack";
import { processEnemyRegeneration, processEnemyTraits } from "./enemy-turn-traits";
import { processEncounterTraitActionDamage, processEncounterTraitActionStart } from "./encounter-trait-events";
import {
  advanceToPlayerTurn,
  reduceSkipTurns,
  resetEnemyTurnState,
  resolveDeathsDoorGraceExpiry,
} from "./player-turn-transition";

interface EndPlayerTurnResolutionBase {
  state: BattleState;
  combatTexts: CombatTextEvent[];
  playerTurnSkipped: boolean;
  enemyTurnStartCombatTexts: CombatTextEvent[];
  enemyResolutionCombatTexts: CombatTextEvent[];
  enemyPerformedAttack: boolean;
  afterAttackState?: BattleState;
}

export type EndPlayerTurnResolution =
  | (EndPlayerTurnResolutionBase & { kind: "haste" })
  | (EndPlayerTurnResolutionBase & { kind: "skipped" | "standard"; enemyTurnStartState: BattleState });

function finalizePlayerTurn(state: BattleState, combatTexts: CombatTextEvent[], options?: { preserveBlock?: boolean }) {
  const nextState = applyIronwoodBuckler(state, combatTexts);
  const finalState = advanceToPlayerTurn(nextState, combatTexts, options);
  return { state: finalState, combatTexts, playerTurnSkipped: finalState.turnPhase === "enemy" };
}

interface CombatTextResult {
  state: BattleState;
  texts: CombatTextEvent[];
}

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
    kind: "haste" as const,
    ...finalizePlayerTurn(nextState, combatTexts, { preserveBlock: true }),
    enemyTurnStartCombatTexts: [] as CombatTextEvent[],
    enemyResolutionCombatTexts: [] as CombatTextEvent[],
    enemyPerformedAttack: false,
  };
}

type EnemyPostTickMode = "attack" | "skip";

function resolveEnemyPostTickResolution(
  state: BattleState,
  texts: CombatTextEvent[],
  options: { traitRoll?: number } | undefined,
  mode: EnemyPostTickMode,
): { state: BattleState; afterAttackState?: BattleState } {
  let nextState = processEncounterTraitActionStart(state, texts);
  nextState = processEnemyTraits(nextState, texts, options);
  nextState = processEnemyTraitActionStart(nextState, texts);
  let afterAttackState: BattleState | undefined;
  if (mode === "attack") {
    nextState = processEnemyAttack(nextState, texts);
    afterAttackState = nextState;
    if (nextState.enemyHealth <= 0) return { state: nextState, afterAttackState };
  } else {
    nextState = reduceSkipTurns(nextState);
  }
  nextState = tickPlayerStatuses(nextState, texts);
  if (mode === "attack") nextState = processEncounterTraitActionDamage(nextState, texts);
  nextState = resolveDeathsDoorGraceExpiry(nextState);
  nextState = processEnemyRegeneration(nextState, texts);
  if (afterAttackState === undefined) return { state: nextState };
  return { state: nextState, afterAttackState };
}

function resolveSkippedEnemyTurn(state: BattleState, options?: { traitRoll?: number }) {
  const enemyTurnStartCombatTexts: CombatTextEvent[] = [];
  const enemyResolutionCombatTexts: CombatTextEvent[] = [];
  const nextState = tickEnemyStatuses(state, enemyTurnStartCombatTexts);
  const enemyTurnStartState = nextState;

  if (enemyTurnStartState.enemyHealth <= 0) {
    return {
      kind: "skipped" as const,
      ...finalizePlayerTurn(resolveDeathsDoorGraceExpiry(enemyTurnStartState), enemyTurnStartCombatTexts),
      enemyTurnStartState,
      enemyTurnStartCombatTexts,
      enemyResolutionCombatTexts: [],
      enemyPerformedAttack: false,
    };
  }

  const result = resolveEnemyPostTickResolution(nextState, enemyResolutionCombatTexts, options, "skip");
  const combatTexts = [...enemyTurnStartCombatTexts, ...enemyResolutionCombatTexts];

  return {
    kind: "skipped" as const,
    ...finalizePlayerTurn(result.state, combatTexts),
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
  const result = resolveEnemyPostTickResolution(state, texts, options, "attack");
  return { state: result.state, texts, afterAttackState: result.afterAttackState! };
}

function resolveStandardEnemyTurn(nextState: BattleState, options?: { traitRoll?: number }) {
  const startResult = resolveEnemyTurnStart(nextState);
  const enemyTurnStartState = startResult.state;
  const enemyTurnStartCombatTexts = startResult.texts;

  if (enemyTurnStartState.enemyHealth <= 0) {
    return {
      kind: "standard" as const,
      ...finalizePlayerTurn(resolveDeathsDoorGraceExpiry(enemyTurnStartState), enemyTurnStartCombatTexts),
      enemyTurnStartState,
      enemyTurnStartCombatTexts,
      enemyResolutionCombatTexts: [],
      enemyPerformedAttack: false,
    };
  }

  const actionResult = resolveEnemyAction(enemyTurnStartState, options);
  const combatTexts = [...enemyTurnStartCombatTexts, ...actionResult.texts];

  return {
    kind: "standard" as const,
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

  const enemyPhaseState = resetEnemyTurnState(nextState);

  if (state.enemyCC.stunSkipTurns + state.enemyCC.freezeSkipTurns > 0) {
    return resolveSkippedEnemyTurn(enemyPhaseState, options);
  }

  return resolveStandardEnemyTurn(enemyPhaseState, options);
}

export function recoverLegacyEnemyPhase(state: BattleState): BattleState {
  let recovered = state;
  let attempts = 0;
  while (recovered.turnPhase === "enemy" && attempts < 10) {
    recovered = advanceToPlayerTurn(recovered);
    attempts += 1;
  }
  return recovered.turnPhase === "player" ? recovered : { ...recovered, turnPhase: "player" };
}
