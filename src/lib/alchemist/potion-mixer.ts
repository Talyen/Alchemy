import { isValidDeckIndex } from "@/lib/utils";
import { MIXED_POTION_CARD_ID, MIXED_POTION_COST, MIXED_POTION_TITLE } from "../game-constants";
import type { BattleCard } from "../game-data";
import {
  BattleCardEffectSchema,
  areBattleCardEffectsEqual,
  cloneBattleCard,
  appendCardDescriptionTrailer,
  createEffectDescription,
  carryCardDescriptionMarks,
  getCardDescription,
  mapCardDescriptionReferences,
  withCardDescription,
  mixedPotion,
  visitBattleCardEffects,
} from "../game-data";
import { doublePotionEffect, isNonFoldingEffect } from "./potion-scaling";

function potionParts(card: BattleCard, effects = card.effects) {
  return {
    effects,
    description: carryCardDescriptionMarks(getCardDescription(card), createEffectDescription(effects)),
  };
}

function prepareMixedPotion(cardA: BattleCard, cardB: BattleCard): BattleCard | null {
  const tags = [...new Set([...(cardA.tags ?? []), ...(cardB.tags ?? [])])];
  // Folding must represent both executions. Costs, durations and derived
  // magnitudes are deliberately unchanged by potency, so keep those packets.
  const sameCard =
    cardA.id === cardB.id &&
    cardA.effects.length === cardB.effects.length &&
    cardA.effects.every((effect, index) => areBattleCardEffectsEqual(effect, cardB.effects[index]!)) &&
    !visitBattleCardEffects(cardA.effects, isNonFoldingEffect);

  const doubled = sameCard ? cardA.effects.map(doublePotionEffect) : null;
  // Folding is optional: two valid ingredients must still mix when their
  // doubled amounts exceed the saved-effect bounds. Keep both effect sets.
  const combinedEffects = doubled?.every((effect) => BattleCardEffectSchema.safeParse(effect).success) ? doubled : null;
  // Reject before generating descriptions or spending either ingredient.
  if (
    !combinedEffects &&
    [cardA, cardB].some((card) => card.effects.some((effect) => !BattleCardEffectSchema.safeParse(effect).success))
  )
    return null;
  const parts = combinedEffects ? [potionParts(cardA, combinedEffects)] : [potionParts(cardA), potionParts(cardB)];
  if (combinedEffects) {
    const part = parts[0]!;
    part.description = carryCardDescriptionMarks(getCardDescription(cardB), part.description);
  }

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
  const effects = parts.flatMap((part) => part.effects);
  appendCardDescriptionTrailer(description, tags, true);
  return cloneBattleCard(
    withCardDescription(
      {
        id: `${MIXED_POTION_CARD_ID}-crafted`,
        title: MIXED_POTION_TITLE,
        descriptionLines: [],
        art: mixedPotion,
        cost: MIXED_POTION_COST,
        consume: true,
        ...(tags.length ? { tags } : {}),
        effects,
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
  const [first, second] = indexA < indexB ? [indexA, indexB] : [indexB, indexA];
  return [...deck.slice(0, first), ...deck.slice(first + 1, second), ...deck.slice(second + 1), mixed];
}

export function doublePotionPotency(card: BattleCard): BattleCard {
  const { effects, description } = potionParts(card, card.effects.map(doublePotionEffect));
  appendCardDescriptionTrailer(description, card.tags, card.consume === true);
  return cloneBattleCard(
    withCardDescription(
      {
        ...card,
        effects,
      },
      description,
    ),
  );
}
