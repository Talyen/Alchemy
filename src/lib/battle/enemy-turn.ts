import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { isCcControlled } from "./crowd-control-policy";
import { battleSnapshot } from "./battle-snapshot";
import { hasEncounterBenefit } from "./encounter-trait-state";
import type { BattleResolutionContext } from "./types";
import { processCompanionTurnStart } from "./companion";
import { deliverPendingHandCards, refillEmptyDrawPile } from "./draw";
import { applyHealingWithCombatText } from "./player-rewards";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
import type { BattleState, BattleSnapshot, CombatTextEvent, CompanionActionCue } from "./types";
import { getBattleOutcome, isPlayerDefeated } from "./battle-outcome";
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
  if (getBattleOutcome(state) !== null) {
    return { state, combatTexts, playerTurnSkipped: false };
  }
  const finalState = advanceToPlayerTurn(state, combatTexts, options);
  return { state: finalState, combatTexts, playerTurnSkipped: isCcControlled(finalState.playerCC) };
}

function beginEnemyPhase(state: BattleState): BattleState {
  return deliverPendingHandCards(
    refillEmptyDrawPile({
      ...state,
      turnPhase: "enemy",
      flags: { ...state.flags, darkRecoveryMana: state.mana === 0 ? state.talentEffects.manaAfterEmptyTurn : 0 },
      hand: [],
      discard: [...state.discard, ...state.hand],
    }),
  );
}

function resolveHasteTurn(state: BattleState) {
  const combatTexts: CombatTextEvent[] = [];
  const nextState = {
    ...state,
    playerStatuses: { ...state.playerStatuses, haste: Math.max(0, state.playerStatuses.haste - 1) },
  };
  return {
    kind: "haste" as const,
    ...finalizePlayerTurn(nextState, combatTexts, { preserveBlock: true, manaAtTurnEnd: state.mana }),
    enemyTurnStartCombatTexts: [] as CombatTextEvent[],
    enemyResolutionCombatTexts: [] as CombatTextEvent[],
    enemyPerformedAbility: false,
  };
}

function resolveEnemyPostTickResolution(
  state: BattleState,
  texts: CombatTextEvent[],
  skipped: boolean,
): { state: BattleState; skipped: boolean; afterAbilityState?: BattleState } {
  let nextState = processEnemyTraits(processEncounterTraitActionStart(state, texts), texts);
  if (getBattleOutcome(nextState) !== null) return { state: nextState, skipped };
  // Turn-start retaliation can control the enemy before it selects an ability.
  skipped ||= isCcControlled(nextState.enemyCC);
  let afterAbilityState: BattleState | undefined;
  if (!skipped) {
    nextState = processEnemyAbility(nextState, texts);
    afterAbilityState = nextState;
    if (getBattleOutcome(nextState) !== null) return { state: nextState, skipped, afterAbilityState };
  } else {
    nextState = reduceSkipTurns(nextState, texts);
  }
  nextState = tickPlayerStatuses(nextState, texts);
  if (getBattleOutcome(nextState) !== null || isPlayerDefeated(nextState)) {
    return afterAbilityState ? { state: nextState, skipped, afterAbilityState } : { state: nextState, skipped };
  }
  if (!skipped) {
    nextState = processEncounterTraitActionDamage(nextState, texts);
    if (isPlayerDefeated(nextState)) {
      return afterAbilityState ? { state: nextState, skipped, afterAbilityState } : { state: nextState, skipped };
    }
  }
  nextState = processEnemyRegeneration(resolveDeathsDoorGraceExpiry(nextState, texts), texts);
  return afterAbilityState ? { state: nextState, skipped, afterAbilityState } : { state: nextState, skipped };
}

