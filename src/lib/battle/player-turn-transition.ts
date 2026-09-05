import type { BattleCard } from "@/lib/game-data";
import { CARDS_PER_TURN } from "../game-constants";
import { applyHealingWithCombatText } from "./combat-text";
import { halveRounded } from "./amount-helpers";
import { dealPlayerTypedHit } from "./player-typed-hit";
import { applyCleanseHeals } from "./status-player";
import { drawCards, applyDrawResult } from "./draw";
import { applyCardEffects } from "./effect-handlers";
import { finalizeCcSkipTurnDecrement, isPlayerCcControlled } from "./status-cc";
import { decayHalvedStatus } from "./status-helpers";
import { getBattleRng } from "@/lib/rng";
import { deathsDoorGraceTurns, type BattleState, type CombatTextEvent, withPreservedFlags } from "./types";

function applyPlagueDoctorMask(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.playerHealth <= 0 || state.enemyHealth <= 0) return state;
  const removed = Math.min(state.playerStatuses.poison, state.trinketEffects.plagueDoctorPoisonCleanse);
  if (removed <= 0) return state;
  const cleansed = applyCleanseHeals(
    { ...state, playerStatuses: { ...state.playerStatuses, poison: state.playerStatuses.poison - removed } },
    combatTexts,
  );
  return dealPlayerTypedHit(cleansed, "poison", halveRounded(removed), combatTexts);
}

function computeDeathsDoorGraceRemaining(state: BattleState): number {
  if (state.deathsDoorGraceTurnsRemaining !== null) return state.deathsDoorGraceTurnsRemaining;
  if (state.deathsDoorTriggeredTurn !== null) {
    const graceTurns = deathsDoorGraceTurns(state.talentEffects.deathsDoorExtension);
    return graceTurns - (state.turn - state.deathsDoorTriggeredTurn);
  }
  return deathsDoorGraceTurns(state.talentEffects.deathsDoorExtension);
}

function processPendingTurnStartEffects(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.pendingTurnStartEffects.length === 0) return state;
  const due: BattleState["pendingTurnStartEffects"] = [];
  const kept: BattleState["pendingTurnStartEffects"] = [];
  for (const pulse of state.pendingTurnStartEffects) {
    due.push(pulse);
    if (pulse.remainingTurns > 1) kept.push({ ...pulse, remainingTurns: pulse.remainingTurns - 1 });
  }
  const pulseCard: BattleCard = {
    id: "pending-turn-start",
    title: "",
    descriptionLines: [],
    art: "",
    cost: 0,
    effects: [],
  };
  return withPreservedFlags({ ...state, pendingTurnStartEffects: kept }, (nextState) =>
    due.reduce(
      (current, pulse) => applyCardEffects(current, { ...pulseCard, effects: pulse.effects }, combatTexts),
      nextState,
    ),
  );
}

function resetPlayerTurnState(state: BattleState, options?: { preserveBlock?: boolean }): BattleState {
  return {
    ...state,
    turn: state.turn + 1,
    playerCC: { ...state.playerCC, cooldown: Math.max(0, state.playerCC.cooldown - 1) },
    enemyCC: { ...state.enemyCC, cooldown: Math.max(0, state.enemyCC.cooldown - 1) },
    playerStatuses: {
      ...state.playerStatuses,
      block: options?.preserveBlock ? state.playerStatuses.block : decayHalvedStatus(state.playerStatuses.block),
    },
    cardsPlayedThisTurn: 0,
    flags: {
      ...state.flags,
      resonantChimeUsedThisTurn: false,
      runicQuillUsedThisTurn: false,
      consumeDrawUsedThisTurn: false,
      nextCardCostReduction: 0,
    },
  };
}

export function resetEnemyTurnState(state: BattleState): BattleState {
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      block: decayHalvedStatus(state.enemyMitigation.block),
    },
  };
}

export function reducePlayerSkipTurns(state: BattleState): BattleState {
  const prevCc = state.playerCC;
  if (!isPlayerCcControlled(prevCc)) return state;
  const decrementedCc = {
    ...prevCc,
    stunSkipTurns: Math.max(0, prevCc.stunSkipTurns - 1),
    freezeSkipTurns: Math.max(0, prevCc.freezeSkipTurns - 1),
  };
  return {
    ...state,
    playerCC: finalizeCcSkipTurnDecrement(prevCc, decrementedCc),
  };
}

function performDrawAndResetPhase(
  state: BattleState,
  deathsDoorNeedsRecoveryTurn: boolean,
  options?: { preserveBlock?: boolean },
): BattleState {
  const nextDraw = drawCards(state.deck, state.discard, [], CARDS_PER_TURN, state.nextCardUid, getBattleRng(state));
  const nextState = resetPlayerTurnState(state, options);
  const hadUnspentMana = state.mana > 0;
  const wellspringBonus =
    hadUnspentMana && state.talentEffects.wellspringKeepMana > 0 ? state.talentEffects.wellspringKeepMana : 0;
  return {
    ...applyDrawResult(nextState, nextDraw),
    turnPhase: "player",
    mana: nextState.maxMana + wellspringBonus,
    playerCC: {
      ...nextState.playerCC,
      stunSkipTurns: deathsDoorNeedsRecoveryTurn ? 0 : nextState.playerCC.stunSkipTurns,
      freezeSkipTurns: deathsDoorNeedsRecoveryTurn ? 0 : nextState.playerCC.freezeSkipTurns,
    },
  };
}

export function advanceToPlayerTurn(
  state: BattleState,
  combatTexts: CombatTextEvent[] = [],
  options?: { preserveBlock?: boolean },
) {
  const deathsDoorNeedsRecoveryTurn = state.deathsDoorActive;

  let nextState = state;
  if (deathsDoorNeedsRecoveryTurn && !options?.preserveBlock) {
    nextState = {
      ...state,
      deathsDoorGraceTurnsRemaining: computeDeathsDoorGraceRemaining(state) - 1,
    };
  }

  const drawnState = processPendingTurnStartEffects(
    applyPlagueDoctorMask(performDrawAndResetPhase(nextState, deathsDoorNeedsRecoveryTurn, options), combatTexts),
    combatTexts,
  );
  if (drawnState.gearEffects.healthPerTurn <= 0) return drawnState;
  return applyHealingWithCombatText(drawnState, drawnState.gearEffects.healthPerTurn, combatTexts);
}

export function reduceSkipTurns(state: BattleState): BattleState {
  const prevCc = state.enemyCC;
  const decrementedCc = {
    ...prevCc,
    stunSkipTurns: Math.max(0, prevCc.stunSkipTurns - 1),
    freezeSkipTurns: Math.max(0, prevCc.freezeSkipTurns - 1),
  };
  return {
    ...state,
    enemyCC: finalizeCcSkipTurnDecrement(prevCc, decrementedCc),
  };
}

export function resolveDeathsDoorGraceExpiry(state: BattleState): BattleState {
  if (!state.deathsDoorActive) return state;
  const remaining = computeDeathsDoorGraceRemaining(state);
  if (remaining <= 0) {
    return {
      ...state,
      deathsDoorActive: false,
      deathsDoorTriggeredTurn: null,
      deathsDoorGraceTurnsRemaining: null,
    };
  }
  return state;
}
