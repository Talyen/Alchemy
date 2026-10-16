import { capitalizeWord, isValidDeckIndex } from "@/lib/utils";
import {
  CONSUME_DESCRIPTION_LINE,
  MIXED_POTION_CARD_ID,
  MIXED_POTION_COST,
  MIXED_POTION_TITLE,
} from "../game-constants";
import type { BattleCard, BattleCardEffect } from "../game-data";
import {
  BattleCardEffectSchema,
  areBattleCardEffectsEqual,
  cloneBattleCard,
  createEffectDescription,
  carryCardDescriptionMarks,
  getCardDescription,
  mapCardDescriptionReferences,
  withCardDescription,
  mapEffectChildren,
  mixedPotion,
  visitBattleCardEffects,
} from "../game-data";

const MIXED_POTION_ERROR = "Two Potions are required";

function areEffectsEquivalent(a: readonly BattleCardEffect[], b: readonly BattleCardEffect[]): boolean {
  // Deep comparison: same-id cards can carry different payloads (nested
  // chance/repeat trees, companion ids, conditional damage flags), and a
  // shallow kind/amount check would merge them and silently drop cardB's
  // distinct effects below.
  return a.length === b.length && a.every((effect, index) => areBattleCardEffectsEqual(effect, b[index]!));
}

function scaledAmount(amount: number, multiplier: number): number {
  // Single rounding point for combat magnitudes.
  return Math.round(amount * multiplier);
}

function scalePotionEffect(effect: BattleCardEffect, multiplier: number): BattleCardEffect {
  // Doubling changes rewards, never ingredient costs or status durations.
  if (
    effect.kind === "lose-health" ||
    effect.kind === "self-damage" ||
    effect.kind === "lose-mana" ||
    effect.kind === "lose-max-mana" ||
    (effect.kind === "player-status" && (effect.status === "haste" || effect.status === "phoenixFeather"))
  )
    return effect;
  if (effect.kind === "random-draw" || effect.kind === "random-damage") {
    return {
      ...effect,
      minAmount: scaledAmount(effect.minAmount, multiplier),
      maxAmount: scaledAmount(effect.maxAmount, multiplier),
    };
  }
  if ("amount" in effect && typeof effect.amount === "number") {
    const amount = scaledAmount(effect.amount, multiplier);
    if (effect.kind === "damage")
      return {
        ...effect,
        amount,
        ...(effect.amountIfTargetFrozen !== undefined
          ? { amountIfTargetFrozen: scaledAmount(effect.amountIfTargetFrozen, multiplier) }
          : {}),
        ...(effect.blockDamageBonus !== undefined
          ? { blockDamageBonus: scaledAmount(effect.blockDamageBonus, multiplier) }
          : {}),
      };
    if (effect.kind === "player-status" && effect.forgeAmount !== undefined)
      return { ...effect, amount, forgeAmount: scaledAmount(effect.forgeAmount, multiplier) };
    return { ...effect, amount };
  }
  return mapEffectChildren(effect, (child) => scalePotionEffect(child, multiplier));
}

function scaledPotionParts(card: BattleCard, multiplier: number) {
  const effects = card.effects.map((effect) => scalePotionEffect(effect, multiplier));
  return {
    effects,
    description: carryCardDescriptionMarks(getCardDescription(card), createEffectDescription(effects)),
  };
}

function prepareMixedPotion(cardA: BattleCard, cardB: BattleCard): BattleCard | null {
  if (!cardA || !cardB) {
    throw new Error(MIXED_POTION_ERROR);
  }

  const tags = [...new Set([...(cardA.tags ?? []), ...(cardB.tags ?? [])])];
  // Doubling amounts cannot represent a second Armor-halving operation.
  const sameCard =
    cardA.id === cardB.id &&
    areEffectsEquivalent(cardA.effects, cardB.effects) &&
    !visitBattleCardEffects(
      cardA.effects,
      (effect) =>
        (effect.kind === "remove-enemy-armor" && effect.halve === true) ||
        effect.kind === "lose-health" ||
        effect.kind === "self-damage" ||
        effect.kind === "lose-mana" ||
        effect.kind === "lose-max-mana" ||
        (effect.kind === "player-status" && (effect.status === "haste" || effect.status === "phoenixFeather")),
    );

  // Describe ingredients separately: matching prose from different Potions
  // must not collapse into a single effect description.
  const parts = (sameCard ? [cardA] : [cardA, cardB]).map((card) => scaledPotionParts(card, sameCard ? 2 : 1));
  // Reject before a command can spend Gold or replace either ingredient.
  if (parts.some((part) => part.effects.some((effect) => !BattleCardEffectSchema.safeParse(effect).success)))
    return null;

  let effectOffset = 0;
  const description = parts.flatMap((part) => {
    const offset = effectOffset;
    effectOffset += part.effects.length;
    return mapCardDescriptionReferences(
      part.description,
      (reference) => ({
        ...reference,
        effectIndex: reference.effectIndex + offset,
      }),
      `ingredient/${offset}`,
    );
  });
  for (const tag of tags) description.push({ parts: [capitalizeWord(tag)], role: "keyword" });
  description.push({ parts: [CONSUME_DESCRIPTION_LINE], role: "consume" });
  return cloneBattleCard(
    withCardDescription(
      {
        id: `${MIXED_POTION_CARD_ID}-${cardA.id}-${cardA.uid ?? 0}-${cardB.id}-${cardB.uid ?? 0}`,
        title: MIXED_POTION_TITLE,
        descriptionLines: [],
        art: mixedPotion,
        cost: MIXED_POTION_COST,
        consume: true,
        ...(tags.length ? { tags } : {}),
        effects: parts.flatMap((part) => part.effects),
      },
      description,
    ),
  );
}

export function createMixedPotion(cardA: BattleCard, cardB: BattleCard): BattleCard {
  const potion = prepareMixedPotion(cardA, cardB);
  if (!potion) throw new Error("Mixed Potion effects exceed supported values");
  return potion;
}

export function tryCreateMixedPotion(cardA: BattleCard | undefined, cardB: BattleCard | undefined): BattleCard | null {
  if (!cardA || !cardB) return null;
  return prepareMixedPotion(cardA, cardB);
}

export function applyMixToDeck(deck: BattleCard[], indexA: number, indexB: number, mixed: BattleCard): BattleCard[] {
  if (indexA === indexB || !isValidDeckIndex(indexA, deck.length) || !isValidDeckIndex(indexB, deck.length)) {
    throw new Error("Invalid potion indices for mixing");
  }
  return [...deck.filter((_, index) => index !== indexA && index !== indexB), mixed];
}

export function doublePotionPotency(card: BattleCard): BattleCard {
  const { effects, description } = scaledPotionParts(card, 2);
  const markedDescription = carryCardDescriptionMarks(getCardDescription(card), description);
  for (const tag of card.tags ?? []) markedDescription.push({ parts: [capitalizeWord(tag)], role: "keyword" });
  if (card.consume) markedDescription.push({ parts: [CONSUME_DESCRIPTION_LINE], role: "consume" });
  return cloneBattleCard(
    withCardDescription(
      {
        ...card,
        effects,
      },
      markedDescription,
    ),
  );
}
