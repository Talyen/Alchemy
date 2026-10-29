import type { BattleCard, BattleCardEffect } from "../types";
import { createEffectDescription } from "../effect-description";
import { mapEffectChildren, visitBattleCardEffects } from "../effect-tree";
import { withCardDescription } from "../card-description-model";
import { SHIELD_BASH_SPEND_VERSION } from "./card-definition-versions";
import { ELUSIVE_DODGE_PROBABILITY } from "@/lib/game-constants";

interface NormalizationResult {
  card: BattleCard;
  outcome: "unchanged" | "normalized" | "ambiguous";
  reason?: string;
}
type Damage = Extract<BattleCardEffect, { kind: "damage" }>;

function clause(effect: BattleCardEffect): string | undefined {
  const parts = createEffectDescription([effect])[0]?.parts;
  return parts?.length === 1 && typeof parts[0] === "string" ? parts[0] : undefined;
}

function occurrences(parts: readonly string[], text: string): number {
  let count = 0;
  for (const part of parts) {
    let position = part.indexOf(text);
    while (position !== -1) {
      count++;
      position = part.indexOf(text, position + text.length);
    }
  }
  return count;
}

/** Transmutation appends its Dodge outside any existing branches or scheduled effects. */
function hasLegacyElusiveDodge(card: BattleCard): boolean {
  const effect = card.effects.at(-1);
  return card.transmuted === "dodge" && effect?.kind === "dodge-next-attack" && effect.probability === undefined;
}

function normalizeElusive(card: BattleCard): NormalizationResult {
  if (!hasLegacyElusiveDodge(card)) return { card, outcome: "unchanged" };
  const oldClause = "Dodge the next attack";
  const effect = { kind: "dodge-next-attack" as const, probability: ELUSIVE_DODGE_PROBABILITY };
  const newClause = clause(effect)!;
  const prose = card.description?.flatMap((line) => line.parts.filter((part) => typeof part === "string"));
  if (occurrences(card.descriptionLines, oldClause) !== 1 || (prose && occurrences(prose, oldClause) !== 1))
    return { card, outcome: "ambiguous", reason: "Saved Elusive wording does not identify its appended Dodge" };
  const updated = {
    ...card,
    effects: [...card.effects.slice(0, -1), effect],
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

/** Normalize identifiable retired rules without replacing saved modifications from the catalog. */
export function normalizeSavedCardDefinition(card: BattleCard): NormalizationResult {
  const elusive = normalizeElusive(card);
  const shieldBash = normalizeShieldBash(elusive.card);
  if (shieldBash.outcome === "ambiguous") return shieldBash;
  if (elusive.outcome === "ambiguous") return { ...elusive, card: shieldBash.card };
  return { card: shieldBash.card, outcome: elusive.outcome === "normalized" ? "normalized" : shieldBash.outcome };
}

function normalizeShieldBash(card: BattleCard): NormalizationResult {
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
  const prose: string[] | undefined = card.description ? [] : undefined;
  if (prose) {
    for (const line of card.description!) {
      for (const part of line.parts) if (typeof part === "string") prose.push(part);
    }
  }
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
