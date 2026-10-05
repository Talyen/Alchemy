import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { isCcControlled } from "./status-cc";
import { battleSnapshot, hasEncounterBenefit } from "./types";
import type { BattleResolutionContext } from "./types";
import { processCompanionTurnStart } from "./companion";
import { deliverPendingHandCards } from "./draw";
import { applyHealingWithCombatText } from "./player-rewards";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
import { isPlayerDefeated, type BattleState, type BattleSnapshot, type CombatTextEvent } from "./types";
import { processEnemyAbility } from "./enemy-turn-attack";
import { isFreezeActiveForAspect, processEnemyRegeneration, processEnemyTraits } from "./enemy-turn-traits";
import { processEncounterTraitActionDamage, processEncounterTraitActionStart } from "./encounter-trait-events";
import {
  advanceToPlayerTurn,
  reducePlayerSkipTurns,
  reduceSkipTurns,
  resetEnemyTurnState,
  resolveDeathsDoorGraceExpiry,
} from "./player-turn-transition";

interface EndPlayerTurnResolutionBase<State extends BattleSnapshot> {
  state: State;
  combatTexts: CombatTextEvent[];
  playerTurnSkipped: boolean;
  enemyTurnStartCombatTexts: CombatTextEvent[];
  enemyResolutionCombatTexts: CombatTextEvent[];
  enemyPerformedAbility: boolean;
  afterAbilityState?: State;
}

export type EndPlayerTurnResolution<State extends BattleSnapshot = BattleState> =
  | (EndPlayerTurnResolutionBase<State> & { kind: "haste" })
  | (EndPlayerTurnResolutionBase<State> & { kind: "skipped" | "standard"; enemyTurnStartState: State });

function finalizePlayerTurn(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  options?: { preserveBlock?: boolean; manaAtTurnEnd?: number },
) {
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) {
    return { state, combatTexts, playerTurnSkipped: false };
  }
  const finalState = advanceToPlayerTurn(state, combatTexts, options);
  return { state: finalState, combatTexts, playerTurnSkipped: isCcControlled(finalState.playerCC) };
}

function processHasteEarlyTurn(state: BattleState): BattleState {
  return {
    ...state,
    playerStatuses: { ...state.playerStatuses, haste: Math.max(0, state.playerStatuses.haste - 1) },
  };
}

function beginEnemyPhase(state: BattleState): BattleState {
  return deliverPendingHandCards({
    ...state,
    turnPhase: "enemy",
    flags: { ...state.flags, darkRecoveryMana: state.mana === 0 ? state.talentEffects.manaAfterEmptyTurn : 0 },
    hand: [],
    discard: [...state.discard, ...state.hand],
  });
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
  // The last Frozen turn still suppresses regeneration before control expires.
  const regenerationBlocked = isFreezeActiveForAspect(nextState, "regen");
  let afterAbilityState: BattleState | undefined;
  if (mode === "attack") {
    nextState = processEnemyAbility(nextState, texts);
    afterAbilityState = nextState;
    if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return { state: nextState, afterAbilityState };
  } else {
    nextState = reduceSkipTurns(nextState, texts);
  }
  // This turn's Bleed Leech is also suppressed when the last Frozen turn expires.
  if (regenerationBlocked && nextState.pendingEnemyBleedLeechHealing > 0) {
    nextState = { ...nextState, pendingEnemyBleedLeechHealing: 0 };
  }
  nextState = tickPlayerStatuses(nextState, texts);
  if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) {
    return { state: nextState, ...(afterAbilityState ? { afterAbilityState } : {}) };
  }
  if (mode === "attack" && !isPlayerDefeated(nextState)) {
    nextState = processEncounterTraitActionDamage(nextState, texts);
  }
  if (isPlayerDefeated(nextState)) return { state: nextState, ...(afterAbilityState ? { afterAbilityState } : {}) };
  nextState = resolveDeathsDoorGraceExpiry(nextState, texts);
  if (!regenerationBlocked) nextState = processEnemyRegeneration(nextState, texts);
  if (afterAbilityState === undefined) return { state: nextState };
  return { state: nextState, afterAbilityState };
}

