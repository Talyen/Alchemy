import type { EffectHandler } from "../handler-types";

export const applyBuffCompanionEffect: EffectHandler = (state, _card, effect) => {
  if (effect.kind !== "buff-companion") return state;
  return { ...state, companionDamageBuff: state.companionDamageBuff + effect.amount };
};
