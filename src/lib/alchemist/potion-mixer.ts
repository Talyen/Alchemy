import { isValidDeckIndex } from "@/lib/utils";
import {
  CONSUME_DESCRIPTION_LINE,
  MIXED_POTION_CARD_ID,
  MIXED_POTION_COST,
  MIXED_POTION_TITLE,
} from "../game-constants";
import type { BattleCard, BattleCardEffect } from "../game-data";
import {
  describeCardEffects,
  isMixedPotionCard,
  isRecursiveBattleCardEffectKind,
  mapEffectChildren,
  mixedPotion,
} from "../game-data";

const MIXED_POTION_ERROR = "Cannot mix with an existing Mixed Potion";

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => isDeepEqual(item, b[index]))
    );
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return (
    keysA.length === keysB.length &&
    keysA.every(
      (key) =>
        Object.hasOwn(b, key) && isDeepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  );
}

function areEffectsEquivalent(a: readonly BattleCardEffect[], b: readonly BattleCardEffect[]): boolean {
  // Deep comparison: same-id cards can carry different payloads (nested
  // chance/repeat trees, companion ids, conditional damage flags), and a
  // shallow kind/amount check would merge them and silently drop cardB's
  // distinct effects below.
  return a.length === b.length && a.every((effect, index) => isDeepEqual(effect, b[index]));
}

function scaledAmount(amount: number, multiplier: number, potencyBonus: number): number {
  // Single rounding point for combat magnitudes; callers may pass fractional bonuses.
  return Math.round(amount * multiplier + potencyBonus);
}

function scalePotionEffect(effect: BattleCardEffect, multiplier: number, potencyBonus: number): BattleCardEffect {
  if (isRecursiveBattleCardEffectKind(effect.kind)) {
    return mapEffectChildren(effect, (child) => scalePotionEffect(child, multiplier, potencyBonus));
  }
  if ("amount" in effect && typeof effect.amount === "number") {
    return { ...effect, amount: scaledAmount(effect.amount, multiplier, potencyBonus) };
  }
  return { ...effect };
}

export function createMixedPotion(cardA: BattleCard, cardB: BattleCard, potencyBonus: number = 0): BattleCard {
  if (isMixedPotionCard(cardA) || isMixedPotionCard(cardB)) {
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
  const effects = card.effects.map((effect) => scalePotionEffect(effect, 2, 0));
  return {
    ...card,
    effects,
    descriptionLines: [...describeCardEffects(effects), ...(card.consume ? [CONSUME_DESCRIPTION_LINE] : [])],
  };
}
