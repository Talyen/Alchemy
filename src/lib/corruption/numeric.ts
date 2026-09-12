import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { CORRUPTION_MIN_VALUE, CORRUPTION_TEXT_PATTERNS, PERCENT_DENOMINATOR } from "@/lib/game-constants";

const CORRUPTIBLE_NUMERIC_FIELDS = [
  "amount",
  "minAmount",
  "maxAmount",
  "perManaCrystal",
  "convertCurrentMana",
  "equalToGoldPercent",
] as const;

type CorruptibleNumericField = (typeof CORRUPTIBLE_NUMERIC_FIELDS)[number];

export interface CorruptionTarget {
  lineIndex: number;
  matchIndex: number;
  value: number;
  effectIndex: number;
  effectPath?: number[];
  field: CorruptibleNumericField;
}

function nestedEffects(effect: BattleCardEffect): BattleCardEffect[] {
  if (effect.kind === "repeat-over-turns") return effect.effects;
  if (effect.kind === "chance") return [...effect.successEffects, ...effect.failureEffects];
  return [];
}

function hasSharedRandomAmount(card: BattleCard, effect: BattleCardEffect): boolean {
  return (
    effect.kind === "random-damage" &&
    effect.minAmount === effect.maxAmount &&
    card.descriptionLines.some((line) => line.includes(`Deal ${effect.minAmount} Random damage`))
  );
}

function sharesDamageAmount(line: string, effect: BattleCardEffect): boolean {
  if (effect.kind !== "damage") return false;
  const match = /^Deal (\d+) (\w+) or (\w+) damage$/.exec(line);
  return (
    match !== null &&
    Number(match[1]) === effect.amount &&
    [match[2]!.toLowerCase(), match[3]!.toLowerCase()].includes(effect.damageType)
  );
}

export function getEditableCorruptionTargets(card: BattleCard): CorruptionTarget[] {
  const targets: CorruptionTarget[] = [];
  const valueQueue = new Map<number, Array<Pick<CorruptionTarget, "effectIndex" | "effectPath" | "field">>>();
  const sharedDamageLines = new Set<string>();
  function collect(effect: BattleCardEffect, effectIndex: number, effectPath: number[] = []) {
    // The die's faces are fixed rules, not editable card magnitudes.
    if (effect.kind === "random-draw") return;
    const record = effect as Record<string, unknown>;
    for (const field of CORRUPTIBLE_NUMERIC_FIELDS) {
      if (
        field === "amount" &&
        ((effect.kind === "remove-enemy-armor" && effect.removeAll) ||
          (effect.kind === "damage" && effect.equalToForge))
      )
        continue;
      if (field === "maxAmount" && hasSharedRandomAmount(card, effect)) continue;
      if (field === "amount" && effectPath.length > 0) {
        const lineIndex = card.descriptionLines.findIndex((line) => sharesDamageAmount(line, effect));
        if (lineIndex >= 0) {
          const key = `${effectIndex}/${lineIndex}`;
          if (sharedDamageLines.has(key)) continue;
          sharedDamageLines.add(key);
        }
      }
      const value = record[field];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      if (!valueQueue.has(value)) valueQueue.set(value, []);
      valueQueue.get(value)!.push({ effectIndex, ...(effectPath.length ? { effectPath } : {}), field });
    }
    nestedEffects(effect).forEach((child, index) => collect(child, effectIndex, [...effectPath, index]));
  }
  card.effects.forEach((effect, index) => collect(effect, index));
  const queueCursor = new Map<number, number>();

  card.descriptionLines.forEach((line, lineIndex) => {
    // The summon summary describes the Companion's actions, not this card's effects.
    if (lineIndex === 0 && card.effects.some((effect) => effect.kind === "summon-companion")) return;
    const matches =
      line === "Draw a card"
        ? [{ index: 5, 0: "1" }]
        : line === "Your Companion acts twice"
          ? [{ index: 20, 0: "2" }]
          : line === "Your Companion acts once"
            ? [{ index: 20, 0: "1" }]
            : [...line.matchAll(CORRUPTION_TEXT_PATTERNS.authoredNumber)];
    for (const match of matches) {
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
      targets.push({ lineIndex, matchIndex, value, ...matched });
    }
  });

  return targets;
}

