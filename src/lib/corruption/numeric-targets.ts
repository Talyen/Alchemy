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

interface NumericTarget {
  lineIndex: number;
  matchIndex: number;
  value: number;
  effectIndex: number;
  effectPath?: number[];
  field: CorruptibleNumericField;
}

interface NumericEffectAddress {
  effectIndex: number;
  effectPath?: number[];
}

interface NumericEffectEdit extends NumericEffectAddress {
  kind: BattleCardEffect["kind"];
  field: CorruptibleNumericField;
  expectedValue: number;
  multiplier: 1 | 2;
}

/** One displayed value and every effect field it owns, resolved during discovery. */
export interface CorruptionTarget extends NumericTarget {
  edits: readonly NumericEffectEdit[];
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

function targetFromBinding(binding: NumericBinding, lineIndex: number, matchIndex: number): NumericTarget {
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
  const targets: NumericTarget[] = [];
  const bindings = createBindingLedger();
  const sharedDamageLines = new Set<string>();
  const combinedDamageTargets = new Map<number, NumericTarget>();
  const conditionalLines = new Set<number>();
  const implicitScheduledPaths = new Set<string>();
  card.effects.forEach((effect, index) => {
    const previous = card.effects[index - 1];
    if (
      previous?.kind === "damage" &&
      !previous.lifesteal &&
      effect.kind === "repeat-over-turns" &&
      effect.remainingTurns === 1 &&
      effect.effects.length === 1 &&
      areEffectsEquivalent(previous, effect.effects[0]!) &&
      card.descriptionLines.includes(`${effectDescriptionLine(previous)} this turn and next`)
    )
      implicitScheduledPaths.add(effectAddressKey({ effectIndex: index, effectPath: [0] }));
  });
  function collect(effect: BattleCardEffect, effectIndex: number, effectPath: number[] = []) {
    // The immediate line already owns this delayed copy. It must not claim a
    // separately displayed delayed value just because the amounts are equal.
    if (implicitScheduledPaths.has(effectAddressKey({ effectIndex, effectPath }))) return;
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
        // Capture group starts after "Gain " (5 chars) in the WISHING_WELL_LINE pattern.
        targets.push(targetFromBinding(goldEntry, lineIndex, 5));
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
      // Capture group starts after "Gain " (5 chars) in the SHARED_RESOURCE_CHOICE_LINE pattern.
      const shared = bindings.claimSharedResource(value);
      if (shared) targets.push(targetFromBinding(shared, lineIndex, 5));
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

  const authored = new Set(targets.map(effectAddressKey));
  return targets
    .sort((a, b) => a.lineIndex - b.lineIndex || a.matchIndex - b.matchIndex)
    .map((target) => bindTargetEdits(card, target, authored));
}

export function getCorruptionTargetEffect(
  card: BattleCard,
  target: NumericEffectAddress,
): BattleCardEffect | undefined {
  let effect = card.effects[target.effectIndex];
  for (const index of target.effectPath ?? []) {
    if (!effect) return undefined;
    effect = effectChildren(effect)[index];
  }
  return effect;
}

function effectAddressKey(address: NumericEffectAddress): string {
  return [address.effectIndex, ...(address.effectPath ?? [])].join("/");
}

function areEffectsEquivalent(a: BattleCardEffect, b: BattleCardEffect): boolean {
  if (a === b) return true;
  if (a.kind !== b.kind) return false;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  return aKeys.every((key) => aRecord[key] === bRecord[key]);
}

function bindTargetEdits(card: BattleCard, target: NumericTarget, authored: ReadonlySet<string>): CorruptionTarget {
  const source = getCorruptionTargetEffect(card, target)!;
  const line = card.descriptionLines[target.lineIndex]!;
  const selected = effectAddressKey(target);
  const sharedResourceChoice = SHARED_RESOURCE_CHOICE_LINE.test(line);
  const sharedDamage = target.field === "amount" && sharesDamageAmount(line, source);
  const combinedDamage = target.field === "amount" && sharesCombinedDamageAmount(line, source);
  const edits: NumericEffectEdit[] = [];

  function collect(effect: BattleCardEffect, effectIndex: number, effectPath: number[] = []) {
    const address = { effectIndex, ...(effectPath.length ? { effectPath } : {}) };
    const key = effectAddressKey(address);
    const sharesValue =
      key === selected ||
      (sharedResourceChoice &&
        effectIndex === target.effectIndex &&
        isSharedResourceChoiceEffect(effect) &&
        target.field === "amount") ||
      (sharedDamage &&
        sharesDamageAmount(line, effect) &&
        (effectIndex === target.effectIndex || isRepeatedDamageLine(line))) ||
      (combinedDamage && sharesCombinedDamageAmount(line, effect)) ||
      (effectPath.length > 0 && !authored.has(key) && areEffectsEquivalent(effect, source));
    if (sharesValue) {
      const add = (field: CorruptibleNumericField, multiplier: 1 | 2 = 1) => {
        edits.push({
          ...address,
          kind: effect.kind,
          field,
          expectedValue: (effect as Record<string, unknown>)[field] as number,
          multiplier,
        });
      };
      add(target.field);
      if (effect.kind === "random-damage" && target.field === "minAmount" && hasSharedRandomAmount(card, effect))
        add("maxAmount");
      if (
        effect.kind === "damage" &&
        target.field === "amount" &&
        effect.damageTypeIfTargetFrozen === effect.damageType &&
        card.descriptionLines.includes("Doubled against Frozen enemies")
      )
        add("amountIfTargetFrozen", 2);
      // A matched effect owns its edit; its children are separate effect addresses.
      return;
    }
    effectChildren(effect).forEach((child, index) => collect(child, effectIndex, [...effectPath, index]));
  }
  card.effects.forEach((effect, index) => collect(effect, index));
  return { ...target, edits };
}
