import { restoreMana } from "../mana/internal";
import type { EffectHandler } from "../handler-types";

export const applyRestoreManaEffect: EffectHandler = (state, _card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "restore-mana") return state;
  return restoreMana(state, effect.amount, potionMult, combatTexts);
};
