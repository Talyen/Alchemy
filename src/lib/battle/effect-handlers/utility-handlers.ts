import type { BattleCardEffect } from "@/lib/game-data";
import type { BattleState } from "../types";
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

function makeFlagEffect<K extends BattleCardEffect["kind"], F extends keyof BattleState["flags"]>(
  kind: K,
  flag: F,
): EffectHandler {
  return (state, _card, effect) => {
    if (effect.kind !== kind) return state;
    return { ...state, flags: { ...state.flags, [flag]: true } };
  };
}

export const applyNextHitCritEffect = makeFlagEffect("next-hit-crit", "nextHitCrit");
export const applyPlayNextCardTwiceEffect = makeFlagEffect("play-next-card-twice", "playNextCardTwice");
export const applyNextHitPoisonEffect = makeFlagEffect("next-hit-poison", "nextHitPoison");
