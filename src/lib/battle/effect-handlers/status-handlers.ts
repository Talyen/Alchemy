// Status-related card effect apply handlers.
import { addEnemyStatus, setEnemyStatus, type BattleState, type CombatTextEvent } from "../types";
import { mergeCombatText } from "../combat-text";
import type { EffectHandler } from "./handler-types";
import { applyPlayerStatusEffect, applyCleanseHeals, removeHarmfulPlayerStatuses } from "../status-player";
import { tryTriggerEnemyFreeze } from "../damage-status-riders";
import { resolveStunTrigger } from "../status-stun-resolve";
import { dealDamageToEnemy } from "../damage";
import type { EnemyStatusId } from "@/lib/game-data";

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

export const applyPlayerStatusEffectHandler: EffectHandler = (state, _card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "player-status") return state;
  let adjustedAmount = effect.amount;
  if (effect.perManaCrystal) {
    adjustedAmount = effect.perManaCrystal * state.maxMana;
  }
  if (potionMult !== 1) {
    adjustedAmount = Math.round(adjustedAmount * potionMult);
  }
  return applyPlayerStatusEffect(state, { ...effect, amount: adjustedAmount }, combatTexts);
};

export const applyEnemyStatusEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "enemy-status") return state;
  const nextState = addEnemyStatus(state, effect.status, effect.amount);
  const appliedAmount = nextState.enemyStatuses[effect.status] - state.enemyStatuses[effect.status];
  mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: effect.status, amount: appliedAmount });

  return resolveEnemyStatusCcTrigger(state, nextState, effect.status, combatTexts);
};

export const applyRemoveHarmfulStatusEffect: EffectHandler = (state, _card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "remove-harmful-status") return state;
  const adjustedRemove = Math.round(effect.amount * potionMult);
  return removeHarmfulPlayerStatuses(state, adjustedRemove, combatTexts);
};

export const applyRemovePlayerStatusEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "remove-player-status") return state;
  if (state.playerStatuses[effect.status] <= 0) return state;
  const nextState: BattleState = {
    ...state,
    playerStatuses: { ...state.playerStatuses, [effect.status]: 0 },
  };
  return applyCleanseHeals(nextState, combatTexts);
};

export const applyMultiplyEnemyStatusEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "multiply-enemy-status") return state;
  const current = state.enemyStatuses[effect.status];
  if (current <= 0) return state;
  const added = current * (effect.factor - 1);
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "multiply",
    stat: effect.status,
    amount: added,
  });

  const nextState = setEnemyStatus(state, effect.status, current + added);

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

  let nextState: BattleState = {
    ...state,
    playerStatuses: { ...state.playerStatuses, [effect.status]: 0 },
  };
  nextState = applyCleanseHeals(nextState, combatTexts);

  return dealDamageToEnemy(
    nextState,
    card,
    { kind: "damage", damageType: effect.damageType, amount: stacks },
    combatTexts,
  );
};
