import { mergeCombatText } from "../../combat-text";
import { addGold } from "../../types";
import type { EffectHandler } from "../handler-types";

export const applyGainGoldEffect: EffectHandler = (state, _card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "gain-gold") return state;
  const adjustedGold = Math.round(effect.amount * potionMult);
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: adjustedGold });
  return addGold(state, adjustedGold);
};
