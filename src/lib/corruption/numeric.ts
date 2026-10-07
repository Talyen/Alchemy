import { CORRUPTION_MIN_VALUE, PERCENT_DENOMINATOR } from "@/lib/game-constants";
import {
  getCardDescription,
  mapEffectChildren,
  withCardDescription,
  type BattleCard,
  type BattleCardEffect,
} from "@/lib/game-data";
import { effectAddressKey, getCorruptionTargetEffect } from "./effect-address";
import type { CorruptionTarget } from "./numeric-targets";

export { getCorruptionTargetEffect } from "./effect-address";
export { getEditableCorruptionTargets } from "./numeric-targets";
export type { CorruptionTarget } from "./numeric-targets";

export function updateCardNumericValue(card: BattleCard, target: CorruptionTarget, nextValue: number): BattleCard {
  if (!Number.isFinite(nextValue) || !target.edits.length) return card;
  if (target.field === "equalToGoldPercent") nextValue = Math.min(PERCENT_DENOMINATOR, nextValue);
  if (nextValue === target.value) return card;
  const description = getCardDescription(card);
  let foundToken = false;
  for (const line of description) {
    for (const token of line.parts) {
      if (typeof token === "string" || token.id !== target.id) continue;
      foundToken = true;
      if (
        token.references.length !== target.edits.length ||
        token.references.some((reference, index) => {
          const edit = target.edits[index]!;
          return (
            effectAddressKey(reference) !== effectAddressKey(edit) ||
            reference.kind !== edit.kind ||
            reference.field !== edit.field ||
            (reference.multiplier ?? 1) !== edit.multiplier
          );
        })
      )
        return card;
    }
  }
  if (!foundToken) return card;
  // Validate the complete shared plan before copying; one stale branch rejects
  // the whole edit. Nothing depends on the wording or rendered character offset.
  const editsByAddress = new Map<string, Array<(typeof target.edits)[number]>>();
  for (const edit of target.edits) {
    const effect = getCorruptionTargetEffect(card, edit);
    if (!effect || effect.kind !== edit.kind || (effect as Record<string, unknown>)[edit.field] !== edit.expectedValue)
      return card;
    const key = effectAddressKey(edit);
    const edits = editsByAddress.get(key) ?? [];
    edits.push(edit);
    editsByAddress.set(key, edits);
  }
  function update(effect: BattleCardEffect, root: number, path: number[] = []): BattleCardEffect {
    const edits = editsByAddress.get(effectAddressKey({ effectIndex: root, effectPath: path }));
    const changed = edits ? { ...effect } : effect;
    for (const edit of edits ?? []) (changed as Record<string, unknown>)[edit.field] = nextValue * edit.multiplier;
    return mapEffectChildren(changed, (child, index) => update(child, root, [...path, index]));
  }
  return withCardDescription(
    { ...card, effects: card.effects.map((effect, index) => update(effect, index)) },
    description,
  );
}

export function applyNumericCorruption(card: BattleCard, target: CorruptionTarget, delta: number): BattleCard {
  let nextValue = Math.max(CORRUPTION_MIN_VALUE, target.value + delta);
  if (target.field === "equalToGoldPercent") nextValue = Math.min(PERCENT_DENOMINATOR, nextValue);
  const source = getCorruptionTargetEffect(card, target);
  if (source?.kind === "companion-action") nextValue = Math.max(1, nextValue);
  if (
    source?.kind === "random-damage" &&
    !target.edits.some((edit) => effectAddressKey(edit) === effectAddressKey(target) && edit.field !== target.field)
  ) {
    if (target.field === "minAmount") nextValue = Math.min(nextValue, source.maxAmount);
    if (target.field === "maxAmount") nextValue = Math.max(nextValue, source.minAmount);
  }
  const next = updateCardNumericValue(card, target, nextValue);
  if (next === card) return card;
  const description = getCardDescription(next).map((line) => ({
    ...line,
    parts: line.parts.map((part) =>
      typeof part !== "string" && part.id === target.id ? { ...part, corrupted: true } : part,
    ),
  }));
  return withCardDescription({ ...next, corrupted: true }, description);
}
