import { DAMAGE_TYPES } from "@/lib/game-data";
import { rngInt } from "@/lib/run-rng";
import { applyPotionMultiplier } from "../amount-helpers";
import { dealDamageToEnemy } from "../damage";
import { dealSelfDamage, getBattleRng } from "../status-helpers";
import { addPlayerStatus, reduceEnemyArmor } from "../types";
import type { EffectHandler } from "./handler-types";

export const applyDamageEffect: EffectHandler = (state, card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "damage") return state;
  const adjustedEffect =
    potionMult !== 1 ? { ...effect, amount: applyPotionMultiplier(effect.amount, potionMult) } : effect;
  return dealDamageToEnemy(state, card, adjustedEffect, combatTexts);
};

export const applySelfDamageEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "self-damage") return state;
  const { state: postDamage, healthLost } = dealSelfDamage(state, effect.amount, effect.damageType, combatTexts);
  return addPlayerStatus(postDamage, effect.damageType, healthLost);
};

export const applyRandomDamageEffect: EffectHandler = (state, card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "random-damage") return state;
  const rng = getBattleRng(state);
  const damageType = DAMAGE_TYPES[rngInt(rng, DAMAGE_TYPES.length)]!;

  const span = Math.max(1, effect.maxAmount - effect.minAmount + 1);
  const rolled = effect.minAmount + rngInt(rng, span);
  const amount = applyPotionMultiplier(rolled, potionMult);
  return dealDamageToEnemy(state, card, { kind: "damage", damageType, amount }, combatTexts);
};

export const applyRemoveEnemyArmorEffect: EffectHandler = (state, _card, effect) => {
  if (effect.kind !== "remove-enemy-armor") return state;
  return reduceEnemyArmor(state, effect.amount);
};
