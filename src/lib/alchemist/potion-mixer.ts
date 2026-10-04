import { isValidDeckIndex } from "@/lib/utils";
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
  describeCardEffects,
  isMixedPotionCard,
  isRecursiveBattleCardEffectKind,
  mapEffectChildren,
  mixedPotion,
} from "../game-data";

const MIXED_POTION_ERROR = "Cannot mix with an existing Mixed Potion";

function canMixPotion(card: BattleCard | undefined): card is BattleCard {
  return card != null && !isMixedPotionCard(card) && !card.brewed;
}

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
  if (isRecursiveBattleCardEffectKind(effect.kind)) {
    return mapEffectChildren(effect, (child) => scalePotionEffect(child, multiplier, potencyBonus));
  }
  if (effect.kind === "random-draw" || effect.kind === "random-damage") {
    return {
      ...effect,
      minAmount: scaledAmount(effect.minAmount, multiplier, potencyBonus),
      maxAmount: scaledAmount(effect.maxAmount, multiplier, potencyBonus),
    };
  }
  if ("amount" in effect && typeof effect.amount === "number") {
    return { ...effect, amount: scaledAmount(effect.amount, multiplier, potencyBonus) };
  }
  return { ...effect };
}

export function createMixedPotion(cardA: BattleCard, cardB: BattleCard, potencyBonus: number = 0): BattleCard {
  if (!canMixPotion(cardA) || !canMixPotion(cardB)) {
    throw new Error(MIXED_POTION_ERROR);
  }

  const sameCard = cardA.id === cardB.id && areEffectsEquivalent(cardA.effects, cardB.effects);

  const effects = (sameCard ? cardA.effects : [...cardA.effects, ...cardB.effects]).map((effect) =>
    scalePotionEffect(effect, sameCard ? 2 : 1, potencyBonus),
  );

  const descriptionLines: string[] = sameCard
    ? describeCardEffects(effects)
    : [
        ...describeCardEffects(effects.slice(0, cardA.effects.length)),
        ...describeCardEffects(effects.slice(cardA.effects.length)),
      ];

  descriptionLines.push(CONSUME_DESCRIPTION_LINE);

  const uidA = cardA.uid ?? 0;
  const uidB = cardB.uid ?? 0;

  return cloneBattleCard({
    id: `${MIXED_POTION_CARD_ID}-${cardA.id}-${uidA}-${cardB.id}-${uidB}`,
    title: MIXED_POTION_TITLE,
    descriptionLines,
    art: mixedPotion,
    cost: MIXED_POTION_COST,
    consume: true,
    brewed: true,
    effects,
  });
}

export function tryCreateMixedPotion(
  cardA: BattleCard | undefined,
  cardB: BattleCard | undefined,
  potencyBonus: number = 0,
): BattleCard | null {
  if (!canMixPotion(cardA) || !canMixPotion(cardB)) return null;
  return createMixedPotion(cardA, cardB, potencyBonus);
}

export function applyMixToDeck(deck: BattleCard[], indexA: number, indexB: number, mixed: BattleCard): BattleCard[] {
  if (indexA === indexB || !isValidDeckIndex(indexA, deck.length) || !isValidDeckIndex(indexB, deck.length)) {
    throw new Error("Invalid potion indices for mixing");
  }
  return [...deck.filter((_, index) => index !== indexA && index !== indexB), mixed];
}

export function doublePotionPotency(card: BattleCard): BattleCard {
  const effects = card.effects.map((effect) => scalePotionEffect(effect, 2, 0));
  return cloneBattleCard({
    ...card,
    effects,
    descriptionLines: [...describeCardEffects(effects), ...(card.consume ? [CONSUME_DESCRIPTION_LINE] : [])],
  });
}
