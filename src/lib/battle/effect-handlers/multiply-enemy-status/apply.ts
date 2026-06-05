import { adjustEnemyStatusDelta } from "../../types";
import { mergeCombatText } from "../../combat-text";
import type { EffectHandler } from "../handler-types";

export const applyMultiplyEnemyStatusEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "multiply-enemy-status") return state;
  const current = state.enemyStatuses[effect.status];
  if (current <= 0) return state;
  const added = adjustEnemyStatusDelta(state, current * (effect.factor - 1));
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "multiply",
    stat: effect.status,
    amount: added,
  });
  return {
    ...state,
    enemyStatuses: { ...state.enemyStatuses, [effect.status]: current + added },
  };
};