function resolveEnemyTurn(state: BattleState): Exclude<EndPlayerTurnResolution, { kind: "haste" }> {
  const skippedAtStart = isCcControlled(state.enemyCC);
  const enemyTurnStartCombatTexts: CombatTextEvent[] = [];
  const enemyTurnStartState = tickEnemyStatuses(state, enemyTurnStartCombatTexts);
  const enemyResolutionCombatTexts: CombatTextEvent[] = [];

  if (getBattleOutcome(enemyTurnStartState) !== null) {
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
  const result = resolveEnemyPostTickResolution(enemyTurnStartState, enemyResolutionCombatTexts, skipped);
  // Playback consumes the phase batches, so next-turn rewards must also join
  // the final phase rather than existing only in the combined engine result.
  const finalized = finalizePlayerTurn(result.state, enemyResolutionCombatTexts, { manaAtTurnEnd: state.mana });
  return {
    kind: result.skipped ? "skipped" : "standard",
    ...finalized,
    combatTexts: [...enemyTurnStartCombatTexts, ...finalized.combatTexts],
    enemyTurnStartState,
    enemyTurnStartCombatTexts,
    enemyResolutionCombatTexts,
    enemyPerformedAbility: result.afterAbilityState !== undefined,
    ...(result.afterAbilityState ? { afterAbilityState: result.afterAbilityState } : {}),
  };
}

export function endPlayerTurn(state: BattleState): EndPlayerTurnResolution {
  const endingTexts: CombatTextEvent[] = [];
  const healedState =
    hasEncounterBenefit(state, "restorative") && getBattleOutcome(state) === null
      ? applyHealingWithCombatText(state, LABYRINTH_MODIFIER_CONFIG.healingPerTurn, endingTexts)
      : state;
  const settled = resolvePendingBattleReactions(healedState, endingTexts);
  if (getBattleOutcome(settled) !== null) {
    return {
      kind: "standard" as const,
      state: settled,
      combatTexts: endingTexts,
      playerTurnSkipped: false,
      enemyTurnStartState: settled,
      enemyTurnStartCombatTexts: endingTexts,
      enemyResolutionCombatTexts: [],
      enemyPerformedAbility: false,
    };
  }
  const turnEndedState = reducePlayerSkipTurns(settled);
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

export interface BattleTurnFrame {
  before: BattleSnapshot;
  turn: EndPlayerTurnResolution<BattleSnapshot>;
  companion: { id: string; texts: CombatTextEvent[]; state: BattleSnapshot; actions?: CompanionActionCue[] } | null;
  companionActions?: CompanionActionCue[];
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
export function resolveTurnSequence(
  snapshot: BattleSnapshot,
  context: BattleResolutionContext,
  options?: { maxTurns: number },
): ResolvedBattleTurn {
  let state: BattleState = { ...snapshot, ...context };
  const frames: BattleTurnFrame[] = [];
  // Balance fights have a round budget, including forced skips. Live commands
  // omit it and continue until player input is possible or combat ends.
  while (getBattleOutcome(state) === null && frames.length < (options?.maxTurns ?? Infinity)) {
    const before = battleSnapshot(state);
    const companionActions: CompanionActionCue[] = [];
    state = {
      ...state,
      onCompanionAction: (cue) => {
        companionActions.push(cue);
        context.onCompanionAction?.(cue);
      },
    };
    const turn = endPlayerTurn(state);
    state = turn.state;
    const turnCompanionActions = companionActions.splice(0);
    let companion: BattleTurnFrame["companion"] = null;
    if (!turn.playerTurnSkipped && getBattleOutcome(state) === null && state.activeCompanion) {
      const id = state.activeCompanion.id;
      const texts: CombatTextEvent[] = [];
      state = processCompanionTurnStart(state, texts);
      companion = { id, texts, state: battleSnapshot(state), actions: companionActions };
    }
    frames.push({ before, turn: snapshotTurn(turn), companion, companionActions: turnCompanionActions });
    if (!turn.playerTurnSkipped || state.wishOptions) break;
  }
  return { state: battleSnapshot(state), frames };
}