function resolveEnemyTurn(state: BattleState): Exclude<EndPlayerTurnResolution, { kind: "haste" }> {
  const skippedAtStart = isCcControlled(state.enemyCC);
  const enemyTurnStartCombatTexts: CombatTextEvent[] = [];
  const enemyTurnStartState = tickEnemyStatuses(state, enemyTurnStartCombatTexts);
  const enemyResolutionCombatTexts: CombatTextEvent[] = [];

  if (enemyTurnStartState.enemyHealth <= 0 || isPlayerDefeated(enemyTurnStartState)) {
    return {
      kind: skippedAtStart ? "skipped" : "standard",
      ...finalizePlayerTurn(
        resolveDeathsDoorGraceExpiry(enemyTurnStartState, enemyTurnStartCombatTexts),
        enemyTurnStartCombatTexts,
      ),
      enemyTurnStartState,
      enemyTurnStartCombatTexts,
      enemyResolutionCombatTexts,
      enemyPerformedAbility: false,
    };
  }

  // Status ticks can trigger control; choose the action only after ticking once.
  const skipped = skippedAtStart || isCcControlled(enemyTurnStartState.enemyCC);
  const result = resolveEnemyPostTickResolution(
    enemyTurnStartState,
    enemyResolutionCombatTexts,
    skipped ? "skip" : "attack",
  );
  // Playback consumes the phase batches, so next-turn rewards must also join
  // the final phase rather than existing only in the combined engine result.
  const finalized = finalizePlayerTurn(result.state, enemyResolutionCombatTexts, { manaAtTurnEnd: state.mana });
  return {
    kind: skipped ? "skipped" : "standard",
    ...finalized,
    combatTexts: [...enemyTurnStartCombatTexts, ...finalized.combatTexts],
    enemyTurnStartState,
    enemyTurnStartCombatTexts,
    enemyResolutionCombatTexts,
    enemyPerformedAbility: !skipped,
    ...(result.afterAbilityState ? { afterAbilityState: result.afterAbilityState } : {}),
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

  const result = resolveEnemyTurn(resetEnemyTurnState(nextState));
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

export interface BattleTurnFrame {
  before: BattleSnapshot;
  turn: EndPlayerTurnResolution<BattleSnapshot>;
  companion: { id: string; texts: CombatTextEvent[]; state: BattleSnapshot } | null;
}

export interface ResolvedBattleTurn {
  state: BattleSnapshot;
  frames: BattleTurnFrame[];
}

function snapshotTurn(turn: EndPlayerTurnResolution): EndPlayerTurnResolution<BattleSnapshot> {
  const { afterAbilityState, ...result } = turn;
  const state = battleSnapshot(turn.state);
  const afterAbility = afterAbilityState ? { afterAbilityState: battleSnapshot(afterAbilityState) } : {};
  return result.kind === "haste"
    ? { ...result, state, ...afterAbility }
    : { ...result, state, enemyTurnStartState: battleSnapshot(result.enemyTurnStartState), ...afterAbility };
}

/** Resolve until input is possible again; presentation never advances combat or draws RNG. */
export function resolveBattleTurn(
  snapshot: BattleSnapshot,
  context: BattleResolutionContext,
  options?: { maxTurns: number },
): ResolvedBattleTurn {
  let state: BattleState = { ...snapshot, ...context };
  const frames: BattleTurnFrame[] = [];
  // Balance fights have a round budget, including forced skips. Live commands
  // omit it and continue until player input is possible or combat ends.
  while (state.enemyHealth > 0 && !isPlayerDefeated(state) && frames.length < (options?.maxTurns ?? Infinity)) {
    const before = battleSnapshot(state);
    const turn = endPlayerTurn(state);
    state = turn.state;
    let companion: BattleTurnFrame["companion"] = null;
    if (!turn.playerTurnSkipped && state.enemyHealth > 0 && !isPlayerDefeated(state) && state.activeCompanion) {
      const id = state.activeCompanion.id;
      const texts: CombatTextEvent[] = [];
      state = processCompanionTurnStart(state, texts);
      companion = { id, texts, state: battleSnapshot(state) };
    }
    frames.push({ before, turn: snapshotTurn(turn), companion });
    if (!turn.playerTurnSkipped) break;
  }
  return { state: battleSnapshot(state), frames };
}
