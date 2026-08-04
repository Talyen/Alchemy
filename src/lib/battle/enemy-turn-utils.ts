// Shared helpers for enemy turn phase transitions, Death's Door, and health thresholds.
import { drawCards } from "./draw";
import { emitOverhealBlockText, mergeCombatText } from "./combat-text";
import { decayHalvedStatus } from "./status-helpers";
import { applyPlayerHealing, type BattleState, type CombatTextEvent } from "./types";
import { CARDS_PER_TURN, PERCENT_DENOMINATOR } from "../game-constants";

export const ENEMY_TURN_CONSTANTS = {
  IRON_HIDE_OPTIONS_COUNT: 3,
};

type FreezeAspect = "regen" | "scaling";

function computeDeathsDoorGraceRemaining(state: BattleState): number {
  if (state.deathsDoorGraceTurnsRemaining !== null) return state.deathsDoorGraceTurnsRemaining;
  if (state.deathsDoorTriggeredTurn !== null) {
    const graceTurns = 1 + Math.max(0, state.talentEffects.deathsDoorExtension);
    return graceTurns - (state.turn - state.deathsDoorTriggeredTurn);
  }
  return 1 + Math.max(0, state.talentEffects.deathsDoorExtension);
}

export function isFreezeActiveForAspect(state: BattleState, aspect: FreezeAspect): boolean {
  if (state.enemyCC.freezeSkipTurns <= 0) return false;
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
    playerCC: { ...state.playerCC, cooldown: Math.max(0, state.playerCC.cooldown - 1) },
    enemyCC: { ...state.enemyCC, cooldown: Math.max(0, state.enemyCC.cooldown - 1) },
    playerStatuses: { ...state.playerStatuses, block: decayHalvedStatus(state.playerStatuses.block) },
    cardsPlayedThisTurn: 0,
    flags: {
      ...state.flags,
      resonantChimeUsedThisTurn: false,
      runicQuillUsedThisTurn: false,
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

function handleCCSkipTurn(state: BattleState): BattleState {
  const nextState = resetPlayerTurnState(state);
  return {
    ...nextState,
    turnPhase: "enemy",
    playerCC: {
      ...nextState.playerCC,
      stunSkipTurns: Math.max(0, state.playerCC.stunSkipTurns - 1),
      freezeSkipTurns: Math.max(0, state.playerCC.freezeSkipTurns - 1),
    },
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
    playerCC: {
      ...nextState.playerCC,
      stunSkipTurns: deathsDoorNeedsRecoveryTurn ? 0 : nextState.playerCC.stunSkipTurns,
      freezeSkipTurns: deathsDoorNeedsRecoveryTurn ? 0 : nextState.playerCC.freezeSkipTurns,
    },
  };
}

export function advanceToPlayerTurn(state: BattleState, combatTexts: CombatTextEvent[] = []) {
  const deathsDoorNeedsRecoveryTurn = state.deathsDoorActive;

  let nextState = state;
  if (deathsDoorNeedsRecoveryTurn) {
    nextState = {
      ...state,
      deathsDoorGraceTurnsRemaining: computeDeathsDoorGraceRemaining(state) - 1,
    };
  }

  if (!deathsDoorNeedsRecoveryTurn && state.playerCC.stunSkipTurns + state.playerCC.freezeSkipTurns > 0) {
    return handleCCSkipTurn(nextState);
  }

  const drawnState = performDrawAndResetPhase(nextState, deathsDoorNeedsRecoveryTurn);
  if (drawnState.gearEffects.healthPerTurn <= 0) return drawnState;
  const healAmount = drawnState.gearEffects.healthPerTurn;
  const prevState = drawnState;
  const healedState = applyPlayerHealing(drawnState, healAmount);
  mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  emitOverhealBlockText(prevState, healedState, combatTexts);
  return healedState;
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
    enemyCC: {
      ...state.enemyCC,
      stunSkipTurns: Math.max(0, state.enemyCC.stunSkipTurns - 1),
      freezeSkipTurns: Math.max(0, state.enemyCC.freezeSkipTurns - 1),
    },
  };
}

export function resolveDeathsDoorEndOfEnemyTurn(state: BattleState): BattleState {
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
