// Status-related card effect apply handlers.
import { addEnemyStatus, adjustEnemyStatusDelta, setEnemyStatus } from "../types";
import { mergeCombatText, applyHealingWithCombatText } from "../combat-text";
import type { BattleState } from "../types";
import type { EffectHandler } from "./handler-types";
import {
  applyPlayerStatusEffect,
  tryTriggerEnemyFreeze,
  resolveStunTrigger,
  removeHarmfulPlayerStatuses,
} from "../status-effects";
import { dealDamageToEnemy } from "../damage";

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
  let nextState = addEnemyStatus(state, effect.status, effect.amount);
  const appliedAmount = nextState.enemyStatuses[effect.status] - state.enemyStatuses[effect.status];
  mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: effect.status, amount: appliedAmount });

  if (effect.status === "freeze") {
    nextState = tryTriggerEnemyFreeze(state, nextState, combatTexts);
  } else if (effect.status === "stun") {
    nextState = resolveStunTrigger(nextState, combatTexts);
  }
  return nextState;
};

export const applyRemoveHarmfulStatusEffect: EffectHandler = (state, _card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "remove-harmful-status") return state;
  const adjustedRemove = Math.round(effect.amount * potionMult);
  return removeHarmfulPlayerStatuses(state, adjustedRemove, combatTexts);
};

export const applyRemovePlayerStatusEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "remove-player-status") return state;
  if (state.playerStatuses[effect.status] <= 0) return state;
  let nextState: BattleState = {
    ...state,
    playerStatuses: { ...state.playerStatuses, [effect.status]: 0 },
  };
  nextState = applyHealingWithCombatText(
    nextState,
    nextState.trinketEffects.sinEaterHealOnHarmfulStatusRemove,
    combatTexts,
  );
  nextState = applyHealingWithCombatText(nextState, nextState.talentEffects.healOnStatusCleanse, combatTexts);
  return nextState;
};

export const applyMultiplyEnemyStatusEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "multiply-enemy-status") return state;
  const current = state.enemyStatuses[effect.status];
  if (current <= 0) return state;
  const added = adjustEnemyStatusDelta(state, current * (effect.factor - 1));
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "multiply",
    stat: effect.status,
    amount: added,
  });

  let nextState = setEnemyStatus(state, effect.status, current + added);

  if (effect.status === "freeze") {
    nextState = tryTriggerEnemyFreeze(state, nextState, combatTexts);
  } else if (effect.status === "stun") {
    nextState = resolveStunTrigger(nextState, combatTexts);
  }

  return nextState;
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
  nextState = applyHealingWithCombatText(
    nextState,
    nextState.trinketEffects.sinEaterHealOnHarmfulStatusRemove,
    combatTexts,
  );
  nextState = applyHealingWithCombatText(nextState, nextState.talentEffects.healOnStatusCleanse, combatTexts);

  return dealDamageToEnemy(
    nextState,
    card,
    { kind: "damage", damageType: effect.damageType, amount: stacks },
    combatTexts,
  );
};
