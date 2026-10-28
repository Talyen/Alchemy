import type { EffectHandlers } from "./handler-types";
import { resolveConditionalCardDamage } from "../conditional-card-damage";
import { checkHealthThresholds } from "../status-player";
import { DAMAGE_TYPES, harmfulPlayerStatusIds } from "@/lib/game-data";
import { getBattleRng, pickRandom, rngInt } from "@/lib/rng";
import { applyPotionMultiplier, scalePercent } from "../amount-helpers";
import { dealDamageToEnemy } from "../damage";
import { dealSelfDamage, mitigatePlayerStatusDamage } from "../status-helpers";
import { addPlayerStatus, setPlayerStatus } from "../status-state";
import { applyBlockDepletionRewards } from "../player-rewards";
import { resolvePendingBattleReactions } from "../enemy-attack-damage";
import { emitDamageText } from "../combat-text-events";
import { rangeBoundsError } from "./simple-handlers";
import { resolvePlayerCrowdControlTriggers } from "../status-cc";

export const DAMAGE_HANDLERS = {
  damage: (state, card, effect, potionMult, combatTexts, context) => {
    const descriptionDamage = state.observer ? { effect, potionMultiplier: potionMult } : undefined;
    effect = resolveConditionalCardDamage(effect, state.enemyCC.freezeSkipTurns > 0);
    if (effect.spendBlock && effect.equalToBlock) {
      const block = state.playerStatuses.block;
      const spent = Math.min(block, Math.max(0, scalePercent(block, effect.equalToBlockPercent ?? 100)));
      const before = state;
      state = setPlayerStatus(state, "block", block - spent);
      if (spent > 0) emitDamageText(combatTexts, "player", "block", spent, { impact: false, feedback: "secondary" });
      state = resolvePendingBattleReactions(applyBlockDepletionRewards(before, state, combatTexts), combatTexts);
      // Pay before Dodge/mitigation. Recorded hit echoes retain the paid amount,
      // while a full card replay grants and spends Block again.
      const { spendBlock: _spend, equalToBlock: _equal, equalToBlockPercent: _percent, ...hit } = effect;
      effect = { ...hit, amount: spent };
    }
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
    return dealDamageToEnemy(
      state,
      card,
      adjustedEffect,
      combatTexts,
      descriptionDamage ? { manaAtStart: state.mana, ...context, descriptionDamage } : context,
    );
  },
  "self-damage": (state, _card, effect, _potionMult, combatTexts) => {
    state.observer?.descriptionMagnitude?.(
      "amount",
      mitigatePlayerStatusDamage(state, effect.amount, effect.damageType),
    );
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
