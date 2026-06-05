import { applyPlayerStatusEffect } from "../../status-effects";
import type { EffectHandler } from "../handler-types";

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
