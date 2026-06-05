import { dealDamageToEnemy } from "../../damage";
import type { EffectHandler } from "../handler-types";

export const applyDamageEffect: EffectHandler = (state, card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "damage") return state;
  const adjustedEffect = potionMult !== 1 ? { ...effect, amount: Math.round(effect.amount * potionMult) } : effect;
  return dealDamageToEnemy(state, card, adjustedEffect, combatTexts);
};
