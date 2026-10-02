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
export interface CorruptionTarget extends NumericEffectAddress {
  lineIndex: number;
  matchIndex: number;
  value: number;
  field: CorruptibleNumericField;
  edits: readonly NumericEffectEdit[];
}

interface EffectNode extends NumericEffectAddress {
  effect: BattleCardEffect;
}

interface NumericBinding extends EffectNode {
  value: number;
  field: CorruptibleNumericField;
  edits: NumericEffectEdit[];
  claimed: boolean;
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
  const match = /^Deal (\d+) (\w+)(?: or (\w+) damage(?: at random)?| damage twice)$/.exec(line);
  return Boolean(
    match &&
    Number(match[1]) === effect.amount &&
    [match[2], match[3]].some((type) => type?.toLowerCase() === effect.damageType),
  );
}

function isRepeatedDamageLine(line: string): boolean {
  return /^Deal \d+ \w+ damage twice$/.test(line);
}

function sharesCombinedDamageAmount(line: string, effect: BattleCardEffect): boolean {
  if (effect.kind !== "damage" && effect.kind !== "self-damage") return false;
  const match = /^Deal and Receive (\d+) (\w+) damage$/.exec(line);
  return Boolean(match && Number(match[1]) === effect.amount && match[2]?.toLowerCase() === effect.damageType);
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

function targetFromBinding(
  binding: NumericBinding,
  lineIndex: number,
  matchIndex: number,
): CorruptionTarget & { edits: NumericEffectEdit[] } {
  return {
    lineIndex,
    matchIndex,
    value: binding.value,
    effectIndex: binding.effectIndex,
    ...(binding.effectPath ? { effectPath: binding.effectPath } : {}),
    field: binding.field,
    edits: binding.edits,
  };
}

function numericEdit(node: EffectNode, field: CorruptibleNumericField, multiplier: 1 | 2 = 1): NumericEffectEdit {
  return {
    effectIndex: node.effectIndex,
    ...(node.effectPath ? { effectPath: node.effectPath } : {}),
    kind: node.effect.kind,
    field,
    expectedValue: (node.effect as Record<string, unknown>)[field] as number,
    multiplier,
  };
}

export function getEditableCorruptionTargets(card: BattleCard): CorruptionTarget[] {
  const targets: Array<ReturnType<typeof targetFromBinding>> = [];
  const bindings: NumericBinding[] = [];
  const nodes: EffectNode[] = [];
  const sharedBindings = new Map<string, NumericBinding>();
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

  function bindingFor(node: EffectNode, field: CorruptibleNumericField): NumericBinding {
    const edits = [numericEdit(node, field)];
    if (field === "minAmount" && hasSharedRandomAmount(card, node.effect)) edits.push(numericEdit(node, "maxAmount"));
    if (
      node.effect.kind === "damage" &&
      field === "amount" &&
      node.effect.damageTypeIfTargetFrozen === node.effect.damageType &&
      card.descriptionLines.includes("Doubled against Frozen enemies")
    )
      edits.push(numericEdit(node, "amountIfTargetFrozen", 2));
    return { ...node, field, value: edits[0]!.expectedValue, edits, claimed: false };
  }

  function addTarget(node: EffectNode, field: CorruptibleNumericField, lineIndex: number, matchIndex: number) {
    targets.push(targetFromBinding(bindingFor(node, field), lineIndex, matchIndex));
  }

  function collect(effect: BattleCardEffect, effectIndex: number, effectPath: number[] = []) {
    const node = { effect, effectIndex, ...(effectPath.length ? { effectPath } : {}) };
    nodes.push(node);
    // This delayed copy shares the immediate value; it cannot claim another line.
    if (implicitScheduledPaths.has(effectAddressKey(node))) return;
    const conditional = conditionalDamageDescription(effect);
    if (conditional && effect.kind === "damage") {
      const lineIndex = card.descriptionLines.findIndex(
        (line, index) => line === conditional && !conditionalLines.has(index),
      );
      if (lineIndex >= 0) {
        conditionalLines.add(lineIndex);
        const fields: Array<CorruptibleNumericField | null> =
          effect.blockCost !== undefined
            ? ["amount", null, "blockDamageBonus"]
            : effect.damageTypeIfTargetFrozen
              ? ["amount", "amountIfTargetFrozen"]
              : ["amount", null];
        [...conditional.matchAll(CORRUPTION_TEXT_PATTERNS.authoredNumber)].forEach((match, index) => {
          const field = fields[index];
          if (field && match.index !== undefined) addTarget(node, field, lineIndex, match.index);
        });
      } else if (
        effect.damageTypeIfTargetFrozen === effect.damageType &&
        card.descriptionLines.includes("Doubled against Frozen enemies")
      ) {
        const baseLine = `Deal ${effect.amount} ${capitalizeWord(effect.damageType)} damage`;
        const baseLineIndex = card.descriptionLines.indexOf(baseLine);
        if (baseLineIndex >= 0) {
          conditionalLines.add(baseLineIndex);
          addTarget(node, "amount", baseLineIndex, baseLine.indexOf(String(effect.amount)));
        }
      }
      return;
    }
    // Fixed rules and implicit quantities must not claim a later effect's number.
    if (effect.kind === "random-draw") return;
    if (effect.kind === "wish" && card.descriptionLines.some((line) => WISHING_WELL_LINE.test(line))) return;
    if (effect.kind === "remove-harmful-status" && card.descriptionLines.includes("Cleanse a harmful status effect"))
      return;
    const record = effect as Record<string, unknown>;
    for (const field of CORRUPTIBLE_NUMERIC_FIELDS) {
      const value = record[field];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      if (
        field === "amount" &&
        (((effect.kind === "remove-enemy-armor" || effect.kind === "remove-harmful-status") && effect.removeAll) ||
          (effect.kind === "damage" && effect.equalToForge))
      )
        continue;
      if (field === "maxAmount" && hasSharedRandomAmount(card, effect)) continue;
      const binding = bindingFor(node, field);
      // Shared prose owns one binding whose plan contains all affected fields.
      // No later pass needs to interpret the compound wording again.
      const combinedLine =
        field === "amount" ? card.descriptionLines.findIndex((line) => sharesCombinedDamageAmount(line, effect)) : -1;
      const sharedLine =
        field === "amount" ? card.descriptionLines.findIndex((line) => sharesDamageAmount(line, effect)) : -1;
      const key =
        combinedLine >= 0
          ? `combined/${combinedLine}`
          : sharedLine >= 0
            ? `${isRepeatedDamageLine(card.descriptionLines[sharedLine]!) ? "repeat" : effectIndex}/${sharedLine}`
            : null;
      const shared = key === null ? undefined : sharedBindings.get(key);
      if (key !== null && shared) {
        if (combinedLine >= 0 && shared.effect.kind !== "damage" && effect.kind === "damage") {
          binding.edits.push(...shared.edits);
          sharedBindings.set(key, binding);
        } else shared.edits.push(...binding.edits);
      } else {
        if (key !== null) sharedBindings.set(key, binding);
        if (combinedLine < 0) bindings.push(binding);
      }
    }
    effectChildren(effect).forEach((child, index) => collect(child, effectIndex, [...effectPath, index]));
  }
  card.effects.forEach((effect, index) => collect(effect, index));

  function claim(value: number, line: string, accepts: (binding: NumericBinding) => boolean = () => true) {
    const available = (binding: NumericBinding) => !binding.claimed && binding.value === value && accepts(binding);
    const binding =
      bindings.find((entry) => available(entry) && canonicalLine(entry.effect) === line) ?? bindings.find(available);
    if (binding) binding.claimed = true;
    return binding;
  }

  card.descriptionLines.forEach((line, lineIndex) => {
    if (conditionalLines.has(lineIndex)) return;
    // A summon summary describes the Companion's actions, not this card's effects.
    if (lineIndex === 0 && card.effects.some((effect) => effect.kind === "summon-companion")) return;
    const combined = sharedBindings.get(`combined/${lineIndex}`);
    if (combined?.effect.kind === "damage") {
      targets.push(targetFromBinding(combined, lineIndex, line.indexOf(String(combined.value))));
      return;
    }
    const wishingWell = WISHING_WELL_LINE.exec(line);
    if (wishingWell) {
      const gold = claim(Number(wishingWell[1]), line, (entry) => entry.effect.kind === "gain-gold");
      if (gold) targets.push(targetFromBinding(gold, lineIndex, 5));
      return;
    }
    const sharedResource = SHARED_RESOURCE_CHOICE_LINE.exec(line);
    if (sharedResource) {
      const value = Number(sharedResource[1]);
      const shared = claim(value, line, (entry) => isSharedResourceChoiceEffect(entry.effect));
      if (shared) {
        for (const binding of bindings) {
          if (
            binding !== shared &&
            binding.effectIndex === shared.effectIndex &&
            binding.value === value &&
            isSharedResourceChoiceEffect(binding.effect)
          ) {
            binding.claimed = true;
            shared.edits.push(...binding.edits);
          }
        }
        targets.push(targetFromBinding(shared, lineIndex, 5));
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
    for (const match of matches) {
      if (match.index === undefined) continue;
      const binding = claim(Number(match[0]), line);
      if (binding) targets.push(targetFromBinding(binding, lineIndex, match.index));
    }
  });

  // Unshown nested copies follow their source. An independently displayed
  // delayed amount owns its own address, even when its value is identical.
  const authored = new Set(targets.map(effectAddressKey));
  const nodeOrder = new Map(nodes.map((node, index) => [effectAddressKey(node), index]));
  for (const target of targets) {
    const source = getCorruptionTargetEffect(card, target)!;
    const edits = target.edits;
    for (const node of nodes) {
      if (!node.effectPath || authored.has(effectAddressKey(node)) || !areEffectsEquivalent(node.effect, source))
        continue;
      if (!edits.some((edit) => effectAddressKey(edit) === effectAddressKey(node)))
        edits.push(...bindingFor(node, target.field).edits);
    }
    edits.sort((a, b) => nodeOrder.get(effectAddressKey(a))! - nodeOrder.get(effectAddressKey(b))!);
  }
  return targets.sort((a, b) => a.lineIndex - b.lineIndex || a.matchIndex - b.matchIndex);
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
