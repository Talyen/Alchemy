import type { EffectHandler } from "./handler-types";
import { resolveConditionalCardDamage } from "../conditional-card-damage";
import { mergeCombatText } from "../combat-text";
import { setPlayerStatus } from "../types";
import { checkHealthThresholds } from "../status-player";
import { DAMAGE_TYPES } from "@/lib/game-data";
import { getBattleRng, pickRandom, rngInt } from "@/lib/rng";
import { applyPotionMultiplier, halveRounded } from "../amount-helpers";
import { dealDamageToEnemy } from "../damage";
import { dealSelfDamage } from "../status-helpers";
import { addPlayerStatus, reduceEnemyArmor } from "../types";
import { defineHandler } from "./handler-types";
import { rangeBoundsError } from "./simple-handlers";

export const applyDamageEffect = defineHandler("damage", (state, card, effect, potionMult, combatTexts, context) => {
  const selected = resolveConditionalCardDamage(effect, {
    actorBlock: state.playerStatuses.block,
    targetBlock: state.enemyMitigation.block,
    targetFrozen: state.enemyCC.freezeSkipTurns > 0,
  });
  effect = selected.effect;
  if (selected.blockSpent > 0) {
    state = setPlayerStatus(state, "block", state.playerStatuses.block - selected.blockSpent);
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "damage",
      stat: "block",
      amount: selected.blockSpent,
      impact: false,
    });
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
  return dealDamageToEnemy(state, card, adjustedEffect, combatTexts, context);
});

export const applySelfDamageEffect = defineHandler("self-damage", (state, _card, effect, _potionMult, combatTexts) => {
  const { state: postDamage, healthLost } = dealSelfDamage(state, effect.amount, effect.damageType, combatTexts);
  return checkHealthThresholds(
    state.playerHealth,
    postDamage.playerHealth,
    addPlayerStatus(postDamage, effect.damageType, healthLost),
    combatTexts,
  );
});

export const applyRandomDamageEffect = defineHandler(
  "random-damage",
  (state, card, effect, potionMult, combatTexts, context) => {
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
    return dealDamageToEnemy(state, card, { kind: "damage", damageType, amount }, combatTexts, context);
  },
);

export const applyRemoveEnemyArmorEffect = defineHandler(
  "remove-enemy-armor",
  (state, _card, effect, _potionMult, combatTexts) => {
    const remainingArmor = effect.halve ? halveRounded(state.enemyMitigation.armor) : 0;
    const amount = effect.halve
      ? state.enemyMitigation.armor - remainingArmor
      : effect.removeAll
        ? state.enemyMitigation.armor
        : (effect.amount ?? 0);
    const next = reduceEnemyArmor(state, amount);
    const removed = state.enemyMitigation.armor - next.enemyMitigation.armor;
    if (removed > 0)
      mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "armor", amount: removed, impact: false });
    return next;
  },
);

export const DAMAGE_HANDLERS = {
  damage: applyDamageEffect,
  "self-damage": applySelfDamageEffect,
  "remove-enemy-armor": applyRemoveEnemyArmorEffect,
  "random-damage": applyRandomDamageEffect,
} satisfies Partial<Record<import("@/lib/game-data").BattleCardEffectKind, EffectHandler>>;