export function replaceNumberAt(line: string, matchIndex: number, nextValue: number): string {
  if (line.startsWith("Your Companion acts ") && matchIndex === 20) {
    return `Your Companion acts ${nextValue === 1 ? "once" : nextValue === 2 ? "twice" : `${nextValue} times`}`;
  }
  if (line === "Draw a card" && matchIndex === 5) return nextValue === 1 ? line : `Draw ${nextValue} cards`;
  if (matchIndex < 0 || matchIndex >= line.length) return line;
  const match = line.slice(matchIndex).match(CORRUPTION_TEXT_PATTERNS.leadingNumber);
  if (!match) return line;
  const replaced = `${line.slice(0, matchIndex)}${nextValue}${line.slice(matchIndex + match[0].length)}`;
  if (/^Draw \d+ cards?$/i.test(replaced)) return nextValue === 1 ? "Draw a card" : `Draw ${nextValue} cards`;
  if (/^Gain \d+ Mana Crystals?$/.test(replaced)) return `Gain ${nextValue} Mana Crystal${nextValue === 1 ? "" : "s"}`;
  if (/^Cleanse \d+ harmful status effects?$/.test(replaced))
    return `Cleanse ${nextValue} harmful status effect${nextValue === 1 ? "" : "s"}`;
  return replaced;
}

export function getCorruptionTargetEffect(card: BattleCard, target: CorruptionTarget): BattleCardEffect | undefined {
  let effect = card.effects[target.effectIndex];
  for (const index of target.effectPath ?? []) {
    if (!effect) return undefined;
    effect = nestedEffects(effect)[index];
  }
  return effect;
}

export function updateCardNumericValue(card: BattleCard, target: CorruptionTarget, nextValue: number): BattleCard {
  const source = getCorruptionTargetEffect(card, target);
  const line = card.descriptionLines[target.lineIndex];
  if (!source || (source as Record<string, unknown>)[target.field] !== target.value || line === undefined) return card;
  if (target.field === "equalToGoldPercent") nextValue = Math.min(PERCENT_DENOMINATOR, nextValue);
  const nextLine = replaceNumberAt(line, target.matchIndex, nextValue);
  if (nextLine === line) return card;
  const pathKey = (root: number, path: number[]) => [root, ...path].join("/");
  const selected = pathKey(target.effectIndex, target.effectPath ?? []);
  const authored = new Set(
    getEditableCorruptionTargets(card).map((entry) => pathKey(entry.effectIndex, entry.effectPath ?? [])),
  );
  const sharedDamageLine = target.field === "amount" && sharesDamageAmount(line, source) ? line : null;
  function update(effect: BattleCardEffect, root: number, path: number[] = []): BattleCardEffect {
    const key = pathKey(root, path);
    if (
      key === selected ||
      (root === target.effectIndex && sharedDamageLine !== null && sharesDamageAmount(sharedDamageLine, effect)) ||
      (path.length > 0 && !authored.has(key) && JSON.stringify(effect) === JSON.stringify(source))
    ) {
      if (effect.kind === "random-damage" && target.field === "minAmount" && hasSharedRandomAmount(card, effect)) {
        return { ...effect, minAmount: nextValue, maxAmount: nextValue };
      }
      return { ...effect, [target.field]: nextValue };
    }
    if (effect.kind === "chance") {
      return {
        ...effect,
        successEffects: effect.successEffects.map((child, index) => update(child, root, [...path, index])),
        failureEffects: effect.failureEffects.map((child, index) =>
          update(child, root, [...path, effect.successEffects.length + index]),
        ),
      };
    }
    return effect.kind === "repeat-over-turns"
      ? { ...effect, effects: effect.effects.map((child, index) => update(child, root, [...path, index])) }
      : effect;
  }
  return {
    ...card,
    descriptionLines: card.descriptionLines.map((entry, index) => (index === target.lineIndex ? nextLine : entry)),
    effects: card.effects.map((effect, index) => update(effect, index)),
  };
}

export function applyNumericCorruption(card: BattleCard, target: CorruptionTarget, delta: number): BattleCard {
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

  const nextCard = updateCardNumericValue(card, target, nextValue);
  if (nextCard === card) return card;
  nextCard.corrupted = true;
  const deltaLen = nextLine.length - currentLine.length;
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
