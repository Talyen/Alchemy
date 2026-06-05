import { addEnemyStatus, adjustEnemyStatusDelta } from "../../types";
import { mergeCombatText } from "../../combat-text";
import type { EffectHandler } from "../handler-types";

export const applyEnemyStatusEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "enemy-status") return state;
  const adjustedDelta = adjustEnemyStatusDelta(state, effect.amount);
  mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: effect.status, amount: adjustedDelta });
  return addEnemyStatus(state, effect.status, effect.amount);
};
