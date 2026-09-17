import type { BattleCardEffect } from "@/lib/game-data";
import type { BattleState } from "../types";
import type { EffectHandler } from "./handler-types";
import { companionLibrary } from "@/lib/game-data";
import { applyPotionMultiplier } from "../amount-helpers";
import { addGoldWithCombatText } from "../combat-text";
import { applyWishEffect } from "../wish";
import { drawFromState, applyDrawResult } from "../draw";
import { defineHandler } from "./handler-types";
import { getBattleRng, rngInt } from "@/lib/rng";

const RANGE_BOUNDS_MESSAGE = "maxAmount must be >= minAmount";

export function rangeBoundsError(kind: string): Error {
  return new Error(`[Battle] ${kind} ${RANGE_BOUNDS_MESSAGE}`);
}

export const applyRandomDrawEffect = defineHandler("random-draw", (state, _card, effect, potionMult) => {
  if (effect.maxAmount < effect.minAmount) throw rangeBoundsError("random-draw");
  const amount = effect.minAmount + rngInt(getBattleRng(state), effect.maxAmount - effect.minAmount + 1);
  return applyDrawResult(state, drawFromState(state, applyPotionMultiplier(amount, potionMult)));
});

export const applySummonCompanionEffect = defineHandler(
  "summon-companion",
  (state, _card, effect, _potionMult, _combatTexts) => {
    return { ...state, activeCompanion: companionLibrary[effect.companionId] };
  },
);

export const applyBuffCompanionEffect = defineHandler("buff-companion", (state, _card, effect) => {
  return { ...state, companionDamageBuff: state.companionDamageBuff + effect.amount };
});

export const applyGainGoldEffect = defineHandler("gain-gold", (state, _card, effect, potionMult, combatTexts) => {
  if (effect.ifEnemyStunned && state.enemyCC.stunSkipTurns <= 0) {
    return state;
  }
  const adjustedGold = applyPotionMultiplier(effect.amount, potionMult);
  return addGoldWithCombatText(state, adjustedGold, combatTexts);
});

export const applyWishEffectHandler = defineHandler("wish", (state, card, effect, potionMult, combatTexts) => {
  const adjustedWish = applyPotionMultiplier(effect.amount, potionMult);
  return applyWishEffect(state, card, adjustedWish, combatTexts);
});

export const applyDrawCardsEffect = defineHandler("draw-cards", (state, _card, effect, potionMult) => {
  return applyDrawResult(state, drawFromState(state, applyPotionMultiplier(effect.amount, potionMult)));
});

const FLAG_EFFECTS = {
  "next-hit-crit": "nextHitCrit",
  "next-hit-leech": "nextHitLeech",
  "play-next-card-twice": "playNextCardTwice",
  "next-hit-poison": "nextHitPoison",
  "next-archery-free": "nextArcheryCardFree",
} as const satisfies Record<
  Extract<BattleCardEffect["kind"], `next-hit-${string}` | "play-next-card-twice" | "next-archery-free">,
  keyof BattleState["flags"]
>;

export type FlagEffectKind = keyof typeof FLAG_EFFECTS;

function makeFlagHandler<K extends FlagEffectKind>(kind: K): ReturnType<typeof defineHandler<K>> {
  const flag = FLAG_EFFECTS[kind];
  return defineHandler(kind, (state) => {
    return { ...state, flags: { ...state.flags, [flag]: true } };
  });
}

export const FLAG_HANDLERS: Record<FlagEffectKind, EffectHandler> = {
  "next-hit-crit": makeFlagHandler("next-hit-crit"),
  "next-hit-leech": makeFlagHandler("next-hit-leech"),
  "play-next-card-twice": makeFlagHandler("play-next-card-twice"),
  "next-hit-poison": makeFlagHandler("next-hit-poison"),
  "next-archery-free": makeFlagHandler("next-archery-free"),
};

// Named aliases kept for direct unit tests; new code should use FLAG_HANDLERS.
export const applyNextHitCritEffect = FLAG_HANDLERS["next-hit-crit"];
export const applyNextHitLeechEffect = FLAG_HANDLERS["next-hit-leech"];
export const applyPlayNextCardTwiceEffect = FLAG_HANDLERS["play-next-card-twice"];
export const applyNextHitPoisonEffect = FLAG_HANDLERS["next-hit-poison"];
export const applyNextArcheryFreeEffect = FLAG_HANDLERS["next-archery-free"];
