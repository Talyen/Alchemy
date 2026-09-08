import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { CORRUPTION_MIN_VALUE, CORRUPTION_TEXT_PATTERNS } from "@/lib/game-constants";

const CORRUPTIBLE_NUMERIC_FIELDS = [
  "amount",
  "minAmount",
  "maxAmount",
  "perManaCrystal",
  "convertCurrentMana",
] as const;

type CorruptibleNumericField = (typeof CORRUPTIBLE_NUMERIC_FIELDS)[number];

export interface CorruptionTarget {
  lineIndex: number;
  matchIndex: number;
  value: number;
  effectIndex: number;
  field: CorruptibleNumericField;
}

export function getEditableCorruptionTargets(card: BattleCard): CorruptionTarget[] {
  const targets: CorruptionTarget[] = [];
  const valueQueue = new Map<number, Array<{ effectIndex: number; field: CorruptibleNumericField }>>();
  for (let idx = 0; idx < card.effects.length; idx += 1) {
    const effect = card.effects[idx] as Record<string, unknown>;
    for (const field of CORRUPTIBLE_NUMERIC_FIELDS) {
      const value = effect[field];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      if (!valueQueue.has(value)) valueQueue.set(value, []);
      valueQueue.get(value)!.push({ effectIndex: idx, field });
    }
  }
  const queueCursor = new Map<number, number>();

  card.descriptionLines.forEach((line, lineIndex) => {
    for (const match of line.matchAll(CORRUPTION_TEXT_PATTERNS.authoredNumber)) {
      const matchIndex = match.index;
      if (matchIndex === undefined) continue;
      const value = Number(match[0]);
      const queue = valueQueue.get(value);
      if (!queue) continue;
      const cursor = queueCursor.get(value) ?? 0;
      if (cursor >= queue.length) continue;
      const matched = queue[cursor];
      if (!matched) continue;
      queueCursor.set(value, cursor + 1);
      targets.push({ lineIndex, matchIndex, value, effectIndex: matched.effectIndex, field: matched.field });
    }
  });

  return targets;
}

function cloneCard(card: BattleCard): BattleCard {
  return {
    ...card,
    descriptionLines: [...card.descriptionLines],
    effects: card.effects.map((effect) => ({ ...effect })),
  };
}

export function replaceNumberAt(line: string, matchIndex: number, nextValue: number): string {
  if (matchIndex < 0 || matchIndex >= line.length) return line;
  const match = line.slice(matchIndex).match(CORRUPTION_TEXT_PATTERNS.leadingNumber);
  if (!match) return line;
  return `${line.slice(0, matchIndex)}${nextValue}${line.slice(matchIndex + match[0].length)}`;
}

function updateRepeatedCorruption(
  effect: BattleCardEffect,
  sourceEffect: BattleCardEffect,
  field: CorruptibleNumericField,
  nextValue: number,
): BattleCardEffect {
  if (effect.kind !== "repeat-over-turns") return effect;
  return {
    ...effect,
    effects: effect.effects.map((child) =>
      JSON.stringify(child) === JSON.stringify(sourceEffect)
        ? { ...child, [field]: nextValue }
        : updateRepeatedCorruption(child, sourceEffect, field, nextValue),
    ),
  };
}

export function applyNumericCorruption(card: BattleCard, target: CorruptionTarget, delta: number): BattleCard {
  const currentLine = card.descriptionLines[target.lineIndex];
  if (currentLine === undefined) return card;

  let nextValue = Math.max(CORRUPTION_MIN_VALUE, target.value + delta);
  const sourceEffect = card.effects[target.effectIndex];
  if (sourceEffect?.kind === "random-damage") {
    if (target.field === "minAmount") nextValue = Math.min(nextValue, sourceEffect.maxAmount);
    if (target.field === "maxAmount") nextValue = Math.max(nextValue, sourceEffect.minAmount);
  }
  if (nextValue === target.value) return card;
  const nextLine = replaceNumberAt(currentLine, target.matchIndex, nextValue);
  if (nextLine === currentLine && target.value !== nextValue) return card;

  const nextCard = cloneCard(card);
  const effect = nextCard.effects[target.effectIndex] as Record<string, unknown> | undefined;
  if (!effect || effect[target.field] !== target.value) return card;

  nextCard.descriptionLines[target.lineIndex] = nextLine;
  effect[target.field] = nextValue;
  if (sourceEffect) {
    nextCard.effects = nextCard.effects.map((entry) =>
      updateRepeatedCorruption(entry, sourceEffect, target.field, nextValue),
    );
  }
  nextCard.corrupted = true;
  const deltaLen = String(nextValue).length - String(target.value).length;
  const shiftedExisting =
    deltaLen !== 0
      ? (card.corruptedValuePositions ?? []).map((pos) =>
          pos.lineIndex === target.lineIndex && pos.matchIndex > target.matchIndex
            ? { ...pos, matchIndex: pos.matchIndex + deltaLen }
            : pos,
        )
      : (card.corruptedValuePositions ?? []);
  nextCard.corruptedValuePositions = [
    ...shiftedExisting,
    { lineIndex: target.lineIndex, matchIndex: target.matchIndex },
  ];
  return nextCard;
}
