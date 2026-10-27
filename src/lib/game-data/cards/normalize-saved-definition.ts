import type { BattleCard, BattleCardEffect } from "../types";
import { createEffectDescription } from "../effect-description";
import { mapEffectChildren, visitBattleCardEffects } from "../effect-tree";
import { withCardDescription } from "../card-description-model";
import { SHIELD_BASH_SPEND_VERSION } from "./card-definition-versions";

interface NormalizationResult {
  card: BattleCard;
  outcome: "unchanged" | "normalized" | "ambiguous";
  reason?: string;
}
type Damage = Extract<BattleCardEffect, { kind: "damage" }>;

function clause(effect: Damage): string | undefined {
  const parts = createEffectDescription([effect])[0]?.parts;
  return parts?.length === 1 && typeof parts[0] === "string" ? parts[0] : undefined;
}

function occurrences(parts: readonly string[], text: string): number {
  return parts.reduce((count, part) => count + part.split(text).length - 1, 0);
}

/** Normalize only the identifiable retired rule; never substitute a modified card from the catalog. */
export function normalizeSavedCardDefinition(card: BattleCard): NormalizationResult {
  if (card.id !== "shield-bash" || (card.definitionVersion ?? 0) >= SHIELD_BASH_SPEND_VERSION)
    return { card, outcome: "unchanged" };
  const selectors: Damage[] = [];
  visitBattleCardEffects(card.effects, (effect) => {
    if (effect.kind === "damage" && effect.equalToBlock) selectors.push(effect);
  });
  const effect = selectors[0];
  if (selectors.length !== 1 || !effect || effect.equalToBlockPercent !== 50 || effect.damageTypePool)
    return { card, outcome: "ambiguous", reason: "Expected one half-Block selector with a single damage type" };

  const oldClause = clause({ ...effect, spendBlock: false });
  const newClause = clause({ ...effect, spendBlock: true });
  if (!oldClause || !newClause)
    return { card, outcome: "ambiguous", reason: "Scaling clause has an unsupported description shape" };
  const prose = card.description?.flatMap((line) => line.parts.filter((part) => typeof part === "string"));
  const oldCount = occurrences(card.descriptionLines, oldClause);
  const newCount = occurrences(card.descriptionLines, newClause);
  if (oldCount + newCount !== 1 || (prose && occurrences(prose, oldClause) + occurrences(prose, newClause) !== 1))
    return { card, outcome: "ambiguous", reason: "Saved wording does not identify exactly one matching Block clause" };
  if (newCount && !effect.spendBlock)
    return { card, outcome: "ambiguous", reason: "Saved spending wording disagrees with its non-spending effect" };

  const update = (candidate: BattleCardEffect): BattleCardEffect =>
    candidate === effect ? { ...effect, spendBlock: true } : mapEffectChildren(candidate, update);
  const updated = {
    ...card,
    definitionVersion: SHIELD_BASH_SPEND_VERSION,
    effects: card.effects.map(update),
    descriptionLines: card.descriptionLines.map((line) => line.replaceAll(oldClause, newClause)),
  };
  return {
    card: card.description
      ? withCardDescription(
          updated,
          card.description.map((line) => ({
            ...line,
            parts: line.parts.map((part) => (typeof part === "string" ? part.replaceAll(oldClause, newClause) : part)),
          })),
        )
      : updated,
    outcome: "normalized",
  };
}
