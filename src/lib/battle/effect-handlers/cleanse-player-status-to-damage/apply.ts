import { dealDamageToEnemy } from "../../damage";
import { applyHealingWithCombatText } from "../../combat-text";
import type { BattleState } from "../../types";
import type { EffectHandler } from "../handler-types";

export const applyCleansePlayerStatusToDamageEffect: EffectHandler = (
  state,
  card,
  effect,
  _potionMult,
  combatTexts,
) => {
  if (effect.kind !== "cleanse-player-status-to-damage") return state;
  const stacks = state.playerStatuses[effect.status];
  if (stacks <= 0) return state;

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

  return dealDamageToEnemy(
    nextState,
    card,
    { kind: "damage", damageType: effect.damageType, amount: stacks },
    combatTexts,
  );
};
