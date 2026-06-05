import { addPlayerStatus, applyPlayerCombatDamage } from "../../types";
import { mergeCombatText } from "../../combat-text";
import type { EffectHandler } from "../handler-types";

export const applySelfDamageEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "self-damage") return state;
  const postDamage = applyPlayerCombatDamage(state, effect.amount);
  const healthLost = state.playerHealth - postDamage.playerHealth;
  if (healthLost > 0) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "damage",
      stat: effect.damageType,
      amount: healthLost,
    });
  }
  return addPlayerStatus(postDamage, effect.damageType, effect.amount);
};
