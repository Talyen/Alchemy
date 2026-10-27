import { POTION_DISTILL_BONUS } from "../game-constants";
import {
  BattleCardEffectSchema,
  areBattleCardEffectsEqual,
  appendCardDescriptionTrailer,
  carryCardDescriptionMarks,
  cloneBattleCard,
  createEffectDescription,
  getCardDescription,
  getCardEffect,
  isPotionCard,
  mapEffectChildren,
  withCardDescription,
  type BattleCard,
  type BattleCardEffect,
  type CardDescription,
} from "../game-data";

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

function distillPotionEffect(effect: BattleCardEffect): BattleCardEffect {
  return scalePotionEffect(effect, POTION_DISTILL_BONUS);
}

/** A distilled magnitude references a field whose value grew; mark exactly those. */
function markDistilledMagnitudes(
  description: CardDescription,
  before: readonly BattleCardEffect[],
  after: readonly BattleCardEffect[],
): CardDescription {
  return description.map((line) => ({
    ...line,
    parts: line.parts.map((part) => {
      if (typeof part === "string") return part;
      const increased = part.references.some((reference) => {
        const beforeValue = (getCardEffect(before, reference) as Record<string, unknown> | undefined)?.[
          reference.field
        ];
        const afterValue = (getCardEffect(after, reference) as Record<string, unknown> | undefined)?.[reference.field];
        return (
          typeof afterValue === "number" &&
          (beforeValue === undefined || (typeof beforeValue === "number" && afterValue > beforeValue))
        );
      });
      return increased ? { ...part, distilled: true } : part;
    }),
  }));
}

function rebuildScaledPotion(card: BattleCard, effects: BattleCardEffect[], distilled: boolean): BattleCard {
  let description = carryCardDescriptionMarks(getCardDescription(card), createEffectDescription(effects));
  if (distilled) description = markDistilledMagnitudes(description, card.effects, effects);
  appendCardDescriptionTrailer(description, card.tags, card.consume === true);
  return cloneBattleCard(withCardDescription({ ...card, effects }, description));
}

export function doublePotionPotency(card: BattleCard): BattleCard {
  return rebuildScaledPotion(card, card.effects.map(doublePotionEffect), false);
}

export function strengthenPotion(card: BattleCard): BattleCard | null {
  if (!isPotionCard(card)) return null;
  const effects = card.effects.map(distillPotionEffect);
  if (
    effects.some((effect) => effect.kind === "remove-harmful-status" && effect.removeAll) &&
    !effects.some((effect) => effect.kind === "heal")
  ) {
    effects.push({ kind: "heal", amount: POTION_DISTILL_BONUS });
  }
  if (effects.some((effect) => !BattleCardEffectSchema.safeParse(effect).success)) return null;
  if (
    effects.length === card.effects.length &&
    effects.every((effect, index) => areBattleCardEffectsEqual(effect, card.effects[index]!))
  )
    return null;
  return rebuildScaledPotion(card, effects, true);
}
