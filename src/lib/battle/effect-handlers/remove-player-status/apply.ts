import { applyHealingWithCombatText } from "../../combat-text";
import type { BattleState } from "../../types";
import type { EffectHandler } from "../handler-types";

export const applyRemovePlayerStatusEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "remove-player-status") return state;
  if (state.playerStatuses[effect.status] <= 0) return state;
  let nextState: BattleState = {
    ...state,
    playerStatuses: { ...state.playerStatuses, [effect.status]: 0 },
  };
  nextState = applyHealingWithCombatText(
    nextState,
    nextState.trinketEffects.sinEaterHealOnHarmfulStatusRemove,
    combatTexts,
  );
  nextState = applyHealingWithCombatText(nextState, nextState.talentEffects.healOnStatusCleanse, combatTexts);
  return nextState;
};
