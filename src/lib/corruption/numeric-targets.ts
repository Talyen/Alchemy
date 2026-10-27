import {
  getCardDescription,
  renderCardDescription,
  type BattleCard,
  type CardMagnitudeReference,
  type CardEffectAddress,
} from "@/lib/game-data";

type NumericEffectEdit = CardMagnitudeReference & { expectedValue: number; multiplier: 1 | 2 };

export interface CorruptionTarget extends CardEffectAddress {
  id: string;
  lineIndex: number;
  value: number;
  field: CardMagnitudeReference["field"];
  edits: readonly NumericEffectEdit[];
  affectsCost: boolean;
}

const COST_EFFECT_KINDS = new Set(["self-damage", "lose-health", "lose-mana", "lose-max-mana"]);

export function getEditableCorruptionTargets(card: BattleCard): CorruptionTarget[] {
  const seen = new Set<string>();
  const targets: CorruptionTarget[] = [];
  for (const { id, magnitude, value, lineIndex } of renderCardDescription(card.effects, getCardDescription(card))
    .magnitudes) {
    const reference = magnitude.references[0]!;
    if (magnitude.editable === false || seen.has(id)) continue;
    // These are fixed rules even when their renderer spells out the quantity.
    if (value === 1 && (magnitude.format === "cleanse" || magnitude.format === "turns")) continue;
    seen.add(id);
    let affectsCost = false;
    const edits = magnitude.references.map((entry): NumericEffectEdit => {
      affectsCost ||= COST_EFFECT_KINDS.has(entry.kind);
      return {
        ...entry,
        expectedValue: value * (entry.multiplier ?? 1),
        multiplier: entry.multiplier ?? 1,
      };
    });
    targets.push({
      id,
      lineIndex,
      value,
      effectIndex: reference.effectIndex,
      ...(reference.effectPath ? { effectPath: reference.effectPath } : {}),
      field: reference.field,
      edits,
      affectsCost,
    });
  }
  return targets;
}
