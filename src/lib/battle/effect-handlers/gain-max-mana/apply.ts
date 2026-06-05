import { gainMaxMana } from "../mana/internal";
import type { EffectHandler } from "../handler-types";

export const applyGainMaxManaEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "gain-max-mana") return state;
  return gainMaxMana(state, effect.amount, combatTexts);
};
