import { loseMaxMana } from "../mana/internal";
import type { EffectHandler } from "../handler-types";

export const applyLoseMaxManaEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "lose-max-mana") return state;
  return loseMaxMana(state, effect.amount, combatTexts);
};
