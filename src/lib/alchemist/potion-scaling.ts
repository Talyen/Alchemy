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
function scalePotionEffect(effect: BattleCardEffect, scale: number | "double" = "double"): BattleCardEffect {
  if (isUnscalableEffect(effect)) return effect;
  if (effect.kind === "random-draw" || effect.kind === "random-damage") {
    const scaleValue = (value: number) => (scale === "double" ? value * 2 : value + scale);
    return { ...effect, minAmount: scaleValue(effect.minAmount), maxAmount: scaleValue(effect.maxAmount) };
  }
  if (effect.kind === "damage") {
    if (scale === "double")
      return {
        ...effect,
        amount: effect.amount * 2,
        ...(effect.amountIfTargetFrozen !== undefined ? { amountIfTargetFrozen: effect.amountIfTargetFrozen * 2 } : {}),
      };
    const frozenIncrease =
      effect.damageTypeIfTargetFrozen === effect.damageType && effect.amountIfTargetFrozen === effect.amount * 2
        ? POTION_DISTILL_BONUS * 2
        : scale;
    return {
      ...effect,
      amount: effect.amount + scale,
      ...(effect.amountIfTargetFrozen !== undefined
        ? { amountIfTargetFrozen: effect.amountIfTargetFrozen + frozenIncrease }
        : {}),
    };
  }
  if ("amount" in effect && typeof effect.amount === "number") {
    const amount = scale === "double" ? effect.amount * 2 : effect.amount + scale;
    if (effect.kind === "player-status" && effect.forgeAmount !== undefined)
      return {
        ...effect,
        amount,
        forgeAmount: scale === "double" ? effect.forgeAmount * 2 : effect.forgeAmount + scale,
      };
    return { ...effect, amount };
  }
  return mapEffectChildren(effect, (child) => scalePotionEffect(child, scale));
}

export function doublePotionEffect(effect: BattleCardEffect): BattleCardEffect {
  return scalePotionEffect(effect, "double");
}

export function distillPotionEffect(effect: BattleCardEffect): BattleCardEffect {
  return scalePotionEffect(effect, POTION_DISTILL_BONUS);
}
