// Companion card effect apply handlers.
import { companionLibrary } from "@/lib/game-data";
import type { EffectHandler } from "./handler-types";

export const applySummonCompanionEffect: EffectHandler = (state, _card, effect) => {
  if (effect.kind !== "summon-companion") return state;
  return { ...state, activeCompanion: companionLibrary[effect.companionId] };
};

export const applyBuffCompanionEffect: EffectHandler = (state, _card, effect) => {
  if (effect.kind !== "buff-companion") return state;
  return { ...state, companionDamageBuff: state.companionDamageBuff + effect.amount };
};
