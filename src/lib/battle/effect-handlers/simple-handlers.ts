import { writeCombatFlag } from "../action-context";
import type { BattleCardEffect } from "@/lib/game-data";
import type { BattleState } from "../types";
import type { EffectHandlers, EffectHandler } from "./handler-types";
import { companionLibrary } from "@/lib/game-data";
import { applyPotionMultiplier } from "../amount-helpers";
import { mergeCombatText } from "../combat-text-events";
import { addGoldWithCombatText, applyBlockReward } from "../player-rewards";
import { applyEmergencyWishForEmptyDraw, applyWishEffect } from "../wish";
import { resolvePendingBattleReactions } from "../enemy-attack-damage";
import { drawFromState, applyDrawResult } from "../draw";
import { getBattleRng, rngInt } from "@/lib/rng";

const RANGE_BOUNDS_MESSAGE = "maxAmount must be >= minAmount";

export function rangeBoundsError(kind: string): Error {
  return new Error(`[Battle] ${kind} ${RANGE_BOUNDS_MESSAGE}`);
}

const FLAG_EFFECTS = {
  "next-hit-crit": "nextHitCrit",
  "next-hit-leech": "nextHitLeech",
  "play-next-card-twice": "playNextCardTwice",
  "next-hit-poison": "nextHitPoison",
  "next-archery-free": "nextArcheryCardFree",
  "dodge-next-attack": "dodgeNextAttack",
} as const satisfies Record<
  Extract<
    BattleCardEffect["kind"],
    `next-hit-${string}` | "play-next-card-twice" | "next-archery-free" | "dodge-next-attack"
  >,
  keyof BattleState["flags"]
>;

type FlagEffectKind = keyof typeof FLAG_EFFECTS;

const applyFlagEffect = ((state, _card, effect, _potionMult, combatTexts) => {
  const flag = FLAG_EFFECTS[effect.kind];
  mergeCombatText(combatTexts, { target: "player", kind: "notice", stat: flag, signal: "prepared", text: "" });
  return writeCombatFlag(state, flag, true);
}) satisfies EffectHandler<FlagEffectKind>;

const FLAG_HANDLERS = {
  "next-hit-crit": applyFlagEffect,
  "next-hit-leech": applyFlagEffect,
  "play-next-card-twice": applyFlagEffect,
  "next-hit-poison": applyFlagEffect,
  "next-archery-free": applyFlagEffect,
  "dodge-next-attack": applyFlagEffect,
} satisfies Pick<EffectHandlers, FlagEffectKind>;

export const SIMPLE_HANDLERS = {
  "random-draw": (state, _card, effect, potionMult, combatTexts) => {
    if (effect.maxAmount < effect.minAmount) throw rangeBoundsError("random-draw");
    const amount = effect.minAmount + rngInt(getBattleRng(state), effect.maxAmount - effect.minAmount + 1);
    const next = applyDrawResult(state, drawFromState(state, applyPotionMultiplier(amount, potionMult)), combatTexts);
    return applyEmergencyWishForEmptyDraw(next, amount, combatTexts);
  },
  "summon-companion": (state, _card, effect, _potionMult, combatTexts) => {
    mergeCombatText(combatTexts, { target: "player", kind: "notice", stat: "companion", text: "" });
    const summoned = { ...state, activeCompanion: companionLibrary[effect.companionId] };
    return summoned.gearEffects.blockOnCompanionSummon > 0
      ? applyBlockReward(summoned, summoned.gearEffects.blockOnCompanionSummon, combatTexts)
      : summoned;
  },
  "buff-companion": (state, _card, effect, _potionMult, combatTexts) => {
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "companion", amount: effect.amount });
    return { ...state, companionDamageBuff: state.companionDamageBuff + effect.amount };
  },
  "gain-gold": (state, _card, effect, potionMult, combatTexts) => {
    if (effect.ifEnemyStunned && state.enemyCC.stunSkipTurns <= 0) {
      return state;
    }
    const adjustedGold = applyPotionMultiplier(effect.amount, potionMult);
    return addGoldWithCombatText(state, adjustedGold, combatTexts);
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
  ...FLAG_HANDLERS,
} satisfies Partial<EffectHandlers>;
