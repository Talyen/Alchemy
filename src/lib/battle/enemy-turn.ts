import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { hasEncounterBenefit } from "./types";
import { applyHealingWithCombatText } from "./combat-text";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import { applyIronwoodBuckler } from "./bonus-effects";
import { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
import { isPlayerDefeated, type BattleState, type CombatTextEvent } from "./types";
import { processEnemyAbility } from "./enemy-turn-attack";
import { processEnemyRegeneration, processEnemyTraits } from "./enemy-turn-traits";
import { processEncounterTraitActionDamage, processEncounterTraitActionStart } from "./encounter-trait-events";
import {
  advanceToPlayerTurn,
  reducePlayerSkipTurns,
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
  enemyPerformedAbility: boolean;
  afterAbilityState?: BattleState;
}

export type EndPlayerTurnResolution =
  | (EndPlayerTurnResolutionBase & { kind: "haste" })
  | (EndPlayerTurnResolutionBase & { kind: "skipped" | "standard"; enemyTurnStartState: BattleState });

function finalizePlayerTurn(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  options?: { preserveBlock?: boolean; manaAtTurnEnd?: number },
) {
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) {
    return { state, combatTexts, playerTurnSkipped: false };
  }
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
    flags: { ...state.flags, darkRecoveryMana: state.mana === 0 ? state.talentEffects.manaAfterEmptyTurn : 0 },
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
    enemyPerformedAbility: false,
  };
}

type EnemyPostTickMode = "attack" | "skip";

function resolveEnemyPostTickResolution(
  state: BattleState,
  texts: CombatTextEvent[],
  mode: EnemyPostTickMode,
): { state: BattleState; afterAbilityState?: BattleState } {
  let nextState = processEncounterTraitActionStart(state, texts);
  nextState = processEnemyTraits(nextState, texts);
  let afterAbilityState: BattleState | undefined;
  if (mode === "attack") {
    nextState = processEnemyAbility(nextState, texts);
    afterAbilityState = nextState;
    if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return { state: nextState, afterAbilityState };
  } else {
    nextState = reduceSkipTurns(nextState);
  }
  nextState = tickPlayerStatuses(nextState, texts);
  if (mode === "attack" && !isPlayerDefeated(nextState)) {
    nextState = processEncounterTraitActionDamage(nextState, texts);
  }
  if (isPlayerDefeated(nextState)) return { state: nextState, ...(afterAbilityState ? { afterAbilityState } : {}) };
  nextState = resolveDeathsDoorGraceExpiry(nextState);
  nextState = processEnemyRegeneration(nextState, texts);
  if (afterAbilityState === undefined) return { state: nextState };
  return { state: nextState, afterAbilityState };
}

function resolveSkippedEnemyTurn(state: BattleState) {
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
      enemyPerformedAbility: false,
    };
  }

  const result = resolveEnemyPostTickResolution(nextState, enemyResolutionCombatTexts, "skip");
  const combatTexts = [...enemyTurnStartCombatTexts, ...enemyResolutionCombatTexts];

  return {
    kind: "skipped" as const,
    ...finalizePlayerTurn(result.state, combatTexts, { manaAtTurnEnd: state.mana }),
    enemyTurnStartState,
    enemyTurnStartCombatTexts,
    enemyResolutionCombatTexts,
    enemyPerformedAbility: false,
  };
}

function resolveEnemyTurnStart(state: BattleState): CombatTextResult {
  const texts: CombatTextEvent[] = [];
  const nextState = tickEnemyStatuses(state, texts);
  return { state: nextState, texts };
}

function resolveEnemyAction(state: BattleState): CombatTextResult & { afterAbilityState: BattleState } {
  const texts: CombatTextEvent[] = [];
  const result = resolveEnemyPostTickResolution(state, texts, "attack");
  return { state: result.state, texts, afterAbilityState: result.afterAbilityState! };
}

function resolveStandardEnemyTurn(nextState: BattleState) {
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
      enemyPerformedAbility: false,
    };
  }

  const actionResult = resolveEnemyAction(enemyTurnStartState);
  const combatTexts = [...enemyTurnStartCombatTexts, ...actionResult.texts];

  return {
    kind: "standard" as const,
    ...finalizePlayerTurn(actionResult.state, combatTexts, { manaAtTurnEnd: nextState.mana }),
    enemyTurnStartState,
    enemyTurnStartCombatTexts,
    enemyResolutionCombatTexts: actionResult.texts,
    enemyPerformedAbility: true,
    afterAbilityState: actionResult.afterAbilityState,
  };
}

export function endPlayerTurn(state: BattleState): EndPlayerTurnResolution {
  const endingTexts: CombatTextEvent[] = [];
  const healedState =
    hasEncounterBenefit(state, "restorative") && state.enemyHealth > 0 && !isPlayerDefeated(state)
      ? applyHealingWithCombatText(state, LABYRINTH_MODIFIER_CONFIG.healingPerTurn, endingTexts)
      : state;
  const turnEndedState = reducePlayerSkipTurns(resolvePendingBattleReactions(healedState, endingTexts));
  const nextState = beginEnemyPhase(turnEndedState);

  if (turnEndedState.playerStatuses.haste > 0) {
    const result = resolveHasteTurn(nextState);
    return { ...result, combatTexts: [...endingTexts, ...result.combatTexts] };
  }

  const enemyPhaseState = resetEnemyTurnState(nextState);

  if (turnEndedState.enemyCC.stunSkipTurns + turnEndedState.enemyCC.freezeSkipTurns > 0) {
    const result = resolveSkippedEnemyTurn(enemyPhaseState);
    return {
      ...result,
      combatTexts: [...endingTexts, ...result.combatTexts],
      enemyTurnStartCombatTexts: [...endingTexts, ...result.enemyTurnStartCombatTexts],
    };
  }

  const result = resolveStandardEnemyTurn(enemyPhaseState);
  return {
    ...result,
    combatTexts: [...endingTexts, ...result.combatTexts],
    enemyTurnStartCombatTexts: [...endingTexts, ...result.enemyTurnStartCombatTexts],
  };
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
