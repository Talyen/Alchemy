import { drawCards } from "../../draw";
import type { EffectHandler } from "../handler-types";

export const applyDrawCardsEffect: EffectHandler = (state, _card, effect) => {
  if (effect.kind !== "draw-cards") return state;
  const draw = drawCards(state.deck, state.discard, state.hand, effect.amount, state.nextCardUid, state.rng);
  return {
    ...state,
    deck: draw.deck,
    discard: draw.discard,
    hand: draw.hand,
    nextCardUid: draw.nextCardUid,
  };
};
