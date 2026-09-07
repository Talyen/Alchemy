import type { BattleCard, BattleCardEffect } from "../game-data";
import { isMixedPotionCard, mixedPotion } from "../game-data";
import {
  CONSUME_DESCRIPTION_LINE,
  MIXED_POTION_CARD_ID,
  MIXED_POTION_COST,
  MIXED_POTION_TITLE,
} from "../game-constants";
import { isValidDeckIndex } from "@/lib/utils";

const MIXED_POTION_ERROR = "Cannot mix with an existing Mixed Potion";

function scalePotionEffect(
  effect: BattleCardEffect,
  multiplier: number,
  potencyBonus: number,
  scaleMap: Map<number, number>,
): BattleCardEffect {
  if (effect.kind === "chance") {
    return {
      ...effect,
      successEffects: effect.successEffects.map((child) =>
        scalePotionEffect(child, multiplier, potencyBonus, scaleMap),
      ),
      failureEffects: effect.failureEffects.map((child) =>
        scalePotionEffect(child, multiplier, potencyBonus, scaleMap),
      ),
    };
  }
  if ("amount" in effect) {
    const amount = effect.amount * multiplier + potencyBonus;
    scaleMap.set(effect.amount, amount);
    return { ...effect, amount };
  }
  return { ...effect };
}

function scaleCardDescriptionLines(card: BattleCard, multiplier: number, potencyBonus: number): string[] {
  const linesWithoutConsume = card.descriptionLines.filter((line) => line !== CONSUME_DESCRIPTION_LINE);
  if (multiplier === 1 && potencyBonus === 0) {
    return linesWithoutConsume;
  }

  const scaleMap = new Map<number, number>();
  for (const effect of card.effects) scalePotionEffect(effect, multiplier, potencyBonus, scaleMap);

  if (scaleMap.size === 0) {
    return linesWithoutConsume;
  }

  return linesWithoutConsume.map((line) => {
    return line
      .split(" or ")
      .map((alternative) => {
        let replaced = false;
        return alternative.replace(/\b\d+\b/g, (match) => {
          if (replaced) return match;
          const scaled = scaleMap.get(Number(match));
          if (scaled !== undefined) {
            replaced = true;
            return String(scaled);
          }
          return match;
        });
      })
      .join(" or ");
  });
}

export function createMixedPotion(cardA: BattleCard, cardB: BattleCard, potencyBonus: number = 0): BattleCard {
  if (isMixedPotionCard(cardA) || isMixedPotionCard(cardB)) {
    throw new Error(MIXED_POTION_ERROR);
  }

  const sameCard = cardA.id === cardB.id && JSON.stringify(cardA.effects) === JSON.stringify(cardB.effects);

  const effects = (sameCard ? cardA.effects : [...cardA.effects, ...cardB.effects]).map((effect) =>
    scalePotionEffect(effect, sameCard ? 2 : 1, potencyBonus, new Map()),
  );

  const descriptionLines: string[] = sameCard
    ? scaleCardDescriptionLines(cardA, 2, potencyBonus)
    : [...scaleCardDescriptionLines(cardA, 1, potencyBonus), ...scaleCardDescriptionLines(cardB, 1, potencyBonus)];

  descriptionLines.push(CONSUME_DESCRIPTION_LINE);

  const uidA = cardA.uid ?? 0;
  const uidB = cardB.uid ?? 0;

  return {
    id: `${MIXED_POTION_CARD_ID}-${cardA.id}-${uidA}-${cardB.id}-${uidB}`,
    title: MIXED_POTION_TITLE,
    descriptionLines,
    art: mixedPotion,
    cost: MIXED_POTION_COST,
    consume: true,
    effects,
  };
}

export function tryCreateMixedPotion(
  cardA: BattleCard | undefined,
  cardB: BattleCard | undefined,
  potencyBonus: number = 0,
): BattleCard | null {
  if (!cardA || !cardB) return null;
  if (isMixedPotionCard(cardA) || isMixedPotionCard(cardB)) return null;
  return createMixedPotion(cardA, cardB, potencyBonus);
}

export function applyMixToDeck(deck: BattleCard[], indexA: number, indexB: number, mixed: BattleCard): BattleCard[] {
  if (indexA === indexB || !isValidDeckIndex(indexA, deck.length) || !isValidDeckIndex(indexB, deck.length)) {
    throw new Error("Invalid potion indices for mixing");
  }
  const highIdx = Math.max(indexA, indexB);
  const lowIdx = Math.min(indexA, indexB);
  const next = deck.filter((_, i) => i !== highIdx && i !== lowIdx);
  next.push(mixed);
  return next;
}

export function doublePotionPotency(card: BattleCard): BattleCard {
  return {
    ...card,
    effects: card.effects.map((effect) => scalePotionEffect(effect, 2, 0, new Map())),
    descriptionLines: [...scaleCardDescriptionLines(card, 2, 0), ...(card.consume ? [CONSUME_DESCRIPTION_LINE] : [])],
  };
}
