// Shared helpers for enemy turn phase transitions, Death's Door, and health thresholds.
import { drawCards } from "./draw";
import { mergeCombatText } from "./combat-text";
import { decayHalvedStatus } from "./status-helpers";
import type { BattleState, CombatTextEvent } from "./types";
import { CARDS_PER_TURN, PERCENT_DENOMINATOR } from "../game-constants";

export const ENEMY_TURN_CONSTANTS = {
  IRON_HIDE_OPTIONS_COUNT: 3,
};

type FreezeAspect = "regen" | "scaling";

function computeDeathsDoorGraceRemaining(state: BattleState): number {
  if (state.deathsDoorGraceTurnsRemaining !== null) return state.deathsDoorGraceTurnsRemaining;
  if (state.deathsDoorTriggeredTurn !== null) {
    const graceTurns = 1 + Math.max(0, state.talentEffects.deathsDoorExtension ?? 0);
    return graceTurns - (state.turn - state.deathsDoorTriggeredTurn);
  }
  return 1 + Math.max(0, state.talentEffects.deathsDoorExtension ?? 0);
}

export function isFreezeActiveForAspect(state: BattleState, aspect: FreezeAspect): boolean {
  if (state.enemyFreezeSkipTurns <= 0) return false;
  if (aspect === "regen") return state.talentEffects.freezeBlocksRegen;
  return state.talentEffects.freezePreventsEnemyScaling;
}

export function scaleByRoomMultiplier(state: BattleState, value: number): number {
  return Math.round(value * state.roomScalingMultiplier);
}

function resetPlayerTurnState(state: BattleState): BattleState {
  return {
    ...state,
    turn: state.turn + 1,
    playerCCCooldown: Math.max(0, state.playerCCCooldown - 1),
    enemyCCCooldown: Math.max(0, state.enemyCCCooldown - 1),
    playerStatuses: { ...state.playerStatuses, block: decayHalvedStatus(state.playerStatuses.block ?? 0) },
    cardsPlayedThisTurn: 0,
    flags: {
      ...state.flags,
      resonantChimeUsedThisTurn: false,
      runicQuillUsedThisTurn: false,
      nextCardCostReduction: 0,
    },
  };
}

function handleCCSkipTurn(state: BattleState): BattleState {
  const nextState = resetPlayerTurnState(state);
  return {
    ...nextState,
    turnPhase: "enemy",
    playerStunSkipTurns: Math.max(0, state.playerStunSkipTurns - 1),
    playerFreezeSkipTurns: Math.max(0, state.playerFreezeSkipTurns - 1),
  };
}

function performDrawAndResetPhase(state: BattleState, deathsDoorNeedsRecoveryTurn: boolean): BattleState {
  const nextDraw = drawCards(state.deck, state.discard, [], CARDS_PER_TURN, state.nextCardUid, state.rng);
  const nextState = resetPlayerTurnState(state);
  const hadUnspentMana = state.mana > 0;
  const wellspringBonus =
    hadUnspentMana && state.talentEffects.wellspringKeepMana > 0 ? state.talentEffects.wellspringKeepMana : 0;
  return {
    ...nextState,
    turnPhase: "player",
    deck: nextDraw.deck,
    hand: nextDraw.hand,
    discard: nextDraw.discard,
    nextCardUid: nextDraw.nextCardUid,
    mana: nextState.maxMana + wellspringBonus,
    playerStunSkipTurns: deathsDoorNeedsRecoveryTurn ? 0 : nextState.playerStunSkipTurns,
    playerFreezeSkipTurns: deathsDoorNeedsRecoveryTurn ? 0 : nextState.playerFreezeSkipTurns,
  };
}

export function advanceToPlayerTurn(state: BattleState) {
  const deathsDoorNeedsRecoveryTurn = state.deathsDoorActive && state.playerHealth <= 0;

  let nextState = state;
  if (deathsDoorNeedsRecoveryTurn) {
    nextState = {
      ...state,
      deathsDoorGraceTurnsRemaining: computeDeathsDoorGraceRemaining(state) - 1,
    };
  }

  if (!deathsDoorNeedsRecoveryTurn && state.playerStunSkipTurns + state.playerFreezeSkipTurns > 0) {
    return handleCCSkipTurn(nextState);
  }

  return performDrawAndResetPhase(nextState, deathsDoorNeedsRecoveryTurn);
}

export function checkHealthThresholds(
  prevHealth: number,
  nextHealth: number,
  state: BattleState,
  combatTexts: CombatTextEvent[],
) {
  let nextState = state;

  function applyHealthThresholdStatBonus(
    currentState: BattleState,
    config: { threshold: number; amount: number } | null,
    stat: "block" | "armor",
  ): BattleState {
    if (!config) return currentState;
    const thresholdHp = (state.playerMaxHealth * config.threshold) / PERCENT_DENOMINATOR;
    if (prevHealth > thresholdHp && nextHealth <= thresholdHp) {
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat, amount: config.amount });
      return {
        ...currentState,
        playerStatuses: { ...currentState.playerStatuses, [stat]: currentState.playerStatuses[stat] + config.amount },
      };
    }
    return currentState;
  }

  nextState = applyHealthThresholdStatBonus(nextState, state.talentEffects.healthThresholdBlock, "block");
  nextState = applyHealthThresholdStatBonus(nextState, state.talentEffects.healthThresholdArmor, "armor");
  return nextState;
}

export function reduceSkipTurns(state: BattleState): BattleState {
  return {
    ...state,
    enemyStunSkipTurns: Math.max(0, state.enemyStunSkipTurns - 1),
    enemyFreezeSkipTurns: Math.max(0, state.enemyFreezeSkipTurns - 1),
  };
}

export function resolveDeathsDoorEndOfEnemyTurn(state: BattleState): BattleState {
  if (!state.deathsDoorActive) return state;
  if (state.playerHealth > 0) {
    return {
      ...state,
      deathsDoorActive: false,
      deathsDoorTriggeredTurn: null,
      deathsDoorGraceTurnsRemaining: null,
    };
  }

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
