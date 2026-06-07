import { addEnemyStatus } from "../../types";
import { mergeCombatText } from "../../combat-text";
import type { EffectHandler } from "../handler-types";
import { tryTriggerEnemyFreeze, resolveStunTrigger } from "../../status-effects";

export const applyEnemyStatusEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "enemy-status") return state;
  let nextState = addEnemyStatus(state, effect.status, effect.amount);
  const appliedAmount = nextState.enemyStatuses[effect.status] - state.enemyStatuses[effect.status];
  mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: effect.status, amount: appliedAmount });

  if (effect.status === "freeze") {
    nextState = tryTriggerEnemyFreeze(state, nextState, combatTexts);
  } else if (effect.status === "stun") {
    nextState = resolveStunTrigger(nextState, combatTexts);
  }
  return nextState;
};
