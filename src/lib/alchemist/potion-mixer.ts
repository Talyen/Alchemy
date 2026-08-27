// Pure alchemist potion-combining logic.
// Used by shop controller and UI previews so mixing behavior stays testable outside React.
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { isMixedPotionCard, mixedPotion } from "@/lib/game-data";
import {
  CONSUME_DESCRIPTION_LINE,
  MIXED_POTION_CARD_ID,
  MIXED_POTION_COST,
  MIXED_POTION_TITLE,
} from "@/lib/game-constants";
import { isValidDeckIndex } from "@/lib/utils";

const MIXED_POTION_ERROR = "Cannot mix with an existing Mixed Potion";

function scaleCardDescriptionLines(card: BattleCard, multiplier: number, potencyBonus: number): string[] {
  const linesWithoutConsume = card.descriptionLines.filter((line) => line !== CONSUME_DESCRIPTION_LINE);
  if (multiplier === 1 && potencyBonus === 0) {
    return linesWithoutConsume;
  }

  // Only numbers backed by an effect's `amount` scale. Scaled amounts take
  // priority: if another numeric field happens to share the value, its text
  // occurrences also display the scaled number — the mix's primary promise is
  // never understated, at the cost of a rare exotic-field mismatch.
  const scaleMap = new Map<number, number>();
  for (const effect of card.effects) {
    if ("amount" in effect && typeof effect.amount === "number") {
      scaleMap.set(effect.amount, effect.amount * multiplier + potencyBonus);
    }
  }

  if (scaleMap.size === 0) {
    return linesWithoutConsume;
  }

  return linesWithoutConsume.map((line) =>
    line.replace(/\b\d+\b/g, (match) => {
      const scaled = scaleMap.get(Number(match));
      return scaled !== undefined ? String(scaled) : match;
    }),
  );
}

export function createMixedPotion(cardA: BattleCard, cardB: BattleCard, potencyBonus: number = 0): BattleCard {
  // Existing Mixed Potions are rejected to avoid recursively combining generated effects.
  if (isMixedPotionCard(cardA) || isMixedPotionCard(cardB)) {
    throw new Error(MIXED_POTION_ERROR);
  }

  const sameCard = cardA.id === cardB.id;

  // Build effects: duplicate & double amounts for same card, concatenate for different cards.
  const effects: BattleCardEffect[] = sameCard
    ? cardA.effects.map((e) => {
        if ("amount" in e && typeof e.amount === "number") return { ...e, amount: e.amount * 2 + potencyBonus };
        return { ...e };
      })
    : [...cardA.effects, ...cardB.effects].map((e) => {
        if ("amount" in e && typeof e.amount === "number") return { ...e, amount: e.amount + potencyBonus };
        return { ...e };
      });

  // Build description lines: scale numbers matching effect amounts, keep lines in order,
  // and append a single Consume line at the end.
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

/** Removes the two cards at the given indices from the deck and appends the mixed potion.
 * Validates indices and safely reconstructs the array. */
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
