// Card corruption helpers for altar events: mutate numeric card text/effects or transform into another card.
// Depends on card game data, random selection, and corruption tuning constants.
// Used by run navigation and tests so corrupted cards remain normal playable BattleCard objects.
import { cardLibrary, type BattleCard, type BattleCardEffect } from "@/lib/game-data";
import {
  CORRUPTION_DELTA_CHANCE,
  CORRUPTION_MIN_VALUE,
  CORRUPTION_MUTATION_DELTA,
  CORRUPTION_TEXT_PATTERNS,
  CORRUPTION_TRANSFORM_CHANCE,
  MIXED_POTION_CARD_ID,
} from "@/lib/game-constants";

type NumericEffect = BattleCardEffect & { amount: number };

interface CorruptionTarget {
  lineIndex: number;
  matchIndex: number;
  value: number;
  effectIndex: number;
}

export interface CorruptionResult {
  originalCard: BattleCard;
  corruptedCard: BattleCard;
  transformed: boolean;
  delta: 1 | -1;
}

// Generated/special cards do not have stable base content, so corruption transforms avoid them.
export function isSpecialCorruptionCard(card: Pick<BattleCard, "id">) {
  return card.id === MIXED_POTION_CARD_ID || card.id.startsWith(`${MIXED_POTION_CARD_ID}-`);
}

// Only authored text numbers that can be paired with a mechanical effect are editable.
export function getEditableCorruptionTargets(card: BattleCard): CorruptionTarget[] {
  const targets: CorruptionTarget[] = [];
  const usedEffectIndexes = new Set<number>();

  card.descriptionLines.forEach((line, lineIndex) => {
    const matches = [...line.matchAll(CORRUPTION_TEXT_PATTERNS.authoredNumber)];
    matches.forEach((match) => {
      const value = Number(match[0]);
      const effectIndex = card.effects.findIndex((effect, index) => {
        if (usedEffectIndexes.has(index) || !("amount" in effect)) return false;
        return effect.amount === value;
      });
      if (effectIndex < 0) return;
      usedEffectIndexes.add(effectIndex);
      targets.push({ lineIndex, matchIndex: match.index, value, effectIndex });
    });
  });

  return targets;
}

// Random transform candidates must themselves be numerically mutable after the transformation.
function getTransformCandidates(selectedCard: BattleCard, library: BattleCard[]) {
  return library.filter(
    (card) =>
      card.id !== selectedCard.id && !isSpecialCorruptionCard(card) && getEditableCorruptionTargets(card).length > 0,
  );
}

// Clones effects shallowly so the corrupted card can diverge from static card data safely.
function cloneCard(card: BattleCard): BattleCard {
  return {
    ...card,
    descriptionLines: [...card.descriptionLines],
    effects: card.effects.map((effect) => ({ ...effect })),
  };
}

// Replaces one numeric occurrence without touching other numbers on the same line.
export function replaceNumberAt(line: string, matchIndex: number, nextValue: number) {
  const match = line.slice(matchIndex).match(CORRUPTION_TEXT_PATTERNS.leadingNumber);
  if (!match) return line;
  return `${line.slice(0, matchIndex)}${nextValue}${line.slice(matchIndex + match[0].length)}`;
}

// Applies the selected +/- mutation to both text and the paired mechanical effect.
// `originalTitle` preserves the player's pre-corruption card name for transforms.
function applyNumericCorruption(card: BattleCard, target: CorruptionTarget, delta: 1 | -1, originalTitle?: string) {
  const nextCard = cloneCard(card);
  const nextValue = Math.max(CORRUPTION_MIN_VALUE, target.value + delta * CORRUPTION_MUTATION_DELTA);
  const effect = nextCard.effects[target.effectIndex] as NumericEffect;

  nextCard.descriptionLines[target.lineIndex] = replaceNumberAt(
    nextCard.descriptionLines[target.lineIndex]!,
    target.matchIndex,
    nextValue,
  );
  effect.amount = nextValue;
  nextCard.corrupted = true;
  nextCard.corruptedValuePositions = [
    ...(card.corruptedValuePositions ?? []),
    { lineIndex: target.lineIndex, matchIndex: target.matchIndex },
  ];
  nextCard.baseTitle = originalTitle ?? card.title;
  return nextCard;
}

// Creates the actual corrupted card, falling back to transform when direct mutation is impossible.
export function corruptCard(selectedCard: BattleCard, library: BattleCard[] = cardLibrary): CorruptionResult {
  const selectedTargets = getEditableCorruptionTargets(selectedCard);
  const candidates = getTransformCandidates(selectedCard, library);
  const shouldTransform =
    selectedTargets.length === 0 || (candidates.length > 0 && Math.random() < CORRUPTION_TRANSFORM_CHANCE);
  const sourceCard = shouldTransform ? candidates[Math.floor(Math.random() * candidates.length)] : selectedCard;
  if (!sourceCard) {
    throw new Error("No valid card is available for corruption");
  }

  const targets = getEditableCorruptionTargets(sourceCard);
  if (targets.length === 0) {
    throw new Error("Selected card has no editable corruption target");
  }

  const target = targets[Math.floor(Math.random() * targets.length)]!;
  const delta: 1 | -1 = Math.random() < CORRUPTION_DELTA_CHANCE ? -1 : 1;
  return {
    originalCard: selectedCard,
    corruptedCard: applyNumericCorruption(sourceCard, target, delta, selectedCard.title),
    transformed: sourceCard.id !== selectedCard.id,
    delta,
  };
}

// Deck replacement is centralized so the selected physical deck slot is preserved immutably.
export function corruptDeckCard(
  deck: BattleCard[],
  cardIndex: number,
  library: BattleCard[] = cardLibrary,
): { deck: BattleCard[]; result: CorruptionResult } {
  const selectedCard = deck[cardIndex];
  if (!selectedCard) throw new Error("Cannot corrupt a missing card");
  const result = corruptCard(selectedCard, library);
  return {
    deck: deck.map((card, index) => (index === cardIndex ? result.corruptedCard : card)),
    result,
  };
}
