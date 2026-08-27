// Utility card effect apply handlers.
import { applyPotionMultiplier } from "../amount-helpers";
import { addGoldWithCombatText } from "../combat-text";
import { applyWishEffect } from "../wish";
import { drawFromState, applyDrawResult } from "../draw";
import type { EffectHandler } from "./handler-types";

export const applyGainGoldEffect: EffectHandler = (state, _card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "gain-gold") return state;
  const adjustedGold = applyPotionMultiplier(effect.amount, potionMult);
  return addGoldWithCombatText(state, adjustedGold, combatTexts);
};

export const applyWishEffectHandler: EffectHandler = (state, card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "wish") return state;
  const adjustedWish = applyPotionMultiplier(effect.amount, potionMult);
  return applyWishEffect(state, card, adjustedWish, combatTexts);
};

export const applyDrawCardsEffect: EffectHandler = (state, _card, effect) => {
  if (effect.kind !== "draw-cards") return state;
  return applyDrawResult(state, drawFromState(state, effect.amount));
};

export const applyNextHitCritEffect: EffectHandler = (state, _card, effect) => {
  if (effect.kind !== "next-hit-crit") return state;
  return { ...state, flags: { ...state.flags, nextHitCrit: true } };
};

export const applyPlayNextCardTwiceEffect: EffectHandler = (state, _card, effect) => {
  if (effect.kind !== "play-next-card-twice") return state;
  return { ...state, flags: { ...state.flags, playNextCardTwice: true } };
};

export const applyNextHitPoisonEffect: EffectHandler = (state, _card, effect) => {
  if (effect.kind !== "next-hit-poison") return state;
  return { ...state, flags: { ...state.flags, nextHitPoison: true } };
};
