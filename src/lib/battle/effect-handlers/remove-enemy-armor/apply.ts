import type { EffectHandler } from "../handler-types";

export const applyRemoveEnemyArmorEffect: EffectHandler = (state, _card, effect) => {
  if (effect.kind !== "remove-enemy-armor") return state;
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      armor: Math.max(0, state.enemyMitigation.armor - effect.amount),
    },
  };
};
