import { removeHarmfulPlayerStatuses } from "../../status-effects";
import type { EffectHandler } from "../handler-types";

export const applyRemoveHarmfulStatusEffect: EffectHandler = (state, _card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "remove-harmful-status") return state;
  const adjustedRemove = Math.round(effect.amount * potionMult);
  return removeHarmfulPlayerStatuses(state, adjustedRemove, combatTexts);
};
