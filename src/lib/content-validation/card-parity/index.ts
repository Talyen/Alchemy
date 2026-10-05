import { describeCardEffects, type BattleCard } from "@/lib/game-data";
import { MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import { capitalizeWord } from "@/lib/utils";
import type { ContentValidationIssue } from "../types";
import { flattenEffects } from "./helpers";

export { TRAIT_REQUIRED_TERMS } from "./enemy-trait-parity";
export { validateTrinketDescriptionParity } from "./trinket-parity";

function cardIssue(severity: "error" | "warning", id: string, message: string): ContentValidationIssue {
  return { severity, area: "cards", id, message };
}

// Tag-like lines carry no numeric mechanic and stay warnings-only, matching
// the previous checker: a missing Leech/Archery/Consume/Companion line never
// errors, it warns.
function tagLinesFor(card: BattleCard): Set<string> {
  const tags = new Set<string>(["Leech", "Consume", "Companion"]);
  for (const tag of card.tags ?? []) tags.add(capitalizeWord(tag));
  return tags;
}

function checkTagWarnings(card: BattleCard): ContentValidationIssue[] {
  const warnings: ContentValidationIssue[] = [];
  const flat = flattenEffects(card.effects);
  if (
    flat.some((effect) => effect.kind === "damage" && effect.lifesteal === true) &&
    !card.descriptionLines.some((line) => line === "Leech")
  )
    warnings.push(cardIssue("warning", card.id, "Lifesteal effect is missing Leech description line"));
  const hasArcheryTag = card.tags?.includes("archery") === true;
  const hasArcheryLine = card.descriptionLines.some((line) => line === "Archery");
  if (hasArcheryTag !== hasArcheryLine)
    warnings.push(
      cardIssue(
        "warning",
        card.id,
        hasArcheryTag
          ? "Archery tag is missing Archery description line"
          : "Archery description line is missing archery tag",
      ),
    );
  if (card.consume === true) {
    const hasConsume = card.descriptionLines.some((line) => line === "Consume");
    const hasCompanion =
      flat.some((effect) => effect.kind === "summon-companion") &&
      card.descriptionLines.some((line) => line === "Companion");
    if (!hasConsume && !hasCompanion)
      warnings.push(cardIssue("warning", card.id, "consume:true is missing Consume or Companion description line"));
  }
  if (
    flat.some((effect) => effect.kind === "summon-companion") &&
    !card.descriptionLines.some((line) => line.includes("Companion"))
  )
    warnings.push(cardIssue("warning", card.id, "summon-companion effect is missing Companion description line"));
  return warnings;
}

// The catalog's Steal wording is a flavor alias for the canonical Gain gold
// line. Player-visible text stays untouched; only the checker normalizes.
function normalizeAlias(line: string): string {
  if (line.startsWith("Steal ")) return `Gain ${line.slice("Steal ".length)}`;
  if (line.startsWith("Steals ")) return `Gain ${line.slice("Steals ".length)}`;
  return line;
}

function diffMechanicLines(card: BattleCard, expectedMechanic: string[]): ContentValidationIssue[] {
  const tags = tagLinesFor(card);
  const actualMechanic = card.descriptionLines.filter((line) => !tags.has(line));
  const expectedNormalized = expectedMechanic.filter((line) => !tags.has(line));
  const issues: ContentValidationIssue[] = [];
  const count = Math.max(actualMechanic.length, expectedNormalized.length);
  for (let index = 0; index < count; index += 1) {
    const actual = actualMechanic[index];
    const expected = expectedNormalized[index];
    if (actual === undefined && expected !== undefined) {
      issues.push(cardIssue("error", card.id, `missing expected description line "${expected}"`));
    } else if (expected === undefined && actual !== undefined) {
      issues.push(cardIssue("error", card.id, `"${actual}" has no matching effect`));
    } else if (actual !== undefined && expected !== undefined && normalizeAlias(actual) !== expected) {
      issues.push(cardIssue("error", card.id, `"${actual}" does not match expected "${expected}"`));
    }
  }
  return issues;
}

export function validateCardDescriptionParity(card: BattleCard): ContentValidationIssue[] {
  const warnings = checkTagWarnings(card);
  // Summon summaries describe the Companion's actions rather than this card's
  // magnitude fields. Preserve tag-only validation, including added effects.
  if (card.id === MIXED_POTION_CARD_ID) return warnings;
  if (flattenEffects(card.effects).some((effect) => effect.kind === "summon-companion")) return warnings;
  let expected: string[];
  try {
    expected = describeCardEffects(card.effects);
  } catch {
    // Effect kinds without canonical phrasing (no catalog usage) stay lenient.
    return warnings;
  }
  if (card.tags) expected.push(...card.tags.map(capitalizeWord));
  if (card.consume) expected.push("Consume");
  return [...warnings, ...diffMechanicLines(card, expected)];
}
