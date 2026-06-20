// Companion card effect apply handlers.
import type { BattleState } from "../types";
import { companionLibrary } from "@/lib/game-data";
import type { EffectHandler } from "./handler-types";
import { drawCards } from "../draw";

export const applySummonCompanionEffect: EffectHandler = (state, _card, effect, _potionMult, _combatTexts) => {
  if (effect.kind !== "summon-companion") return state;
  let nextState: BattleState = { ...state, activeCompanion: companionLibrary[effect.companionId] };
  if (state.talentEffects.drawOnCompanionCard > 0) {
    const draw = drawCards(
      nextState.deck,
      nextState.discard,
      nextState.hand,
      state.talentEffects.drawOnCompanionCard,
      nextState.nextCardUid,
      nextState.rng,
    );
    nextState = {
      ...nextState,
      deck: draw.deck,
      discard: draw.discard,
      hand: draw.hand,
      nextCardUid: draw.nextCardUid,
    };
  }
  return nextState;
};

export const applyBuffCompanionEffect: EffectHandler = (state, _card, effect) => {
  if (effect.kind !== "buff-companion") return state;
  return { ...state, companionDamageBuff: state.companionDamageBuff + effect.amount };
};
