import { CORRUPTION_MIN_VALUE, CORRUPTION_TEXT_PATTERNS, PERCENT_DENOMINATOR } from "@/lib/game-constants";
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { conditionalDamageDescription, effectChildren, mapEffectChildren } from "@/lib/game-data";
import { capitalizeWord } from "@/lib/utils";

const CORRUPTIBLE_NUMERIC_FIELDS = [
  "amount",
  "blockDamageBonus",
  "amountIfTargetFrozen",
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

const WISHING_WELL_LINE = /^Gain (\d+) Gold or Wish$/;
const SHARED_RESOURCE_CHOICE_LINE = /^Gain (\d+) Mana, Gold, or Block$/;

function isSharedResourceChoiceEffect(effect: BattleCardEffect | undefined): boolean {
  return (
    effect?.kind === "restore-mana" ||
    effect?.kind === "gain-gold" ||
    (effect?.kind === "player-status" && effect.status === "block")
  );
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
  const alternative = /^Deal (\d+) (\w+) or (\w+) damage( at random)?$/.exec(line);
  if (alternative) {
    const first = alternative[2]?.toLowerCase();
    const second = alternative[3]?.toLowerCase();
    return (
      Number(alternative[1]) === effect.amount &&
      first !== undefined &&
      second !== undefined &&
      [first, second].includes(effect.damageType)
    );
  }
  const repeated = /^Deal (\d+) (\w+) damage twice$/.exec(line);
  return Boolean(repeated && Number(repeated[1]) === effect.amount && repeated[2]?.toLowerCase() === effect.damageType);
}

function isRepeatedDamageLine(line: string): boolean {
  return /^Deal \d+ \w+ damage twice$/.test(line);
}

function sharesCombinedDamageAmount(line: string, effect: BattleCardEffect): boolean {
  if (effect.kind !== "damage" && effect.kind !== "self-damage") return false;
  const match = /^Deal and Receive (\d+) (\w+) damage$/.exec(line);
  return Boolean(match && Number(match[1]) === effect.amount && match[2]?.toLowerCase() === effect.damageType);
}

export function getEditableCorruptionTargets(card: BattleCard): CorruptionTarget[] {
  const targets: CorruptionTarget[] = [];
  const valueQueue = new Map<number, Array<Pick<CorruptionTarget, "effectIndex" | "effectPath" | "field">>>();
  const sharedDamageLines = new Set<string>();
  const combinedDamageTargets = new Map<number, CorruptionTarget>();
  const conditionalLines = new Set<number>();
  function collect(effect: BattleCardEffect, effectIndex: number, effectPath: number[] = []) {
    const conditional = conditionalDamageDescription(effect);
    if (conditional && effect.kind === "damage") {
      const lineIndex = card.descriptionLines.findIndex(
        (line, index) => line === conditional && !conditionalLines.has(index),
      );
      if (lineIndex < 0) {
        // Ice Shot's player-facing split description intentionally keeps the
        // doubled Frozen amount implicit while retaining the base amount as an
        // editable value.
        if (
          effect.damageTypeIfTargetFrozen === effect.damageType &&
          card.descriptionLines.includes("Doubled against Frozen enemies")
        ) {
          const baseLine = `Deal ${effect.amount} ${capitalizeWord(effect.damageType)} damage`;
          const baseLineIndex = card.descriptionLines.findIndex((line) => line === baseLine);
          if (baseLineIndex >= 0) {
            conditionalLines.add(baseLineIndex);
            targets.push({
              lineIndex: baseLineIndex,
              matchIndex: baseLine.indexOf(String(effect.amount)),
              value: effect.amount,
              effectIndex,
              ...(effectPath.length ? { effectPath } : {}),
              field: "amount",
            });
          }
        }
        return;
      }
      conditionalLines.add(lineIndex);
      const fields: Array<CorruptibleNumericField | null> =
        effect.blockCost !== undefined
          ? ["amount", null, "blockDamageBonus"]
          : effect.damageTypeIfTargetFrozen
            ? ["amount", "amountIfTargetFrozen"]
            : ["amount", null];
      [...conditional.matchAll(CORRUPTION_TEXT_PATTERNS.authoredNumber)].forEach((match, index) => {
        const field = fields[index];
        if (field && match.index !== undefined)
          targets.push({
            lineIndex,
            matchIndex: match.index,
            value: Number(match[0]),
            effectIndex,
            ...(effectPath.length ? { effectPath } : {}),
            field,
          });
      });
      return;
    }
    // The die's faces are fixed rules, not editable card magnitudes.
    if (effect.kind === "random-draw") return;
    // These fixed effects have implicit quantities, so they cannot claim a
    // matching number from a later effect's description.
    if (effect.kind === "wish" && card.descriptionLines.some((line) => WISHING_WELL_LINE.test(line))) return;
    if (effect.kind === "remove-harmful-status" && card.descriptionLines.includes("Cleanse a harmful status effect"))
      return;
    if (effect.kind === "damage") {
      const lineIndex = card.descriptionLines.findIndex((line) => sharesCombinedDamageAmount(line, effect));
      if (lineIndex >= 0 && !combinedDamageTargets.has(lineIndex)) {
        const line = card.descriptionLines[lineIndex]!;
        combinedDamageTargets.set(lineIndex, {
          lineIndex,
          matchIndex: line.indexOf(String(effect.amount)),
          value: effect.amount,
          effectIndex,
          ...(effectPath.length ? { effectPath } : {}),
          field: "amount",
        });
      }
    }
    const record = effect as Record<string, unknown>;
    for (const field of CORRUPTIBLE_NUMERIC_FIELDS) {
      if (
        field === "amount" &&
        (((effect.kind === "remove-enemy-armor" || effect.kind === "remove-harmful-status") && effect.removeAll) ||
          (effect.kind === "damage" && effect.equalToForge))
      )
        continue;
      if (field === "maxAmount" && hasSharedRandomAmount(card, effect)) continue;
      if (field === "amount" && card.descriptionLines.some((line) => sharesCombinedDamageAmount(line, effect)))
        continue;
      if (field === "amount") {
        const lineIndex = card.descriptionLines.findIndex((line) => sharesDamageAmount(line, effect));
        if (lineIndex >= 0 && (effectPath.length > 0 || isRepeatedDamageLine(card.descriptionLines[lineIndex]!))) {
          const key = isRepeatedDamageLine(card.descriptionLines[lineIndex]!)
            ? `repeat/${lineIndex}`
            : `${effectIndex}/${lineIndex}`;
          if (sharedDamageLines.has(key)) continue;
          sharedDamageLines.add(key);
        }
      }
      const value = record[field];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const queue = valueQueue.get(value);
      const entry = { effectIndex, ...(effectPath.length ? { effectPath } : {}), field };
      if (!queue) {
        valueQueue.set(value, [entry]);
      } else {
        queue.push(entry);
      }
    }
    effectChildren(effect).forEach((child, index) => collect(child, effectIndex, [...effectPath, index]));
  }
  card.effects.forEach((effect, index) => collect(effect, index));
  const queueCursor = new Map<number, number>();

  card.descriptionLines.forEach((line, lineIndex) => {
    if (conditionalLines.has(lineIndex)) return;
    // The summon summary describes the Companion's actions, not this card's effects.
    if (lineIndex === 0 && card.effects.some((effect) => effect.kind === "summon-companion")) return;
    const combinedTarget = combinedDamageTargets.get(lineIndex);
    if (combinedTarget) {
      targets.push(combinedTarget);
      return;
    }
    const wishingWellMatch = WISHING_WELL_LINE.exec(line);
    if (wishingWellMatch) {
      const value = Number(wishingWellMatch[1]);
      const goldEntry = valueQueue.get(value)?.find((entry) => {
        const effect = getCorruptionTargetEffect(card, {
          lineIndex,
          matchIndex: 0,
          value,
          ...entry,
        });
        return effect?.kind === "gain-gold";
      });
      if (goldEntry) {
        targets.push({
          lineIndex,
          matchIndex: line.indexOf(wishingWellMatch[1]!),
          value,
          ...goldEntry,
        });
        const queue = valueQueue.get(value)!;
        queue.splice(queue.indexOf(goldEntry), 1);
      }
      return;
    }
    const matches =
      line === "Draw a card"
        ? [{ index: 5, 0: "1" }]
        : line === "Your Companion acts twice"
          ? [{ index: 20, 0: "2" }]
          : line === "Your Companion acts once"
            ? [{ index: 20, 0: "1" }]
            : [...line.matchAll(CORRUPTION_TEXT_PATTERNS.authoredNumber)];
    const sharedResourceChoice = SHARED_RESOURCE_CHOICE_LINE.exec(line);
    if (sharedResourceChoice) {
      const value = Number(sharedResourceChoice[1]);
      const queue = valueQueue.get(value) ?? [];
      const cursor = queueCursor.get(value) ?? 0;
      const matchIndex = line.indexOf(sharedResourceChoice[1]!);
      let root: number | undefined;
      for (let index = cursor; index < queue.length; index++) {
        const entry = queue[index]!;
        if (root !== undefined && entry.effectIndex !== root) break;
        const effect = getCorruptionTargetEffect(card, {
          lineIndex,
          matchIndex,
          value,
          ...entry,
        });
        if (!isSharedResourceChoiceEffect(effect)) continue;
        if (root === undefined) targets.push({ lineIndex, matchIndex, value, ...entry });
        root = entry.effectIndex;
        queueCursor.set(value, index + 1);
      }
      return;
    }
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

  return targets.sort((a, b) => a.lineIndex - b.lineIndex || a.matchIndex - b.matchIndex);
}

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

export function getCorruptionTargetEffect(card: BattleCard, target: CorruptionTarget): BattleCardEffect | undefined {
  let effect = card.effects[target.effectIndex];
  for (const index of target.effectPath ?? []) {
    if (!effect) return undefined;
    effect = effectChildren(effect)[index];
  }
  return effect;
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
