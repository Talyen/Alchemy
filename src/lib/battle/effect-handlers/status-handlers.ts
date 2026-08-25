// Status-related card effect apply handlers.
import { addEnemyStatus, type BattleState, type CombatTextEvent } from "../types";
import { mergeCombatText } from "../combat-text";
import type { EffectHandler } from "./handler-types";
import { applyPlayerStatusEffect, applyCleanseHeals, removeHarmfulPlayerStatuses } from "../status-player";
import { tryTriggerEnemyFreeze } from "../damage-status-riders";
import { resolveStunTrigger } from "../status-stun-resolve";
import { dealDamageToEnemy } from "../damage";
import { harmfulPlayerStatusIds, type EnemyStatusDamageId, type EnemyStatusId } from "@/lib/game-data";
import { dealPlayerTypedHit } from "../player-typed-hit";

function resolveEnemyStatusCcTrigger(
  preHitState: BattleState,
  nextState: BattleState,
  status: EnemyStatusId,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (status === "freeze") return tryTriggerEnemyFreeze(preHitState, nextState, combatTexts);
  if (status === "stun") return resolveStunTrigger(nextState, combatTexts);
  return nextState;
}

/** Clears every stack of one player status, preserving the rest of the status sheet. */
function zeroPlayerStatus(state: BattleState, status: EnemyStatusDamageId): BattleState {
  return { ...state, playerStatuses: { ...state.playerStatuses, [status]: 0 } };
}

export const applyPlayerStatusEffectHandler: EffectHandler = (
  state,
  _card,
  effect,
  potionMult,
  combatTexts,
  context,
) => {
  if (effect.kind !== "player-status") return state;
  let adjustedAmount = effect.amount;
  let nextState = state;
  if (effect.convertCurrentMana) {
    adjustedAmount = (context?.manaAtStart ?? state.mana) * effect.convertCurrentMana;
    nextState = { ...state, mana: 0 };
  } else if (effect.perManaCrystal) {
    adjustedAmount = effect.perManaCrystal * state.maxMana;
  }
  if (potionMult !== 1) {
    adjustedAmount = Math.round(adjustedAmount * potionMult);
  }
  return applyPlayerStatusEffect(nextState, { ...effect, amount: adjustedAmount }, combatTexts);
};

export const applyEnemyStatusEffect: EffectHandler = (state, _card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "enemy-status") return state;
  const amount = potionMult !== 1 ? Math.round(effect.amount * potionMult) : effect.amount;
  if (effect.status === "stun" || effect.status === "freeze") {
    return dealPlayerTypedHit(state, effect.status, amount, combatTexts);
  }
  const nextState = addEnemyStatus(state, effect.status, amount);
  const appliedAmount = nextState.enemyStatuses[effect.status] - state.enemyStatuses[effect.status];
  mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: effect.status, amount: appliedAmount });

  return nextState;
};

export const applyRemoveHarmfulStatusEffect: EffectHandler = (state, _card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "remove-harmful-status") return state;
  const adjustedRemove = effect.removeAll ? harmfulPlayerStatusIds.length : Math.round(effect.amount * potionMult);
  return removeHarmfulPlayerStatuses(state, adjustedRemove, combatTexts);
};

export const applyRemovePlayerStatusEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "remove-player-status") return state;
  if (state.playerStatuses[effect.status] <= 0) return state;
  return applyCleanseHeals(zeroPlayerStatus(state, effect.status), combatTexts);
};

export const applyMultiplyEnemyStatusEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "multiply-enemy-status") return state;
  const current = state.enemyStatuses[effect.status];
  if (current <= 0) return state;
  // Route through addEnemyStatus so stack additions honor enemy traits
  // (braced halves stun; poison rolls its armor shred) like every other source.
  const nextState = addEnemyStatus(state, effect.status, current * (effect.factor - 1));
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "multiply",
    stat: effect.status,
    amount: nextState.enemyStatuses[effect.status] - current,
  });

  return resolveEnemyStatusCcTrigger(state, nextState, effect.status, combatTexts);
};

export const applyCleansePlayerStatusToDamageEffect: EffectHandler = (
  state,
  card,
  effect,
  _potionMult,
  combatTexts,
) => {
  if (effect.kind !== "cleanse-player-status-to-damage") return state;
  const stacks = state.playerStatuses[effect.status];
  if (stacks <= 0) return state;

  const cleansed = applyCleanseHeals(zeroPlayerStatus(state, effect.status), combatTexts);

  return dealDamageToEnemy(
    cleansed,
    card,
    { kind: "damage", damageType: effect.damageType, amount: stacks },
    combatTexts,
  );
};
