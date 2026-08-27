// Card corruption helpers for altar events: mutate numeric card text/effects or transform into another card.
// Used by run navigation and tests so corrupted cards remain normal playable BattleCard objects.
import { type BattleCard, type BattleCardEffect } from "@/lib/game-data";
import {
  CORRUPTION_DELTA_CHANCE,
  CORRUPTION_MIN_VALUE,
  CORRUPTION_MUTATION_DELTA,
  CORRUPTION_TEXT_PATTERNS,
  CORRUPTION_TRANSFORM_CHANCE,
  MIXED_POTION_CARD_ID,
} from "@/lib/game-constants";
import { pickRandom } from "@/lib/utils";

type NumericEffect = Extract<BattleCardEffect, { amount?: number }> & { amount: number };

export interface CorruptionTarget {
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
export function isSpecialCorruptionCard(card: Pick<BattleCard, "id">): boolean {
  return card.id === MIXED_POTION_CARD_ID || card.id.startsWith(`${MIXED_POTION_CARD_ID}-`);
}

// Only authored text numbers that can be paired with a mechanical effect are editable.
export function getEditableCorruptionTargets(card: BattleCard): CorruptionTarget[] {
  const targets: CorruptionTarget[] = [];
  const usedEffectIndexes = new Set<number>();

  card.descriptionLines.forEach((line, lineIndex) => {
    for (const match of line.matchAll(CORRUPTION_TEXT_PATTERNS.authoredNumber)) {
      const matchIndex = match.index;
      if (matchIndex === undefined) continue;
      const value = Number(match[0]);
      const effectIndex = card.effects.findIndex((effect, index) => {
        if (usedEffectIndexes.has(index) || !("amount" in effect) || typeof effect.amount !== "number") return false;
        return effect.amount === value;
      });
      if (effectIndex < 0) continue;
      usedEffectIndexes.add(effectIndex);
      targets.push({ lineIndex, matchIndex, value, effectIndex });
    }
  });

  return targets;
}

interface TransformCandidate {
  card: BattleCard;
  targets: CorruptionTarget[];
}

// Random transform candidates must themselves be numerically mutable after the transformation.
function getTransformCandidates(candidates: BattleCard[]): TransformCandidate[] {
  const valid: TransformCandidate[] = [];
  for (const card of candidates) {
    const targets = getEditableCorruptionTargets(card);
    if (targets.length > 0) {
      valid.push({ card, targets });
    }
  }
  return valid;
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
export function replaceNumberAt(line: string, matchIndex: number, nextValue: number): string {
  if (matchIndex < 0 || matchIndex >= line.length) return line;
  const match = line.slice(matchIndex).match(CORRUPTION_TEXT_PATTERNS.leadingNumber);
  if (!match) return line;
  return `${line.slice(0, matchIndex)}${nextValue}${line.slice(matchIndex + match[0].length)}`;
}

// Applies the selected +/- mutation to both text and the paired mechanical effect.
function applyNumericCorruption(card: BattleCard, target: CorruptionTarget, delta: 1 | -1): BattleCard {
  const currentLine = card.descriptionLines[target.lineIndex];
  if (currentLine === undefined) return card;

  const nextValue = Math.max(CORRUPTION_MIN_VALUE, target.value + delta * CORRUPTION_MUTATION_DELTA);
  const nextLine = replaceNumberAt(currentLine, target.matchIndex, nextValue);
  if (nextLine === currentLine && target.value !== nextValue) return card;

  const nextCard = cloneCard(card);
  const effect = nextCard.effects[target.effectIndex] as NumericEffect | undefined;
  if (!effect || typeof effect.amount !== "number") return card;

  nextCard.descriptionLines[target.lineIndex] = nextLine;
  effect.amount = nextValue;
  nextCard.corrupted = true;
  nextCard.corruptedValuePositions = [
    ...(card.corruptedValuePositions ?? []),
    { lineIndex: target.lineIndex, matchIndex: target.matchIndex },
  ];
  return nextCard;
}

// Creates the actual corrupted card, falling back to transform when direct mutation is impossible.
export function corruptCard(
  selectedCard: BattleCard,
  library: BattleCard[],
  rng: () => number,
): CorruptionResult | null {
  const selectedTargets = getEditableCorruptionTargets(selectedCard);
  const potentialCandidates = library.filter((card) => card.id !== selectedCard.id && !isSpecialCorruptionCard(card));

  let sourceCard = selectedCard;
  let targets = selectedTargets;
  let transformed = false;

  const mustTransform = selectedTargets.length === 0;
  const canAttemptTransform = potentialCandidates.length > 0;

  if (mustTransform || (canAttemptTransform && rng() < CORRUPTION_TRANSFORM_CHANCE)) {
    const candidates = getTransformCandidates(potentialCandidates);
    if (candidates.length > 0) {
      const picked = pickRandom(candidates, rng);
      if (picked) {
        sourceCard = picked.card;
        targets = picked.targets;
        transformed = true;
      }
    }
  }

  if (targets.length === 0) return null;

  const target = pickRandom(targets, rng);
  if (!target) return null;

  const delta: 1 | -1 = rng() < CORRUPTION_DELTA_CHANCE ? -1 : 1;
  const corruptedCard = applyNumericCorruption(sourceCard, target, delta);
  if (corruptedCard === sourceCard) return null;

  return {
    originalCard: selectedCard,
    corruptedCard,
    transformed,
    delta,
  };
}

// Deck replacement is centralized so the selected physical deck slot is preserved immutably.
export function corruptDeckCard(
  deck: BattleCard[],
  cardIndex: number,
  library: BattleCard[],
  rng: () => number,
): { deck: BattleCard[]; result: CorruptionResult | null } {
  const selectedCard = deck[cardIndex];
  if (!selectedCard) throw new Error("Cannot corrupt a missing card");
  const result = corruptCard(selectedCard, library, rng);
  if (!result) return { deck, result: null };
  return {
    deck: deck.map((card, index) => (index === cardIndex ? result.corruptedCard : card)),
    result,
  };
}
