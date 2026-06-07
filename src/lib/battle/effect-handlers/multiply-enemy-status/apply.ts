import { adjustEnemyStatusDelta, setEnemyStatus } from "../../types";
import { mergeCombatText } from "../../combat-text";
import type { EffectHandler } from "../handler-types";
import { tryTriggerEnemyFreeze, resolveStunTrigger } from "../../status-effects";

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

  let nextState = setEnemyStatus(state, effect.status, current + added);

  if (effect.status === "freeze") {
    nextState = tryTriggerEnemyFreeze(state, nextState, combatTexts);
  } else if (effect.status === "stun") {
    nextState = resolveStunTrigger(nextState, combatTexts);
  }

  return nextState;
};
