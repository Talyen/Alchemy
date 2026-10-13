import { capitalizeWord, isValidDeckIndex } from "@/lib/utils";
import {
  CONSUME_DESCRIPTION_LINE,
  MIXED_POTION_CARD_ID,
  MIXED_POTION_COST,
  MIXED_POTION_TITLE,
} from "../game-constants";
import type { BattleCard, BattleCardEffect } from "../game-data";
import {
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

function scaledAmount(amount: number, multiplier: number, potencyBonus: number): number {
  // Single rounding point for combat magnitudes; callers may pass fractional bonuses.
  return Math.round(amount * multiplier + potencyBonus);
}

function scalePotionEffect(effect: BattleCardEffect, multiplier: number, potencyBonus: number): BattleCardEffect {
  if (effect.kind === "random-draw" || effect.kind === "random-damage") {
    return {
      ...effect,
      minAmount: scaledAmount(effect.minAmount, multiplier, potencyBonus),
      maxAmount: scaledAmount(effect.maxAmount, multiplier, potencyBonus),
    };
  }
  if ("amount" in effect && typeof effect.amount === "number") {
    const amount = scaledAmount(effect.amount, multiplier, potencyBonus);
    if (effect.kind === "damage")
      return {
        ...effect,
        amount,
        ...(effect.amountIfTargetFrozen !== undefined
          ? { amountIfTargetFrozen: scaledAmount(effect.amountIfTargetFrozen, multiplier, potencyBonus) }
          : {}),
        ...(effect.blockDamageBonus !== undefined
          ? { blockDamageBonus: scaledAmount(effect.blockDamageBonus, multiplier, potencyBonus) }
          : {}),
      };
    if (effect.kind === "player-status" && effect.forgeAmount !== undefined)
      return { ...effect, amount, forgeAmount: scaledAmount(effect.forgeAmount, multiplier, potencyBonus) };
    return { ...effect, amount };
  }
  return mapEffectChildren(effect, (child) => scalePotionEffect(child, multiplier, potencyBonus));
}

function scaledPotionParts(card: BattleCard, multiplier: number, potencyBonus: number) {
  const effects = card.effects.map((effect) => scalePotionEffect(effect, multiplier, potencyBonus));
  return {
    effects,
    description: carryCardDescriptionMarks(getCardDescription(card), createEffectDescription(effects)),
  };
}

export function createMixedPotion(cardA: BattleCard, cardB: BattleCard, potencyBonus: number = 0): BattleCard {
  if (!cardA || !cardB) {
    throw new Error(MIXED_POTION_ERROR);
  }

  const tags = [...new Set([...(cardA.tags ?? []), ...(cardB.tags ?? [])])];
  // Doubling amounts cannot represent a second Armor-halving operation.
  const sameCard =
    cardA.id === cardB.id &&
    areEffectsEquivalent(cardA.effects, cardB.effects) &&
    !visitBattleCardEffects(cardA.effects, (effect) => effect.kind === "remove-enemy-armor" && effect.halve === true);

  // Describe ingredients separately: matching prose from different Potions
  // must not collapse into a single effect description.
  const parts = (sameCard ? [cardA] : [cardA, cardB]).map((card) =>
    scaledPotionParts(card, sameCard ? 2 : 1, potencyBonus),
  );

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

export function tryCreateMixedPotion(
  cardA: BattleCard | undefined,
  cardB: BattleCard | undefined,
  potencyBonus: number = 0,
): BattleCard | null {
  if (!cardA || !cardB) return null;
  return createMixedPotion(cardA, cardB, potencyBonus);
}

export function applyMixToDeck(deck: BattleCard[], indexA: number, indexB: number, mixed: BattleCard): BattleCard[] {
  if (indexA === indexB || !isValidDeckIndex(indexA, deck.length) || !isValidDeckIndex(indexB, deck.length)) {
    throw new Error("Invalid potion indices for mixing");
  }
  return [...deck.filter((_, index) => index !== indexA && index !== indexB), mixed];
}

export function doublePotionPotency(card: BattleCard): BattleCard {
  const { effects, description } = scaledPotionParts(card, 2, 0);
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
