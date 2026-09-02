import { DAMAGE_TYPES } from "@/lib/game-data";
import { rngInt } from "@/lib/run-rng";
import { applyPotionMultiplier } from "../amount-helpers";
import { dealDamageToEnemy } from "../damage";
import { dealSelfDamage } from "../status-helpers";
import { getBattleRng } from "../../rng";
import { addPlayerStatus, reduceEnemyArmor } from "../types";
import { defineHandler } from "./handler-types";

export const applyDamageEffect = defineHandler("damage", (state, card, effect, potionMult, combatTexts) => {
  const adjustedEffect =
    potionMult !== 1 ? { ...effect, amount: applyPotionMultiplier(effect.amount, potionMult) } : effect;
  return dealDamageToEnemy(state, card, adjustedEffect, combatTexts);
});

export const applySelfDamageEffect = defineHandler("self-damage", (state, _card, effect, _potionMult, combatTexts) => {
  const { state: postDamage, healthLost } = dealSelfDamage(state, effect.amount, effect.damageType, combatTexts);
  return addPlayerStatus(postDamage, effect.damageType, healthLost);
});

export const applyRandomDamageEffect = defineHandler(
  "random-damage",
  (state, card, effect, potionMult, combatTexts) => {
    const rng = getBattleRng(state);
    const damageType = DAMAGE_TYPES[rngInt(rng, DAMAGE_TYPES.length)]!;

    const span = Math.max(1, effect.maxAmount - effect.minAmount + 1);
    const rolled = effect.minAmount + rngInt(rng, span);
    const amount = applyPotionMultiplier(rolled, potionMult);
    return dealDamageToEnemy(state, card, { kind: "damage", damageType, amount }, combatTexts);
  },
);

export const applyRemoveEnemyArmorEffect = defineHandler("remove-enemy-armor", (state, _card, effect) => {
  return reduceEnemyArmor(state, effect.amount);
});
