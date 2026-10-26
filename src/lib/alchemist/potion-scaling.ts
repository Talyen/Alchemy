import { POTION_DISTILL_BONUS } from "../game-constants";
import { mapEffectChildren, type BattleCardEffect } from "../game-data";

/** Scaling changes rewards, never ingredient costs, status durations, or derived base amounts. */
function isUnscalableEffect(effect: BattleCardEffect): boolean {
  if (
    effect.kind === "lose-health" ||
    effect.kind === "self-damage" ||
    effect.kind === "lose-mana" ||
    effect.kind === "lose-max-mana"
  )
    return true;
  if (effect.kind === "damage" && (effect.equalToBlock === true || effect.equalToArmor === true)) return true;
  return (
    effect.kind === "player-status" &&
    (effect.status === "haste" ||
      effect.status === "phoenixFeather" ||
      effect.convertCurrentMana !== undefined ||
      effect.perManaCrystal !== undefined)
  );
}

/** Folding must represent both executions, so effects potency cannot represent stay separate. */
export function isNonFoldingEffect(effect: BattleCardEffect): boolean {
  return (
    isUnscalableEffect(effect) ||
    (effect.kind === "remove-enemy-armor" && effect.halve === true) ||
    effect.kind === "multiply-enemy-status" ||
    (effect.kind === "damage" && effect.forgeBonusPercent !== undefined)
  );
}

/**
 * Scale one effect's rewards by doubling it or adding a bonus. A doubled
 * Frozen outcome shares the displayed base magnitude, so a bonus applies
 * twice there to keep both lines consistent.
 */
function scalePotionEffect(effect: BattleCardEffect, scale: number | "double"): BattleCardEffect {
  if (isUnscalableEffect(effect)) return effect;
  const scaleValue = (value: number, bonusMultiplier = 1) =>
    scale === "double" ? value * 2 : value + scale * bonusMultiplier;
  if (effect.kind === "random-draw" || effect.kind === "random-damage") {
    return { ...effect, minAmount: scaleValue(effect.minAmount), maxAmount: scaleValue(effect.maxAmount) };
  }
  if (effect.kind === "damage") {
    const frozenBonusMultiplier =
      effect.damageTypeIfTargetFrozen === effect.damageType && effect.amountIfTargetFrozen === effect.amount * 2
        ? 2
        : 1;
    return {
      ...effect,
      amount: scaleValue(effect.amount),
      ...(effect.amountIfTargetFrozen !== undefined
        ? { amountIfTargetFrozen: scaleValue(effect.amountIfTargetFrozen, frozenBonusMultiplier) }
        : {}),
    };
  }
  if ("amount" in effect && typeof effect.amount === "number") {
    return {
      ...effect,
      amount: scaleValue(effect.amount),
      ...(effect.kind === "player-status" && effect.forgeAmount !== undefined
        ? { forgeAmount: scaleValue(effect.forgeAmount) }
        : {}),
    };
  }
  return mapEffectChildren(effect, (child) => scalePotionEffect(child, scale));
}

export function doublePotionEffect(effect: BattleCardEffect): BattleCardEffect {
  return scalePotionEffect(effect, "double");
}

export function distillPotionEffect(effect: BattleCardEffect): BattleCardEffect {
  return scalePotionEffect(effect, POTION_DISTILL_BONUS);
}
