import { applyWishEffect } from "../../wish";
import type { EffectHandler } from "../handler-types";

export const applyWishEffectHandler: EffectHandler = (state, card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "wish") return state;
  const adjustedWish = Math.round(effect.amount * potionMult);
  return applyWishEffect(state, card, adjustedWish, combatTexts);
};
