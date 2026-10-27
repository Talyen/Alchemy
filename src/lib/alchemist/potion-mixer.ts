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
  renderCardDescription,
  mixedPotion,
  isPotionCard,
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
    (cardA.effects.some((effect) => !BattleCardEffectSchema.safeParse(effect).success) ||
      cardB.effects.some((effect) => !BattleCardEffectSchema.safeParse(effect).success))
  )
    return null;
  const tagSet = new Set(cardA.tags);
  for (const tag of cardB.tags ?? []) tagSet.add(tag);
  const tags = [...tagSet];
  const parts = combinedEffects ? [potionParts(cardA, combinedEffects)] : [potionParts(cardA), potionParts(cardB)];
  if (combinedEffects) {
    const part = parts[0]!;
    part.description = carryCardDescriptionMarks(getCardDescription(cardB), part.description);
  }

  let effectOffset = 0;
  const description: ReturnType<typeof getCardDescription> = [];
  const effects: BattleCard["effects"] = [];
  for (const part of parts) {
    const offset = effectOffset;
    effectOffset += part.effects.length;
    description.push(
      ...mapCardDescriptionReferences(
        part.description,
        (reference) => ({
          ...reference,
          effectIndex: reference.effectIndex + offset,
        }),
        `ingredient/${offset}`,
      ),
    );
    effects.push(...part.effects);
  }
  appendCardDescriptionTrailer(description, tags, true);
  return cloneBattleCard({
    id: `${MIXED_POTION_CARD_ID}-crafted`,
    title: MIXED_POTION_TITLE,
    descriptionLines: renderCardDescription(effects, description).descriptionLines,
    description,
    art: mixedPotion,
    cost: MIXED_POTION_COST,
    consume: true,
    ...(tags.length ? { tags } : {}),
    effects,
  });
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

function applyMixToDeck(deck: BattleCard[], indexA: number, indexB: number, mixed: BattleCard): BattleCard[] {
  if (indexA === indexB || !isValidDeckIndex(indexA, deck.length) || !isValidDeckIndex(indexB, deck.length)) {
    throw new Error("Invalid potion indices for mixing");
  }
  const next: BattleCard[] = [];
  for (let index = 0; index < deck.length; index++) {
    if (index !== indexA && index !== indexB) next.push(deck[index]!);
  }
  next.push(mixed);
  return next;
}

/** Prepare the complete replacement before either visit spends its service. */
export function tryMixPotionDeck(deck: BattleCard[], indexA: number, indexB: number) {
  if (indexA === indexB || !isValidDeckIndex(indexA, deck.length) || !isValidDeckIndex(indexB, deck.length))
    return null;
  const cardA = deck[indexA];
  const cardB = deck[indexB];
  if (!cardA || !cardB || !isPotionCard(cardA) || !isPotionCard(cardB)) return null;
  const potion = tryCreateMixedPotion(cardA, cardB);
  return potion ? { potion, deck: applyMixToDeck(deck, indexA, indexB, potion) } : null;
}
