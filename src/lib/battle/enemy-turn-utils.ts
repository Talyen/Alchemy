// Shared helpers for enemy turn phase transitions, Death's Door, and health thresholds.
import { drawCards, applyDrawResult } from "./draw";
import { applyHealingWithCombatText } from "./combat-text";
import { decayHalvedStatus } from "./status-helpers";
import { deathsDoorGraceTurns, type BattleState, type CombatTextEvent, withPreservedFlags } from "./types";
import { CARDS_PER_TURN, PERCENT_DENOMINATOR } from "../game-constants";
import { applyCardEffects } from "./effect-handlers";
import { applyPlayerStatusEffect } from "./status-player";
import { finalizeCcSkipTurnDecrement } from "./status-cc";
import type { BattleCard } from "@/lib/game-data";

export const ENEMY_TURN_CONSTANTS = {
  IRON_HIDE_OPTIONS_COUNT: 3,
};

/** Boss stacking traits (Iron Hide, Rusting Carapace, Glacial Shell) fire on even turns (2, 4, …). */
export function isEveryOtherTurnScalingTurn(state: { turn: number }): boolean {
  return state.turn % 2 === 0;
}

type FreezeAspect = "regen" | "scaling";

function computeDeathsDoorGraceRemaining(state: BattleState): number {
  // Grace-turns-remaining is the single source of truth; triggeredTurn is retained
  // only for legacy saves. Returning the stored remaining avoids turn-diff drift on
  // haste-preserved turns (where `turn` still increments but grace is held).
  if (state.deathsDoorGraceTurnsRemaining !== null) return state.deathsDoorGraceTurnsRemaining;
  if (state.deathsDoorTriggeredTurn !== null) {
    const graceTurns = deathsDoorGraceTurns(state.talentEffects.deathsDoorExtension);
    return graceTurns - (state.turn - state.deathsDoorTriggeredTurn);
  }
  return deathsDoorGraceTurns(state.talentEffects.deathsDoorExtension);
}

export function isFreezeActiveForAspect(state: BattleState, aspect: FreezeAspect): boolean {
  if (state.enemyCC.freezeSkipTurns <= 0) return false;
  if (aspect === "regen") return state.talentEffects.freezeBlocksRegen;
  return state.talentEffects.freezePreventsEnemyScaling;
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

export function scaleByRoomMultiplier(state: BattleState, value: number): number {
  return Math.round(value * state.roomScalingMultiplier);
}

function resetPlayerTurnState(state: BattleState, options?: { preserveBlock?: boolean }): BattleState {
  return {
    ...state,
    turn: state.turn + 1,
    playerCC: { ...state.playerCC, cooldown: Math.max(0, state.playerCC.cooldown - 1) },
    enemyCC: { ...state.enemyCC, cooldown: Math.max(0, state.enemyCC.cooldown - 1) },
    playerStatuses: {
      ...state.playerStatuses,
      // Haste turns skip the enemy attack window, so the block gained this turn
      // has not yet been attacked into and must hold until a real enemy phase resolves.
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

function handleCCSkipTurn(state: BattleState, options?: { preserveBlock?: boolean }): BattleState {
  const nextState = resetPlayerTurnState(state, options);
  const prevCc = state.playerCC;
  const decrementedCc = {
    ...nextState.playerCC,
    stunSkipTurns: Math.max(0, prevCc.stunSkipTurns - 1),
    freezeSkipTurns: Math.max(0, prevCc.freezeSkipTurns - 1),
  };
  return {
    ...nextState,
    turnPhase: "enemy",
    playerCC: finalizeCcSkipTurnDecrement(prevCc, decrementedCc),
  };
}

function performDrawAndResetPhase(
  state: BattleState,
  deathsDoorNeedsRecoveryTurn: boolean,
  options?: { preserveBlock?: boolean },
): BattleState {
  const nextDraw = drawCards(state.deck, state.discard, [], CARDS_PER_TURN, state.nextCardUid, state.rng);
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

  if (!deathsDoorNeedsRecoveryTurn && state.playerCC.stunSkipTurns + state.playerCC.freezeSkipTurns > 0) {
    return handleCCSkipTurn(nextState, options);
  }

  const drawnState = processPendingTurnStartEffects(
    performDrawAndResetPhase(nextState, deathsDoorNeedsRecoveryTurn, options),
    combatTexts,
  );
  if (drawnState.gearEffects.healthPerTurn <= 0) return drawnState;
  return applyHealingWithCombatText(drawnState, drawnState.gearEffects.healthPerTurn, combatTexts);
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
    configs: { threshold: number; amount: number } | Array<{ threshold: number; amount: number }> | null,
    stat: "block" | "armor",
  ): BattleState {
    const bonuses = configs == null ? [] : Array.isArray(configs) ? configs : [configs];
    let next = currentState;
    for (const config of bonuses) {
      const thresholdHp = (state.playerMaxHealth * config.threshold) / PERCENT_DENOMINATOR;
      if (prevHealth > thresholdHp && nextHealth <= thresholdHp) {
        next = applyPlayerStatusEffect(
          next,
          { kind: "player-status", status: stat, amount: config.amount },
          combatTexts,
        );
      }
    }
    return next;
  }

  nextState = applyHealthThresholdStatBonus(nextState, state.talentEffects.healthThresholdBlock, "block");
  nextState = applyHealthThresholdStatBonus(nextState, state.talentEffects.healthThresholdArmor, "armor");
  return nextState;
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
