import { loseMana } from "../mana/internal";
import type { EffectHandler } from "../handler-types";

export const applyLoseManaEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "lose-mana") return state;
  return loseMana(state, effect.amount, combatTexts);
};
