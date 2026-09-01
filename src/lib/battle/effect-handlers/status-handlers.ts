import { applyPotionMultiplier } from "../amount-helpers";
import { addEnemyStatus, type BattleState, type CombatTextEvent } from "../types";
import { mergeCombatText } from "../combat-text";
import { defineHandler } from "./handler-types";
import { applyPlayerStatusEffect, applyCleanseHeals, removeHarmfulPlayerStatuses } from "../status-player";
import { tryTriggerEnemyFreeze } from "../damage-status-riders";
import { resolveStunTrigger } from "../status-stun-resolve";
import { dealDamageToEnemy } from "../damage";
import { type EnemyStatusDamageId, type EnemyStatusId } from "@/lib/game-data";
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

function zeroPlayerStatus(state: BattleState, status: EnemyStatusDamageId): BattleState {
  return { ...state, playerStatuses: { ...state.playerStatuses, [status]: 0 } };
}

export const applyPlayerStatusEffectHandler = defineHandler(
  "player-status",
  (state, _card, effect, potionMult, combatTexts, context) => {
    let adjustedAmount = effect.amount;
    let nextState = state;
    if (effect.convertCurrentMana) {
      adjustedAmount = (context?.manaAtStart ?? state.mana) * effect.convertCurrentMana;
      nextState = { ...state, mana: 0 };
    } else if (effect.perManaCrystal) {
      adjustedAmount = effect.perManaCrystal * state.maxMana;
    }
    adjustedAmount = applyPotionMultiplier(adjustedAmount, potionMult);
    return applyPlayerStatusEffect(nextState, { ...effect, amount: adjustedAmount }, combatTexts);
  },
);

export const applyEnemyStatusEffect = defineHandler("enemy-status", (state, _card, effect, potionMult, combatTexts) => {
  const amount = applyPotionMultiplier(effect.amount, potionMult);
  if (effect.status === "stun" || effect.status === "freeze") {
    return dealPlayerTypedHit(state, effect.status, amount, combatTexts);
  }
  const nextState = addEnemyStatus(state, effect.status, amount);
  const appliedAmount = nextState.enemyStatuses[effect.status] - state.enemyStatuses[effect.status];
  mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: effect.status, amount: appliedAmount });

  return nextState;
});

export const applyRemoveHarmfulStatusEffect = defineHandler(
  "remove-harmful-status",
  (state, _card, effect, potionMult, combatTexts) => {
    const adjustedRemove = effect.removeAll
      ? Number.POSITIVE_INFINITY
      : applyPotionMultiplier(effect.amount, potionMult);
    return removeHarmfulPlayerStatuses(state, adjustedRemove, combatTexts);
  },
);

export const applyRemovePlayerStatusEffect = defineHandler(
  "remove-player-status",
  (state, _card, effect, _potionMult, combatTexts) => {
    if (state.playerStatuses[effect.status] <= 0) return state;
    return applyCleanseHeals(zeroPlayerStatus(state, effect.status), combatTexts);
  },
);

export const applyMultiplyEnemyStatusEffect = defineHandler(
  "multiply-enemy-status",
  (state, _card, effect, _potionMult, combatTexts) => {
    const current = state.enemyStatuses[effect.status];
    if (current <= 0) return state;

    const nextState = addEnemyStatus(state, effect.status, current * (effect.factor - 1));
    mergeCombatText(combatTexts, {
      target: "enemy",
      kind: "multiply",
      stat: effect.status,
      amount: nextState.enemyStatuses[effect.status] - current,
    });

    return resolveEnemyStatusCcTrigger(state, nextState, effect.status, combatTexts);
  },
);

export const applyCleansePlayerStatusToDamageEffect = defineHandler(
  "cleanse-player-status-to-damage",
  (state, card, effect, potionMult, combatTexts) => {
    const stacks = state.playerStatuses[effect.status];
    if (stacks <= 0) return state;

    const cleansed = applyCleanseHeals(zeroPlayerStatus(state, effect.status), combatTexts);
    const amount = applyPotionMultiplier(stacks, potionMult);

    return dealDamageToEnemy(cleansed, card, { kind: "damage", damageType: effect.damageType, amount }, combatTexts);
  },
);
