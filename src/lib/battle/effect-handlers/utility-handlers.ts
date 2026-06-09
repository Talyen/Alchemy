// Utility card effect apply handlers.
import { mergeCombatText } from "../combat-text";
import { addGold } from "../types";
import { applyWishEffect } from "../wish";
import { drawCards } from "../draw";
import type { EffectHandler } from "./handler-types";

export const applyGainGoldEffect: EffectHandler = (state, _card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "gain-gold") return state;
  const adjustedGold = Math.round(effect.amount * potionMult);
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: adjustedGold });
  return addGold(state, adjustedGold);
};

export const applyWishEffectHandler: EffectHandler = (state, card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "wish") return state;
  const adjustedWish = Math.round(effect.amount * potionMult);
  return applyWishEffect(state, card, adjustedWish, combatTexts);
};

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
