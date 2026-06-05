import { applyHealingWithCombatText } from "../../combat-text";
import type { EffectHandler } from "../handler-types";

export const applyHealEffect: EffectHandler = (state, card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "heal") return state;
  const adjustedHeal = Math.round(effect.amount * potionMult);
  const consumeBonus = card.consume ? (state.talentEffects.consumeHealMultiplier ?? 0) : 0;
  const healAmount = Math.round(adjustedHeal * (state.talentEffects.healMultiplier + consumeBonus));
  return applyHealingWithCombatText(state, healAmount, combatTexts);
};
