import {
  getCardDescription,
  renderCardDescription,
  type BattleCard,
  type CardMagnitudeReference,
} from "@/lib/game-data";
import type { NumericEffectAddress } from "./effect-address";

export type NumericEffectEdit = CardMagnitudeReference & { expectedValue: number; multiplier: 1 | 2 };

export interface CorruptionTarget extends NumericEffectAddress {
  id: string;
  lineIndex: number;
  matchIndex: number;
  value: number;
  field: CardMagnitudeReference["field"];
  edits: readonly NumericEffectEdit[];
  affectsCost: boolean;
}

export function getEditableCorruptionTargets(card: BattleCard): CorruptionTarget[] {
  const seen = new Set<string>();
  return renderCardDescription(card.effects, getCardDescription(card)).magnitudes.flatMap(
    ({ id, magnitude, value, lineIndex, matchIndex }) => {
      const reference = magnitude.references[0]!;
      if (magnitude.editable === false || seen.has(id)) return [];
      // These are fixed rules even when their renderer spells out the quantity.
      if (value === 1 && (magnitude.format === "cleanse" || magnitude.format === "turns")) return [];
      seen.add(id);
      const edits = magnitude.references.map(
        (entry): NumericEffectEdit => ({
          ...entry,
          expectedValue: value * (entry.multiplier ?? 1),
          multiplier: entry.multiplier ?? 1,
        }),
      );
      return [
        {
          id,
          lineIndex,
          matchIndex,
          value,
          effectIndex: reference.effectIndex,
          ...(reference.effectPath ? { effectPath: reference.effectPath } : {}),
          field: reference.field,
          edits,
          affectsCost: edits.some((edit) =>
            ["self-damage", "lose-health", "lose-mana", "lose-max-mana"].includes(edit.kind),
          ),
        },
      ];
    },
  );
}
