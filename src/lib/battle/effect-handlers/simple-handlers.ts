import type { EffectHandlers } from "./handler-types";
import { applyPotionMultiplier } from "../amount-helpers";
import { mergeCombatText } from "../combat-text-events";
import { applyEmergencyWishForEmptyDraw, applyWishEffect } from "../wish";
import { resolvePendingBattleReactions } from "../enemy-attack-damage";
import { drawFromState, applyDrawResult } from "../draw";
import { getBattleRng, rngInt } from "@/lib/rng";

const RANGE_BOUNDS_MESSAGE = "maxAmount must be >= minAmount";

export function rangeBoundsError(kind: string): Error {
  return new Error(`[Battle] ${kind} ${RANGE_BOUNDS_MESSAGE}`);
}

export const SIMPLE_HANDLERS = {
  "random-draw": (state, _card, effect, potionMult, combatTexts) => {
    if (effect.maxAmount < effect.minAmount) throw rangeBoundsError("random-draw");
    const amount = effect.minAmount + rngInt(getBattleRng(state), effect.maxAmount - effect.minAmount + 1);
    const scaledAmount = applyPotionMultiplier(amount, potionMult);
    const next = applyDrawResult(state, drawFromState(state, scaledAmount), combatTexts);
    return applyEmergencyWishForEmptyDraw(next, scaledAmount, combatTexts);
  },
  wish: (state, card, effect, potionMult, combatTexts) => {
    if (effect.companionIfAbsent && state.activeCompanion) return state;
    const adjustedWish = applyPotionMultiplier(effect.amount, potionMult);
    if (adjustedWish > 0) mergeCombatText(combatTexts, { target: "player", kind: "notice", stat: "wish", text: "" });
    return applyWishEffect(
      state,
      card,
      adjustedWish,
      combatTexts,
      {
        kind: "each-step",
        settle: resolvePendingBattleReactions,
      },
      effect.companionIfAbsent === true,
    );
  },
  "draw-cards": (state, _card, effect, potionMult, combatTexts) => {
    const amount = applyPotionMultiplier(effect.amount, potionMult);
    const next = applyDrawResult(state, drawFromState(state, amount), combatTexts);
    return applyEmergencyWishForEmptyDraw(next, amount, combatTexts);
  },
} satisfies Partial<EffectHandlers>;
