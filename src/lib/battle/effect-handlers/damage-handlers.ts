// Damage-related card effect apply handlers.
import { DAMAGE_TYPES } from "@/lib/game-data";
import { dealDamageToEnemy } from "../damage";
import { getBattleRng } from "../status-helpers";
import { addPlayerStatus, applyPlayerCombatDamage } from "../types";
import { mergeCombatText } from "../combat-text";
import type { EffectHandler } from "./handler-types";

export const applyDamageEffect: EffectHandler = (state, card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "damage") return state;
  const adjustedEffect = potionMult !== 1 ? { ...effect, amount: Math.round(effect.amount * potionMult) } : effect;
  return dealDamageToEnemy(state, card, adjustedEffect, combatTexts);
};

export const applySelfDamageEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "self-damage") return state;
  const postDamage = applyPlayerCombatDamage(state, effect.amount);
  const healthLost = state.playerHealth - postDamage.playerHealth;
  if (healthLost > 0) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "damage",
      stat: effect.damageType,
      amount: healthLost,
    });
  }
  return addPlayerStatus(postDamage, effect.damageType, Math.max(0, healthLost));
};

export const applyRandomDamageEffect: EffectHandler = (state, card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "random-damage") return state;
  const rng = getBattleRng(state);
  const damageType = DAMAGE_TYPES[Math.trunc(rng() * DAMAGE_TYPES.length)]!;
  const span = effect.maxAmount - effect.minAmount + 1;
  const amount = effect.minAmount + Math.trunc(rng() * span);
  return dealDamageToEnemy(state, card, { kind: "damage", damageType, amount }, combatTexts);
};

export const applyRemoveEnemyArmorEffect: EffectHandler = (state, _card, effect) => {
  if (effect.kind !== "remove-enemy-armor") return state;
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      armor: Math.max(0, state.enemyMitigation.armor - effect.amount),
    },
  };
};
