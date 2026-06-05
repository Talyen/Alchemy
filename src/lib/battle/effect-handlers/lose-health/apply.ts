import { applyPlayerCombatDamage } from "../../types";
import { mergeCombatText } from "../../combat-text";
import type { EffectHandler } from "../handler-types";

export const applyLoseHealthEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "lose-health") return state;
  const postDamage = applyPlayerCombatDamage(state, effect.amount);
  const healthLost = state.playerHealth - postDamage.playerHealth;
  if (healthLost > 0) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "damage",
      stat: "health",
      amount: healthLost,
    });
  }
  return postDamage;
};
