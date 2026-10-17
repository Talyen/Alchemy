import type { EffectHandlers } from "./handler-types";
import { resolveConditionalCardDamage } from "../conditional-card-damage";
import { checkHealthThresholds } from "../status-player";
import { DAMAGE_TYPES, harmfulPlayerStatusIds } from "@/lib/game-data";
import { getBattleRng, pickRandom, rngInt } from "@/lib/rng";
import { applyPotionMultiplier } from "../amount-helpers";
import { dealDamageToEnemy } from "../damage";
import { dealSelfDamage } from "../status-helpers";
import { addPlayerStatus } from "../status-state";
import { rangeBoundsError } from "./simple-handlers";
import { resolvePlayerCrowdControlTriggers } from "../status-cc";

export const DAMAGE_HANDLERS = {
  damage: (state, card, effect, potionMult, combatTexts, context) => {
    effect = resolveConditionalCardDamage(effect, state.enemyCC.freezeSkipTurns > 0);
    let damageType = effect.damageType;
    if (effect.damageTypePool && effect.damageTypePool.length > 0) {
      const picked = pickRandom(effect.damageTypePool, getBattleRng(state));
      if (picked) damageType = picked;
    }
    const adjustedEffect = {
      ...effect,
      damageType,
      amount: applyPotionMultiplier(effect.amount, potionMult),
    };
    return dealDamageToEnemy(state, card, adjustedEffect, combatTexts, context);
  },
  "self-damage": (state, _card, effect, _potionMult, combatTexts) => {
    const {
      state: postDamage,
      healthLost,
      healthAfterDamage,
    } = dealSelfDamage(state, effect.amount, effect.damageType, combatTexts);
    const statusType = harmfulPlayerStatusIds.find((id) => id === effect.damageType);
    const withStatus = statusType && healthLost > 0 ? addPlayerStatus(postDamage, statusType, healthLost) : postDamage;
    const thresholded = checkHealthThresholds(state.playerHealth, healthAfterDamage, withStatus, combatTexts);
    return resolvePlayerCrowdControlTriggers(thresholded, combatTexts);
  },
  "random-damage": (state, card, effect, potionMult, combatTexts, context) => {
    if (effect.maxAmount < effect.minAmount) {
      throw rangeBoundsError("random-damage");
    }
    const rng = getBattleRng(state);
    const damageType =
      pickRandom(effect.damageTypePool?.length ? effect.damageTypePool : DAMAGE_TYPES, rng) ??
      (() => {
        throw new Error("[Battle] random-damage type pool is empty");
      })();

    const span = effect.maxAmount - effect.minAmount + 1;
    const rolled = effect.minAmount + rngInt(rng, span);
    const amount = applyPotionMultiplier(rolled, potionMult);
    return dealDamageToEnemy(
      state,
      card,
      { kind: "damage", damageType, amount, ...(effect.lifesteal ? { lifesteal: true } : {}) },
      combatTexts,
      context,
    );
  },
} satisfies Partial<EffectHandlers>;
