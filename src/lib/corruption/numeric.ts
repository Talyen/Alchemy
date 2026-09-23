import { CORRUPTION_MIN_VALUE, CORRUPTION_TEXT_PATTERNS, PERCENT_DENOMINATOR } from "@/lib/game-constants";
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { conditionalDamageDescription, mapEffectChildren } from "@/lib/game-data";
import {
  getEditableCorruptionTargets,
  getCorruptionTargetEffect,
  hasSharedRandomAmount,
  isRepeatedDamageLine,
  isSharedResourceChoiceEffect,
  sharesCombinedDamageAmount,
  sharesDamageAmount,
  SHARED_RESOURCE_CHOICE_LINE,
  type CorruptionTarget,
} from "./numeric-targets";

export { getEditableCorruptionTargets, getCorruptionTargetEffect } from "./numeric-targets";
export type { CorruptionTarget } from "./numeric-targets";

function areEffectsEquivalent(a: BattleCardEffect, b: BattleCardEffect | undefined): boolean {
  if (!b) return false;
  if (a === b) return true;
  if (a.kind !== b.kind) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  return aKeys.every((key) => aRecord[key] === bRecord[key]);
}

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
  // Handle digit-to-word revert when value becomes 1.
  if (/^Draw \d+ cards?$/i.test(replaced)) return nextValue === 1 ? "Draw a card" : `Draw ${nextValue} cards`;
  if (/^Gain \d+ Mana Crystals?$/.test(replaced)) return `Gain ${nextValue} Mana Crystal${nextValue === 1 ? "" : "s"}`;
  if (/^Cleanse \d+ harmful status effects?$/.test(replaced))
    return `Cleanse ${nextValue} harmful status effect${nextValue === 1 ? "" : "s"}`;
  return replaced;
}

export function updateCardNumericValue(
  card: BattleCard,
  target: CorruptionTarget,
  nextValue: number,
  authoredPaths?: ReadonlySet<string>,
): BattleCard {
  const source = getCorruptionTargetEffect(card, target);
  const line = card.descriptionLines[target.lineIndex];
  if (!source || (source as Record<string, unknown>)[target.field] !== target.value || line === undefined) return card;
  if (target.field === "equalToGoldPercent") nextValue = Math.min(PERCENT_DENOMINATOR, nextValue);
  const nextLine = replaceNumberAt(line, target.matchIndex, nextValue);
  const sharedResourceChoice = SHARED_RESOURCE_CHOICE_LINE.test(line);
  if (nextLine === line && !sharedResourceChoice) return card;
  const pathKey = (root: number, path: number[]) => [root, ...path].join("/");
  const selected = pathKey(target.effectIndex, target.effectPath ?? []);
  const authored =
    authoredPaths ??
    new Set(getEditableCorruptionTargets(card).map((entry) => pathKey(entry.effectIndex, entry.effectPath ?? [])));
  const sharedDamageLine = target.field === "amount" && sharesDamageAmount(line, source) ? line : null;
  const combinedDamageLine = target.field === "amount" && sharesCombinedDamageAmount(line, source) ? line : null;
  function update(effect: BattleCardEffect, root: number, path: number[] = []): BattleCardEffect {
    const key = pathKey(root, path);
    const sharedResourceEffect =
      sharedResourceChoice && root === target.effectIndex && isSharedResourceChoiceEffect(effect);
    if (
      key === selected ||
      (sharedResourceEffect && target.field === "amount") ||
      (sharedDamageLine !== null &&
        sharesDamageAmount(sharedDamageLine, effect) &&
        (root === target.effectIndex || isRepeatedDamageLine(sharedDamageLine))) ||
      (combinedDamageLine !== null && sharesCombinedDamageAmount(combinedDamageLine, effect)) ||
      (path.length > 0 && !authored.has(key) && areEffectsEquivalent(effect, source))
    ) {
      if (effect.kind === "random-damage" && target.field === "minAmount" && hasSharedRandomAmount(card, effect)) {
        return { ...effect, minAmount: nextValue, maxAmount: nextValue };
      }
      if (
        effect.kind === "damage" &&
        target.field === "amount" &&
        effect.damageTypeIfTargetFrozen === effect.damageType &&
        card.descriptionLines.includes("Doubled against Frozen enemies")
      ) {
        return { ...effect, amount: nextValue, amountIfTargetFrozen: nextValue * 2 };
      }
      return { ...effect, [target.field]: nextValue };
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

export function applyNumericCorruption(
  card: BattleCard,
  target: CorruptionTarget,
  delta: number,
  authoredPaths?: ReadonlySet<string>,
): BattleCard {
  const currentLine = card.descriptionLines[target.lineIndex];
  if (currentLine === undefined) return card;

  let nextValue = Math.max(CORRUPTION_MIN_VALUE, target.value + delta);
  if (target.field === "equalToGoldPercent") nextValue = Math.min(PERCENT_DENOMINATOR, nextValue);
  const sourceEffect = getCorruptionTargetEffect(card, target);
  if (sourceEffect?.kind === "companion-action") nextValue = Math.max(1, nextValue);
  if (sourceEffect?.kind === "random-damage" && !hasSharedRandomAmount(card, sourceEffect)) {
    if (target.field === "minAmount") nextValue = Math.min(nextValue, sourceEffect.maxAmount);
    if (target.field === "maxAmount") nextValue = Math.max(nextValue, sourceEffect.minAmount);
  }
  if (nextValue === target.value) return card;
  const nextLine = replaceNumberAt(currentLine, target.matchIndex, nextValue);
  if (nextLine === currentLine && target.value !== nextValue) return card;

  const nextCard = updateCardNumericValue(card, target, nextValue, authoredPaths);
  if (nextCard === card) return card;
  nextCard.corrupted = true;
  const deltaLen = nextCard.descriptionLines[target.lineIndex]!.length - currentLine.length;
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
  ].filter((position) => /^\d/.test(nextCard.descriptionLines[position.lineIndex]?.slice(position.matchIndex) ?? ""));
  return nextCard;
}
