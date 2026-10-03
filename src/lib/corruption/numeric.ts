import { CORRUPTION_MIN_VALUE, CORRUPTION_TEXT_PATTERNS, PERCENT_DENOMINATOR } from "@/lib/game-constants";
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { conditionalDamageDescription, mapEffectChildren } from "@/lib/game-data";
import { effectAddressKey, getCorruptionTargetEffect } from "./effect-address";
import type { CorruptionTarget } from "./numeric-targets";

export { getCorruptionTargetEffect } from "./effect-address";
export { getEditableCorruptionTargets } from "./numeric-targets";
export type { CorruptionTarget } from "./numeric-targets";

// Declarative rules for lines that need word-to-digit or singular/plural normalization
// after the raw numeric substitution. Each rule matches the replaced line and reformats it.
const PLURAL_LINE_RULES: Array<{ pattern: RegExp; format: (value: number) => string }> = [
  { pattern: /^Draw \d+ cards?$/i, format: (v) => (v === 1 ? "Draw a card" : `Draw ${v} cards`) },
  {
    pattern: /^Gain \d+ Mana Crystals?$/,
    format: (v) => `Gain ${v} Mana Crystal${v === 1 ? "" : "s"}`,
  },
  {
    pattern: /^Cleanse \d+ harmful status effects?$/,
    format: (v) => `Cleanse ${v} harmful status effect${v === 1 ? "" : "s"}`,
  },
];

export function replaceNumberAt(line: string, matchIndex: number, nextValue: number): string {
  if (line.startsWith("Your Companion acts ") && matchIndex === 20) {
    return `Your Companion acts ${nextValue === 1 ? "once" : nextValue === 2 ? "twice" : `${nextValue} times`}`;
  }
  // "Draw a card" has no leading digits at index 5 ("a card"), so handle word-to-digit conversion early.
  if (line === "Draw a card" && matchIndex === 5) return nextValue === 1 ? line : `Draw ${nextValue} cards`;
  if (matchIndex < 0 || matchIndex >= line.length) return line;
  const match = line.slice(matchIndex).match(CORRUPTION_TEXT_PATTERNS.leadingNumber);
  if (!match) return line;
  const replaced = `${line.slice(0, matchIndex)}${nextValue}${line.slice(matchIndex + match[0].length)}`;
  // Handle digit-to-word revert and singular/plural normalization.
  for (const rule of PLURAL_LINE_RULES) {
    if (rule.pattern.test(replaced)) return rule.format(nextValue);
  }
  return replaced;
}

export function updateCardNumericValue(card: BattleCard, target: CorruptionTarget, nextValue: number): BattleCard {
  const source = getCorruptionTargetEffect(card, target);
  const line = card.descriptionLines[target.lineIndex];
  if (!source || (source as Record<string, unknown>)[target.field] !== target.value || line === undefined) return card;
  if (target.field === "equalToGoldPercent") nextValue = Math.min(PERCENT_DENOMINATOR, nextValue);
  const nextLine = replaceNumberAt(line, target.matchIndex, nextValue);
  if (nextLine === line) return card;
  // Validate every shared edit before copying the tree; stale plans cannot
  // partially update either a branch or its description.
  if (!target.edits.length) return card;
  const editsByAddress = new Map<string, Array<(typeof target.edits)[number]>>();
  for (const edit of target.edits) {
    const effect = getCorruptionTargetEffect(card, edit);
    if (
      !effect ||
      effect.kind !== edit.kind ||
      (effect as Record<string, unknown>)[edit.field] !== edit.expectedValue
    ) {
      return card;
    }
    const key = effectAddressKey(edit);
    const edits = editsByAddress.get(key) ?? [];
    edits.push(edit);
    editsByAddress.set(key, edits);
  }
  function update(effect: BattleCardEffect, root: number, path: number[] = []): BattleCardEffect {
    const edits = editsByAddress.get(effectAddressKey({ effectIndex: root, effectPath: path }));
    if (edits) {
      const changed = { ...effect };
      for (const edit of edits) (changed as Record<string, unknown>)[edit.field] = nextValue * edit.multiplier;
      return changed;
    }
    return mapEffectChildren(effect, (child, index) => update(child, root, [...path, index]));
  }
  const effects = card.effects.map((effect, index) => update(effect, index));
  const conditionalLine = conditionalDamageDescription(source);
  const changed = getCorruptionTargetEffect({ ...card, effects }, target);
  const resolvedLine =
    conditionalLine === line && changed ? (conditionalDamageDescription(changed) ?? nextLine) : nextLine;
  return {
    ...card,
    descriptionLines: card.descriptionLines.map((entry, index) => (index === target.lineIndex ? resolvedLine : entry)),
    effects,
  };
}

export function applyNumericCorruption(card: BattleCard, target: CorruptionTarget, delta: number): BattleCard {
  const currentLine = card.descriptionLines[target.lineIndex];
  if (currentLine === undefined) return card;

  let nextValue = Math.max(CORRUPTION_MIN_VALUE, target.value + delta);
  if (target.field === "equalToGoldPercent") nextValue = Math.min(PERCENT_DENOMINATOR, nextValue);
  const sourceEffect = getCorruptionTargetEffect(card, target);
  if (sourceEffect?.kind === "companion-action") nextValue = Math.max(1, nextValue);
  if (
    sourceEffect?.kind === "random-damage" &&
    !target.edits.some((edit) => effectAddressKey(edit) === effectAddressKey(target) && edit.field !== target.field)
  ) {
    if (target.field === "minAmount") nextValue = Math.min(nextValue, sourceEffect.maxAmount);
    if (target.field === "maxAmount") nextValue = Math.max(nextValue, sourceEffect.minAmount);
  }
  if (nextValue === target.value) return card;
  const nextCard = updateCardNumericValue(card, target, nextValue);
  if (nextCard === card) return card;
  const deltaLen = nextCard.descriptionLines[target.lineIndex]!.length - currentLine.length;
  const shiftedExisting = (card.corruptedValuePositions ?? [])
    .filter((pos) => !(pos.lineIndex === target.lineIndex && pos.matchIndex === target.matchIndex))
    .map((pos) =>
      deltaLen !== 0 && pos.lineIndex === target.lineIndex && pos.matchIndex > target.matchIndex
        ? { ...pos, matchIndex: pos.matchIndex + deltaLen }
        : pos,
    );
  return {
    ...nextCard,
    corrupted: true,
    corruptedValuePositions: [
      ...shiftedExisting,
      { lineIndex: target.lineIndex, matchIndex: target.matchIndex },
    ].filter((position) => /^\d/.test(nextCard.descriptionLines[position.lineIndex]?.slice(position.matchIndex) ?? "")),
  };
}
