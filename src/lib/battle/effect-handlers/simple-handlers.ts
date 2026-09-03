import type { BattleCardEffect } from "@/lib/game-data";
import type { BattleState } from "../types";
import { companionLibrary } from "@/lib/game-data";
import { applyPotionMultiplier } from "../amount-helpers";
import { addGoldWithCombatText } from "../combat-text";
import { applyWishEffect } from "../wish";
import { drawFromState, applyDrawResult } from "../draw";
import { defineHandler } from "./handler-types";

export const applySummonCompanionEffect = defineHandler(
  "summon-companion",
  (state, _card, effect, _potionMult, _combatTexts) => {
    let nextState: BattleState = { ...state, activeCompanion: companionLibrary[effect.companionId] };
    if (state.talentEffects.drawOnCompanionCard > 0) {
      nextState = applyDrawResult(nextState, drawFromState(nextState, state.talentEffects.drawOnCompanionCard));
    }
    return nextState;
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

export const applyDrawCardsEffect = defineHandler("draw-cards", (state, _card, effect) => {
  return applyDrawResult(state, drawFromState(state, effect.amount));
});

const FLAG_EFFECTS = {
  "next-hit-crit": "nextHitCrit",
  "play-next-card-twice": "playNextCardTwice",
  "next-hit-poison": "nextHitPoison",
} as const satisfies Record<
  Extract<BattleCardEffect["kind"], `next-hit-${string}` | "play-next-card-twice">,
  keyof BattleState["flags"]
>;

function makeFlagHandler<K extends keyof typeof FLAG_EFFECTS>(kind: K): ReturnType<typeof defineHandler<K>> {
  const flag = FLAG_EFFECTS[kind];
  return defineHandler(kind, (state) => {
    return { ...state, flags: { ...state.flags, [flag]: true } };
  });
}

export const applyNextHitCritEffect = makeFlagHandler("next-hit-crit");
export const applyPlayNextCardTwiceEffect = makeFlagHandler("play-next-card-twice");
export const applyNextHitPoisonEffect = makeFlagHandler("next-hit-poison");

export const applyNextArcheryFreeEffect = defineHandler("next-archery-free", (state) => {
  return { ...state, flags: { ...state.flags, nextArcheryCardFree: true } };
});
