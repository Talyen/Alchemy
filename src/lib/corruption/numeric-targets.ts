import { CORRUPTION_TEXT_PATTERNS } from "@/lib/game-constants";
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { conditionalDamageDescription, effectChildren, effectDescriptionLine } from "@/lib/game-data";
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
export const SHARED_RESOURCE_CHOICE_LINE = /^Gain (\d+) Mana, Gold, or Block$/;

export function isSharedResourceChoiceEffect(effect: BattleCardEffect | undefined): boolean {
  return (
    effect?.kind === "restore-mana" ||
    effect?.kind === "gain-gold" ||
    (effect?.kind === "player-status" && effect.status === "block")
  );
}

export function hasSharedRandomAmount(card: BattleCard, effect: BattleCardEffect): boolean {
  return (
    effect.kind === "random-damage" &&
    effect.minAmount === effect.maxAmount &&
    card.descriptionLines.some((line) => line.includes(`Deal ${effect.minAmount} Random damage`))
  );
}

export function sharesDamageAmount(line: string, effect: BattleCardEffect): boolean {
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

export function isRepeatedDamageLine(line: string): boolean {
  return /^Deal \d+ \w+ damage twice$/.test(line);
}

export function sharesCombinedDamageAmount(line: string, effect: BattleCardEffect): boolean {
  if (effect.kind !== "damage" && effect.kind !== "self-damage") return false;
  const match = /^Deal and Receive (\d+) (\w+) damage$/.exec(line);
  return Boolean(match && Number(match[1]) === effect.amount && match[2]?.toLowerCase() === effect.damageType);
}

interface NumericBinding {
  value: number;
  effectIndex: number;
  effectPath?: number[];
  field: CorruptibleNumericField;
  effect: BattleCardEffect;
  claimed: boolean;
}

// Only effects with a standalone description can claim a whole line by
// wording. Compound and recursive effects still use authored order below.
const CANONICAL_LINE_KINDS: ReadonlySet<BattleCardEffect["kind"]> = new Set([
  "damage",
  "random-damage",
  "heal",
  "restore-mana",
  "lose-mana",
  "lose-max-mana",
  "gain-max-mana",
  "gain-gold",
  "wish",
  "companion-action",
  "self-damage",
  "draw-cards",
]);

function canonicalLine(effect: BattleCardEffect): string | null {
  return CANONICAL_LINE_KINDS.has(effect.kind) ? effectDescriptionLine(effect) : null;
}

// A description number can only claim one effect field. Keeping claims on the
// bindings avoids coordinating a mutable queue, a cursor, and special-case
// splices when several effects happen to have the same amount.
function createBindingLedger() {
  const bindings: NumericBinding[] = [];
  return {
    add(binding: Omit<NumericBinding, "claimed">) {
      bindings.push({ ...binding, claimed: false });
    },
    claim(value: number, line?: string, accepts: (binding: NumericBinding) => boolean = () => true) {
      const available = (candidate: NumericBinding) =>
        !candidate.claimed && candidate.value === value && accepts(candidate);
      const binding =
        (line
          ? bindings.find((candidate) => available(candidate) && canonicalLine(candidate.effect) === line)
          : undefined) ?? bindings.find(available);
      if (binding) binding.claimed = true;
      return binding;
    },
    claimSharedResource(value: number) {
      const first = bindings.findIndex(
        (binding) => !binding.claimed && binding.value === value && isSharedResourceChoiceEffect(binding.effect),
      );
      if (first < 0) return undefined;
      const selected = bindings[first]!;
      for (let index = first; index < bindings.length; index++) {
        const binding = bindings[index]!;
        if (binding.effectIndex !== selected.effectIndex) break;
        if (binding.value === value && isSharedResourceChoiceEffect(binding.effect)) binding.claimed = true;
      }
      return selected;
    },
  };
}

function targetFromBinding(binding: NumericBinding, lineIndex: number, matchIndex: number): CorruptionTarget {
  return {
    lineIndex,
    matchIndex,
    value: binding.value,
    effectIndex: binding.effectIndex,
    ...(binding.effectPath ? { effectPath: binding.effectPath } : {}),
    field: binding.field,
  };
}

export function getEditableCorruptionTargets(card: BattleCard): CorruptionTarget[] {
  const targets: CorruptionTarget[] = [];
  const bindings = createBindingLedger();
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
      bindings.add({ value, effectIndex, ...(effectPath.length ? { effectPath } : {}), field, effect });
    }
    effectChildren(effect).forEach((child, index) => collect(child, effectIndex, [...effectPath, index]));
  }
  card.effects.forEach((effect, index) => collect(effect, index));

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
      const goldEntry = bindings.claim(value, line, (entry) => entry.effect.kind === "gain-gold");
      if (goldEntry) {
        targets.push(targetFromBinding(goldEntry, lineIndex, line.indexOf(wishingWellMatch[1]!)));
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
      const matchIndex = line.indexOf(sharedResourceChoice[1]!);
      const shared = bindings.claimSharedResource(value);
      if (shared) targets.push(targetFromBinding(shared, lineIndex, matchIndex));
      return;
    }
    for (const match of matches) {
      const matchIndex = match.index;
      if (matchIndex === undefined) continue;
      const value = Number(match[0]);
      const matched = bindings.claim(value, line);
      if (!matched) continue;
      targets.push(targetFromBinding(matched, lineIndex, matchIndex));
    }
  });

  return targets.sort((a, b) => a.lineIndex - b.lineIndex || a.matchIndex - b.matchIndex);
}

export function getCorruptionTargetEffect(card: BattleCard, target: CorruptionTarget): BattleCardEffect | undefined {
  let effect = card.effects[target.effectIndex];
  for (const index of target.effectPath ?? []) {
    if (!effect) return undefined;
    effect = effectChildren(effect)[index];
  }
  return effect;
}
